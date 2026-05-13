import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { DebugProtocol } from '@vscode/debugprotocol';

export interface DapClientOptions {
  adapterPath: string;
  artifactDirectory: string;
  requestTimeoutMs?: number;
}

type DapMessage =
  | DebugProtocol.Request
  | DebugProtocol.Response
  | DebugProtocol.Event;

interface PendingResponse {
  command: string;
  reject: (error: Error) => void;
  resolve: (body: unknown) => void;
  timeout: NodeJS.Timeout;
}

interface PendingEvent {
  description: string;
  matches: (message: DebugProtocol.Event) => boolean;
  reject: (error: Error) => void;
  resolve: (message: DebugProtocol.Event) => void;
  timeout: NodeJS.Timeout;
}

const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const CONTENT_LENGTH = /^Content-Length:\s*(\d+)\s*$/imu;

export class DapClient {
  private buffer = Buffer.alloc(0);
  private nextSequence = 1;
  private readonly pendingResponses = new Map<number, PendingResponse>();
  private readonly pendingEvents: PendingEvent[] = [];
  private readonly eventQueue: DebugProtocol.Event[] = [];
  private readonly transcript: Array<{
    direction: 'client' | 'adapter';
    message: DapMessage;
    timestamp: string;
  }> = [];
  private readonly stderrChunks: string[] = [];
  private readonly stdoutOutputs: string[] = [];
  private closePromise: Promise<void> | undefined;

  private constructor(
    private readonly child: ChildProcessWithoutNullStreams,
    private readonly artifactDirectory: string,
    private readonly requestTimeoutMs: number
  ) {
    child.stdout.on('data', (chunk: Buffer) => this.acceptStdout(chunk));
    child.stderr.on('data', (chunk: Buffer) => {
      this.stderrChunks.push(chunk.toString('utf8'));
    });
    child.once('exit', (code, signal) => {
      const reason = signal ? `signal ${signal}` : `exit code ${code ?? 'unknown'}`;
      for (const pending of this.pendingResponses.values()) {
        clearTimeout(pending.timeout);
        pending.reject(new Error(`Debug adapter exited before ${pending.command} completed (${reason}).`));
      }
      this.pendingResponses.clear();
      while (this.pendingEvents.length > 0) {
        const pending = this.pendingEvents.shift()!;
        clearTimeout(pending.timeout);
        pending.reject(new Error(`Debug adapter exited before ${pending.description} (${reason}).`));
      }
    });
  }

  static start(options: DapClientOptions): DapClient {
    const child = spawn(process.execPath, [options.adapterPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return new DapClient(
      child,
      options.artifactDirectory,
      options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
    );
  }

  get outputText(): string {
    return this.stdoutOutputs.join('');
  }

  request<TBody = unknown>(
    command: string,
    args?: unknown,
    timeoutMs = this.requestTimeoutMs
  ): Promise<TBody> {
    const request: DebugProtocol.Request = {
      type: 'request',
      seq: this.nextSequence,
      command,
      ...(args === undefined ? {} : { arguments: args })
    };
    this.nextSequence += 1;

    return new Promise<TBody>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingResponses.delete(request.seq);
        reject(new Error(`Timed out waiting for DAP response to ${command}.`));
      }, timeoutMs);
      this.pendingResponses.set(request.seq, {
        command,
        reject,
        resolve: (body) => resolve(body as TBody),
        timeout
      });
      this.send(request);
    });
  }

  waitForEvent<TEvent extends DebugProtocol.Event = DebugProtocol.Event>(
    event: string,
    predicate?: (message: TEvent) => boolean,
    timeoutMs = this.requestTimeoutMs
  ): Promise<TEvent> {
    return this.waitForAnyEvent<TEvent>(
      [
        {
          event,
          predicate: predicate as ((message: DebugProtocol.Event) => boolean) | undefined
        }
      ],
      timeoutMs
    );
  }

  waitForAnyEvent<TEvent extends DebugProtocol.Event = DebugProtocol.Event>(
    candidates: readonly {
      event: string;
      predicate?: (message: DebugProtocol.Event) => boolean;
    }[],
    timeoutMs = this.requestTimeoutMs
  ): Promise<TEvent> {
    const description = candidates.map((candidate) => candidate.event).join(' or ');
    return new Promise<TEvent>((resolve, reject) => {
      const pending: PendingEvent = {
        description,
        matches: (message) => candidates.some((candidate) =>
          message.event === candidate.event &&
          (!candidate.predicate || candidate.predicate(message))
        ),
        reject,
        resolve: (message) => resolve(message as TEvent),
        timeout: setTimeout(() => {
          const index = this.pendingEvents.indexOf(pending);
          if (index >= 0) {
            this.pendingEvents.splice(index, 1);
          }
          reject(new Error(`Timed out waiting for DAP ${description}.`));
        }, timeoutMs)
      };
      this.pendingEvents.push(pending);
      this.fulfillPendingEvents();
    });
  }

  async stop(): Promise<void> {
    try {
      if (!this.child.killed && this.child.exitCode === null) {
        await this.request('disconnect', { terminateDebuggee: true }, 5_000);
      }
    } catch {
      // Failed sessions are still useful if we preserve the transcript; the
      // child is force-killed below so teardown cannot hide the original error.
    } finally {
      if (!this.child.killed && this.child.exitCode === null) {
        this.child.kill('SIGKILL');
      }
      await this.waitForClose();
      await this.writeArtifacts();
    }
  }

  private acceptStdout(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (true) {
      const headerEnd = this.buffer.indexOf('\r\n\r\n');
      if (headerEnd < 0) {
        return;
      }
      const header = this.buffer.subarray(0, headerEnd).toString('ascii');
      const lengthMatch = CONTENT_LENGTH.exec(header);
      if (!lengthMatch) {
        throw new Error(`Malformed DAP header from adapter: ${header}`);
      }
      const contentLength = Number.parseInt(lengthMatch[1], 10);
      const messageStart = headerEnd + 4;
      const messageEnd = messageStart + contentLength;
      if (this.buffer.length < messageEnd) {
        return;
      }
      const payload = this.buffer.subarray(messageStart, messageEnd).toString('utf8');
      this.buffer = this.buffer.subarray(messageEnd);
      this.acceptMessage(JSON.parse(payload) as DapMessage);
    }
  }

  private acceptMessage(message: DapMessage): void {
    this.transcript.push({
      direction: 'adapter',
      message,
      timestamp: new Date().toISOString()
    });
    if (message.type === 'response') {
      this.acceptResponse(message as DebugProtocol.Response);
      return;
    }
    if (message.type === 'event') {
      const event = message as DebugProtocol.Event;
      if (event.event === 'output') {
        const body = event.body as DebugProtocol.OutputEvent['body'] | undefined;
        this.stdoutOutputs.push(body?.output ?? '');
      }
      this.eventQueue.push(event);
      this.fulfillPendingEvents();
    }
  }

  private acceptResponse(response: DebugProtocol.Response): void {
    const pending = this.pendingResponses.get(response.request_seq);
    if (!pending) {
      return;
    }
    clearTimeout(pending.timeout);
    this.pendingResponses.delete(response.request_seq);
    if (!response.success) {
      pending.reject(new Error(response.message || `${response.command} failed.`));
      return;
    }
    pending.resolve(response.body);
  }

  private fulfillPendingEvents(): void {
    for (let waiterIndex = 0; waiterIndex < this.pendingEvents.length;) {
      const waiter = this.pendingEvents[waiterIndex];
      const eventIndex = this.eventQueue.findIndex((event) =>
        waiter.matches(event)
      );
      if (eventIndex < 0) {
        waiterIndex += 1;
        continue;
      }
      const [event] = this.eventQueue.splice(eventIndex, 1);
      this.pendingEvents.splice(waiterIndex, 1);
      clearTimeout(waiter.timeout);
      waiter.resolve(event);
    }
  }

  private send(message: DebugProtocol.Request): void {
    this.transcript.push({
      direction: 'client',
      message,
      timestamp: new Date().toISOString()
    });
    const json = JSON.stringify(message);
    this.child.stdin.write(
      `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`
    );
  }

  private waitForClose(): Promise<void> {
    if (this.child.exitCode !== null || this.child.signalCode !== null) {
      return Promise.resolve();
    }
    this.closePromise ??= new Promise((resolve) => {
      this.child.once('close', () => resolve());
    });
    return this.closePromise;
  }

  private async writeArtifacts(): Promise<void> {
    await mkdir(this.artifactDirectory, { recursive: true });
    const transcript = this.transcript
      .map((entry) => JSON.stringify(entry))
      .join('\n');
    await Promise.all([
      writeFile(path.join(this.artifactDirectory, 'dap-transcript.jsonl'), `${transcript}\n`, 'utf8'),
      writeFile(path.join(this.artifactDirectory, 'adapter-stderr.log'), this.stderrChunks.join(''), 'utf8'),
      writeFile(path.join(this.artifactDirectory, 'adapter-output.log'), this.outputText, 'utf8')
    ]);
  }
}

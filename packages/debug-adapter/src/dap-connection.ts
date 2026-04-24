import { EventEmitter } from 'node:events';
import type { Readable, Writable } from 'node:stream';

import type { DebugProtocol } from '@vscode/debugprotocol';

export interface DapRequest extends DebugProtocol.Request {
  arguments?: unknown;
}

type RequestListener = (request: DapRequest) => void;

const CONTENT_LENGTH = /^Content-Length:\s*(\d+)\s*$/imu;

export class DapConnection {
  private readonly emitter = new EventEmitter();
  private buffer = Buffer.alloc(0);
  private sequence = 1;

  constructor(
    private readonly input: Readable,
    private readonly output: Writable
  ) {}

  start(): void {
    this.input.on('data', (chunk: Buffer) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.drain();
    });
  }

  onRequest(listener: RequestListener): void {
    this.emitter.on('request', listener);
  }

  sendResponse(
    request: DapRequest,
    body?: unknown,
    success = true,
    message?: string
  ): void {
    const response: DebugProtocol.Response = {
      type: 'response',
      seq: this.nextSeq(),
      request_seq: request.seq,
      command: request.command,
      success
    };
    if (body !== undefined) {
      response.body = body;
    }
    if (message) {
      response.message = message;
    }
    this.send(response);
  }

  sendErrorResponse(request: DapRequest, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.sendResponse(request, undefined, false, message);
  }

  sendEvent(event: string, body?: unknown): void {
    const message: DebugProtocol.Event = {
      type: 'event',
      seq: this.nextSeq(),
      event
    };
    if (body !== undefined) {
      message.body = body;
    }
    this.send(message);
  }

  sendOutput(output: string, category: 'console' | 'stdout' | 'stderr' = 'console'): void {
    this.sendEvent('output', {
      category,
      output
    } satisfies DebugProtocol.OutputEvent['body']);
  }

  private drain(): void {
    while (true) {
      const headerEnd = this.buffer.indexOf('\r\n\r\n');
      if (headerEnd < 0) {
        return;
      }

      const header = this.buffer.subarray(0, headerEnd).toString('ascii');
      const lengthMatch = CONTENT_LENGTH.exec(header);
      if (!lengthMatch) {
        throw new Error(`Malformed DAP header: ${header}`);
      }

      const contentLength = Number.parseInt(lengthMatch[1], 10);
      const messageStart = headerEnd + 4;
      const messageEnd = messageStart + contentLength;
      if (this.buffer.length < messageEnd) {
        return;
      }

      const payload = this.buffer.subarray(messageStart, messageEnd).toString('utf8');
      this.buffer = this.buffer.subarray(messageEnd);
      const message = JSON.parse(payload) as DebugProtocol.ProtocolMessage;
      if (message.type === 'request') {
        this.emitter.emit('request', message as DapRequest);
      }
    }
  }

  private send(message: DebugProtocol.ProtocolMessage): void {
    const json = JSON.stringify(message);
    this.output.write(`Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`);
  }

  private nextSeq(): number {
    const sequence = this.sequence;
    this.sequence += 1;
    return sequence;
  }
}

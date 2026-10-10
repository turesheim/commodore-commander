import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import type { Writable } from 'node:stream';

import { resolveViceCommandInput } from './vice-process';

export interface ViceStandaloneProcessLaunch {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
}

export interface ViceStandaloneProcessClose {
  readonly pid: number | undefined;
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
}

export interface ViceStandaloneProcessCallbacks {
  readonly onStdout?: (chunk: Buffer) => void;
  readonly onStderr?: (chunk: Buffer) => void;
  readonly onError?: (error: Error, pid: number | undefined) => void;
  readonly onClose?: (event: ViceStandaloneProcessClose) => void;
}

/**
 * Owns one standalone embedded emulator and its inherited command pipe.
 * Launch arguments and process environment follow the standalone path, which
 * does not require a PRG, allocate a monitor port, or set VICE_INITIAL_CWD.
 * The caller owns frame transport, protocol encoding, and user-facing status.
 */
export class ViceStandaloneProcess {
  private child: ChildProcessWithoutNullStreams | undefined;
  private commandInput: Writable | undefined;

  constructor(private readonly callbacks: ViceStandaloneProcessCallbacks = {}) {}

  get hasProcess(): boolean {
    return this.child !== undefined;
  }

  get pid(): number | undefined {
    return this.child?.pid;
  }

  // Like Node spawn, this reports asynchronous launch failures through onError.
  start(launch: ViceStandaloneProcessLaunch): number | undefined {
    this.stop();
    const child = spawn(launch.command, launch.args, {
      cwd: launch.cwd,
      stdio: ['pipe', 'pipe', 'pipe', 'pipe']
    });
    this.child = child;
    this.commandInput = resolveViceCommandInput(child);

    child.stdout.on('data', (chunk: Buffer) => {
      if (this.child === child) {
        this.callbacks.onStdout?.(chunk);
      }
    });
    child.stderr.on('data', (chunk: Buffer) => {
      if (this.child === child) {
        this.callbacks.onStderr?.(chunk);
      }
    });
    child.on('error', (error: Error) => {
      if (this.child !== child) {
        return;
      }
      this.child = undefined;
      this.commandInput = undefined;
      this.callbacks.onError?.(error, child.pid);
    });
    child.on('close', (exitCode: number | null, signal: NodeJS.Signals | null) => {
      if (this.child !== child) {
        return;
      }
      this.child = undefined;
      this.commandInput = undefined;
      this.callbacks.onClose?.({ pid: child.pid, exitCode, signal });
    });
    return child.pid;
  }

  sendCommand(encodedCommand: string): void {
    const child = this.child;
    const commandInput = this.commandInput ?? child?.stdin;
    if (!child || child.killed || !commandInput?.writable) {
      return;
    }
    commandInput.write(encodedCommand, 'utf8');
  }

  stop(): void {
    const child = this.child;
    // Release ownership first so late output/error/close events cannot affect
    // a replacement process. Explicit stop is reported by the caller.
    this.child = undefined;
    this.commandInput = undefined;
    if (child && !child.killed) {
      child.kill();
    }
  }
}

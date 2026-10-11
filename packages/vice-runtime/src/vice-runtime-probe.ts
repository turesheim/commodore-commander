import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parseViceEmbedProtocolLine } from './vice-embed-json-codec';
import { VICE_EMBED_FLAG } from './vice-launch-flags';

const execute = promisify(execFile);

export interface ViceRuntimeProbeResult {
  readonly version: string;
  readonly embedded: boolean;
}

/** Check executable loading/protocol without booting a machine or opening UI. */
export async function probeViceRuntime(
  command: string,
  embedded: boolean,
  timeoutMs = 5000
): Promise<ViceRuntimeProbeResult> {
  const { stdout, stderr } = await execute(command, [
    ...(embedded ? [VICE_EMBED_FLAG] : []), '-version'
  ], { timeout: timeoutMs, killSignal: 'SIGKILL', maxBuffer: 64 * 1024, windowsHide: true });
  const output = `${stdout}\n${stderr}`;
  const version = /\bVICE\s+(\d+(?:\.\d+)+(?:[\w.-]*))/iu.exec(output)?.[1];
  if (!version) {
    throw new Error(`The selected executable did not identify itself as VICE: ${command}.`);
  }
  const hello = stdout.split(/\r?\n/u).some(line =>
    parseViceEmbedProtocolLine(line)?.type === 'hello'
  );
  if (embedded && !hello) {
    throw new Error(
      `VICE ${version} does not advertise Commodore Commander's embedded protocol. ` +
      'Use a patched runtime or select external launch mode for stock VICE.'
    );
  }
  return { version, embedded: hello };
}

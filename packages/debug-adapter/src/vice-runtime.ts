import { accessSync } from 'node:fs';
import { access, constants } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';

const DEFAULT_TERMINATION_TIMEOUT_MS = 1500;
const DEFAULT_FORCE_KILL_TIMEOUT_MS = 1000;

export interface ViceProcessLaunchOptions {
  program: string;
  cwd: string;
  viceResourcesPath: string;
  viceExecutable: string;
  viceArgs: readonly string[];
  enableMonitor?: boolean;
  monitorHost?: string;
  monitorPort?: number;
}

export interface ViceProcessLaunchResult {
  child: ChildProcess;
  monitorHost?: string;
  monitorPort?: number;
  command: string;
  args: readonly string[];
}

export interface ViceProcessTerminateOptions {
  signal?: NodeJS.Signals;
  timeoutMs?: number;
  forceKillTimeoutMs?: number;
}

export interface ViceProcessArgsOptions {
  program: string;
  viceArgs: readonly string[];
  monitor?: {
    host: string;
    port: number;
  };
}

export async function launchViceProcess(
  options: ViceProcessLaunchOptions
): Promise<ViceProcessLaunchResult> {
  await assertReadable(options.program, 'PRG file');
  const command = await resolveViceCommand(
    options.viceResourcesPath,
    options.viceExecutable
  );

  const enableMonitor = options.enableMonitor ?? true;
  const monitorHost = enableMonitor ? options.monitorHost ?? '127.0.0.1' : undefined;
  const monitorPort = enableMonitor
    ? options.monitorPort ?? await findAvailablePort(monitorHost!)
    : undefined;
  const args = createViceProcessArgs({
    program: options.program,
    viceArgs: options.viceArgs,
    ...(monitorHost && monitorPort !== undefined
      ? { monitor: { host: monitorHost, port: monitorPort } }
      : {})
  });

  const child = spawn(command, args, {
    cwd: options.cwd,
    env: {
      ...process.env,
      VICE_INITIAL_CWD: options.cwd
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  await waitForSpawn(child, command);
  return {
    child,
    monitorHost,
    monitorPort,
    command,
    args
  };
}

export async function terminateViceProcess(
  child: ChildProcess,
  options: ViceProcessTerminateOptions = {}
): Promise<boolean> {
  if (hasExited(child)) {
    return true;
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TERMINATION_TIMEOUT_MS;
  const forceKillTimeoutMs = options.forceKillTimeoutMs ?? DEFAULT_FORCE_KILL_TIMEOUT_MS;
  const signal = options.signal ?? 'SIGTERM';
  child.kill(signal);
  if (await waitForClose(child, timeoutMs)) {
    return true;
  }

  child.kill('SIGKILL');
  return waitForClose(child, forceKillTimeoutMs);
}

export function createViceProcessArgs(
  options: ViceProcessArgsOptions
): string[] {
  const args = [
    ...options.viceArgs,
    ...configArgs(options.program, options.viceArgs)
  ];

  if (options.monitor) {
    args.push(
      '-binarymonitor',
      '-binarymonitoraddress',
      `${options.monitor.host}:${options.monitor.port}`,
      '-initbreak',
      'ready'
    );
  }

  args.push(options.program);
  return args;
}

export async function assertReadable(
  filePath: string,
  description: string
): Promise<void> {
  try {
    await access(filePath, constants.R_OK);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${description} is not readable: ${filePath}. ${message}`);
  }
}

export async function assertExecutable(
  filePath: string,
  description: string
): Promise<void> {
  try {
    await access(filePath, constants.X_OK);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${description} is not executable: ${filePath}. ${message}`);
  }
}

function configArgs(program: string, viceArgs: readonly string[]): string[] {
  if (viceArgs.includes('-config')) {
    return [];
  }
  const viceConfig = findViceConfig(path.dirname(program));
  return viceConfig ? ['-config', viceConfig] : [];
}

function findViceConfig(directory: string): string | undefined {
  const candidate = path.join(directory, 'vice.ini');
  try {
    accessSync(candidate);
    return candidate;
  } catch {
    const parent = path.dirname(directory);
    return parent === directory ? undefined : findViceConfig(parent);
  }
}

function waitForSpawn(
  child: ChildProcess,
  command: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    child.once('spawn', resolve);
    child.once('error', (error) => {
      reject(new Error(`Failed to start VICE: ${command}. ${error.message}`));
    });
  });
}

function waitForClose(child: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (hasExited(child)) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      child.off('close', closeListener);
      resolve(false);
    }, timeoutMs);
    const closeListener = (): void => {
      clearTimeout(timeout);
      resolve(true);
    };
    child.once('close', closeListener);
  });
}

function hasExited(child: ChildProcess): boolean {
  return child.exitCode !== null || child.signalCode !== null;
}

function findAvailablePort(host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, host, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Could not allocate a VICE binary monitor port.'));
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
  });
}

export async function resolveViceCommand(
  viceResourcesPath: string,
  viceExecutable: string
): Promise<string> {
  const executable = normalizedExecutableName(viceExecutable);
  if (isPathLike(executable)) {
    const command = path.resolve(executable);
    await assertExecutable(command, `VICE emulator ${viceExecutable}`);
    return command;
  }

  for (const candidate of viceCommandCandidates(viceResourcesPath, executable)) {
    if (await isExecutable(candidate)) {
      return candidate;
    }
  }

  return executable;
}

function viceCommandCandidates(
  viceResourcesPath: string,
  viceExecutable: string
): string[] {
  const executableNames = process.platform === 'win32' &&
    !viceExecutable.toLowerCase().endsWith('.exe')
    ? [viceExecutable, `${viceExecutable}.exe`]
    : [viceExecutable];
  return executableNames.flatMap((executableName) => [
    path.join(viceResourcesPath, 'bin', executableName),
    path.join(viceResourcesPath, executableName)
  ]);
}

async function isExecutable(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function normalizedExecutableName(viceExecutable: string): string {
  return viceExecutable.trim() || 'x64sc';
}

function isPathLike(value: string): boolean {
  return path.isAbsolute(value) || /[\\/]/u.test(value);
}

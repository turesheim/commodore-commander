import { accessSync } from 'node:fs';
import { access, constants } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';

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
  await assertExecutable(path.join(options.viceResourcesPath, 'script'), 'VICE launcher');
  await assertExecutable(
    path.join(options.viceResourcesPath, 'bin', options.viceExecutable),
    `VICE emulator ${options.viceExecutable}`
  );

  const enableMonitor = options.enableMonitor ?? true;
  const monitorHost = enableMonitor ? options.monitorHost ?? '127.0.0.1' : undefined;
  const monitorPort = enableMonitor
    ? options.monitorPort ?? await findAvailablePort(monitorHost!)
    : undefined;
  const command = path.join(options.viceResourcesPath, 'script');
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
      PROGRAM: options.viceExecutable,
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
      reject(new Error(`Failed to start embedded VICE: ${command}. ${error.message}`));
    });
  });
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

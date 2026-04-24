import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

import {
  createKickAssemblerInvocation,
  type KickAssemblerBuildProgram
} from '@commodore-commander/language-support';

export interface KickAssemblerProgramInvocation {
  command: string;
  args: readonly string[];
  cwd: string;
}

export interface KickAssemblerProgramRunResult
  extends KickAssemblerProgramInvocation {
  succeeded: boolean;
  exitCode?: number;
}

export interface KickAssemblerProgramRunOptions {
  onOutput?: (stream: 'stdout' | 'stderr', chunk: string) => void;
}

export async function prepareKickAssemblerProgramOutput(
  program: KickAssemblerBuildProgram
): Promise<void> {
  await mkdir(program.outputDirectoryPath, { recursive: true });

  if (program.symbolFileDirectoryPath) {
    await mkdir(program.symbolFileDirectoryPath, { recursive: true });
  }
}

export function createKickAssemblerProgramInvocation(
  program: KickAssemblerBuildProgram
): KickAssemblerProgramInvocation {
  const invocation = createKickAssemblerInvocation(program);
  return {
    ...invocation,
    cwd: program.workingDirectoryPath
  };
}

export async function runKickAssemblerProgram(
  program: KickAssemblerBuildProgram,
  options: KickAssemblerProgramRunOptions = {}
): Promise<KickAssemblerProgramRunResult> {
  await prepareKickAssemblerProgramOutput(program);
  const invocation = createKickAssemblerProgramInvocation(program);

  return new Promise<KickAssemblerProgramRunResult>((resolve) => {
    const child = spawn(invocation.command, invocation.args, {
      cwd: invocation.cwd,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let settled = false;

    const settle = (
      result: Omit<KickAssemblerProgramRunResult, keyof KickAssemblerProgramInvocation>
    ): void => {
      if (settled) {
        return;
      }
      settled = true;
      resolve({
        ...invocation,
        ...result
      });
    };

    child.stdout.on('data', (chunk) => {
      options.onOutput?.('stdout', chunk.toString());
    });
    child.stderr.on('data', (chunk) => {
      options.onOutput?.('stderr', chunk.toString());
    });
    child.on('error', (error) => {
      options.onOutput?.(
        'stderr',
        `Failed to start Kick Assembler: ${error.message}\n`
      );
      settle({ succeeded: false });
    });
    child.on('close', (exitCode) => {
      settle({
        succeeded: exitCode === 0,
        exitCode: typeof exitCode === 'number' ? exitCode : undefined
      });
    });
  });
}

export function getBundledKickAssemblerJarPath(
  runtimeDirectory = __dirname
): string {
  const candidates = [
    path.join(runtimeDirectory, 'assets', 'kickassembler', 'KickAss.jar'),
    path.resolve(runtimeDirectory, '..', '..', 'assets', 'kickassembler', 'KickAss.jar')
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

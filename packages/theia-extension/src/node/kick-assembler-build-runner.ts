import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

import {
  createKickAssemblerInvocation,
  type KickAssemblerBuildProgram
} from '@commodore-commander/language-support';
import { SID_SCORE_CLI_JAR_FILENAME } from './sidscore-launch';

const SID_SCORE_KICKASS_PLUGIN_JAR_FILENAME = 'sidscore-kickass-plugin.jar';
const SID_SCORE_KICKASS_PLUGIN_MAIN_CLASS = 'kickass.KickAssembler';

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

  for (const module of program.sidScoreModules) {
    await rm(generatedSidScoreAsmPath(program, module.namespace), { force: true });
  }

  if (program.symbolFileDirectoryPath) {
    await mkdir(program.symbolFileDirectoryPath, { recursive: true });
  }
}

export function createKickAssemblerProgramInvocation(
  program: KickAssemblerBuildProgram
): KickAssemblerProgramInvocation {
  const invocation = createKickAssemblerInvocation(program);
  if (program.sidScoreModules.length === 0) {
    return {
      ...invocation,
      cwd: program.workingDirectoryPath
    };
  }

  const kickAssemblerJar = program.kickAssemblerJar;
  if (!kickAssemblerJar) {
    throw new Error('SIDScore modules require a KickAss jar.');
  }
  const pluginJar = getBundledSidScoreKickAssPluginJarPath();
  const sidScoreJar = getBundledSidScoreCliJarPathForBuild();
  for (const [label, jarPath] of [
    ['SIDScore KickAssembler plugin', pluginJar],
    ['SIDScore CLI', sidScoreJar]
  ] as const) {
    if (!existsSync(jarPath)) {
      throw new Error(`${label} jar is missing: ${jarPath}`);
    }
  }

  const moduleProperties: string[] = [
    `-Dcc.sidscore.count=${program.sidScoreModules.length}`
  ];
  program.sidScoreModules.forEach((module, index) => {
    const generatedAsmPath = generatedSidScoreAsmPath(program, module.namespace);
    moduleProperties.push(
      `-Dcc.sidscore.${index}.source=${module.sourcePath}`,
      `-Dcc.sidscore.${index}.namespace=${module.namespace}`,
      `-Dcc.sidscore.${index}.origin=${module.origin}`,
      `-Dcc.sidscore.${index}.generatedAsm=${generatedAsmPath}`
    );
  });
  const kickAssemblerArgs = invocation.args.slice(program.javaArgs.length + 2);
  return {
    command: invocation.command,
    args: [
      ...program.javaArgs,
      ...moduleProperties,
      '-cp',
      [kickAssemblerJar, pluginJar, sidScoreJar].join(path.delimiter),
      SID_SCORE_KICKASS_PLUGIN_MAIN_CLASS,
      ...kickAssemblerArgs
    ],
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
      if (exitCode === 0) {
        const missingModule = program.sidScoreModules.find((module) =>
          !existsSync(generatedSidScoreAsmPath(program, module.namespace))
        );
        if (missingModule) {
          options.onOutput?.(
            'stderr',
            `SIDScore module ${missingModule.namespace} was not assembled. ` +
            `Add .plugin "net.resheim.cc.sidscore.kickass.SIDScoreArchive" to the root ASM file.\n`
          );
          settle({ succeeded: false });
          return;
        }
      }
      settle({
        succeeded: exitCode === 0,
        exitCode: typeof exitCode === 'number' ? exitCode : undefined
      });
    });
  });
}

function generatedSidScoreAsmPath(
  program: KickAssemblerBuildProgram,
  namespace: string
): string {
  return path.join(
    program.outputDirectoryPath,
    'generated',
    'sidscore',
    `${namespace}.asm`
  );
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

export function getBundledSidScoreKickAssPluginJarPath(
  runtimeDirectory = __dirname
): string {
  return findBundledSidScoreJarPath(
    SID_SCORE_KICKASS_PLUGIN_JAR_FILENAME,
    runtimeDirectory
  );
}

function getBundledSidScoreCliJarPathForBuild(
  runtimeDirectory = __dirname
): string {
  return findBundledSidScoreJarPath(SID_SCORE_CLI_JAR_FILENAME, runtimeDirectory);
}

function findBundledSidScoreJarPath(
  filename: string,
  runtimeDirectory: string
): string {
  const candidates = [
    path.join(runtimeDirectory, 'assets', 'sidscore', filename),
    path.resolve(runtimeDirectory, '..', '..', 'assets', 'sidscore', filename),
    path.resolve(runtimeDirectory, '..', '..', '..', '..', 'resources', filename)
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

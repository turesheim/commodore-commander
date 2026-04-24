#!/usr/bin/env node
import path from 'node:path';

import {
  KickAssemblerWorkspaceBuildPlanner,
  loadKickAssemblerBuildConfiguration
} from '@commodore-commander/language-support';

import {
  createKickAssemblerProgramInvocation,
  getBundledKickAssemblerJarPath,
  runKickAssemblerProgram
} from './kick-assembler-build-runner';

interface CliOptions {
  workspaceRootPath: string;
  changedPath?: string;
  configPath?: string;
  profileName?: string;
  programNames: string[];
  dryRun: boolean;
  listPrograms: boolean;
}

void main(process.argv.slice(2)).catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Kick Assembler build failed: ${message}`);
  process.exitCode = 1;
});

async function main(args: readonly string[]): Promise<void> {
  const options = parseCliOptions(args);

  if (!options) {
    return;
  }

  const configuration = await loadKickAssemblerBuildConfiguration(
    options.workspaceRootPath,
    {
      configPath: options.configPath,
      defaultKickAssemblerJar: getBundledKickAssemblerJarPath(),
      profileName: options.profileName
    }
  );
  const planner = new KickAssemblerWorkspaceBuildPlanner();
  const plan = await planner.planWorkspaceBuild(
    options.workspaceRootPath,
    options.changedPath,
    {
      configuration,
      profileName: options.profileName,
      programNames: options.programNames
    }
  );

  if (configuration.configPath) {
    console.log(`Using config: ${configuration.configPath}`);
  }
  if (configuration.defaultProfileName) {
    console.log(`Using profile: ${configuration.defaultProfileName}`);
  }

  if (options.listPrograms) {
    for (const program of plan.programs) {
      const profile = program.profileName ? ` [${program.profileName}]` : '';
      console.log(`${program.name}${profile}: ${program.entryPath}`);
    }
    return;
  }

  if (plan.affectedPrograms.length === 0) {
    console.log(`No Kick Assembler programs selected under ${plan.workspaceRootPath}.`);
    return;
  }

  let succeeded = true;
  for (const program of plan.affectedPrograms) {
    const invocation = createKickAssemblerProgramInvocation(program);
    const profile = program.profileName ? ` [${program.profileName}]` : '';
    console.log(`\nAssembling ${program.name}${profile}: ${program.entryPath}`);
    console.log(`$ ${renderCommand(invocation.command, invocation.args)}`);

    if (options.dryRun) {
      continue;
    }

    const result = await runKickAssemblerProgram(program, {
      onOutput: (stream, chunk) => {
        const output = stream === 'stderr' ? process.stderr : process.stdout;
        output.write(chunk);
      }
    });
    succeeded &&= result.succeeded;

    if (!result.succeeded) {
      console.error(
        `Program ${program.name} failed${formatExitCode(result.exitCode)}.`
      );
    }
  }

  if (!succeeded) {
    process.exitCode = 1;
  }
}

function parseCliOptions(args: readonly string[]): CliOptions | undefined {
  const programNames: string[] = [];
  let workspaceRootPath = process.cwd();
  let changedPath: string | undefined;
  let configPath: string | undefined;
  let profileName: string | undefined;
  let dryRun = false;
  let listPrograms = false;
  const positional: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    switch (arg) {
      case '--help':
      case '-h':
        printHelp();
        return undefined;
      case '--workspace':
      case '-w':
        workspaceRootPath = requireValue(args, index, arg);
        index += 1;
        break;
      case '--changed':
      case '--resource':
      case '-r':
        changedPath = requireValue(args, index, arg);
        index += 1;
        break;
      case '--config':
      case '-c':
        configPath = requireValue(args, index, arg);
        index += 1;
        break;
      case '--profile':
      case '-f':
        profileName = requireValue(args, index, arg);
        index += 1;
        break;
      case '--program':
      case '-p':
        programNames.push(...splitProgramNames(requireValue(args, index, arg)));
        index += 1;
        break;
      case '--dry-run':
        dryRun = true;
        break;
      case '--list-programs':
        listPrograms = true;
        break;
      default:
        if (arg.startsWith('-')) {
          throw new Error(`Unknown option: ${arg}`);
        }
        positional.push(arg);
    }
  }

  if (positional.length > 1) {
    throw new Error(`Expected at most one workspace path, got ${positional.length}.`);
  }
  if (positional[0]) {
    workspaceRootPath = positional[0];
  }

  const resolvedWorkspaceRootPath = path.resolve(workspaceRootPath);
  return {
    workspaceRootPath: resolvedWorkspaceRootPath,
    programNames,
    dryRun,
    listPrograms,
    ...(changedPath
      ? { changedPath: path.resolve(resolvedWorkspaceRootPath, changedPath) }
      : {}),
    ...(configPath
      ? { configPath: path.resolve(resolvedWorkspaceRootPath, configPath) }
      : {}),
    ...(profileName ? { profileName } : {})
  };
}

function requireValue(
  args: readonly string[],
  index: number,
  optionName: string
): string {
  const value = args[index + 1];
  if (!value || value.startsWith('-')) {
    throw new Error(`${optionName} requires a value.`);
  }
  return value;
}

function splitProgramNames(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function renderCommand(command: string, args: readonly string[]): string {
  return [command, ...args]
    .map((segment) =>
      /\s/u.test(segment) ? JSON.stringify(segment) : segment
    )
    .join(' ');
}

function formatExitCode(exitCode: number | undefined): string {
  return typeof exitCode === 'number' ? ` (exit ${exitCode})` : '';
}

function printHelp(): void {
  console.log(`Usage: cc-kickass-build [workspace] [options]

Options:
  -w, --workspace <path>   Workspace root. Defaults to the current directory.
  -c, --config <path>      Build config file. Defaults to project discovery.
  -f, --profile <name>     Build profile to apply to programs without one.
  -p, --program <name>     Program name to build. Repeat or comma-separate.
  -r, --changed <path>     Changed source or generated asset to scope rebuilds.
      --list-programs      Print resolved programs without building.
      --dry-run            Print commands without running Kick Assembler.
  -h, --help               Show this help.
`);
}

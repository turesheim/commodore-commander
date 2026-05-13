import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import path from 'node:path';

import {
  DEFAULT_COMMODORE_MACHINE_PROFILE_ID,
  getCommodoreMachineProfile,
  isCommodoreViceModelForMachineProfile,
  resolveCommodoreMachineProfileId,
  type CommodoreMachineLaunchConfiguration,
  type CommodoreMachineProfile,
  type CommodoreMachineProfileId
} from '@commodore-commander/language-support';
import {
  COMMODORE_COMMANDER_VICE_RESOURCES_PATH_PREFERENCE
} from '../common/commodore-commander-tool-preferences';

export const VICE_DARWIN_ARM64_RESOURCES = path.join(
  'assets',
  'vice',
  'darwin-arm64',
  'VICE.app',
  'Contents',
  'Resources'
);

const VICE_RESOURCES_SUBDIRECTORY = path.join('share', 'vice');

export interface ViceRuntimeResolutionOptions {
  runtimeDirectory?: string;
  resourcesPath?: string;
  executable?: string;
}

export interface ResolvedViceRuntime {
  resourcesPath: string;
  executable?: string;
}

export interface ResolvedViceMachineProfile {
  machine: CommodoreMachineProfileId;
  profile: CommodoreMachineProfile;
  launch: CommodoreMachineLaunchConfiguration;
}

export function resolveViceMachineProfile(
  requestedMachine: CommodoreMachineLaunchConfiguration | undefined
): ResolvedViceMachineProfile {
  const candidate =
    requestedMachine?.profile ?? DEFAULT_COMMODORE_MACHINE_PROFILE_ID;
  const machine = resolveCommodoreMachineProfileId(candidate);
  if (!machine) {
    throw new Error(`Unsupported Commodore machine profile: ${candidate}.`);
  }
  if (
    requestedMachine?.model &&
    !isCommodoreViceModelForMachineProfile(machine, requestedMachine.model)
  ) {
    throw new Error(
      `Unsupported VICE model "${requestedMachine.model}" for ${machine}.`
    );
  }

  return {
    machine,
    profile: getCommodoreMachineProfile(machine),
    launch: {
      profile: machine,
      ...(requestedMachine?.model ? { model: requestedMachine.model } : {}),
      ...(requestedMachine?.viceArgs
        ? { viceArgs: requestedMachine.viceArgs }
        : {})
    }
  };
}

export function createViceArgs(
  profile: CommodoreMachineProfile,
  launch: CommodoreMachineLaunchConfiguration
): string[] {
  const args = launch.model
    ? withoutModelArgs(profile.vice.defaultArgs ?? [])
    : [...(profile.vice.defaultArgs ?? [])];
  if (launch.model) {
    args.push('-model', launch.model);
  }
  args.push(...(launch.viceArgs ?? []));
  return args;
}

export async function getViceResourcesPath(
  runtimeDirectory = __dirname
): Promise<string> {
  return (await resolveViceRuntime({ runtimeDirectory })).resourcesPath;
}

export async function resolveViceRuntime(
  options: ViceRuntimeResolutionOptions = {}
): Promise<ResolvedViceRuntime> {
  const runtimeDirectory = options.runtimeDirectory ?? __dirname;
  const configuredResourcesPath = normalizeConfiguredPath(options.resourcesPath);
  const executable = normalizeConfiguredPath(options.executable);

  const resourceCandidates = [
    ...(configuredResourcesPath ? [configuredResourcesPath] : []),
    ...bundledViceResourceCandidates(runtimeDirectory),
    ...(executable ? executableResourceCandidates(executable) : []),
    ...systemViceResourceCandidates()
  ];

  for (const candidate of uniquePaths(resourceCandidates)) {
    const resolved = path.resolve(candidate);
    if (await isViceResourcesPath(resolved)) {
      return {
        resourcesPath: resolved,
        ...(executable ? { executable } : {})
      };
    }
  }

  if (configuredResourcesPath) {
    throw new Error(
      `Configured VICE resources path does not contain ${VICE_RESOURCES_SUBDIRECTORY}: ${configuredResourcesPath}.`
    );
  }

  throw new Error(
    `VICE runtime resources were not found for ${process.platform}-${process.arch}. ` +
      `Set ${COMMODORE_COMMANDER_VICE_RESOURCES_PATH_PREFERENCE} to a directory containing ${VICE_RESOURCES_SUBDIRECTORY}.`
  );
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

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function withoutModelArgs(args: readonly string[]): string[] {
  const filtered: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '-model') {
      index += 1;
      continue;
    }
    filtered.push(args[index]);
  }
  return filtered;
}

async function isViceResourcesPath(filePath: string): Promise<boolean> {
  return pathExists(path.join(filePath, VICE_RESOURCES_SUBDIRECTORY));
}

function bundledViceResourceCandidates(runtimeDirectory: string): string[] {
  const candidates = embeddedResourceRelativePaths().flatMap((relativePath) => [
    path.join(runtimeDirectory, relativePath),
    path.resolve(runtimeDirectory, '..', '..', relativePath)
  ]);
  if (process.platform === 'darwin' && process.arch === 'arm64') {
    candidates.push(
      path.join(runtimeDirectory, VICE_DARWIN_ARM64_RESOURCES),
      path.resolve(runtimeDirectory, '..', '..', VICE_DARWIN_ARM64_RESOURCES)
    );
  }
  return candidates;
}

function embeddedResourceRelativePaths(): string[] {
  const platformKey = `${process.platform}-${process.arch}`;
  const base = path.join('assets', 'vice', platformKey);
  if (process.platform === 'darwin') {
    return [
      path.join(base, 'VICE.app', 'Contents', 'Resources'),
      base
    ];
  }
  return [base];
}

function executableResourceCandidates(executable: string): string[] {
  if (!isPathLike(executable)) {
    return [];
  }

  const executablePath = path.resolve(executable);
  const directory = path.dirname(executablePath);
  const parent = path.dirname(directory);
  return [
    directory,
    parent,
    path.basename(directory).toLowerCase() === 'bin'
      ? parent
      : path.join(directory, '..')
  ];
}

function systemViceResourceCandidates(): string[] {
  if (process.platform === 'win32') {
    return [
      'C:\\Program Files\\VICE',
      'C:\\Program Files\\GTK3VICE',
      'C:\\Program Files\\SDL2VICE',
      'C:\\Program Files (x86)\\VICE'
    ];
  }

  if (process.platform === 'darwin') {
    return [
      '/Applications/VICE.app/Contents/Resources',
      '/Applications/GTK3VICE.app/Contents/Resources',
      '/usr/local',
      '/opt/homebrew',
      '/opt/local'
    ];
  }

  return [
    '/usr',
    '/usr/local',
    '/opt/vice',
    '/opt'
  ];
}

function normalizeConfiguredPath(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function uniquePaths(paths: readonly string[]): string[] {
  return [...new Set(paths)];
}

function isPathLike(value: string): boolean {
  return path.isAbsolute(value) || /[\\/]/u.test(value);
}

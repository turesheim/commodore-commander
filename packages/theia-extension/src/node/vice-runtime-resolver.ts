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

export const VICE_DARWIN_ARM64_RESOURCES = path.join(
  'assets',
  'vice',
  'darwin-arm64',
  'VICE.app',
  'Contents',
  'Resources'
);

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
  if (process.platform !== 'darwin' || process.arch !== 'arm64') {
    throw new Error(
      `Embedded VICE is currently bundled only for macOS Apple Silicon; current platform is ${process.platform}-${process.arch}.`
    );
  }

  const candidates = [
    path.join(runtimeDirectory, VICE_DARWIN_ARM64_RESOURCES),
    path.resolve(runtimeDirectory, '..', '..', VICE_DARWIN_ARM64_RESOURCES)
  ];

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Embedded VICE runtime was not found. Expected ${VICE_DARWIN_ARM64_RESOURCES} in the packaged application assets.`
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

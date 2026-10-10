import {
  resolveViceRuntime as resolveRuntimeResources,
  type ViceRuntimeResolutionOptions as RuntimeResolutionOptions,
  type ResolvedViceRuntime
} from '@commodore-commander/vice-runtime';
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
  COMMODORE_COMMANDER_VICE_RUNTIME_PATH_PREFERENCE
} from '../common/commodore-commander-tool-preferences';

export {
  assertExecutable,
  assertReadable,
  createEmbeddedViceArgs,
  VICE_DARWIN_ARM64_RESOURCES,
  type ResolvedViceRuntime
} from '@commodore-commander/vice-runtime';

export type ViceRuntimeResolutionOptions = Omit<RuntimeResolutionOptions, 'runtimeDirectory'> & {
  runtimeDirectory?: string;
};

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

// Asset paths must stay relative to the Theia extension after runtime extraction.
export function resolveViceRuntime(
  options: ViceRuntimeResolutionOptions = {}
): Promise<ResolvedViceRuntime> {
  return resolveRuntimeResources({
    ...options,
    runtimeDirectory: options.runtimeDirectory ?? __dirname,
    resourcesPathHint: `Set ${COMMODORE_COMMANDER_VICE_RUNTIME_PATH_PREFERENCE} to a VICE runtime root containing share/vice.`
  });
}

export async function getViceResourcesPath(runtimeDirectory = __dirname): Promise<string> {
  return (await resolveViceRuntime({ runtimeDirectory })).resourcesPath;
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

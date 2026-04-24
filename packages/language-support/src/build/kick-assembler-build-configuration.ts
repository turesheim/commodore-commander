import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  isCommodoreViceModelForMachineProfile,
  resolveCommodoreMachineProfileId,
  type CommodoreMachineLaunchConfiguration
} from '../machines/commodore-machine-profiles.ts';

export const KICK_ASSEMBLER_BUILD_CONFIG_FILENAMES = Object.freeze([
  'commodore-commander.build.json',
  '.commodore-commander.build.json',
  path.join('.commodore-commander', 'build.json')
]);

const DEFAULT_LIBRARY_ROOTS = Object.freeze(['library']);
const DEFAULT_OUTPUT_FOLDER = 'out';
const DEFAULT_JAVA_RUNTIME = 'java';
const DEFAULT_BUILD_POLICY: KickAssemblerRunBuildPolicy = 'ifStale';
const ENV_CONFIG_PATH = 'COMMODORE_COMMANDER_BUILD_CONFIG';
const ENV_BUILD_PROFILE = 'COMMODORE_COMMANDER_BUILD_PROFILE';
const ENV_JAVA_RUNTIME = 'COMMODORE_COMMANDER_JAVA_RUNTIME';
const ENV_KICKASS_JAR = 'COMMODORE_COMMANDER_KICKASS_JAR';

export type KickAssemblerRunBuildPolicy = 'always' | 'ifStale' | 'never';

export interface KickAssemblerBuildSettingsConfiguration {
  javaRuntime?: string;
  javaArgs?: readonly string[];
  kickAssemblerJar?: string;
  libraryRoots?: readonly string[];
  outputFolder?: string;
  workingDirectory?: string;
  showMemory?: boolean;
  debug?: boolean;
  viceSymbols?: boolean;
  debugDump?: boolean;
  symbolFile?: boolean;
  symbolFileFolder?: string;
  assemblerArgs?: readonly string[];
  generatedAssets?: readonly string[];
  runProgram?: string;
}

export interface KickAssemblerBuildProfileConfiguration
  extends KickAssemblerBuildSettingsConfiguration {}

export interface KickAssemblerMachineConfiguration {
  profile: string;
  model?: string;
  viceArgs?: readonly string[];
}

export interface KickAssemblerProgramConfiguration
  extends KickAssemblerBuildSettingsConfiguration {
  name?: string;
  root?: string;
  profile?: string;
  machine?: KickAssemblerMachineConfiguration;
}

export interface KickAssemblerRunConfiguration {
  name?: string;
  program: string;
  profile?: string;
  machine?: KickAssemblerMachineConfiguration;
  runProgram?: string;
  build?: KickAssemblerRunBuildPolicy;
}

export interface KickAssemblerBuildConfiguration
  extends KickAssemblerBuildSettingsConfiguration {
  defaultProfile?: string;
  defaultProgram?: string;
  defaultRun?: string;
  excludeDirectories?: readonly string[];
  profiles?: Readonly<Record<string, KickAssemblerBuildProfileConfiguration>>;
  programs?: readonly KickAssemblerProgramConfiguration[];
  runs?: readonly KickAssemblerRunConfiguration[];
}

export interface KickAssemblerBuildConfigurationEnvironment {
  [name: string]: string | undefined;
}

export interface KickAssemblerBuildConfigurationDefaults {
  javaRuntime?: string;
  kickAssemblerJar?: string;
}

export interface LoadKickAssemblerBuildConfigurationOptions {
  configPath?: string;
  defaultKickAssemblerJar?: string;
  environment?: KickAssemblerBuildConfigurationEnvironment;
  profileName?: string;
}

export interface ResolvedKickAssemblerBuildSettings {
  javaRuntime: string;
  javaArgs: readonly string[];
  kickAssemblerJar?: string;
  libraryRootPaths: readonly string[];
  outputDirectoryPath: string;
  workingDirectoryPath?: string;
  showMemory: boolean;
  debug: boolean;
  viceSymbols: boolean;
  debugDump: boolean;
  symbolFile: boolean;
  symbolFileDirectoryPath?: string;
  assemblerArgs: readonly string[];
  generatedAssetPaths: readonly string[];
  runProgramPath?: string;
}

export interface ResolvedKickAssemblerProgramConfiguration
  extends ResolvedKickAssemblerBuildSettings {
  name: string;
  entryPath: string;
  profileName?: string;
  machine?: CommodoreMachineLaunchConfiguration;
}

export interface ResolvedKickAssemblerRunConfiguration {
  name: string;
  programName: string;
  profileName?: string;
  machine?: CommodoreMachineLaunchConfiguration;
  runProgramPath?: string;
  build: KickAssemblerRunBuildPolicy;
}

export interface ResolvedKickAssemblerBuildConfiguration {
  workspaceRootPath: string;
  configPath?: string;
  defaultProfileName?: string;
  defaultProgramName?: string;
  defaultRunName?: string;
  excludedDirectoryNames: ReadonlySet<string>;
  defaults: ResolvedKickAssemblerBuildSettings;
  programs: readonly ResolvedKickAssemblerProgramConfiguration[];
  runs: readonly ResolvedKickAssemblerRunConfiguration[];
}

interface ResolvedPartialBuildSettings {
  javaRuntime?: string;
  javaArgs?: readonly string[];
  kickAssemblerJar?: string;
  libraryRoots?: readonly string[];
  outputFolder?: string;
  workingDirectory?: string;
  showMemory?: boolean;
  debug?: boolean;
  viceSymbols?: boolean;
  debugDump?: boolean;
  symbolFile?: boolean;
  symbolFileFolder?: string;
  assemblerArgs?: readonly string[];
  generatedAssets?: readonly string[];
  runProgram?: string;
}

export async function loadKickAssemblerBuildConfiguration(
  workspaceRootPath: string,
  options: LoadKickAssemblerBuildConfigurationOptions = {}
): Promise<ResolvedKickAssemblerBuildConfiguration> {
  const normalizedWorkspaceRootPath = path.resolve(workspaceRootPath);
  const configPath = await findKickAssemblerBuildConfigurationPath(
    normalizedWorkspaceRootPath,
    options
  );
  const rawConfiguration = configPath
    ? parseKickAssemblerBuildConfiguration(
        await readFile(configPath, 'utf8'),
        configPath
      )
    : {};
  const resolveOptions: LoadKickAssemblerBuildConfigurationOptions = {};
  if (configPath) {
    resolveOptions.configPath = configPath;
  }
  if (options.defaultKickAssemblerJar) {
    resolveOptions.defaultKickAssemblerJar = options.defaultKickAssemblerJar;
  }
  if (options.environment) {
    resolveOptions.environment = options.environment;
  }
  if (options.profileName) {
    resolveOptions.profileName = options.profileName;
  }

  return resolveKickAssemblerBuildConfiguration(
    normalizedWorkspaceRootPath,
    rawConfiguration,
    resolveOptions
  );
}

export async function findKickAssemblerBuildConfigurationPath(
  workspaceRootPath: string,
  options: Pick<
    LoadKickAssemblerBuildConfigurationOptions,
    'configPath' | 'environment'
  > = {}
): Promise<string | undefined> {
  const environment = options.environment ?? process.env;
  const explicitPath = options.configPath ?? environment[ENV_CONFIG_PATH];

  if (explicitPath) {
    return resolveWorkspacePath(workspaceRootPath, explicitPath);
  }

  for (const filename of KICK_ASSEMBLER_BUILD_CONFIG_FILENAMES) {
    const candidate = path.join(workspaceRootPath, filename);
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

export function parseKickAssemblerBuildConfiguration(
  text: string,
  sourceName = 'Kick Assembler build configuration'
): KickAssemblerBuildConfiguration {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${sourceName} is not valid JSON: ${message}`);
  }

  return readBuildConfigurationObject(parsed, sourceName);
}

export function resolveKickAssemblerBuildConfiguration(
  workspaceRootPath: string,
  configuration: KickAssemblerBuildConfiguration = {},
  options: LoadKickAssemblerBuildConfigurationOptions = {}
): ResolvedKickAssemblerBuildConfiguration {
  const normalizedWorkspaceRootPath = path.resolve(workspaceRootPath);
  const environment = options.environment ?? process.env;
  const profiles = configuration.profiles ?? {};
  const configuredDefaultProfile =
    options.profileName ??
    environment[ENV_BUILD_PROFILE] ??
    configuration.defaultProfile;

  const builtInSettings: ResolvedPartialBuildSettings = {
    javaRuntime: resolveDefaultJavaRuntime(environment),
    libraryRoots: DEFAULT_LIBRARY_ROOTS,
    outputFolder: DEFAULT_OUTPUT_FOLDER,
    showMemory: true,
    debug: false,
    viceSymbols: true,
    debugDump: true,
    symbolFile: true,
    assemblerArgs: [],
    generatedAssets: []
  };
  if (options.defaultKickAssemblerJar) {
    builtInSettings.kickAssemblerJar = options.defaultKickAssemblerJar;
  }

  const baseSettings = mergeSettings(
    builtInSettings,
    pickSettings(configuration),
    readEnvironmentSettings(environment)
  );
  const defaults = resolveSettings(
    normalizedWorkspaceRootPath,
    applyProfile(
      baseSettings,
      profiles,
      configuredDefaultProfile,
      'default profile'
    )
  );
  const programs = (configuration.programs ?? []).map((program, index) =>
    resolveProgramConfiguration(
      normalizedWorkspaceRootPath,
      program,
      index,
      baseSettings,
      profiles,
      configuredDefaultProfile
    )
  );
  const runs = (configuration.runs ?? []).map((run, index) =>
    resolveRunConfiguration(
      normalizedWorkspaceRootPath,
      run,
      index,
      configuredDefaultProfile
    )
  );

  const resolved: ResolvedKickAssemblerBuildConfiguration = {
    workspaceRootPath: normalizedWorkspaceRootPath,
    excludedDirectoryNames: new Set(configuration.excludeDirectories ?? []),
    defaults,
    programs,
    runs
  };

  return {
    ...resolved,
    ...(options.configPath
      ? { configPath: resolveWorkspacePath(normalizedWorkspaceRootPath, options.configPath) }
      : {}),
    ...(configuredDefaultProfile
      ? { defaultProfileName: configuredDefaultProfile }
      : {}),
    ...(configuration.defaultProgram
      ? { defaultProgramName: configuration.defaultProgram }
      : {}),
    ...(configuration.defaultRun ? { defaultRunName: configuration.defaultRun } : {})
  };
}

export function createKickAssemblerInvocation(
  program: Pick<
    ResolvedKickAssemblerProgramConfiguration,
    | 'javaRuntime'
    | 'javaArgs'
    | 'kickAssemblerJar'
    | 'libraryRootPaths'
    | 'entryPath'
    | 'outputDirectoryPath'
    | 'showMemory'
    | 'debug'
    | 'viceSymbols'
    | 'debugDump'
    | 'symbolFile'
    | 'symbolFileDirectoryPath'
    | 'assemblerArgs'
  >
): { command: string; args: readonly string[] } {
  if (!program.kickAssemblerJar) {
    throw new Error(
      'No KickAss jar configured. Set kickAssemblerJar in commodore-commander.build.json or COMMODORE_COMMANDER_KICKASS_JAR.'
    );
  }

  const args: string[] = [...program.javaArgs, '-jar', program.kickAssemblerJar];

  for (const libraryRootPath of program.libraryRootPaths) {
    args.push('-libdir', libraryRootPath);
  }

  args.push(program.entryPath, '-odir', program.outputDirectoryPath);

  if (program.showMemory) {
    args.push('-showmem');
  }
  if (program.debug) {
    args.push('-debug');
  }
  if (program.viceSymbols) {
    args.push('-vicesymbols');
  }
  if (program.debugDump) {
    args.push('-debugdump');
  }
  if (program.symbolFile) {
    args.push('-symbolfile');
  }
  if (program.symbolFileDirectoryPath) {
    args.push('-symbolfiledir', program.symbolFileDirectoryPath);
  }

  args.push(...program.assemblerArgs);

  return {
    command: program.javaRuntime,
    args
  };
}

function readBuildConfigurationObject(
  value: unknown,
  sourceName: string
): KickAssemblerBuildConfiguration {
  const object = expectRecord(value, sourceName);
  const configuration: KickAssemblerBuildConfiguration = {};

  rejectUnsupportedKeys(
    object,
    sourceName,
    'Use profiles, programs, and runs instead.',
    ['defaultVariant', 'rootPrograms', 'targets', 'variants']
  );
  assignSettings(configuration, object, sourceName);
  assignOptionalString(configuration, object, 'defaultProfile', sourceName);
  assignOptionalString(configuration, object, 'defaultProgram', sourceName);
  assignOptionalString(configuration, object, 'defaultRun', sourceName);

  const excludeDirectories = readOptionalStringArray(
    object.excludeDirectories,
    `${sourceName}.excludeDirectories`
  );
  if (excludeDirectories !== undefined) {
    configuration.excludeDirectories = excludeDirectories;
  }

  if (object.profiles !== undefined) {
    const profilesObject = expectRecord(
      object.profiles,
      `${sourceName}.profiles`
    );
    const profiles: Record<string, KickAssemblerBuildProfileConfiguration> = {};
    for (const [profileName, profileValue] of Object.entries(profilesObject)) {
      const profile: KickAssemblerBuildProfileConfiguration = {};
      assignSettings(
        profile,
        expectRecord(profileValue, `${sourceName}.profiles.${profileName}`),
        `${sourceName}.profiles.${profileName}`
      );
      profiles[profileName] = profile;
    }
    configuration.profiles = profiles;
  }

  const programs = readOptionalPrograms(object.programs, `${sourceName}.programs`);
  if (programs !== undefined) {
    configuration.programs = programs;
  }

  const runs = readOptionalRuns(object.runs, `${sourceName}.runs`);
  if (runs !== undefined) {
    configuration.runs = runs;
  }

  return configuration;
}

function assignSettings(
  target: KickAssemblerBuildSettingsConfiguration,
  object: Record<string, unknown>,
  sourceName: string
): void {
  assignOptionalString(target, object, 'javaRuntime', sourceName);
  assignOptionalString(target, object, 'kickAssemblerJar', sourceName);
  assignOptionalString(target, object, 'outputFolder', sourceName);
  assignOptionalString(target, object, 'workingDirectory', sourceName);
  assignOptionalString(target, object, 'symbolFileFolder', sourceName);
  assignOptionalString(target, object, 'runProgram', sourceName);
  assignOptionalBoolean(target, object, 'showMemory', sourceName);
  assignOptionalBoolean(target, object, 'debug', sourceName);
  assignOptionalBoolean(target, object, 'viceSymbols', sourceName);
  assignOptionalBoolean(target, object, 'debugDump', sourceName);
  assignOptionalBoolean(target, object, 'symbolFile', sourceName);
  assignOptionalStringArray(target, object, 'javaArgs', sourceName);
  assignOptionalStringArray(target, object, 'libraryRoots', sourceName);
  assignOptionalStringArray(target, object, 'assemblerArgs', sourceName);
  assignOptionalStringArray(target, object, 'generatedAssets', sourceName);
}

function readOptionalPrograms(
  value: unknown,
  sourceName: string
): KickAssemblerProgramConfiguration[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error(`${sourceName} must be an array.`);
  }

  return value.map((entry, index) => {
    const object = expectRecord(entry, `${sourceName}[${index}]`);
    rejectUnsupportedKeys(
      object,
      `${sourceName}[${index}]`,
      'Use root and profile for program entries.',
      ['entry', 'path', 'variant']
    );
    const program: KickAssemblerProgramConfiguration = {};
    assignSettings(program, object, `${sourceName}[${index}]`);
    assignOptionalString(program, object, 'name', `${sourceName}[${index}]`);
    assignOptionalString(program, object, 'root', `${sourceName}[${index}]`);
    assignOptionalString(program, object, 'profile', `${sourceName}[${index}]`);
    const machine = readOptionalMachineConfiguration(
      object.machine,
      `${sourceName}[${index}].machine`
    );
    if (machine) {
      program.machine = machine;
    }
    return program;
  });
}

function readOptionalMachineConfiguration(
  value: unknown,
  sourceName: string
): KickAssemblerMachineConfiguration | undefined {
  if (value === undefined) {
    return undefined;
  }

  const object = expectRecord(value, sourceName);
  const machine: KickAssemblerMachineConfiguration = {
    profile: readRequiredString(object.profile, `${sourceName}.profile`)
  };
  assignOptionalString(machine, object, 'model', sourceName);
  assignOptionalStringArray(machine, object, 'viceArgs', sourceName);
  return machine;
}

function rejectUnsupportedKeys(
  object: Record<string, unknown>,
  sourceName: string,
  guidance: string,
  keys: readonly string[]
): void {
  const foundKeys = keys.filter((key) => object[key] !== undefined);
  if (foundKeys.length === 0) {
    return;
  }

  throw new Error(
    `${sourceName} uses unsupported build configuration key(s): ${foundKeys.join(', ')}. ${guidance}`
  );
}

function readOptionalRuns(
  value: unknown,
  sourceName: string
): KickAssemblerRunConfiguration[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error(`${sourceName} must be an array.`);
  }

  return value.map((entry, index) => {
    const object = expectRecord(entry, `${sourceName}[${index}]`);
    rejectUnsupportedKeys(
      object,
      `${sourceName}[${index}]`,
      'Use profile for run entries.',
      ['variant']
    );
    const program = readRequiredString(
      object.program,
      `${sourceName}[${index}].program`
    );
    const run: KickAssemblerRunConfiguration = { program };
    assignOptionalString(run, object, 'name', `${sourceName}[${index}]`);
    assignOptionalString(run, object, 'profile', `${sourceName}[${index}]`);
    const machine = readOptionalMachineConfiguration(
      object.machine,
      `${sourceName}[${index}].machine`
    );
    if (machine) {
      run.machine = machine;
    }
    assignOptionalString(run, object, 'runProgram', `${sourceName}[${index}]`);
    const build = readOptionalBuildPolicy(
      object.build,
      `${sourceName}[${index}].build`
    );
    if (build !== undefined) {
      run.build = build;
    }
    return run;
  });
}

function resolveProgramConfiguration(
  workspaceRootPath: string,
  program: KickAssemblerProgramConfiguration,
  index: number,
  baseSettings: ResolvedPartialBuildSettings,
  profiles: Readonly<Record<string, KickAssemblerBuildProfileConfiguration>>,
  configuredDefaultProfile: string | undefined
): ResolvedKickAssemblerProgramConfiguration {
  if (!program.root) {
    throw new Error(`Program ${index + 1} must declare a root file.`);
  }

  const profileName = program.profile ?? configuredDefaultProfile;
  const profileSettings = applyProfile(
    baseSettings,
    profiles,
    profileName,
    `program ${program.name ?? program.root}`
  );
  const programSettings = pickSettings(program);
  const generatedAssets = [
    ...(baseSettings.generatedAssets ?? []),
    ...(profileName ? profiles[profileName]?.generatedAssets ?? [] : []),
    ...(program.generatedAssets ?? [])
  ];
  const mergedSettings = mergeSettings(profileSettings, programSettings);
  if (generatedAssets.length > 0) {
    mergedSettings.generatedAssets = generatedAssets;
  }

  const entryPath = resolveWorkspacePath(workspaceRootPath, program.root);
  const resolvedSettings = resolveSettings(workspaceRootPath, mergedSettings);
  const sourceName = `program ${program.name ?? program.root}`;
  const resolved: ResolvedKickAssemblerProgramConfiguration = {
    ...resolvedSettings,
    name: program.name ?? path.basename(entryPath, path.extname(entryPath)),
    entryPath,
    ...(program.machine
      ? {
          machine: resolveConfiguredMachineConfiguration(
            program.machine,
            `${sourceName}.machine`
          )
        }
      : {})
  };

  return {
    ...resolved,
    ...(profileName ? { profileName } : {})
  };
}

function resolveRunConfiguration(
  workspaceRootPath: string,
  run: KickAssemblerRunConfiguration,
  index: number,
  configuredDefaultProfile: string | undefined
): ResolvedKickAssemblerRunConfiguration {
  const profileName = run.profile ?? configuredDefaultProfile;
  return {
    name: run.name ?? run.program,
    programName: run.program,
    build: run.build ?? DEFAULT_BUILD_POLICY,
    ...(profileName ? { profileName } : {}),
    ...(run.machine
      ? {
          machine: resolveConfiguredMachineConfiguration(
            run.machine,
            `run ${run.name ?? run.program}.machine`
          )
        }
      : {}),
    ...(run.runProgram
      ? { runProgramPath: resolveWorkspacePath(workspaceRootPath, run.runProgram) }
      : {})
  };
}

function resolveConfiguredMachineConfiguration(
  value: KickAssemblerMachineConfiguration,
  sourceName: string
): CommodoreMachineLaunchConfiguration {
  const profile = resolveCommodoreMachineProfileId(value.profile);
  if (!profile) {
    throw new Error(
      `${sourceName}.profile references unsupported Commodore machine profile "${value.profile}".`
    );
  }
  if (
    value.model &&
    !isCommodoreViceModelForMachineProfile(profile, value.model)
  ) {
    throw new Error(
      `${sourceName}.model references unsupported VICE model "${value.model}" for machine profile "${profile}".`
    );
  }
  return {
    profile,
    ...(value.model ? { model: value.model } : {}),
    ...(value.viceArgs ? { viceArgs: value.viceArgs } : {})
  };
}

function applyProfile(
  settings: ResolvedPartialBuildSettings,
  profiles: Readonly<Record<string, KickAssemblerBuildProfileConfiguration>>,
  profileName: string | undefined,
  sourceName: string
): ResolvedPartialBuildSettings {
  if (!profileName) {
    return settings;
  }

  const profile = profiles[profileName];
  if (!profile) {
    throw new Error(`${sourceName} references unknown profile "${profileName}".`);
  }

  return mergeSettings(settings, profile);
}

function pickSettings(
  settings: KickAssemblerBuildSettingsConfiguration
): ResolvedPartialBuildSettings {
  const result: ResolvedPartialBuildSettings = {};
  copyIfDefined(result, settings, 'javaRuntime');
  copyIfDefined(result, settings, 'javaArgs');
  copyIfDefined(result, settings, 'kickAssemblerJar');
  copyIfDefined(result, settings, 'libraryRoots');
  copyIfDefined(result, settings, 'outputFolder');
  copyIfDefined(result, settings, 'workingDirectory');
  copyIfDefined(result, settings, 'showMemory');
  copyIfDefined(result, settings, 'debug');
  copyIfDefined(result, settings, 'viceSymbols');
  copyIfDefined(result, settings, 'debugDump');
  copyIfDefined(result, settings, 'symbolFile');
  copyIfDefined(result, settings, 'symbolFileFolder');
  copyIfDefined(result, settings, 'assemblerArgs');
  copyIfDefined(result, settings, 'generatedAssets');
  copyIfDefined(result, settings, 'runProgram');
  return result;
}

function mergeSettings(
  ...settings: readonly ResolvedPartialBuildSettings[]
): ResolvedPartialBuildSettings {
  const result: ResolvedPartialBuildSettings = {};

  for (const entry of settings) {
    copyIfDefined(result, entry, 'javaRuntime');
    copyIfDefined(result, entry, 'javaArgs');
    copyIfDefined(result, entry, 'kickAssemblerJar');
    copyIfDefined(result, entry, 'libraryRoots');
    copyIfDefined(result, entry, 'outputFolder');
    copyIfDefined(result, entry, 'workingDirectory');
    copyIfDefined(result, entry, 'showMemory');
    copyIfDefined(result, entry, 'debug');
    copyIfDefined(result, entry, 'viceSymbols');
    copyIfDefined(result, entry, 'debugDump');
    copyIfDefined(result, entry, 'symbolFile');
    copyIfDefined(result, entry, 'symbolFileFolder');
    copyIfDefined(result, entry, 'assemblerArgs');
    copyIfDefined(result, entry, 'generatedAssets');
    copyIfDefined(result, entry, 'runProgram');
  }

  return result;
}

function resolveSettings(
  workspaceRootPath: string,
  settings: ResolvedPartialBuildSettings
): ResolvedKickAssemblerBuildSettings {
  const javaRuntime = resolveCommandPath(
    workspaceRootPath,
    settings.javaRuntime ?? DEFAULT_JAVA_RUNTIME
  );
  const libraryRootPaths = (settings.libraryRoots ?? DEFAULT_LIBRARY_ROOTS).map(
    (entry) => resolveWorkspacePath(workspaceRootPath, entry)
  );
  const outputDirectoryPath = resolveWorkspacePath(
    workspaceRootPath,
    settings.outputFolder ?? DEFAULT_OUTPUT_FOLDER
  );
  const generatedAssetPaths = (settings.generatedAssets ?? []).map((entry) =>
    resolveWorkspacePath(workspaceRootPath, entry)
  );
  const resolved: ResolvedKickAssemblerBuildSettings = {
    javaRuntime,
    javaArgs: settings.javaArgs ?? [],
    libraryRootPaths,
    outputDirectoryPath,
    showMemory: settings.showMemory ?? true,
    debug: settings.debug ?? false,
    viceSymbols: settings.viceSymbols ?? true,
    debugDump: settings.debugDump ?? true,
    symbolFile: settings.symbolFile ?? true,
    assemblerArgs: settings.assemblerArgs ?? [],
    generatedAssetPaths
  };

  if (settings.kickAssemblerJar) {
    resolved.kickAssemblerJar = resolveWorkspacePath(
      workspaceRootPath,
      settings.kickAssemblerJar
    );
  }
  if (settings.workingDirectory) {
    resolved.workingDirectoryPath = resolveWorkspacePath(
      workspaceRootPath,
      settings.workingDirectory
    );
  }
  if (settings.symbolFileFolder) {
    resolved.symbolFileDirectoryPath = resolveWorkspacePath(
      workspaceRootPath,
      settings.symbolFileFolder
    );
  }
  if (settings.runProgram) {
    resolved.runProgramPath = resolveWorkspacePath(
      workspaceRootPath,
      settings.runProgram
    );
  }

  return resolved;
}

function readEnvironmentSettings(
  environment: KickAssemblerBuildConfigurationEnvironment
): ResolvedPartialBuildSettings {
  const settings: ResolvedPartialBuildSettings = {};
  const javaRuntime = environment[ENV_JAVA_RUNTIME];
  const kickAssemblerJar = environment[ENV_KICKASS_JAR];

  if (javaRuntime) {
    settings.javaRuntime = javaRuntime;
  }
  if (kickAssemblerJar) {
    settings.kickAssemblerJar = kickAssemblerJar;
  }

  return settings;
}

function resolveDefaultJavaRuntime(
  environment: KickAssemblerBuildConfigurationEnvironment
): string {
  const javaHome = environment.JAVA_HOME;
  if (!javaHome) {
    return DEFAULT_JAVA_RUNTIME;
  }

  return path.join(
    javaHome,
    'bin',
    process.platform === 'win32' ? 'java.exe' : 'java'
  );
}

function resolveWorkspacePath(workspaceRootPath: string, configuredPath: string): string {
  return path.isAbsolute(configuredPath)
    ? path.normalize(configuredPath)
    : path.resolve(workspaceRootPath, configuredPath);
}

function resolveCommandPath(workspaceRootPath: string, configuredPath: string): string {
  if (
    path.isAbsolute(configuredPath) ||
    configuredPath.startsWith('.') ||
    configuredPath.includes('/') ||
    configuredPath.includes('\\')
  ) {
    return resolveWorkspacePath(workspaceRootPath, configuredPath);
  }

  return configuredPath;
}

function assignOptionalString(
  target: object,
  object: Record<string, unknown>,
  key: string,
  sourceName: string
): void {
  const value = readOptionalString(object[key], `${sourceName}.${key}`);
  if (value !== undefined) {
    (target as Record<string, unknown>)[key] = value;
  }
}

function assignOptionalBoolean(
  target: object,
  object: Record<string, unknown>,
  key: string,
  sourceName: string
): void {
  const value = readOptionalBoolean(object[key], `${sourceName}.${key}`);
  if (value !== undefined) {
    (target as Record<string, unknown>)[key] = value;
  }
}

function assignOptionalStringArray(
  target: object,
  object: Record<string, unknown>,
  key: string,
  sourceName: string
): void {
  const value = readOptionalStringArray(object[key], `${sourceName}.${key}`);
  if (value !== undefined) {
    (target as Record<string, unknown>)[key] = value;
  }
}

function readRequiredString(value: unknown, sourceName: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${sourceName} must be a non-empty string.`);
  }
  return value;
}

function readOptionalString(value: unknown, sourceName: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new Error(`${sourceName} must be a string.`);
  }
  return value;
}

function readOptionalBoolean(value: unknown, sourceName: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'boolean') {
    throw new Error(`${sourceName} must be a boolean.`);
  }
  return value;
}

function readOptionalStringArray(
  value: unknown,
  sourceName: string
): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error(`${sourceName} must be an array.`);
  }

  return value.map((entry, index) => {
    if (typeof entry !== 'string') {
      throw new Error(`${sourceName}[${index}] must be a string.`);
    }
    return entry;
  });
}

function readOptionalBuildPolicy(
  value: unknown,
  sourceName: string
): KickAssemblerRunBuildPolicy | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === 'always' || value === 'ifStale' || value === 'never') {
    return value;
  }
  throw new Error(`${sourceName} must be "always", "ifStale", or "never".`);
}

function expectRecord(value: unknown, sourceName: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${sourceName} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function copyIfDefined(target: object, source: object, key: string): void {
  const value = (source as Record<string, unknown>)[key];
  if (value !== undefined) {
    (target as Record<string, unknown>)[key] = value;
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

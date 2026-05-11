import { access, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { injectable } from '@theia/core/shared/inversify';
import {
  KickAssemblerWorkspaceBuildPlanner,
  findKickAssemblerBuildConfigurationPath,
  loadKickAssemblerBuildConfiguration,
  parseKickAssemblerBuildConfiguration,
  pathToDocumentUri,
  resolveKickAssemblerBuildConfiguration,
  type KickAssemblerBuildConfiguration,
  type KickAssemblerBuildProgram,
  type KickAssemblerBuildSettingsConfiguration,
  type KickAssemblerBuildProfileConfiguration,
  type CommodoreMachineLaunchConfiguration,
  type KickAssemblerProgramConfiguration,
  type ResolvedKickAssemblerRunConfiguration
} from '@commodore-commander/language-support';

import type {
  KickAssemblerBuildClient,
  KickAssemblerBuildConfigurationRequest,
  KickAssemblerBuildEvent,
  KickAssemblerBuildExecutionResult,
  KickAssemblerBuildRequest,
  KickAssemblerBuildRequestResult,
  KickAssemblerRunBuildPolicy,
  KickAssemblerRunProgramRequest,
  KickAssemblerRunProgramSummary,
  KickAssemblerSetActiveProfileRequest,
  KickAssemblerWorkspaceBuildConfigurationSummary,
  KickAssemblerBuildService
} from '../common/kick-assembler-build-service';
import {
  createKickAssemblerProgramInvocation,
  getBundledKickAssemblerJarPath,
  runKickAssemblerProgram
} from './kick-assembler-build-runner';

const DEFAULT_BUILD_CONFIG_FILE = 'commodore-commander.build.json';
const DEFAULT_PROFILE_NAME = 'debug';
const FALLBACK_PROGRAM_NAME = 'main';
const DEFAULT_OUTPUT_FOLDER = 'out';

interface EnsureWorkspaceBuildConfigurationOptions {
  profileName?: string;
  setActiveProfile?: boolean;
  programNames?: readonly string[];
}

interface MutableKickAssemblerBuildConfiguration
  extends KickAssemblerBuildConfiguration {
  profiles?: Record<string, KickAssemblerBuildProfileConfiguration>;
  programs?: KickAssemblerProgramConfiguration[];
}

interface SelectedRunProgram {
  program: KickAssemblerBuildProgram;
  run?: ResolvedKickAssemblerRunConfiguration;
}

@injectable()
export class KickAssemblerBuildServiceImpl implements KickAssemblerBuildService {
  private readonly planner = new KickAssemblerWorkspaceBuildPlanner();
  private client: KickAssemblerBuildClient | undefined;
  private pendingRequest: KickAssemblerBuildRequest | undefined;
  private drainLoop: Promise<void> | undefined;
  private buildConfigurationMutation: Promise<void> = Promise.resolve();

  dispose(): void {
    this.pendingRequest = undefined;
    this.client = undefined;
  }

  setClient(client: KickAssemblerBuildClient | undefined): void {
    this.client = client;
  }

  async build(
    request: KickAssemblerBuildRequest
  ): Promise<KickAssemblerBuildRequestResult> {
    const queued = Boolean(this.drainLoop);
    this.pendingRequest = request;

    if (queued) {
      this.emit({
        type: 'build-queued',
        workspaceRootUri: request.workspaceRootUri,
        resourceUri: request.resourceUri
      });
    }

    this.ensureDrainLoop();
    return { queued };
  }

  async buildAndWait(
    request: KickAssemblerBuildRequest
  ): Promise<KickAssemblerBuildExecutionResult> {
    const queued = Boolean(this.drainLoop);
    if (queued) {
      this.emit({
        type: 'build-queued',
        workspaceRootUri: request.workspaceRootUri,
        resourceUri: request.resourceUri
      });
    }
    while (this.drainLoop) {
      await this.drainLoop;
    }

    const result = await this.executeBuild(request);
    return {
      queued,
      succeeded: result.succeeded,
      builtProgramUris: result.builtProgramUris
    };
  }

  async getWorkspaceBuildConfiguration(
    request: KickAssemblerBuildConfigurationRequest
  ): Promise<KickAssemblerWorkspaceBuildConfigurationSummary> {
    return this.ensureWorkspaceBuildConfiguration(request);
  }

  async getRunProgram(
    request: KickAssemblerRunProgramRequest
  ): Promise<KickAssemblerRunProgramSummary> {
    if (request.runName && request.programName) {
      throw new Error('Specify either runName or programName, not both.');
    }

    const configurationSummary = await this.ensureWorkspaceBuildConfiguration(
      request,
      {
        ...(request.profileName ? { profileName: request.profileName } : {}),
        ...(request.programName ? { programNames: [request.programName] } : {})
      }
    );
    const workspaceRootPath = fileURLToPath(request.workspaceRootUri);
    const changedPath = request.resourceUri
      ? fileURLToPath(request.resourceUri)
      : undefined;
    const activeProfileName =
      request.profileName ?? configurationSummary.activeProfileName;
    let configuration = await loadKickAssemblerBuildConfiguration(
      workspaceRootPath,
      {
        defaultKickAssemblerJar: getBundledKickAssemblerJarPath(),
        profileName: activeProfileName
      }
    );
    let selectedRun = request.runName
      ? selectNamedRun(configuration.runs, request.runName)
      : undefined;
    if (request.runName && !selectedRun) {
      throw new Error(`Unknown Kick Assembler run "${request.runName}".`);
    }
    const selectedProfileName = selectedRun?.profileName ?? activeProfileName;
    const selectedProgramName = selectedRun?.programName ?? request.programName;
    if (selectedProfileName !== activeProfileName) {
      configuration = await loadKickAssemblerBuildConfiguration(
        workspaceRootPath,
        {
          defaultKickAssemblerJar: getBundledKickAssemblerJarPath(),
          profileName: selectedProfileName
        }
      );
      selectedRun = request.runName
        ? selectNamedRun(configuration.runs, request.runName)
        : undefined;
      if (request.runName && !selectedRun) {
        throw new Error(`Unknown Kick Assembler run "${request.runName}".`);
      }
    }
    const plan = await this.planner.planWorkspaceBuild(
      workspaceRootPath,
      changedPath,
      {
        configuration,
        profileName: selectedProfileName,
        ...(selectedProgramName ? { programNames: [selectedProgramName] } : {})
      }
    );
    const selected = selectRunProgram(
      plan.programs,
      plan.affectedPrograms,
      changedPath,
      selectedRun
    );
    if (!selected) {
      throw new Error(`No runnable Kick Assembler program found under ${workspaceRootPath}.`);
    }
    const { program } = selected;

    const runProgramPath =
      selected.run?.runProgramPath ?? await this.resolveRunProgramPath(program);
    const buildPolicy: KickAssemblerRunBuildPolicy =
      selected.run?.build ?? 'ifStale';
    const buildState = await this.getProgramBuildRequirement(
      program,
      runProgramPath,
      configuration.configPath,
      buildPolicy
    );
    const machineConfiguration = selected.run?.machine ?? program.machine;

    return {
      name: selected.run?.name ?? program.name,
      programName: program.name,
      ...(selected.run ? { runName: selected.run.name } : {}),
      ...(selectedProfileName ? { profileName: selectedProfileName } : {}),
      machine: formatMachineConfiguration(machineConfiguration),
      ...(machineConfiguration ? { machineConfiguration } : {}),
      entryUri: program.entryUri,
      outputDirectoryUri: pathToDocumentUri(program.outputDirectoryPath),
      runProgramUri: pathToDocumentUri(runProgramPath),
      buildRequired: buildState.required,
      buildPolicy,
      ...(buildState.reason ? { buildReason: buildState.reason } : {})
    };
  }

  async setActiveBuildProfile(
    request: KickAssemblerSetActiveProfileRequest
  ): Promise<KickAssemblerWorkspaceBuildConfigurationSummary> {
    return this.ensureWorkspaceBuildConfiguration(request, {
      profileName: request.profileName,
      setActiveProfile: true
    });
  }

  private ensureDrainLoop(): void {
    if (this.drainLoop) {
      return;
    }

    this.drainLoop = (async () => {
      try {
        while (this.pendingRequest) {
          const request = this.pendingRequest;
          this.pendingRequest = undefined;
          await this.executeBuild(request);
        }
      } finally {
        this.drainLoop = undefined;
        if (this.pendingRequest) {
          this.ensureDrainLoop();
        }
      }
    })();
  }

  private async executeBuild(
    request: KickAssemblerBuildRequest
  ): Promise<Omit<KickAssemblerBuildExecutionResult, 'queued'>> {
    const buildId = randomUUID();
    const startedAt = Date.now();
    const builtProgramUris: string[] = [];

    try {
      const workspaceRootPath = fileURLToPath(request.workspaceRootUri);
      const changedPath = request.resourceUri
        ? fileURLToPath(request.resourceUri)
        : undefined;
      const configurationSummary = await this.ensureWorkspaceBuildConfiguration(
        request,
        {
          ...(request.profileName ? { profileName: request.profileName } : {}),
          ...(request.programNames ? { programNames: request.programNames } : {})
        }
      );
      const activeProfileName =
        request.profileName ?? configurationSummary.activeProfileName;
      const configuration = await loadKickAssemblerBuildConfiguration(
        workspaceRootPath,
        {
          defaultKickAssemblerJar: getBundledKickAssemblerJarPath(),
          profileName: activeProfileName
        }
      );
      const plan = await this.planner.planWorkspaceBuild(
        workspaceRootPath,
        changedPath,
        {
          configuration,
          profileName: activeProfileName,
          programNames: request.programNames
        }
      );
      const programs = plan.affectedPrograms;

      this.emit({
        type: 'build-started',
        buildId,
        workspaceRootUri: request.workspaceRootUri,
        resourceUri: request.resourceUri,
        programCount: programs.length,
        startedAt: new Date(startedAt).toISOString()
      });

      if (programs.length === 0) {
        this.emitOutput(
          buildId,
          'system',
          `No Kick Assembler programs selected under ${workspaceRootPath}.\n`
        );
        this.emit({
          type: 'build-finished',
          buildId,
          succeeded: true,
          durationMs: Date.now() - startedAt,
          programCount: 0,
          builtProgramUris
        });
        return {
          succeeded: true,
          builtProgramUris
        };
      }

      if (configuration.configPath) {
        this.emitOutput(
          buildId,
          'system',
          `Using Kick Assembler build config ${configuration.configPath}\n`
        );
      }
      if (configuration.defaultProfileName) {
        this.emitOutput(
          buildId,
          'system',
          `Using Kick Assembler build profile ${configuration.defaultProfileName}\n`
        );
      }

      let succeeded = true;
      for (const program of programs) {
        builtProgramUris.push(program.entryUri);
        const invocation = createKickAssemblerProgramInvocation(program);

        this.emit({
          type: 'program-started',
          buildId,
          programName: program.name,
          ...(program.profileName ? { profileName: program.profileName } : {}),
          entryUri: program.entryUri,
          command: invocation.command,
          args: invocation.args,
          cwd: invocation.cwd,
          outputDirectoryUri: pathToDocumentUri(program.outputDirectoryPath)
        });
        this.emitOutput(
          buildId,
          'system',
          `$ ${renderCommand(invocation.command, invocation.args)}\n`
        );

        const programStartTime = Date.now();
        const result = await runKickAssemblerProgram(program, {
          onOutput: (stream, chunk) => this.emitOutput(buildId, stream, chunk)
        });
        succeeded &&= result.succeeded;
        this.emit({
          type: 'program-finished',
          buildId,
          programName: program.name,
          ...(program.profileName ? { profileName: program.profileName } : {}),
          entryUri: program.entryUri,
          succeeded: result.succeeded,
          exitCode: result.exitCode,
          durationMs: Date.now() - programStartTime
        });
      }

      this.emit({
        type: 'build-finished',
        buildId,
        succeeded,
        durationMs: Date.now() - startedAt,
        programCount: programs.length,
        builtProgramUris
      });
      return {
        succeeded,
        builtProgramUris
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown build failure.';
      this.emit({
        type: 'build-started',
        buildId,
        workspaceRootUri: request.workspaceRootUri,
        resourceUri: request.resourceUri,
        programCount: 0,
        startedAt: new Date(startedAt).toISOString()
      });
      this.emitOutput(buildId, 'system', `Build setup failed: ${message}\n`);
      this.emit({
        type: 'build-finished',
        buildId,
        succeeded: false,
        durationMs: Date.now() - startedAt,
        programCount: 0,
        builtProgramUris
      });
      return {
        succeeded: false,
        builtProgramUris
      };
    }
  }

  private async ensureWorkspaceBuildConfiguration(
    request: KickAssemblerBuildConfigurationRequest,
    options: EnsureWorkspaceBuildConfigurationOptions = {}
  ): Promise<KickAssemblerWorkspaceBuildConfigurationSummary> {
    const mutation = this.buildConfigurationMutation.then(
      () => this.doEnsureWorkspaceBuildConfiguration(request, options),
      () => this.doEnsureWorkspaceBuildConfiguration(request, options)
    );
    this.buildConfigurationMutation = mutation.then(
      () => undefined,
      () => undefined
    );
    return mutation;
  }

  private async doEnsureWorkspaceBuildConfiguration(
    request: KickAssemblerBuildConfigurationRequest,
    options: EnsureWorkspaceBuildConfigurationOptions
  ): Promise<KickAssemblerWorkspaceBuildConfigurationSummary> {
    const workspaceRootPath = fileURLToPath(request.workspaceRootUri);
    const changedPath = request.resourceUri
      ? fileURLToPath(request.resourceUri)
      : undefined;
    const loaded = await this.readMutableBuildConfiguration(workspaceRootPath);
    const configuration = loaded.configuration;
    let changed = loaded.created;

    const profiles = configuration.profiles ?? {};
    configuration.profiles = profiles;
    const requestedProfileName = options.profileName?.trim();
    const activeProfileName =
      requestedProfileName || configuration.defaultProfile || DEFAULT_PROFILE_NAME;

    if (!profiles[activeProfileName]) {
      profiles[activeProfileName] = this.createDefaultProfileSettings();
      changed = true;
    } else if (isEmptySettings(profiles[activeProfileName])) {
      profiles[activeProfileName] = {
        ...profiles[activeProfileName],
        ...this.createDefaultProfileSettings()
      };
      changed = true;
    }

    if (!configuration.defaultProfile || options.setActiveProfile) {
      configuration.defaultProfile = activeProfileName;
      changed = true;
    }

    const programs = configuration.programs ?? [];
    configuration.programs = programs;
    if (programs.length === 0) {
      const detectedPrograms = await this.detectWorkspacePrograms(
        workspaceRootPath,
        changedPath,
        configuration,
        activeProfileName
      );
      if (detectedPrograms.length > 0) {
        configuration.programs = detectedPrograms;
        changed = true;
      }
    }

    if (options.programNames && options.programNames.length > 0) {
      const currentProgramNames = new Set(
        (configuration.programs ?? []).map((program) =>
          buildProgramConfigName(workspaceRootPath, program)
        )
      );

      for (const programName of options.programNames) {
        if (currentProgramNames.has(programName)) {
          continue;
        }

        const createdProgram = await this.createFallbackProgramConfiguration(
          workspaceRootPath,
          programName,
          changedPath,
          activeProfileName
        );
        const mutablePrograms: KickAssemblerProgramConfiguration[] =
          configuration.programs ?? [];
        mutablePrograms.push(createdProgram);
        configuration.programs = mutablePrograms;
        currentProgramNames.add(programName);
        changed = true;
      }
    }

    if (changed) {
      await this.writeMutableBuildConfiguration(loaded.configPath, configuration);
    }

    return this.toWorkspaceBuildConfigurationSummary(
      workspaceRootPath,
      loaded.configPath,
      configuration,
      loaded.created,
      activeProfileName,
      changedPath
    );
  }

  private async readMutableBuildConfiguration(
    workspaceRootPath: string
  ): Promise<{
    configPath: string;
    configuration: MutableKickAssemblerBuildConfiguration;
    created: boolean;
  }> {
    const configPath =
      (await findKickAssemblerBuildConfigurationPath(workspaceRootPath)) ??
      path.join(workspaceRootPath, DEFAULT_BUILD_CONFIG_FILE);

    if (!(await pathExists(configPath))) {
      return {
        configPath,
        configuration: {},
        created: true
      };
    }

    return {
      configPath,
      configuration: toMutableBuildConfiguration(
        parseKickAssemblerBuildConfiguration(
          await readFile(configPath, 'utf8'),
          configPath
        )
      ),
      created: false
    };
  }

  private async writeMutableBuildConfiguration(
    configPath: string,
    configuration: MutableKickAssemblerBuildConfiguration
  ): Promise<void> {
    await mkdir(path.dirname(configPath), { recursive: true });
    await writeFile(configPath, `${JSON.stringify(configuration, null, 2)}\n`);
  }

  private async detectWorkspacePrograms(
    workspaceRootPath: string,
    changedPath: string | undefined,
    configuration: MutableKickAssemblerBuildConfiguration,
    activeProfileName: string
  ): Promise<KickAssemblerProgramConfiguration[]> {
    const planningConfiguration = resolveKickAssemblerBuildConfiguration(
      workspaceRootPath,
      {
        ...configuration,
        programs: []
      },
      {
        defaultKickAssemblerJar: getBundledKickAssemblerJarPath(),
        profileName: activeProfileName
      }
    );
    const plan = await this.planner.planWorkspaceBuild(
      workspaceRootPath,
      changedPath,
      {
        configuration: planningConfiguration,
        profileName: activeProfileName
      }
    );
    const detectedPrograms =
      plan.affectedPrograms.length > 0 ? plan.affectedPrograms : plan.programs;

    if (detectedPrograms.length > 0) {
      return Promise.all(
        detectedPrograms.map(async (program) =>
          this.createProgramConfigurationFromBuildProgram(
            workspaceRootPath,
            program,
            activeProfileName
          )
        )
      );
    }

    if (changedPath && path.extname(changedPath).toLowerCase() === '.asm') {
      return [
        await this.createFallbackProgramConfiguration(
          workspaceRootPath,
          path.basename(changedPath, path.extname(changedPath)),
          changedPath,
          activeProfileName
        )
      ];
    }

    return [];
  }

  private async createProgramConfigurationFromBuildProgram(
    workspaceRootPath: string,
    program: KickAssemblerBuildProgram,
    profileName: string
  ): Promise<KickAssemblerProgramConfiguration> {
    return {
      name: program.name,
      root: path.relative(workspaceRootPath, program.entryPath),
      profile: profileName,
      ...(program.machine ? { machine: program.machine } : {}),
      runProgram: path.join(
        DEFAULT_OUTPUT_FOLDER,
        await this.inferProgramFileName(program.entryPath, program.name)
      )
    };
  }

  private async createFallbackProgramConfiguration(
    workspaceRootPath: string,
    programName: string,
    changedPath: string | undefined,
    profileName: string
  ): Promise<KickAssemblerProgramConfiguration> {
    const rootPath =
      changedPath && path.extname(changedPath).toLowerCase() === '.asm'
        ? changedPath
        : path.join(workspaceRootPath, `${programName}.asm`);

    return {
      name: programName,
      root: path.relative(workspaceRootPath, rootPath),
      profile: profileName,
      runProgram: path.join(
        DEFAULT_OUTPUT_FOLDER,
        await this.inferProgramFileName(rootPath, programName)
      )
    };
  }

  private createDefaultProfileSettings(): KickAssemblerBuildProfileConfiguration {
    return {
      javaRuntime: 'java',
      javaArgs: [],
      libraryRoots: ['library'],
      outputFolder: DEFAULT_OUTPUT_FOLDER,
      showMemory: true,
      debug: false,
      viceSymbols: true,
      debugDump: true,
      symbolFile: true,
      assemblerArgs: [],
      generatedAssets: []
    };
  }

  private async inferProgramFileName(
    entryPath: string,
    programName: string
  ): Promise<string> {
    try {
      const sourceText = await readFile(entryPath, 'utf8');
      const fileName = inferKickAssemblerFileDirectiveName(sourceText);
      if (fileName) {
        return fileName;
      }
    } catch {
      // Program creation should still work when the source is temporarily missing.
    }

    return `${programName}.prg`;
  }

  private async resolveRunProgramPath(
    program: KickAssemblerBuildProgram
  ): Promise<string> {
    if (program.runProgramPath) {
      return program.runProgramPath;
    }

    return path.join(
      program.outputDirectoryPath,
      await this.inferProgramFileName(program.entryPath, program.name)
    );
  }

  private async getProgramBuildRequirement(
    program: KickAssemblerBuildProgram,
    runProgramPath: string,
    configPath: string | undefined,
    buildPolicy: KickAssemblerRunBuildPolicy = 'ifStale'
  ): Promise<{ required: boolean; reason?: string }> {
    if (buildPolicy === 'always') {
      return {
        required: true,
        reason: 'run policy requires assembly'
      };
    }
    if (buildPolicy === 'never') {
      return { required: false };
    }

    const outputMtime = await fileMtimeMs(runProgramPath);
    if (outputMtime === undefined) {
      return {
        required: true,
        reason: `${path.basename(runProgramPath)} is missing`
      };
    }

    const inputPaths = [
      program.entryPath,
      ...program.dependencyPaths,
      ...(configPath ? [configPath] : [])
    ];
    for (const inputPath of inputPaths) {
      const inputMtime = await fileMtimeMs(inputPath);
      if (inputMtime !== undefined && inputMtime > outputMtime) {
        return {
          required: true,
          reason: `${path.basename(inputPath)} changed`
        };
      }
    }

    for (const generatedAssetPath of program.generatedAssetPaths) {
      const inputMtime = await latestPathMtimeMs(generatedAssetPath);
      if (inputMtime !== undefined && inputMtime > outputMtime) {
        return {
          required: true,
          reason: `${path.basename(generatedAssetPath)} changed`
        };
      }
    }

    return { required: false };
  }

  private async toWorkspaceBuildConfigurationSummary(
    workspaceRootPath: string,
    configPath: string,
    configuration: MutableKickAssemblerBuildConfiguration,
    created: boolean,
    activeProfileName: string,
    changedPath: string | undefined
  ): Promise<KickAssemblerWorkspaceBuildConfigurationSummary> {
    const profiles = configuration.profiles ?? {};
    const profileNames = Object.keys(profiles).sort();
    const resolvedConfiguration = resolveKickAssemblerBuildConfiguration(
      workspaceRootPath,
      configuration,
      {
        configPath,
        defaultKickAssemblerJar: getBundledKickAssemblerJarPath(),
        profileName: activeProfileName
      }
    );
    const plan = await this.planner.planWorkspaceBuild(
      workspaceRootPath,
      changedPath,
      {
        configuration: resolvedConfiguration,
        profileName: activeProfileName
      }
    );
    const configuredEntryPaths = new Set(
      (configuration.programs ?? []).map((program) =>
        buildProgramConfigRootPath(workspaceRootPath, program)
      )
    );
    const programsByName = new Map(
      plan.programs.map((program) => [program.name, program])
    );
    const programSummaries = await Promise.all(
      plan.programs.map(async (program) => ({
        name: program.name,
        entryUri: program.entryUri,
        outputDirectoryUri: pathToDocumentUri(program.outputDirectoryPath),
        runProgramUri: pathToDocumentUri(
          await this.resolveRunProgramPath(program)
        ),
        isConfigured: configuredEntryPaths.has(program.entryPath),
        machine: formatMachineConfiguration(program.machine),
        ...(program.machine ? { machineConfiguration: program.machine } : {}),
        ...(program.profileName ? { profileName: program.profileName } : {})
      }))
    );
    const runSummaries = await Promise.all(
      resolvedConfiguration.runs.map(async (run) => {
        const program = programsByName.get(run.programName);
        const runProgramPath =
          run.runProgramPath ??
          (program ? await this.resolveRunProgramPath(program) : undefined);
        const machineConfiguration = run.machine ?? program?.machine;

        return {
          name: run.name,
          programName: run.programName,
          build: run.build,
          ...(runProgramPath
            ? { runProgramUri: pathToDocumentUri(runProgramPath) }
            : {}),
          machine: formatMachineConfiguration(machineConfiguration),
          ...(machineConfiguration ? { machineConfiguration } : {}),
          ...(run.profileName ? { profileName: run.profileName } : {})
        };
      })
    );

    return {
      workspaceRootUri: pathToDocumentUri(workspaceRootPath),
      configUri: pathToDocumentUri(configPath),
      activeProfileName,
      profiles: profileNames.map((profileName) => ({
        name: profileName,
        isActive: profileName === activeProfileName,
        isDefault: profileName === configuration.defaultProfile
      })),
      programs: programSummaries,
      runs: runSummaries,
      created
    };
  }

  private emitOutput(
    buildId: string,
    stream: 'stdout' | 'stderr' | 'system',
    chunk: string
  ): void {
    this.emit({
      type: 'output',
      buildId,
      stream,
      chunk
    });
  }

  private emit(event: KickAssemblerBuildEvent): void {
    this.client?.onBuildEvent(event);
  }
}

function toMutableBuildConfiguration(
  configuration: KickAssemblerBuildConfiguration
): MutableKickAssemblerBuildConfiguration {
  const mutable = { ...configuration } as MutableKickAssemblerBuildConfiguration;

  if (configuration.profiles) {
    mutable.profiles = { ...configuration.profiles };
  }
  if (configuration.programs) {
    mutable.programs = configuration.programs.map((program) => ({ ...program }));
  }

  return mutable;
}

function formatMachineConfiguration(
  machine: CommodoreMachineLaunchConfiguration | undefined
): string {
  if (!machine) {
    return 'default';
  }
  const parts: string[] = [machine.profile];
  if (machine.model) {
    parts.push(machine.model);
  }
  if (machine.viceArgs && machine.viceArgs.length > 0) {
    parts.push(machine.viceArgs.join(' '));
  }
  return parts.join(' / ');
}

function buildProgramConfigName(
  workspaceRootPath: string,
  program: KickAssemblerProgramConfiguration
): string {
  if (program.name) {
    return program.name;
  }

  const rootPath = buildProgramConfigRootPath(workspaceRootPath, program);
  return path.basename(rootPath, path.extname(rootPath));
}

function buildProgramConfigRootPath(
  workspaceRootPath: string,
  program: KickAssemblerProgramConfiguration
): string {
  const root = program.root ?? `${program.name ?? FALLBACK_PROGRAM_NAME}.asm`;
  return path.isAbsolute(root)
    ? path.normalize(root)
    : path.resolve(workspaceRootPath, root);
}

function isEmptySettings(settings: KickAssemblerBuildSettingsConfiguration): boolean {
  return Object.keys(settings).length === 0;
}

function selectNamedRun(
  runs: readonly ResolvedKickAssemblerRunConfiguration[],
  runName: string
): ResolvedKickAssemblerRunConfiguration | undefined {
  return runs.find((run) => run.name === runName);
}

function selectRunProgram(
  programs: readonly KickAssemblerBuildProgram[],
  affectedPrograms: readonly KickAssemblerBuildProgram[],
  changedPath: string | undefined,
  run: ResolvedKickAssemblerRunConfiguration | undefined
): SelectedRunProgram | undefined {
  if (run) {
    const program = programs.find((entry) => entry.name === run.programName);
    return program ? { program, run } : undefined;
  }

  const candidates = affectedPrograms.length > 0 ? affectedPrograms : programs;
  if (candidates.length === 0) {
    return undefined;
  }

  if (changedPath) {
    const normalizedChangedPath = path.resolve(changedPath);
    const program =
      candidates.find((entry) => entry.entryPath === normalizedChangedPath) ??
      candidates.find((entry) =>
        entry.dependencyPaths.includes(normalizedChangedPath)
      ) ??
      candidates[0];
    return program ? { program } : undefined;
  }

  const program = candidates[0];
  return program ? { program } : undefined;
}

function inferKickAssemblerFileDirectiveName(sourceText: string): string | undefined {
  const match = /^\s*\.file\s*\[[^\]]*\bname\s*=\s*(?:"([^"]+)"|'([^']+)')/gimu
    .exec(sourceText);
  const rawName = match?.[1] ?? match?.[2];
  if (!rawName) {
    return undefined;
  }

  return rawName.replace(/^[/\\]+/u, '');
}

async function fileMtimeMs(candidate: string): Promise<number | undefined> {
  try {
    const stats = await stat(candidate);
    return stats.isFile() ? stats.mtimeMs : undefined;
  } catch {
    return undefined;
  }
}

async function latestPathMtimeMs(candidate: string): Promise<number | undefined> {
  try {
    const stats = await stat(candidate);
    if (stats.isFile()) {
      return stats.mtimeMs;
    }
    if (!stats.isDirectory()) {
      return undefined;
    }

    let latest = stats.mtimeMs;
    for (const entry of await readdir(candidate, { withFileTypes: true })) {
      const childLatest = await latestPathMtimeMs(path.join(candidate, entry.name));
      if (childLatest !== undefined) {
        latest = Math.max(latest, childLatest);
      }
    }
    return latest;
  } catch {
    return undefined;
  }
}

async function pathExists(candidate: string): Promise<boolean> {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}

function renderCommand(command: string, args: readonly string[]): string {
  return [command, ...args]
    .map((segment) =>
      /\s/u.test(segment) ? JSON.stringify(segment) : segment
    )
    .join(' ');
}

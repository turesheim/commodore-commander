import { readdir } from 'node:fs/promises';
import path from 'node:path';

import {
  KickAssemblerLanguageSupport,
  type KickAssemblerSourceNode
} from '../project/kick-assembler-language-support.ts';
import { documentUriToPath, pathToDocumentUri } from '../resolution/document-uri.ts';
import {
  type CommodoreMachineLaunchConfiguration
} from '../machines/commodore-machine-profiles.ts';
import {
  resolveKickAssemblerBuildConfiguration,
  type ResolvedKickAssemblerBuildConfiguration,
  type ResolvedKickAssemblerBuildSettings,
  type ResolvedKickAssemblerProgramConfiguration
} from './kick-assembler-build-configuration.ts';

const DEFAULT_EXCLUDED_DIRECTORY_NAMES = new Set([
  '.git',
  '.metadata',
  '.theia',
  'dist',
  'node_modules',
  'out',
  'src-gen',
  'target'
]);

export interface KickAssemblerWorkspaceBuildPlannerOptions {
  excludedDirectoryNames?: ReadonlySet<string>;
}

export interface KickAssemblerWorkspaceBuildPlanOptions {
  configuration?: ResolvedKickAssemblerBuildConfiguration;
  profileName?: string;
  programNames?: readonly string[];
}

export interface KickAssemblerBuildProgram {
  name: string;
  profileName?: string;
  machine?: CommodoreMachineLaunchConfiguration;
  entryPath: string;
  entryUri: string;
  dependencyPaths: readonly string[];
  dependencyUris: readonly string[];
  javaRuntime: string;
  javaArgs: readonly string[];
  kickAssemblerJar?: string;
  libraryRootPaths: readonly string[];
  outputDirectoryPath: string;
  workingDirectoryPath: string;
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

export interface KickAssemblerWorkspaceBuildPlan {
  workspaceRootPath: string;
  workspaceRootUri: string;
  sourcePaths: readonly string[];
  sourceUris: readonly string[];
  programs: readonly KickAssemblerBuildProgram[];
  affectedPrograms: readonly KickAssemblerBuildProgram[];
  changedPath?: string;
  changedUri?: string;
}

export class KickAssemblerWorkspaceBuildPlanner {
  private readonly excludedDirectoryNames: ReadonlySet<string>;

  constructor(options: KickAssemblerWorkspaceBuildPlannerOptions = {}) {
    this.excludedDirectoryNames =
      options.excludedDirectoryNames ?? DEFAULT_EXCLUDED_DIRECTORY_NAMES;
  }

  async planWorkspaceBuild(
    workspaceRootPath: string,
    changedPath?: string,
    options: KickAssemblerWorkspaceBuildPlanOptions = {}
  ): Promise<KickAssemblerWorkspaceBuildPlan> {
    const normalizedWorkspaceRootPath = path.resolve(workspaceRootPath);
    const normalizedChangedPath = changedPath
      ? path.resolve(changedPath)
      : undefined;
    const configuration =
      options.configuration ??
      resolveKickAssemblerBuildConfiguration(
        normalizedWorkspaceRootPath,
        {},
        options.profileName ? { profileName: options.profileName } : {}
      );
    const programNames = new Set(options.programNames ?? []);
    const outputDirectoryPaths = collectOutputDirectoryPaths(configuration);
    const configuredRootPaths = collectConfiguredRootPaths(configuration);
    const ignoredChangeRootPaths = outputDirectoryPaths;
    const excludedDirectoryNames = new Set([
      ...this.excludedDirectoryNames,
      ...configuration.excludedDirectoryNames
    ]);
    const configuredPrograms = await this.createConfiguredPrograms(configuration);
    const detectedPrograms = await this.createAutoDetectedPrograms(
      normalizedWorkspaceRootPath,
      configuration.defaults,
      excludedDirectoryNames,
      [
        ...outputDirectoryPaths,
        ...configuration.defaults.libraryRootPaths,
        ...configuration.defaults.generatedAssetPaths
      ]
    );
    const programs = mergeConfiguredAndDetectedPrograms(
      configuredPrograms,
      detectedPrograms
    );
    const selectedPrograms =
      programNames.size > 0
        ? selectNamedPrograms(programs, programNames)
        : programs;
    const sourcePaths = collectPlanSourcePaths(
      programs,
      configuredRootPaths.length > 0 ? configuredRootPaths : undefined
    );
    const affectedPrograms =
      normalizedChangedPath &&
      isPathInsideAnyRoot(normalizedChangedPath, ignoredChangeRootPaths)
        ? []
        : selectAffectedPrograms(selectedPrograms, normalizedChangedPath);

    const plan: KickAssemblerWorkspaceBuildPlan = {
      workspaceRootPath: normalizedWorkspaceRootPath,
      workspaceRootUri: pathToDocumentUri(normalizedWorkspaceRootPath),
      sourcePaths,
      sourceUris: sourcePaths.map((sourcePath) => pathToDocumentUri(sourcePath)),
      programs,
      affectedPrograms
    };

    return normalizedChangedPath
      ? {
          ...plan,
          changedPath: normalizedChangedPath,
          changedUri: pathToDocumentUri(normalizedChangedPath)
        }
      : plan;
  }

  private async collectAssemblySourcePaths(
    rootPath: string,
    excludedDirectoryNames: ReadonlySet<string>,
    excludedRootPaths: readonly string[]
  ): Promise<readonly string[]> {
    const sourcePaths: string[] = [];
    await this.walkDirectory(
      rootPath,
      sourcePaths,
      excludedDirectoryNames,
      excludedRootPaths
    );
    sourcePaths.sort();
    return sourcePaths;
  }

  private async walkDirectory(
    directoryPath: string,
    sourcePaths: string[],
    excludedDirectoryNames: ReadonlySet<string>,
    excludedRootPaths: readonly string[]
  ): Promise<void> {
    if (
      directoryPath !== path.dirname(directoryPath) &&
      isPathInsideAnyRoot(directoryPath, excludedRootPaths)
    ) {
      return;
    }

    const entries = await readdir(directoryPath, {
      withFileTypes: true
    });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (excludedDirectoryNames.has(entry.name)) {
          continue;
        }

        await this.walkDirectory(
          path.join(directoryPath, entry.name),
          sourcePaths,
          excludedDirectoryNames,
          excludedRootPaths
        );
        continue;
      }

      if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.asm') {
        continue;
      }

      sourcePaths.push(path.join(directoryPath, entry.name));
    }
  }

  private async createConfiguredPrograms(
    configuration: ResolvedKickAssemblerBuildConfiguration
  ): Promise<readonly KickAssemblerBuildProgram[]> {
    const programs: KickAssemblerBuildProgram[] = [];

    for (const programConfiguration of configuration.programs) {
      programs.push(await this.createProgram(programConfiguration));
    }

    return programs;
  }

  private async createAutoDetectedPrograms(
    workspaceRootPath: string,
    settings: ResolvedKickAssemblerBuildSettings,
    excludedDirectoryNames: ReadonlySet<string>,
    excludedRootPaths: readonly string[]
  ): Promise<readonly KickAssemblerBuildProgram[]> {
    const sourcePaths = await this.collectAssemblySourcePaths(
      workspaceRootPath,
      excludedDirectoryNames,
      excludedRootPaths
    );
    const includedByPath = new Map<string, Set<string>>();
    const dependencyPathsByEntryPath = new Map<string, readonly string[]>();

    for (const sourcePath of sourcePaths) {
      const dependencyPaths = await this.collectDependencyPaths(
        sourcePath,
        settings.libraryRootPaths
      );
      dependencyPathsByEntryPath.set(sourcePath, dependencyPaths);

      for (const dependencyPath of dependencyPaths) {
        const includedBy =
          includedByPath.get(dependencyPath) ?? new Set<string>();
        includedBy.add(sourcePath);
        includedByPath.set(dependencyPath, includedBy);
      }
    }

    return sourcePaths
      .filter((sourcePath) => !includedByPath.has(sourcePath))
      .map((entryPath) =>
        this.createProgramFromSettings(
          {
            ...settings,
            name: path.basename(entryPath, path.extname(entryPath)),
            entryPath
          },
          dependencyPathsByEntryPath.get(entryPath) ?? []
        )
      );
  }

  private async createProgram(
    programConfiguration: ResolvedKickAssemblerProgramConfiguration
  ): Promise<KickAssemblerBuildProgram> {
    const dependencyPaths = await this.collectDependencyPaths(
      programConfiguration.entryPath,
      programConfiguration.libraryRootPaths
    );
    return this.createProgramFromSettings(programConfiguration, dependencyPaths);
  }

  private async collectDependencyPaths(
    entryPath: string,
    libraryRootPaths: readonly string[]
  ): Promise<readonly string[]> {
    const languageSupport = new KickAssemblerLanguageSupport({
      searchRoots: libraryRootPaths
    });
    const project = await languageSupport.loadProjectFromPath(entryPath);
    return collectResolvedDependencyPaths(project.root)
      .filter((candidate) => candidate !== entryPath)
      .sort();
  }

  private createProgramFromSettings(
    settings: ResolvedKickAssemblerProgramConfiguration,
    dependencyPaths: readonly string[]
  ): KickAssemblerBuildProgram {
    const program: KickAssemblerBuildProgram = {
      name: settings.name,
      entryPath: settings.entryPath,
      entryUri: pathToDocumentUri(settings.entryPath),
      dependencyPaths,
      dependencyUris: dependencyPaths.map((dependencyPath) =>
        pathToDocumentUri(dependencyPath)
      ),
      javaRuntime: settings.javaRuntime,
      javaArgs: settings.javaArgs,
      libraryRootPaths: settings.libraryRootPaths,
      outputDirectoryPath: settings.outputDirectoryPath,
      workingDirectoryPath:
        settings.workingDirectoryPath ?? path.dirname(settings.entryPath),
      showMemory: settings.showMemory,
      debug: settings.debug,
      viceSymbols: settings.viceSymbols,
      debugDump: settings.debugDump,
      symbolFile: settings.symbolFile,
      assemblerArgs: settings.assemblerArgs,
      generatedAssetPaths: settings.generatedAssetPaths
    };

    if (settings.profileName) {
      program.profileName = settings.profileName;
    }
    if (settings.machine) {
      program.machine = settings.machine;
    }
    if (settings.kickAssemblerJar) {
      program.kickAssemblerJar = settings.kickAssemblerJar;
    }
    if (settings.symbolFileDirectoryPath) {
      program.symbolFileDirectoryPath = settings.symbolFileDirectoryPath;
    }
    if (settings.runProgramPath) {
      program.runProgramPath = settings.runProgramPath;
    }

    return program;
  }
}

function collectResolvedDependencyPaths(
  root: KickAssemblerSourceNode
): readonly string[] {
  const dependencyPaths = new Set<string>();
  const visited = new Set<string>();

  const visit = (node: KickAssemblerSourceNode): void => {
    if (visited.has(node.document.uri)) {
      return;
    }
    visited.add(node.document.uri);

    for (const include of node.resolvedIncludes) {
      dependencyPaths.add(documentUriToPath(include.resolvedUri));
    }

    for (const child of node.children) {
      visit(child);
    }
  };

  visit(root);
  return [...dependencyPaths];
}

function mergeConfiguredAndDetectedPrograms(
  configuredPrograms: readonly KickAssemblerBuildProgram[],
  detectedPrograms: readonly KickAssemblerBuildProgram[]
): readonly KickAssemblerBuildProgram[] {
  const programs = [...configuredPrograms];
  const configuredEntryPaths = new Set(
    configuredPrograms.map((program) => path.resolve(program.entryPath))
  );
  const configuredNames = new Set(
    configuredPrograms.map((program) => program.name)
  );

  for (const detectedProgram of detectedPrograms) {
    if (
      configuredEntryPaths.has(path.resolve(detectedProgram.entryPath)) ||
      configuredNames.has(detectedProgram.name)
    ) {
      continue;
    }
    programs.push(detectedProgram);
  }

  return programs.sort((left, right) => left.name.localeCompare(right.name));
}

function selectAffectedPrograms(
  programs: readonly KickAssemblerBuildProgram[],
  changedPath: string | undefined
): readonly KickAssemblerBuildProgram[] {
  if (!changedPath) {
    return programs;
  }

  const affectedPrograms = programs.filter(
    (program) =>
      program.entryPath === changedPath ||
      program.dependencyPaths.includes(changedPath) ||
      isPathInsideAnyRoot(changedPath, program.generatedAssetPaths)
  );

  return affectedPrograms.length > 0 ? affectedPrograms : programs;
}

function selectNamedPrograms(
  programs: readonly KickAssemblerBuildProgram[],
  programNames: ReadonlySet<string>
): readonly KickAssemblerBuildProgram[] {
  const selectedPrograms = programs.filter((program) =>
    programNames.has(program.name)
  );

  if (selectedPrograms.length === programNames.size) {
    return selectedPrograms;
  }

  const knownProgramNames = programs
    .map((program) => program.name)
    .sort()
    .join(', ');
  const missingProgramNames = [...programNames]
    .filter(
      (programName) =>
        !selectedPrograms.some((program) => program.name === programName)
    )
    .sort()
    .join(', ');
  throw new Error(
    `Unknown Kick Assembler program(s): ${missingProgramNames}. Known programs: ${knownProgramNames || '(none)'}.`
  );
}

function collectOutputDirectoryPaths(
  configuration: ResolvedKickAssemblerBuildConfiguration
): readonly string[] {
  return uniqueSortedPaths([
    configuration.defaults.outputDirectoryPath,
    ...configuration.programs.map((program) => program.outputDirectoryPath)
  ]);
}

function collectConfiguredRootPaths(
  configuration: ResolvedKickAssemblerBuildConfiguration
): readonly string[] {
  return configuration.programs.map((program) => program.entryPath);
}

function collectPlanSourcePaths(
  programs: readonly KickAssemblerBuildProgram[],
  configuredRootPaths: readonly string[] | undefined
): readonly string[] {
  const sourcePaths = new Set<string>();

  for (const program of programs) {
    sourcePaths.add(program.entryPath);
    for (const dependencyPath of program.dependencyPaths) {
      sourcePaths.add(dependencyPath);
    }
  }

  if (configuredRootPaths) {
    for (const rootPath of configuredRootPaths) {
      sourcePaths.add(rootPath);
    }
  }

  return [...sourcePaths].sort();
}

function isPathInsideAnyRoot(
  candidatePath: string,
  rootPaths: readonly string[]
): boolean {
  return rootPaths.some((rootPath) => isPathInsideRoot(candidatePath, rootPath));
}

function isPathInsideRoot(candidatePath: string, rootPath: string): boolean {
  const relativePath = path.relative(rootPath, candidatePath);
  return (
    relativePath.length === 0 ||
    (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
  );
}

function uniqueSortedPaths(paths: readonly string[]): readonly string[] {
  return [...new Set(paths.map((entry) => path.resolve(entry)))].sort();
}

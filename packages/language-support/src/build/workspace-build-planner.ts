import { readFile, readdir } from 'node:fs/promises';
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
  type ResolvedKickAssemblerSidScoreModuleConfiguration,
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

const SID_SCORE_DIRECTIVE = /^\s*\/\/\s*@sidscore\b/iu;
const SID_SCORE_DECLARATION = /^\s*\/\/\s*@sidscore\s+"((?:\\["\\]|[^"\\])*)"\s+as\s+([A-Za-z_][A-Za-z0-9_]*)\s+at\s+(\$[0-9a-f]+|0x[0-9a-f]+|[0-9]+)\s*$/iu;

interface SidScoreModuleDeclaration {
  module: ResolvedKickAssemblerSidScoreModuleConfiguration;
  location: string;
}

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
  sidScoreModules: readonly ResolvedKickAssemblerSidScoreModuleConfiguration[];
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

    return Promise.all(sourcePaths
      .filter((sourcePath) => !includedByPath.has(sourcePath))
      .map((entryPath) =>
        this.createProgramWithSidScoreModules(
          {
            ...settings,
            name: path.basename(entryPath, path.extname(entryPath)),
            entryPath
          },
          dependencyPathsByEntryPath.get(entryPath) ?? []
        )
      ));
  }

  private async createProgram(
    programConfiguration: ResolvedKickAssemblerProgramConfiguration
  ): Promise<KickAssemblerBuildProgram> {
    const dependencyPaths = await this.collectDependencyPaths(
      programConfiguration.entryPath,
      programConfiguration.libraryRootPaths
    );
    return this.createProgramWithSidScoreModules(programConfiguration, dependencyPaths);
  }

  private async createProgramWithSidScoreModules(
    settings: ResolvedKickAssemblerProgramConfiguration,
    dependencyPaths: readonly string[]
  ): Promise<KickAssemblerBuildProgram> {
    const configuredModules = settings.sidScoreModules ?? [];
    const declarations = await collectSidScoreModuleDeclarations([
      settings.entryPath,
      ...dependencyPaths
    ]);
    const sidScoreModules = mergeSidScoreModules(configuredModules, declarations);
    const sidScoreImportPaths = await collectSidScoreImportPaths(sidScoreModules);
    return this.createProgramFromSettings({
      ...settings,
      sidScoreModules,
      generatedAssetPaths: [...new Set([
        ...settings.generatedAssetPaths,
        ...sidScoreModules.map((module) => module.sourcePath),
        ...sidScoreImportPaths
      ])]
    }, dependencyPaths);
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
      generatedAssetPaths: settings.generatedAssetPaths,
      sidScoreModules: settings.sidScoreModules ?? []
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

async function collectSidScoreModuleDeclarations(
  assemblyPaths: readonly string[]
): Promise<readonly SidScoreModuleDeclaration[]> {
  const declarations: SidScoreModuleDeclaration[] = [];
  for (const assemblyPath of new Set(assemblyPaths)) {
    let source: string;
    try {
      source = await readFile(assemblyPath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Keep planning a configured program while its root is being created.
        continue;
      }
      throw error;
    }
    let inBlockComment = false;
    let conditionalDepth = 0;
    for (const [index, line] of source.split(/\r?\n/u).entries()) {
      const startedInsideBlockComment = inBlockComment;
      inBlockComment = endsInsideAsmBlockComment(line, inBlockComment);
      if (startedInsideBlockComment) {
        continue;
      }
      if (/^\s*#if\b/iu.test(line)) {
        conditionalDepth += 1;
      } else if (/^\s*#endif\b/iu.test(line)) {
        conditionalDepth = Math.max(0, conditionalDepth - 1);
      }
      if (!SID_SCORE_DIRECTIVE.test(line)) {
        continue;
      }
      const location = `${assemblyPath}:${index + 1}`;
      if (conditionalDepth > 0) {
        throw new Error(`${location}: SIDScore declarations must be unconditional.`);
      }
      const match = SID_SCORE_DECLARATION.exec(line);
      if (!match) {
        throw new Error(
          `${location}: invalid SIDScore declaration; expected ` +
          '// @sidscore "relative/path.sidscore" as Namespace at $3000.'
        );
      }
      const sourceSpecifier = match[1]!.replace(/\\(["\\])/gu, '$1');
      if (path.isAbsolute(sourceSpecifier) ||
          path.extname(sourceSpecifier).toLowerCase() !== '.sidscore') {
        throw new Error(`${location}: SIDScore source must be a relative .sidscore path.`);
      }
      const originText = match[3]!;
      const radix = originText.startsWith('$') || /^0x/iu.test(originText) ? 16 : 10;
      const digits = originText.startsWith('$') ? originText.slice(1) :
        /^0x/iu.test(originText) ? originText.slice(2) : originText;
      const origin = Number.parseInt(digits, radix);
      if (origin > 0xffff) {
        throw new Error(`${location}: SIDScore origin must be between $0000 and $ffff.`);
      }
      declarations.push({
        location,
        module: {
          sourcePath: path.resolve(path.dirname(assemblyPath), sourceSpecifier),
          namespace: match[2]!,
          origin
        }
      });
    }
  }
  return declarations;
}

function endsInsideAsmBlockComment(line: string, startedInside: boolean): boolean {
  let inside = startedInside;
  let quote: '"' | "'" | undefined;
  for (let index = 0; index < line.length - 1; index += 1) {
    const pair = line.slice(index, index + 2);
    if (inside) {
      if (pair === '*/') {
        inside = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (line[index] === '\\') {
        index += 1;
      } else if (line[index] === quote) {
        quote = undefined;
      }
      continue;
    }
    if (line[index] === '"' || line[index] === "'") {
      quote = line[index] as '"' | "'";
    } else if (pair === '//') {
      break;
    } else if (pair === '/*') {
      inside = true;
      index += 1;
    }
  }
  return inside;
}

function mergeSidScoreModules(
  configuredModules: readonly ResolvedKickAssemblerSidScoreModuleConfiguration[],
  declarations: readonly SidScoreModuleDeclaration[]
): readonly ResolvedKickAssemblerSidScoreModuleConfiguration[] {
  const modules = [...configuredModules];
  const namespaces = new Map(configuredModules.map((module) => [
    module.namespace, 'build configuration'
  ]));
  const origins = new Map(configuredModules.map((module) => [
    module.origin, 'build configuration'
  ]));
  for (const declaration of declarations) {
    const { module, location } = declaration;
    const previousNamespace = namespaces.get(module.namespace);
    if (previousNamespace) {
      throw new Error(
        `${location}: SIDScore namespace ${module.namespace} is already declared in ${previousNamespace}.`
      );
    }
    const previousOrigin = origins.get(module.origin);
    if (previousOrigin) {
      const address = module.origin.toString(16).padStart(4, '0');
      throw new Error(
        `${location}: SIDScore origin $${address} is already declared in ${previousOrigin}.`
      );
    }
    namespaces.set(module.namespace, location);
    origins.set(module.origin, location);
    modules.push(module);
  }
  return modules;
}

async function collectSidScoreImportPaths(
  modules: readonly ResolvedKickAssemblerSidScoreModuleConfiguration[]
): Promise<readonly string[]> {
  const importPaths = new Set<string>();
  for (const module of modules) {
    let source: string;
    try {
      source = await readFile(module.sourcePath, 'utf8');
    } catch {
      // The exporter reports unreadable score files when the build runs.
      continue;
    }
    // IMPORT is a top-level SIDScore statement. Each imported file is a
    // separate subtune and must also invalidate the owning ASM program.
    const pattern = /^[ \t]*IMPORT\s+"((?:\\.|[^"\\])*)"\s+AS\s+\d+\b/gmu;
    for (const match of withoutSidScoreComments(source).matchAll(pattern)) {
      const importedPath = match[1]?.replace(/\\(["\\])/gu, '$1');
      if (importedPath) {
        importPaths.add(path.resolve(path.dirname(module.sourcePath), importedPath));
      }
    }
  }
  return [...importPaths].sort();
}

function withoutSidScoreComments(source: string): string {
  let result = '';
  let inString = false;
  let inComment = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (inComment) {
      if (character === '\n') {
        inComment = false;
        result += character;
      }
    } else if (inString) {
      result += character;
      if (character === '\\') {
        result += source[++index] ?? '';
      } else if (character === '"') {
        inString = false;
      }
    } else if (character === ';') {
      inComment = true;
    } else {
      result += character;
      if (character === '"') {
        inString = true;
      }
    }
  }
  return result;
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

  if (affectedPrograms.length > 0) {
    return affectedPrograms;
  }
  return path.extname(changedPath).toLowerCase() === '.sidscore' ? [] : programs;
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

import { access } from 'node:fs/promises';
import path from 'node:path';

export const VICE_DARWIN_ARM64_RESOURCES = path.join(
  'assets',
  'vice',
  'darwin-arm64',
  'VICE.app',
  'Contents',
  'Resources'
);

const VICE_RESOURCES_SUBDIRECTORY = path.join('share', 'vice');
const VICE_C64_RESOURCE_SUBDIRECTORY = 'C64';

export interface ViceRuntimeResolutionOptions {
  // Directory belonging to the application that owns the bundled VICE assets.
  runtimeDirectory: string;
  resourcesPathHint?: string;
  resourcesPath?: string;
  executable?: string;
}

export interface ResolvedViceRuntime {
  resourcesPath: string;
  executable?: string;
}

export async function resolveViceRuntime(
  options: ViceRuntimeResolutionOptions
): Promise<ResolvedViceRuntime> {
  const runtimeDirectory = options.runtimeDirectory;
  const configuredResourcesPath = normalizeConfiguredPath(options.resourcesPath);
  const executable = normalizeConfiguredPath(options.executable);
  const executableResourcesCandidates = executable
    ? executableResourceCandidates(executable)
    : [];

  const resourceCandidates = [
    ...(configuredResourcesPath ? [configuredResourcesPath] : []),
    ...executableResourcesCandidates,
    ...bundledViceResourceCandidates(runtimeDirectory),
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
      `Configured VICE resources path does not contain ${VICE_RESOURCES_SUBDIRECTORY} or ${VICE_C64_RESOURCE_SUBDIRECTORY}: ${configuredResourcesPath}.`
    );
  }

  throw new Error(
    `VICE runtime resources were not found for ${process.platform}-${process.arch}. ` +
      (options.resourcesPathHint ?? `Set resourcesPath to a VICE runtime root containing ${VICE_RESOURCES_SUBDIRECTORY}.`)
  );
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function isViceResourcesPath(filePath: string): Promise<boolean> {
  return (await pathExists(path.join(filePath, VICE_RESOURCES_SUBDIRECTORY))) ||
    pathExists(path.join(filePath, VICE_C64_RESOURCE_SUBDIRECTORY));
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

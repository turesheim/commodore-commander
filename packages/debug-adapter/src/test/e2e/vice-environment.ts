import { accessSync, constants } from 'node:fs';
import path from 'node:path';

export interface ViceE2eEnvironment {
  repoRoot: string;
  packageRoot: string;
  viceResourcesPath: string;
  viceExecutable: string;
  viceArgs: readonly string[];
}

export function resolveViceE2eEnvironment(): {
  environment?: ViceE2eEnvironment;
  skipReason?: string;
} {
  const packageRoot = path.resolve(__dirname, '..', '..', '..');
  const repoRoot = path.resolve(packageRoot, '..', '..');

  if (!isViceE2eEnabled()) {
    return {
      skipReason: 'set VICE_E2E=1 to run real VICE end-to-end tests'
    };
  }

  const viceResourcesPath = process.env.VICE_RESOURCES_PATH ||
    path.join(
      repoRoot,
      'packages',
      'theia-extension',
      'assets',
      'vice',
      'darwin-arm64',
      'VICE.app',
      'Contents',
      'Resources'
    );
  const viceExecutable = process.env.VICE_EXECUTABLE || 'x64sc';
  const viceBinary = resolveViceBinaryPath(viceResourcesPath, viceExecutable);

  if (!isReadableDirectory(viceResourcesPath)) {
    return {
      skipReason: `VICE resources path is not readable: ${viceResourcesPath}`
    };
  }
  if (!isExecutable(viceBinary)) {
    return {
      skipReason: `VICE executable is not runnable: ${viceBinary}`
    };
  }

  return {
    environment: {
      repoRoot,
      packageRoot,
      viceResourcesPath,
      viceExecutable,
      viceArgs: parseViceArgs(process.env.VICE_ARGS)
    }
  };
}

function isViceE2eEnabled(): boolean {
  const value = process.env.VICE_E2E?.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

function parseViceArgs(value: string | undefined): readonly string[] {
  if (!value?.trim()) {
    return [];
  }
  // Keep the opt-in parser deliberately simple: CI can pass JSON for arguments
  // containing spaces, while local runs can use a normal whitespace list.
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed) && parsed.every((entry) => typeof entry === 'string')) {
      return parsed;
    }
  } catch {
    // Fall through to whitespace splitting.
  }
  return value.split(/\s+/u).filter(Boolean);
}

function resolveViceBinaryPath(
  viceResourcesPath: string,
  viceExecutable: string
): string {
  return path.isAbsolute(viceExecutable) || /[\\/]/u.test(viceExecutable)
    ? path.resolve(viceExecutable)
    : path.join(viceResourcesPath, 'bin', viceExecutable);
}

function isReadableDirectory(filePath: string): boolean {
  try {
    accessSync(filePath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function isExecutable(filePath: string): boolean {
  try {
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

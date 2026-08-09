import { copyFile, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export interface PreparedFixture {
  debugInfo: string;
  directory: string;
  monitorCommands?: string;
  program: string;
  source: string;
}

export interface PrepareFixtureOptions {
  includeMonitorCommands?: boolean;
}

export type DebugAdapterFixtureName =
  | 'debug-demo'
  | 'visual-debugger-demo'
  | 'screencolors';

export async function prepareFixture(
  packageRoot: string,
  fixtureName: DebugAdapterFixtureName,
  options: PrepareFixtureOptions = {}
): Promise<PreparedFixture> {
  const sourceRoot = path.join(
    packageRoot,
    'src',
    'test',
    'e2e',
    'fixtures',
    fixtureName
  );
  const baseName = fixtureName;
  const sourceFile = `${baseName}.asm`;
  const programFile = `${baseName}.prg`;
  const debugInfoFile = `${baseName}.dbg`;
  const monitorCommandFile = `${baseName}.vs`;
  const directory = await mkdtemp(path.join(tmpdir(), `cc-vice-e2e-${fixtureName}-`));
  const source = path.join(directory, sourceFile);
  const program = path.join(directory, programFile);
  const debugInfo = path.join(directory, debugInfoFile);
  const monitorCommands = path.join(directory, monitorCommandFile);

  await Promise.all([
    copyFile(path.join(sourceRoot, sourceFile), source),
    copyFile(path.join(sourceRoot, programFile), program)
  ]);

  const debugInfoText = await readFile(path.join(sourceRoot, debugInfoFile), 'utf8');
  await writeFile(
    debugInfo,
    rewritePrimarySource(debugInfoText, sourceFile, source),
    'utf8'
  );

  const copiedMonitorCommands = options.includeMonitorCommands
    ? await copyOptionalFixtureFile(
        path.join(sourceRoot, monitorCommandFile),
        monitorCommands
      )
    : undefined;

  return {
    debugInfo,
    directory,
    ...(copiedMonitorCommands ? { monitorCommands } : {}),
    program,
    source
  };
}

export async function fixtureLine(
  sourcePath: string,
  needle: string
): Promise<number> {
  const lines = (await readFile(sourcePath, 'utf8')).split(/\r?\n/u);
  const index = lines.findIndex((line) => line.includes(needle));
  if (index < 0) {
    throw new Error(`Could not find fixture line containing: ${needle}`);
  }
  return index + 1;
}

function rewritePrimarySource(
  debugInfoText: string,
  sourceFile: string,
  sourcePath: string
): string {
  const escapedSourceFile = escapeRegExp(sourceFile);
  const sourceLine = new RegExp(`(\\n\\s*1,)[^\\n]*${escapedSourceFile}(?=\\r?\\n)`, 'u');
  const rewritten = debugInfoText.replace(sourceLine, (_match, prefix: string) =>
    `${prefix}${sourcePath}`
  );
  if (rewritten === debugInfoText) {
    throw new Error(`Could not rewrite primary source path in ${sourceFile} debug dump.`);
  }
  return rewritten;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

async function copyOptionalFixtureFile(
  source: string,
  target: string
): Promise<boolean> {
  try {
    await copyFile(source, target);
    return true;
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return false;
    }
    throw error;
  }
}

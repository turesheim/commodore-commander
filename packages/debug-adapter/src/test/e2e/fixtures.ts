import { copyFile, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export interface PreparedFixture {
  debugInfo: string;
  directory: string;
  program: string;
  source: string;
}

export async function prepareFixture(
  packageRoot: string,
  fixtureName: 'debug-demo' | 'visual-debugger-demo'
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
  const directory = await mkdtemp(path.join(tmpdir(), `cc-vice-e2e-${fixtureName}-`));
  const source = path.join(directory, sourceFile);
  const program = path.join(directory, programFile);
  const debugInfo = path.join(directory, debugInfoFile);

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

  return {
    debugInfo,
    directory,
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

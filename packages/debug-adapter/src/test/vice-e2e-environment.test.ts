import assert from 'node:assert/strict';
import { mkdtemp, writeFile, chmod } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { supportsEmbeddedTransport } from './e2e/vice-environment';

test('embedded transport probe rejects stock VICE unknown option output', async () => {
  const vice = await writeExecutable(
    'stock-vice',
    [
      '#!/bin/sh',
      'echo "Unknown option \'-cc-embed\'."',
      'echo "Error parsing command-line options, bailing out."',
      'exit 1'
    ]
  );

  assert.equal(supportsEmbeddedTransport(vice), false);
});

test('embedded transport probe accepts VICE binaries with patched option support', async () => {
  const vice = await writeExecutable(
    'patched-vice',
    [
      '#!/bin/sh',
      'echo "Usage: x64sc [options]"',
      'echo "  -cc-embed"',
      'exit 0'
    ]
  );

  assert.equal(supportsEmbeddedTransport(vice), true);
});

async function writeExecutable(name: string, lines: readonly string[]): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cc-vice-probe-'));
  const executable = path.join(directory, name);
  await writeFile(executable, `${lines.join('\n')}\n`, 'utf8');
  await chmod(executable, 0o755);
  return executable;
}

#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const DEFAULT_MAX_OLD_SPACE_SIZE_MB = 4096;
const HEAP_OPTION = '--max-old-space-size=';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const theiaCli = path.join(
  repoRoot,
  'node_modules',
  '@theia',
  'cli',
  'bin',
  'theia.js'
);
const heapSize = process.env.THEIA_BUILD_MAX_OLD_SPACE_SIZE_MB ||
  String(DEFAULT_MAX_OLD_SPACE_SIZE_MB);
const env = {
  ...process.env,
  NODE_OPTIONS: withHeapOption(process.env.NODE_OPTIONS, heapSize)
};

const result = spawnSync(process.execPath, [theiaCli, ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env,
  stdio: 'inherit'
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);

function withHeapOption(value, heapSizeMb) {
  const options = value?.trim();
  const heapOption = `${HEAP_OPTION}${heapSizeMb}`;
  if (!options) {
    return heapOption;
  }
  if (options.split(/\s+/u).some(option => option.startsWith(HEAP_OPTION))) {
    return options;
  }
  return `${options} ${heapOption}`;
}

import { spawn } from 'node:child_process';
import { access, cp, chmod, lstat, mkdir, open, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MACHO_MAGIC = new Set([
  0xfeedface,
  0xfeedfacf,
  0xcefaedfe,
  0xcffaedfe,
  0xcafebabe,
  0xbebafeca,
  0xcafebabf,
  0xbfbafeca
]);

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..', '..');
const sidScoreCliJar = 'sidscore-cli-0.7.1.jar';
const sidScoreCliSource = path.join(repoRoot, 'resources', sidScoreCliJar);
const sidScoreCliTarget = path.join(
  scriptDir,
  '..',
  'assets',
  'sidscore',
  sidScoreCliJar
);
const source = process.env.COMMODORE_COMMANDER_PATCHED_VICE_APP
  ? path.resolve(process.env.COMMODORE_COMMANDER_PATCHED_VICE_APP)
  : path.join(
    repoRoot,
    'tools',
    'vice-embed',
    'dist',
    'darwin-arm64',
    'VICE.app'
  );
const usesExternalViceApp = Boolean(
  process.env.COMMODORE_COMMANDER_PATCHED_VICE_APP
);
const supportsBundledViceAssets =
  process.platform === 'darwin' && process.arch === 'arm64';
const viceEmbedDir = path.join(repoRoot, 'tools', 'vice-embed');
const viceEmbedBuildInputs = [
  path.join(viceEmbedDir, 'Makefile'),
  path.join(viceEmbedDir, 'vice-3.10.0-commodore-embed.patch')
];
const target = path.join(
  scriptDir,
  '..',
  'assets',
  'vice',
  'darwin-arm64',
  'VICE.app'
);

await mkdir(path.dirname(sidScoreCliTarget), { recursive: true });
for (const entry of await readdir(path.dirname(sidScoreCliTarget))) {
  if (/^sidscore-cli-.*\.jar$/u.test(entry)) {
    await rm(path.join(path.dirname(sidScoreCliTarget), entry), { force: true });
  }
}
await cp(sidScoreCliSource, sidScoreCliTarget, {
  preserveTimestamps: true
});

if (
  process.env.COMMODORE_COMMANDER_SKIP_VICE_ASSETS === '1' ||
  !supportsBundledViceAssets
) {
  console.warn(
    `Skipping bundled VICE asset sync for ${process.platform}-${process.arch}.`
  );
  process.exit(0);
}

if (
  !usesExternalViceApp &&
  process.env.COMMODORE_COMMANDER_SKIP_VICE_AUTO_REBUILD !== '1'
) {
  await ensurePatchedVicePackage(source);
}

if (!(await pathExists(source))) {
  throw new Error(
    `Patched embedded VICE app bundle was not found: ${source}\n` +
      'Run `make -C tools/vice-embed package` or set ' +
      'COMMODORE_COMMANDER_PATCHED_VICE_APP to a patched VICE.app.'
  );
}

await mkdir(path.dirname(target), { recursive: true });
await rm(target, { recursive: true, force: true });
await cp(source, target, {
  recursive: true,
  preserveTimestamps: true,
  verbatimSymlinks: true,
  filter: (entry) => !entry.endsWith('.DS_Store')
});

await prepareMacOsAppBundle(target);

async function prepareMacOsAppBundle(appPath) {
  await makeWritable(appPath);

  if (process.platform !== 'darwin') {
    return;
  }

  await run('xattr', ['-cr', appPath]);
  const identity = process.env.VICE_CODESIGN_IDENTITY ?? '-';
  const machOFiles = await collectMachOFiles(appPath);
  for (const machOFile of machOFiles) {
    await run('codesign', ['--force', '--sign', identity, machOFile]);
  }

  await run('codesign', [
    '--force',
    '--deep',
    '--sign',
    identity,
    appPath
  ]);
  await run('codesign', [
    '--verify',
    '--deep',
    '--strict',
    '--verbose=2',
    appPath
  ]);
  for (const machOFile of machOFiles) {
    await run('codesign', ['--verify', machOFile]);
  }
}

async function makeWritable(entryPath) {
  const stats = await lstat(entryPath);
  if (!stats.isSymbolicLink()) {
    await chmod(entryPath, stats.mode | 0o200);
  }

  if (!stats.isDirectory()) {
    return;
  }

  const entries = await readdir(entryPath);
  await Promise.all(
    entries.map((entry) => makeWritable(path.join(entryPath, entry)))
  );
}

async function ensurePatchedVicePackage(appPath) {
  if (!(await isPatchedVicePackageStale(appPath))) {
    return;
  }

  console.warn(
    'Patched embedded VICE is missing or stale; rebuilding with `make -C tools/vice-embed package`.'
  );
  await runInherited('make', ['-C', viceEmbedDir, 'package']);
}

async function isPatchedVicePackageStale(appPath) {
  const packageStamp = path.join(
    appPath,
    'Contents',
    'Resources',
    '.commodore-commander-patched-vice'
  );
  if (!(await pathExists(packageStamp))) {
    return true;
  }

  const stampStats = await lstat(packageStamp);
  for (const input of viceEmbedBuildInputs) {
    const inputStats = await lstat(input);
    if (inputStats.mtimeMs > stampStats.mtimeMs) {
      return true;
    }
  }
  return false;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = [];
    child.stdout.on('data', (chunk) => chunks.push(chunk));
    child.stderr.on('data', (chunk) => chunks.push(chunk));
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      const output = Buffer.concat(chunks).toString().trim();
      reject(
        new Error(
          `${command} ${args.join(' ')} failed with ${
            signal ?? `exit ${code}`
          }${output ? `\n${output}` : ''}`
        )
      );
    });
  });
}

function runInherited(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `${command} ${args.join(' ')} failed with ${signal ?? `exit ${code}`}`
        )
      );
    });
  });
}

async function collectMachOFiles(entryPath) {
  const stats = await lstat(entryPath);
  if (stats.isSymbolicLink()) {
    return [];
  }

  if (stats.isDirectory()) {
    const entries = await readdir(entryPath);
    const nested = await Promise.all(
      entries.map((entry) => collectMachOFiles(path.join(entryPath, entry)))
    );
    return nested.flat();
  }

  return (await isMachO(entryPath)) ? [entryPath] : [];
}

async function pathExists(entryPath) {
  try {
    await access(entryPath);
    return true;
  } catch {
    return false;
  }
}

async function isMachO(filePath) {
  const file = await open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(4);
    const { bytesRead } = await file.read(buffer, 0, 4, 0);
    if (bytesRead < 4) {
      return false;
    }
    return MACHO_MAGIC.has(buffer.readUInt32BE(0));
  } finally {
    await file.close();
  }
}

import { spawn } from 'node:child_process';
import { cp, chmod, lstat, mkdir, open, readdir, rm } from 'node:fs/promises';
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
const sidScoreCliJar = 'sidscore-cli-0.7.0.jar';
const sidScoreCliSource = path.join(repoRoot, 'resources', sidScoreCliJar);
const sidScoreCliTarget = path.join(
  scriptDir,
  '..',
  'assets',
  'sidscore',
  sidScoreCliJar
);
const source = path.join(
  repoRoot,
  'net.sourceforge.vice.cocoa.macosx.aarch64',
  'vice',
  'VICE.app'
);
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

await mkdir(path.dirname(target), { recursive: true });
await rm(target, { recursive: true, force: true });
await cp(source, target, {
  recursive: true,
  preserveTimestamps: true,
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

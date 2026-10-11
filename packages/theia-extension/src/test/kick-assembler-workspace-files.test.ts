import assert from 'node:assert/strict';
import { test } from 'node:test';
import URI from '@theia/core/lib/common/uri';
import { DEFAULT_KICK_ASSEMBLER_EXCLUDED_DIRECTORY_NAMES } from '@commodore-commander/language-support/runtime';

import { isKickAssemblerFileExtension } from '../browser/kick-assembler-file-associations';
import { KickAssemblerWorkspaceFiles } from '../browser/kick-assembler-workspace-files';

interface TestStat {
  resource: URI;
  name: string;
  isFile: boolean;
  isDirectory: boolean;
  children?: TestStat[];
}

const uri = (path: string) => new URI(`file://${path}`);
const sourceFile = (resource: URI) => isKickAssemblerFileExtension(resource.path.ext);
const excluded = new Set(DEFAULT_KICK_ASSEMBLER_EXCLUDED_DIRECTORY_NAMES);
const paths = (files: readonly URI[]) => files.map(file => file.path.toString());

function file(path: string): TestStat {
  return {
    resource: uri(path), name: path.split('/').pop()!,
    isFile: true, isDirectory: false
  };
}

function folder(path: string, ...children: TestStat[]): TestStat {
  return { ...file(path), isFile: false, isDirectory: true, children };
}

function filesystem(...roots: TestStat[]) {
  const stats = new Map<string, TestStat>();
  const reads: string[] = [];
  function put(stat: TestStat): void {
    stats.set(stat.resource.toString(), stat);
    stat.children?.forEach(put);
  }
  roots.forEach(put);
  async function resolve(resource: URI): Promise<TestStat> {
    reads.push(resource.path.toString());
    const stat = stats.get(resource.toString());
    if (!stat) throw new Error(`Unavailable: ${resource}`);
    return stat;
  }
  return { put, reads, resolve };
}

test('inventory preserves traversal order, source extensions and excluded directories', async () => {
  const fs = filesystem(folder('/project',
    folder('/project/lib', file('/project/lib/shared.inc')),
    file('/project/main.ASM'),
    folder('/project/vendor', file('/project/vendor/helper.ka')),
    file('/project/readme.md'),
    ...[...excluded].map(name => folder(`/project/${name}`,
      file(`/project/${name}/ignored.asm`)))
  ));
  const inventory = new KickAssemblerWorkspaceFiles(fs.resolve, sourceFile, excluded);
  assert.deepEqual(paths(await inventory.getFiles(uri('/project'))), [
    '/project/main.ASM', '/project/vendor/helper.ka', '/project/lib/shared.inc'
  ]);
  assert.deepEqual(fs.reads, ['/project', '/project/vendor', '/project/lib']);
});

test('equivalent roots and concurrent requests share discovery without exposing a mutable list', async () => {
  const fs = filesystem(folder('/project', file('/project/main.asm')));
  const inventory = new KickAssemblerWorkspaceFiles(fs.resolve, sourceFile, excluded);
  const first = inventory.getFiles(uri('/project'));
  assert.equal(inventory.getFiles(uri('/project')), first);
  const files = await first;
  assert.equal(await inventory.getFiles(uri('/project')), files);
  assert.throws(() => (files as URI[]).push(uri('/project/unwanted.asm')));
  assert.deepEqual(fs.reads, ['/project']);
});

test('structural changes refresh only overlapping roots, including moved directories', async () => {
  const fs = filesystem(
    folder('/one', folder('/one/lib', file('/one/lib/old.asm'))),
    folder('/two', file('/two/main.asm')),
    folder('/three', file('/three/main.asm'))
  );
  const inventory = new KickAssemblerWorkspaceFiles(fs.resolve, sourceFile, excluded);
  await Promise.all(['/one', '/two', '/three'].map(root => inventory.getFiles(uri(root))));
  fs.put(folder('/one'));
  fs.put(folder('/two', file('/two/main.asm'),
    folder('/two/lib', file('/two/lib/old.asm'))));
  inventory.invalidate([uri('/one/lib'), uri('/two/lib')]);
  assert.deepEqual(paths(await inventory.getFiles(uri('/one'))), []);
  assert.deepEqual(paths(await inventory.getFiles(uri('/two'))), [
    '/two/main.asm', '/two/lib/old.asm'
  ]);
  await inventory.getFiles(uri('/three'));
  assert.equal(fs.reads.filter(path => path === '/three').length, 1);
  inventory.invalidate([uri('/')]);
  await inventory.getFiles(uri('/three'));
  assert.equal(fs.reads.filter(path => path === '/three').length, 2);
});

test('new and deleted source files replace the snapshot without retaining stale paths', async () => {
  const fs = filesystem(folder('/project', file('/project/old.asm')));
  const inventory = new KickAssemblerWorkspaceFiles(fs.resolve, sourceFile, excluded);
  await inventory.getFiles(uri('/project'));
  fs.put(folder('/project', file('/project/new.asm')));
  inventory.invalidate([uri('/project/old.asm'), uri('/project/new.asm')]);
  assert.deepEqual(paths(await inventory.getFiles(uri('/project'))), ['/project/new.asm']);
});

test('a structural event during discovery makes pending callers join the fresh snapshot', async () => {
  const fs = filesystem(folder('/project', file('/project/old.asm')));
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let first = true;
  const inventory = new KickAssemblerWorkspaceFiles(async resource => {
    const stat = await fs.resolve(resource);
    if (first) {
      first = false;
      await gate;
    }
    return stat;
  }, sourceFile, excluded);
  const pending = inventory.getFiles(uri('/project'));
  fs.put(folder('/project', file('/project/new.asm')));
  inventory.invalidate([uri('/project/new.asm')]);
  const fresh = await inventory.getFiles(uri('/project'));
  release();
  assert.equal(await pending, fresh);
  assert.deepEqual(paths(fresh), ['/project/new.asm']);
  assert.equal(fs.reads.length, 2);
});

test('workspace reset cancels even an invalidated pending snapshot without reviving old roots', async () => {
  const fs = filesystem(folder('/project', file('/project/main.asm')));
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const inventory = new KickAssemblerWorkspaceFiles(async resource => {
    const stat = await fs.resolve(resource);
    await gate;
    return stat;
  }, sourceFile, excluded);
  const pending = inventory.getFiles(uri('/project'));
  inventory.invalidate([uri('/project/main.asm')]);
  inventory.clear();
  release();
  assert.deepEqual(await pending, []);
  assert.equal(fs.reads.length, 1);
  assert.deepEqual(paths(await inventory.getFiles(uri('/project'))), ['/project/main.asm']);
  assert.equal(fs.reads.length, 2);
});

test('five-second expiry discovers changes even when no filesystem event arrives', async () => {
  const fs = filesystem(folder('/project', file('/project/main.asm')));
  let now = 100;
  const inventory = new KickAssemblerWorkspaceFiles(fs.resolve, sourceFile, excluded, () => now);
  await inventory.getFiles(uri('/project'));
  fs.put(folder('/project', file('/project/main.asm'), file('/project/missed.asm')));
  now = 5099;
  assert.deepEqual(paths(await inventory.getFiles(uri('/project'))), ['/project/main.asm']);
  now = 5100;
  assert.deepEqual(paths(await inventory.getFiles(uri('/project'))), [
    '/project/main.asm', '/project/missed.asm'
  ]);
  assert.equal(fs.reads.length, 2);
});

test('filesystem failures return available files but do not cache incomplete discovery', async () => {
  const fs = filesystem(folder('/project',
    file('/project/main.asm'), folder('/project/lib', file('/project/lib/shared.asm'))
  ));
  let fail = true;
  const inventory = new KickAssemblerWorkspaceFiles(async resource => {
    if (resource.path.toString() === '/project/lib' && fail) {
      fail = false;
      throw new Error('Temporary directory read failure');
    }
    return fs.resolve(resource);
  }, sourceFile, excluded);
  assert.deepEqual(paths(await inventory.getFiles(uri('/project'))), ['/project/main.asm']);
  assert.deepEqual(paths(await inventory.getFiles(uri('/project'))), [
    '/project/main.asm', '/project/lib/shared.asm'
  ]);
  assert.equal(fs.reads.filter(path => path === '/project').length, 2);
});

test('file roots and overlapping workspace roots keep their original discovery behavior', async () => {
  const fs = filesystem(folder('/project',
    file('/project/main.asm'), folder('/project/lib', file('/project/lib/shared.asm'))
  ));
  const inventory = new KickAssemblerWorkspaceFiles(fs.resolve, sourceFile, excluded);
  assert.deepEqual(paths(await inventory.getFiles(uri('/project/main.asm'))), ['/project/main.asm']);
  await inventory.getFiles(uri('/project'));
  await inventory.getFiles(uri('/project/lib'));
  fs.put(folder('/project/lib', file('/project/lib/new.asm')));
  inventory.invalidate([uri('/project/lib/new.asm')]);
  assert.deepEqual(paths(await inventory.getFiles(uri('/project/lib'))), ['/project/lib/new.asm']);
  assert.deepEqual(paths(await inventory.getFiles(uri('/project'))), [
    '/project/main.asm', '/project/lib/new.asm'
  ]);
});

test('default inventory skips nested generated directories without hiding source folders', async () => {
  const fs = filesystem(folder('/project',
    file('/project/main.asm'),
    folder('/project/src',
      file('/project/src/helper.inc'),
      folder('/project/src/dist', file('/project/src/dist/copy.asm')),
      folder('/project/src/out', file('/project/src/out/copy.inc')),
      folder('/project/src/src-gen', file('/project/src/src-gen/copy.ka'))),
    folder('/project/dist', file('/project/dist/main.asm')),
    folder('/project/out', file('/project/out/main.inc')),
    folder('/project/src-gen', file('/project/src-gen/main.ka')),
    folder('/project/output', file('/project/output/handwritten.asm'))
  ));
  // Use the actual default, not a test-local approximation of the product list.
  const inventory = new KickAssemblerWorkspaceFiles(fs.resolve, sourceFile);
  assert.deepEqual(paths(await inventory.getFiles(uri('/project'))), [
    '/project/main.asm', '/project/output/handwritten.asm', '/project/src/helper.inc'
  ]);
  assert.deepEqual(fs.reads, ['/project', '/project/output', '/project/src']);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import URI from '@theia/core/lib/common/uri';
import { KickAssemblerWorkspaceDocuments } from '../browser/kick-assembler-workspace-documents';

const uri = (path: string) => new URI(`file://${path}`);

test('unchanged disk documents and concurrent callers share one read and text model', async () => {
  let reads = 0;
  const cache = new KickAssemblerWorkspaceDocuments(async () => { reads++; return 'Start:\n rts\n'; });
  const first = cache.getDocument(uri('/main.asm'));
  assert.equal(cache.getDocument(uri('/main.asm')), first);
  const document = await first;
  assert.equal(await cache.getDocument(uri('/main.asm')), document);
  assert.equal(document?.uri, 'file:///main.asm');
  assert.equal(document?.lineCount, 3);
  assert.equal(reads, 1);
});

test('file updates invalidate their disk snapshot without rereading unaffected files', async () => {
  const contents = new Map([['file:///main.asm', 'Old:\n'], ['file:///lib.asm', 'Shared:\n']]);
  const reads: string[] = [];
  const cache = new KickAssemblerWorkspaceDocuments(async resource => {
    reads.push(resource.toString());
    return contents.get(resource.toString())!;
  });
  await cache.getDocument(uri('/main.asm'));
  const shared = await cache.getDocument(uri('/lib.asm'));
  contents.set('file:///main.asm', 'New:\n');
  cache.invalidate([uri('/main.asm')]);
  assert.equal((await cache.getDocument(uri('/main.asm')))?.text, 'New:\n');
  assert.equal(await cache.getDocument(uri('/lib.asm')), shared);
  assert.deepEqual(reads, ['file:///main.asm', 'file:///lib.asm', 'file:///main.asm']);
});

test('directory operations invalidate all descendant snapshots and both move endpoints', async () => {
  const reads: string[] = [];
  const cache = new KickAssemblerWorkspaceDocuments(async resource => {
    reads.push(resource.toString());
    return 'Label:\n';
  });
  const files = [uri('/old/one.asm'), uri('/old/nested/two.asm'), uri('/new/one.asm'), uri('/other.asm')];
  await Promise.all(files.map(file => cache.getDocument(file)));
  cache.invalidate([uri('/old'), uri('/new')]);
  await Promise.all(files.map(file => cache.getDocument(file)));
  assert.equal(reads.length, 7);
  assert.equal(reads.filter(path => path === 'file:///other.asm').length, 1);
});

test('an event during a disk read makes pending callers receive the replacement text', async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let reads = 0;
  const cache = new KickAssemblerWorkspaceDocuments(async () => {
    if (++reads === 1) { await gate; return 'Old:\n'; }
    return 'New:\n';
  });
  const pending = cache.getDocument(uri('/main.asm'));
  await Promise.resolve();
  cache.invalidate([uri('/main.asm')]);
  const fresh = await cache.getDocument(uri('/main.asm'));
  release();
  assert.equal(await pending, fresh);
  assert.equal(fresh?.text, 'New:\n');
  assert.equal(reads, 2);
});

test('five-second expiry refreshes disk text when a watcher event is missing', async () => {
  let now = 0, text = 'Old:\n', reads = 0;
  const cache = new KickAssemblerWorkspaceDocuments(async () => { reads++; return text; }, () => now);
  await cache.getDocument(uri('/main.asm'));
  text = 'New:\n';
  now = 4999;
  assert.equal((await cache.getDocument(uri('/main.asm')))?.text, 'Old:\n');
  now = 5000;
  assert.equal((await cache.getDocument(uri('/main.asm')))?.text, 'New:\n');
  assert.equal(reads, 2);
});

test('missing and unreadable files are skipped without caching failure', async () => {
  let reads = 0;
  const cache = new KickAssemblerWorkspaceDocuments(async () => {
    if (++reads === 1) throw new Error('Unavailable');
    return 'Restored:\n';
  });
  assert.equal(await cache.getDocument(uri('/main.asm')), undefined);
  assert.equal((await cache.getDocument(uri('/main.asm')))?.text, 'Restored:\n');
  assert.equal(reads, 2);
});

test('workspace reset prevents an invalidated pending read from repopulating the cache', async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let reads = 0;
  const cache = new KickAssemblerWorkspaceDocuments(async () => { reads++; await gate; return 'Start:\n'; });
  const pending = cache.getDocument(uri('/main.asm'));
  await Promise.resolve();
  cache.invalidate([uri('/main.asm')]);
  cache.clear();
  release();
  assert.equal(await pending, undefined);
  assert.equal((await cache.getDocument(uri('/main.asm')))?.text, 'Start:\n');
  assert.equal(reads, 2);
});

test('retention evicts completed documents without dropping a concurrent earlier request', async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const reads: string[] = [];
  const cache = new KickAssemblerWorkspaceDocuments(async resource => {
    reads.push(resource.toString());
    if (resource.path.toString() === '/old/pending.asm') await gate;
    return 'Label:\n';
  });
  cache.retain([uri('/old/main.asm'), uri('/old/pending.asm')]);
  await cache.getDocument(uri('/old/main.asm'));
  const pending = cache.getDocument(uri('/old/pending.asm'));
  await Promise.resolve();
  cache.retain([uri('/new/main.asm')]);
  release();
  assert.equal((await pending)?.text, 'Label:\n');
  await cache.getDocument(uri('/old/main.asm'));
  await cache.getDocument(uri('/old/pending.asm'));
  assert.equal(reads.length, 4);
});

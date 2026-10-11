import assert from 'node:assert/strict';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { probeViceRuntime } from '../vice-runtime-probe';

async function executable(source: string): Promise<{ command: string; cleanup: () => Promise<void> }> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cc-vice-probe-'));
  const command = path.join(root, 'emulator with spaces');
  await writeFile(command, `#!/bin/sh\nexec '${process.execPath.replace(/'/gu, "'\\''")}' -e '${source.replace(/'/gu, "'\\''")}' -- "$@"\n`);
  await chmod(command, 0o755);
  return { command, cleanup: () => rm(root, { recursive: true, force: true }) };
}

test('probe detects the patched protocol and passes only version/embedded arguments', { skip: process.platform === 'win32' }, async t => {
  const fake = await executable(`
    require('node:assert/strict').deepEqual(process.argv.slice(1), ['-cc-embed', '-version']);
    console.log('CCV1 {"type":"hello","protocol":"commodore-vice-embed-v1"}');
    console.log('x64sc (VICE 3.10.0)');
  `);
  t.after(fake.cleanup);
  assert.deepEqual(await probeViceRuntime(fake.command, true), { version: '3.10.0', embedded: true });
});

test('stock VICE is accepted for external mode but cannot masquerade as embedded', { skip: process.platform === 'win32' }, async t => {
  const fake = await executable(`console.log('x64sc (VICE 3.9)');`);
  t.after(fake.cleanup);
  assert.deepEqual(await probeViceRuntime(fake.command, false), { version: '3.9', embedded: false });
  await assert.rejects(probeViceRuntime(fake.command, true), /patched runtime or select external/u);
});

test('a different protocol version cannot satisfy the embedded check', { skip: process.platform === 'win32' }, async t => {
  const fake = await executable(`console.log('VICE 3.10'); console.log('CCV1 {"type":"hello","protocol":"other"}');`);
  t.after(fake.cleanup);
  await assert.rejects(probeViceRuntime(fake.command, true), /does not advertise/u);
});

test('a hung probe is killed within the configured deadline', { skip: process.platform === 'win32' }, async t => {
  const fake = await executable(`setInterval(() => {}, 1000);`);
  t.after(fake.cleanup);
  const started = Date.now();
  await assert.rejects(probeViceRuntime(fake.command, false, 200), (error: unknown) => {
    assert.equal((error as { signal: string }).signal, 'SIGKILL');
    return true;
  });
  assert.ok(Date.now() - started < 3000);
});

test('a missing or unrelated executable cannot pass runtime setup', async () => {
  await assert.rejects(probeViceRuntime(path.join(os.tmpdir(), 'cc-no-such-vice-runtime', 'x64sc'), false), /ENOENT/u);
  await assert.rejects(probeViceRuntime(process.execPath, false), /bad option/u);
});

test('an executable that exits successfully without a VICE version is rejected', { skip: process.platform === 'win32' }, async t => {
  const fake = await executable(`console.log('an unrelated tool');`);
  t.after(fake.cleanup);
  await assert.rejects(probeViceRuntime(fake.command, false), /did not identify itself as VICE/u);
});

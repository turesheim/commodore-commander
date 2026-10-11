import assert from 'node:assert/strict';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { ViceStandaloneProcess, type ViceStandaloneProcessClose } from '../vice-standalone-process';

const processTestOptions = { timeout: 5000 };

test('standalone launch preserves cwd, arguments, inherited environment, and output', processTestOptions, async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cc-vice-standalone-'));
  const closed = deferred<ViceStandaloneProcessClose>();
  let stdout = '';
  let stderr = '';
  const runtime = new ViceStandaloneProcess({
    onStdout: (chunk) => { stdout += chunk.toString(); },
    onStderr: (chunk) => { stderr += chunk.toString(); },
    onClose: closed.resolve
  });
  t.after(() => runtime.stop());
  t.after(() => rm(directory, { recursive: true, force: true }));

  const pid = runtime.start({
    command: process.execPath,
    args: ['-e', `
      console.log(JSON.stringify({ cwd: process.cwd(), args: process.argv.slice(1), initialCwd: process.env.VICE_INITIAL_CWD ?? null }));
      console.error('standalone stderr');
    `, 'argument with spaces'],
    cwd: directory
  });
  assert.equal(runtime.hasProcess, true);
  assert.equal(runtime.pid, pid);

  const event = await closed.promise;
  assert.deepEqual(event, { pid, exitCode: 0, signal: null });
  assert.deepEqual(JSON.parse(stdout), {
    cwd: await realpath(directory),
    args: ['argument with spaces'],
    initialCwd: process.env.VICE_INITIAL_CWD ?? null
  });
  assert.equal(stderr.trim(), 'standalone stderr');
  assert.equal(runtime.hasProcess, false);
  assert.equal(runtime.pid, undefined);
});

test('standalone commands use inherited fd 3', processTestOptions, async (t) => {
  const closed = deferred<ViceStandaloneProcessClose>();
  let stdout = '';
  const runtime = new ViceStandaloneProcess({
    onStdout: (chunk) => { stdout += chunk.toString(); },
    onClose: closed.resolve
  });
  t.after(() => runtime.stop());
  runtime.start({
    command: process.execPath,
    args: ['-e', `
      const fs = require('node:fs');
      const readline = require('node:readline');
      const input = readline.createInterface({ input: fs.createReadStream(null, { fd: 3, autoClose: false }) });
      input.on('line', (line) => process.stdout.write(line + '\\n', () => process.exit(0)));
    `],
    cwd: process.cwd()
  });
  const command = 'CCV1 {"type":"reset"}\n';
  runtime.sendCommand(command);
  assert.equal((await closed.promise).exitCode, 0);
  assert.equal(stdout, command);
  runtime.sendCommand(command); // No process remains to receive commands.
});

test('standalone spawn failure releases ownership and reports only the error', processTestOptions, async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cc-vice-missing-'));
  const failed = deferred<Error>();
  const runtime = new ViceStandaloneProcess({
    onError: failed.resolve,
    onClose: () => assert.fail('Spawn failure must not also report a process close.')
  });
  t.after(() => runtime.stop());
  t.after(() => rm(directory, { recursive: true, force: true }));
  runtime.start({ command: path.join(directory, 'missing-vice'), args: [], cwd: directory });

  assert.equal((await failed.promise as NodeJS.ErrnoException).code, 'ENOENT');
  assert.equal(runtime.hasProcess, false);
  assert.equal(runtime.pid, undefined);
  runtime.sendCommand('CCV1 {"type":"quit"}\n');
  runtime.stop();
});

test('replacing a standalone process discards its late output and close events', processTestOptions, async (t) => {
  const ready = deferred<void>();
  const closed = deferred<ViceStandaloneProcessClose>();
  let stdout = '';
  let stderr = '';
  const runtime = new ViceStandaloneProcess({
    onStdout: (chunk) => {
      stdout += chunk.toString();
      if (stdout.includes('old ready')) { ready.resolve(); }
    },
    onStderr: (chunk) => { stderr += chunk.toString(); },
    onClose: closed.resolve
  });
  t.after(() => runtime.stop());
  const oldPid = runtime.start({
    command: process.execPath,
    args: ['-e', `
      process.on('SIGTERM', () => {
        console.error('old late stderr');
        process.stdout.write('old late stdout\\n', () => process.exit(0));
      });
      console.log('old ready');
      setInterval(() => {}, 1000);
    `],
    cwd: process.cwd()
  });
  await ready.promise;
  const newPid = runtime.start({
    command: process.execPath,
    args: ['-e', "console.log('new ready'); process.exit(7);"],
    cwd: process.cwd()
  });
  const event = await closed.promise;
  assert.deepEqual(event, { pid: newPid, exitCode: 7, signal: null });
  await waitForProcessExit(oldPid!);
  assert.equal(stdout, 'old ready\nnew ready\n');
  assert.equal(stderr, '');
  assert.equal(runtime.hasProcess, false);
});

test('explicit standalone stop is idempotent and suppresses the later close callback', processTestOptions, async (t) => {
  const ready = deferred<void>();
  const runtime = new ViceStandaloneProcess({
    onStdout: () => ready.resolve(),
    onClose: () => assert.fail('The caller reports explicit stop.')
  });
  t.after(() => runtime.stop());
  const pid = runtime.start({
    command: process.execPath,
    args: ['-e', "console.log('ready'); setInterval(() => {}, 1000);"],
    cwd: process.cwd()
  });
  await ready.promise;
  runtime.stop();
  runtime.stop();
  await waitForProcessExit(pid!);
  assert.equal(runtime.hasProcess, false);
  assert.equal(runtime.pid, undefined);
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

async function waitForProcessExit(pid: number): Promise<void> {
  const expiresAt = Date.now() + 2000;
  while (Date.now() < expiresAt) {
    try {
      process.kill(pid, 0);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ESRCH') { return; }
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail(`Process ${pid} did not exit.`);
}

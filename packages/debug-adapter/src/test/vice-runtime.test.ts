import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { chmod, cp, mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import {
  createViceProcessArgs,
  resolveViceCommand,
  terminateViceProcess
} from '../vice-runtime';

test('createViceProcessArgs omits binary monitor arguments when monitor is disabled', () => {
  const args = createViceProcessArgs({
    program: '/workspace/out/main.prg',
    viceArgs: ['-config', '/workspace/vice.ini']
  });

  assert.deepEqual(args, [
    '-config',
    '/workspace/vice.ini',
    '/workspace/out/main.prg'
  ]);
  assert.equal(args.includes('-binarymonitor'), false);
  assert.equal(args.includes('-binarymonitoraddress'), false);
  assert.equal(args.includes('-initbreak'), false);
});

test('createViceProcessArgs includes binary monitor arguments for debug launches', () => {
  const args = createViceProcessArgs({
    program: '/workspace/out/main.prg',
    viceArgs: ['-config', '/workspace/vice.ini'],
    monitor: {
      host: '127.0.0.1',
      port: 6502
    }
  });

  assert.deepEqual(args, [
    '-config',
    '/workspace/vice.ini',
    '-binarymonitor',
    '-binarymonitoraddress',
    '127.0.0.1:6502',
    '-initbreak',
    'ready',
    '/workspace/out/main.prg'
  ]);
});

test('terminateViceProcess sends SIGTERM and waits for process exit', async () => {
  const child = spawn(
    process.execPath,
    ['-e', 'setInterval(() => {}, 1000);'],
    { stdio: 'ignore' }
  );
  await once(child, 'spawn');

  try {
    const terminated = await terminateViceProcess(child, {
      timeoutMs: 1000,
      forceKillTimeoutMs: 1000
    });

    assert.equal(terminated, true);
    assert.equal(child.signalCode, 'SIGTERM');
  } finally {
    child.kill('SIGKILL');
  }
});

test('terminateViceProcess force-kills a process that ignores SIGTERM', async () => {
  const ignoreSigtermScript = [
    "process.on('SIGTERM', () => {});",
    "process.send?.('ready');",
    'setInterval(() => {}, 1000);'
  ].join(' ');
  const child = spawn(
    process.execPath,
    ['-e', ignoreSigtermScript],
    { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] }
  );
  await once(child, 'message');

  try {
    const terminated = await terminateViceProcess(child, {
      timeoutMs: 25,
      forceKillTimeoutMs: 1000
    });

    assert.equal(terminated, true);
    assert.equal(child.signalCode, 'SIGKILL');
  } finally {
    child.kill('SIGKILL');
  }
});

test('terminateViceProcess can use SIGKILL immediately', async () => {
  const child = spawn(
    process.execPath,
    ['-e', 'setInterval(() => {}, 1000);'],
    { stdio: 'ignore' }
  );
  await once(child, 'spawn');

  try {
    const terminated = await terminateViceProcess(child, {
      signal: 'SIGKILL',
      timeoutMs: 1000
    });

    assert.equal(terminated, true);
    assert.equal(child.signalCode, 'SIGKILL');
  } finally {
    child.kill('SIGKILL');
  }
});

test('resolveViceCommand accepts an absolute executable path', async () => {
  assert.equal(
    await resolveViceCommand('/missing/vice/resources', process.execPath),
    process.execPath
  );
});

test('resolveViceCommand finds an executable under the VICE resources bin directory', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'cc-vice-runtime-'));
  try {
    const executableName = process.platform === 'win32' ? 'x64sc.exe' : 'x64sc';
    const executablePath = path.join(tempRoot, 'bin', executableName);
    await mkdir(path.dirname(executablePath), { recursive: true });
    await cp(process.execPath, executablePath);
    await chmod(executablePath, 0o755);

    assert.equal(
      await resolveViceCommand(tempRoot, 'x64sc'),
      executablePath
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import type { DebugProtocol } from '@vscode/debugprotocol';

import { DapClient } from './e2e/dap-client';
import type { ViceDebugLaunchArguments } from '../vice-debug-session';

const EMBED_EVENT = 'commodoreCommander.viceEmbed';

interface ViceEmbedDebugEvent extends DebugProtocol.Event {
  body?: {
    type?: unknown;
    protocol?: unknown;
    [key: string]: unknown;
  };
}

test('embedded launch uses direct frame transport and reset commands', async (t) => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'cc-vice-embed-dap-'));
  let client: DapClient | undefined;
  const frameServer = net.createServer();

  t.after(async () => {
    await client?.stop();
    frameServer.close();
    await rm(tempRoot, { recursive: true, force: true });
  });

  const fixtureDirectory = path.join(tempRoot, 'fixture');
  const artifactDirectory = path.join(tempRoot, 'artifacts');
  await mkdir(fixtureDirectory, { recursive: true });

  const program = path.join(fixtureDirectory, 'main.prg');
  await writeFile(program, Buffer.from([0x01, 0x08, 0x60]));

  const fakeVice = path.join(tempRoot, 'fake-vice.js');
  await writeFile(fakeVice, fakeViceScript(), 'utf8');
  await chmod(fakeVice, 0o755);
  const frameRecord = waitForFrameRecord(frameServer);
  const framePort = await listenOnLoopback(frameServer);

  client = DapClient.start({
    adapterPath: path.resolve(__dirname, '../vice-debug-adapter.js'),
    artifactDirectory,
    requestTimeoutMs: 5000
  });

  await client.request<DebugProtocol.Capabilities>(
    'initialize',
    {
      adapterID: 'commodore-vice',
      linesStartAt1: true,
      columnsStartAt1: true
    } satisfies DebugProtocol.InitializeRequestArguments
  );

  const initialized = client.waitForEvent('initialized');
  const hello = client.waitForEvent<ViceEmbedDebugEvent>(
    EMBED_EVENT,
    hasEmbedType('hello')
  );

  await Promise.all([
    initialized,
    client.request(
      'launch',
      {
        program,
        cwd: fixtureDirectory,
        viceResourcesPath: tempRoot,
        viceExecutable: fakeVice,
        viceArgs: [],
        viceLaunchMode: 'embedded',
        viceFramePort: framePort,
        noDebug: true,
        machineName: 'Fake embedded VICE'
      } satisfies ViceDebugLaunchArguments
    )
  ]);

  const helloEvent = await hello;
  assert.equal(helloEvent.body?.protocol, 'commodore-vice-embed-v1');

  const record = await frameRecord;
  assert.equal(record.subarray(0, 4).toString('ascii'), 'CCB1');
  assert.equal(record.readUInt16LE(24), 1);
  assert.equal(record.readUInt16LE(26), 1);
  assert.deepEqual([...record.subarray(32, 36)], [0, 0, 0, 255]);

  const resetStatus = client.waitForEvent<ViceEmbedDebugEvent>(
    EMBED_EVENT,
    (event) =>
      event.body?.type === 'status' &&
      event.body.state === 'running' &&
      event.body.message === 'Reset requested.'
  );
  const resetResponse = await client.request<{ sent: boolean }>(
    'commodoreViceEmbedReset'
  );

  assert.equal(resetResponse.sent, true);
  await resetStatus;

  const menuStatus = client.waitForEvent<ViceEmbedDebugEvent>(
    EMBED_EVENT,
    (event) =>
      event.body?.type === 'status' &&
      event.body.state === 'running' &&
      event.body.message === 'Menu requested.'
  );
  const menuResponse = await client.request<{ sent: boolean }>(
    'commodoreViceEmbedMenu'
  );

  assert.equal(menuResponse.sent, true);
  await menuStatus;
});

test('embedded disconnect terminates the VICE process', async (t) => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'cc-vice-embed-dap-'));
  let client: DapClient | undefined;
  const frameServer = net.createServer();
  const previousPidFile = process.env.COMMODORE_COMMANDER_FAKE_VICE_PID_FILE;
  const pidFile = path.join(tempRoot, 'fake-vice.pid');
  process.env.COMMODORE_COMMANDER_FAKE_VICE_PID_FILE = pidFile;

  t.after(async () => {
    if (previousPidFile === undefined) {
      delete process.env.COMMODORE_COMMANDER_FAKE_VICE_PID_FILE;
    } else {
      process.env.COMMODORE_COMMANDER_FAKE_VICE_PID_FILE = previousPidFile;
    }
    await client?.stop();
    frameServer.close();
    await rm(tempRoot, { recursive: true, force: true });
  });

  const fixtureDirectory = path.join(tempRoot, 'fixture');
  const artifactDirectory = path.join(tempRoot, 'artifacts');
  await mkdir(fixtureDirectory, { recursive: true });

  const program = path.join(fixtureDirectory, 'main.prg');
  await writeFile(program, Buffer.from([0x01, 0x08, 0x60]));

  const fakeVice = path.join(tempRoot, 'fake-vice.js');
  await writeFile(fakeVice, fakeViceScript(), 'utf8');
  await chmod(fakeVice, 0o755);
  const frameRecord = waitForFrameRecord(frameServer);
  const framePort = await listenOnLoopback(frameServer);

  client = DapClient.start({
    adapterPath: path.resolve(__dirname, '../vice-debug-adapter.js'),
    artifactDirectory,
    requestTimeoutMs: 5000
  });

  await client.request<DebugProtocol.Capabilities>(
    'initialize',
    {
      adapterID: 'commodore-vice',
      linesStartAt1: true,
      columnsStartAt1: true
    } satisfies DebugProtocol.InitializeRequestArguments
  );

  const initialized = client.waitForEvent('initialized');
  const hello = client.waitForEvent<ViceEmbedDebugEvent>(
    EMBED_EVENT,
    hasEmbedType('hello')
  );

  await Promise.all([
    initialized,
    client.request(
      'launch',
      {
        program,
        cwd: fixtureDirectory,
        viceResourcesPath: tempRoot,
        viceExecutable: fakeVice,
        viceArgs: [],
        viceLaunchMode: 'embedded',
        viceFramePort: framePort,
        noDebug: true,
        machineName: 'Fake embedded VICE'
      } satisfies ViceDebugLaunchArguments
    )
  ]);

  await hello;
  await frameRecord;
  const vicePid = await waitForPidFile(pidFile);
  assert.equal(isProcessAlive(vicePid), true);

  const terminated = client.waitForEvent('terminated');
  await client.request('disconnect', { terminateDebuggee: false });
  await terminated;
  await waitForProcessExit(vicePid);
});

function hasEmbedType(
  type: string
): (event: ViceEmbedDebugEvent) => boolean {
  return (event) => event.body?.type === type;
}

async function listenOnLoopback(server: net.Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Frame server did not bind to a TCP port.'));
        return;
      }
      resolve(address.port);
    });
  });
}

function waitForFrameRecord(server: net.Server): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.once('connection', (socket) => {
      let buffer = Buffer.alloc(0);
      socket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        if (buffer.length >= 36) {
          resolve(buffer.subarray(0, 36));
          socket.destroy();
        }
      });
      socket.once('error', reject);
    });
  });
}

async function waitForPidFile(pidFile: string): Promise<number> {
  const expiresAt = Date.now() + 5000;
  while (Date.now() < expiresAt) {
    try {
      const value = Number.parseInt(await readFile(pidFile, 'utf8'), 10);
      if (Number.isInteger(value) && value > 0) {
        return value;
      }
    } catch {
      // Keep polling until the fake emulator has written its PID.
    }
    await delay(25);
  }
  throw new Error(`Timed out waiting for fake VICE PID file: ${pidFile}`);
}

async function waitForProcessExit(pid: number): Promise<void> {
  const expiresAt = Date.now() + 5000;
  while (Date.now() < expiresAt) {
    if (!isProcessAlive(pid)) {
      return;
    }
    await delay(25);
  }
  throw new Error(`Fake VICE process ${pid} was still running.`);
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH';
  }
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function fakeViceScript(): string {
  return `#!/usr/bin/env node
const fs = require('node:fs');
const net = require('node:net');
const prefix = 'CCV1 ';

if (process.env.COMMODORE_COMMANDER_FAKE_VICE_PID_FILE) {
  fs.writeFileSync(process.env.COMMODORE_COMMANDER_FAKE_VICE_PID_FILE, String(process.pid));
}

function send(event) {
  process.stdout.write(prefix + JSON.stringify(event) + '\\n');
}

if (!process.argv.includes('-cc-embed')) {
  send({ type: 'status', state: 'error', message: 'missing embed flag' });
  process.exit(2);
}
const framePortIndex = process.argv.indexOf('-cc-frame-port');
if (framePortIndex < 0 || !process.argv[framePortIndex + 1]) {
  send({ type: 'status', state: 'error', message: 'missing frame port' });
  process.exit(2);
}

send({
  type: 'hello',
  protocol: 'commodore-vice-embed-v1',
  machine: 'fake-x64sc'
});
const frameSocket = net.createConnection({
  host: '127.0.0.1',
  port: Number(process.argv[framePortIndex + 1])
}, () => {
  sendBinaryFrame(frameSocket, {
    frameId: 1,
    width: 1,
    height: 1,
    timestamp: 1,
    data: Buffer.from([0, 0, 0, 255])
  });
});

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  input += chunk;
  let newlineIndex = input.indexOf('\\n');
  while (newlineIndex >= 0) {
    const line = input.slice(0, newlineIndex).trimEnd();
    input = input.slice(newlineIndex + 1);
    if (line.startsWith(prefix)) {
      const command = JSON.parse(line.slice(prefix.length));
      if (command.type === 'reset') {
        send({
          type: 'status',
          state: 'running',
          message: 'Reset requested.'
        });
      }
      if (command.type === 'menu') {
        send({
          type: 'status',
          state: 'running',
          message: 'Menu requested.'
        });
      }
      if (command.type === 'quit') {
        process.exit(0);
      }
    }
    newlineIndex = input.indexOf('\\n');
  }
});

setInterval(() => {}, 1000);

function sendBinaryFrame(socket, frame) {
  const header = Buffer.alloc(32);
  header.write('CCB1', 0, 'ascii');
  header.writeUInt8(1, 4);
  header.writeUInt8(1, 5);
  header.writeUInt16LE(32, 6);
  header.writeUInt32LE(frame.data.length, 8);
  header.writeUInt32LE(frame.frameId, 12);
  header.writeBigUInt64LE(BigInt(frame.timestamp), 16);
  header.writeUInt16LE(frame.width, 24);
  header.writeUInt16LE(frame.height, 26);
  header.writeUInt32LE(0, 28);
  socket.write(header);
  socket.write(frame.data);
}
`;
}

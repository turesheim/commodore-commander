import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
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

test('patchedView launch forwards embedded VICE frames and reset commands', async (t) => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'cc-vice-embed-dap-'));
  let client: DapClient | undefined;

  t.after(async () => {
    await client?.stop();
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
  const frame = client.waitForEvent<ViceEmbedDebugEvent>(
    EMBED_EVENT,
    hasEmbedType('frame')
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
        viceLaunchMode: 'patchedView',
        noDebug: true,
        machineName: 'Fake embedded VICE'
      } satisfies ViceDebugLaunchArguments
    )
  ]);

  const helloEvent = await hello;
  assert.equal(helloEvent.body?.protocol, 'commodore-vice-embed-v1');

  const frameEvent = await frame;
  assert.equal(frameEvent.body?.width, 1);
  assert.equal(frameEvent.body?.height, 1);
  assert.equal(frameEvent.body?.data, 'AAAA/w==');

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
});

function hasEmbedType(
  type: string
): (event: ViceEmbedDebugEvent) => boolean {
  return (event) => event.body?.type === type;
}

function fakeViceScript(): string {
  return `#!/usr/bin/env node
const prefix = 'CCV1 ';

function send(event) {
  process.stdout.write(prefix + JSON.stringify(event) + '\\n');
}

if (!process.argv.includes('-cc-embed')) {
  send({ type: 'status', state: 'error', message: 'missing embed flag' });
  process.exit(2);
}

send({
  type: 'hello',
  protocol: 'commodore-vice-embed-v1',
  machine: 'fake-x64sc'
});
send({
  type: 'frame',
  frameId: 1,
  width: 1,
  height: 1,
  pixelFormat: 'rgba8888',
  timestamp: 1,
  data: 'AAAA/w=='
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
      if (command.type === 'quit') {
        process.exit(0);
      }
    }
    newlineIndex = input.indexOf('\\n');
  }
});

setInterval(() => {}, 1000);
`;
}

import assert from 'node:assert/strict';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import type {
  CommodoreViceEmbedClient,
  CommodoreViceEmbedFrameEvent,
  CommodoreViceEmbedLaunchRequest,
  CommodoreViceEmbedOutputEvent,
  CommodoreViceEmbedStatusEvent
} from '../common/commodore-vice-embed-service';
import { CommodoreViceEmbedServiceImpl } from '../node/commodore-vice-embed-service-impl';

test('embedded debug frame transport reuses a reserved port', async (t) => {
  const service = new TestViceEmbedService();
  t.after(() => service.dispose());

  const firstPort = await service.reserveFrameTransport();
  const secondPort = await service.reserveFrameTransport();

  assert.equal(secondPort, firstPort);
  assert.equal(service.frameServerStartCount, 1);
});

test('embedded debug frame transport refuses to replace a connected emulator', async (t) => {
  const service = new TestViceEmbedService();
  t.after(() => service.dispose());

  const port = await service.reserveFrameTransport();
  const socket = await connectLoopback(port);
  t.after(() => socket.destroy());
  await waitFor(() => service.hasConnectedFrameSocket());

  await assert.rejects(
    () => service.reserveFrameTransport(),
    /already connected to an emulator/u
  );
  assert.equal(service.frameServerStartCount, 1);
});

test('debug emulator disconnect releases the listener and cached frame before reserving again', { timeout: 5000 }, async (t) => {
  const service = new TestViceEmbedService();
  t.after(() => service.dispose());
  const port = await service.reserveFrameTransport();
  const socket = await connectLoopback(port);
  t.after(() => socket.destroy());
  socket.write(Buffer.from(
    '43434231010120000400000009000000393000000000000001000100070000000a141eff',
    'hex'
  ));
  await waitFor(() => service.hasLatestFrame());
  socket.end();
  await waitFor(() => !service.hasFrameServer());
  assert.equal(service.hasLatestFrame(), false);
  assert.equal(service.hasConnectedFrameSocket(), false);

  await service.reserveFrameTransport();
  assert.equal(service.hasFrameServer(), true);
  assert.equal(service.frameServerStartCount, 2);
});

test('embedded VICE service drops frontend client when the RPC connection closes', () => {
  const service = new TestViceEmbedService();
  const client = new TestViceEmbedClient();
  service.setClient(client);

  service.emitTestStatus({ state: 'running', message: 'before close' });
  client.closeConnection();
  service.emitTestStatus({ state: 'running', message: 'after close' });

  assert.deepEqual(
    client.statuses.map((status) => status.message),
    ['before close']
  );
});

test('standalone emulator forwards frame and reset status, then releases transport on exit', { timeout: 5000 }, async (t) => {
  const service = new TestViceEmbedService();
  const client = new TestViceEmbedClient();
  t.after(() => service.dispose());
  service.setClient(client);
  service.fakeScript = fakeStandaloneScript();

  const launch = await service.launch();
  assert.equal(launch.running, true);
  await waitFor(() => client.statuses.some((event) => event.state === 'running') && service.hasLatestFrame());
  assert.equal(service.hasStandaloneProcess(), true);
  assert.equal(service.hasFrameServer(), true);

  await service.reset();
  await waitFor(() => client.statuses.some((event) => event.message === 'Reset requested.'));
  await waitFor(() => client.statuses.some((event) => event.state === 'stopped'));
  const stopped = client.statuses.find((event) => event.state === 'stopped');
  assert.equal(stopped?.pid, launch.pid);
  assert.equal(stopped?.exitCode, 0);
  assert.equal(service.hasStandaloneProcess(), false);
  assert.equal(service.hasFrameServer(), false);
  assert.equal(service.hasLatestFrame(), false);
});

test('standalone spawn failure reports an error and releases reserved frame transport', { timeout: 5000 }, async (t) => {
  const service = new TestViceEmbedService();
  const client = new TestViceEmbedClient();
  t.after(() => service.dispose());
  service.setClient(client);
  service.fakeCommand = path.join(os.tmpdir(), `cc-missing-vice-${process.pid}-${Date.now()}`, 'vice');

  await service.launch();
  await waitFor(() => client.statuses.some((event) => event.state === 'error'));
  assert.match(client.statuses.find((event) => event.state === 'error')!.message!, /Could not start emulator/u);
  assert.equal(service.hasStandaloneProcess(), false);
  assert.equal(service.hasFrameServer(), false);
});

test('debugger transport takeover releases only the owned standalone process', { timeout: 5000 }, async (t) => {
  const service = new TestViceEmbedService();
  const client = new TestViceEmbedClient();
  t.after(() => service.dispose());
  service.setClient(client);
  await service.launch();
  await waitFor(() => client.statuses.some((event) => event.state === 'running'));

  const port = await service.reserveFrameTransport();
  assert.equal(service.hasStandaloneProcess(), false);
  assert.equal(service.hasFrameServer(), true);
  assert.equal(await service.reserveFrameTransport(), port);
});

test('frontend RPC disconnection retains the owned standalone emulator', { timeout: 5000 }, async (t) => {
  const service = new TestViceEmbedService();
  const client = new TestViceEmbedClient();
  t.after(() => service.dispose());
  service.setClient(client);
  await service.launch();
  await waitFor(() => client.statuses.some((event) => event.state === 'running'));

  client.closeConnection();
  assert.equal(service.hasStandaloneProcess(), true);
  assert.equal(service.hasFrameServer(), true);
  await service.stop();
  assert.equal(service.hasStandaloneProcess(), false);
});

test('standalone stdout fallback keeps logs, JSON frames, and binary validation policy', (t) => {
  const service = new TestViceEmbedService();
  const client = new TestViceEmbedClient();
  t.after(() => service.dispose());
  service.setClient(client);
  const jsonFrame = 'CCV1 {"type":"frame","frameId":1,"width":1,"height":1,"pixelFormat":"rgba8888","data":"ChQe/w==","timestamp":12345}\n';
  const record = Buffer.from('43434231010120000400000009000000393000000000000001000100070000000a141eff', 'hex');
  const stream = Buffer.concat([Buffer.from(`log\nCCV1 broken JSON\n${jsonFrame}prefix`), record]);
  for (const byte of stream) service.emitTestStdout(Buffer.from([byte]));
  assert.deepEqual(client.outputs.map(event => event.text), ['log\n', 'CCV1 broken JSON\n', 'prefix']);
  assert.equal(client.frames[0].frameId, 1);
  assert.deepEqual(service.latestFrame(), record);
  record[5] = 2;
  service.emitTestStdout(record);
  assert.deepEqual(client.statuses.map(event => event.state), ['error', 'error']);
  assert.match(client.statuses[1].message!, /Unsupported VICE binary pixel format/u);
  assert.notDeepEqual(service.latestFrame(), record);
});

test('standalone stop resets partial stdout before the next session', async (t) => {
  const service = new TestViceEmbedService();
  const client = new TestViceEmbedClient();
  t.after(() => service.dispose());
  service.setClient(client);
  service.emitTestStdout(Buffer.from('CCV1 unfinished'));
  await service.stop();
  service.emitTestStdout(Buffer.from('fresh\n'));
  assert.deepEqual(client.outputs, [{ stream: 'stdout', text: 'fresh\n' }]);
});

test('standalone stdout overflow forwards only the existing bounded prefix', (t) => {
  const service = new TestViceEmbedService();
  const client = new TestViceEmbedClient();
  t.after(() => service.dispose());
  service.setClient(client);
  service.emitTestStdout(Buffer.alloc(32 * 1024 * 1024 + 1, 65));
  assert.equal(client.outputs[0].text.length, 32 * 1024 * 1024);
  assert.deepEqual(client.statuses, []);
  service.emitTestStdout(Buffer.from('fresh\n'));
  assert.deepEqual(client.outputs[1], { stream: 'stdout', text: 'fresh\n' });
});

class TestViceEmbedService extends CommodoreViceEmbedServiceImpl {
  frameServerStartCount = 0;
  fakeCommand = process.execPath;
  fakeScript = `
    console.log('CCV1 ' + JSON.stringify({ type: 'hello', protocol: 'commodore-vice-embed-v1' }));
    setInterval(() => {}, 1000);
  `;

  constructor() {
    super();
    Object.assign(this, { logger: { warn: () => {} } });
  }

  hasStandaloneProcess(): boolean {
    return this.standaloneProcess.hasProcess;
  }

  hasFrameServer(): boolean {
    return this.currentViceFrameServerPort() !== undefined;
  }

  hasLatestFrame(): boolean {
    return this.frameBridge.latestFrame !== undefined;
  }

  latestFrame(): Buffer | undefined {
    return this.frameBridge.latestFrame;
  }

  emitTestStdout(chunk: Buffer): void {
    this.handleStdout(chunk);
  }

  protected override async resolveLaunch(_request: CommodoreViceEmbedLaunchRequest, framePort: number) {
    return { command: this.fakeCommand, args: ['-e', this.fakeScript, String(framePort)], cwd: process.cwd() };
  }

  reserveFrameTransport(): Promise<number> {
    return this.startExternalFrameTransport();
  }

  hasConnectedFrameSocket(): boolean {
    return this.viceFrameTransport.connected;
  }

  emitTestStatus(event: CommodoreViceEmbedStatusEvent): void {
    this.emitStatus(event);
  }

  protected override async startViceFrameServer(
    closeWhenSocketCloses: boolean
  ): Promise<number> {
    this.frameServerStartCount += 1;
    return super.startViceFrameServer(closeWhenSocketCloses);
  }
}

class TestViceEmbedClient implements CommodoreViceEmbedClient {
  readonly statuses: CommodoreViceEmbedStatusEvent[] = [];
  readonly frames: CommodoreViceEmbedFrameEvent[] = [];
  readonly outputs: CommodoreViceEmbedOutputEvent[] = [];
  private readonly closeListeners = new Set<() => void>();

  readonly onDidCloseConnection = (listener: () => void): { dispose(): void } => {
    this.closeListeners.add(listener);
    return {
      dispose: () => this.closeListeners.delete(listener)
    };
  };

  onViceEmbedFrame(event: CommodoreViceEmbedFrameEvent): void {
    this.frames.push(event);
  }

  onViceEmbedStatus(event: CommodoreViceEmbedStatusEvent): void {
    this.statuses.push(event);
  }

  onViceEmbedOutput(event: CommodoreViceEmbedOutputEvent): void {
    this.outputs.push(event);
  }

  closeConnection(): void {
    for (const listener of this.closeListeners) {
      listener();
    }
  }
}

function connectLoopback(port: number): Promise<net.Socket> {
  const socket = net.connect({ host: '127.0.0.1', port });
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket));
    socket.once('error', reject);
  });
}

async function waitFor(predicate: () => boolean): Promise<void> {
  const expiresAt = Date.now() + 1000;
  while (Date.now() < expiresAt) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Timed out waiting for condition.');
}

function fakeStandaloneScript(): string {
  return `
    const fs = require('node:fs');
    const net = require('node:net');
    const readline = require('node:readline');
    const socket = net.connect({ host: '127.0.0.1', port: Number(process.argv[1]) }, () => {
      const record = Buffer.alloc(36);
      record.write('CCB1', 0, 'ascii');
      record.writeUInt8(1, 4);
      record.writeUInt8(1, 5);
      record.writeUInt16LE(32, 6);
      record.writeUInt32LE(4, 8);
      record.writeUInt32LE(1, 12);
      record.writeUInt16LE(1, 24);
      record.writeUInt16LE(1, 26);
      record[35] = 255;
      socket.write(record);
      console.log('CCV1 ' + JSON.stringify({ type: 'hello', protocol: 'commodore-vice-embed-v1' }));
    });
    const input = readline.createInterface({ input: fs.createReadStream(null, { fd: 3, autoClose: false }) });
    input.on('line', (line) => {
      if (JSON.parse(line.slice(5)).type === 'reset') {
        const event = { type: 'status', state: 'running', message: 'Reset requested.' };
        process.stdout.write('CCV1 ' + JSON.stringify(event) + '\\n', () => process.exit(0));
      }
    });
  `;
}

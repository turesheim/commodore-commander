import assert from 'node:assert/strict';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import type {
  CommodoreViceEmbedClient,
  CommodoreViceEmbedLaunchRequest,
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
    return this.latestBinaryFrame !== undefined;
  }

  protected override async resolveLaunch(_request: CommodoreViceEmbedLaunchRequest, framePort: number) {
    return { command: this.fakeCommand, args: ['-e', this.fakeScript, String(framePort)], cwd: process.cwd() };
  }

  reserveFrameTransport(): Promise<number> {
    return this.startExternalFrameTransport();
  }

  hasConnectedFrameSocket(): boolean {
    return this.viceFrameSocket !== undefined;
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
  private readonly closeListeners = new Set<() => void>();

  readonly onDidCloseConnection = (listener: () => void): { dispose(): void } => {
    this.closeListeners.add(listener);
    return {
      dispose: () => this.closeListeners.delete(listener)
    };
  };

  onViceEmbedFrame(): void {}

  onViceEmbedStatus(event: CommodoreViceEmbedStatusEvent): void {
    this.statuses.push(event);
  }

  onViceEmbedOutput(): void {}

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

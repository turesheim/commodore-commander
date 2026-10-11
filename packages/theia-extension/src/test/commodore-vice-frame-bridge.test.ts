import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import { test, type TestContext } from 'node:test';
import { WebSocket, WebSocketServer } from 'ws';

import { CommodoreViceEmbedFrameSocketPath } from '../common/commodore-vice-embed-service';
import { CommodoreViceFrameBridge } from '../node/commodore-vice-frame-bridge';

const options = { timeout: 5000 };

async function host(t: TestContext) {
  const warnings: string[] = [];
  const server = http.createServer();
  const bridge = new CommodoreViceFrameBridge(message => warnings.push(message));
  bridge.start(server);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const port = address.port;
  const sockets: WebSocket[] = [];
  t.after(async () => {
    bridge.stop();
    for (const socket of sockets) socket.terminate();
    await new Promise<void>(resolve => server.close(() => resolve()));
  });
  function connect(origin?: string, pathname = CommodoreViceEmbedFrameSocketPath) {
    const socket = new WebSocket(`ws://127.0.0.1:${port}${pathname}`, { origin });
    sockets.push(socket);
    const frame = once(socket, 'message');
    // Rejected upgrades may emit error before a test awaits the frame promise.
    void frame.catch(() => {});
    return { socket, frame };
  }
  return { bridge, server, warnings, port, connect };
}

test('browser bridge replays cached binary frames and retains clients when cache is cleared', options, async t => {
  const { bridge, connect } = await host(t);
  const firstRecord = Buffer.from('first CCB1 record');
  const secondRecord = Buffer.from('second CCB1 record');
  bridge.broadcast(firstRecord);
  const first = connect();
  await once(first.socket, 'open');
  const [cached, binary] = await first.frame;
  assert.deepEqual(cached, firstRecord);
  assert.equal(binary, true);

  bridge.clearFrame();
  assert.equal(bridge.latestFrame, undefined);
  const firstNext = once(first.socket, 'message');
  const second = connect();
  await once(second.socket, 'open');
  bridge.broadcast(secondRecord);
  assert.deepEqual((await firstNext)[0], secondRecord);
  assert.deepEqual((await second.frame)[0], secondRecord);
  assert.deepEqual(bridge.latestFrame, secondRecord);
});

for (const [name, origin] of [
  ['missing origin', (_port: number) => undefined],
  ['same host', (port: number) => `http://127.0.0.1:${port}`],
  ['file origin', (_port: number) => 'file:///app/index.html'],
  ['localhost alias', (port: number) => `http://localhost:${port}`],
  ['IPv6 loopback alias', (port: number) => `http://[::1]:${port}`]
] as const) {
  test(`browser bridge retains origin acceptance for ${name}`, options, async t => {
    const { bridge, port, connect } = await host(t);
    const record = Buffer.from('frame');
    bridge.broadcast(record);
    const client = connect(origin(port));
    await once(client.socket, 'open');
    assert.deepEqual((await client.frame)[0], record);
  });
}

for (const [name, origin] of [
  ['remote host', (port: number) => `http://example.com:${port}`],
  ['different loopback port', (port: number) => `http://localhost:${port === 65535 ? port - 1 : port + 1}`],
  ['invalid origin', (_port: number) => 'not a URL']
] as const) {
  test(`browser bridge rejects ${name} without accepting a socket`, options, async t => {
    const { port, connect } = await host(t);
    const client = connect(origin(port));
    await assert.rejects(once(client.socket, 'open'), /socket hang up/u);
    assert.notEqual(client.socket.readyState, WebSocket.OPEN);
  });
}

test('browser bridge retains prefixed paths and query strings', options, async t => {
  const { bridge, connect } = await host(t);
  bridge.broadcast(Buffer.from('frame'));
  const client = connect(undefined, `/workspace${CommodoreViceEmbedFrameSocketPath}?test=1`);
  await once(client.socket, 'open');
  assert.deepEqual((await client.frame)[0], Buffer.from('frame'));
});

test('browser bridge leaves unrelated upgrades to other backend handlers', options, async t => {
  const { server, connect } = await host(t);
  const other = new WebSocketServer({ noServer: true });
  t.after(() => other.close());
  server.on('upgrade', (request, socket, head) => {
    if (request.url === '/other') {
      other.handleUpgrade(request, socket, head, ws => ws.send('other endpoint'));
    }
  });
  const client = connect(undefined, '/other');
  await once(client.socket, 'open');
  assert.equal((await client.frame)[0].toString(), 'other endpoint');
});

test('browser bridge restart replaces its upgrade listener without losing the cached frame', options, async t => {
  const { bridge, server, connect } = await host(t);
  bridge.broadcast(Buffer.from('frame'));
  bridge.start(server);
  assert.equal(server.listenerCount('upgrade'), 1);
  const client = connect();
  await once(client.socket, 'open');
  assert.deepEqual((await client.frame)[0], Buffer.from('frame'));
});

test('browser bridge stop closes clients and releases listener and cached frame', options, async t => {
  const { bridge, server, connect } = await host(t);
  bridge.broadcast(Buffer.from('frame'));
  const client = connect();
  await once(client.socket, 'open');
  await client.frame;
  const closed = new Promise<void>(resolve => client.socket.once('close', () => resolve()));
  bridge.stop();
  bridge.stop();
  await closed;
  assert.equal(server.listenerCount('upgrade'), 0);
  assert.equal(bridge.latestFrame, undefined);
});

class TestFrameBridge extends CommodoreViceFrameBridge {
  addSocket(socket: FakeFrameSocket): void {
    this.frameSockets.add(socket as unknown as WebSocket);
  }
}

class FakeFrameSocket {
  readyState: number = WebSocket.OPEN;
  bufferedAmount = 0;
  readonly records: Buffer[] = [];
  terminateCount = 0;
  sendError: Error | undefined;

  send(record: Buffer, options: { binary: boolean }, done: (error?: Error) => void): void {
    assert.equal(options.binary, true);
    this.records.push(record);
    done(this.sendError);
  }

  terminate(): void {
    this.terminateCount++;
  }
}

test('browser bridge drops frames for a backed-up client and sends the next frame once writable', () => {
  const bridge = new TestFrameBridge(message => assert.fail(message));
  const socket = new FakeFrameSocket();
  bridge.addSocket(socket);
  socket.bufferedAmount = 1;
  bridge.broadcast(Buffer.from('old'));
  assert.deepEqual(socket.records, []);
  assert.equal(socket.terminateCount, 0);
  socket.bufferedAmount = 0;
  bridge.broadcast(Buffer.from('new'));
  assert.deepEqual(socket.records, [Buffer.from('new')]);
});

test('browser bridge closes and removes clients exceeding the existing 2 MiB bound', () => {
  const warnings: string[] = [];
  const bridge = new TestFrameBridge(message => warnings.push(message));
  const socket = new FakeFrameSocket();
  bridge.addSocket(socket);
  socket.bufferedAmount = 2 * 1024 * 1024 + 1;
  bridge.broadcast(Buffer.from('frame'));
  bridge.broadcast(Buffer.from('next'));
  assert.equal(socket.terminateCount, 1);
  assert.deepEqual(socket.records, []);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /Closing slow VICE frame socket/u);
});

test('browser bridge removes clients when binary send fails', () => {
  const warnings: string[] = [];
  const bridge = new TestFrameBridge(message => warnings.push(message));
  const socket = new FakeFrameSocket();
  bridge.addSocket(socket);
  socket.sendError = new Error('write failed');
  bridge.broadcast(Buffer.from('frame'));
  bridge.broadcast(Buffer.from('next'));
  assert.equal(socket.terminateCount, 1);
  assert.deepEqual(socket.records, [Buffer.from('frame')]);
  assert.deepEqual(warnings, ['VICE frame socket send failed: write failed']);
});

test('browser bridge ignores sockets that are not open', () => {
  const bridge = new TestFrameBridge(message => assert.fail(message));
  const socket = new FakeFrameSocket();
  bridge.addSocket(socket);
  socket.readyState = WebSocket.CLOSING;
  bridge.broadcast(Buffer.from('frame'));
  assert.deepEqual(socket.records, []);
  assert.equal(socket.terminateCount, 0);
});

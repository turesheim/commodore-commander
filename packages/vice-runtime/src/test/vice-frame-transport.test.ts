import assert from 'node:assert/strict';
import { once } from 'node:events';
import net from 'node:net';
import { test } from 'node:test';

import { ViceFrameTransport } from '../vice-frame-transport';
import { frameRecord } from './vice-frame-fixture';

const options = { timeout: 5000 };

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => { resolve = done; });
    return { promise, resolve };
}

function runtime(onFrame: (record: Buffer) => void = () => {}) {
    return new ViceFrameTransport({ onFrame, onError: (error) => assert.fail(error.message) });
}

async function connect(port: number): Promise<net.Socket> {
    const socket = net.connect({ host: '127.0.0.1', port });
    await once(socket, 'connect');
    return socket;
}

test('native frame transport binds loopback and delivers complete records', options, async (t) => {
    const frame = deferred<Buffer>();
    const disconnected = deferred<void>();
    const transport = runtime(frame.resolve);
    t.after(() => transport.stop());
    const port = await transport.start({ onDisconnect: disconnected.resolve });
    assert.equal(transport.port, port);
    assert.equal(transport.connected, false);
    const socket = await connect(port);
    t.after(() => socket.destroy());
    socket.write(frameRecord().subarray(0, 10));
    socket.write(frameRecord().subarray(10));
    assert.deepEqual(await frame.promise, frameRecord());
    assert.equal(transport.connected, true);
    socket.end();
    await disconnected.promise;
    assert.equal(transport.connected, false);
    assert.equal(transport.port, port); // The caller owns the disconnect policy.
});

test('replacing the native socket resets partial bytes and ignores its late close', options, async (t) => {
    const frame = deferred<Buffer>();
    const secondDisconnected = deferred<void>();
    const transport = runtime(frame.resolve);
    let disconnectCount = 0;
    t.after(() => transport.stop());
    const port = await transport.start({ onDisconnect: () => {
        disconnectCount++;
        secondDisconnected.resolve();
    } });
    const first = await connect(port);
    t.after(() => first.destroy());
    // Destroying a socket with unread bytes may reset it rather than send FIN.
    first.on('error', (error: NodeJS.ErrnoException) => assert.equal(error.code, 'ECONNRESET'));
    first.write(frameRecord(1).subarray(0, 20));
    const oldClosed = new Promise<void>((resolve) => first.once('close', () => resolve()));
    const second = await connect(port);
    t.after(() => second.destroy());
    second.write(frameRecord(2));
    assert.deepEqual(await frame.promise, frameRecord(2));
    await oldClosed;
    assert.equal(transport.connected, true);
    assert.equal(disconnectCount, 0);
    assert.equal(transport.port, port);
    second.end();
    await secondDisconnected.promise;
    assert.equal(disconnectCount, 1);
});

test('caller can release the reserved listener on native disconnect', options, async (t) => {
    const disconnected = deferred<void>();
    const transport = runtime();
    t.after(() => transport.stop());
    const port = await transport.start({ onDisconnect: () => {
        transport.stop();
        disconnected.resolve();
    } });
    const socket = await connect(port);
    t.after(() => socket.destroy());
    socket.end();
    await disconnected.promise;
    assert.equal(transport.port, undefined);
    assert.equal(transport.connected, false);
});

test('stop destroys the active socket without notifying disconnect policy', options, async (t) => {
    const frame = deferred<Buffer>();
    const transport = runtime(frame.resolve);
    t.after(() => transport.stop());
    const port = await transport.start({ onDisconnect: () => assert.fail('Explicit stop is caller-owned.') });
    const socket = await connect(port);
    t.after(() => socket.destroy());
    socket.write(frameRecord());
    await frame.promise;
    const closed = once(socket, 'close');
    transport.stop();
    transport.stop();
    await closed;
    assert.equal(transport.port, undefined);
    assert.equal(transport.connected, false);
});

test('stop cancels pending bind and permits a fresh listener', options, async (t) => {
    const transport = runtime();
    t.after(() => transport.stop());
    const pending = transport.start();
    transport.stop();
    await assert.rejects(pending, /closed before binding/u);
    const port = await transport.start();
    assert.equal(transport.port, port);
    const socket = await connect(port);
    t.after(() => socket.destroy());
});

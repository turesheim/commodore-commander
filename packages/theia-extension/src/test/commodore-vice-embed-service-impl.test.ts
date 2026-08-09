import assert from 'node:assert/strict';
import net from 'node:net';
import { test } from 'node:test';

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

class TestViceEmbedService extends CommodoreViceEmbedServiceImpl {
  frameServerStartCount = 0;

  reserveFrameTransport(): Promise<number> {
    return this.startExternalFrameTransport();
  }

  hasConnectedFrameSocket(): boolean {
    return this.viceFrameSocket !== undefined;
  }

  protected override async startViceFrameServer(
    closeWhenSocketCloses: boolean
  ): Promise<number> {
    this.frameServerStartCount += 1;
    return super.startViceFrameServer(closeWhenSocketCloses);
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

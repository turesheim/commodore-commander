import assert from 'node:assert/strict';
import { test } from 'node:test';

import { reconstruct6502CallStack } from '../call-stack6502';

test('reconstruct6502CallStack resolves JSR return addresses from the hardware stack', async () => {
  const stackPage = Buffer.alloc(0x100);
  stackPage[0xfc] = 0x02;
  stackPage[0xfd] = 0x20;
  stackPage[0xfe] = 0x02;
  stackPage[0xff] = 0x10;

  const frames = await reconstruct6502CallStack({
    stackPointer: 0xfb,
    stackPage,
    readMemory: memoryReader(new Map([
      [0x1000, Buffer.from([0x20, 0x00, 0x20])],
      [0x2000, Buffer.from([0x20, 0x00, 0x30])]
    ]))
  });

  assert.deepEqual(frames, [
    {
      stackAddress: 0x01fc,
      callSiteAddress: 0x2000,
      returnAddress: 0x2003,
      targetAddress: 0x3000
    },
    {
      stackAddress: 0x01fe,
      callSiteAddress: 0x1000,
      returnAddress: 0x1003,
      targetAddress: 0x2000
    }
  ]);
});

test('reconstruct6502CallStack skips arbitrary stack bytes above return addresses', async () => {
  const stackPage = Buffer.alloc(0x100);
  stackPage[0xfd] = 0x99;
  stackPage[0xfe] = 0x02;
  stackPage[0xff] = 0x10;

  const frames = await reconstruct6502CallStack({
    stackPointer: 0xfc,
    stackPage,
    readMemory: memoryReader(new Map([
      [0x1000, Buffer.from([0x20, 0x00, 0x20])]
    ]))
  });

  assert.deepEqual(frames, [
    {
      stackAddress: 0x01fe,
      callSiteAddress: 0x1000,
      returnAddress: 0x1003,
      targetAddress: 0x2000
    }
  ]);
});

test('reconstruct6502CallStack ignores return-looking bytes without a matching JSR opcode', async () => {
  const stackPage = Buffer.alloc(0x100);
  stackPage[0xfe] = 0x02;
  stackPage[0xff] = 0x10;

  const frames = await reconstruct6502CallStack({
    stackPointer: 0xfd,
    stackPage,
    readMemory: memoryReader(new Map([
      [0x1000, Buffer.from([0xea, 0xea, 0xea])]
    ]))
  });

  assert.deepEqual(frames, []);
});

function memoryReader(
  memory: ReadonlyMap<number, Buffer>
): (startAddress: number, byteCount: number) => Promise<Buffer> {
  return async (startAddress, byteCount) => {
    const bytes = memory.get(startAddress);
    return bytes?.subarray(0, byteCount) ?? Buffer.alloc(byteCount, 0xea);
  };
}

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  COMMODORE_VICE_EMBED_PROTOCOL
} from '../common/commodore-vice-embed-service';
import {
  getViceEmbedBinaryFrameRecordLength,
  COMMODORE_VICE_EMBED_PROTOCOL_PREFIX,
  encodeViceEmbedCommand,
  parseViceEmbedBinaryFrameRecord,
  parseViceEmbedProtocolLine
} from '../node/commodore-vice-embed-protocol';

test('VICE embed protocol encodes commands as prefixed JSON lines', () => {
  const encoded = encodeViceEmbedCommand({
    type: 'key',
    code: 'KeyA',
    key: 'a',
    keyCode: 65,
    pressed: true,
    repeat: false,
    shift: false,
    ctrl: false,
    alt: false,
    meta: false
  });

  assert.ok(encoded.startsWith(COMMODORE_VICE_EMBED_PROTOCOL_PREFIX));
  assert.ok(encoded.endsWith('\n'));
  assert.deepEqual(
    JSON.parse(encoded.slice(COMMODORE_VICE_EMBED_PROTOCOL_PREFIX.length)),
    {
      type: 'key',
      code: 'KeyA',
      key: 'a',
      keyCode: 65,
      pressed: true,
      repeat: false,
      shift: false,
      ctrl: false,
      alt: false,
      meta: false
    }
  );
});

test('VICE embed protocol parses hello events', () => {
  assert.deepEqual(
    parseViceEmbedProtocolLine(
      `${COMMODORE_VICE_EMBED_PROTOCOL_PREFIX}${JSON.stringify({
        type: 'hello',
        protocol: COMMODORE_VICE_EMBED_PROTOCOL,
        machine: 'sdl'
      })}\n`
    ),
    {
      type: 'hello',
      protocol: COMMODORE_VICE_EMBED_PROTOCOL,
      machine: 'sdl'
    }
  );
});

test('VICE embed protocol parses frame events', () => {
  assert.deepEqual(
    parseViceEmbedProtocolLine(
      `${COMMODORE_VICE_EMBED_PROTOCOL_PREFIX}${JSON.stringify({
        type: 'frame',
        frameId: 7,
        width: 2,
        height: 1,
        pixelFormat: 'rgba8888',
        data: 'AAAA/wAAAP8=',
        timestamp: 1234
      })}\n`
    ),
    {
      type: 'frame',
      frameId: 7,
      width: 2,
      height: 1,
      pixelFormat: 'rgba8888',
      data: 'AAAA/wAAAP8=',
      timestamp: 1234
    }
  );
});

test('VICE embed protocol parses binary frame records', () => {
  const record = createBinaryFrameRecord({
    frameId: 9,
    width: 2,
    height: 1,
    timestamp: 12345,
    data: Buffer.from([0, 0, 0, 255, 255, 255, 255, 255])
  });

  assert.equal(getViceEmbedBinaryFrameRecordLength(record), record.length);
  const frame = parseViceEmbedBinaryFrameRecord(record);
  assert.equal(frame.type, 'frame');
  assert.equal(frame.frameId, 9);
  assert.equal(frame.width, 2);
  assert.equal(frame.height, 1);
  assert.equal(frame.pixelFormat, 'rgba8888');
  assert.equal(frame.timestamp, 12345);
  assert.deepEqual([...frame.data], [0, 0, 0, 255, 255, 255, 255, 255]);
});

test('VICE embed protocol parses status events', () => {
  assert.deepEqual(
    parseViceEmbedProtocolLine(
      `${COMMODORE_VICE_EMBED_PROTOCOL_PREFIX}${JSON.stringify({
        type: 'status',
        state: 'running',
        message: 'Frame transport enabled.',
        pid: 42
      })}\n`
    ),
    {
      type: 'status',
      state: 'running',
      message: 'Frame transport enabled.',
      pid: 42,
      exitCode: undefined,
      signal: undefined
    }
  );
});

test('VICE embed protocol encodes reset commands', () => {
  const encoded = encodeViceEmbedCommand({ type: 'reset' });

  assert.deepEqual(
    JSON.parse(encoded.slice(COMMODORE_VICE_EMBED_PROTOCOL_PREFIX.length)),
    { type: 'reset' }
  );
});

test('VICE embed protocol encodes menu commands', () => {
  const encoded = encodeViceEmbedCommand({ type: 'menu' });

  assert.deepEqual(
    JSON.parse(encoded.slice(COMMODORE_VICE_EMBED_PROTOCOL_PREFIX.length)),
    { type: 'menu' }
  );
});

test('VICE embed protocol encodes mouse commands', () => {
  const encoded = encodeViceEmbedCommand({
    type: 'mouse',
    xRel: 12,
    yRel: -3,
    button: 1,
    pressed: true
  });

  assert.deepEqual(
    JSON.parse(encoded.slice(COMMODORE_VICE_EMBED_PROTOCOL_PREFIX.length)),
    {
      type: 'mouse',
      xRel: 12,
      yRel: -3,
      button: 1,
      pressed: true
    }
  );
});

test('VICE embed protocol ignores non-protocol stdout and unsupported payloads', () => {
  assert.equal(parseViceEmbedProtocolLine('VICE log line\n'), undefined);
  assert.equal(
    parseViceEmbedProtocolLine(
      `${COMMODORE_VICE_EMBED_PROTOCOL_PREFIX}${JSON.stringify({
        type: 'frame',
        frameId: 7,
        width: 2,
        height: 1,
        pixelFormat: 'bgra8888',
        data: 'AAAA/wAAAP8='
      })}\n`
    ),
    undefined
  );
});

function createBinaryFrameRecord(options: {
  readonly frameId: number;
  readonly width: number;
  readonly height: number;
  readonly timestamp: number;
  readonly data: Buffer;
}): Buffer {
  const header = Buffer.alloc(32);
  header.write('CCB1', 0, 'ascii');
  header.writeUInt8(1, 4);
  header.writeUInt8(1, 5);
  header.writeUInt16LE(32, 6);
  header.writeUInt32LE(options.data.length, 8);
  header.writeUInt32LE(options.frameId, 12);
  header.writeBigUInt64LE(BigInt(options.timestamp), 16);
  header.writeUInt16LE(options.width, 24);
  header.writeUInt16LE(options.height, 26);
  header.writeUInt32LE(0, 28);
  return Buffer.concat([header, options.data]);
}

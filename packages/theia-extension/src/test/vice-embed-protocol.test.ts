import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  COMMODORE_VICE_EMBED_PROTOCOL
} from '../common/commodore-vice-embed-service';
import {
  COMMODORE_VICE_EMBED_PROTOCOL_PREFIX,
  encodeViceEmbedCommand,
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

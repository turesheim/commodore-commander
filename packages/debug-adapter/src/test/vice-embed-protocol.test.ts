import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseViceEmbedBinaryFrameRecord } from '../vice-embed-protocol';

test('adapter frame parser preserves its public result without the raw transport record', () => {
  // CCB1, RGBA8888, 32-byte header, one pixel, frame 9, timestamp 12345, flags 7.
  const record = Buffer.from(
    '43434231010120000400000009000000393000000000000001000100070000000a141eff',
    'hex'
  );
  assert.deepEqual(parseViceEmbedBinaryFrameRecord(record), {
    type: 'frame',
    frameId: 9,
    width: 1,
    height: 1,
    pixelFormat: 'rgba8888',
    timestamp: 12345,
    flags: 7,
    data: Buffer.from([10, 20, 30, 255])
  });
});

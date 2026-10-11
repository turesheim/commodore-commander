import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  encodeViceEmbedCommand,
  isViceEmbedProtocolLine,
  parseViceEmbedProtocolLine
} from '../vice-embed-json-codec';

test('CCV1 commands preserve input fields, JSON escaping, and a single line terminator', () => {
  assert.equal(encodeViceEmbedCommand({
    type: 'key', key: '\n"\\', pressed: false, keyCode: 0,
    matrixRow: 7, matrixCol: 1, matrixShift: true, omitted: undefined
  }), 'CCV1 {"type":"key","key":"\\n\\"\\\\","pressed":false,"keyCode":0,"matrixRow":7,"matrixCol":1,"matrixShift":true}\n');
  assert.equal(encodeViceEmbedCommand({ type: 'quit' }), 'CCV1 {"type":"quit"}\n');
});

test('CCV1 line recognition preserves trailing whitespace and requires the exact leading prefix', () => {
  assert.equal(isViceEmbedProtocolLine('CCV1 {"type":"status"}\r\n '), true);
  assert.equal(isViceEmbedProtocolLine('CCV1 broken JSON\n'), true);
  for (const line of [' CCV1 {}\n', 'CCV1\n', 'CCV2 {}\n', 'VICE log\n', '']) {
    assert.equal(isViceEmbedProtocolLine(line), false);
    assert.equal(parseViceEmbedProtocolLine(line), undefined);
  }
});

test('CCV1 accepts only the supported hello version and preserves extra hello fields', () => {
  const payload = { type: 'hello', protocol: 'commodore-vice-embed-v1', machine: 'sdl', extra: 42 };
  assert.deepEqual(parseViceEmbedProtocolLine(`CCV1 ${JSON.stringify(payload)}\r\n `), payload);
  for (const protocol of [undefined, null, 1, 'commodore-vice-embed-v2']) {
    assert.equal(parseViceEmbedProtocolLine(`CCV1 ${JSON.stringify({ type: 'hello', protocol })}\n`), undefined);
  }
});

test('CCV1 leaves frame and status fields to consumer validation', () => {
  for (const payload of [
    { type: 'frame', frameId: 'invalid', pixelFormat: 'future-format', extra: { value: 1 } },
    { type: 'status', state: 'future-state', pid: null, extra: true }
  ]) {
    assert.deepEqual(parseViceEmbedProtocolLine(`CCV1 ${JSON.stringify(payload)}\n`), payload);
  }
});

test('CCV1 ignores primitives, arrays, and unsupported event types', () => {
  for (const payload of [null, true, 12, 'hello', [], {}, { type: 'output' }, { type: 1 }]) {
    assert.equal(parseViceEmbedProtocolLine(`CCV1 ${JSON.stringify(payload)}\n`), undefined);
  }
});

test('CCV1 malformed prefixed JSON still throws while ordinary malformed output is ignored', () => {
  for (const line of ['CCV1 broken JSON\n', 'CCV1 {\n']) {
    assert.throws(() => parseViceEmbedProtocolLine(line), SyntaxError);
  }
  assert.equal(parseViceEmbedProtocolLine('broken JSON\n'), undefined);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ViceEmbeddedStdoutDecoder } from '../vice-embedded-stdout-decoder';
import { frameRecord } from './vice-frame-fixture';

function capture() {
    const events: Array<{ type: string; value: string | Buffer }> = [];
    const overflows: Array<{ buffer: Buffer; limit: number }> = [];
    const decoder = new ViceEmbeddedStdoutDecoder({
        onLine: (value) => events.push({ type: 'line', value }),
        onText: (value) => events.push({ type: 'text', value }),
        onBinaryFrame: (value) => events.push({ type: 'frame', value }),
        onInvalidFrame: (error) => events.push({ type: 'error', value: error.message }),
        onOverflow: (buffer, limit) => overflows.push({ buffer, limit })
    });
    return { decoder, events, overflows };
}

test('stdout decoder preserves text, opaque protocol lines, and binary ordering', () => {
    const { decoder, events } = capture();
    const line = 'CCV1 {"type":"hello"}\n';
    const record = frameRecord(); // The first pixel byte is a newline.
    decoder.accept(Buffer.concat([Buffer.from(`log\n${line}prefix`), record, Buffer.from('tail\n')]));
    assert.deepEqual(events, [
        { type: 'line', value: 'log\n' },
        { type: 'line', value: line },
        { type: 'text', value: 'prefix' },
        { type: 'frame', value: record },
        { type: 'line', value: 'tail\n' }
    ]);
});

test('stdout decoder retains split UTF-8 text, binary magic, header, and payload', () => {
    const { decoder, events } = capture();
    const record = frameRecord();
    const stream = Buffer.concat([Buffer.from('blåbær\nprefix'), record, Buffer.from('CCV1 broken JSON\n')]);
    for (const byte of stream) {
        decoder.accept(Buffer.from([byte]));
    }
    assert.deepEqual(events, [
        { type: 'line', value: 'blåbær\n' },
        { type: 'text', value: 'prefix' },
        { type: 'frame', value: record },
        { type: 'line', value: 'CCV1 broken JSON\n' }
    ]);
});

test('stdout decoder owns buffered chunks while awaiting a complete frame', () => {
    const { decoder, events } = capture();
    const record = frameRecord();
    const first = Buffer.from(record.subarray(0, 35));
    decoder.accept(first);
    first.fill(0);
    assert.deepEqual(events, []);
    decoder.accept(record.subarray(35));
    assert.deepEqual(events, [{ type: 'frame', value: record }]);
});

test('stdout decoder respects extended native headers without validating consumer frame semantics', () => {
    const { decoder, events } = capture();
    const header = Buffer.alloc(40);
    frameRecord().copy(header, 0, 0, 32);
    header.writeUInt16LE(40, 6);
    header.writeUInt8(2, 5); // Theia rejects this; DAP discards binary frames.
    const record = Buffer.concat([header, Buffer.from([10, 20, 30, 255])]);
    decoder.accept(record);
    assert.deepEqual(events, [{ type: 'frame', value: record }]);
});

test('stdout decoder reports invalid record length and recovers the following record', () => {
    const { decoder, events } = capture();
    const broken = frameRecord();
    broken.writeUInt16LE(16, 6);
    decoder.accept(Buffer.concat([broken, frameRecord(2)]));
    assert.deepEqual(events[0], { type: 'error', value: 'Invalid VICE binary frame header length: 16.' });
    assert.deepEqual(events.at(-1), { type: 'frame', value: frameRecord(2) });
});

test('stdout decoder delegates overflow output policy and accepts subsequent lines', () => {
    const { decoder, events, overflows } = capture();
    decoder.accept(Buffer.alloc(32 * 1024 * 1024 + 1, 65));
    assert.equal(overflows.length, 1);
    assert.equal(overflows[0].limit, 32 * 1024 * 1024);
    assert.equal(overflows[0].buffer.length, overflows[0].limit + 1);
    assert.deepEqual(events, []);
    decoder.accept(Buffer.from('next\n'));
    assert.deepEqual(events, [{ type: 'line', value: 'next\n' }]);
});

test('stdout decoder reset discards partial lines and binary records', () => {
    const { decoder, events } = capture();
    decoder.accept(Buffer.from('unfinished'));
    decoder.reset();
    decoder.accept(frameRecord().subarray(0, 20));
    decoder.reset();
    decoder.accept(Buffer.from('fresh\n'));
    assert.deepEqual(events, [{ type: 'line', value: 'fresh\n' }]);
});

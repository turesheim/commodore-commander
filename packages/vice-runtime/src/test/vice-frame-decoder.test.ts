import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseViceEmbedBinaryFrameRecord } from '../vice-binary-frame';
import { ViceFrameDecoder } from '../vice-frame-decoder';
import { frameRecord } from './vice-frame-fixture';

function capture() {
    const frames: Buffer[] = [];
    const errors: string[] = [];
    const decoder = new ViceFrameDecoder({
        onFrame: (record) => frames.push(record),
        onError: (error) => errors.push(error.message)
    });
    return { frames, errors, decoder };
}

test('CCB1 decoding preserves metadata and record boundaries', () => {
    const record = frameRecord(9);
    const frame = parseViceEmbedBinaryFrameRecord(Buffer.concat([record, Buffer.from('trailing')]));
    assert.deepEqual(frame, {
        type: 'frame', frameId: 9, width: 1, height: 1, pixelFormat: 'rgba8888',
        timestamp: 12345, flags: 7, data: Buffer.from([10, 20, 30, 255]), record
    });
    assert.throws(() => parseViceEmbedBinaryFrameRecord(record.subarray(0, 35)), /Incomplete.*payload/u);
});

test('frame decoder reassembles magic, header, and payload across byte-sized chunks', () => {
    const { decoder, frames, errors } = capture();
    const record = frameRecord();
    for (let index = 0; index < record.length; index++) {
        decoder.accept(record.subarray(index, index + 1));
        assert.equal(frames.length, index === record.length - 1 ? 1 : 0);
    }
    assert.deepEqual(frames, [record]);
    assert.deepEqual(errors, []);
});

test('frame decoder reads multiple records in one chunk', () => {
    const { decoder, frames } = capture();
    decoder.accept(Buffer.concat([frameRecord(1), frameRecord(2)]));
    assert.deepEqual(frames, [frameRecord(1), frameRecord(2)]);
});

test('frame decoder resynchronizes after garbage and retains partial magic', () => {
    const { decoder, frames, errors } = capture();
    decoder.accept(Buffer.from('unrelated bytesCC'));
    decoder.accept(frameRecord().subarray(2));
    assert.deepEqual(frames, [frameRecord()]);
    assert.deepEqual(errors, []);
});

for (const [description, damage] of [
    ['short header', (record: Buffer) => record.writeUInt16LE(16, 6)],
    ['oversized payload', (record: Buffer) => record.writeUInt32LE(2048 * 2048 * 4 + 1, 8)],
    ['unsupported type', (record: Buffer) => record.writeUInt8(2, 4)],
    ['unsupported pixel format', (record: Buffer) => record.writeUInt8(2, 5)],
    ['mismatched pixel dimensions', (record: Buffer) => record.writeUInt16LE(2, 24)]
] as const) {
    test(`frame decoder rejects ${description} and recovers the following record`, () => {
        const { decoder, frames, errors } = capture();
        const broken = frameRecord();
        damage(broken);
        decoder.accept(Buffer.concat([broken, frameRecord(2)]));
        assert.equal(errors.length, 1);
        assert.match(errors[0], /Invalid patched VICE binary frame/u);
        assert.deepEqual(frames, [frameRecord(2)]);
    });
}

test('frame decoder clears partial data on reset', () => {
    const { decoder, frames, errors } = capture();
    decoder.accept(frameRecord(1).subarray(0, 20));
    decoder.reset();
    decoder.accept(frameRecord(2));
    assert.deepEqual(frames, [frameRecord(2)]);
    assert.deepEqual(errors, []);
});

test('frame decoder discards an overflowing buffer and accepts a later record', () => {
    const { decoder, frames, errors } = capture();
    decoder.accept(Buffer.alloc(32 * 1024 * 1024 + 1));
    assert.deepEqual(errors, ['Patched VICE frame transport buffer was too large.']);
    decoder.accept(frameRecord());
    assert.deepEqual(frames, [frameRecord()]);
});

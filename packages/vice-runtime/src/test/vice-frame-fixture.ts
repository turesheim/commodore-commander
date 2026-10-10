/** Native CCB1 header followed by one RGBA8888 pixel. */
export function frameRecord(frameId = 1): Buffer {
    const record = Buffer.alloc(36);
    record.write('CCB1', 0, 'ascii');
    record.writeUInt8(1, 4);
    record.writeUInt8(1, 5);
    record.writeUInt16LE(32, 6);
    record.writeUInt32LE(4, 8);
    record.writeUInt32LE(frameId, 12);
    record.writeBigUInt64LE(12345n, 16);
    record.writeUInt16LE(1, 24);
    record.writeUInt16LE(1, 26);
    record.writeUInt32LE(7, 28);
    record.set([10, 20, 30, 255], 32);
    return record;
}

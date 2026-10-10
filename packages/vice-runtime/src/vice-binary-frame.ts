export const COMMODORE_VICE_EMBED_BINARY_FRAME_MAGIC = Buffer.from('CCB1', 'ascii');
export const COMMODORE_VICE_EMBED_BINARY_FRAME_HEADER_BYTES = 32;

const COMMODORE_VICE_EMBED_BINARY_FRAME_TYPE_RGBA8888 = 1;
const COMMODORE_VICE_EMBED_BINARY_PIXEL_FORMAT_RGBA8888 = 1;
const COMMODORE_VICE_EMBED_MAX_FRAME_PAYLOAD_BYTES = 2048 * 2048 * 4;

export interface ViceEmbedBinaryFrame {
    readonly type: 'frame';
    readonly frameId: number;
    readonly width: number;
    readonly height: number;
    readonly pixelFormat: 'rgba8888';
    readonly timestamp: number;
    readonly flags: number;
    readonly data: Buffer;
    readonly record: Buffer;
}

export function getViceEmbedBinaryFrameRecordLength(buffer: Buffer): number | undefined {
    if (!startsWithViceEmbedBinaryFrame(buffer)) {
        return undefined;
    }
    if (buffer.length < COMMODORE_VICE_EMBED_BINARY_FRAME_HEADER_BYTES) {
        return undefined;
    }

    const headerLength = buffer.readUInt16LE(6);
    const payloadLength = buffer.readUInt32LE(8);
    validateViceEmbedBinaryFrameLengths(headerLength, payloadLength);
    return headerLength + payloadLength;
}

export function startsWithViceEmbedBinaryFrame(buffer: Buffer): boolean {
    return buffer.length >= COMMODORE_VICE_EMBED_BINARY_FRAME_MAGIC.length &&
        buffer.subarray(0, COMMODORE_VICE_EMBED_BINARY_FRAME_MAGIC.length)
            .equals(COMMODORE_VICE_EMBED_BINARY_FRAME_MAGIC);
}

export function parseViceEmbedBinaryFrameRecord(record: Buffer): ViceEmbedBinaryFrame {
    if (!startsWithViceEmbedBinaryFrame(record)) {
        throw new Error('Missing VICE binary frame magic.');
    }
    if (record.length < COMMODORE_VICE_EMBED_BINARY_FRAME_HEADER_BYTES) {
        throw new Error('Incomplete VICE binary frame header.');
    }

    const frameType = record.readUInt8(4);
    const pixelFormat = record.readUInt8(5);
    const headerLength = record.readUInt16LE(6);
    const payloadLength = record.readUInt32LE(8);
    validateViceEmbedBinaryFrameLengths(headerLength, payloadLength);

    const recordLength = headerLength + payloadLength;
    if (record.length < recordLength) {
        throw new Error('Incomplete VICE binary frame payload.');
    }
    if (frameType !== COMMODORE_VICE_EMBED_BINARY_FRAME_TYPE_RGBA8888) {
        throw new Error(`Unsupported VICE binary frame type: ${frameType}.`);
    }
    if (pixelFormat !== COMMODORE_VICE_EMBED_BINARY_PIXEL_FORMAT_RGBA8888) {
        throw new Error(`Unsupported VICE binary pixel format: ${pixelFormat}.`);
    }

    const frameId = record.readUInt32LE(12);
    const timestamp = Number(record.readBigUInt64LE(16));
    const width = record.readUInt16LE(24);
    const height = record.readUInt16LE(26);
    const flags = record.readUInt32LE(28);
    const expectedPayloadLength = width * height * 4;
    if (payloadLength !== expectedPayloadLength) {
        throw new Error(
            `Invalid VICE binary frame size: ${payloadLength}/${expectedPayloadLength}.`
        );
    }

    return {
        type: 'frame',
        frameId,
        width,
        height,
        pixelFormat: 'rgba8888',
        timestamp,
        flags,
        data: record.subarray(headerLength, recordLength),
        record: record.subarray(0, recordLength)
    };
}

function validateViceEmbedBinaryFrameLengths(headerLength: number, payloadLength: number): void {
    if (headerLength < COMMODORE_VICE_EMBED_BINARY_FRAME_HEADER_BYTES) {
        throw new Error(`Invalid VICE binary frame header length: ${headerLength}.`);
    }
    if (payloadLength > COMMODORE_VICE_EMBED_MAX_FRAME_PAYLOAD_BYTES) {
        throw new Error(`VICE binary frame payload too large: ${payloadLength}.`);
    }
}

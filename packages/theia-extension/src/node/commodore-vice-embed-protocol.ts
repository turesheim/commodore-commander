import {
    COMMODORE_VICE_EMBED_PROTOCOL,
    type CommodoreViceEmbedJoystickEvent,
    type CommodoreViceEmbedKeyEvent,
    type CommodoreViceEmbedMouseEvent,
    type CommodoreViceEmbedProtocolEvent,
    type CommodoreViceEmbedResizeEvent,
    type CommodoreViceEmbedStatusEvent,
} from '../common/commodore-vice-embed-service';

export const COMMODORE_VICE_EMBED_PROTOCOL_PREFIX = 'CCV1 ';
export const COMMODORE_VICE_EMBED_BINARY_FRAME_MAGIC = Buffer.from('CCB1', 'ascii');
export const COMMODORE_VICE_EMBED_BINARY_FRAME_HEADER_BYTES = 32;

const COMMODORE_VICE_EMBED_BINARY_FRAME_TYPE_RGBA8888 = 1;
const COMMODORE_VICE_EMBED_BINARY_PIXEL_FORMAT_RGBA8888 = 1;
const COMMODORE_VICE_EMBED_MAX_FRAME_PAYLOAD_BYTES = 2048 * 2048 * 4;

export interface CommodoreViceEmbedBinaryFrame {
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

export type CommodoreViceEmbedCommand =
    | ({ readonly type: 'key' } & CommodoreViceEmbedKeyEvent)
    | ({ readonly type: 'mouse' } & CommodoreViceEmbedMouseEvent)
    | ({ readonly type: 'joystick' } & CommodoreViceEmbedJoystickEvent)
    | ({ readonly type: 'resize' } & CommodoreViceEmbedResizeEvent)
    | { readonly type: 'menu' }
    | { readonly type: 'reset' }
    | { readonly type: 'quit' };

export function encodeViceEmbedCommand(command: CommodoreViceEmbedCommand): string {
    return `${COMMODORE_VICE_EMBED_PROTOCOL_PREFIX}${JSON.stringify(command)}\n`;
}

export function parseViceEmbedProtocolLine(line: string): CommodoreViceEmbedProtocolEvent | undefined {
    const trimmedLine = line.trimEnd();
    if (!trimmedLine.startsWith(COMMODORE_VICE_EMBED_PROTOCOL_PREFIX)) {
        return undefined;
    }

    const payload = JSON.parse(trimmedLine.slice(COMMODORE_VICE_EMBED_PROTOCOL_PREFIX.length));
    if (!payload || typeof payload !== 'object') {
        return undefined;
    }

    switch (payload.type) {
        case 'hello':
            if (payload.protocol !== COMMODORE_VICE_EMBED_PROTOCOL) {
                return undefined;
            }
            return {
                type: 'hello',
                protocol: COMMODORE_VICE_EMBED_PROTOCOL,
                machine: typeof payload.machine === 'string' ? payload.machine : undefined
            };
        case 'frame':
            if (
                !Number.isFinite(payload.frameId) ||
                !Number.isFinite(payload.width) ||
                !Number.isFinite(payload.height) ||
                payload.pixelFormat !== 'rgba8888' ||
                typeof payload.data !== 'string'
            ) {
                return undefined;
            }
            return {
                type: 'frame',
                frameId: payload.frameId,
                width: payload.width,
                height: payload.height,
                pixelFormat: 'rgba8888',
                data: payload.data,
                timestamp: Number.isFinite(payload.timestamp) ? payload.timestamp : Date.now()
            };
        case 'status':
            if (!isStatusState(payload.state)) {
                return undefined;
            }
            return {
                type: 'status',
                state: payload.state,
                message: typeof payload.message === 'string' ? payload.message : undefined,
                pid: Number.isFinite(payload.pid) ? payload.pid : undefined,
                exitCode: Number.isFinite(payload.exitCode) || payload.exitCode === null ? payload.exitCode : undefined,
                signal: typeof payload.signal === 'string' || payload.signal === null ? payload.signal : undefined
            };
        default:
            return undefined;
    }
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

export function parseViceEmbedBinaryFrameRecord(record: Buffer): CommodoreViceEmbedBinaryFrame {
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

function isStatusState(value: unknown): value is CommodoreViceEmbedStatusEvent['state'] {
    return value === 'idle' ||
        value === 'starting' ||
        value === 'running' ||
        value === 'stopped' ||
        value === 'error';
}

import {
    encodeViceEmbedCommand as encodeRuntimeCommand,
    parseViceEmbedProtocolLine as parseRuntimeProtocolLine
} from '@commodore-commander/vice-runtime';
import {
    COMMODORE_VICE_EMBED_PROTOCOL,
    type CommodoreViceEmbedJoystickEvent,
    type CommodoreViceEmbedKeyEvent,
    type CommodoreViceEmbedMouseEvent,
    type CommodoreViceEmbedProtocolEvent,
    type CommodoreViceEmbedResizeEvent,
    type CommodoreViceEmbedStatusEvent,
} from '../common/commodore-vice-embed-service';

export {
    COMMODORE_VICE_EMBED_PROTOCOL_PREFIX,
    COMMODORE_VICE_EMBED_BINARY_FRAME_MAGIC,
    COMMODORE_VICE_EMBED_BINARY_FRAME_HEADER_BYTES,
    getViceEmbedBinaryFrameRecordLength,
    startsWithViceEmbedBinaryFrame,
    parseViceEmbedBinaryFrameRecord,
    type ViceEmbedBinaryFrame as CommodoreViceEmbedBinaryFrame
} from '@commodore-commander/vice-runtime';

export type CommodoreViceEmbedCommand =
    | ({ readonly type: 'key' } & CommodoreViceEmbedKeyEvent)
    | ({ readonly type: 'mouse' } & CommodoreViceEmbedMouseEvent)
    | ({ readonly type: 'joystick' } & CommodoreViceEmbedJoystickEvent)
    | ({ readonly type: 'resize' } & CommodoreViceEmbedResizeEvent)
    | { readonly type: 'menu' }
    | { readonly type: 'reset' }
    | { readonly type: 'quit' };

export function encodeViceEmbedCommand(command: CommodoreViceEmbedCommand): string {
    return encodeRuntimeCommand(command);
}

export function parseViceEmbedProtocolLine(line: string): CommodoreViceEmbedProtocolEvent | undefined {
    const payload = parseRuntimeProtocolLine(line);
    if (!payload) {
        return undefined;
    }

    switch (payload.type) {
        case 'hello':
            return {
                type: 'hello',
                protocol: COMMODORE_VICE_EMBED_PROTOCOL,
                machine: typeof payload.machine === 'string' ? payload.machine : undefined
            };
        case 'frame':
            if (
                !isFiniteNumber(payload.frameId) ||
                !isFiniteNumber(payload.width) ||
                !isFiniteNumber(payload.height) ||
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
                timestamp: isFiniteNumber(payload.timestamp) ? payload.timestamp : Date.now()
            };
        case 'status':
            if (!isStatusState(payload.state)) {
                return undefined;
            }
            return {
                type: 'status',
                state: payload.state,
                message: typeof payload.message === 'string' ? payload.message : undefined,
                pid: isFiniteNumber(payload.pid) ? payload.pid : undefined,
                exitCode: isFiniteNumber(payload.exitCode) || payload.exitCode === null ? payload.exitCode : undefined,
                signal: typeof payload.signal === 'string' || payload.signal === null ? payload.signal : undefined
            };
        default:
            return undefined;
    }
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function isStatusState(value: unknown): value is CommodoreViceEmbedStatusEvent['state'] {
    return value === 'idle' ||
        value === 'starting' ||
        value === 'running' ||
        value === 'stopped' ||
        value === 'error';
}

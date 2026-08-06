import {
    COMMODORE_VICE_EMBED_PROTOCOL,
    type CommodoreViceEmbedJoystickEvent,
    type CommodoreViceEmbedKeyEvent,
    type CommodoreViceEmbedProtocolEvent,
    type CommodoreViceEmbedResizeEvent,
    type CommodoreViceEmbedStatusEvent,
} from '../common/commodore-vice-embed-service';

export const COMMODORE_VICE_EMBED_PROTOCOL_PREFIX = 'CCV1 ';

export type CommodoreViceEmbedCommand =
    | ({ readonly type: 'key' } & CommodoreViceEmbedKeyEvent)
    | ({ readonly type: 'joystick' } & CommodoreViceEmbedJoystickEvent)
    | ({ readonly type: 'resize' } & CommodoreViceEmbedResizeEvent)
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

function isStatusState(value: unknown): value is CommodoreViceEmbedStatusEvent['state'] {
    return value === 'idle' ||
        value === 'starting' ||
        value === 'running' ||
        value === 'stopped' ||
        value === 'error';
}

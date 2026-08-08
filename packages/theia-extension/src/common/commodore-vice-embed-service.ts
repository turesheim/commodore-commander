import type { RpcServer } from '@theia/core/lib/common/messaging/proxy-factory';
import type { CommodoreMachineLaunchConfiguration } from '@commodore-commander/language-support/runtime';

export const CommodoreViceEmbedServicePath = '/services/commodore-commander/vice-embed';
export const CommodoreViceEmbedService = Symbol('CommodoreViceEmbedService');
export const CommodoreViceEmbedFrameSocketPath = '/services/commodore-commander/vice-embed/frames';

export const COMMODORE_VICE_EMBED_PROTOCOL = 'commodore-vice-embed-v1';
export type CommodoreViceEmbedProtocol = typeof COMMODORE_VICE_EMBED_PROTOCOL;
export const COMMODORE_VICE_EMBED_DEBUG_EVENT =
    'commodoreCommander.viceEmbed';

export type CommodoreViceEmbedPixelFormat = 'rgba8888';

export type CommodoreViceEmbedStatusState =
    | 'idle'
    | 'starting'
    | 'running'
    | 'stopped'
    | 'error';

export interface CommodoreViceEmbedLaunchRequest {
    readonly executable?: string;
    readonly args?: readonly string[];
    readonly cwd?: string;
    readonly program?: string;
    readonly machine?: CommodoreMachineLaunchConfiguration;
}

export interface CommodoreViceEmbedLaunchResult {
    readonly running: boolean;
    readonly pid?: number;
    readonly command: string;
    readonly args: readonly string[];
    readonly cwd: string;
    readonly protocol: CommodoreViceEmbedProtocol;
}

export interface CommodoreViceEmbedFrameEvent {
    readonly frameId: number;
    readonly width: number;
    readonly height: number;
    readonly pixelFormat: CommodoreViceEmbedPixelFormat;
    readonly data: string;
    readonly timestamp: number;
}

export interface CommodoreViceEmbedStatusEvent {
    readonly state: CommodoreViceEmbedStatusState;
    readonly message?: string;
    readonly pid?: number;
    readonly exitCode?: number | null;
    readonly signal?: string | null;
}

export interface CommodoreViceEmbedOutputEvent {
    readonly stream: 'stdout' | 'stderr';
    readonly text: string;
}

export interface CommodoreViceEmbedHelloEvent {
    readonly type: 'hello';
    readonly protocol: CommodoreViceEmbedProtocol;
    readonly machine?: string;
}

export type CommodoreViceEmbedProtocolEvent =
    | CommodoreViceEmbedHelloEvent
    | ({ readonly type: 'frame' } & CommodoreViceEmbedFrameEvent)
    | ({ readonly type: 'status' } & CommodoreViceEmbedStatusEvent);

export type CommodoreViceEmbedDebugEvent =
    | ({ readonly protocol: CommodoreViceEmbedProtocol } & CommodoreViceEmbedProtocolEvent)
    | ({ readonly protocol: CommodoreViceEmbedProtocol; readonly type: 'output' } & CommodoreViceEmbedOutputEvent);

export interface CommodoreViceEmbedKeyEvent {
    readonly code: string;
    readonly key: string;
    readonly keyCode: number;
    /** SDL keysym for VICE. 0 explicitly suppresses legacy keyCode fallback. */
    readonly sdlKeyCode?: number;
    /** C64 keyboard matrix row for keys needing matrix-aware SDL fallback handling. */
    readonly matrixRow?: number;
    /** C64 keyboard matrix column for keys needing matrix-aware SDL fallback handling. */
    readonly matrixCol?: number;
    /** Inject the C64 shift key while applying the matrix-aware fallback key. */
    readonly matrixShift?: boolean;
    readonly pressed: boolean;
    readonly repeat?: boolean;
    readonly shift?: boolean;
    readonly ctrl?: boolean;
    readonly alt?: boolean;
    readonly meta?: boolean;
    readonly sdlShift?: boolean;
    readonly sdlCtrl?: boolean;
    readonly sdlAlt?: boolean;
}

export interface CommodoreViceEmbedJoystickEvent {
    readonly port: 1 | 2;
    readonly mask: number;
}

export interface CommodoreViceEmbedMouseEvent {
    readonly xRel: number;
    readonly yRel: number;
    readonly button?: number;
    readonly pressed?: boolean;
}

export interface CommodoreViceEmbedResizeEvent {
    readonly width: number;
    readonly height: number;
}

export interface CommodoreViceEmbedClient {
    onViceEmbedFrame(event: CommodoreViceEmbedFrameEvent): void;
    onViceEmbedStatus(event: CommodoreViceEmbedStatusEvent): void;
    onViceEmbedOutput(event: CommodoreViceEmbedOutputEvent): void;
}

export interface CommodoreViceEmbedService extends RpcServer<CommodoreViceEmbedClient> {
    launch(request?: CommodoreViceEmbedLaunchRequest): Promise<CommodoreViceEmbedLaunchResult>;
    stop(): Promise<void>;
    reset(): Promise<void>;
    openMenu(): Promise<void>;
    sendKey(event: CommodoreViceEmbedKeyEvent): Promise<void>;
    sendMouse(event: CommodoreViceEmbedMouseEvent): Promise<void>;
    sendJoystick(event: CommodoreViceEmbedJoystickEvent): Promise<void>;
    resize(event: CommodoreViceEmbedResizeEvent): Promise<void>;
}

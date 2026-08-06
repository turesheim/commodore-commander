import type { RpcServer } from '@theia/core/lib/common/messaging/proxy-factory';

export const CommodoreViceEmbedServicePath = '/services/commodore-commander/vice-embed';
export const CommodoreViceEmbedService = Symbol('CommodoreViceEmbedService');

export const COMMODORE_VICE_EMBED_PROTOCOL = 'commodore-vice-embed-v1';
export type CommodoreViceEmbedProtocol = typeof COMMODORE_VICE_EMBED_PROTOCOL;

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

export interface CommodoreViceEmbedKeyEvent {
    readonly code: string;
    readonly key: string;
    readonly keyCode: number;
    readonly pressed: boolean;
    readonly repeat?: boolean;
    readonly shift?: boolean;
    readonly ctrl?: boolean;
    readonly alt?: boolean;
    readonly meta?: boolean;
}

export interface CommodoreViceEmbedJoystickEvent {
    readonly port: 1 | 2;
    readonly mask: number;
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
    sendKey(event: CommodoreViceEmbedKeyEvent): Promise<void>;
    sendJoystick(event: CommodoreViceEmbedJoystickEvent): Promise<void>;
    resize(event: CommodoreViceEmbedResizeEvent): Promise<void>;
}

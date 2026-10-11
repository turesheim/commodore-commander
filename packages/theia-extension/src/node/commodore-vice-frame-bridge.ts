import type * as http from 'node:http';
import type * as https from 'node:https';
import type { Socket } from 'node:net';
import { WebSocket, WebSocketServer } from 'ws';

import { CommodoreViceEmbedFrameSocketPath } from '../common/commodore-vice-embed-service';

const MIN_FRAME_SOCKET_BACKPRESSURE_BYTES = 256 * 1024;
const MAX_FRAME_SOCKET_BUFFERED_BYTES = 2 * 1024 * 1024;

/** Browser-facing transport. Emulator process/session ownership stays outside. */
export class CommodoreViceFrameBridge {
    private frameSocketServer: WebSocketServer | undefined;
    protected readonly frameSockets = new Set<WebSocket>();
    private cachedFrame: Buffer | undefined;
    private upgradeListener: ((request: http.IncomingMessage, socket: Socket, head: Buffer) => void) | undefined;
    private serverHost: http.Server | https.Server | undefined;

    constructor(private readonly warn: (message: string) => void) {}

    get latestFrame(): Buffer | undefined {
        return this.cachedFrame;
    }

    clearFrame(): void {
        this.cachedFrame = undefined;
    }

    start(server: http.Server | https.Server): void {
        this.detach();
        const frameSocketServer = new WebSocketServer({ noServer: true });
        this.frameSocketServer = frameSocketServer;
        this.serverHost = server;
        this.upgradeListener = (request, socket, head) => {
            if (!isFrameSocketRequest(request.url)) {
                return;
            }
            if (!isAllowedFrameSocketOrigin(request)) {
                socket.destroy();
                return;
            }
            frameSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
                this.frameSockets.add(webSocket);
                webSocket.on('close', () => this.frameSockets.delete(webSocket));
                webSocket.on('error', (error) => {
                    this.warn(`VICE frame socket error: ${error.message}`);
                });
                this.sendBinaryFrame(webSocket, this.cachedFrame);
            });
        };
        server.on('upgrade', this.upgradeListener);
    }

    stop(): void {
        this.detach();
        this.clearFrame();
    }

    private detach(): void {
        if (this.upgradeListener && this.serverHost) {
            this.serverHost.off('upgrade', this.upgradeListener);
        }
        this.upgradeListener = undefined;
        this.serverHost = undefined;
        for (const socket of this.frameSockets) {
            socket.close();
        }
        this.frameSockets.clear();
        this.frameSocketServer?.close();
        this.frameSocketServer = undefined;
    }

    broadcast(record: Buffer): void {
        this.cachedFrame = record;
        for (const socket of this.frameSockets) {
            this.sendBinaryFrame(socket, record);
        }
    }

    protected sendBinaryFrame(socket: WebSocket, record: Buffer | undefined): void {
        if (!record || socket.readyState !== WebSocket.OPEN) {
            return;
        }
        if (socket.bufferedAmount > MAX_FRAME_SOCKET_BUFFERED_BYTES) {
            this.warn(
                `Closing slow VICE frame socket with ${socket.bufferedAmount} buffered bytes.`
            );
            this.frameSockets.delete(socket);
            socket.terminate();
            return;
        }
        const maxBufferedBytes = Math.max(
            MIN_FRAME_SOCKET_BACKPRESSURE_BYTES,
            record.length
        );
        if (socket.bufferedAmount > maxBufferedBytes || socket.bufferedAmount > 0) {
            return;
        }
        socket.send(record, { binary: true }, (error) => {
            if (error) {
                this.frameSockets.delete(socket);
                socket.terminate();
                this.warn(`VICE frame socket send failed: ${error.message}`);
            }
        });
    }
}

function isFrameSocketRequest(requestUrl: string | undefined): boolean {
    if (!requestUrl) {
        return false;
    }
    const pathname = new URL(requestUrl, 'http://localhost').pathname;
    return pathname === CommodoreViceEmbedFrameSocketPath ||
        pathname.endsWith(CommodoreViceEmbedFrameSocketPath);
}

function isAllowedFrameSocketOrigin(request: http.IncomingMessage): boolean {
    const origin = request.headers.origin;
    const host = request.headers.host;
    if (!origin || !host) {
        return true;
    }
    try {
        const originUrl = new URL(origin);
        if (originUrl.protocol === 'file:') {
            return true;
        }
        if (originUrl.host === host) {
            return true;
        }
        const hostUrl = new URL(`http://${host}`);
        return originUrl.port === hostUrl.port &&
            isLoopbackHost(originUrl.hostname) &&
            isLoopbackHost(hostUrl.hostname);
    } catch {
        return false;
    }
}

function isLoopbackHost(hostname: string): boolean {
    const normalized = hostname.toLowerCase();
    return normalized === 'localhost' ||
        normalized === '127.0.0.1' ||
        normalized === '::1' ||
        normalized === '[::1]';
}

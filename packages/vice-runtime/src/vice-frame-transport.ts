import { createServer, type Server, type Socket } from 'node:net';

import { ViceFrameDecoder, type ViceFrameDecoderCallbacks } from './vice-frame-decoder';

export interface ViceFrameTransportCallbacks extends ViceFrameDecoderCallbacks {
    readonly onSocketError?: (error: Error) => void;
}

export interface ViceFrameTransportStartOptions {
    // The caller decides whether a debug/standalone session ends on disconnect.
    readonly onDisconnect?: () => void;
}

/** Owns the native emulator's loopback frame socket, independent of UI/DAP. */
export class ViceFrameTransport {
    private server: Server | undefined;
    private socket: Socket | undefined;
    private cancelPendingStart: (() => void) | undefined;
    private readonly decoder: ViceFrameDecoder;

    constructor(private readonly callbacks: ViceFrameTransportCallbacks) {
        this.decoder = new ViceFrameDecoder(callbacks);
    }

    get connected(): boolean {
        return this.socket !== undefined;
    }

    get port(): number | undefined {
        const address = this.server?.address();
        return address && typeof address !== 'string' ? address.port : undefined;
    }

    start(options: ViceFrameTransportStartOptions = {}): Promise<number> {
        this.stop();
        const server = createServer((socket) => {
            if (this.server !== server) {
                socket.destroy();
                return;
            }
            this.socket?.destroy();
            this.socket = socket;
            this.decoder.reset();
            socket.setNoDelay(true);
            socket.on('data', (chunk: Buffer) => {
                if (this.server === server && this.socket === socket) {
                    this.decoder.accept(chunk);
                }
            });
            socket.on('error', (error) => {
                if (this.server === server && this.socket === socket) {
                    this.callbacks.onSocketError?.(error);
                }
            });
            socket.on('close', () => {
                if (this.server !== server || this.socket !== socket) {
                    return;
                }
                this.socket = undefined;
                this.decoder.reset();
                options.onDisconnect?.();
            });
        });
        this.server = server;

        return new Promise<number>((resolve, reject) => {
            let settled = false;
            this.cancelPendingStart = () => {
                settled = true;
                reject(new Error('VICE frame transport was closed before binding to a TCP port.'));
            };
            server.on('error', (error) => {
                if (this.server !== server) {
                    return;
                }
                if (!settled) {
                    settled = true;
                    this.cancelPendingStart = undefined;
                    this.server = undefined;
                    server.close();
                    reject(error);
                    return;
                }
                this.callbacks.onError(new Error(`VICE frame transport error: ${error.message}`));
            });
            server.listen({ host: '127.0.0.1', port: 0 }, () => {
                if (this.server !== server) {
                    server.close();
                    return;
                }
                const port = this.port;
                if (port === undefined) {
                    settled = true;
                    this.cancelPendingStart = undefined;
                    this.stop();
                    reject(new Error('VICE frame transport did not bind to a TCP port.'));
                    return;
                }
                settled = true;
                this.cancelPendingStart = undefined;
                resolve(port);
            });
        });
    }

    stop(): void {
        const socket = this.socket;
        const server = this.server;
        this.socket = undefined;
        this.server = undefined;
        this.decoder.reset();
        const cancel = this.cancelPendingStart;
        this.cancelPendingStart = undefined;
        cancel?.();
        socket?.destroy();
        server?.close();
    }
}

import {
    resolveViceCommand,
    ViceStandaloneProcess,
    VICE_EMBED_FLAG as EMBED_FLAG,
    VICE_EMBED_FRAME_PORT_FLAG as EMBED_FRAME_PORT_FLAG,
    VICE_EMBED_COMMAND_FD_FLAG as EMBED_COMMAND_FD_FLAG,
    VICE_EMBED_COMMAND_FD as EMBED_COMMAND_FD
} from '@commodore-commander/vice-runtime';
import type * as http from 'node:http';
import type * as https from 'node:https';
import {
    createServer,
    type AddressInfo,
    type Server as NetServer,
    type Socket
} from 'node:net';

import type { Disposable } from '@theia/core/lib/common/disposable';
import { ILogger } from '@theia/core/lib/common/logger';
import { PreferenceService } from '@theia/core/lib/common/preferences';
import type { BackendApplicationContribution } from '@theia/core/lib/node/backend-application';
import { inject, injectable } from '@theia/core/shared/inversify';
import { WebSocket, WebSocketServer } from 'ws';

import {
    CommodoreViceEmbedFrameSocketPath,
    COMMODORE_VICE_EMBED_PROTOCOL,
    type CommodoreViceEmbedClient,
    type CommodoreViceEmbedJoystickEvent,
    type CommodoreViceEmbedKeyEvent,
    type CommodoreViceEmbedLaunchRequest,
    type CommodoreViceEmbedLaunchResult,
    type CommodoreViceEmbedMouseEvent,
    type CommodoreViceEmbedProtocolEvent,
    type CommodoreViceEmbedResizeEvent,
    type CommodoreViceEmbedService,
    type CommodoreViceEmbedStatusEvent
} from '../common/commodore-vice-embed-service';
import {
    getCommodoreCommanderToolPreferences
} from '../common/commodore-commander-tool-preferences';
import {
    createEmbeddedViceArgs,
    createViceArgs,
    resolveViceMachineProfile,
    resolveViceRuntime
} from './vice-runtime-resolver';
import {
    COMMODORE_VICE_EMBED_BINARY_FRAME_MAGIC,
    encodeViceEmbedCommand,
    getViceEmbedBinaryFrameRecordLength,
    parseViceEmbedBinaryFrameRecord,
    parseViceEmbedProtocolLine,
    startsWithViceEmbedBinaryFrame,
    type CommodoreViceEmbedCommand
} from './commodore-vice-embed-protocol';
import { observeRpcClientClose } from './rpc-client-lifecycle';

const DEFAULT_VICE_EMULATOR = 'x64sc';
const MAX_UNFRAMED_STDOUT_BYTES = 32 * 1024 * 1024;
const MAX_FRAME_TRANSPORT_BUFFER_BYTES = 32 * 1024 * 1024;
const MIN_FRAME_SOCKET_BACKPRESSURE_BYTES = 256 * 1024;
const MAX_FRAME_SOCKET_BUFFERED_BYTES = 2 * 1024 * 1024;

interface ResolvedViceEmbedLaunch {
    readonly command: string;
    readonly args: readonly string[];
    readonly cwd: string;
}

@injectable()
export class CommodoreViceEmbedServiceImpl
    implements CommodoreViceEmbedService, BackendApplicationContribution {
    @inject(ILogger)
    protected readonly logger!: ILogger;

    @inject(PreferenceService)
    protected readonly preferenceService!: PreferenceService;

    protected client: CommodoreViceEmbedClient | undefined;
    protected readonly standaloneProcess = new ViceStandaloneProcess({
        onStdout: (chunk) => this.handleStdout(chunk),
        onStderr: (chunk) => this.client?.onViceEmbedOutput({
            stream: 'stderr',
            text: chunk.toString('utf8')
        }),
        onError: (error, pid) => {
            this.emitStatus({
                state: 'error',
                message: `Could not start emulator: ${error.message}`,
                pid
            });
            this.closeViceFrameTransport();
        },
        onClose: ({ pid, exitCode, signal }) => {
            this.stdoutBuffer = Buffer.alloc(0);
            this.closeViceFrameTransport();
            this.emitStatus({
                state: exitCode === 0 ? 'stopped' : 'error',
                message: formatViceProcessCloseMessage(exitCode, signal),
                pid,
                exitCode,
                signal
            });
        }
    });
    protected stdoutBuffer = Buffer.alloc(0);
    protected viceFrameServer: NetServer | undefined;
    protected viceFrameSocket: Socket | undefined;
    protected viceFrameBuffer = Buffer.alloc(0);
    protected frameSocketServer: WebSocketServer | undefined;
    protected frameSockets = new Set<WebSocket>();
    protected latestBinaryFrame: Buffer | undefined;
    protected clientConnectionCloseListener: Disposable | undefined;
    protected frameSocketUpgradeListener:
        | ((request: http.IncomingMessage, socket: Socket, head: Buffer) => void)
        | undefined;
    protected frameSocketServerHost: http.Server | https.Server | undefined;

    dispose(): void {
        this.stopProcess();
        if (this.frameSocketUpgradeListener && this.frameSocketServerHost) {
            this.frameSocketServerHost.off('upgrade', this.frameSocketUpgradeListener);
        }
        this.frameSocketUpgradeListener = undefined;
        this.frameSocketServerHost = undefined;
        for (const socket of this.frameSockets) {
            socket.close();
        }
        this.frameSockets.clear();
        this.frameSocketServer?.close();
        this.frameSocketServer = undefined;
        this.clientConnectionCloseListener?.dispose();
        this.clientConnectionCloseListener = undefined;
        this.client = undefined;
    }

    onStop(): void {
        this.dispose();
    }

    onStart(server: http.Server | https.Server): void {
        const frameSocketServer = new WebSocketServer({ noServer: true });
        this.frameSocketServer = frameSocketServer;
        this.frameSocketServerHost = server;
        this.frameSocketUpgradeListener = (request, socket, head) => {
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
                    this.logger.warn(`VICE frame socket error: ${error.message}`);
                });
                this.sendBinaryFrame(webSocket, this.latestBinaryFrame);
            });
        };
        server.on('upgrade', this.frameSocketUpgradeListener);
    }

    setClient(client: CommodoreViceEmbedClient | undefined): void {
        this.clientConnectionCloseListener?.dispose();
        this.clientConnectionCloseListener = undefined;
        this.client = client;
        this.clientConnectionCloseListener = observeRpcClientClose(
            client,
            (closedClient) => {
                if (this.client === closedClient) {
                    this.handleClientDisconnected();
                }
            }
        );
    }

    async launch(request: CommodoreViceEmbedLaunchRequest = {}): Promise<CommodoreViceEmbedLaunchResult> {
        this.stopProcess();
        this.emitStatus({ state: 'starting', message: 'Starting emulator.' });

        let framePort: number;
        try {
            framePort = await this.startViceFrameServer(false);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.emitStatus({
                state: 'error',
                message: `Could not start VICE frame transport: ${message}`
            });
            throw error;
        }

        let launch: ResolvedViceEmbedLaunch;
        try {
            launch = await this.resolveLaunch(request, framePort);
        } catch (error) {
            this.closeViceFrameTransport();
            throw error;
        }
        let pid: number | undefined;
        try {
            pid = this.standaloneProcess.start(launch);
        } catch (error) {
            this.closeViceFrameTransport();
            throw error;
        }

        return {
            running: true,
            pid,
            command: launch.command,
            args: launch.args,
            cwd: launch.cwd,
            protocol: COMMODORE_VICE_EMBED_PROTOCOL
        };
    }

    async stop(): Promise<void> {
        this.sendCommand({ type: 'quit' });
        this.stopProcess();
        this.emitStatus({ state: 'stopped', message: 'Emulator stopped.' });
    }

    async reset(): Promise<void> {
        this.sendCommand({ type: 'reset' });
    }

    async openMenu(): Promise<void> {
        this.sendCommand({ type: 'menu' });
    }

    async sendKey(event: CommodoreViceEmbedKeyEvent): Promise<void> {
        this.sendCommand({ type: 'key', ...event });
    }

    async sendMouse(event: CommodoreViceEmbedMouseEvent): Promise<void> {
        this.sendCommand({ type: 'mouse', ...event });
    }

    async sendJoystick(event: CommodoreViceEmbedJoystickEvent): Promise<void> {
        this.sendCommand({ type: 'joystick', ...event });
    }

    async resize(event: CommodoreViceEmbedResizeEvent): Promise<void> {
        this.sendCommand({ type: 'resize', ...event });
    }

    async startExternalFrameTransport(): Promise<number> {
        if (this.standaloneProcess.hasProcess) {
            this.stopProcess();
        }
        if (this.viceFrameSocket) {
            throw new Error(
                'Embedded VICE frame transport is already connected to an emulator.'
            );
        }
        const existingPort = this.currentViceFrameServerPort();
        if (existingPort !== undefined) {
            return existingPort;
        }
        return this.startViceFrameServer(true);
    }

    protected async resolveLaunch(
        request: CommodoreViceEmbedLaunchRequest,
        framePort: number
    ): Promise<ResolvedViceEmbedLaunch> {
        const preferences = getCommodoreCommanderToolPreferences(this.preferenceService);
        const machine = request.machine
            ? resolveViceMachineProfile(request.machine)
            : undefined;
        const executableOverride = normalizeConfiguredValue(request.executable ?? preferences.viceExecutable);
        const runtime = await resolveViceRuntime({
            resourcesPath: preferences.viceResourcesPath,
            executable: executableOverride
        });
        const command = await resolveViceCommand(
            runtime.resourcesPath,
            executableOverride ?? runtime.executable ?? machine?.profile.vice.executable ?? DEFAULT_VICE_EMULATOR
        );
        const viceArgs = createEmbeddedViceArgs([
            ...(machine ? createViceArgs(machine.profile, machine.launch) : []),
            ...(request.args ?? [])
        ]);
        const args = [
            EMBED_FLAG,
            EMBED_FRAME_PORT_FLAG,
            String(framePort),
            EMBED_COMMAND_FD_FLAG,
            String(EMBED_COMMAND_FD),
            ...viceArgs,
            ...(request.program ? [request.program] : [])
        ];

        return {
            command,
            args,
            cwd: request.cwd ?? process.cwd()
        };
    }

    protected handleStdout(chunk: Buffer): void {
        const ownedChunk = Buffer.from(chunk);
        this.stdoutBuffer = this.stdoutBuffer.length === 0
            ? ownedChunk
            : Buffer.concat([this.stdoutBuffer, ownedChunk]);
        if (this.stdoutBuffer.length > MAX_UNFRAMED_STDOUT_BYTES) {
            this.client?.onViceEmbedOutput({
                stream: 'stdout',
                text: this.stdoutBuffer.subarray(0, MAX_UNFRAMED_STDOUT_BYTES).toString('utf8')
            });
            this.stdoutBuffer = Buffer.alloc(0);
            return;
        }

        for (;;) {
            if (startsWithViceEmbedBinaryFrame(this.stdoutBuffer)) {
                let recordLength: number | undefined;
                try {
                    recordLength = getViceEmbedBinaryFrameRecordLength(this.stdoutBuffer);
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    this.emitStatus({
                        state: 'error',
                        message: `Invalid patched VICE binary frame: ${message}`
                    });
                    this.stdoutBuffer = this.stdoutBuffer.subarray(COMMODORE_VICE_EMBED_BINARY_FRAME_MAGIC.length);
                    continue;
                }
                if (recordLength === undefined || this.stdoutBuffer.length < recordLength) {
                    return;
                }
                const record = this.stdoutBuffer.subarray(0, recordLength);
                this.stdoutBuffer = this.stdoutBuffer.subarray(recordLength);
                this.handleBinaryFrameRecord(record);
                continue;
            }

            const binaryIndex = this.stdoutBuffer.indexOf(COMMODORE_VICE_EMBED_BINARY_FRAME_MAGIC);
            const newlineIndex = this.stdoutBuffer.indexOf(0x0a);
            if (newlineIndex >= 0 && (binaryIndex < 0 || newlineIndex < binaryIndex)) {
                const line = this.stdoutBuffer.subarray(0, newlineIndex + 1).toString('utf8');
                this.stdoutBuffer = this.stdoutBuffer.subarray(newlineIndex + 1);
                this.handleStdoutLine(line);
                continue;
            }
            if (binaryIndex > 0) {
                const text = this.stdoutBuffer.subarray(0, binaryIndex).toString('utf8');
                this.stdoutBuffer = this.stdoutBuffer.subarray(binaryIndex);
                this.client?.onViceEmbedOutput({ stream: 'stdout', text });
                continue;
            }

            return;
        }
    }

    protected handleViceFrameData(chunk: Buffer): void {
        const ownedChunk = Buffer.from(chunk);
        this.viceFrameBuffer = this.viceFrameBuffer.length === 0
            ? ownedChunk
            : Buffer.concat([this.viceFrameBuffer, ownedChunk]);
        if (this.viceFrameBuffer.length > MAX_FRAME_TRANSPORT_BUFFER_BYTES) {
            this.emitStatus({
                state: 'error',
                message: 'Patched VICE frame transport buffer was too large.'
            });
            this.viceFrameBuffer = Buffer.alloc(0);
            return;
        }

        for (;;) {
            if (this.viceFrameBuffer.length < COMMODORE_VICE_EMBED_BINARY_FRAME_MAGIC.length) {
                return;
            }
            if (!startsWithViceEmbedBinaryFrame(this.viceFrameBuffer)) {
                const binaryIndex = this.viceFrameBuffer.indexOf(
                    COMMODORE_VICE_EMBED_BINARY_FRAME_MAGIC,
                    1
                );
                if (binaryIndex >= 0) {
                    this.viceFrameBuffer = this.viceFrameBuffer.subarray(binaryIndex);
                    continue;
                }
                this.viceFrameBuffer = this.viceFrameBuffer.subarray(
                    Math.max(
                        0,
                        this.viceFrameBuffer.length -
                            (COMMODORE_VICE_EMBED_BINARY_FRAME_MAGIC.length - 1)
                    )
                );
                return;
            }

            let recordLength: number | undefined;
            try {
                recordLength = getViceEmbedBinaryFrameRecordLength(this.viceFrameBuffer);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                this.emitStatus({
                    state: 'error',
                    message: `Invalid patched VICE binary frame: ${message}`
                });
                this.viceFrameBuffer = this.viceFrameBuffer.subarray(
                    COMMODORE_VICE_EMBED_BINARY_FRAME_MAGIC.length
                );
                continue;
            }
            if (recordLength === undefined || this.viceFrameBuffer.length < recordLength) {
                return;
            }

            const record = this.viceFrameBuffer.subarray(0, recordLength);
            this.viceFrameBuffer = this.viceFrameBuffer.subarray(recordLength);
            this.handleBinaryFrameRecord(record);
        }
    }

    protected handleBinaryFrameRecord(record: Buffer): void {
        try {
            const frame = parseViceEmbedBinaryFrameRecord(record);
            this.broadcastBinaryFrame(frame.record);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.emitStatus({
                state: 'error',
                message: `Invalid patched VICE binary frame: ${message}`
            });
        }
    }

    protected handleStdoutLine(line: string): void {
        try {
            const event = parseViceEmbedProtocolLine(line);
            if (event) {
                this.handleProtocolEvent(event);
                return;
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.emitStatus({
                state: 'error',
                message: `Invalid patched VICE protocol frame: ${message}`
            });
        }

        this.client?.onViceEmbedOutput({
            stream: 'stdout',
            text: line
        });
    }

    protected handleProtocolEvent(event: CommodoreViceEmbedProtocolEvent): void {
        switch (event.type) {
            case 'hello':
                this.emitStatus({
                    state: 'running',
                    message: event.machine
                        ? `Emulator ready (${event.machine}).`
                        : 'Emulator ready.',
                    pid: this.standaloneProcess.pid
                });
                return;
            case 'frame':
                this.client?.onViceEmbedFrame(event);
                return;
            case 'status':
                this.emitStatus(event);
                return;
        }
    }

    protected sendCommand(command: CommodoreViceEmbedCommand): void {
        this.standaloneProcess.sendCommand(encodeViceEmbedCommand(command));
    }

    protected stopProcess(): void {
        this.standaloneProcess.stop();
        this.stdoutBuffer = Buffer.alloc(0);
        this.closeViceFrameTransport();
    }

    protected async startViceFrameServer(closeWhenSocketCloses: boolean): Promise<number> {
        this.closeViceFrameTransport();

        const server = createServer((socket) => {
            if (this.viceFrameSocket && this.viceFrameSocket !== socket) {
                this.viceFrameSocket.destroy();
            }
            this.viceFrameSocket = socket;
            this.viceFrameBuffer = Buffer.alloc(0);
            socket.setNoDelay(true);
            socket.on('data', (chunk: Buffer) => this.handleViceFrameData(chunk));
            socket.on('error', (error) => {
                this.logger.warn(`VICE frame transport socket error: ${error.message}`);
            });
            socket.on('close', () => {
                if (this.viceFrameSocket === socket) {
                    this.viceFrameSocket = undefined;
                    this.viceFrameBuffer = Buffer.alloc(0);
                }
                if (closeWhenSocketCloses && !this.standaloneProcess.hasProcess) {
                    this.closeViceFrameTransport();
                }
            });
        });
        this.viceFrameServer = server;

        return new Promise<number>((resolve, reject) => {
            let resolved = false;
            server.on('error', (error) => {
                if (!resolved) {
                    this.viceFrameServer = undefined;
                    reject(error);
                    return;
                }
                this.emitStatus({
                    state: 'error',
                    message: `VICE frame transport error: ${error.message}`
                });
            });
            server.listen({ host: '127.0.0.1', port: 0 }, () => {
                const address = server.address();
                if (!address || typeof address === 'string') {
                    this.closeViceFrameTransport();
                    reject(new Error('VICE frame transport did not bind to a TCP port.'));
                    return;
                }
                resolved = true;
                resolve((address as AddressInfo).port);
            });
        });
    }

    protected closeViceFrameTransport(): void {
        if (this.viceFrameSocket) {
            this.viceFrameSocket.destroy();
            this.viceFrameSocket = undefined;
        }
        this.viceFrameBuffer = Buffer.alloc(0);
        this.latestBinaryFrame = undefined;
        if (this.viceFrameServer) {
            this.viceFrameServer.close();
            this.viceFrameServer = undefined;
        }
    }

    protected currentViceFrameServerPort(): number | undefined {
        const address = this.viceFrameServer?.address();
        return address && typeof address !== 'string'
            ? address.port
            : undefined;
    }

    protected broadcastBinaryFrame(record: Buffer): void {
        this.latestBinaryFrame = record;
        for (const socket of this.frameSockets) {
            this.sendBinaryFrame(socket, record);
        }
    }

    protected sendBinaryFrame(socket: WebSocket, record: Buffer | undefined): void {
        if (!record || socket.readyState !== WebSocket.OPEN) {
            return;
        }
        if (socket.bufferedAmount > MAX_FRAME_SOCKET_BUFFERED_BYTES) {
            this.logger.warn(
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
                this.logger.warn(`VICE frame socket send failed: ${error.message}`);
            }
        });
    }

    protected emitStatus(event: CommodoreViceEmbedStatusEvent): void {
        this.client?.onViceEmbedStatus(event);
        if (event.state === 'error') {
            this.logger.warn(event.message ?? 'Patched VICE embed reported an error.');
        }
    }

    protected handleClientDisconnected(): void {
        this.clientConnectionCloseListener?.dispose();
        this.clientConnectionCloseListener = undefined;
        this.client = undefined;
    }
}

function formatViceProcessCloseMessage(
    exitCode: number | null,
    signal: NodeJS.Signals | null
): string {
    if (exitCode === 0) {
        return 'Emulator stopped.';
    }
    if (exitCode !== null) {
        return `Emulator quit with exit code ${exitCode}`;
    }
    if (signal) {
        return `Emulator quit after signal ${signal}`;
    }
    return 'Emulator quit with unknown exit code';
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

function normalizeConfiguredValue(value: string | undefined): string | undefined {
    const normalized = value?.trim();
    return normalized || undefined;
}

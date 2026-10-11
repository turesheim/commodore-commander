import {
    resolveViceCommand,
    ViceStandaloneProcess,
    ViceFrameTransport,
    ViceEmbeddedStdoutDecoder,
    VICE_EMBED_FLAG as EMBED_FLAG,
    VICE_EMBED_FRAME_PORT_FLAG as EMBED_FRAME_PORT_FLAG,
    VICE_EMBED_COMMAND_FD_FLAG as EMBED_COMMAND_FD_FLAG,
    VICE_EMBED_COMMAND_FD as EMBED_COMMAND_FD
} from '@commodore-commander/vice-runtime';
import type * as http from 'node:http';
import type * as https from 'node:https';

import type { Disposable } from '@theia/core/lib/common/disposable';
import { ILogger } from '@theia/core/lib/common/logger';
import { PreferenceService } from '@theia/core/lib/common/preferences';
import type { BackendApplicationContribution } from '@theia/core/lib/node/backend-application';
import { inject, injectable } from '@theia/core/shared/inversify';

import {
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
    encodeViceEmbedCommand,
    parseViceEmbedBinaryFrameRecord,
    parseViceEmbedProtocolLine,
    type CommodoreViceEmbedCommand
} from './commodore-vice-embed-protocol';
import { observeRpcClientClose } from './rpc-client-lifecycle';
import { CommodoreViceFrameBridge } from './commodore-vice-frame-bridge';

const DEFAULT_VICE_EMULATOR = 'x64sc';

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
            this.stdoutDecoder.reset();
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
    protected readonly stdoutDecoder = new ViceEmbeddedStdoutDecoder({
        onLine: (line) => this.handleStdoutLine(line),
        onText: (text) => this.client?.onViceEmbedOutput({ stream: 'stdout', text }),
        onBinaryFrame: (record) => this.handleBinaryFrameRecord(record),
        onInvalidFrame: (error) => this.emitStatus({
            state: 'error', message: `Invalid patched VICE binary frame: ${error.message}`
        }),
        onOverflow: (buffer, limit) => this.client?.onViceEmbedOutput({
            stream: 'stdout', text: buffer.subarray(0, limit).toString('utf8')
        })
    });
    protected readonly viceFrameTransport = new ViceFrameTransport({
        onFrame: (record) => this.broadcastBinaryFrame(record),
        onError: (error) => this.emitStatus({ state: 'error', message: error.message }),
        onSocketError: (error) => this.logger.warn(`VICE frame transport socket error: ${error.message}`)
    });
    protected readonly frameBridge = new CommodoreViceFrameBridge((message) => this.logger.warn(message));
    protected clientConnectionCloseListener: Disposable | undefined;

    dispose(): void {
        this.stopProcess();
        this.frameBridge.stop();
        this.clientConnectionCloseListener?.dispose();
        this.clientConnectionCloseListener = undefined;
        this.client = undefined;
    }

    onStop(): void {
        this.dispose();
    }

    onStart(server: http.Server | https.Server): void {
        this.frameBridge.start(server);
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
        if (this.viceFrameTransport.connected) {
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
        this.stdoutDecoder.accept(chunk);
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
        this.stdoutDecoder.reset();
        this.closeViceFrameTransport();
    }

    protected async startViceFrameServer(closeWhenSocketCloses: boolean): Promise<number> {
        this.closeViceFrameTransport();
        return this.viceFrameTransport.start({
            onDisconnect: () => {
                if (closeWhenSocketCloses && !this.standaloneProcess.hasProcess) {
                    this.closeViceFrameTransport();
                }
            }
        });
    }

    protected closeViceFrameTransport(): void {
        this.viceFrameTransport.stop();
        this.frameBridge.clearFrame();
    }

    protected currentViceFrameServerPort(): number | undefined {
        return this.viceFrameTransport.port;
    }

    protected broadcastBinaryFrame(record: Buffer): void {
        this.frameBridge.broadcast(record);
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

function normalizeConfiguredValue(value: string | undefined): string | undefined {
    const normalized = value?.trim();
    return normalized || undefined;
}

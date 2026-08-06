import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';

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
    type CommodoreViceEmbedProtocolEvent,
    type CommodoreViceEmbedResizeEvent,
    type CommodoreViceEmbedService,
    type CommodoreViceEmbedStatusEvent
} from '../common/commodore-vice-embed-service';
import {
    getCommodoreCommanderToolPreferences
} from '../common/commodore-commander-tool-preferences';
import {
    createViceArgs,
    resolveViceMachineProfile,
    resolveViceRuntime
} from './vice-runtime-resolver';
import {
    encodeViceEmbedCommand,
    parseViceEmbedProtocolLine,
    type CommodoreViceEmbedCommand
} from './commodore-vice-embed-protocol';

const DEFAULT_VICE_EMULATOR = 'x64sc';
const EMBED_FLAG = '-cc-embed';
const MAX_UNFRAMED_STDOUT_BYTES = 1024 * 1024;

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
    protected viceProcess: ChildProcessWithoutNullStreams | undefined;
    protected stdoutBuffer = '';
    protected launchCommand = '';
    protected launchArgs: readonly string[] = [];
    protected launchCwd = process.cwd();

    dispose(): void {
        this.stopProcess();
        this.client = undefined;
    }

    onStop(): void {
        this.dispose();
    }

    setClient(client: CommodoreViceEmbedClient | undefined): void {
        this.client = client;
    }

    async launch(request: CommodoreViceEmbedLaunchRequest = {}): Promise<CommodoreViceEmbedLaunchResult> {
        this.stopProcess();
        this.emitStatus({ state: 'starting', message: 'Starting patched VICE.' });

        const launch = await this.resolveLaunch(request);
        this.launchCommand = launch.command;
        this.launchArgs = launch.args;
        this.launchCwd = launch.cwd;

        const child = spawn(launch.command, launch.args, {
            cwd: launch.cwd,
            stdio: 'pipe'
        });
        this.viceProcess = child;

        child.stdout.on('data', (chunk: Buffer) => this.handleStdout(chunk));
        child.stderr.on('data', (chunk: Buffer) => {
            this.client?.onViceEmbedOutput({
                stream: 'stderr',
                text: chunk.toString('utf8')
            });
        });
        child.on('error', (error: Error) => {
            if (this.viceProcess !== child) {
                return;
            }
            this.emitStatus({
                state: 'error',
                message: `Could not start patched VICE: ${error.message}`,
                pid: child.pid
            });
            this.viceProcess = undefined;
        });
        child.on('close', (exitCode: number | null, signal: NodeJS.Signals | null) => {
            if (this.viceProcess !== child) {
                return;
            }
            this.viceProcess = undefined;
            this.stdoutBuffer = '';
            this.emitStatus({
                state: exitCode === 0 ? 'stopped' : 'error',
                message: exitCode === 0
                    ? 'Patched VICE stopped.'
                    : `Patched VICE exited with code ${exitCode ?? 'unknown'}.`,
                pid: child.pid,
                exitCode,
                signal
            });
        });

        return {
            running: true,
            pid: child.pid,
            command: launch.command,
            args: launch.args,
            cwd: launch.cwd,
            protocol: COMMODORE_VICE_EMBED_PROTOCOL
        };
    }

    async stop(): Promise<void> {
        this.sendCommand({ type: 'quit' });
        this.stopProcess();
        this.emitStatus({ state: 'stopped', message: 'Patched VICE stopped.' });
    }

    async reset(): Promise<void> {
        this.sendCommand({ type: 'reset' });
    }

    async sendKey(event: CommodoreViceEmbedKeyEvent): Promise<void> {
        this.sendCommand({ type: 'key', ...event });
    }

    async sendJoystick(event: CommodoreViceEmbedJoystickEvent): Promise<void> {
        this.sendCommand({ type: 'joystick', ...event });
    }

    async resize(event: CommodoreViceEmbedResizeEvent): Promise<void> {
        this.sendCommand({ type: 'resize', ...event });
    }

    protected async resolveLaunch(request: CommodoreViceEmbedLaunchRequest): Promise<ResolvedViceEmbedLaunch> {
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
        const args = [
            EMBED_FLAG,
            ...(machine ? createViceArgs(machine.profile, machine.launch) : []),
            ...(request.args ?? []),
            ...(request.program ? [request.program] : [])
        ];

        return {
            command,
            args,
            cwd: request.cwd ?? process.cwd()
        };
    }

    protected handleStdout(chunk: Buffer): void {
        this.stdoutBuffer += chunk.toString('utf8');
        if (this.stdoutBuffer.length > MAX_UNFRAMED_STDOUT_BYTES) {
            this.client?.onViceEmbedOutput({
                stream: 'stdout',
                text: this.stdoutBuffer.slice(0, MAX_UNFRAMED_STDOUT_BYTES)
            });
            this.stdoutBuffer = '';
        }

        let newlineIndex = this.stdoutBuffer.indexOf('\n');
        while (newlineIndex >= 0) {
            const line = this.stdoutBuffer.slice(0, newlineIndex + 1);
            this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1);
            this.handleStdoutLine(line);
            newlineIndex = this.stdoutBuffer.indexOf('\n');
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
                        ? `Patched VICE ready (${event.machine}).`
                        : 'Patched VICE ready.',
                    pid: this.viceProcess?.pid
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
        const child = this.viceProcess;
        if (!child || child.killed || !child.stdin.writable) {
            return;
        }
        child.stdin.write(encodeViceEmbedCommand(command), 'utf8');
    }

    protected stopProcess(): void {
        const child = this.viceProcess;
        this.viceProcess = undefined;
        this.stdoutBuffer = '';
        if (!child || child.killed) {
            return;
        }
        child.kill();
    }

    protected emitStatus(event: CommodoreViceEmbedStatusEvent): void {
        this.client?.onViceEmbedStatus(event);
        if (event.state === 'error') {
            this.logger.warn(event.message ?? 'Patched VICE embed reported an error.');
        }
    }
}

async function resolveViceCommand(
    viceResourcesPath: string,
    viceExecutable: string
): Promise<string> {
    const executable = normalizeConfiguredValue(viceExecutable) ?? DEFAULT_VICE_EMULATOR;
    if (isPathLike(executable)) {
        const command = path.resolve(executable);
        await assertExecutable(command, `VICE emulator ${viceExecutable}`);
        return command;
    }

    for (const candidate of viceCommandCandidates(viceResourcesPath, executable)) {
        if (await isExecutable(candidate)) {
            return candidate;
        }
    }

    return executable;
}

function viceCommandCandidates(
    viceResourcesPath: string,
    viceExecutable: string
): string[] {
    const executableNames = process.platform === 'win32' &&
        !viceExecutable.toLowerCase().endsWith('.exe')
        ? [viceExecutable, `${viceExecutable}.exe`]
        : [viceExecutable];
    return executableNames.flatMap((executableName) => [
        path.join(viceResourcesPath, 'bin', executableName),
        path.join(viceResourcesPath, executableName)
    ]);
}

async function assertExecutable(filePath: string, description: string): Promise<void> {
    try {
        await access(filePath, constants.X_OK);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`${description} is not executable: ${filePath}. ${message}`);
    }
}

async function isExecutable(filePath: string): Promise<boolean> {
    try {
        await access(filePath, constants.X_OK);
        return true;
    } catch {
        return false;
    }
}

function normalizeConfiguredValue(value: string | undefined): string | undefined {
    const normalized = value?.trim();
    return normalized || undefined;
}

function isPathLike(value: string): boolean {
    return path.isAbsolute(value) || /[\\/]/u.test(value);
}

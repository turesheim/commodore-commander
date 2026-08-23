import { constants, existsSync } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { inject, injectable } from '@theia/core/shared/inversify';
import type { BackendApplicationContribution } from '@theia/core/lib/node/backend-application';
import { ILogger } from '@theia/core/lib/common/logger';
import {
  PreferenceService
} from '@theia/core/lib/common/preferences';

import type {
  SidScoreGateModeName,
  SidScoreExportFormat,
  SidScoreExportRequest,
  SidScoreExportResult,
  SidScoreHighlightStateEvent,
  SidScoreInstrumentSourceName,
  SidScoreInstrumentStateEvent,
  SidScoreMidiDeviceListEvent,
  SidScoreMidiStateEvent,
  SidScoreNoteKind,
  SidScorePlaybackCommandRequest,
  SidScorePlaybackReasonName,
  SidScorePlaybackStateName,
  SidScorePlayRequest,
  SidScorePlayResult,
  SidScoreProtocolDirection,
  SidScoreProtocolErrorEvent,
  SidScoreProtocolFrameEvent,
  SidScoreResetInstrumentRequest,
  SidScoreRuntimeClient,
  SidScoreRuntimeService,
  SidScoreScanMidiDevicesRequest,
  SidScoreScopeBucketsEvent,
  SidScoreScopeSamplesEvent,
  SidScoreScoreMapEvent,
  SidScoreSetInstrumentRequest,
  SidScoreMidiSettingsRequest,
  SidScoreSongMetadata,
  SidScoreVoiceStateEvent
} from '../common/sidscore-runtime-service';
import {
  extractSidScoreSongMetadata
} from '../common/sidscore-subtunes';
import {
  getBundledKickAssemblerJarPath
} from './kick-assembler-build-runner';
import {
  getCommodoreCommanderToolPreferences
} from '../common/commodore-commander-tool-preferences';
import {
  createSidScorePlayerServerArgs,
  formatJavaRuntimeTooOldMessage,
  formatSidScoreLaunchDiagnostic,
  parseJavaRuntimeVersionOutput,
  SID_SCORE_CLI_JAR_FILENAME,
  SID_SCORE_REQUIRED_JAVA_RELEASE
} from './sidscore-launch';

export { SID_SCORE_CLI_JAR_FILENAME } from './sidscore-launch';

const SRAP_MAGIC = 0x53524150;
const SRAP_VERSION = 1;
const SRAP_HEADER_BYTES = 24;
const SRAP_MAX_PAYLOAD_BYTES = 4 * 1024 * 1024;
const SERVER_READY_TIMEOUT_MS = 10_000;
const SERVER_HELLO_TIMEOUT_MS = 5_000;
const JAVA_VERSION_TIMEOUT_MS = 5_000;
const EXPORT_RESULT_TIMEOUT_MS = 5 * 60_000;
const TELEMETRY_FLUSH_INTERVAL_MS = 33;
const MAX_PENDING_SCOPE_SAMPLES_PER_VOICE = 2048;
const PROTOCOL_PAYLOAD_PREVIEW_BYTES = 64;
const SID_SCORE_MAX_SUBTUNE_NUMBER = 255;

const FRAME_HELLO = 0x01;
const FRAME_HELLO_ACK = 0x02;
const FRAME_PLAY = 0x10;
const FRAME_PAUSE = 0x11;
const FRAME_CONTINUE = 0x12;
const FRAME_STOP = 0x13;
const FRAME_PLAY_SOURCE = 0x14;
const FRAME_SET_INSTRUMENT = 0x15;
const FRAME_RESET_INSTRUMENT = 0x16;
const FRAME_SCAN_MIDI_DEVICES = 0x17;
const FRAME_SET_MIDI_SETTINGS = 0x18;
const FRAME_EXPORT_SOURCE = 0x19;
const FRAME_PLAYBACK_STATE = 0x20;
const FRAME_SCORE_MAP = 0x21;
const FRAME_HIGHLIGHT_STATE = 0x22;
const FRAME_VOICE_STATE = 0x23;
const FRAME_SCOPE_BUCKETS = 0x24;
const FRAME_SCOPE_SAMPLES = 0x25;
const FRAME_INSTRUMENT_STATE = 0x26;
const FRAME_MIDI_DEVICE_LIST = 0x27;
const FRAME_MIDI_STATE = 0x28;
const FRAME_EXPORT_RESULT = 0x29;
const FRAME_ERROR = 0x7f;

const CAPABILITY_SCORE_MAP = 1 << 0;
const CAPABILITY_HIGHLIGHT_STATE = 1 << 1;
const CAPABILITY_VOICE_STATE = 1 << 2;
const CAPABILITY_SCOPE_SAMPLES = 1 << 4;
const CAPABILITY_INSTRUMENT_STATE = 1 << 5;
const CAPABILITY_MIDI_DEVICE_LIST = 1 << 6;
const CAPABILITY_MIDI_STATE = 1 << 7;
const CAPABILITY_EXPORT = 1 << 8;

const CLIENT_CAPABILITIES =
  CAPABILITY_SCORE_MAP |
  CAPABILITY_HIGHLIGHT_STATE |
  CAPABILITY_VOICE_STATE |
  CAPABILITY_SCOPE_SAMPLES |
  CAPABILITY_INSTRUMENT_STATE |
  CAPABILITY_MIDI_DEVICE_LIST |
  CAPABILITY_MIDI_STATE |
  CAPABILITY_EXPORT;

interface DecodedFrame {
  type: number;
  flags: number;
  sequence: number;
  timestampNanos: string;
  payload: Buffer<ArrayBufferLike>;
}

interface ReadyEvent {
  event: string;
  protocol: string;
  version: number;
  port: number;
}

interface PendingExportRequest {
  resolve: (result: ExportProtocolResult) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

interface ExportProtocolResult {
  format: SidScoreExportFormat;
  outputPath: string;
  outputByteLength: string;
}

@injectable()
export class SidScoreRuntimeServiceImpl
  implements SidScoreRuntimeService, BackendApplicationContribution {
  @inject(ILogger)
  protected readonly logger!: ILogger;

  @inject(PreferenceService)
  protected readonly preferenceService!: PreferenceService;

  protected client: SidScoreRuntimeClient | undefined;
  protected serverProcess: ReturnType<typeof spawn> | undefined;
  protected socket: net.Socket | undefined;
  protected socketBuffer = Buffer.alloc(0);
  protected startupPromise: Promise<void> | undefined;
  protected helloAckResolve: (() => void) | undefined;
  protected helloAckReject: ((error: Error) => void) | undefined;
  protected sequence = 1;
  protected requestId = 1;
  protected serverCommand = '';
  protected serverArgs: string[] = [];
  protected serverCwd = process.cwd();
  protected readyServer: ReadyEvent | undefined;
  protected pendingVoiceState: SidScoreVoiceStateEvent | undefined;
  protected pendingScopeBuckets: SidScoreScopeBucketsEvent | undefined;
  protected pendingScopeSamples: SidScoreScopeSamplesEvent | undefined;
  protected readonly pendingExportRequests = new Map<number, PendingExportRequest>();
  protected telemetryFlushTimer: ReturnType<typeof setTimeout> | undefined;
  protected pendingPlaybackRequestId: number | undefined;

  dispose(): void {
    this.clearPendingTelemetry();
    this.rejectPendingExportRequests(
      new Error('SIDScore player server was disposed.')
    );
    this.stopServerProcess();
    this.client = undefined;
  }

  onStop(): void {
    this.dispose();
  }

  setClient(client: SidScoreRuntimeClient | undefined): void {
    this.client = client;
  }

  async play(request: SidScorePlayRequest): Promise<SidScorePlayResult> {
    const sidScorePath = fileURLToPath(request.resourceUri);
    const subtune = clampInteger(
      request.subtune ?? 1,
      1,
      SID_SCORE_MAX_SUBTUNE_NUMBER
    );
    if (path.extname(sidScorePath).toLowerCase() !== '.sidscore') {
      throw new Error(`SIDScore playback expects a .sidscore file: ${sidScorePath}`);
    }
    if (typeof request.sourceText !== 'string') {
      await assertReadable(sidScorePath, 'SIDScore file');
    }

    await this.ensureConnected(request.javaCommand);
    const requestId = this.nextRequestId(request.requestId);
    const payload = new PayloadWriter()
      .u32(requestId)
      .str(request.resourceUri)
      .str(sidScorePath)
      .u8(toSidModelId(request.sidModel))
      .u8(0)
      .u8(0)
      .u8(0);

    this.beginPlaybackTransition(requestId);
    try {
      if (typeof request.sourceText === 'string') {
        const sourceUtf8 = Buffer.from(request.sourceText, 'utf8');
        payload.u32(sourceUtf8.length).bytes(sourceUtf8).u16(subtune);
        this.sendFrame(FRAME_PLAY_SOURCE, payload.toBuffer());
      } else {
        payload.u16(subtune);
        this.sendFrame(FRAME_PLAY, payload.toBuffer());
      }
    } catch (error) {
      this.pendingPlaybackRequestId = undefined;
      throw error;
    }

    return {
      resourceUri: request.resourceUri,
      subtune,
      songMetadata: await this.readSongMetadata(
        sidScorePath,
        request.sourceText,
        subtune
      ),
      serverPid: this.serverProcess?.pid,
      command: this.serverCommand,
      args: this.serverArgs,
      cwd: this.serverCwd
    };
  }

  async exportScore(request: SidScoreExportRequest): Promise<SidScoreExportResult> {
    const sidScorePath = fileURLToPath(request.resourceUri);
    const subtune = clampInteger(
      request.subtune ?? 1,
      1,
      SID_SCORE_MAX_SUBTUNE_NUMBER
    );
    if (path.extname(sidScorePath).toLowerCase() !== '.sidscore') {
      throw new Error(`SIDScore export expects a .sidscore file: ${sidScorePath}`);
    }

    const sourceText =
      typeof request.sourceText === 'string'
        ? request.sourceText
        : await readFile(sidScorePath, 'utf8');
    const outputPath = request.outputUri
      ? fileURLToPath(request.outputUri)
      : withExtension(sidScorePath, `.${request.format}`);

    await this.ensureConnected(request.javaCommand);
    const requestId = this.nextRequestId(request.requestId);
    const sourceUtf8 = Buffer.from(sourceText, 'utf8');
    const payload = new PayloadWriter()
      .u32(requestId)
      .str(request.resourceUri)
      .str(sidScorePath)
      .u8(toSidModelId(request.sidModel))
      .u8(toExportFormatId(request.format))
      .u8(0)
      .u8(0)
      .str(outputPath)
      .u32(sourceUtf8.length)
      .bytes(sourceUtf8)
      .u16(subtune);

    const resultPromise = this.waitForExportResult(requestId);
    try {
      this.sendFrame(FRAME_EXPORT_SOURCE, payload.toBuffer());
    } catch (error) {
      this.rejectPendingExportRequest(requestId, toError(error));
      throw error;
    }

    const result = await resultPromise;
    return {
      resourceUri: request.resourceUri,
      format: result.format,
      outputUri: pathToFileURL(result.outputPath).toString(),
      outputPath: result.outputPath,
      outputByteLength: result.outputByteLength,
      subtune,
      serverPid: this.serverProcess?.pid,
      command: this.serverCommand,
      args: this.serverArgs,
      cwd: this.serverCwd
    };
  }

  async pause(request: SidScorePlaybackCommandRequest = {}): Promise<void> {
    await this.ensureConnected();
    this.sendCommandFrame(FRAME_PAUSE, request);
  }

  async resume(request: SidScorePlaybackCommandRequest = {}): Promise<void> {
    await this.ensureConnected();
    this.sendCommandFrame(FRAME_CONTINUE, request);
  }

  async stop(request: SidScorePlaybackCommandRequest = {}): Promise<void> {
    await this.ensureConnected();
    this.sendCommandFrame(FRAME_STOP, request);
  }

  async setInstrument(request: SidScoreSetInstrumentRequest): Promise<void> {
    await this.ensureConnected();
    this.sendFrame(
      FRAME_SET_INSTRUMENT,
      createSetInstrumentPayload(request, this.nextRequestId(request.requestId))
    );
  }

  async resetInstrument(request: SidScoreResetInstrumentRequest): Promise<void> {
    await this.ensureConnected();
    this.sendFrame(
      FRAME_RESET_INSTRUMENT,
      new PayloadWriter()
        .u32(this.nextRequestId(request.requestId))
        .u8(clampInteger(request.voiceIndex, 1, 3))
        .toBuffer()
    );
  }

  async scanMidiDevices(
    request: SidScoreScanMidiDevicesRequest = {}
  ): Promise<void> {
    await this.ensureConnected();
    this.sendFrame(
      FRAME_SCAN_MIDI_DEVICES,
      new PayloadWriter().u32(this.nextRequestId(request.requestId)).toBuffer()
    );
  }

  async setMidiSettings(request: SidScoreMidiSettingsRequest): Promise<void> {
    await this.ensureConnected();
    const assignments = [...request.assignments]
      .filter((assignment) => assignment.voiceIndex >= 1 && assignment.voiceIndex <= 3)
      .sort((left, right) => left.voiceIndex - right.voiceIndex)
      .slice(0, 3);
    const payload = new PayloadWriter()
      .u32(this.nextRequestId(request.requestId))
      .bool8(request.enabled)
      .u8(assignments.length)
      .u16(0);

    for (const assignment of assignments) {
      payload
        .u8(clampInteger(assignment.voiceIndex, 1, 3))
        .bool8(assignment.voiceEnabled)
        .u8(clampInteger(assignment.channel, 1, 16))
        .u8(0)
        .str(assignment.deviceSelector);
    }

    this.sendFrame(FRAME_SET_MIDI_SETTINGS, payload.toBuffer());
  }

  protected sendCommandFrame(
    type: number,
    request: SidScorePlaybackCommandRequest
  ): void {
    this.sendFrame(
      type,
      new PayloadWriter().u32(this.nextRequestId(request.requestId)).toBuffer()
    );
  }

  protected async readSongMetadata(
    sidScorePath: string,
    sourceText: string | undefined,
    subtune: number
  ): Promise<SidScoreSongMetadata | undefined> {
    const metadataSource =
      sourceText ?? (await readFile(sidScorePath, 'utf8').catch(() => undefined));
    if (metadataSource === undefined) {
      return undefined;
    }

    return extractSidScoreSongMetadata(metadataSource, subtune);
  }

  protected nextRequestId(preferred?: number): number {
    if (preferred && preferred > 0) {
      return preferred;
    }

    const current = this.requestId;
    this.requestId = this.requestId >= 0xffff_ffff ? 1 : this.requestId + 1;
    return current;
  }

  protected waitForExportResult(requestId: number): Promise<ExportProtocolResult> {
    return new Promise<ExportProtocolResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingExportRequests.delete(requestId);
        reject(new Error('Timed out waiting for SIDScore export result.'));
      }, EXPORT_RESULT_TIMEOUT_MS);
      this.pendingExportRequests.set(requestId, {
        resolve,
        reject,
        timeout
      });
    });
  }

  protected resolvePendingExportRequest(
    requestId: number,
    result: ExportProtocolResult
  ): void {
    const pending = this.pendingExportRequests.get(requestId);
    if (!pending) {
      return;
    }
    clearTimeout(pending.timeout);
    this.pendingExportRequests.delete(requestId);
    pending.resolve(result);
  }

  protected rejectPendingExportRequest(requestId: number, error: Error): boolean {
    const pending = this.pendingExportRequests.get(requestId);
    if (!pending) {
      return false;
    }
    clearTimeout(pending.timeout);
    this.pendingExportRequests.delete(requestId);
    pending.reject(error);
    return true;
  }

  protected rejectPendingExportRequests(error: Error): void {
    for (const requestId of [...this.pendingExportRequests.keys()]) {
      this.rejectPendingExportRequest(requestId, error);
    }
  }

  protected async ensureConnected(javaCommand?: string): Promise<void> {
    if (this.socket && !this.socket.destroyed) {
      return;
    }

    if (!this.startupPromise) {
      this.startupPromise = this.connectOrStartServer(javaCommand).finally(() => {
        this.startupPromise = undefined;
      });
    }

    await this.startupPromise;
  }

  protected async connectOrStartServer(javaCommand?: string): Promise<void> {
    if (this.readyServer && this.isServerProcessRunning()) {
      try {
        await this.connectToReadyServer(this.readyServer);
        return;
      } catch (error) {
        this.client?.onSidScoreProtocolError?.({
          requestId: 0,
          code: 8,
          flags: 0,
          message: `Could not reconnect to SIDScore player server: ${toErrorMessage(error)}`
        });
        this.stopServerProcess();
      }
    }

    await this.startServer(javaCommand);
  }

  protected async startServer(javaCommand?: string): Promise<void> {
    this.stopServerProcess();

    const jarPath = getBundledSidScoreCliJarPath();
    await assertReadable(jarPath, 'SIDScore player server jar');
    const kickAssemblerJarPath = getBundledKickAssemblerJarPath();
    await assertReadable(kickAssemblerJarPath, 'KickAssembler jar');

    const command = javaCommand ?? await this.resolveJavaCommand();
    await this.assertJavaRuntimeSupportsSidScore(command);
    const args = createSidScorePlayerServerArgs({
      kickAssemblerJarPath,
      sidScoreCliJarPath: jarPath
    });
    this.serverCommand = command;
    this.serverArgs = args;
    this.serverCwd = process.cwd();

    this.emitServerOutput(
      'stdout',
      `${formatSidScoreLaunchDiagnostic({
        command,
        args,
        cwd: this.serverCwd,
        env: process.env,
        platform: process.platform,
        arch: process.arch,
        processExecPath: process.execPath
      })}\n`
    );

    const child = spawn(command, args, {
      cwd: this.serverCwd,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    this.serverProcess = child;

    let ready = false;
    let stdoutBuffer = '';
    let stderrBuffer = '';

    const readyEvent = await new Promise<ReadyEvent>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timed out waiting for SIDScore player server startup.'));
      }, SERVER_READY_TIMEOUT_MS);

      const rejectStartup = (error: Error): void => {
        clearTimeout(timeout);
        reject(error);
      };

      child.once('error', (error) => {
        rejectStartup(new Error(`Failed to start SIDScore player server: ${error.message}`));
      });
      child.once('exit', (exitCode, signal) => {
        const startupOutput = `${stdoutBuffer}\n${stderrBuffer}`;
        if (stdoutBuffer.trim().length > 0) {
          this.emitServerOutput('stdout', stdoutBuffer);
          stdoutBuffer = '';
        }
        if (stderrBuffer.trim().length > 0) {
          this.emitServerOutput('stderr', stderrBuffer);
          stderrBuffer = '';
        }
        if (this.serverProcess === child) {
          this.notifyServerStopped(exitCode, signal);
        }
        if (!ready) {
          rejectStartup(
            new Error(
              formatSidScoreStartupExitMessage(exitCode, signal, startupOutput)
            )
          );
        }
      });
      child.stderr.on('data', (chunk: Buffer) => {
        const result = readCompleteOutputLines(stderrBuffer, chunk.toString());
        stderrBuffer = result.remainder;
        for (const line of result.lines) {
          this.emitServerOutput('stderr', `${line}\n`);
        }
      });
      child.stdout.on('data', (chunk: Buffer) => {
        stdoutBuffer += chunk.toString();
        let newline = stdoutBuffer.indexOf('\n');
        while (newline >= 0) {
          const outputLine = stdoutBuffer.slice(0, newline).replace(/\r$/u, '');
          const line = outputLine.trim();
          stdoutBuffer = stdoutBuffer.slice(newline + 1);
          if (line.length > 0) {
            this.emitServerOutput('stdout', `${outputLine}\n`);
            if (!ready) {
              const parsed = parseReadyEvent(line);
              if (parsed) {
                ready = true;
                clearTimeout(timeout);
                resolve(parsed);
              }
            }
          }
          newline = stdoutBuffer.indexOf('\n');
        }
      });
    });

    this.readyServer = readyEvent;
    await this.connectToReadyServer(readyEvent);
  }

  protected async resolveJavaCommand(): Promise<string> {
    await this.preferenceService.ready;
    return getCommodoreCommanderToolPreferences(this.preferenceService)
      .javaRuntime ?? getJavaCommand();
  }

  protected async assertJavaRuntimeSupportsSidScore(command: string): Promise<void> {
    const runtime = await readJavaRuntimeVersion(command, JAVA_VERSION_TIMEOUT_MS);
    if (runtime.major < SID_SCORE_REQUIRED_JAVA_RELEASE) {
      throw new Error(formatJavaRuntimeTooOldMessage(runtime));
    }

    this.emitServerOutput(
      'stdout',
      `[Commodore Commander] SIDScore Java runtime ${command} -> ` +
      `${runtime.version} (Java ${runtime.major})\n`
    );
  }

  protected emitServerOutput(
    stream: 'stdout' | 'stderr',
    output: string
  ): void {
    const lines = output
      .replace(/\r\n/gu, '\n')
      .replace(/\r/gu, '\n')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    for (const line of lines) {
      const message = `[SIDScore Server ${stream}] ${line}`;
      if (stream === 'stderr') {
        void this.logger.error(message);
      } else {
        void this.logger.info(message);
      }
    }

    this.client?.onSidScoreServerOutput?.({
      stream,
      output
    });
  }

  protected async connectToReadyServer(readyEvent: ReadyEvent): Promise<void> {
    if (
      readyEvent.protocol !== 'srap-server' ||
      readyEvent.version !== SRAP_VERSION
    ) {
      throw new Error(
        `Unsupported SIDScore server protocol ${readyEvent.protocol} v${readyEvent.version}.`
      );
    }

    await new Promise<void>((resolve, reject) => {
      const socket = net.createConnection({
        host: '127.0.0.1',
        port: readyEvent.port
      });
      socket.once('connect', () => {
        resolve();
      });
      socket.once('error', (error) => {
        if (this.socket === socket) {
          this.socket = undefined;
        }
        reject(new Error(`Could not connect to SIDScore player server: ${error.message}`));
      });
      this.socket = socket;
    });

    const socket = this.socket;
    if (!socket) {
      throw new Error('SIDScore player server socket was not created.');
    }

    socket.on('data', (chunk) => this.handleSocketData(chunk));
    socket.on('error', (error) => {
      this.client?.onSidScoreProtocolError?.({
        requestId: 0,
        code: 8,
        flags: 0,
        message: error.message
      });
    });
    socket.on('close', () => {
      if (this.socket === socket) {
        this.socket = undefined;
        this.socketBuffer = Buffer.alloc(0);
      }
    });

    await this.sendHelloAndWaitForAck();
  }

  protected async sendHelloAndWaitForAck(): Promise<void> {
    const helloAck = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.helloAckResolve = undefined;
        this.helloAckReject = undefined;
        reject(new Error('Timed out waiting for SIDScore protocol HELLO_ACK.'));
      }, SERVER_HELLO_TIMEOUT_MS);
      this.helloAckResolve = () => {
        clearTimeout(timeout);
        resolve();
      };
      this.helloAckReject = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
    });

    this.sendFrame(
      FRAME_HELLO,
      new PayloadWriter()
        .str('Commodore Commander Theia')
        .u16(SRAP_VERSION)
        .u16(SRAP_VERSION)
        .u32(CLIENT_CAPABILITIES)
        .toBuffer()
    );

    await helloAck;
  }

  protected handleSocketData(chunk: Buffer): void {
    this.socketBuffer = Buffer.concat([this.socketBuffer, chunk]);

    while (this.socketBuffer.length >= SRAP_HEADER_BYTES) {
      const payloadLength = this.socketBuffer.readUInt32LE(20);
      if (payloadLength > SRAP_MAX_PAYLOAD_BYTES) {
        this.socket?.destroy(new Error(`SIDScore frame payload too large: ${payloadLength}`));
        return;
      }

      const frameLength = SRAP_HEADER_BYTES + payloadLength;
      if (this.socketBuffer.length < frameLength) {
        return;
      }

      const header = this.socketBuffer.subarray(0, SRAP_HEADER_BYTES);
      const payload = this.socketBuffer.subarray(SRAP_HEADER_BYTES, frameLength);
      this.socketBuffer = this.socketBuffer.subarray(frameLength);

      const magic = header.readUInt32LE(0);
      const version = header.readUInt8(4);
      if (magic !== SRAP_MAGIC || version !== SRAP_VERSION) {
        this.socket?.destroy(
          new Error(`Invalid SIDScore frame header: magic=${magic.toString(16)} version=${version}`)
        );
        return;
      }

      this.handleFrame({
        type: header.readUInt8(5),
        flags: header.readUInt16LE(6),
        sequence: header.readUInt32LE(8),
        timestampNanos: header.readBigUInt64LE(12).toString(),
        payload: Buffer.from(payload)
      });
    }
  }

  protected handleFrame(frame: DecodedFrame): void {
    this.emitProtocolFrame(
      'received',
      frame.type,
      frame.flags,
      frame.sequence,
      frame.timestampNanos,
      frame.payload
    );

    try {
      switch (frame.type) {
        case FRAME_HELLO_ACK:
          this.handleHelloAck(frame.payload);
          break;
        case FRAME_PLAYBACK_STATE: {
          const event = readPlaybackState(frame.payload);
          const terminalPlaybackState = isTerminalPlaybackStateName(event.state);
          const unmatchedTerminalPlaybackState =
            terminalPlaybackState && event.requestId === 0;
          if (
            this.pendingPlaybackRequestId !== undefined &&
            event.requestId !== this.pendingPlaybackRequestId &&
            !unmatchedTerminalPlaybackState
          ) {
            break;
          }
          if (
            event.state === 'loading' ||
            terminalPlaybackState
          ) {
            this.clearPendingTelemetry();
          }
          if (
            event.requestId === this.pendingPlaybackRequestId ||
            unmatchedTerminalPlaybackState
          ) {
            this.pendingPlaybackRequestId = undefined;
          }
          this.client?.onSidScorePlaybackState?.(event);
          break;
        }
        case FRAME_SCORE_MAP:
          this.client?.onSidScoreScoreMap?.(readScoreMap(frame.payload));
          break;
        case FRAME_HIGHLIGHT_STATE:
          this.client?.onSidScoreHighlightState?.(readHighlightState(frame.payload));
          break;
        case FRAME_VOICE_STATE:
          this.queueVoiceState(readVoiceState(frame.payload));
          break;
        case FRAME_SCOPE_BUCKETS:
          this.queueScopeBuckets(readScopeBuckets(frame.payload));
          break;
        case FRAME_SCOPE_SAMPLES:
          this.queueScopeSamples(readScopeSamples(frame.payload));
          break;
        case FRAME_INSTRUMENT_STATE:
          this.client?.onSidScoreInstrumentState?.(readInstrumentState(frame.payload));
          break;
        case FRAME_MIDI_DEVICE_LIST:
          this.client?.onSidScoreMidiDeviceList?.(readMidiDeviceList(frame.payload));
          break;
        case FRAME_MIDI_STATE:
          this.client?.onSidScoreMidiState?.(readMidiState(frame.payload));
          break;
        case FRAME_EXPORT_RESULT: {
          const requestId = frame.payload.length >= 4
            ? frame.payload.readUInt32LE(0)
            : 0;
          try {
            this.resolvePendingExportRequest(requestId, readExportResult(frame.payload));
          } catch (error) {
            this.rejectPendingExportRequest(requestId, toError(error));
            throw error;
          }
          break;
        }
        case FRAME_ERROR:
          this.handleProtocolError(readProtocolError(frame.payload));
          break;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.client?.onSidScoreProtocolError?.({
        requestId: 0,
        code: 2,
        flags: frame.flags,
        message: `Could not decode SIDScore frame 0x${frame.type.toString(16)}: ${message}`
      });
    }
  }

  protected handleHelloAck(payload: Buffer): void {
    const reader = new PayloadReader(payload);
    const selectedVersion = reader.u16();
    reader.u32();
    const serverName = reader.str();
    if (selectedVersion !== SRAP_VERSION) {
      this.helloAckReject?.(
        new Error(`Unsupported SIDScore server protocol version ${selectedVersion} from ${serverName}.`)
      );
      return;
    }
    this.helloAckResolve?.();
    this.helloAckResolve = undefined;
    this.helloAckReject = undefined;
  }

  protected handleProtocolError(error: SidScoreProtocolErrorEvent): void {
    if (this.rejectPendingExportRequest(error.requestId, new Error(error.message))) {
      return;
    }
    if (error.requestId === this.pendingPlaybackRequestId) {
      this.pendingPlaybackRequestId = undefined;
    }
    this.clearPendingTelemetry();
    this.client?.onSidScoreProtocolError?.(error);
    this.helloAckReject?.(new Error(error.message));
    this.helloAckResolve = undefined;
    this.helloAckReject = undefined;
  }

  protected beginPlaybackTransition(requestId: number): void {
    this.pendingPlaybackRequestId = requestId;
    this.clearPendingTelemetry();
  }

  protected queueVoiceState(event: SidScoreVoiceStateEvent): void {
    if (this.pendingPlaybackRequestId !== undefined) {
      return;
    }
    if (
      this.pendingScopeSamples &&
      this.pendingScopeSamples.scoreId !== event.scoreId
    ) {
      this.clearPendingTelemetry();
    }
    this.pendingVoiceState = event;
    this.scheduleTelemetryFlush();
  }

  protected queueScopeBuckets(event: SidScoreScopeBucketsEvent): void {
    if (this.pendingPlaybackRequestId !== undefined) {
      return;
    }
    if (
      this.pendingVoiceState &&
      this.pendingVoiceState.scoreId !== event.scoreId
    ) {
      this.clearPendingTelemetry();
    }
    this.pendingScopeBuckets = event;
    this.scheduleTelemetryFlush();
  }

  protected queueScopeSamples(event: SidScoreScopeSamplesEvent): void {
    if (this.pendingPlaybackRequestId !== undefined) {
      return;
    }
    const pending = this.pendingScopeSamples;
    if (
      !pending ||
      pending.scoreId !== event.scoreId ||
      pending.sampleRate !== event.sampleRate
    ) {
      if (pending && pending.scoreId !== event.scoreId) {
        this.clearPendingTelemetry();
      }
      this.pendingScopeSamples = copyScopeSamples(event);
      this.scheduleTelemetryFlush();
      return;
    }

    this.pendingScopeSamples = appendScopeSamples(pending, event);
    this.scheduleTelemetryFlush();
  }

  protected scheduleTelemetryFlush(): void {
    if (this.telemetryFlushTimer) {
      return;
    }

    this.telemetryFlushTimer = setTimeout(() => {
      this.flushTelemetry();
    }, TELEMETRY_FLUSH_INTERVAL_MS);
  }

  protected flushTelemetry(): void {
    if (this.telemetryFlushTimer) {
      clearTimeout(this.telemetryFlushTimer);
      this.telemetryFlushTimer = undefined;
    }

    const voiceState = this.pendingVoiceState;
    const scopeBuckets = this.pendingScopeBuckets;
    const scopeSamples = this.pendingScopeSamples;
    this.pendingVoiceState = undefined;
    this.pendingScopeBuckets = undefined;
    this.pendingScopeSamples = undefined;

    if (voiceState) {
      this.client?.onSidScoreVoiceState?.(voiceState);
    }
    if (scopeBuckets) {
      this.client?.onSidScoreScopeBuckets?.(scopeBuckets);
    }
    if (scopeSamples) {
      this.client?.onSidScoreScopeSamples?.(scopeSamples);
    }
  }

  protected clearPendingTelemetry(): void {
    if (this.telemetryFlushTimer) {
      clearTimeout(this.telemetryFlushTimer);
      this.telemetryFlushTimer = undefined;
    }
    this.pendingVoiceState = undefined;
    this.pendingScopeBuckets = undefined;
    this.pendingScopeSamples = undefined;
  }

  protected sendFrame(
    type: number,
    payload: Buffer<ArrayBufferLike> = Buffer.alloc(0),
    flags = 0
  ): void {
    if (payload.length > SRAP_MAX_PAYLOAD_BYTES) {
      throw new Error(`SIDScore frame payload too large: ${payload.length}`);
    }

    const socket = this.socket;
    if (!socket || socket.destroyed) {
      throw new Error('SIDScore player server is not connected.');
    }

    const sequence = this.nextSequence();
    const timestamp = process.hrtime.bigint();
    const header = Buffer.alloc(SRAP_HEADER_BYTES);
    header.writeUInt32LE(SRAP_MAGIC, 0);
    header.writeUInt8(SRAP_VERSION, 4);
    header.writeUInt8(type, 5);
    header.writeUInt16LE(flags, 6);
    header.writeUInt32LE(sequence, 8);
    header.writeBigUInt64LE(timestamp, 12);
    header.writeUInt32LE(payload.length, 20);
    socket.write(Buffer.concat([header, payload]));
    this.emitProtocolFrame(
      'sent',
      type,
      flags,
      sequence,
      timestamp.toString(),
      payload
    );
  }

  protected emitProtocolFrame(
    direction: SidScoreProtocolDirection,
    type: number,
    flags: number,
    sequence: number,
    timestampNanos: string,
    payload: Buffer<ArrayBufferLike>
  ): void {
    const event: SidScoreProtocolFrameEvent = {
      direction,
      type,
      typeName: sidScoreFrameTypeName(type),
      flags,
      sequence,
      timestampNanos,
      payloadLength: payload.length,
      payloadPreview: sidScorePayloadPreview(payload),
      requestId: sidScoreFrameRequestId(type, payload)
    };
    this.client?.onSidScoreProtocolFrame?.(event);
  }

  protected nextSequence(): number {
    const current = this.sequence;
    this.sequence = this.sequence >= 0xffff_ffff ? 1 : this.sequence + 1;
    return current;
  }

  protected notifyServerStopped(
    exitCode: number | null,
    signal: NodeJS.Signals | null
  ): void {
    this.clearPendingTelemetry();
    this.rejectPendingExportRequests(
      new Error(`SIDScore player server stopped (${formatExit(exitCode, signal)}).`)
    );
    this.client?.onSidScoreServerStopped?.({
      ...(typeof exitCode === 'number' ? { exitCode } : {}),
      ...(signal ? { signal } : {})
    });
    this.socket?.destroy();
    this.socket = undefined;
    this.serverProcess = undefined;
    this.readyServer = undefined;
    this.pendingPlaybackRequestId = undefined;
  }

  protected stopServerProcess(): void {
    this.clearPendingTelemetry();
    this.rejectPendingExportRequests(
      new Error('SIDScore player server was stopped.')
    );
    this.socket?.destroy();
    this.socket = undefined;
    this.socketBuffer = Buffer.alloc(0);
    if (this.serverProcess && !this.serverProcess.killed) {
      this.serverProcess.stdin?.end();
      this.serverProcess.kill();
    }
    this.serverProcess = undefined;
    this.readyServer = undefined;
    this.pendingPlaybackRequestId = undefined;
  }

  protected isServerProcessRunning(): boolean {
    return Boolean(
      this.serverProcess &&
      !this.serverProcess.killed &&
      this.serverProcess.exitCode === null &&
      this.serverProcess.signalCode === null
    );
  }
}

export function getBundledSidScoreCliJarPath(
  runtimeDirectory = __dirname
): string {
  const candidates = [
    path.join(runtimeDirectory, 'assets', 'sidscore', SID_SCORE_CLI_JAR_FILENAME),
    path.resolve(
      runtimeDirectory,
      '..',
      '..',
      'assets',
      'sidscore',
      SID_SCORE_CLI_JAR_FILENAME
    ),
    path.resolve(
      runtimeDirectory,
      '..',
      '..',
      '..',
      'resources',
      SID_SCORE_CLI_JAR_FILENAME
    )
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

export function createSetInstrumentPayload(
  request: SidScoreSetInstrumentRequest,
  requestId: number
): Buffer {
  const voiceIndex = clampInteger(request.voiceIndex, 1, 3);
  const pulseMin = clampInteger(request.pulseMin, 0, 4095);
  const pulseMax = clampInteger(request.pulseMax, 0, 4095);
  return new PayloadWriter()
    .u32(requestId)
    .u8(voiceIndex)
    .u8(normalizeWaveMask(request.waveMask))
    .u8(clampInteger(request.attack, 0, 15))
    .u8(clampInteger(request.decay, 0, 15))
    .u8(clampInteger(request.sustain, 0, 15))
    .u8(clampInteger(request.release, 0, 15))
    .u16(clampInteger(request.pulseWidth, 0, 4095))
    .i16(clampInteger(request.pulseSweep, -128, 128))
    .u16(Math.min(pulseMin, pulseMax))
    .u16(Math.max(pulseMin, pulseMax))
    .u8(request.filterModeMask & 0x07)
    .u16(clampInteger(request.filterCutoff, 0, 2047))
    .u8(clampInteger(request.filterResonance, 0, 15))
    .u8(request.gateMode === 'legato' ? 1 : 0)
    .u8(clampInteger(request.gateMin, 0, 16))
    .bool8(request.sync)
    .bool8(request.ring)
    .str(request.instrumentName.trim())
    .u8(clampInteger(request.vibratoDelay ?? 0, 0, 255))
    .u8(clampInteger(request.vibratoRate ?? 0, 0, 255))
    .u8(clampInteger(request.vibratoAmp ?? 0, 0, 255))
    .u8(clampInteger(request.vibratoInc ?? 0, 0, 255))
    .toBuffer();
}

class PayloadWriter {
  protected readonly chunks: Buffer[] = [];

  u8(value: number): this {
    const buffer = Buffer.alloc(1);
    buffer.writeUInt8(value & 0xff, 0);
    this.chunks.push(buffer);
    return this;
  }

  u16(value: number): this {
    const buffer = Buffer.alloc(2);
    buffer.writeUInt16LE(value & 0xffff, 0);
    this.chunks.push(buffer);
    return this;
  }

  i16(value: number): this {
    const buffer = Buffer.alloc(2);
    buffer.writeInt16LE(value, 0);
    this.chunks.push(buffer);
    return this;
  }

  u32(value: number): this {
    const buffer = Buffer.alloc(4);
    buffer.writeUInt32LE(value >>> 0, 0);
    this.chunks.push(buffer);
    return this;
  }

  bool8(value: boolean): this {
    return this.u8(value ? 1 : 0);
  }

  str(value: string): this {
    const encoded = Buffer.from(value, 'utf8');
    if (encoded.length > 0xffff) {
      throw new Error(`SIDScore protocol string is too long: ${encoded.length} bytes.`);
    }
    this.u16(encoded.length);
    this.chunks.push(encoded);
    return this;
  }

  bytes(value: Buffer): this {
    this.chunks.push(value);
    return this;
  }

  toBuffer(): Buffer {
    return Buffer.concat(this.chunks);
  }
}

class PayloadReader {
  protected offset = 0;

  constructor(protected readonly buffer: Buffer) {}

  u8(): number {
    this.ensure(1);
    const value = this.buffer.readUInt8(this.offset);
    this.offset += 1;
    return value;
  }

  i8(): number {
    this.ensure(1);
    const value = this.buffer.readInt8(this.offset);
    this.offset += 1;
    return value;
  }

  u16(): number {
    this.ensure(2);
    const value = this.buffer.readUInt16LE(this.offset);
    this.offset += 2;
    return value;
  }

  i16(): number {
    this.ensure(2);
    const value = this.buffer.readInt16LE(this.offset);
    this.offset += 2;
    return value;
  }

  u32(): number {
    this.ensure(4);
    const value = this.buffer.readUInt32LE(this.offset);
    this.offset += 4;
    return value;
  }

  i32(): number {
    this.ensure(4);
    const value = this.buffer.readInt32LE(this.offset);
    this.offset += 4;
    return value;
  }

  u64(): string {
    this.ensure(8);
    const value = this.buffer.readBigUInt64LE(this.offset).toString();
    this.offset += 8;
    return value;
  }

  f32(): number {
    this.ensure(4);
    const value = this.buffer.readFloatLE(this.offset);
    this.offset += 4;
    return value;
  }

  str(): string {
    const length = this.u16();
    this.ensure(length);
    const value = this.buffer.toString('utf8', this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  skip(bytes: number): void {
    this.ensure(bytes);
    this.offset += bytes;
  }

  remaining(): number {
    return this.buffer.length - this.offset;
  }

  protected ensure(bytes: number): void {
    if (this.offset + bytes > this.buffer.length) {
      throw new Error('Short SIDScore protocol payload.');
    }
  }
}

async function assertReadable(
  filePath: string,
  description: string
): Promise<void> {
  try {
    await access(filePath, constants.R_OK);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${description} is not readable: ${filePath}. ${message}`);
  }
}

function getJavaCommand(): string {
  if (process.env.JAVA_HOME) {
    return path.join(
      process.env.JAVA_HOME,
      'bin',
      process.platform === 'win32' ? 'java.exe' : 'java'
    );
  }
  return 'java';
}

function parseReadyEvent(line: string): ReadyEvent | undefined {
  try {
    const parsed = JSON.parse(line) as Partial<ReadyEvent>;
    if (
      parsed.event === 'ready' &&
      parsed.protocol === 'srap-server' &&
      typeof parsed.version === 'number' &&
      typeof parsed.port === 'number'
    ) {
      return parsed as ReadyEvent;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function readCompleteOutputLines(
  buffer: string,
  chunk: string
): { lines: string[]; remainder: string } {
  const combined = `${buffer}${chunk}`;
  const lines: string[] = [];
  let offset = 0;
  let newline = combined.indexOf('\n', offset);
  while (newline >= 0) {
    lines.push(combined.slice(offset, newline).replace(/\r$/u, ''));
    offset = newline + 1;
    newline = combined.indexOf('\n', offset);
  }
  return {
    lines,
    remainder: combined.slice(offset)
  };
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function withExtension(filePath: string, extension: string): string {
  const parsed = path.parse(filePath);
  return path.join(parsed.dir, `${parsed.name}${extension}`);
}

function sidScoreFrameTypeName(type: number): string {
  switch (type) {
    case FRAME_HELLO:
      return 'HELLO';
    case FRAME_HELLO_ACK:
      return 'HELLO_ACK';
    case FRAME_PLAY:
      return 'PLAY';
    case FRAME_PAUSE:
      return 'PAUSE';
    case FRAME_CONTINUE:
      return 'CONTINUE';
    case FRAME_STOP:
      return 'STOP';
    case FRAME_PLAY_SOURCE:
      return 'PLAY_SOURCE';
    case FRAME_SET_INSTRUMENT:
      return 'SET_INSTRUMENT';
    case FRAME_RESET_INSTRUMENT:
      return 'RESET_INSTRUMENT';
    case FRAME_SCAN_MIDI_DEVICES:
      return 'SCAN_MIDI_DEVICES';
    case FRAME_SET_MIDI_SETTINGS:
      return 'SET_MIDI_SETTINGS';
    case FRAME_EXPORT_SOURCE:
      return 'EXPORT_SOURCE';
    case FRAME_PLAYBACK_STATE:
      return 'PLAYBACK_STATE';
    case FRAME_SCORE_MAP:
      return 'SCORE_MAP';
    case FRAME_HIGHLIGHT_STATE:
      return 'HIGHLIGHT_STATE';
    case FRAME_VOICE_STATE:
      return 'VOICE_STATE';
    case FRAME_SCOPE_BUCKETS:
      return 'SCOPE_BUCKETS';
    case FRAME_SCOPE_SAMPLES:
      return 'SCOPE_SAMPLES';
    case FRAME_INSTRUMENT_STATE:
      return 'INSTRUMENT_STATE';
    case FRAME_MIDI_DEVICE_LIST:
      return 'MIDI_DEVICE_LIST';
    case FRAME_MIDI_STATE:
      return 'MIDI_STATE';
    case FRAME_EXPORT_RESULT:
      return 'EXPORT_RESULT';
    case FRAME_ERROR:
      return 'ERROR';
    default:
      return `UNKNOWN_0x${type.toString(16).padStart(2, '0')}`;
  }
}

function sidScorePayloadPreview(payload: Buffer<ArrayBufferLike>): string {
  if (payload.length === 0) {
    return '';
  }

  const preview = payload
    .subarray(0, PROTOCOL_PAYLOAD_PREVIEW_BYTES)
    .toString('hex')
    .match(/.{1,2}/gu)
    ?.join(' ') ?? '';
  return payload.length > PROTOCOL_PAYLOAD_PREVIEW_BYTES
    ? `${preview} ...`
    : preview;
}

function sidScoreFrameRequestId(
  type: number,
  payload: Buffer<ArrayBufferLike>
): number | undefined {
  if (payload.length < 4) {
    return undefined;
  }

  switch (type) {
    case FRAME_PLAY:
    case FRAME_PAUSE:
    case FRAME_CONTINUE:
    case FRAME_STOP:
    case FRAME_PLAY_SOURCE:
    case FRAME_SET_INSTRUMENT:
    case FRAME_RESET_INSTRUMENT:
    case FRAME_SCAN_MIDI_DEVICES:
    case FRAME_SET_MIDI_SETTINGS:
    case FRAME_EXPORT_SOURCE:
    case FRAME_PLAYBACK_STATE:
    case FRAME_INSTRUMENT_STATE:
    case FRAME_MIDI_DEVICE_LIST:
    case FRAME_MIDI_STATE:
    case FRAME_EXPORT_RESULT:
    case FRAME_ERROR:
      return payload.readUInt32LE(0);
    default:
      return undefined;
  }
}

function copyScopeSamples(
  event: SidScoreScopeSamplesEvent
): SidScoreScopeSamplesEvent {
  const voices = event.voices.map((voice) => ({
    voiceIndex: voice.voiceIndex,
    samples: trimScopeSamples([...voice.samples])
  }));
  return {
    ...event,
    sampleCount: scopeSampleCount(voices),
    voices
  };
}

function appendScopeSamples(
  pending: SidScoreScopeSamplesEvent,
  event: SidScoreScopeSamplesEvent
): SidScoreScopeSamplesEvent {
  const pendingByVoice = new Map(
    pending.voices.map((voice) => [voice.voiceIndex, voice.samples])
  );
  const voices = event.voices.map((voice) => ({
    voiceIndex: voice.voiceIndex,
    samples: trimScopeSamples([
      ...(pendingByVoice.get(voice.voiceIndex) ?? []),
      ...voice.samples
    ])
  }));
  const eventVoiceIds = new Set(event.voices.map((voice) => voice.voiceIndex));
  for (const voice of pending.voices) {
    if (!eventVoiceIds.has(voice.voiceIndex)) {
      voices.push({
        voiceIndex: voice.voiceIndex,
        samples: trimScopeSamples([...voice.samples])
      });
    }
  }

  voices.sort((left, right) => left.voiceIndex - right.voiceIndex);
  return {
    ...event,
    sampleCount: scopeSampleCount(voices),
    voices
  };
}

function trimScopeSamples(samples: number[]): number[] {
  if (samples.length <= MAX_PENDING_SCOPE_SAMPLES_PER_VOICE) {
    return samples;
  }
  return samples.slice(samples.length - MAX_PENDING_SCOPE_SAMPLES_PER_VOICE);
}

function scopeSampleCount(
  voices: readonly { samples: readonly number[] }[]
): number {
  return voices.reduce(
    (max, voice) => Math.max(max, voice.samples.length),
    0
  );
}

function readPlaybackState(payload: Buffer) {
  const reader = new PayloadReader(payload);
  return {
    requestId: reader.u32(),
    state: playbackStateName(reader.u8()),
    reason: playbackReasonName(reader.u8()),
    ...(() => {
      reader.u16();
      return {};
    })(),
    scoreId: reader.u64(),
    frameIndex: reader.u64(),
    elapsedNanos: reader.u64()
  };
}

function readScoreMap(payload: Buffer): SidScoreScoreMapEvent {
  const reader = new PayloadReader(payload);
  const scoreId = reader.u64();
  const sourceCount = reader.u16();
  const sources = [];
  for (let index = 0; index < sourceCount; index += 1) {
    sources.push({
      sourceId: reader.u16(),
      resourceUri: reader.str(),
      sourcePath: reader.str()
    });
  }

  const eventCount = reader.u32();
  const events = [];
  for (let index = 0; index < eventCount; index += 1) {
    events.push({
      eventId: reader.i32(),
      voiceIndex: reader.u8(),
      noteKind: noteKindName(reader.u8()),
      flags: reader.u16(),
      startFrame: reader.u64(),
      endFrame: reader.u64(),
      sourceId: reader.u16(),
      startLine: reader.u32(),
      startColumn: reader.u32(),
      endLine: reader.u32(),
      endColumn: reader.u32(),
      displayText: reader.str()
    });
  }

  return {
    scoreId,
    sources,
    events
  };
}

function readHighlightState(payload: Buffer): SidScoreHighlightStateEvent {
  const reader = new PayloadReader(payload);
  return {
    scoreId: reader.u64(),
    frameIndex: reader.u64(),
    activeEventIds: [reader.i32(), reader.i32(), reader.i32()]
  };
}

function readVoiceState(payload: Buffer): SidScoreVoiceStateEvent {
  const reader = new PayloadReader(payload);
  const scoreId = reader.u64();
  const blockIndex = reader.u64();
  const frameIndex = reader.u64();
  const sampleRate = reader.f32();
  const voices = [];

  for (let index = 0; index < 3; index += 1) {
    voices.push({
      voiceIndex: reader.u8(),
      noteKind: noteKindName(reader.u8()),
      noteLetter: noteLetterName(reader.u8()),
      accidental: reader.i8(),
      octave: reader.i8(),
      waveMask: reader.u8(),
      flags: reader.u16(),
      freqReg: reader.u16(),
      pulseWidth: reader.u16(),
      pitchOffsetSemitones: reader.i8(),
      ...(() => {
        reader.skip(3);
        return {};
      })(),
      envelopeLevel: reader.f32(),
      outputLevel: reader.f32()
    });
  }

  return {
    scoreId,
    blockIndex,
    frameIndex,
    sampleRate,
    voices
  };
}

function readScopeBuckets(payload: Buffer): SidScoreScopeBucketsEvent {
  const reader = new PayloadReader(payload);
  const scoreId = reader.u64();
  const blockIndex = reader.u64();
  const sampleRate = reader.f32();
  const bucketCount = reader.u16();
  const samplesPerBucket = reader.u16();
  const voices = [];

  for (let voice = 0; voice < 3; voice += 1) {
    const voiceIndex = reader.u8();
    reader.u8();
    const buckets = [];
    for (let index = 0; index < bucketCount; index += 1) {
      buckets.push({
        minSample: reader.i16(),
        maxSample: reader.i16()
      });
    }
    voices.push({
      voiceIndex,
      buckets
    });
  }

  return {
    scoreId,
    blockIndex,
    sampleRate,
    bucketCount,
    samplesPerBucket,
    voices
  };
}

function readScopeSamples(payload: Buffer): SidScoreScopeSamplesEvent {
  const reader = new PayloadReader(payload);
  const scoreId = reader.u64();
  const blockIndex = reader.u64();
  const sampleRate = reader.f32();
  const sampleCount = reader.u16();
  reader.u16();
  const voices = [];

  for (let voice = 0; voice < 3; voice += 1) {
    const voiceIndex = reader.u8();
    reader.u8();
    const samples = [];
    for (let index = 0; index < sampleCount; index += 1) {
      samples.push(reader.i16());
    }
    voices.push({
      voiceIndex,
      samples
    });
  }

  return {
    scoreId,
    blockIndex,
    sampleRate,
    sampleCount,
    voices
  };
}

export function readInstrumentState(payload: Buffer): SidScoreInstrumentStateEvent {
  const reader = new PayloadReader(payload);
  const requestId = reader.u32();
  const voiceIndex = reader.u8();
  const source = instrumentSourceName(reader.u8());
  reader.u16();
  const instrument = {
    requestId,
    voiceIndex,
    source,
    waveMask: reader.u8(),
    attack: reader.u8(),
    decay: reader.u8(),
    sustain: reader.u8(),
    release: reader.u8(),
    pulseWidth: reader.u16(),
    pulseSweep: reader.i16(),
    pulseMin: reader.u16(),
    pulseMax: reader.u16(),
    filterModeMask: reader.u8(),
    filterCutoff: reader.u16(),
    filterResonance: reader.u8(),
    gateMode: gateModeName(reader.u8()),
    gateMin: reader.u8(),
    sync: reader.u8() !== 0,
    ring: reader.u8() !== 0,
    instrumentName: reader.str(),
    vibratoDelay: 0,
    vibratoRate: 0,
    vibratoAmp: 0,
    vibratoInc: 0
  };
  if (reader.remaining() >= 4) {
    instrument.vibratoDelay = reader.u8();
    instrument.vibratoRate = reader.u8();
    instrument.vibratoAmp = reader.u8();
    instrument.vibratoInc = reader.u8();
  }
  return instrument;
}

function readMidiDeviceList(payload: Buffer): SidScoreMidiDeviceListEvent {
  const reader = new PayloadReader(payload);
  const requestId = reader.u32();
  const deviceCount = reader.u16();
  const devices = [];

  for (let index = 0; index < deviceCount; index += 1) {
    devices.push({
      deviceIndex: reader.u16(),
      selector: reader.str(),
      displayName: reader.str(),
      name: reader.str(),
      vendor: reader.str(),
      description: reader.str(),
      version: reader.str()
    });
  }

  return {
    requestId,
    devices
  };
}

function readMidiState(payload: Buffer): SidScoreMidiStateEvent {
  const reader = new PayloadReader(payload);
  const requestId = reader.u32();
  const enabled = reader.u8() !== 0;
  const assignmentCount = reader.u8();
  reader.u16();
  const assignments = [];

  for (let index = 0; index < assignmentCount; index += 1) {
    assignments.push({
      voiceIndex: reader.u8(),
      voiceEnabled: reader.u8() !== 0,
      channel: reader.u8(),
      ...(() => {
        reader.u8();
        return {};
      })(),
      deviceSelector: reader.str(),
      deviceName: reader.str()
    });
  }

  return {
    requestId,
    enabled,
    assignments
  };
}

function readProtocolError(payload: Buffer): SidScoreProtocolErrorEvent {
  const reader = new PayloadReader(payload);
  return {
    requestId: reader.u32(),
    code: reader.u16(),
    flags: reader.u16(),
    message: reader.str()
  };
}

function readExportResult(payload: Buffer): ExportProtocolResult {
  const reader = new PayloadReader(payload);
  reader.u32();
  const format = exportFormatName(reader.u8());
  reader.skip(3);
  return {
    format,
    outputPath: reader.str(),
    outputByteLength: reader.u64()
  };
}

function noteKindName(value: number): SidScoreNoteKind {
  switch (value) {
    case 1:
      return 'note';
    case 2:
      return 'noise';
    default:
      return 'none';
  }
}

function noteLetterName(value: number): string {
  return ['C', 'D', 'E', 'F', 'G', 'A', 'B'][value] ?? '';
}

function instrumentSourceName(value: number): SidScoreInstrumentSourceName {
  switch (value) {
    case 1:
      return 'score';
    case 2:
      return 'override';
    default:
      return 'default';
  }
}

function gateModeName(value: number): SidScoreGateModeName {
  return value === 1 ? 'legato' : 'retrigger';
}

function playbackStateName(value: number): SidScorePlaybackStateName {
  return ([
    'idle',
    'loading',
    'playing',
    'paused',
    'stopped',
    'ended',
    'error'
  ][value] as SidScorePlaybackStateName | undefined) ?? 'error';
}

function isTerminalPlaybackStateName(state: SidScorePlaybackStateName): boolean {
  return (
    state === 'idle' ||
    state === 'stopped' ||
    state === 'ended' ||
    state === 'error'
  );
}

function playbackReasonName(value: number): SidScorePlaybackReasonName {
  return ([
    'none',
    'client_request',
    'end_of_score',
    'parse_error',
    'playback_error',
    'connection_closed'
  ][value] as SidScorePlaybackReasonName | undefined) ?? 'none';
}

function exportFormatName(value: number): SidScoreExportFormat {
  switch (value) {
    case 1:
      return 'asm';
    case 2:
      return 'prg';
    case 3:
      return 'wav';
    case 4:
      return 'sid';
    default:
      throw new Error(`Unsupported SIDScore export format id: ${value}`);
  }
}

function toSidModelId(model: string | undefined): number {
  switch (model) {
    case '6581':
      return 1;
    case '8580':
      return 2;
    default:
      return 0;
  }
}

function toExportFormatId(format: SidScoreExportFormat): number {
  switch (format) {
    case 'asm':
      return 1;
    case 'prg':
      return 2;
    case 'wav':
      return 3;
    case 'sid':
      return 4;
  }
}

function normalizeWaveMask(value: number): number {
  if (value & 0x08) {
    return 0x08;
  }
  const melodicMask = value & 0x07;
  return melodicMask === 0 ? 0x01 : melodicMask;
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.round(value)));
}

function readJavaRuntimeVersion(
  command: string,
  timeoutMs: number
): Promise<ReturnType<typeof parseJavaRuntimeVersionOutput>> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, ['-version'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';

    const timeout = setTimeout(() => {
      cleanup();
      child.kill('SIGKILL');
      reject(new Error(`Timed out checking Java runtime version: ${command}`));
    }, timeoutMs);

    const cleanup = (): void => {
      clearTimeout(timeout);
      child.stdout.off('data', onOutput);
      child.stderr.off('data', onOutput);
      child.off('error', onError);
      child.off('exit', onExit);
    };
    const onOutput = (chunk: Buffer): void => {
      output += chunk.toString();
    };
    const onError = (error: Error): void => {
      cleanup();
      reject(new Error(`Failed to run Java runtime ${command}: ${error.message}`));
    };
    const onExit = (code: number | null, signal: NodeJS.Signals | null): void => {
      cleanup();
      if (code !== 0) {
        reject(new Error(`Java runtime version check failed (${formatExit(code, signal)}).\n${output}`));
        return;
      }
      try {
        resolve(parseJavaRuntimeVersionOutput(output));
      } catch (error) {
        reject(error);
      }
    };

    child.stdout.on('data', onOutput);
    child.stderr.on('data', onOutput);
    child.once('error', onError);
    child.once('exit', onExit);
  });
}

function formatExit(
  exitCode: number | null,
  signal: NodeJS.Signals | null
): string {
  if (typeof exitCode === 'number') {
    return `exit ${exitCode}`;
  }
  return `signal ${signal ?? 'unknown'}`;
}

function formatSidScoreStartupExitMessage(
  exitCode: number | null,
  signal: NodeJS.Signals | null,
  output: string
): string {
  const base = `SIDScore player server exited before ready (${formatExit(exitCode, signal)}).`;
  if (/UnsupportedClassVersionError/u.test(output)) {
    const requiredJavaRelease = requiredJavaReleaseFromUnsupportedClassVersion(output) ?? 21;
    return `${base} The configured Java runtime is too old for bundled SIDScore. ` +
      `Install Java ${requiredJavaRelease} or newer, or set ` +
      `commodoreCommander.tools.javaRuntime to a Java ${requiredJavaRelease}+ executable.`;
  }

  const compactOutput = output
    .replace(/\s+/gu, ' ')
    .trim();
  if (!compactOutput) {
    return base;
  }

  const maxOutputLength = 500;
  const detail = compactOutput.length > maxOutputLength
    ? `${compactOutput.slice(0, maxOutputLength)}...`
    : compactOutput;
  return `${base} Last server output: ${detail}`;
}

function requiredJavaReleaseFromUnsupportedClassVersion(output: string): number | undefined {
  const match = output.match(/class file version (\d+(?:\.\d+)?)/u);
  if (!match) {
    return undefined;
  }
  const classMajorVersion = Math.trunc(Number(match[1]));
  if (!Number.isInteger(classMajorVersion) || classMajorVersion < 45) {
    return undefined;
  }
  return classMajorVersion - 44;
}

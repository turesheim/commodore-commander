import type { RpcServer } from '@theia/core/lib/common/messaging/proxy-factory';
import type {
  SidScoreSongMetadata
} from './sidscore-subtunes';
export type {
  SidScoreSongMetadata,
  SidScoreSubtuneCatalog,
  SidScoreSubtuneInfo
} from './sidscore-subtunes';

export const SidScoreRuntimeServicePath =
  '/services/commodore-commander/sidscore-runtime';

export const SidScoreRuntimeService = Symbol('SidScoreRuntimeService');

export type SidScoreSidModel = '6581' | '8580';

export interface SidScorePlayRequest {
  resourceUri: string;
  sourceText?: string;
  requestId?: number;
  sidModel?: SidScoreSidModel;
  subtune?: number;
  javaCommand?: string;
}

export interface SidScorePlayResult {
  resourceUri: string;
  subtune: number;
  songMetadata?: SidScoreSongMetadata;
  serverPid?: number;
  command: string;
  args: readonly string[];
  cwd: string;
}

export type SidScoreExportFormat = 'asm' | 'prg' | 'sid' | 'wav';

export interface SidScoreExportRequest {
  resourceUri: string;
  format: SidScoreExportFormat;
  outputUri?: string;
  sourceText?: string;
  requestId?: number;
  sidModel?: SidScoreSidModel;
  subtune?: number;
  javaCommand?: string;
}

export interface SidScoreExportResult {
  resourceUri: string;
  format: SidScoreExportFormat;
  outputUri: string;
  outputPath: string;
  outputByteLength: string;
  subtune: number;
  serverPid?: number;
  command: string;
  args: readonly string[];
  cwd: string;
}

export interface SidScorePlaybackCommandRequest {
  requestId?: number;
}

export type SidScoreInstrumentSourceName = 'default' | 'score' | 'override';

export type SidScoreGateModeName = 'retrigger' | 'legato';

export interface SidScoreInstrumentProperties {
  voiceIndex: number;
  waveMask: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  vibratoDelay: number;
  vibratoRate: number;
  vibratoAmp: number;
  vibratoInc: number;
  pulseWidth: number;
  pulseSweep: number;
  pulseMin: number;
  pulseMax: number;
  filterModeMask: number;
  filterCutoff: number;
  filterResonance: number;
  gateMode: SidScoreGateModeName;
  gateMin: number;
  sync: boolean;
  ring: boolean;
  instrumentName: string;
}

export interface SidScoreSetInstrumentRequest
  extends SidScoreInstrumentProperties {
  requestId?: number;
}

export interface SidScoreResetInstrumentRequest {
  requestId?: number;
  voiceIndex: number;
}

export interface SidScoreInstrumentStateEvent
  extends SidScoreInstrumentProperties {
  requestId: number;
  source: SidScoreInstrumentSourceName;
}

export interface SidScoreMidiDevice {
  deviceIndex: number;
  selector: string;
  displayName: string;
  name: string;
  vendor: string;
  description: string;
  version: string;
}

export interface SidScoreMidiDeviceListEvent {
  requestId: number;
  devices: readonly SidScoreMidiDevice[];
}

export interface SidScoreMidiVoiceAssignment {
  voiceIndex: number;
  voiceEnabled: boolean;
  channel: number;
  deviceSelector: string;
}

export interface SidScoreMidiSettingsRequest {
  requestId?: number;
  enabled: boolean;
  assignments: readonly SidScoreMidiVoiceAssignment[];
}

export interface SidScoreScanMidiDevicesRequest {
  requestId?: number;
}

export interface SidScoreMidiStateAssignment
  extends SidScoreMidiVoiceAssignment {
  deviceName: string;
}

export interface SidScoreMidiStateEvent {
  requestId: number;
  enabled: boolean;
  assignments: readonly SidScoreMidiStateAssignment[];
}

export type SidScorePlaybackStateName =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'stopped'
  | 'ended'
  | 'error';

export type SidScorePlaybackReasonName =
  | 'none'
  | 'client_request'
  | 'end_of_score'
  | 'parse_error'
  | 'playback_error'
  | 'connection_closed';

export interface SidScorePlaybackStateEvent {
  requestId: number;
  state: SidScorePlaybackStateName;
  reason: SidScorePlaybackReasonName;
  scoreId: string;
  frameIndex: string;
  elapsedNanos: string;
}

export interface SidScoreSourceMapEntry {
  sourceId: number;
  resourceUri: string;
  sourcePath: string;
}

export type SidScoreNoteKind = 'none' | 'note' | 'noise';

export interface SidScoreScoreEvent {
  eventId: number;
  voiceIndex: number;
  noteKind: SidScoreNoteKind;
  flags: number;
  startFrame: string;
  endFrame: string;
  sourceId: number;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  displayText: string;
}

export interface SidScoreScoreMapEvent {
  scoreId: string;
  sources: readonly SidScoreSourceMapEntry[];
  events: readonly SidScoreScoreEvent[];
}

export interface SidScoreHighlightStateEvent {
  scoreId: string;
  frameIndex: string;
  activeEventIds: readonly [number, number, number];
}

export interface SidScoreVoiceTelemetry {
  voiceIndex: number;
  noteKind: SidScoreNoteKind;
  noteLetter: string;
  accidental: number;
  octave: number;
  waveMask: number;
  flags: number;
  freqReg: number;
  pulseWidth: number;
  pitchOffsetSemitones: number;
  envelopeLevel: number;
  outputLevel: number;
}

export interface SidScoreVoiceStateEvent {
  scoreId: string;
  blockIndex: string;
  frameIndex: string;
  sampleRate: number;
  voices: readonly SidScoreVoiceTelemetry[];
}

export interface SidScoreScopeBucket {
  minSample: number;
  maxSample: number;
}

export interface SidScoreVoiceScopeBuckets {
  voiceIndex: number;
  buckets: readonly SidScoreScopeBucket[];
}

export interface SidScoreScopeBucketsEvent {
  scoreId: string;
  blockIndex: string;
  sampleRate: number;
  bucketCount: number;
  samplesPerBucket: number;
  voices: readonly SidScoreVoiceScopeBuckets[];
}

export interface SidScoreVoiceScopeSamples {
  voiceIndex: number;
  samples: readonly number[];
}

export interface SidScoreScopeSamplesEvent {
  scoreId: string;
  blockIndex: string;
  sampleRate: number;
  sampleCount: number;
  voices: readonly SidScoreVoiceScopeSamples[];
}

export interface SidScoreProtocolErrorEvent {
  requestId: number;
  code: number;
  flags: number;
  message: string;
}

export type SidScoreProtocolDirection = 'sent' | 'received';

export interface SidScoreProtocolFrameEvent {
  direction: SidScoreProtocolDirection;
  type: number;
  typeName: string;
  flags: number;
  sequence: number;
  timestampNanos: string;
  payloadLength: number;
  payloadPreview: string;
  requestId?: number;
}

export interface SidScoreServerOutputEvent {
  stream: 'stdout' | 'stderr';
  output: string;
}

export interface SidScoreServerStoppedEvent {
  exitCode?: number;
  signal?: string;
}

export interface SidScoreRuntimeClient {
  onSidScorePlaybackState?(event: SidScorePlaybackStateEvent): void;
  onSidScoreScoreMap?(event: SidScoreScoreMapEvent): void;
  onSidScoreHighlightState?(event: SidScoreHighlightStateEvent): void;
  onSidScoreVoiceState?(event: SidScoreVoiceStateEvent): void;
  onSidScoreScopeBuckets?(event: SidScoreScopeBucketsEvent): void;
  onSidScoreScopeSamples?(event: SidScoreScopeSamplesEvent): void;
  onSidScoreInstrumentState?(event: SidScoreInstrumentStateEvent): void;
  onSidScoreMidiDeviceList?(event: SidScoreMidiDeviceListEvent): void;
  onSidScoreMidiState?(event: SidScoreMidiStateEvent): void;
  onSidScoreProtocolFrame?(event: SidScoreProtocolFrameEvent): void;
  onSidScoreProtocolError?(event: SidScoreProtocolErrorEvent): void;
  onSidScoreServerOutput?(event: SidScoreServerOutputEvent): void;
  onSidScoreServerStopped?(event: SidScoreServerStoppedEvent): void;
}

export interface SidScoreRuntimeService
  extends RpcServer<SidScoreRuntimeClient> {
  play(request: SidScorePlayRequest): Promise<SidScorePlayResult>;
  exportScore(request: SidScoreExportRequest): Promise<SidScoreExportResult>;
  pause(request?: SidScorePlaybackCommandRequest): Promise<void>;
  resume(request?: SidScorePlaybackCommandRequest): Promise<void>;
  stop(request?: SidScorePlaybackCommandRequest): Promise<void>;
  setInstrument(request: SidScoreSetInstrumentRequest): Promise<void>;
  resetInstrument(request: SidScoreResetInstrumentRequest): Promise<void>;
  scanMidiDevices(request?: SidScoreScanMidiDevicesRequest): Promise<void>;
  setMidiSettings(request: SidScoreMidiSettingsRequest): Promise<void>;
}

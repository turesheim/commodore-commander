import * as React from 'react';

import { codicon, ReactWidget } from '@theia/core/lib/browser';
import { injectable } from '@theia/core/shared/inversify';

import type {
  SidScoreScopeBucketsEvent,
  SidScoreVoiceScopeBuckets,
  SidScoreScopeSamplesEvent,
  SidScoreVoiceScopeSamples,
  SidScoreSongMetadata,
  SidScoreVoiceStateEvent,
  SidScoreVoiceTelemetry
} from '../common/sidscore-runtime-service';
import {
  createSidScoreScopeDisplay,
  type SidScoreScopeChannel,
  type SidScoreScopeMode
} from './sidscore-scope-visualization';
import {
  createSidScoreSpectrogram,
  SID_SCORE_SPECTROGRAM_MAX_DECIBELS,
  SID_SCORE_SPECTROGRAM_MIN_DECIBELS,
  spectrogramRowForFrequency,
  type SidScoreSpectrogram
} from './sidscore-spectrogram';

export const SID_SCORE_WAVEFORM_WIDGET_ID =
  'commodore-commander.sidscore-waveforms';

const SCOPE_BUFFER_SIZE = 16384;
const SCOPE_DISPLAY_SIZE = 2048;
const SCOPE_AUTO_GAIN_LIMIT = 3.0;
const SCOPE_VERTICAL_HEADROOM = 0.92;
const SCOPE_BG = '#4c3d26';
const SCOPE_TRACE = '#D6CDB6';
const SCOPE_ZERO = 'rgba(214, 205, 182, 0.22)';
const SCOPE_TRIGGER = 'rgba(214, 205, 182, 0.42)';
const SCOPE_WIDTH = 1000;
const SCOPE_HEIGHT = 140;

type SidScoreVisualisationMode = 'waveform' | 'spectrogram';

interface CachedSidScoreSpectrogram {
  readonly revision: number;
  readonly sampleRate: number;
  readonly spectrogram: SidScoreSpectrogram;
}

@injectable()
export class SidScoreWaveformWidget extends ReactWidget {
  protected voiceState: SidScoreVoiceStateEvent | undefined;
  protected scopeBuckets: SidScoreScopeBucketsEvent | undefined;
  protected songMetadata: SidScoreSongMetadata | undefined;
  protected playbackLabel = 'Idle';
  protected visualisationMode: SidScoreVisualisationMode = 'waveform';
  protected scopeMode: SidScoreScopeMode = 'free';
  protected triggerVoice = 1;
  protected scopeSampleRate: number | undefined;
  protected readonly spectrogramCache = new Map<
    number,
    CachedSidScoreSpectrogram
  >();
  protected readonly scopeBuffers = new Map<number, ScopeTraceBuffer>([
    [1, new ScopeTraceBuffer()],
    [2, new ScopeTraceBuffer()],
    [3, new ScopeTraceBuffer()]
  ]);

  constructor() {
    super();
    this.id = SID_SCORE_WAVEFORM_WIDGET_ID;
    this.title.label = 'SIDScore';
    this.title.caption = 'SIDScore Voice Visualiser';
    this.title.iconClass = codicon('pulse');
    this.title.closable = true;
    this.addClass('cc-sidscore-waveforms');
  }

  setPlaybackLabel(label: string): void {
    this.playbackLabel = label;
    this.update();
  }

  setSongMetadata(metadata: SidScoreSongMetadata | undefined): void {
    this.songMetadata = metadata;
    this.update();
  }

  setVoiceState(event: SidScoreVoiceStateEvent): void {
    this.voiceState = event;
    this.update();
  }

  setScopeBuckets(event: SidScoreScopeBucketsEvent): void {
    this.scopeBuckets = event;
    this.setScopeSampleRate(event.sampleRate);
    for (const voiceScope of event.voices) {
      this.scopeBuffers
        .get(voiceScope.voiceIndex)
        ?.appendBuckets(voiceScope, event.samplesPerBucket);
    }
    this.update();
  }

  setScopeSamples(event: SidScoreScopeSamplesEvent): void {
    this.setScopeSampleRate(event.sampleRate);
    for (const voiceScope of event.voices) {
      this.scopeBuffers
        .get(voiceScope.voiceIndex)
        ?.appendSamples(voiceScope);
    }
    this.update();
  }

  clear(playbackLabel = 'Idle'): void {
    this.voiceState = undefined;
    this.scopeBuckets = undefined;
    this.songMetadata = undefined;
    this.playbackLabel = playbackLabel;
    this.scopeSampleRate = undefined;
    this.spectrogramCache.clear();
    for (const buffer of this.scopeBuffers.values()) {
      buffer.clear();
    }
    this.update();
  }

  protected render(): React.ReactNode {
    const songDetails = this.renderSongDetails();
    const snapshots = this.scopeSnapshots();
    const scopeDisplay = this.visualisationMode === 'waveform'
      ? createSidScoreScopeDisplay(
          snapshots,
          this.scopeMode,
          this.triggerVoice,
          SCOPE_DISPLAY_SIZE
        )
      : undefined;
    const voices = [1, 2, 3].map((voiceIndex) => ({
      voiceIndex,
      telemetry: this.voiceState?.voices.find(
        (voice) => voice.voiceIndex === voiceIndex
      ),
      trace:
        (scopeDisplay?.channels ?? snapshots).find(
          (channel) => channel.voiceIndex === voiceIndex
        )?.samples ?? []
    }));

    return (
      <div
        style={{
          background: 'var(--cc-vic20-background, var(--theia-editor-background))',
          color: 'var(--cc-vic20-text, var(--theia-foreground))',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0
        }}
      >
        {this.renderTransport(songDetails)}
        <div
          style={{
            display: 'grid',
            flex: 1,
            gap: '8px',
            gridTemplateRows: 'repeat(3, minmax(56px, 1fr))',
            minHeight: 0,
            padding: '10px'
          }}
        >
          {voices.map(({ voiceIndex, telemetry, trace }) =>
            this.renderVoice(
              voiceIndex,
              telemetry,
              trace,
              scopeDisplay?.triggered
                ? scopeDisplay.triggerPosition
                : undefined
            )
          )}
        </div>
      </div>
    );
  }

  protected renderTransport(songDetails: React.ReactNode): React.ReactNode {
    return (
      <div
        style={{
          background:
            'color-mix(in srgb, var(--cc-vic20-background, var(--theia-editorWidget-background)) 78%, white)',
          borderBottom: '1px solid var(--cc-vic20-highlight, var(--theia-editorGroup-border))',
          color:
            'var(--cc-vic20-label-foreground, var(--theia-descriptionForeground))',
          display: 'flex',
          flexDirection: 'column',
          fontSize: '12px',
          gap: '6px',
          minWidth: 0,
          padding: '6px 10px'
        }}
      >
        <div
          style={{
            alignItems: 'center',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            minWidth: 0
          }}
        >
          <span style={{ flexShrink: 0, fontWeight: 600 }}>
            SIDScore playback
          </span>
          {songDetails}
          <span
            style={{
              color: 'var(--theia-descriptionForeground)',
              flexShrink: 0,
              fontWeight: 500,
              marginLeft: 'auto'
            }}
          >
            {this.playbackLabel}
          </span>
        </div>
        <div className='cc-sidscore-scope-controls'>
          <span className='cc-sidscore-scope-controls__label'>View</span>
          <div
            aria-label='Visualisation mode'
            className='cc-sidscore-scope-segment'
            role='group'
          >
            {(['waveform', 'spectrogram'] as const).map((mode) => (
              <button
                aria-pressed={this.visualisationMode === mode}
                className={`theia-button ${
                  this.visualisationMode === mode ? '' : 'secondary'
                }`}
                key={mode}
                onClick={() => this.setVisualisationMode(mode)}
                title={
                  mode === 'waveform'
                    ? 'Show each voice as amplitude over time.'
                    : 'Show how frequency energy changes over time for each voice; colour represents level in dBFS.'
                }
                type='button'
              >
                {mode === 'waveform' ? 'Waveform' : 'Spectrogram'}
              </button>
            ))}
          </div>
          {this.visualisationMode === 'waveform' ? (
            <>
              <span className='cc-sidscore-scope-controls__label'>Mode</span>
              <div
                aria-label='Scope mode'
                className='cc-sidscore-scope-segment'
                role='group'
              >
                {(['free', 'triggered'] as const).map((mode) => (
                  <button
                    aria-pressed={this.scopeMode === mode}
                    className={`theia-button ${
                      this.scopeMode === mode ? '' : 'secondary'
                    }`}
                    key={mode}
                    onClick={() => this.setScopeMode(mode)}
                    title={
                      mode === 'free'
                        ? 'Show the newest samples continuously without phase alignment.'
                        : 'Stabilise all three waveforms by aligning them to a rising edge in the selected trigger voice.'
                    }
                    type='button'
                  >
                    {mode === 'free' ? 'Free' : 'Triggered'}
                  </button>
                ))}
              </div>
              <span className='cc-sidscore-scope-controls__label'>Trigger</span>
              <div
                aria-label='Trigger voice'
                className='cc-sidscore-scope-segment'
                role='group'
              >
                {[1, 2, 3].map((voiceIndex) => (
                  <button
                    aria-pressed={this.triggerVoice === voiceIndex}
                    className={`theia-button ${
                      this.triggerVoice === voiceIndex ? '' : 'secondary'
                    }`}
                    key={voiceIndex}
                    onClick={() => this.setTriggerVoice(voiceIndex)}
                    title={`Use voice ${voiceIndex} as the common trigger source while preserving the timing between all three waveforms.`}
                    type='button'
                  >
                    V{voiceIndex}
                  </button>
                ))}
              </div>
            </>
          ) : this.renderSpectrogramLegend()}
        </div>
      </div>
    );
  }

  protected setVisualisationMode(mode: SidScoreVisualisationMode): void {
    this.visualisationMode = mode;
    this.update();
  }

  protected setScopeSampleRate(sampleRate: number): void {
    const nextSampleRate = validSampleRate(sampleRate);
    if (
      this.scopeSampleRate !== undefined &&
      nextSampleRate !== undefined &&
      nextSampleRate !== this.scopeSampleRate
    ) {
      for (const buffer of this.scopeBuffers.values()) {
        buffer.clear();
      }
      this.spectrogramCache.clear();
    }
    this.scopeSampleRate = nextSampleRate;
  }

  protected setScopeMode(mode: SidScoreScopeMode): void {
    this.scopeMode = mode;
    this.update();
  }

  protected setTriggerVoice(voiceIndex: number): void {
    this.triggerVoice = voiceIndex;
    this.update();
  }

  protected scopeSnapshots(): readonly SidScoreScopeChannel[] {
    return [1, 2, 3].map((voiceIndex) => ({
      voiceIndex,
      samples: this.scopeBuffers.get(voiceIndex)?.snapshot() ?? []
    }));
  }

  protected renderSongDetails(): React.ReactNode {
    const details = [
      this.songMetadata?.subtune
        ? `Subtune ${this.songMetadata.subtune}`
        : undefined,
      this.songMetadata?.title,
      this.songMetadata?.author,
      this.songMetadata?.released
    ].filter((detail): detail is string => Boolean(detail));
    if (details.length === 0) {
      return undefined;
    }

    return (
      <span
        title={details.join(' - ')}
        style={{
          color: 'var(--theia-foreground)',
          flex: '1 1 auto',
          fontWeight: 500,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {details.map((detail, index) => (
          <React.Fragment key={`${detail}-${index}`}>
            {index > 0 ? ' - ' : ''}
            {detail}
          </React.Fragment>
        ))}
      </span>
    );
  }

  protected renderVoice(
    voiceIndex: number,
    telemetry: SidScoreVoiceTelemetry | undefined,
    trace: readonly number[],
    triggerPosition: number | undefined
  ): React.ReactNode {
    const active = telemetry ? (telemetry.flags & 1) !== 0 : false;
    const note = telemetry ? formatNote(telemetry) : '-';
    return (
      <div
        key={voiceIndex}
        style={{
          border: '1px solid color-mix(in srgb, var(--cc-vic20-highlight, #b88d57) 45%, transparent)',
          display: 'grid',
          gap: '10px',
          gridTemplateColumns: '120px 1fr',
          minHeight: 0,
          padding: '4px 8px'
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            fontSize: '12px',
            gap: 0,
            justifyContent: 'center',
            lineHeight: '12px',
            minWidth: 0
          }}
        >
          <strong style={{ color: voiceColor(voiceIndex) }}>
            Voice {voiceIndex}
          </strong>
          <span>{active ? note : 'silent'}</span>
          <span style={{ color: 'var(--theia-descriptionForeground)' }}>
            {telemetry ? waveMaskLabel(telemetry.waveMask) : '-'}
          </span>
          <span style={{ color: 'var(--theia-descriptionForeground)' }}>
            env {telemetry ? Math.round(telemetry.envelopeLevel * 100) : 0}%
          </span>
        </div>
        {this.visualisationMode === 'waveform' ? (
          <svg
            aria-label={`Voice ${voiceIndex} waveform`}
            preserveAspectRatio='none'
            viewBox={`0 0 ${SCOPE_WIDTH} ${SCOPE_HEIGHT}`}
            style={{
              background: SCOPE_BG,
              height: '100%',
              minHeight: '40px',
              width: '100%'
            }}
          >
            <line
              x1='0'
              y1={SCOPE_HEIGHT / 2}
              x2={SCOPE_WIDTH}
              y2={SCOPE_HEIGHT / 2}
              stroke={SCOPE_ZERO}
              strokeWidth='1'
              vectorEffect='non-scaling-stroke'
            />
            {triggerPosition !== undefined && trace.length > 1 ? (
              <line
                x1={(triggerPosition / (trace.length - 1)) * SCOPE_WIDTH}
                y1='0'
                x2={(triggerPosition / (trace.length - 1)) * SCOPE_WIDTH}
                y2={SCOPE_HEIGHT}
                stroke={SCOPE_TRIGGER}
                strokeDasharray='3 3'
                strokeWidth='1'
                vectorEffect='non-scaling-stroke'
              />
            ) : undefined}
            {renderScopeTrace(trace)}
          </svg>
        ) : this.renderSpectrogram(voiceIndex, trace)}
      </div>
    );
  }

  protected renderSpectrogram(
    voiceIndex: number,
    samples: readonly number[]
  ): React.ReactNode {
    const buffer = this.scopeBuffers.get(voiceIndex);
    const sampleRate = this.scopeSampleRate;
    const cached = this.spectrogramCache.get(voiceIndex);
    let spectrogram = cached?.spectrogram;
    if (
      buffer &&
      sampleRate &&
      (cached?.revision !== buffer.revision ||
        cached.sampleRate !== sampleRate)
    ) {
      spectrogram = createSidScoreSpectrogram(samples, sampleRate);
      this.spectrogramCache.set(voiceIndex, {
        revision: buffer.revision,
        sampleRate,
        spectrogram
      });
    } else if (!buffer || !sampleRate) {
      spectrogram = undefined;
    }
    return (
      <div className='cc-sidscore-spectrogram'>
        <SpectrogramCanvas
          ariaLabel={`Voice ${voiceIndex} spectrogram`}
          spectrogram={spectrogram}
        />
        {spectrogram && spectrogram.width > 0
          ? renderSpectrogramAxes(spectrogram)
          : undefined}
      </div>
    );
  }

  protected renderSpectrogramLegend(): React.ReactNode {
    return (
      <div
        className='cc-sidscore-spectrogram-legend'
        title='Fixed colour scale showing signal level from -96 dBFS to 0 dBFS.'
      >
        <span>{SID_SCORE_SPECTROGRAM_MIN_DECIBELS} dBFS</span>
        <span className='cc-sidscore-spectrogram-legend__scale' />
        <span>{SID_SCORE_SPECTROGRAM_MAX_DECIBELS} dBFS</span>
      </div>
    );
  }
}

interface SpectrogramCanvasProps {
  readonly ariaLabel: string;
  readonly spectrogram: SidScoreSpectrogram | undefined;
}

class SpectrogramCanvas extends React.Component<SpectrogramCanvasProps> {
  protected readonly canvasRef = React.createRef<HTMLCanvasElement>();

  componentDidMount(): void {
    this.draw();
  }

  componentDidUpdate(previous: SpectrogramCanvasProps): void {
    if (previous.spectrogram !== this.props.spectrogram) {
      this.draw();
    }
  }

  render(): React.ReactNode {
    return (
      <canvas
        aria-label={this.props.ariaLabel}
        className='cc-sidscore-spectrogram__canvas'
        height={this.props.spectrogram?.height ?? 1}
        ref={this.canvasRef}
        role='img'
        width={Math.max(1, this.props.spectrogram?.width ?? 0)}
      />
    );
  }

  protected draw(): void {
    const canvas = this.canvasRef.current;
    const spectrogram = this.props.spectrogram;
    if (!canvas) {
      return;
    }
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }
    context.fillStyle = '#1b1f24';
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (!spectrogram || spectrogram.width === 0) {
      return;
    }

    const image = context.createImageData(
      spectrogram.width,
      spectrogram.height
    );
    for (let index = 0; index < spectrogram.intensities.length; index += 1) {
      const [red, green, blue] = spectrogramColour(
        spectrogram.intensities[index] ?? 0
      );
      const pixel = index * 4;
      image.data[pixel] = red;
      image.data[pixel + 1] = green;
      image.data[pixel + 2] = blue;
      image.data[pixel + 3] = 255;
    }
    context.putImageData(image, 0, 0);
  }
}

const SPECTROGRAM_COLOUR_STOPS: readonly (readonly [
  number,
  number,
  number
])[] = [
  [27, 31, 36],
  [37, 74, 102],
  [47, 127, 117],
  [194, 168, 79],
  [245, 239, 202]
];

function renderSpectrogramAxes(
  spectrogram: SidScoreSpectrogram
): React.ReactNode {
  const frequencyTicks = [10000, 1000, 100].filter(
    (frequency) =>
      frequency > spectrogram.minFrequency &&
      frequency < spectrogram.maxFrequency
  );
  return (
    <>
      {frequencyTicks.map((frequency) => {
        const row = spectrogramRowForFrequency(
          frequency,
          spectrogram.height,
          spectrogram.minFrequency,
          spectrogram.maxFrequency
        );
        const top = spectrogram.height > 1
          ? (row / (spectrogram.height - 1)) * 100
          : 0;
        return (
          <div
            className='cc-sidscore-spectrogram__frequency'
            key={frequency}
            style={{ top: `${top}%` }}
          >
            <span>{formatFrequency(frequency)}</span>
          </div>
        );
      })}
      <span className='cc-sidscore-spectrogram__time cc-sidscore-spectrogram__time--start'>
        -{formatTimeSpan(spectrogram.timeSpanSeconds)}
      </span>
      <span className='cc-sidscore-spectrogram__time cc-sidscore-spectrogram__time--end'>
        now
      </span>
    </>
  );
}

function spectrogramColour(
  intensity: number
): readonly [number, number, number] {
  const clamped = Math.max(0, Math.min(1, intensity));
  const position = clamped * (SPECTROGRAM_COLOUR_STOPS.length - 1);
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.min(
    SPECTROGRAM_COLOUR_STOPS.length - 1,
    lowerIndex + 1
  );
  const fraction = position - lowerIndex;
  const lower = SPECTROGRAM_COLOUR_STOPS[lowerIndex] ?? [0, 0, 0];
  const upper = SPECTROGRAM_COLOUR_STOPS[upperIndex] ?? lower;
  return [
    Math.round(lower[0] + (upper[0] - lower[0]) * fraction),
    Math.round(lower[1] + (upper[1] - lower[1]) * fraction),
    Math.round(lower[2] + (upper[2] - lower[2]) * fraction)
  ];
}

function formatFrequency(frequency: number): string {
  if (frequency >= 1000) {
    return `${frequency / 1000} kHz`;
  }
  return `${frequency} Hz`;
}

function formatTimeSpan(seconds: number): string {
  if (seconds < 1) {
    return `${Math.round(seconds * 1000)} ms`;
  }
  return `${seconds.toFixed(1)} s`;
}

function validSampleRate(sampleRate: number): number | undefined {
  return Number.isFinite(sampleRate) && sampleRate > 0
    ? sampleRate
    : undefined;
}

class ScopeTraceBuffer {
  protected readonly samples = new Array<number>(SCOPE_BUFFER_SIZE).fill(0);
  protected writePos = 0;
  protected filled = false;
  protected lastValue = 0;
  protected revisionNumber = 0;

  get revision(): number {
    return this.revisionNumber;
  }

  appendBuckets(
    scope: SidScoreVoiceScopeBuckets,
    samplesPerBucket: number
  ): void {
    const expandedBucketLength = Math.max(1, Math.round(samplesPerBucket));
    for (const bucket of scope.buckets) {
      const min = i16ToFloat(bucket.minSample);
      const max = i16ToFloat(bucket.maxSample);
      if (Math.abs(max - min) < 0.0001) {
        this.appendRepeated(max, expandedBucketLength);
        continue;
      }

      const minFirst =
        Math.abs(this.lastValue - min) <= Math.abs(this.lastValue - max);
      this.appendInterpolated(minFirst ? max : min, expandedBucketLength);
    }
    if (scope.buckets.length > 0) {
      this.revisionNumber += 1;
    }
  }

  appendSamples(scope: SidScoreVoiceScopeSamples): void {
    for (const sample of scope.samples) {
      this.append(i16ToFloat(sample));
    }
    if (scope.samples.length > 0) {
      this.revisionNumber += 1;
    }
  }

  clear(): void {
    this.samples.fill(0);
    this.writePos = 0;
    this.filled = false;
    this.lastValue = 0;
    this.revisionNumber += 1;
  }

  snapshot(): readonly number[] {
    const length = this.filled ? this.samples.length : this.writePos;
    if (length === 0) {
      return [];
    }

    const start = this.filled ? this.writePos : 0;
    return Array.from(
      { length },
      (_value, index) => this.samples[(start + index) % this.samples.length] ?? 0
    );
  }

  protected append(value: number): void {
    this.lastValue = value;
    this.samples[this.writePos] = value;
    this.writePos = (this.writePos + 1) % this.samples.length;
    if (this.writePos === 0) {
      this.filled = true;
    }
  }

  protected appendRepeated(value: number, count: number): void {
    for (let index = 0; index < count; index += 1) {
      this.append(value);
    }
  }

  protected appendInterpolated(target: number, count: number): void {
    if (count <= 1) {
      this.append(target);
      return;
    }

    const start = this.lastValue;
    for (let index = 1; index <= count; index += 1) {
      const position = index / count;
      this.append(start + (target - start) * position);
    }
  }
}

function renderScopeTrace(samples: readonly number[]): React.ReactNode {
  if (samples.length === 0) {
    return undefined;
  }

  const gain = scopeGain(samples);
  return (
    <path
      d={toScopePath(samples, gain)}
      fill='none'
      stroke={SCOPE_TRACE}
      strokeLinejoin='miter'
      strokeLinecap='butt'
      strokeWidth='1.4'
      vectorEffect='non-scaling-stroke'
    />
  );
}

function toScopePath(samples: readonly number[], gain: number): string {
  if (samples.length === 1) {
    return `M 0 ${sampleToY(samples[0] ?? 0, gain)} L ${SCOPE_WIDTH} ${sampleToY(samples[0] ?? 0, gain)}`;
  }

  const last = samples.length - 1;
  const points: string[] = [];
  for (let index = 0; index < samples.length; index += 1) {
    const x = (index / last) * SCOPE_WIDTH;
    const y = sampleToY(samples[index] ?? 0, gain);
    points.push(`${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return points.join(' ');
}

function scopeGain(samples: readonly number[]): number {
  const peak = samples.reduce(
    (max, sample) => Math.max(max, Math.abs(sample)),
    0
  );
  if (peak <= 0) {
    return 1;
  }
  return Math.min(SCOPE_AUTO_GAIN_LIMIT, SCOPE_VERTICAL_HEADROOM / peak);
}

function sampleToY(sample: number, gain: number): number {
  const normalized = Math.max(-1, Math.min(1, sample * gain));
  const mid = SCOPE_HEIGHT / 2;
  return mid - normalized * (mid - 6);
}

function i16ToFloat(sample: number): number {
  return Math.max(-1, Math.min(1, sample / 32768));
}

function formatNote(voice: SidScoreVoiceTelemetry): string {
  if (voice.noteKind === 'noise') {
    return 'noise';
  }
  if (voice.noteKind !== 'note' || !voice.noteLetter) {
    return '-';
  }
  const accidental = voice.accidental < 0 ? 'b' : voice.accidental > 0 ? '#' : '';
  return `${voice.noteLetter}${accidental}${voice.octave}`;
}

function waveMaskLabel(mask: number): string {
  const names = [
    [1, 'PULSE'],
    [2, 'SAW'],
    [4, 'TRI'],
    [8, 'NOISE']
  ]
    .filter(([bit]) => (mask & Number(bit)) !== 0)
    .map(([, label]) => label);
  return names.length > 0 ? names.join('+') : '-';
}

function voiceColor(voiceIndex: number): string {
  switch (voiceIndex) {
    case 1:
      return '#2b8a3e';
    case 2:
      return '#1c6dd0';
    case 3:
      return '#b15d00';
    default:
      return 'var(--cc-vic20-highlight, #b88d57)';
  }
}

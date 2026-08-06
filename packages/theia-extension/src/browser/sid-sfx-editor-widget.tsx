import * as React from 'react';

import { codicon, ReactWidget } from '@theia/core/lib/browser';
import { Message, Widget } from '@theia/core/lib/browser/widgets/widget';
import { MessageService } from '@theia/core/lib/common/message-service';
import { inject, injectable } from '@theia/core/shared/inversify';
import * as monaco from '@theia/monaco-editor-core';

import {
  SidScoreRuntimeService,
  type SidScoreRuntimeService as SidScoreRuntimeServiceProxy,
  type SidScoreSidModel
} from '../common/sidscore-runtime-service';
import {
  buildSidSfxSource,
  createSidSfxSettings,
  formatSidSfxHexWord,
  normalizeSidSfxSettings,
  SID_SFX_CURVES,
  SID_SFX_NOTES,
  SID_SFX_PRESETS,
  SID_SFX_RETRIGGER_MODES,
  type SidSfxCurve,
  type SidSfxEffectSettings,
  type SidSfxPresetId,
  type SidSfxRetriggerMode,
  type SidSfxVoice,
  type SidSfxWave
} from '../common/sid-sfx-effect';
import { SID_SCORE_LANGUAGE_ID } from './sidscore-language-contribution';

export const SID_SFX_EDITOR_WIDGET_ID = 'commodoreCommander.sidSfxEditor';

interface WaveButton {
  readonly id: SidSfxWave;
  readonly label: string;
  readonly title: string;
}

const WAVE_BUTTONS: readonly WaveButton[] = [
  {
    id: 'TRI',
    label: 'TRI',
    title: 'Triangle waveform, useful for soft game tones and jumps.'
  },
  {
    id: 'SAW',
    label: 'SAW',
    title: 'Sawtooth waveform, useful for bright sweeps and arcade tones.'
  },
  {
    id: 'PULSE',
    label: 'PULSE',
    title: 'Pulse waveform, useful for narrow animated tones and lasers.'
  },
  {
    id: 'NOISE',
    label: 'NOISE',
    title: 'Noise waveform, useful for hits, bursts, and explosions.'
  }
];

const PREVIEW_RESOURCE_URI =
  'file:///tmp/commodore-commander-sid-sfx-preview.sidscore';
const SOURCE_EDITOR_URI = monaco.Uri.parse(
  'inmemory://commodore-commander/sid-sfx-preview.sidscore'
);

@injectable()
export class SidSfxEditorWidget extends ReactWidget {
  @inject(SidScoreRuntimeService)
  protected readonly sidScoreRuntimeService!: SidScoreRuntimeServiceProxy;

  @inject(MessageService)
  protected readonly messageService!: MessageService;

  protected settings = createSidSfxSettings();
  protected sidModel: SidScoreSidModel = '6581';
  protected nextRequestId = 1;
  protected previewBusy = false;
  protected sourceEditor: monaco.editor.IStandaloneCodeEditor | undefined;
  protected sourceEditorModel: monaco.editor.ITextModel | undefined;
  protected sourceEditorHost: HTMLDivElement | undefined;

  constructor() {
    super();
    this.id = SID_SFX_EDITOR_WIDGET_ID;
    this.title.label = 'SID SFX';
    this.title.caption = 'SID SFX Editor';
    this.title.iconClass = codicon('pulse');
    this.title.closable = false;
    this.addClass('cc-sid-sfx-widget');
  }

  override dispose(): void {
    this.sourceEditor?.dispose();
    this.sourceEditorModel?.dispose();
    this.sourceEditor = undefined;
    this.sourceEditorModel = undefined;
    this.sourceEditorHost = undefined;
    super.dispose();
  }

  protected override onAfterAttach(msg: Message): void {
    super.onAfterAttach(msg);
    this.update();
    this.ensureSourceEditor();
  }

  protected override onUpdateRequest(msg: Message): void {
    super.onUpdateRequest(msg);
    this.ensureSourceEditor();
    this.updateSourceEditor();
    this.resizeSourceEditor();
  }

  protected override onResize(msg: Widget.ResizeMessage): void {
    super.onResize(msg);
    this.resizeSourceEditor();
  }

  protected override onActivateRequest(msg: Message): void {
    super.onActivateRequest(msg);
    this.node.focus();
  }

  protected render(): React.ReactNode {
    const sourceText = buildSidSfxSource(this.settings);
    return (
      <div className='cc-sid-sfx'>
        {this.renderHeader()}
        <div className='cc-sid-sfx__sections'>
          {this.renderShapeSection()}
          {this.renderEnvelopeSection()}
          {this.renderPulseSection()}
          {this.renderPlaybackSection(sourceText)}
        </div>
      </div>
    );
  }

  protected renderHeader(): React.ReactNode {
    return (
      <div className='cc-sid-sfx__header'>
        <label className='cc-sid-field' title='Selects a starting point for the generated one-shot effect.'>
          <span className='cc-sid-field__label'>Preset</span>
          <select
            className='cc-sid-field__control'
            value={this.settings.preset}
            aria-label='SFX preset'
            onChange={(event) => this.setPreset(event.currentTarget.value)}
          >
            {SID_SFX_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>
        <label className='cc-sid-field' title='Name used for the generated SIDScore EFFECT block.'>
          <span className='cc-sid-field__label'>Effect</span>
          <input
            className='cc-sid-field__control'
            type='text'
            aria-label='Effect name'
            value={this.settings.name}
            onChange={(event) => this.setSettings({ name: event.currentTarget.value })}
          />
        </label>
        <label className='cc-sid-field' title='SID chip model used for preview playback.'>
          <span className='cc-sid-field__label'>SID</span>
          <select
            className='cc-sid-field__control'
            value={this.sidModel}
            aria-label='SID model'
            onChange={(event) => this.setSidModel(event.currentTarget.value)}
          >
            <option value='6581'>6581</option>
            <option value='8580'>8580</option>
          </select>
        </label>
      </div>
    );
  }

  protected renderShapeSection(): React.ReactNode {
    return (
      <section className='cc-sid-section cc-sid-section--visualization'>
        <h3 className='cc-sid-section__label'>Shape</h3>
        <div className='cc-sid-section__body'>
          {this.renderVisualization()}
          <div className='cc-sid-wave-grid'>
            {WAVE_BUTTONS.map((wave) => this.renderWaveButton(wave))}
          </div>
          <div className='cc-sid-sfx-grid cc-sid-sfx-grid--three'>
            {this.renderNumberField(
              'Length',
              this.settings.lengthTicks,
              1,
              255,
              (lengthTicks) => this.setSettings({ lengthTicks }),
              'Total effect duration in SIDScore ticks.'
            )}
            {this.renderNumberField(
              'Gate Off',
              this.settings.gateOffTick,
              0,
              this.settings.lengthTicks,
              (gateOffTick) => this.setSettings({ gateOffTick }),
              'Tick where GATE is cleared so release can play.'
            )}
            <label className='cc-sid-field' title='Voice ANY lets SIDScore choose an available effect voice.'>
              <span className='cc-sid-field__label'>Voice</span>
              <select
                className='cc-sid-field__control'
                value={this.settings.voice}
                aria-label='Effect voice'
                onChange={(event) =>
                  this.setSettings({ voice: event.currentTarget.value as SidSfxVoice })
                }
              >
                <option value='any'>ANY</option>
                <option value='1'>1</option>
                <option value='2'>2</option>
                <option value='3'>3</option>
              </select>
            </label>
          </div>
          <div className='cc-sid-sfx-grid cc-sid-sfx-grid--three'>
            {this.renderPitchField(
              'Start',
              this.settings.startPitch,
              (startPitch) => this.setSettings({ startPitch }),
              'Initial pitch or noise frequency.'
            )}
            {this.renderPitchField(
              'End',
              this.settings.endPitch,
              (endPitch) => this.setSettings({ endPitch }),
              'Pitch reached by the generated sweep.'
            )}
            <label className='cc-sid-field' title='Curve used by the generated pitch sweep.'>
              <span className='cc-sid-field__label'>Curve</span>
              <select
                className='cc-sid-field__control'
                value={this.settings.pitchCurve}
                disabled={!this.settings.pitchSweep}
                aria-label='Pitch sweep curve'
                onChange={(event) =>
                  this.setSettings({ pitchCurve: event.currentTarget.value as SidSfxCurve })
                }
              >
                {SID_SFX_CURVES.map((curve) => (
                  <option key={curve} value={curve}>
                    {curve}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className='cc-sid-sfx-grid cc-sid-sfx-grid--three'>
            {this.renderToggleField(
              'Pitch Sweep',
              this.settings.pitchSweep,
              (pitchSweep) => this.setSettings({ pitchSweep }),
              'Generates a SIDScore pitch sequence inside the effect.'
            )}
            {this.renderNumberField(
              'Priority',
              this.settings.priority,
              0,
              255,
              (priority) => this.setSettings({ priority }),
              'Higher priority effects win when voices are scarce.'
            )}
            <label className='cc-sid-field' title='How repeated triggers of the same effect are handled by the player.'>
              <span className='cc-sid-field__label'>Retrigger</span>
              <select
                className='cc-sid-field__control'
                value={this.settings.retrigger}
                aria-label='Retrigger mode'
                onChange={(event) =>
                  this.setSettings({
                    retrigger: event.currentTarget.value as SidSfxRetriggerMode
                  })
                }
              >
                {SID_SFX_RETRIGGER_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </section>
    );
  }

  protected renderEnvelopeSection(): React.ReactNode {
    return (
      <section className='cc-sid-section'>
        <h3 className='cc-sid-section__label'>Envelope</h3>
        <div className='cc-sid-section__body'>
          <div className='cc-sid-sfx-slider-grid'>
            {this.renderSlider(
              'A',
              this.settings.attack,
              0,
              15,
              (attack) => this.setSettings({ attack }),
              'SID attack value.'
            )}
            {this.renderSlider(
              'D',
              this.settings.decay,
              0,
              15,
              (decay) => this.setSettings({ decay }),
              'SID decay value.'
            )}
            {this.renderSlider(
              'S',
              this.settings.sustain,
              0,
              15,
              (sustain) => this.setSettings({ sustain }),
              'SID sustain value.'
            )}
            {this.renderSlider(
              'R',
              this.settings.release,
              0,
              15,
              (release) => this.setSettings({ release }),
              'SID release value.'
            )}
            {this.renderSlider(
              'Volume',
              this.settings.volume,
              0,
              15,
              (volume) => this.setSettings({ volume }),
              'Master SID volume value emitted with this effect preview.'
            )}
          </div>
        </div>
      </section>
    );
  }

  protected renderPulseSection(): React.ReactNode {
    const pulseEnabled = this.settings.wave === 'PULSE';
    return (
      <section className='cc-sid-section'>
        <h3 className='cc-sid-section__label'>Pulse</h3>
        <div className='cc-sid-section__body'>
          <div className='cc-sid-sfx-grid cc-sid-sfx-grid--three'>
            {this.renderNumberField(
              'Width',
              this.settings.pulseWidth,
              0,
              0x0fff,
              (pulseWidth) => this.setSettings({ pulseWidth }),
              'Starting pulse width.',
              !pulseEnabled,
              (value) => formatSidSfxHexWord(value)
            )}
            {this.renderNumberField(
              'End',
              this.settings.pulseEnd,
              0,
              0x0fff,
              (pulseEnd) => this.setSettings({ pulseEnd }),
              'Pulse width reached by the generated sweep.',
              !pulseEnabled || !this.settings.pulseSweep,
              (value) => formatSidSfxHexWord(value)
            )}
            {this.renderToggleField(
              'PW Sweep',
              this.settings.pulseSweep,
              (pulseSweep) => this.setSettings({ pulseSweep }),
              'Generates a SIDScore pulse width sweep inside the effect.',
              !pulseEnabled
            )}
          </div>
        </div>
      </section>
    );
  }

  protected renderPlaybackSection(sourceText: string): React.ReactNode {
    return (
      <section className='cc-sid-section cc-sid-section--source'>
        <h3 className='cc-sid-section__label'>Source</h3>
        <div className='cc-sid-section__body'>
          <div className='cc-sid-sfx-actions'>
            <button
              type='button'
              className='cc-sid-button'
              disabled={this.previewBusy}
              title='Preview the generated one-shot effect.'
              onClick={() => this.previewEffect()}
            >
              <span className={codicon('play')} aria-hidden='true' />
              Preview
            </button>
            <button
              type='button'
              className='cc-sid-button'
              title='Stop SIDScore preview playback.'
              onClick={() => this.stopPreview()}
            >
              <span className={codicon('debug-stop')} aria-hidden='true' />
              Stop
            </button>
            <button
              type='button'
              className='cc-sid-button'
              title='Copy the generated SIDScore effect source.'
              onClick={() => this.copySource(sourceText)}
            >
              <span className={codicon('copy')} aria-hidden='true' />
              Copy
            </button>
          </div>
          <div
            className='cc-sid-sfx-source-editor'
            aria-label='Generated SIDScore effect source'
            ref={this.setSourceEditorHost}
          />
        </div>
      </section>
    );
  }

  protected renderVisualization(): React.ReactNode {
    const settings = normalizeSidSfxSettings(this.settings);
    const envelope = this.envelopePolyline(settings);
    const pitch = this.pitchPolyline(settings);
    const gateX = 10 + (settings.gateOffTick / settings.lengthTicks) * 260;
    return (
      <svg
        className='cc-sid-sfx-visualization'
        viewBox='0 0 280 104'
        role='img'
        aria-label='SID sound effect shape'
        preserveAspectRatio='none'
      >
        <line className='cc-sid-visualization__grid' x1='10' y1='27.5' x2='270' y2='27.5' />
        <line className='cc-sid-visualization__grid' x1='10' y1='52' x2='270' y2='52' />
        <line className='cc-sid-visualization__grid' x1='10' y1='76.5' x2='270' y2='76.5' />
        <polyline
          className='cc-sid-sfx-visualization__envelope'
          points={envelope}
        />
        <polyline
          className='cc-sid-sfx-visualization__pitch'
          points={pitch}
        />
        <line
          className='cc-sid-sfx-visualization__gate'
          x1={gateX}
          y1='10'
          x2={gateX}
          y2='92'
        />
        <text className='cc-sid-visualization__label' x='42' y='98'>ADSR</text>
        <text className='cc-sid-visualization__label' x='236' y='98'>PITCH</text>
      </svg>
    );
  }

  protected renderWaveButton(wave: WaveButton): React.ReactNode {
    const active = this.settings.wave === wave.id;
    return (
      <button
        key={wave.id}
        type='button'
        className={active ? 'cc-sid-button cc-sid-button--active' : 'cc-sid-button'}
        aria-pressed={active}
        title={wave.title}
        onClick={() => this.setSettings({ wave: wave.id })}
      >
        {wave.label}
      </button>
    );
  }

  protected renderPitchField(
    label: string,
    value: string,
    onChange: (value: string) => void,
    title: string
  ): React.ReactNode {
    return (
      <label className='cc-sid-field' title={title}>
        <span className='cc-sid-field__label'>{label}</span>
        <select
          className='cc-sid-field__control'
          value={value}
          aria-label={`${label} pitch`}
          onChange={(event) => onChange(event.currentTarget.value)}
        >
          {SID_SFX_NOTES.map((note) => (
            <option key={note} value={note}>
              {note}
            </option>
          ))}
        </select>
      </label>
    );
  }

  protected renderNumberField(
    label: string,
    value: number,
    min: number,
    max: number,
    onChange: (value: number) => void,
    title: string,
    disabled = false,
    format?: (value: number) => string
  ): React.ReactNode {
    return (
      <label className='cc-sid-field' title={title}>
        <span className='cc-sid-field__label'>{label}</span>
        <input
          className='cc-sid-field__control'
          type='number'
          min={min}
          max={max}
          step='1'
          value={value}
          aria-label={label}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.currentTarget.value))}
        />
        {format && <span className='cc-sid-sfx-readout'>{format(value)}</span>}
      </label>
    );
  }

  protected renderToggleField(
    label: string,
    checked: boolean,
    onChange: (checked: boolean) => void,
    title: string,
    disabled = false
  ): React.ReactNode {
    return (
      <label
        className={
          disabled
            ? 'cc-sid-sfx-toggle cc-sid-sfx-toggle--disabled'
            : 'cc-sid-sfx-toggle'
        }
        title={title}
      >
        <input
          type='checkbox'
          checked={checked}
          disabled={disabled}
          aria-label={label}
          onChange={(event) => onChange(event.currentTarget.checked)}
        />
        <span>{label}</span>
      </label>
    );
  }

  protected renderSlider(
    label: string,
    value: number,
    min: number,
    max: number,
    onChange: (value: number) => void,
    title: string
  ): React.ReactNode {
    return (
      <label className='cc-sid-sfx-slider' title={title}>
        <span className='cc-sid-sfx-slider__label'>
          <span>{label}</span>
          <span>{value}</span>
        </span>
        <input
          className='cc-sid-sfx-slider__input'
          type='range'
          min={min}
          max={max}
          step='1'
          value={value}
          aria-label={label}
          onChange={(event) => onChange(Number(event.currentTarget.value))}
        />
      </label>
    );
  }

  protected setPreset(value: string): void {
    this.settings = createSidSfxSettings(toPresetId(value));
    this.updateSourceEditor();
    this.update();
  }

  protected setSettings(patch: Partial<SidSfxEffectSettings>): void {
    this.settings = normalizeSidSfxSettings({
      ...this.settings,
      ...patch
    });
    this.updateSourceEditor();
    this.update();
  }

  protected setSidModel(value: string): void {
    this.sidModel = value === '8580' ? '8580' : '6581';
    this.update();
  }

  protected async previewEffect(): Promise<void> {
    this.previewBusy = true;
    this.update();
    try {
      await this.sidScoreRuntimeService.play({
        resourceUri: PREVIEW_RESOURCE_URI,
        sourceText: buildSidSfxSource(this.settings),
        requestId: this.nextSidScoreRequestId(),
        sidModel: this.sidModel,
        subtune: 1
      });
    } catch (error) {
      this.messageService.error(
        `Unable to preview SID SFX: ${errorMessage(error)}`
      );
    } finally {
      this.previewBusy = false;
      this.update();
    }
  }

  protected async stopPreview(): Promise<void> {
    try {
      await this.sidScoreRuntimeService.stop({
        requestId: this.nextSidScoreRequestId()
      });
    } catch (error) {
      this.messageService.error(
        `Unable to stop SID SFX preview: ${errorMessage(error)}`
      );
    }
  }

  protected async copySource(sourceText: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(sourceText);
      this.messageService.info('Copied SIDScore effect source.');
    } catch (error) {
      this.messageService.error(
        `Unable to copy SIDScore effect source: ${errorMessage(error)}`
      );
    }
  }

  protected nextSidScoreRequestId(): number {
    const requestId = this.nextRequestId;
    this.nextRequestId = (this.nextRequestId % 0x7fffffff) + 1;
    return requestId;
  }

  protected readonly setSourceEditorHost = (
    node: HTMLDivElement | null
  ): void => {
    this.sourceEditorHost = node ?? undefined;
    if (node) {
      this.ensureSourceEditor();
    }
  };

  protected ensureSourceEditor(): void {
    if (
      this.sourceEditor ||
      !this.sourceEditorHost
    ) {
      return;
    }
    this.createSourceEditor(this.sourceEditorHost);
  }

  protected createSourceEditor(host: HTMLDivElement): void {
    this.sourceEditorModel =
      monaco.editor.getModel(SOURCE_EDITOR_URI) ??
      monaco.editor.createModel(
        buildSidSfxSource(this.settings),
        SID_SCORE_LANGUAGE_ID,
        SOURCE_EDITOR_URI
      );
    monaco.editor.setModelLanguage(
      this.sourceEditorModel,
      SID_SCORE_LANGUAGE_ID
    );
    this.sourceEditor = monaco.editor.create(host, {
      model: this.sourceEditorModel,
      readOnly: true,
      lineNumbers: 'on',
      folding: true,
      wordWrap: 'off',
      minimap: { enabled: false },
      renderLineHighlight: 'none',
      scrollBeyondLastLine: false,
      automaticLayout: true,
      overviewRulerLanes: 0,
      fixedOverflowWidgets: true,
      scrollbar: {
        horizontal: 'auto',
        vertical: 'auto'
      }
    });
    this.updateSourceEditor();
    this.resizeSourceEditor();
  }

  protected updateSourceEditor(): void {
    const model = this.sourceEditorModel;
    if (!model || model.isDisposed()) {
      return;
    }
    const sourceText = buildSidSfxSource(this.settings);
    if (model.getValue() !== sourceText) {
      model.setValue(sourceText);
    }
  }

  protected resizeSourceEditor(): void {
    if (!this.sourceEditor) {
      return;
    }
    requestAnimationFrame(() => {
      this.sourceEditor?.layout();
    });
  }

  protected envelopePolyline(settings: SidSfxEffectSettings): string {
    const left = 10;
    const right = 270;
    const top = 12;
    const bottom = 88;
    const width = right - left;
    const gateX = left + (settings.gateOffTick / settings.lengthTicks) * width;
    const attackX = Math.min(
      gateX,
      left + Math.max(4, (settings.attack / 15) * 58)
    );
    const decayX = Math.min(
      gateX,
      attackX + Math.max(4, (settings.decay / 15) * 58)
    );
    const sustainY =
      bottom - (settings.sustain / 15) * (bottom - top);
    return [
      `${left},${bottom}`,
      `${attackX},${top}`,
      `${decayX},${sustainY}`,
      `${gateX},${sustainY}`,
      `${right},${bottom}`
    ].join(' ');
  }

  protected pitchPolyline(settings: SidSfxEffectSettings): string {
    const left = 10;
    const right = 270;
    const startY = pitchY(settings.startPitch);
    const endY =
      settings.pitchSweep && settings.startPitch !== settings.endPitch
        ? pitchY(settings.endPitch)
        : startY;
    return `${left},${startY} ${right},${endY}`;
  }
}

function pitchY(note: string): number {
  const noteIndex = SID_SFX_NOTES.indexOf(note as typeof SID_SFX_NOTES[number]);
  const normalizedIndex = noteIndex >= 0 ? noteIndex : 0;
  return 84 - (normalizedIndex / (SID_SFX_NOTES.length - 1)) * 68;
}

function toPresetId(value: string): SidSfxPresetId {
  return SID_SFX_PRESETS.some((preset) => preset.id === value)
    ? (value as SidSfxPresetId)
    : 'blip';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

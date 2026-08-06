import * as React from 'react';

import {
  codicon,
  ReactWidget,
  TooltipService,
  type TooltipAttributes
} from '@theia/core/lib/browser';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { MessageService } from '@theia/core/lib/common/message-service';
import { inject, injectable } from '@theia/core/shared/inversify';

import {
  SidScoreRuntimeService,
  type SidScoreGateModeName,
  type SidScoreInstrumentSourceName,
  type SidScoreInstrumentStateEvent,
  type SidScoreMidiDevice,
  type SidScoreMidiDeviceListEvent,
  type SidScoreMidiStateEvent,
  type SidScoreMidiVoiceAssignment,
  type SidScoreRuntimeService as SidScoreRuntimeServiceProxy,
  type SidScoreSetInstrumentRequest,
  type SidScoreSidModel
} from '../common/sidscore-runtime-service';
import {
  planMidiModeActivationSync,
  shouldStartInitialMidiDeviceScan
} from './sid-instrument-midi-scan';
import {
  DEFAULT_MIDI_MODE,
  isMidiEnabledForMode,
  toMidiMode,
  type MidiModeId
} from './sid-instrument-midi-mode';
import { isSidInstrumentProtocolNumericControl } from './sid-instrument-protocol-controls';
import {
  createSidAdsrEnvelopeVisualization,
  type SidAdsrEnvelopeVisualization
} from './sid-instrument-visualization';

export const SID_INSTRUMENT_CONTROL_WIDGET_ID =
  'commodoreCommander.sidInstrumentControls';

type WaveformId = 'triangle' | 'saw' | 'pulse' | 'noise';
type ToggleId = 'ringMod' | 'sync' | 'hardRestart' | 'waveTable' | 'pulseTable' | 'filterTable';
type FilterModeId = 'low' | 'band' | 'high';

const NUMERIC_DEFAULTS = {
  attack: 1,
  decay: 4,
  sustain: 10,
  release: 3,
  gateMin: 0,
  vibratoDelay: 15,
  vibratoRate: 14,
  vibratoAmp: 0,
  vibratoInc: 16,
  pulseWidth: 1536,
  pulseSweep: 9,
  pulseMin: 1024,
  pulseMax: 3072,
  filterCutoff: 1500,
  filterSweep: 0,
  filterMin: 0,
  filterMax: 2047,
  filterResonance: 2
} as const;

type NumericControlId = keyof typeof NUMERIC_DEFAULTS;

interface KnobDefinition {
  readonly id: NumericControlId;
  readonly label: string;
  readonly ariaLabel: string;
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  readonly format?: (value: number) => string;
  readonly title: string;
}

interface WaveformDefinition {
  readonly id: WaveformId;
  readonly label: string;
  readonly title: string;
}

interface ToggleDefinition {
  readonly id: ToggleId;
  readonly label: string;
  readonly title: string;
}

interface FilterModeDefinition {
  readonly id: FilterModeId;
  readonly label: string;
  readonly sidLabel: string;
  readonly title: string;
}

// Tooltip copy follows MOS 6581 SID register behavior documented in the
// Commodore 64 Programmer's Reference Guide and the 6581 SID datasheet.
// SIDScore-only sequencing/articulation controls call that out explicitly.
const CONTROL_TITLES = {
  instrumentName:
    'Name for the live SIDScore instrument override. This is metadata sent with the current voice settings; it is not a SID register.',
  selectedVoice:
    'Selects which of the SID chip\'s three voices this instrument override edits. Each SID voice has its own frequency, waveform, and ADSR registers.',
  chipModel:
    'Selects the target SID model. The 6581 and 8580 share these control registers, but their analog filter response and level behavior differ.',
  gateMode:
    'Controls how notes use the SID GATE bit. Retrigger clears and sets GATE for a fresh attack; Legato keeps GATE on while changing pitch.',
  filterOff:
    'Bypasses SID filter routing for this voice. With the filter off, cutoff and resonance are ignored.',
  reset:
    'Clears the live instrument override for the selected voice and returns it to the score or runtime default instrument.',
  source:
    'Shows whether the selected voice is using the runtime default, a score instrument, or a live override from this widget.',
  midiMode:
    'Controls how live MIDI and SRAP playback interact. Song only disables MIDI for score playback, Instrument plays MIDI only while no score is active, and Play along lets assigned MIDI voices override the score.',
  midiScan:
    'Scans the system for MIDI input devices that can drive the SIDScore runtime.',
  midiDevice:
    'Selects the MIDI input device used for live note entry into the SIDScore runtime.',
  midiVoice:
    'Enables or disables this SID voice for live MIDI note input.',
  midiChannel:
    'Selects the MIDI channel that drives this SID voice assignment.',
  visualization:
    'Shows the SID ADSR volume envelope and the gate/articulation settings that directly affect note shape.',
  waveRegister:
    'SID control register waveform bits: TRI=$10, SAW=$20, PULSE=$40, NOISE=$80. GATE, SYNC, and RING are separate control bits.',
  filterRegister:
    'SID volume/filter register mode bits: LP=$10, BP=$20, HP=$40. At least one routed voice is required for the filter to affect sound.'
} as const;

const MIDI_MODES: readonly {
  readonly id: MidiModeId;
  readonly label: string;
}[] = [
  { id: 'song', label: 'Song only' },
  { id: 'instrument', label: 'Instrument' },
  { id: 'playAlong', label: 'Play along' }
];

const ATTACK_RATE_LABELS = [
  '2 ms',
  '8 ms',
  '16 ms',
  '24 ms',
  '38 ms',
  '56 ms',
  '68 ms',
  '80 ms',
  '100 ms',
  '250 ms',
  '500 ms',
  '800 ms',
  '1 s',
  '3 s',
  '5 s',
  '8 s'
] as const;

const DECAY_RELEASE_RATE_LABELS = [
  '6 ms',
  '24 ms',
  '48 ms',
  '72 ms',
  '114 ms',
  '168 ms',
  '204 ms',
  '240 ms',
  '300 ms',
  '750 ms',
  '1.5 s',
  '2.4 s',
  '3 s',
  '9 s',
  '15 s',
  '24 s'
] as const;

const WAVEFORMS: readonly WaveformDefinition[] = [
  {
    id: 'triangle',
    label: 'TRI',
    title: 'SID triangle waveform, control bit 4. A rising/falling tone with fewer upper harmonics; required for audible SID ring modulation.'
  },
  {
    id: 'saw',
    label: 'SAW',
    title: 'SID sawtooth waveform, control bit 5. A bright ramp waveform with strong harmonic content.'
  },
  {
    id: 'pulse',
    label: 'PULSE',
    title: 'SID variable pulse waveform, control bit 6. Timbre follows the 12-bit pulse-width registers.'
  },
  {
    id: 'noise',
    label: 'NOISE',
    title: 'SID random noise waveform, control bit 7. Useful for drums, explosions, and other unpitched sounds; SIDScore treats noise as exclusive.'
  }
];

const WAVEFORM_TOGGLES: readonly ToggleDefinition[] = [
  {
    id: 'waveTable',
    label: 'WAVESEQ',
    title: 'SIDScore table setting. Replaces the active SID waveform bits during the note; pitch and gate timing stay unchanged.'
  },
  {
    id: 'ringMod',
    label: 'RING',
    title: 'SID control bit 2. Ring-modulates the triangle waveform with the fixed paired oscillator (V1 by V3, V2 by V1, V3 by V2) for metallic non-harmonic tones.'
  },
  {
    id: 'sync',
    label: 'SYNC',
    title: 'SID control bit 1. Hard-syncs this oscillator to the fixed paired oscillator (V1 to V3, V2 to V1, V3 to V2), restarting the waveform for complex harmonics.'
  }
];

const ENVELOPE_TOGGLES: readonly ToggleDefinition[] = [
  {
    id: 'hardRestart',
    label: 'RESTART',
    title: 'SIDScore articulation setting. Briefly resets the SID GATE state before a note so the ADSR attack starts cleanly.'
  }
];

const PULSE_TOGGLES: readonly ToggleDefinition[] = [
  {
    id: 'pulseTable',
    label: 'PWSEQ',
    title: 'SIDScore table setting. Replaces the base SID pulse width while a note plays; requires the PULSE waveform.'
  }
];

const FILTER_TOGGLES: readonly ToggleDefinition[] = [
  {
    id: 'filterTable',
    label: 'FILTERSEQ',
    title: 'SIDScore table setting. Replaces the SID filter cutoff value while a note plays; requires an active LP, BP, or HP filter mode.'
  }
];

const FILTER_MODES: readonly FilterModeDefinition[] = [
  {
    id: 'low',
    label: 'LOW',
    sidLabel: 'LP',
    title: 'SID low-pass filter, mode bit 4. Passes frequencies below cutoff and attenuates higher components.'
  },
  {
    id: 'band',
    label: 'BAND',
    sidLabel: 'BP',
    title: 'SID band-pass filter, mode bit 5. Passes a band around cutoff and attenuates frequencies outside it.'
  },
  {
    id: 'high',
    label: 'HIGH',
    sidLabel: 'HP',
    title: 'SID high-pass filter, mode bit 6. Passes frequencies above cutoff and attenuates lower components.'
  }
];

const ENVELOPE_KNOBS: readonly KnobDefinition[] = [
  {
    id: 'attack',
    label: 'A',
    ariaLabel: 'Attack',
    min: 0,
    max: 15,
    title: 'SID attack nibble: time for a gated note to rise from silence to peak volume.'
  },
  {
    id: 'decay',
    label: 'D',
    ariaLabel: 'Decay',
    min: 0,
    max: 15,
    title: 'SID decay nibble: time for the voice to fall from peak volume down to the sustain level.'
  },
  {
    id: 'sustain',
    label: 'S',
    ariaLabel: 'Sustain',
    min: 0,
    max: 15,
    title: 'SID sustain nibble: held volume level after decay while the GATE bit remains set.'
  },
  {
    id: 'release',
    label: 'R',
    ariaLabel: 'Release',
    min: 0,
    max: 15,
    title: 'SID release nibble: time for the voice to fade toward zero after the GATE bit is cleared.'
  }
];

const GATE_MIN_KNOB: KnobDefinition = {
  id: 'gateMin',
  label: 'MIN',
  min: 0,
  max: 16,
  ariaLabel: 'Minimum gate time',
  title: 'SIDScore guard for the SID GATE bit: minimum player frames to keep GATE on after it is asserted.'
};

const VIBRATO_KNOBS: readonly KnobDefinition[] = [
  {
    id: 'vibratoDelay',
    label: 'DELAY',
    ariaLabel: 'Vibrato delay',
    min: 0,
    max: 255,
    title: 'SIDScore pitch modulation delay in player frames before vibrato starts.'
  },
  {
    id: 'vibratoRate',
    label: 'RATE',
    ariaLabel: 'Vibrato rate',
    min: 0,
    max: 255,
    title: 'SIDScore vibrato speed. The value advances an 8-bit LFO phase once per player frame.'
  },
  {
    id: 'vibratoAmp',
    label: 'AMP',
    ariaLabel: 'Vibrato amplitude',
    min: 0,
    max: 255,
    title: 'SIDScore vibrato depth. Zero disables vibrato; higher values bend SID frequency farther from the base note.'
  },
  {
    id: 'vibratoInc',
    label: 'INC',
    ariaLabel: 'Vibrato increment',
    min: 0,
    max: 255,
    title: 'SIDScore vibrato depth ramp-in per player frame after the delay. Zero jumps straight to full depth.'
  }
];

const PULSE_KNOBS: readonly KnobDefinition[] = [
  {
    id: 'pulseWidth',
    label: 'PW',
    ariaLabel: 'Pulse width',
    min: 0,
    max: 4095,
    format: hex12,
    title: 'SID 12-bit pulse-width register. Sets the pulse waveform duty cycle; about $0800 is square-like.'
  },
  {
    id: 'pulseSweep',
    label: 'SWEEP',
    ariaLabel: 'Pulse width sweep',
    min: -128,
    max: 127,
    title: 'SIDScore pulse-width modulation. Signed change applied to the SID pulse-width value each player frame, clamped by MIN and MAX.'
  },
  {
    id: 'pulseMin',
    label: 'MIN',
    ariaLabel: 'Pulse width minimum',
    min: 0,
    max: 4095,
    format: hex12,
    title: 'Lower clamp for SID pulse-width modulation. Pulse width is a 12-bit value from $000 to $FFF.'
  },
  {
    id: 'pulseMax',
    label: 'MAX',
    ariaLabel: 'Pulse width maximum',
    min: 0,
    max: 4095,
    format: hex12,
    title: 'Upper clamp for SID pulse-width modulation. Pulse width is a 12-bit value from $000 to $FFF.'
  }
];

const FILTER_KNOBS: readonly KnobDefinition[] = [
  {
    id: 'filterCutoff',
    label: 'CUTOFF',
    ariaLabel: 'Filter cutoff',
    min: 0,
    max: 2047,
    title: 'SID 11-bit filter cutoff register. The selected LP, BP, and HP modes use this one shared cutoff value.'
  },
  {
    id: 'filterSweep',
    label: 'SWEEP',
    ariaLabel: 'Filter cutoff sweep',
    min: -128,
    max: 127,
    title: 'SIDScore filter modulation. Signed change applied to the SID cutoff value over player frames, clamped by MIN and MAX.'
  },
  {
    id: 'filterMin',
    label: 'MIN',
    ariaLabel: 'Filter cutoff minimum',
    min: 0,
    max: 2047,
    title: 'Lower clamp for SID filter cutoff modulation. The cutoff register range is 0..2047.'
  },
  {
    id: 'filterMax',
    label: 'MAX',
    ariaLabel: 'Filter cutoff maximum',
    min: 0,
    max: 2047,
    title: 'Upper clamp for SID filter cutoff modulation. The cutoff register range is 0..2047.'
  },
  {
    id: 'filterResonance',
    label: 'RESON',
    ariaLabel: 'Filter resonance',
    min: 0,
    max: 15,
    title: 'SID filter resonance nibble. Peaks frequencies nearest the cutoff; 0 is no resonance and 15 is maximum resonance.'
  }
];

const TOGGLE_DEFAULTS: Record<ToggleId, boolean> = {
  ringMod: false,
  sync: false,
  hardRestart: true,
  waveTable: true,
  pulseTable: true,
  filterTable: false
};

const WAVEFORM_PROTOCOL_BITS: Record<WaveformId, number> = {
  pulse: 0x01,
  saw: 0x02,
  triangle: 0x04,
  noise: 0x08
};

const WAVEFORM_REGISTER_BITS: Record<WaveformId, number> = {
  triangle: 0x10,
  saw: 0x20,
  pulse: 0x40,
  noise: 0x80
};

const FILTER_MODE_PROTOCOL_BITS: Record<FilterModeId, number> = {
  low: 0x01,
  band: 0x02,
  high: 0x04
};

const FILTER_MODE_REGISTER_BITS: Record<FilterModeId, number> = {
  low: 0x10,
  band: 0x20,
  high: 0x40
};

const INSTRUMENT_UPDATE_DELAY_MS = 120;
const PENDING_INSTRUMENT_STATE_TIMEOUT_MS = 1_500;
const MIDI_UPDATE_DELAY_MS = 120;

@injectable()
export class SidInstrumentControlWidget extends ReactWidget {
  @inject(SidScoreRuntimeService)
  protected readonly sidScoreRuntimeService!: SidScoreRuntimeServiceProxy;

  @inject(MessageService)
  protected readonly messageService!: MessageService;

  @inject(TooltipService)
  protected readonly tooltipService!: TooltipService;

  protected instrumentName = 'harpsichord';
  protected selectedVoice = '1';
  protected gateMode: SidScoreGateModeName = 'retrigger';
  protected chipModel: SidScoreSidModel = '6581';
  protected instrumentSource: SidScoreInstrumentSourceName = 'default';
  protected readonly selectedWaveforms = new Set<WaveformId>(['saw', 'pulse']);
  protected readonly selectedFilterModes = new Set<FilterModeId>(['low']);
  protected filterOff = false;
  protected readonly instrumentStates = new Map<number, SidScoreInstrumentStateEvent>();
  protected readonly nonOverrideInstrumentStates = new Map<number, SidScoreInstrumentStateEvent>();
  protected instrumentUpdateTimer: ReturnType<typeof setTimeout> | undefined;
  protected pendingInstrumentVoices = new Set<number>();
  protected pendingInstrumentResetVoices = new Set<number>();
  protected readonly pendingInstrumentVoiceTimers = new Map<number, ReturnType<typeof setTimeout>>();
  protected scorePlaybackActive = false;
  protected midiMode: MidiModeId = DEFAULT_MIDI_MODE;
  protected midiEnabled = isMidiEnabledForMode(
    this.midiMode,
    this.scorePlaybackActive
  );
  protected midiScanning = false;
  protected initialMidiScanStarted = false;
  protected selectedMidiDeviceSelector = '';
  protected midiDevices: readonly SidScoreMidiDevice[] = [];
  protected midiAssignments: Record<number, { enabled: boolean; channel: number }> = {
    1: { enabled: true, channel: 1 },
    2: { enabled: true, channel: 1 },
    3: { enabled: true, channel: 1 }
  };
  protected midiUpdateTimer: ReturnType<typeof setTimeout> | undefined;
  protected tooltipUpdateTimer: ReturnType<typeof setTimeout> | undefined;
  protected numericValues: Record<NumericControlId, number> = {
    ...NUMERIC_DEFAULTS
  };
  protected toggleValues: Record<ToggleId, boolean> = {
    ...TOGGLE_DEFAULTS
  };

  constructor() {
    super();
    this.id = SID_INSTRUMENT_CONTROL_WIDGET_ID;
    this.title.label = 'SID Instrument';
    this.title.caption = 'SID Instrument Controls';
    this.title.iconClass = codicon('music');
    this.title.closable = false;
    this.addClass('cc-sid-instrument-widget');
  }

  override dispose(): void {
    this.clearInstrumentUpdateTimer();
    this.clearMidiUpdateTimer();
    this.clearTooltipUpdateTimer();
    this.clearPendingInstrumentVoices();
    super.dispose();
  }

  getSidModel(): SidScoreSidModel {
    return this.chipModel;
  }

  async prepareMidiForScorePlayback(): Promise<void> {
    await this.applyMidiMode();
  }

  setScorePlaybackActive(active: boolean, syncMidi = true): void {
    if (this.scorePlaybackActive === active) {
      return;
    }
    this.scorePlaybackActive = active;
    this.update();
    if (syncMidi) {
      void this.applyMidiMode();
    }
  }

  async initializeMidiDevices(): Promise<void> {
    if (!shouldStartInitialMidiDeviceScan({
      initialMidiScanStarted: this.initialMidiScanStarted,
      midiScanning: this.midiScanning
    })) {
      return;
    }
    this.initialMidiScanStarted = true;
    this.midiEnabled = this.midiEnabledForCurrentMode();
    await this.scanMidiDevices();
  }

  setInstrumentState(event: SidScoreInstrumentStateEvent): void {
    if (event.source !== 'override') {
      this.nonOverrideInstrumentStates.set(event.voiceIndex, event);
    }
    if (this.pendingInstrumentVoices.has(event.voiceIndex) && event.source !== 'override') {
      return;
    }
    if (this.pendingInstrumentResetVoices.has(event.voiceIndex) && event.source === 'override') {
      return;
    }
    this.instrumentStates.set(event.voiceIndex, event);
    this.clearPendingInstrumentVoice(event.voiceIndex);
    if (event.voiceIndex === this.selectedVoiceIndex()) {
      this.applyInstrumentState(event);
    }
  }

  setMidiDeviceList(event: SidScoreMidiDeviceListEvent): void {
    this.midiDevices = event.devices;
    this.midiScanning = false;
    let autoSelected = false;
    if (
      this.selectedMidiDeviceSelector &&
      !this.midiDevices.some((device) => device.selector === this.selectedMidiDeviceSelector)
    ) {
      this.selectedMidiDeviceSelector = '';
    }
    if (!this.selectedMidiDeviceSelector && this.midiDevices.length > 0) {
      this.selectedMidiDeviceSelector = this.midiDevices[0]?.selector ?? '';
      autoSelected = Boolean(this.selectedMidiDeviceSelector);
    }
    this.update();
    if (
      autoSelected ||
      this.selectedMidiDeviceSelector ||
      !this.midiEnabledForCurrentMode()
    ) {
      this.queueMidiUpdate();
    }
  }

  setMidiState(event: SidScoreMidiStateEvent): void {
    this.midiEnabled = event.enabled;
    for (const assignment of event.assignments) {
      this.midiAssignments[assignment.voiceIndex] = {
        enabled: assignment.voiceEnabled,
        channel: clampInteger(assignment.channel, 1, 16)
      };
      if (assignment.deviceSelector) {
        this.selectedMidiDeviceSelector = assignment.deviceSelector;
      }
    }
    this.update();
  }

  protected override onAfterAttach(msg: Message): void {
    super.onAfterAttach(msg);
    this.update();
    void this.initializeMidiDevices();
  }

  protected override onUpdateRequest(msg: Message): void {
    super.onUpdateRequest(msg);
    this.queueTooltipUpdate();
  }

  protected override onActivateRequest(msg: Message): void {
    super.onActivateRequest(msg);
    this.node.focus();
  }

  protected render(): React.ReactNode {
    return (
      <div className='cc-sid-instrument'>
        {this.renderHeader()}
        <div className='cc-sid-instrument__sections'>
          {this.renderVisualizationSection()}
          {this.renderWaveformSection()}
          {this.renderEnvelopeSection()}
          {this.renderKnobSection('Vibrato', VIBRATO_KNOBS)}
          {this.renderPulseSection()}
          {this.renderFilterSection()}
          {this.renderFooter()}
        </div>
      </div>
    );
  }

  protected renderVisualizationSection(): React.ReactNode {
    const envelope = createSidAdsrEnvelopeVisualization({
      attack: this.numericValues.attack,
      decay: this.numericValues.decay,
      sustain: this.numericValues.sustain,
      release: this.numericValues.release
    });
    return (
      <section className='cc-sid-section cc-sid-section--visualization'>
        <h3 className='cc-sid-section__label'>Shape</h3>
        <div className='cc-sid-section__body'>
          <div
            className='cc-sid-visualization'
            {...this.tooltipAttributes(CONTROL_TITLES.visualization)}
          >
            {this.renderEnvelopeVisualization(envelope)}
          </div>
        </div>
      </section>
    );
  }

  protected renderEnvelopeVisualization(
    envelope: SidAdsrEnvelopeVisualization
  ): React.ReactNode {
    return (
      <svg
        className='cc-sid-visualization__graph'
        viewBox={envelope.viewBox}
        role='img'
        aria-label='SID ADSR envelope'
        preserveAspectRatio='none'
      >
        <line className='cc-sid-visualization__grid' x1='12' y1='27.5' x2='268' y2='27.5' />
        <line className='cc-sid-visualization__grid' x1='12' y1='45' x2='268' y2='45' />
        <line className='cc-sid-visualization__grid' x1='12' y1='62.5' x2='268' y2='62.5' />
        <path
          className='cc-sid-visualization__envelope-fill'
          d={envelope.areaPath}
        />
        <polyline
          className='cc-sid-visualization__envelope-line'
          points={envelope.pointsAttribute}
        />
        {envelope.labels.map((label) => (
          <text
            key={label.label}
            className='cc-sid-visualization__label'
            x={label.x}
            y='96'
          >
            {label.label}
          </text>
        ))}
      </svg>
    );
  }

  protected renderHeader(): React.ReactNode {
    return (
      <div className='cc-sid-instrument__header'>
        <label
          className='cc-sid-field cc-sid-field--wide'
          {...this.tooltipAttributes(CONTROL_TITLES.instrumentName)}
        >
          <span className='cc-sid-field__label'>Instrument</span>
          <input
            className='cc-sid-field__control'
            type='text'
            aria-label='Instrument name'
            value={this.instrumentName}
            onChange={(event) => this.setInstrumentName(event.currentTarget.value)}
          />
        </label>
        <label
          className='cc-sid-field'
          {...this.tooltipAttributes(CONTROL_TITLES.selectedVoice)}
        >
          <span className='cc-sid-field__label'>Voice</span>
          <select
            className='cc-sid-field__control'
            value={this.selectedVoice}
            aria-label='SID voice'
            onChange={(event) => this.setSelectedVoice(event.currentTarget.value)}
          >
            <option value='1'>1</option>
            <option value='2'>2</option>
            <option value='3'>3</option>
          </select>
        </label>
        <label
          className='cc-sid-field'
          {...this.tooltipAttributes(CONTROL_TITLES.chipModel)}
        >
          <span className='cc-sid-field__label'>SID</span>
          <select
            className='cc-sid-field__control'
            value={this.chipModel}
            aria-label='SID model'
            onChange={(event) => this.setChipModel(event.currentTarget.value)}
          >
            <option value='6581'>6581</option>
            <option value='8580'>8580</option>
          </select>
        </label>
      </div>
    );
  }

  protected renderWaveformSection(): React.ReactNode {
    return (
      <section className='cc-sid-section'>
        <h3 className='cc-sid-section__label'>Waveform</h3>
        <div className='cc-sid-section__body'>
          <div className='cc-sid-wave-grid'>
            {WAVEFORMS.map((waveform) => this.renderWaveformButton(waveform))}
          </div>
          {this.renderRegisterReadout('WAVE', this.waveformLabel(), this.waveformRegisterBits())}
          {this.renderToggleGrid(WAVEFORM_TOGGLES)}
        </div>
      </section>
    );
  }

  protected renderEnvelopeSection(): React.ReactNode {
    return (
      <section className='cc-sid-section'>
        <h3 className='cc-sid-section__label'>Volume Envelope</h3>
        <div className='cc-sid-section__body'>
          <div className='cc-sid-knob-grid'>
            {ENVELOPE_KNOBS.map((definition) => this.renderKnob(definition))}
          </div>
          <div className='cc-sid-row-controls'>
            <label
              className='cc-sid-field'
              {...this.tooltipAttributes(CONTROL_TITLES.gateMode)}
            >
              <span className='cc-sid-field__label'>Gate</span>
              <select
                className='cc-sid-field__control'
                value={this.gateMode}
                aria-label='Gate mode'
                onChange={(event) => this.setGateMode(event.currentTarget.value)}
              >
                <option value='retrigger'>Retrigger</option>
                <option value='legato'>Legato</option>
              </select>
            </label>
            {this.renderKnob(GATE_MIN_KNOB)}
            {this.renderToggleGrid(ENVELOPE_TOGGLES)}
          </div>
        </div>
      </section>
    );
  }

  protected renderPulseSection(): React.ReactNode {
    const pulseEnabled = this.hasPulseWaveform();
    return (
      <section className='cc-sid-section'>
        <h3 className='cc-sid-section__label'>Pulse Modulation</h3>
        <div className='cc-sid-section__body'>
          <div className='cc-sid-knob-grid'>
            {PULSE_KNOBS.map((definition) =>
              this.renderKnob(definition, !pulseEnabled)
            )}
          </div>
          {this.renderToggleGrid(PULSE_TOGGLES)}
        </div>
      </section>
    );
  }

  protected renderFilterSection(): React.ReactNode {
    return (
      <section className='cc-sid-section'>
        <h3 className='cc-sid-section__label'>Filter Modulation</h3>
        <div className='cc-sid-section__body'>
          <div className='cc-sid-knob-grid cc-sid-knob-grid--five'>
            {FILTER_KNOBS.map((definition) =>
              this.renderKnob(definition, this.filterOff)
            )}
          </div>
          <div className='cc-sid-filter-modes'>
            {FILTER_MODES.map((mode) => this.renderFilterModeButton(mode))}
            <button
              type='button'
              className={buttonClass(this.filterOff)}
              aria-pressed={this.filterOff}
              {...this.tooltipAttributes(CONTROL_TITLES.filterOff)}
              onClick={() => this.toggleFilterOff()}
            >
              OFF
            </button>
            {this.renderToggleButton(FILTER_TOGGLES[0])}
          </div>
          {this.renderRegisterReadout('FILTER', this.filterModeLabel(), this.filterModeRegisterBits())}
        </div>
      </section>
    );
  }

  protected renderFooter(): React.ReactNode {
    return (
      <div className='cc-sid-instrument__footer'>
        <div className='cc-sid-footer-controls'>
          <button
            type='button'
            className='cc-sid-button cc-sid-reset-button'
            {...this.tooltipAttributes(CONTROL_TITLES.reset)}
            onClick={() => this.resetInstrumentOverride()}
          >
            RESET
          </button>
          <span
            className='cc-sid-source-readout'
            {...this.tooltipAttributes(CONTROL_TITLES.source)}
          >
            SOURCE={this.instrumentSource.toUpperCase()}
          </span>
        </div>
        <div className='cc-sid-midi-controls'>
          <div className='cc-sid-midi-controls__top'>
            <label
              className='cc-sid-field cc-sid-midi-mode-field'
              {...this.tooltipAttributes(CONTROL_TITLES.midiMode)}
            >
              <span className='cc-sid-field__label'>MIDI</span>
              <select
                className='cc-sid-field__control'
                value={this.midiMode}
                aria-label='MIDI playback mode'
                onChange={(event) => this.setMidiMode(event.currentTarget.value)}
              >
                {MIDI_MODES.map((mode) => (
                  <option key={mode.id} value={mode.id}>
                    {mode.label}
                  </option>
                ))}
              </select>
            </label>
            <span
              className='cc-sid-tooltip-host'
              {...this.tooltipAttributes(CONTROL_TITLES.midiScan)}
            >
              <button
                type='button'
                className='cc-sid-button'
                disabled={this.midiScanning}
                onClick={() => this.scanMidiDevices()}
              >
                {this.midiScanning ? 'SCANNING' : 'SCAN'}
              </button>
            </span>
            <label
              className='cc-sid-field cc-sid-midi-device-field'
              {...this.tooltipAttributes(CONTROL_TITLES.midiDevice)}
            >
              <span className='cc-sid-field__label'>Instrument</span>
              <select
                className='cc-sid-field__control'
                value={this.selectedMidiDeviceSelector}
                disabled={this.midiDevices.length === 0}
                aria-label='MIDI input instrument'
                onChange={(event) => this.setSelectedMidiDevice(event.currentTarget.value)}
              >
                {this.renderMidiDeviceOptions()}
              </select>
            </label>
          </div>
          <div className='cc-sid-midi-voice-grid'>
            {[1, 2, 3].map((voiceIndex) => this.renderMidiVoiceAssignment(voiceIndex))}
          </div>
        </div>
      </div>
    );
  }

  protected renderMidiDeviceOptions(): React.ReactNode {
    if (this.midiDevices.length === 0) {
      return <option value=''>No MIDI input</option>;
    }
    return this.midiDevices.map((device) => (
      <option key={device.selector} value={device.selector}>
        {device.displayName || device.name || `MIDI ${device.deviceIndex}`}
      </option>
    ));
  }

  protected renderMidiVoiceAssignment(voiceIndex: number): React.ReactNode {
    const assignment = this.midiAssignments[voiceIndex] ?? {
      enabled: false,
      channel: voiceIndex
    };
    return (
      <div key={voiceIndex} className='cc-sid-midi-voice'>
        <label
          className='cc-sid-midi-voice__toggle'
          {...this.tooltipAttributes(CONTROL_TITLES.midiVoice)}
        >
          <input
            type='checkbox'
            checked={assignment.enabled}
            aria-label={`Enable voice ${voiceIndex} for MIDI input`}
            onChange={(event) =>
              this.setMidiVoiceEnabled(voiceIndex, event.currentTarget.checked)
            }
          />
          <span>V{voiceIndex}</span>
        </label>
        <label
          className='cc-sid-field'
          {...this.tooltipAttributes(CONTROL_TITLES.midiChannel)}
        >
          <span className='cc-sid-field__label'>CH</span>
          <select
            className='cc-sid-field__control'
            value={assignment.channel}
            disabled={!assignment.enabled}
            aria-label={`MIDI channel for voice ${voiceIndex}`}
            onChange={(event) =>
              this.setMidiVoiceChannel(voiceIndex, event.currentTarget.value)
            }
          >
            {Array.from({ length: 16 }, (_, index) => index + 1).map((channel) => (
              <option key={channel} value={channel}>
                {channel}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  }

  protected renderKnobSection(
    label: string,
    definitions: readonly KnobDefinition[]
  ): React.ReactNode {
    return (
      <section className='cc-sid-section'>
        <h3 className='cc-sid-section__label'>{label}</h3>
        <div className='cc-sid-section__body'>
          <div className='cc-sid-knob-grid'>
            {definitions.map((definition) => this.renderKnob(definition))}
          </div>
        </div>
      </section>
    );
  }

  protected renderKnob(
    definition: KnobDefinition,
    disabled = false
  ): React.ReactNode {
    const value = this.numericValues[definition.id];
    const percent = (value - definition.min) / (definition.max - definition.min);
    const clampedPercent = Math.max(0, Math.min(1, percent));
    const angle = -130 + clampedPercent * 260;
    const fill = clampedPercent * 260;
    const formatted = definition.format?.(value) ?? String(value);
    const style = {
      '--cc-sid-knob-angle': `${angle}deg`,
      '--cc-sid-knob-fill': `${fill}deg`
    } as React.CSSProperties;

    return (
      <label
        key={definition.id}
        className={`cc-sid-knob${disabled ? ' cc-sid-knob--disabled' : ''}`}
        {...this.tooltipAttributes(knobTitle(definition, value, formatted))}
      >
        <span className='cc-sid-knob__value'>{formatted}</span>
        <span className='cc-sid-knob__dial' style={style}>
          <input
            className='cc-sid-knob__input'
            type='range'
            min={definition.min}
            max={definition.max}
            step={definition.step ?? 1}
            value={value}
            aria-label={definition.ariaLabel}
            disabled={disabled}
            onChange={(event) =>
              this.setNumericValue(definition.id, event.currentTarget.value)
            }
          />
        </span>
        <span className='cc-sid-knob__label'>{definition.label}</span>
      </label>
    );
  }

  protected renderWaveformButton(definition: WaveformDefinition): React.ReactNode {
    const active = this.selectedWaveforms.has(definition.id);
    return (
      <button
        key={definition.id}
        type='button'
        className={`cc-sid-button cc-sid-wave-button${active ? ' cc-sid-button--active' : ''}`}
        aria-pressed={active}
        {...this.tooltipAttributes(definition.title)}
        onClick={() => this.toggleWaveform(definition.id)}
      >
        {renderWaveformIcon(definition.id)}
        <span className='cc-sid-wave-button__label'>{definition.label}</span>
      </button>
    );
  }

  protected renderToggleGrid(definitions: readonly ToggleDefinition[]): React.ReactNode {
    return (
      <div className='cc-sid-toggle-grid'>
        {definitions.map((definition) => this.renderToggleButton(definition))}
      </div>
    );
  }

  protected renderToggleButton(definition: ToggleDefinition | undefined): React.ReactNode {
    if (!definition) {
      return undefined;
    }

    const active = this.toggleValues[definition.id];
    const disabled = this.isToggleDisabled(definition.id);
    const tooltip = disabled ? this.disabledToggleTitle(definition) : definition.title;
    const button = (
      <button
        type='button'
        className={buttonClass(active, disabled)}
        aria-pressed={active}
        disabled={disabled}
        {...(!disabled ? this.tooltipAttributes(tooltip) : {})}
        onClick={() => this.toggleBoolean(definition.id)}
      >
        {definition.label}
      </button>
    );
    if (!disabled) {
      return React.cloneElement(button, { key: definition.id });
    }
    return (
      <span
        key={definition.id}
        className='cc-sid-tooltip-host'
        {...this.tooltipAttributes(tooltip)}
      >
        {button}
      </span>
    );
  }

  protected renderFilterModeButton(definition: FilterModeDefinition): React.ReactNode {
    const active = !this.filterOff && this.selectedFilterModes.has(definition.id);
    return (
      <button
        key={definition.id}
        type='button'
        className={buttonClass(active)}
        aria-pressed={active}
        {...this.tooltipAttributes(definition.title)}
        onClick={() => this.toggleFilterMode(definition.id)}
      >
        {definition.label}
      </button>
    );
  }

  protected renderRegisterReadout(
    name: string,
    value: string,
    bits: number
  ): React.ReactNode {
    const title = name === 'FILTER'
      ? CONTROL_TITLES.filterRegister
      : CONTROL_TITLES.waveRegister;
    return (
      <div
        className='cc-sid-register-readout'
        {...this.tooltipAttributes(title)}
      >
        <span>{name}={value}</span>
        <span>${hexByte(bits)}</span>
      </div>
    );
  }

  protected setInstrumentName(value: string): void {
    this.instrumentName = value;
    this.update();
    this.queueInstrumentUpdate();
  }

  protected setSelectedVoice(value: string): void {
    this.selectedVoice = value;
    const state = this.instrumentStates.get(this.selectedVoiceIndex());
    if (state) {
      this.applyInstrumentState(state, false);
    }
    this.update();
  }

  protected setChipModel(value: string): void {
    this.chipModel = value === '8580' ? '8580' : '6581';
    this.update();
  }

  protected setGateMode(value: string): void {
    this.gateMode = value === 'legato' ? 'legato' : 'retrigger';
    this.update();
    this.queueInstrumentUpdate();
  }

  protected setNumericValue(id: NumericControlId, value: string): void {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return;
    }

    this.numericValues[id] = parsed;
    this.update();
    if (isSidInstrumentProtocolNumericControl(id)) {
      this.queueInstrumentUpdate();
    }
  }

  protected toggleWaveform(id: WaveformId): void {
    if (id === 'noise') {
      if (!this.selectedWaveforms.has('noise')) {
        this.selectedWaveforms.clear();
        this.selectedWaveforms.add('noise');
      }
      this.normalizeWaveformDependentToggles();
      this.update();
      this.queueInstrumentUpdate();
      return;
    }

    if (this.selectedWaveforms.has('noise')) {
      this.selectedWaveforms.clear();
      this.selectedWaveforms.add(id);
    } else if (this.selectedWaveforms.has(id)) {
      if (this.selectedWaveforms.size > 1) {
        this.selectedWaveforms.delete(id);
      }
    } else {
      this.selectedWaveforms.add(id);
    }

    this.normalizeWaveformDependentToggles();
    this.update();
    this.queueInstrumentUpdate();
  }

  protected toggleBoolean(id: ToggleId): void {
    if (this.isToggleDisabled(id)) {
      return;
    }
    this.toggleValues[id] = !this.toggleValues[id];
    this.update();
    if (id === 'sync' || id === 'ringMod') {
      this.queueInstrumentUpdate();
    }
  }

  protected toggleFilterMode(id: FilterModeId): void {
    this.filterOff = false;
    if (this.selectedFilterModes.has(id)) {
      if (this.selectedFilterModes.size === 1) {
        this.selectedFilterModes.clear();
        this.filterOff = true;
        this.toggleValues.filterTable = false;
      } else {
        this.selectedFilterModes.delete(id);
      }
    } else {
      this.selectedFilterModes.add(id);
    }
    this.update();
    this.queueInstrumentUpdate();
  }

  protected toggleFilterOff(): void {
    this.filterOff = !this.filterOff;
    if (this.filterOff) {
      this.selectedFilterModes.clear();
      this.toggleValues.filterTable = false;
    } else if (this.selectedFilterModes.size === 0) {
      this.selectedFilterModes.add('low');
    }
    this.update();
    this.queueInstrumentUpdate();
  }

  protected async resetInstrumentOverride(): Promise<void> {
    const voiceIndex = this.selectedVoiceIndex();
    this.clearInstrumentUpdateTimer();
    this.markPendingInstrumentResetVoice(voiceIndex);
    try {
      await this.sidScoreRuntimeService.resetInstrument({ voiceIndex });
      this.applyCachedNonOverrideInstrumentState(voiceIndex);
    } catch (error) {
      this.clearPendingInstrumentVoice(voiceIndex);
      this.messageService.error(`Could not reset SID instrument: ${toErrorMessage(error)}`);
    }
  }

  protected async applyMidiMode(): Promise<void> {
    this.clearMidiUpdateTimer();
    this.midiEnabled = this.midiEnabledForCurrentMode();
    this.update();
    await this.sendMidiSettings();
  }

  protected midiEnabledForCurrentMode(): boolean {
    return isMidiEnabledForMode(this.midiMode, this.scorePlaybackActive);
  }

  protected setMidiMode(value: string): void {
    this.midiMode = toMidiMode(value);
    this.midiEnabled = this.midiEnabledForCurrentMode();
    this.update();
    const syncPlan = planMidiModeActivationSync({
      midiEnabled: this.midiEnabled,
      midiDeviceCount: this.midiDevices.length,
      midiScanning: this.midiScanning
    });
    if (syncPlan.scanDevices) {
      void this.scanMidiDevices();
    }
    if (syncPlan.queueMidiSettings) {
      this.queueMidiUpdate();
    }
  }

  protected async scanMidiDevices(): Promise<void> {
    this.midiScanning = true;
    this.update();
    try {
      await this.sidScoreRuntimeService.scanMidiDevices();
    } catch (error) {
      this.midiScanning = false;
      this.update();
      this.messageService.error(`Could not scan MIDI inputs: ${toErrorMessage(error)}`);
    }
  }

  protected setSelectedMidiDevice(value: string): void {
    this.selectedMidiDeviceSelector = value;
    this.update();
    this.queueMidiUpdate();
  }

  protected setMidiVoiceEnabled(voiceIndex: number, enabled: boolean): void {
    this.midiAssignments[voiceIndex] = {
      ...this.midiAssignments[voiceIndex],
      enabled
    };
    this.update();
    this.queueMidiUpdate();
  }

  protected setMidiVoiceChannel(voiceIndex: number, value: string): void {
    this.midiAssignments[voiceIndex] = {
      ...this.midiAssignments[voiceIndex],
      channel: clampInteger(Number(value), 1, 16)
    };
    this.update();
    this.queueMidiUpdate();
  }

  protected queueMidiUpdate(): void {
    this.clearMidiUpdateTimer();
    this.midiUpdateTimer = setTimeout(() => {
      this.midiUpdateTimer = undefined;
      void this.sendMidiSettings();
    }, MIDI_UPDATE_DELAY_MS);
  }

  protected clearMidiUpdateTimer(): void {
    if (this.midiUpdateTimer) {
      clearTimeout(this.midiUpdateTimer);
      this.midiUpdateTimer = undefined;
    }
  }

  protected queueTooltipUpdate(): void {
    this.clearTooltipUpdateTimer();
    this.tooltipUpdateTimer = setTimeout(() => {
      this.tooltipUpdateTimer = undefined;
      this.tooltipService.update();
    }, 0);
  }

  protected clearTooltipUpdateTimer(): void {
    if (this.tooltipUpdateTimer) {
      clearTimeout(this.tooltipUpdateTimer);
      this.tooltipUpdateTimer = undefined;
    }
  }

  protected tooltipAttributes(content: string): TooltipAttributes {
    return {
      'data-tip': escapeTooltipContent(content),
      'data-for': this.tooltipService.tooltipId
    };
  }

  protected async sendMidiSettings(): Promise<void> {
    const assignments = this.createMidiAssignments();
    const enabled = this.midiEnabledForCurrentMode();
    this.midiEnabled = enabled;
    try {
      await this.sidScoreRuntimeService.setMidiSettings({
        enabled,
        assignments
      });
    } catch (error) {
      this.messageService.error(`Could not set MIDI routing: ${toErrorMessage(error)}`);
    }
  }

  protected createMidiAssignments(): readonly SidScoreMidiVoiceAssignment[] {
    return [1, 2, 3].map((voiceIndex) => {
      const assignment = this.midiAssignments[voiceIndex] ?? {
        enabled: false,
        channel: voiceIndex
      };
      return {
        voiceIndex,
        voiceEnabled: assignment.enabled,
        channel: assignment.channel,
        deviceSelector: this.selectedMidiDeviceSelector
      };
    });
  }

  protected queueInstrumentUpdate(): void {
    this.clearInstrumentUpdateTimer();
    this.instrumentUpdateTimer = setTimeout(() => {
      this.instrumentUpdateTimer = undefined;
      void this.sendCurrentInstrument();
    }, INSTRUMENT_UPDATE_DELAY_MS);
  }

  protected clearInstrumentUpdateTimer(): void {
    if (this.instrumentUpdateTimer) {
      clearTimeout(this.instrumentUpdateTimer);
      this.instrumentUpdateTimer = undefined;
    }
  }

  protected async sendCurrentInstrument(): Promise<void> {
    const request = this.createSetInstrumentRequest();
    this.markPendingInstrumentVoice(request.voiceIndex);
    try {
      await this.sidScoreRuntimeService.setInstrument(request);
    } catch (error) {
      this.clearPendingInstrumentVoice(request.voiceIndex);
      this.messageService.error(`Could not set SID instrument: ${toErrorMessage(error)}`);
    }
  }

  protected markPendingInstrumentVoice(voiceIndex: number): void {
    this.clearPendingInstrumentVoice(voiceIndex);
    this.pendingInstrumentVoices.add(voiceIndex);
    const timer = setTimeout(() => {
      this.pendingInstrumentVoices.delete(voiceIndex);
      this.pendingInstrumentResetVoices.delete(voiceIndex);
      this.pendingInstrumentVoiceTimers.delete(voiceIndex);
    }, PENDING_INSTRUMENT_STATE_TIMEOUT_MS);
    this.pendingInstrumentVoiceTimers.set(voiceIndex, timer);
  }

  protected markPendingInstrumentResetVoice(voiceIndex: number): void {
    this.clearPendingInstrumentVoice(voiceIndex);
    this.pendingInstrumentResetVoices.add(voiceIndex);
    const timer = setTimeout(() => {
      this.pendingInstrumentVoices.delete(voiceIndex);
      this.pendingInstrumentResetVoices.delete(voiceIndex);
      this.pendingInstrumentVoiceTimers.delete(voiceIndex);
    }, PENDING_INSTRUMENT_STATE_TIMEOUT_MS);
    this.pendingInstrumentVoiceTimers.set(voiceIndex, timer);
  }

  protected clearPendingInstrumentVoice(voiceIndex: number): void {
    this.pendingInstrumentVoices.delete(voiceIndex);
    this.pendingInstrumentResetVoices.delete(voiceIndex);
    const timer = this.pendingInstrumentVoiceTimers.get(voiceIndex);
    if (timer) {
      clearTimeout(timer);
      this.pendingInstrumentVoiceTimers.delete(voiceIndex);
    }
  }

  protected clearPendingInstrumentVoices(): void {
    for (const timer of this.pendingInstrumentVoiceTimers.values()) {
      clearTimeout(timer);
    }
    this.pendingInstrumentVoiceTimers.clear();
    this.pendingInstrumentVoices.clear();
    this.pendingInstrumentResetVoices.clear();
  }

  protected applyCachedNonOverrideInstrumentState(voiceIndex: number): void {
    const state = this.nonOverrideInstrumentStates.get(voiceIndex);
    if (!state) {
      return;
    }
    this.instrumentStates.set(voiceIndex, state);
    if (voiceIndex === this.selectedVoiceIndex()) {
      this.applyInstrumentState(state);
    }
  }

  protected createSetInstrumentRequest(): SidScoreSetInstrumentRequest {
    const filterModeMask = this.filterModeProtocolBits();
    return {
      voiceIndex: this.selectedVoiceIndex(),
      waveMask: this.waveformProtocolBits(),
      attack: this.numericValues.attack,
      decay: this.numericValues.decay,
      sustain: this.numericValues.sustain,
      release: this.numericValues.release,
      vibratoDelay: this.numericValues.vibratoDelay,
      vibratoRate: this.numericValues.vibratoRate,
      vibratoAmp: this.numericValues.vibratoAmp,
      vibratoInc: this.numericValues.vibratoInc,
      pulseWidth: this.numericValues.pulseWidth,
      pulseSweep: this.numericValues.pulseSweep,
      pulseMin: this.numericValues.pulseMin,
      pulseMax: this.numericValues.pulseMax,
      filterModeMask,
      filterCutoff: filterModeMask === 0 ? 0 : this.numericValues.filterCutoff,
      filterResonance: filterModeMask === 0 ? 0 : this.numericValues.filterResonance,
      gateMode: this.gateMode,
      gateMin: this.numericValues.gateMin,
      sync: this.toggleValues.sync,
      ring: this.toggleValues.ringMod,
      instrumentName: this.instrumentName
    };
  }

  protected applyInstrumentState(
    state: SidScoreInstrumentStateEvent,
    update = true
  ): void {
    this.instrumentSource = state.source;
    this.instrumentName = state.instrumentName || `voice${state.voiceIndex}`;
    this.gateMode = state.gateMode;
    this.setWaveformsFromMask(state.waveMask);
    this.setFilterModesFromMask(state.filterModeMask);
    this.numericValues = {
      ...this.numericValues,
      attack: state.attack,
      decay: state.decay,
      sustain: state.sustain,
      release: state.release,
      vibratoDelay: state.vibratoDelay,
      vibratoRate: state.vibratoRate,
      vibratoAmp: state.vibratoAmp,
      vibratoInc: state.vibratoInc,
      gateMin: state.gateMin,
      pulseWidth: state.pulseWidth,
      pulseSweep: state.pulseSweep,
      pulseMin: state.pulseMin,
      pulseMax: state.pulseMax,
      filterCutoff: state.filterCutoff,
      filterResonance: state.filterResonance
    };
    this.toggleValues = {
      ...this.toggleValues,
      sync: state.sync,
      ringMod: state.ring
    };
    this.normalizeWaveformDependentToggles();
    if (update) {
      this.update();
    }
  }

  protected selectedVoiceIndex(): number {
    const parsed = Number(this.selectedVoice);
    if (!Number.isFinite(parsed)) {
      return 1;
    }
    return Math.max(1, Math.min(3, Math.round(parsed)));
  }

  protected setWaveformsFromMask(mask: number): void {
    this.selectedWaveforms.clear();
    if (mask & WAVEFORM_PROTOCOL_BITS.noise) {
      this.selectedWaveforms.add('noise');
      return;
    }
    for (const waveform of WAVEFORMS) {
      if (waveform.id !== 'noise' && (mask & WAVEFORM_PROTOCOL_BITS[waveform.id])) {
        this.selectedWaveforms.add(waveform.id);
      }
    }
    if (this.selectedWaveforms.size === 0) {
      this.selectedWaveforms.add('pulse');
    }
  }

  protected setFilterModesFromMask(mask: number): void {
    this.selectedFilterModes.clear();
    const normalizedMask = mask & 0x07;
    this.filterOff = normalizedMask === 0;
    if (this.filterOff) {
      this.toggleValues.filterTable = false;
      return;
    }
    for (const mode of FILTER_MODES) {
      if (normalizedMask & FILTER_MODE_PROTOCOL_BITS[mode.id]) {
        this.selectedFilterModes.add(mode.id);
      }
    }
  }

  protected hasTriangleWaveform(): boolean {
    return this.selectedWaveforms.has('triangle');
  }

  protected hasPulseWaveform(): boolean {
    return this.selectedWaveforms.has('pulse');
  }

  protected isToggleDisabled(id: ToggleId): boolean {
    if (id === 'ringMod') {
      return !this.hasTriangleWaveform();
    }
    if (id === 'pulseTable') {
      return !this.hasPulseWaveform();
    }
    if (id === 'filterTable') {
      return this.filterOff;
    }
    return false;
  }

  protected disabledToggleTitle(definition: ToggleDefinition): string {
    if (definition.id === 'ringMod') {
      return `${definition.title} Disabled because ring modulation requires TRI.`;
    }
    if (definition.id === 'pulseTable') {
      return `${definition.title} Disabled because pulse width tables require PULSE.`;
    }
    if (definition.id === 'filterTable') {
      return `${definition.title} Disabled because filter tables require LP, BP, or HP.`;
    }
    return definition.title;
  }

  protected normalizeWaveformDependentToggles(): void {
    if (!this.hasTriangleWaveform()) {
      this.toggleValues.ringMod = false;
    }
    if (!this.hasPulseWaveform()) {
      this.toggleValues.pulseTable = false;
    }
  }

  protected waveformProtocolBits(): number {
    return [...this.selectedWaveforms].reduce(
      (bits, waveform) => bits | WAVEFORM_PROTOCOL_BITS[waveform],
      0
    );
  }

  protected waveformRegisterBits(): number {
    return [...this.selectedWaveforms].reduce(
      (bits, waveform) => bits | WAVEFORM_REGISTER_BITS[waveform],
      0
    );
  }

  protected waveformLabel(): string {
    return WAVEFORMS
      .filter((waveform) => this.selectedWaveforms.has(waveform.id))
      .map((waveform) => waveform.label)
      .join('+');
  }

  protected filterModeProtocolBits(): number {
    if (this.filterOff) {
      return 0;
    }
    return [...this.selectedFilterModes].reduce(
      (bits, mode) => bits | FILTER_MODE_PROTOCOL_BITS[mode],
      0
    );
  }

  protected filterModeRegisterBits(): number {
    if (this.filterOff) {
      return 0;
    }
    return [...this.selectedFilterModes].reduce(
      (bits, mode) => bits | FILTER_MODE_REGISTER_BITS[mode],
      0
    );
  }

  protected filterModeLabel(): string {
    if (this.filterOff) {
      return 'OFF';
    }
    return FILTER_MODES
      .filter((mode) => this.selectedFilterModes.has(mode.id))
      .map((mode) => mode.sidLabel)
      .join('+');
  }
}

function renderWaveformIcon(id: WaveformId): React.ReactNode {
  const props = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 2.4,
    vectorEffect: 'non-scaling-stroke' as const
  };

  switch (id) {
    case 'triangle':
      return (
        <svg className='cc-sid-wave-button__icon' viewBox='0 0 48 28' aria-hidden='true'>
          <polyline points='4,23 15,5 27,23 39,5 44,13' {...props} />
        </svg>
      );
    case 'saw':
      return (
        <svg className='cc-sid-wave-button__icon' viewBox='0 0 48 28' aria-hidden='true'>
          <polyline points='5,23 5,5 20,23 20,5 35,23 35,5 43,14' {...props} />
        </svg>
      );
    case 'pulse':
      return (
        <svg className='cc-sid-wave-button__icon' viewBox='0 0 48 28' aria-hidden='true'>
          <polyline points='5,23 5,7 20,7 20,23 31,23 31,7 43,7' {...props} />
        </svg>
      );
    case 'noise':
      return (
        <svg className='cc-sid-wave-button__icon' viewBox='0 0 48 28' aria-hidden='true'>
          <polyline points='5,15 8,11 10,19 13,7 16,21 19,9 22,17 25,6 29,22 32,10 35,18 39,8 43,15' {...props} />
        </svg>
      );
  }
}

function buttonClass(active: boolean, disabled = false): string {
  return `cc-sid-button${active ? ' cc-sid-button--active' : ''}${disabled ? ' cc-sid-button--disabled' : ''}`;
}

function knobTitle(
  definition: KnobDefinition,
  value: number,
  formatted: string
): string {
  return `${definition.ariaLabel}: ${knobValueDetail(definition.id, value, formatted)}. ${definition.title}`;
}

function knobValueDetail(
  id: NumericControlId,
  value: number,
  formatted: string
): string {
  switch (id) {
    case 'attack':
      return `${value} (${ATTACK_RATE_LABELS[clampInteger(value, 0, 15)]})`;
    case 'decay':
    case 'release':
      return `${value} (${DECAY_RELEASE_RATE_LABELS[clampInteger(value, 0, 15)]})`;
    case 'sustain':
    case 'filterResonance':
      return `${value}/15`;
    case 'gateMin':
    case 'vibratoDelay':
      return `${value} ${value === 1 ? 'frame' : 'frames'}`;
    case 'vibratoRate':
    case 'vibratoAmp':
    case 'vibratoInc':
      return `${value}/255`;
    case 'pulseWidth':
    case 'pulseMin':
    case 'pulseMax':
      return `${formatted} (${formatPercent(value / 40.95)} duty)`;
    case 'pulseSweep':
      return `${formatSigned(value)} pulse-width steps per frame`;
    case 'filterCutoff':
    case 'filterMin':
    case 'filterMax':
      return `${value} (about ${formatInteger(value * 5.8 + 30)} Hz)`;
    case 'filterSweep':
      return `${formatSigned(value)} cutoff steps per frame`;
  }
}

function formatPercent(value: number): string {
  return `${value.toFixed(1).replace(/\.0$/, '')}%`;
}

function formatInteger(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

function formatSigned(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function escapeTooltipContent(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case '\'':
        return '&#39;';
      default:
        return character;
    }
  });
}

function hexByte(value: number): string {
  return Math.max(0, Math.min(255, Math.round(value)))
    .toString(16)
    .toUpperCase()
    .padStart(2, '0');
}

function hex12(value: number): string {
  return `$${Math.max(0, Math.min(4095, Math.round(value)))
    .toString(16)
    .toUpperCase()
    .padStart(3, '0')}`;
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.round(value)));
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export type SidSfxPresetId =
  | 'blip'
  | 'pickup'
  | 'laser'
  | 'jump'
  | 'hit'
  | 'explosion';

export type SidSfxVoice = 'any' | '1' | '2' | '3';
export type SidSfxWave = 'TRI' | 'SAW' | 'PULSE' | 'NOISE';
export type SidSfxCurve = 'LINEAR' | 'EXP' | 'LOG' | 'STEP';
export type SidSfxRetriggerMode = 'RESTART' | 'IGNORE' | 'STEAL';

export interface SidSfxEffectSettings {
  name: string;
  preset: SidSfxPresetId;
  voice: SidSfxVoice;
  lengthTicks: number;
  gateOffTick: number;
  priority: number;
  retrigger: SidSfxRetriggerMode;
  wave: SidSfxWave;
  startPitch: string;
  endPitch: string;
  pitchSweep: boolean;
  pitchCurve: SidSfxCurve;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  pulseWidth: number;
  pulseEnd: number;
  pulseSweep: boolean;
  volume: number;
}

export interface SidSfxPreset {
  id: SidSfxPresetId;
  label: string;
  defaults: SidSfxEffectSettings;
}

export const SID_SFX_NOTES = [
  'C1',
  'D1',
  'E1',
  'F1',
  'G1',
  'A1',
  'B1',
  'C2',
  'D2',
  'E2',
  'F2',
  'G2',
  'A2',
  'B2',
  'C3',
  'D3',
  'E3',
  'F3',
  'G3',
  'A3',
  'B3',
  'C4',
  'D4',
  'E4',
  'F4',
  'G4',
  'A4',
  'B4',
  'C5',
  'D5',
  'E5',
  'F5',
  'G5',
  'A5',
  'B5',
  'C6',
  'D6',
  'E6',
  'F6',
  'G6',
  'A6',
  'B6',
  'C7',
  'D7',
  'E7',
  'F7',
  'G7',
  'A7',
  'B7',
  'C8'
] as const;

export const SID_SFX_WAVES: readonly SidSfxWave[] = [
  'TRI',
  'SAW',
  'PULSE',
  'NOISE'
];

export const SID_SFX_CURVES: readonly SidSfxCurve[] = [
  'LINEAR',
  'EXP',
  'LOG',
  'STEP'
];

export const SID_SFX_RETRIGGER_MODES: readonly SidSfxRetriggerMode[] = [
  'RESTART',
  'IGNORE',
  'STEAL'
];

const basePreset: Omit<SidSfxEffectSettings, 'name' | 'preset'> = {
  voice: 'any',
  lengthTicks: 12,
  gateOffTick: 8,
  priority: 64,
  retrigger: 'RESTART',
  wave: 'TRI',
  startPitch: 'C5',
  endPitch: 'C5',
  pitchSweep: false,
  pitchCurve: 'LINEAR',
  attack: 0,
  decay: 2,
  sustain: 12,
  release: 1,
  pulseWidth: 0x0800,
  pulseEnd: 0x0800,
  pulseSweep: false,
  volume: 15
};

export const SID_SFX_PRESETS: readonly SidSfxPreset[] = [
  {
    id: 'blip',
    label: 'Blip',
    defaults: {
      ...basePreset,
      name: 'Blip',
      preset: 'blip',
      lengthTicks: 8,
      gateOffTick: 6,
      wave: 'TRI',
      startPitch: 'C6',
      endPitch: 'G6',
      pitchSweep: true
    }
  },
  {
    id: 'pickup',
    label: 'Pickup',
    defaults: {
      ...basePreset,
      name: 'Pickup',
      preset: 'pickup',
      lengthTicks: 14,
      gateOffTick: 11,
      wave: 'PULSE',
      startPitch: 'C5',
      endPitch: 'C7',
      pitchSweep: true,
      pitchCurve: 'EXP',
      pulseWidth: 0x0900,
      pulseEnd: 0x0400,
      pulseSweep: true,
      decay: 3,
      sustain: 10,
      release: 2
    }
  },
  {
    id: 'laser',
    label: 'Laser',
    defaults: {
      ...basePreset,
      name: 'Laser',
      preset: 'laser',
      lengthTicks: 24,
      gateOffTick: 20,
      priority: 80,
      wave: 'PULSE',
      startPitch: 'C7',
      endPitch: 'C3',
      pitchSweep: true,
      pitchCurve: 'EXP',
      pulseWidth: 0x0800,
      pulseEnd: 0x0100,
      pulseSweep: true,
      decay: 5,
      sustain: 8,
      release: 3
    }
  },
  {
    id: 'jump',
    label: 'Jump',
    defaults: {
      ...basePreset,
      name: 'Jump',
      preset: 'jump',
      lengthTicks: 18,
      gateOffTick: 15,
      wave: 'SAW',
      startPitch: 'C4',
      endPitch: 'C5',
      pitchSweep: true,
      decay: 2,
      sustain: 14,
      release: 2
    }
  },
  {
    id: 'hit',
    label: 'Hit',
    defaults: {
      ...basePreset,
      name: 'Hit',
      preset: 'hit',
      lengthTicks: 12,
      gateOffTick: 9,
      priority: 72,
      wave: 'NOISE',
      startPitch: 'C5',
      endPitch: 'C2',
      pitchSweep: true,
      pitchCurve: 'LOG',
      decay: 4,
      sustain: 6,
      release: 2
    }
  },
  {
    id: 'explosion',
    label: 'Explosion',
    defaults: {
      ...basePreset,
      name: 'Explosion',
      preset: 'explosion',
      lengthTicks: 34,
      gateOffTick: 28,
      priority: 96,
      wave: 'NOISE',
      startPitch: 'C4',
      endPitch: 'C1',
      pitchSweep: true,
      pitchCurve: 'LOG',
      decay: 7,
      sustain: 7,
      release: 6
    }
  }
];

export function createSidSfxSettings(
  presetId: SidSfxPresetId = 'blip'
): SidSfxEffectSettings {
  const preset =
    SID_SFX_PRESETS.find((candidate) => candidate.id === presetId) ??
    SID_SFX_PRESETS[0];
  return { ...preset.defaults };
}

export function normalizeSidSfxSettings(
  settings: SidSfxEffectSettings
): SidSfxEffectSettings {
  const lengthTicks = clampInteger(settings.lengthTicks, 1, 255);
  const gateOffTick = clampInteger(settings.gateOffTick, 0, lengthTicks);
  return {
    ...settings,
    name: settings.name.trim() || 'SFX',
    voice: isSidSfxVoice(settings.voice) ? settings.voice : 'any',
    lengthTicks,
    gateOffTick,
    priority: clampInteger(settings.priority, 0, 255),
    retrigger: isSidSfxRetriggerMode(settings.retrigger)
      ? settings.retrigger
      : 'RESTART',
    wave: isSidSfxWave(settings.wave) ? settings.wave : 'TRI',
    startPitch: normalizeNote(settings.startPitch),
    endPitch: normalizeNote(settings.endPitch),
    pitchCurve: isSidSfxCurve(settings.pitchCurve)
      ? settings.pitchCurve
      : 'LINEAR',
    attack: clampNibble(settings.attack),
    decay: clampNibble(settings.decay),
    sustain: clampNibble(settings.sustain),
    release: clampNibble(settings.release),
    pulseWidth: clampInteger(settings.pulseWidth, 0, 0x0fff),
    pulseEnd: clampInteger(settings.pulseEnd, 0, 0x0fff),
    volume: clampNibble(settings.volume)
  };
}

export function buildSidSfxSource(settings: SidSfxEffectSettings): string {
  const normalized = normalizeSidSfxSettings(settings);
  const effectName = sanitizeSidSfxEffectName(normalized.name);
  const lines = [
    `TITLE ${quoteSidScoreString(`${normalized.name} SFX`)}`,
    'AUTHOR "Commodore Commander"',
    'TEMPO 120',
    'TIME 4/4',
    'SYSTEM PAL',
    '',
    `EFFECT ${effectName} {`,
    `  VOICE ${voiceLabel(normalized.voice)}`,
    `  LENGTH ${normalized.lengthTicks} TICKS`,
    `  PRIORITY ${normalized.priority}`,
    `  RETRIGGER ${normalized.retrigger}`,
    '',
    `  WAVE=${normalized.wave}`,
    `  ADSR=${normalized.attack},${normalized.decay},${normalized.sustain},${normalized.release}`,
    `  VOLUME=${normalized.volume}`,
    `  PITCH=${normalized.startPitch}`
  ];

  if (
    normalized.pitchSweep &&
    normalized.startPitch !== normalized.endPitch
  ) {
    lines.push(
      `  PITCH ${normalized.startPitch} TO ${normalized.endPitch} @${normalized.lengthTicks} ${normalized.pitchCurve}`
    );
  }

  if (normalized.wave === 'PULSE') {
    lines.push(`  PW=${formatSidSfxHexWord(normalized.pulseWidth)}`);
    if (
      normalized.pulseSweep &&
      normalized.pulseWidth !== normalized.pulseEnd
    ) {
      lines.push(
        `  PW ${formatSidSfxHexWord(normalized.pulseWidth)} TO ${formatSidSfxHexWord(normalized.pulseEnd)} @${normalized.lengthTicks} LINEAR`
      );
    }
  }

  lines.push('  GATE=ON');
  lines.push(`  GATE=OFF @${normalized.gateOffTick}`);
  lines.push('}');
  return `${lines.join('\n')}\n`;
}

export function sanitizeSidSfxEffectName(name: string): string {
  const parts = name
    .trim()
    .split(/[^A-Za-z0-9_]+/u)
    .filter(Boolean);
  const id = parts
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join('');
  const fallback = id || 'SFX';
  return /^[A-Za-z_]/u.test(fallback) ? fallback : `SFX${fallback}`;
}

export function formatSidSfxHexWord(value: number): string {
  return `$${clampInteger(value, 0, 0x0fff)
    .toString(16)
    .padStart(4, '0')
    .toUpperCase()}`;
}

function normalizeNote(value: string): string {
  const note = value.trim().toUpperCase();
  return SID_SFX_NOTES.includes(note as typeof SID_SFX_NOTES[number])
    ? note
    : 'C5';
}

function quoteSidScoreString(value: string): string {
  return `"${value.replace(/\\/gu, '\\\\').replace(/"/gu, '\\"')}"`;
}

function voiceLabel(value: SidSfxVoice): string {
  return value === 'any' ? 'ANY' : value;
}

function clampNibble(value: number): number {
  return clampInteger(value, 0, 15);
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}

function isSidSfxVoice(value: string): value is SidSfxVoice {
  return value === 'any' || value === '1' || value === '2' || value === '3';
}

function isSidSfxWave(value: string): value is SidSfxWave {
  return SID_SFX_WAVES.includes(value as SidSfxWave);
}

function isSidSfxCurve(value: string): value is SidSfxCurve {
  return SID_SFX_CURVES.includes(value as SidSfxCurve);
}

function isSidSfxRetriggerMode(value: string): value is SidSfxRetriggerMode {
  return SID_SFX_RETRIGGER_MODES.includes(value as SidSfxRetriggerMode);
}

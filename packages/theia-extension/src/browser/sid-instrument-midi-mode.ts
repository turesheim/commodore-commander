export type MidiModeId = 'song' | 'instrument' | 'playAlong';

export const DEFAULT_MIDI_MODE: MidiModeId = 'instrument';

export function toMidiMode(value: string): MidiModeId {
  if (value === 'song' || value === 'instrument' || value === 'playAlong') {
    return value;
  }
  return DEFAULT_MIDI_MODE;
}

export function isMidiEnabledForMode(
  mode: MidiModeId,
  scorePlaybackActive: boolean
): boolean {
  if (mode === 'song') {
    return false;
  }
  if (mode === 'instrument') {
    return !scorePlaybackActive;
  }
  return true;
}

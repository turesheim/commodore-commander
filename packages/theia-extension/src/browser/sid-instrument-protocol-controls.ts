const PROTOCOL_NUMERIC_CONTROL_IDS = [
  'attack',
  'decay',
  'sustain',
  'release',
  'gateMin',
  'vibratoDelay',
  'vibratoRate',
  'vibratoAmp',
  'vibratoInc',
  'pulseWidth',
  'pulseSweep',
  'pulseMin',
  'pulseMax',
  'filterCutoff',
  'filterResonance'
] as const;

const PROTOCOL_NUMERIC_CONTROLS = new Set<string>(PROTOCOL_NUMERIC_CONTROL_IDS);

export function isSidInstrumentProtocolNumericControl(id: string): boolean {
  return PROTOCOL_NUMERIC_CONTROLS.has(id);
}

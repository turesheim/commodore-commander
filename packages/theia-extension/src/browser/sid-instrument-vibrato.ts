const DEFAULT_RISE_REFERENCE_AMP = 64;

export function vibratoIncrementToRiseFrames(amp: number, increment: number): number {
  const clampedIncrement = clampInteger(increment, 0, 255);
  if (clampedIncrement <= 0) {
    return 0;
  }
  return Math.max(1, Math.ceil(vibratoRiseReferenceAmp(amp) / clampedIncrement));
}

export function vibratoRiseFramesToIncrement(amp: number, riseFrames: number): number {
  const clampedRiseFrames = clampInteger(riseFrames, 0, 64);
  if (clampedRiseFrames <= 0) {
    return 0;
  }
  return clampInteger(Math.ceil(vibratoRiseReferenceAmp(amp) / clampedRiseFrames), 1, 255);
}

export function effectiveVibratoRiseFrames(amp: number, riseFrames: number): number {
  return vibratoIncrementToRiseFrames(amp, vibratoRiseFramesToIncrement(amp, riseFrames));
}

function vibratoRiseReferenceAmp(amp: number): number {
  const clampedAmp = clampInteger(amp, 0, 255);
  return clampedAmp > 0 ? clampedAmp : DEFAULT_RISE_REFERENCE_AMP;
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.round(value)));
}

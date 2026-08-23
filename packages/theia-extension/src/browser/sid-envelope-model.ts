export interface SidAdsrParameters {
  readonly attack: number;
  readonly decay: number;
  readonly sustain: number;
  readonly release: number;
}

export type SidEnvelopePhase =
  | 'idle'
  | 'attack'
  | 'decay'
  | 'sustain'
  | 'release';

export interface SidEnvelopeCurvePoint {
  readonly elapsedCycles: number;
  readonly level: number;
}

export interface SidEnvelopeControlEvent {
  readonly cycle: number;
  readonly gate?: boolean;
  readonly adsr?: Partial<SidAdsrParameters>;
}

export interface SidEnvelopeTimelinePoint {
  readonly cycle: number;
  readonly level: number;
  readonly phase: SidEnvelopePhase;
}

export interface SidEnvelopeTimeline {
  readonly points: readonly SidEnvelopeTimelinePoint[];
  readonly endLevel: number;
  readonly maximumLevel: number;
}

export const SID_PAL_CLOCK_HZ = 985_248;
export const SID_NTSC_CLOCK_HZ = 1_022_727;
export const SID_PAL_FRAME_RATE_HZ = 50.124542;

// Measured reSID rate-counter periods. Each value is the number of SID clocks
// between attack steps or decay/release exponential-counter clocks.
export const SID_ENVELOPE_RATE_PERIODS = Object.freeze([
  8,
  31,
  62,
  94,
  148,
  219,
  266,
  312,
  391,
  976,
  1953,
  3125,
  3906,
  11719,
  19531,
  31250
] as const);

export function sidEnvelopeRatePeriod(rate: number): number {
  return SID_ENVELOPE_RATE_PERIODS[clampNibble(rate)];
}

export function sidSustainLevel(sustain: number): number {
  return clampNibble(sustain) * 0x11;
}

export function sidAttackCurve(
  attack: number,
  startLevel = 0
): readonly SidEnvelopeCurvePoint[] {
  const firstLevel = clampEnvelopeLevel(startLevel);
  const period = sidEnvelopeRatePeriod(attack);
  const points: SidEnvelopeCurvePoint[] = [
    { elapsedCycles: 0, level: firstLevel }
  ];
  for (let level = firstLevel + 1; level <= 0xff; level += 1) {
    points.push({
      elapsedCycles: (level - firstLevel) * period,
      level
    });
  }
  return points;
}

export function sidFallingEnvelopeCurve(
  rate: number,
  startLevel: number,
  endLevel: number
): readonly SidEnvelopeCurvePoint[] {
  const firstLevel = clampEnvelopeLevel(startLevel);
  const lastLevel = Math.min(firstLevel, clampEnvelopeLevel(endLevel));
  const ratePeriod = sidEnvelopeRatePeriod(rate);
  let elapsedCycles = 0;
  const points: SidEnvelopeCurvePoint[] = [
    { elapsedCycles, level: firstLevel }
  ];
  for (let level = firstLevel; level > lastLevel; level -= 1) {
    elapsedCycles += ratePeriod * sidExponentialCounterPeriod(level);
    points.push({ elapsedCycles, level: level - 1 });
  }
  return points;
}

export function sidCurveDurationCycles(
  points: readonly SidEnvelopeCurvePoint[]
): number {
  return points.at(-1)?.elapsedCycles ?? 0;
}

export function sidCyclesToMilliseconds(
  cycles: number,
  clockHz = SID_PAL_CLOCK_HZ
): number {
  const normalizedClock = Number.isFinite(clockHz) && clockHz > 0
    ? clockHz
    : SID_PAL_CLOCK_HZ;
  return (Math.max(0, cycles) / normalizedClock) * 1000;
}

/**
 * Simulates a clean SID envelope cycle. The rate and exponential tables match
 * the digital SID envelope generator; cycle-level pipeline delays and the
 * state-dependent ADSR delay bug are intentionally outside this deterministic
 * preview model.
 */
export function simulateSidEnvelope(
  initialAdsr: SidAdsrParameters,
  durationCycles: number,
  controlEvents: readonly SidEnvelopeControlEvent[]
): SidEnvelopeTimeline {
  const endCycle = Math.max(0, Math.round(durationCycles));
  const events = controlEvents
    .map((event, index) => ({
      ...event,
      cycle: clampInteger(event.cycle, 0, endCycle),
      index
    }))
    .sort((left, right) => left.cycle - right.cycle || left.index - right.index);
  let adsr = normalizeAdsr(initialAdsr);
  let cycle = 0;
  let level = 0;
  let maximumLevel = 0;
  let gate = false;
  let phase: SidEnvelopePhase = 'idle';
  let nextStepCycle = Number.POSITIVE_INFINITY;
  let eventIndex = 0;
  const points: SidEnvelopeTimelinePoint[] = [];

  appendTimelinePoint(points, { cycle, level, phase });

  while (cycle < endCycle || eventIndex < events.length) {
    const event = events[eventIndex];
    const eventCycle = event?.cycle ?? Number.POSITIVE_INFINITY;
    if (event && eventCycle <= nextStepCycle && eventCycle <= endCycle) {
      cycle = eventCycle;
      adsr = event.adsr
        ? normalizeAdsr({ ...adsr, ...event.adsr })
        : adsr;
      if (event.gate !== undefined && event.gate !== gate) {
        gate = event.gate;
        phase = gate
          ? level >= 0xff
            ? decayOrSustainPhase(level, adsr.sustain)
            : 'attack'
          : level > 0
            ? 'release'
            : 'idle';
      } else if (
        gate &&
        (phase === 'decay' || phase === 'sustain')
      ) {
        phase = decayOrSustainPhase(level, adsr.sustain);
      }
      appendTimelinePoint(points, { cycle, level, phase });
      nextStepCycle = scheduleNextStep(cycle, level, phase, adsr);
      eventIndex += 1;
      continue;
    }

    if (nextStepCycle <= endCycle) {
      cycle = nextStepCycle;
      const previousLevel = level;
      if (phase === 'attack') {
        level = Math.min(0xff, level + 1);
        if (level === 0xff) {
          phase = decayOrSustainPhase(level, adsr.sustain);
        }
      } else if (phase === 'decay') {
        const target = sidSustainLevel(adsr.sustain);
        if (level !== target && level > 0) {
          level -= 1;
        }
        if (level === target) {
          phase = 'sustain';
        } else if (level === 0) {
          phase = 'idle';
        }
      } else if (phase === 'release') {
        level = Math.max(0, level - 1);
        if (level === 0) {
          phase = 'idle';
        }
      }
      maximumLevel = Math.max(maximumLevel, level);
      if (level !== previousLevel) {
        appendTimelinePoint(points, {
          cycle,
          level: previousLevel,
          phase
        });
      }
      appendTimelinePoint(points, { cycle, level, phase });
      nextStepCycle = scheduleNextStep(cycle, level, phase, adsr);
      continue;
    }
    break;
  }

  appendTimelinePoint(points, {
    cycle: endCycle,
    level,
    phase
  });
  return {
    points,
    endLevel: level,
    maximumLevel
  };
}

function scheduleNextStep(
  cycle: number,
  level: number,
  phase: SidEnvelopePhase,
  adsr: SidAdsrParameters
): number {
  if (phase === 'attack' && level < 0xff) {
    return cycle + sidEnvelopeRatePeriod(adsr.attack);
  }
  if (
    phase === 'decay' &&
    level > 0 &&
    level !== sidSustainLevel(adsr.sustain)
  ) {
    return cycle +
      sidEnvelopeRatePeriod(adsr.decay) * sidExponentialCounterPeriod(level);
  }
  if (phase === 'release' && level > 0) {
    return cycle +
      sidEnvelopeRatePeriod(adsr.release) * sidExponentialCounterPeriod(level);
  }
  return Number.POSITIVE_INFINITY;
}

function decayOrSustainPhase(
  level: number,
  sustain: number
): SidEnvelopePhase {
  return level === sidSustainLevel(sustain) ? 'sustain' : 'decay';
}

function sidExponentialCounterPeriod(level: number): number {
  // Thresholds and dividers from the reSID envelope generator.
  const normalized = clampEnvelopeLevel(level);
  if (normalized >= 0x5e) {
    return 1;
  }
  if (normalized >= 0x37) {
    return 2;
  }
  if (normalized >= 0x1b) {
    return 4;
  }
  if (normalized >= 0x0f) {
    return 8;
  }
  if (normalized >= 0x07) {
    return 16;
  }
  return normalized > 0 ? 30 : 1;
}

function appendTimelinePoint(
  points: SidEnvelopeTimelinePoint[],
  point: SidEnvelopeTimelinePoint
): void {
  const previous = points.at(-1);
  if (
    previous &&
    previous.cycle === point.cycle &&
    previous.level === point.level
  ) {
    points[points.length - 1] = point;
    return;
  }
  points.push(point);
}

function normalizeAdsr(input: SidAdsrParameters): SidAdsrParameters {
  return {
    attack: clampNibble(input.attack),
    decay: clampNibble(input.decay),
    sustain: clampNibble(input.sustain),
    release: clampNibble(input.release)
  };
}

function clampNibble(value: number): number {
  return clampInteger(value, 0, 15);
}

function clampEnvelopeLevel(value: number): number {
  return clampInteger(value, 0, 0xff);
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.round(value)));
}

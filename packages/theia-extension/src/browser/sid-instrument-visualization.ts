import {
  SID_PAL_CLOCK_HZ,
  sidAttackCurve,
  sidCurveDurationCycles,
  sidCyclesToMilliseconds,
  sidFallingEnvelopeCurve,
  sidSustainLevel,
  type SidEnvelopeCurvePoint
} from './sid-envelope-model';

export interface SidAdsrEnvelopeInput {
  readonly attack: number;
  readonly decay: number;
  readonly sustain: number;
  readonly release: number;
}

export interface SidEnvelopePoint {
  readonly x: number;
  readonly y: number;
}

export interface SidEnvelopeSegmentLabel {
  readonly label: 'A' | 'D' | 'S' | 'R';
  readonly x: number;
  readonly text: string;
  readonly durationCycles?: number;
}

export interface SidAdsrEnvelopeVisualization {
  readonly viewBox: string;
  readonly points: readonly SidEnvelopePoint[];
  readonly pointsAttribute: string;
  readonly areaPath: string;
  readonly sustainY: number;
  readonly labels: readonly SidEnvelopeSegmentLabel[];
  readonly ariaLabel: string;
}

const WIDTH = 280;
const HEIGHT = 104;
const GRAPH_LEFT = 12;
const GRAPH_RIGHT = 268;
const GRAPH_TOP = 10;
const GRAPH_BOTTOM = 80;
const PHASE_WIDTH = (GRAPH_RIGHT - GRAPH_LEFT) / 4;

export function createSidAdsrEnvelopeVisualization(
  input: SidAdsrEnvelopeInput
): SidAdsrEnvelopeVisualization {
  const sustainLevel = sidSustainLevel(input.sustain);
  const sustainY = amplitudeY(sustainLevel / 0xff);
  const attackEndX = GRAPH_LEFT + PHASE_WIDTH;
  const decayEndX = attackEndX + PHASE_WIDTH;
  const sustainEndX = decayEndX + PHASE_WIDTH;
  const attackCurve = sidAttackCurve(input.attack);
  const decayCurve = sidFallingEnvelopeCurve(
    input.decay,
    0xff,
    sustainLevel
  );
  const releaseCurve = sidFallingEnvelopeCurve(
    input.release,
    sustainLevel,
    0
  );
  const attackDuration = sidCurveDurationCycles(attackCurve);
  const decayDuration = sidCurveDurationCycles(decayCurve);
  const releaseDuration = sidCurveDurationCycles(releaseCurve);
  const points: SidEnvelopePoint[] = [];
  appendCurve(points, attackCurve, GRAPH_LEFT, attackEndX);
  appendCurve(points, decayCurve, attackEndX, decayEndX);
  appendPoint(points, { x: sustainEndX, y: sustainY });
  appendCurve(points, releaseCurve, sustainEndX, GRAPH_RIGHT);
  const labels: readonly SidEnvelopeSegmentLabel[] = [
    durationLabel('A', midpoint(GRAPH_LEFT, attackEndX), attackDuration),
    durationLabel('D', midpoint(attackEndX, decayEndX), decayDuration),
    { label: 'S', x: midpoint(decayEndX, sustainEndX), text: 'S GATE' },
    durationLabel('R', midpoint(sustainEndX, GRAPH_RIGHT), releaseDuration)
  ];
  return {
    viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
    points,
    pointsAttribute: points.map(formatPoint).join(' '),
    areaPath: `M ${formatPoint(points[0])} L ${points
      .slice(1)
      .map(formatPoint)
      .join(' L ')} L ${GRAPH_RIGHT} ${GRAPH_BOTTOM} Z`,
    sustainY,
    labels,
    ariaLabel: [
      `SID ADSR envelope at PAL clock speed. Attack ${formatDuration(attackDuration)}.`,
      `Decay ${formatDuration(decayDuration)} to sustain level ${clamp(input.sustain, 0, 15)}.`,
      'Sustain remains while gate is on.',
      `Release ${formatDuration(releaseDuration)} from the sustain level.`
    ].join(' ')
  };
}

function appendCurve(
  points: SidEnvelopePoint[],
  curve: readonly SidEnvelopeCurvePoint[],
  left: number,
  right: number
): void {
  const duration = sidCurveDurationCycles(curve);
  for (const point of curve) {
    const progress = duration > 0 ? point.elapsedCycles / duration : 1;
    appendPoint(points, {
      x: left + (right - left) * progress,
      y: amplitudeY(point.level / 0xff)
    });
  }
}

function appendPoint(
  points: SidEnvelopePoint[],
  point: SidEnvelopePoint
): void {
  const previous = points.at(-1);
  if (previous && previous.x === point.x && previous.y === point.y) {
    return;
  }
  points.push(point);
}

function durationLabel(
  label: 'A' | 'D' | 'R',
  x: number,
  durationCycles: number
): SidEnvelopeSegmentLabel {
  return {
    label,
    x,
    text: `${label} ${formatDuration(durationCycles)}`,
    durationCycles
  };
}

function formatDuration(cycles: number): string {
  const milliseconds = sidCyclesToMilliseconds(cycles, SID_PAL_CLOCK_HZ);
  if (milliseconds < 10) {
    return `${formatDecimal(milliseconds)}ms`;
  }
  if (milliseconds < 1000) {
    return `${Math.round(milliseconds)}ms`;
  }
  const seconds = milliseconds / 1000;
  return `${seconds < 10 ? formatDecimal(seconds) : Math.round(seconds)}s`;
}

function formatDecimal(value: number): string {
  return value.toFixed(1).replace(/\.0$/u, '');
}

function amplitudeY(amplitude: number): number {
  return GRAPH_BOTTOM - amplitude * (GRAPH_BOTTOM - GRAPH_TOP);
}

function midpoint(left: number, right: number): number {
  return left + (right - left) / 2;
}

function formatPoint(point: SidEnvelopePoint): string {
  return `${formatNumber(point.x)},${formatNumber(point.y)}`;
}

function formatNumber(value: number): string {
  return Number(value.toFixed(2)).toString();
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

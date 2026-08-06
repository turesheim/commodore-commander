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
}

export interface SidAdsrEnvelopeVisualization {
  readonly viewBox: string;
  readonly points: readonly SidEnvelopePoint[];
  readonly pointsAttribute: string;
  readonly areaPath: string;
  readonly sustainY: number;
  readonly labels: readonly SidEnvelopeSegmentLabel[];
}

const WIDTH = 280;
const HEIGHT = 104;
const GRAPH_LEFT = 12;
const GRAPH_RIGHT = 268;
const GRAPH_TOP = 10;
const GRAPH_BOTTOM = 80;
const SUSTAIN_WEIGHT = 9;

export function createSidAdsrEnvelopeVisualization(
  input: SidAdsrEnvelopeInput
): SidAdsrEnvelopeVisualization {
  const attackWeight = rateWeight(input.attack);
  const decayWeight = rateWeight(input.decay);
  const releaseWeight = rateWeight(input.release);
  const totalWeight =
    attackWeight + decayWeight + SUSTAIN_WEIGHT + releaseWeight;
  const graphWidth = GRAPH_RIGHT - GRAPH_LEFT;
  const attackWidth = graphWidth * (attackWeight / totalWeight);
  const decayWidth = graphWidth * (decayWeight / totalWeight);
  const sustainWidth = graphWidth * (SUSTAIN_WEIGHT / totalWeight);
  const sustainY = amplitudeY(clamp(input.sustain, 0, 15) / 15);
  const attackEndX = GRAPH_LEFT + attackWidth;
  const decayEndX = attackEndX + decayWidth;
  const sustainEndX = decayEndX + sustainWidth;

  const points = [
    { x: GRAPH_LEFT, y: GRAPH_BOTTOM },
    { x: attackEndX, y: GRAPH_TOP },
    { x: decayEndX, y: sustainY },
    { x: sustainEndX, y: sustainY },
    { x: GRAPH_RIGHT, y: GRAPH_BOTTOM }
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
    labels: [
      { label: 'A', x: midpoint(GRAPH_LEFT, attackEndX) },
      { label: 'D', x: midpoint(attackEndX, decayEndX) },
      { label: 'S', x: midpoint(decayEndX, sustainEndX) },
      { label: 'R', x: midpoint(sustainEndX, GRAPH_RIGHT) }
    ]
  };
}

function rateWeight(value: number): number {
  return 2 + clamp(value, 0, 15);
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

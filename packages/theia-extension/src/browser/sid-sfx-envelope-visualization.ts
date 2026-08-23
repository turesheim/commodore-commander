import {
  normalizeSidSfxSettings,
  type SidSfxEffectSettings
} from '../common/sid-sfx-effect';
import {
  SID_PAL_CLOCK_HZ,
  SID_PAL_FRAME_RATE_HZ,
  simulateSidEnvelope,
  type SidAdsrParameters,
  type SidEnvelopeControlEvent
} from './sid-envelope-model';

export interface SidSfxEnvelopeVisualization {
  readonly pointsAttribute: string;
  readonly gateX: number;
  readonly endLevel: number;
  readonly maximumLevel: number;
  readonly ariaLabel: string;
}

const GRAPH_LEFT = 10;
const GRAPH_RIGHT = 270;
const GRAPH_TOP = 12;
const GRAPH_BOTTOM = 88;
const CYCLES_PER_TICK = SID_PAL_CLOCK_HZ / SID_PAL_FRAME_RATE_HZ;

export function createSidSfxEnvelopeVisualization(
  input: SidSfxEffectSettings
): SidSfxEnvelopeVisualization {
  const settings = normalizeSidSfxSettings(input);
  const durationCycles = tickToCycle(settings.lengthTicks);
  const gateOffCycle = tickToCycle(settings.gateOffTick);
  const initialAdsr: SidAdsrParameters = {
    attack: settings.attack,
    decay: settings.decay,
    sustain: settings.sustain,
    release: settings.release
  };
  const events: SidEnvelopeControlEvent[] = [{ cycle: 0, gate: true }];
  for (const assignment of settings.scriptedAssignments) {
    if (assignment.parameter !== 'ADSR') {
      continue;
    }
    events.push({
      cycle: tickToCycle(assignment.tick),
      adsr: parseAdsr(String(assignment.value))
    });
  }
  // The generated SIDScore source applies timed assignments before GATE=OFF.
  events.push({ cycle: gateOffCycle, gate: false });

  const timeline = simulateSidEnvelope(
    initialAdsr,
    durationCycles,
    events
  );
  const pointsAttribute = timeline.points
    .map((point) => {
      const progress = durationCycles > 0 ? point.cycle / durationCycles : 0;
      const x = GRAPH_LEFT + progress * (GRAPH_RIGHT - GRAPH_LEFT);
      const y = GRAPH_BOTTOM -
        (point.level / 0xff) * (GRAPH_BOTTOM - GRAPH_TOP);
      return `${formatNumber(x)},${formatNumber(y)}`;
    })
    .join(' ');
  const gateX = GRAPH_LEFT +
    (gateOffCycle / durationCycles) * (GRAPH_RIGHT - GRAPH_LEFT);

  return {
    pointsAttribute,
    gateX,
    endLevel: timeline.endLevel,
    maximumLevel: timeline.maximumLevel,
    ariaLabel: [
      `SID sound effect envelope over ${settings.lengthTicks} PAL ticks.`,
      `Gate is cleared at tick ${settings.gateOffTick}.`,
      `Final envelope level is ${timeline.endLevel} of 255.`
    ].join(' ')
  };
}

function tickToCycle(tick: number): number {
  return Math.round(tick * CYCLES_PER_TICK);
}

function parseAdsr(value: string): SidAdsrParameters {
  const parts = value.split(',').map((part) => Number(part.trim()));
  return {
    attack: parts[0] ?? 0,
    decay: parts[1] ?? 0,
    sustain: parts[2] ?? 0,
    release: parts[3] ?? 0
  };
}

function formatNumber(value: number): string {
  return Number(value.toFixed(2)).toString();
}

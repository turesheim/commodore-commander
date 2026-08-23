export type SidScoreScopeMode = 'free' | 'triggered';

export interface SidScoreScopeChannel {
  readonly voiceIndex: number;
  readonly samples: readonly number[];
}

export interface SidScoreScopeDisplayChannel {
  readonly voiceIndex: number;
  readonly samples: readonly number[];
}

export interface SidScoreScopeDisplay {
  readonly channels: readonly SidScoreScopeDisplayChannel[];
  readonly triggered: boolean;
  readonly triggerPosition: number | undefined;
}

const TRIGGER_POSITION_RATIO = 0.125;
const MIN_TRIGGER_RANGE = 8 / 32768;

export function createSidScoreScopeDisplay(
  channels: readonly SidScoreScopeChannel[],
  mode: SidScoreScopeMode,
  triggerVoice: number,
  windowSize: number
): SidScoreScopeDisplay {
  const displaySize = Math.max(1, Math.floor(windowSize));
  const source = channels.find((channel) => channel.voiceIndex === triggerVoice);
  if (mode !== 'triggered' || !source) {
    return latestDisplay(channels, displaySize);
  }

  const triggerPosition = Math.min(
    Math.floor(displaySize * TRIGGER_POSITION_RATIO),
    displaySize - 1
  );
  const crossing = findLatestRisingTrigger(
    source.samples,
    displaySize,
    triggerPosition
  );
  if (crossing === undefined) {
    return latestDisplay(channels, displaySize);
  }

  const sourceEnd = crossing - triggerPosition + displaySize;
  const endOffset = source.samples.length - sourceEnd;
  return {
    channels: alignedDisplay(channels, displaySize, endOffset),
    triggered: true,
    triggerPosition
  };
}

function latestDisplay(
  channels: readonly SidScoreScopeChannel[],
  displaySize: number
): SidScoreScopeDisplay {
  return {
    channels: alignedDisplay(channels, displaySize, 0),
    triggered: false,
    triggerPosition: undefined
  };
}

function alignedDisplay(
  channels: readonly SidScoreScopeChannel[],
  displaySize: number,
  endOffset: number
): readonly SidScoreScopeDisplayChannel[] {
  return channels.map((channel) => {
    const end = Math.max(0, channel.samples.length - endOffset);
    const start = Math.max(0, end - displaySize);
    return {
      voiceIndex: channel.voiceIndex,
      samples: channel.samples.slice(start, end)
    };
  });
}

function findLatestRisingTrigger(
  samples: readonly number[],
  displaySize: number,
  triggerPosition: number
): number | undefined {
  if (samples.length < displaySize) {
    return undefined;
  }

  const latestCrossing = samples.length - (displaySize - triggerPosition);
  const searchStart = Math.max(
    1,
    triggerPosition,
    latestCrossing - displaySize * 2
  );
  if (latestCrossing < searchStart) {
    return undefined;
  }

  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  for (let index = searchStart - 1; index < samples.length; index += 1) {
    const sample = samples[index] ?? 0;
    minimum = Math.min(minimum, sample);
    maximum = Math.max(maximum, sample);
  }

  const range = maximum - minimum;
  if (!Number.isFinite(range) || range < MIN_TRIGGER_RANGE) {
    return undefined;
  }

  const threshold = minimum + range / 2;
  const lowThreshold = threshold - range * 0.05;
  // Re-arm below the hysteresis band so noise around the midpoint cannot
  // produce several triggers for one rising edge.
  let armed = (samples[searchStart - 1] ?? 0) <= lowThreshold;
  let latest: number | undefined;
  for (let index = searchStart; index <= latestCrossing; index += 1) {
    const previous = samples[index - 1] ?? 0;
    const current = samples[index] ?? 0;
    if (current <= lowThreshold) {
      armed = true;
    }
    if (armed && previous < threshold && current >= threshold) {
      latest = index;
      armed = false;
    }
  }
  return latest;
}

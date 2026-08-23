import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createSidScoreSpectrogram,
  frequencyForSpectrogramRow
} from '../browser/sidscore-spectrogram';

const SAMPLE_RATE = 8192;
const TEST_OPTIONS = {
  fftSize: 256,
  hopSize: 128,
  height: 64,
  minFrequency: 32
} as const;

describe('SIDScore spectrogram', () => {
  it('creates one time column for each overlapping analysis frame', () => {
    const result = createSidScoreSpectrogram(
      sineWave(512, 1024, 1),
      SAMPLE_RATE,
      TEST_OPTIONS
    );

    assert.equal(result.width, 3);
    assert.equal(result.height, 64);
    assert.equal(result.intensities.length, 3 * 64);
    assert.equal(result.timeSpanSeconds, 512 / SAMPLE_RATE);
  });

  it('places a sinusoid at its frequency on the logarithmic axis', () => {
    const result = createSidScoreSpectrogram(
      sineWave(512, 1024, 1),
      SAMPLE_RATE,
      TEST_OPTIONS
    );
    const peakRow = strongestRow(result.intensities, result.width, 1);
    const peakFrequency = frequencyForSpectrogramRow(
      peakRow,
      result.height,
      result.minFrequency,
      result.maxFrequency
    );

    assert.ok(peakFrequency > 900 && peakFrequency < 1150);
  });

  it('preserves frequency changes from left to right', () => {
    const samples = [
      ...sineWave(384, 256, 1),
      ...sineWave(384, 1024, 1)
    ];
    const result = createSidScoreSpectrogram(
      samples,
      SAMPLE_RATE,
      TEST_OPTIONS
    );
    const firstFrequency = rowFrequency(result, 0);
    const lastFrequency = rowFrequency(result, result.width - 1);

    assert.ok(firstFrequency > 200 && firstFrequency < 330);
    assert.ok(lastFrequency > 900 && lastFrequency < 1150);
  });

  it('uses a fixed dBFS scale rather than normalising each frame', () => {
    const fullScale = createSidScoreSpectrogram(
      sineWave(512, 1024, 1),
      SAMPLE_RATE,
      TEST_OPTIONS
    );
    const halfScale = createSidScoreSpectrogram(
      sineWave(512, 1024, 0.5),
      SAMPLE_RATE,
      TEST_OPTIONS
    );
    const fullPeak = strongestIntensity(fullScale.intensities);
    const halfPeak = strongestIntensity(halfScale.intensities);

    assert.ok(fullPeak > halfPeak);
    assert.ok(fullPeak - halfPeak > 0.04 && fullPeak - halfPeak < 0.09);
  });

  it('maps silence to the dBFS floor', () => {
    const result = createSidScoreSpectrogram(
      new Array<number>(512).fill(0),
      SAMPLE_RATE,
      TEST_OPTIONS
    );

    assert.equal(strongestIntensity(result.intensities), 0);
  });
});

function sineWave(
  length: number,
  frequency: number,
  amplitude: number
): readonly number[] {
  return Array.from(
    { length },
    (_value, index) =>
      amplitude * Math.sin((2 * Math.PI * frequency * index) / SAMPLE_RATE)
  );
}

function strongestRow(
  intensities: Float32Array,
  width: number,
  column: number
): number {
  let strongest = Number.NEGATIVE_INFINITY;
  let strongestRow = 0;
  for (let row = 0; row < intensities.length / width; row += 1) {
    const intensity = intensities[row * width + column] ?? 0;
    if (intensity > strongest) {
      strongest = intensity;
      strongestRow = row;
    }
  }
  return strongestRow;
}

function rowFrequency(
  result: ReturnType<typeof createSidScoreSpectrogram>,
  column: number
): number {
  return frequencyForSpectrogramRow(
    strongestRow(result.intensities, result.width, column),
    result.height,
    result.minFrequency,
    result.maxFrequency
  );
}

function strongestIntensity(intensities: Float32Array): number {
  let strongest = 0;
  for (const intensity of intensities) {
    strongest = Math.max(strongest, intensity);
  }
  return strongest;
}

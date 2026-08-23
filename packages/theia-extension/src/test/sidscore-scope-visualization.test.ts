import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createSidScoreScopeDisplay,
  type SidScoreScopeChannel
} from '../browser/sidscore-scope-visualization';

describe('SIDScore scope visualization', () => {
  it('shows the newest samples in free mode', () => {
    const display = createSidScoreScopeDisplay(
      [channel(1, sequence(12))],
      'free',
      1,
      5
    );

    assert.deepEqual(display.channels[0]?.samples, [7, 8, 9, 10, 11]);
    assert.equal(display.triggered, false);
    assert.equal(display.triggerPosition, undefined);
  });

  it('anchors a triggered display to the latest rising threshold crossing', () => {
    const samples = repeatedWave(48);
    const display = createSidScoreScopeDisplay(
      [channel(1, samples)],
      'triggered',
      1,
      16
    );

    assert.equal(display.triggered, true);
    assert.equal(display.triggerPosition, 2);
    assert.ok((display.channels[0]?.samples[1] ?? 0) < 0);
    assert.ok((display.channels[0]?.samples[2] ?? 0) >= 0);
  });

  it('keeps all voice channels aligned to the trigger source', () => {
    const source = repeatedWave(48);
    const marker = sequence(48);
    const display = createSidScoreScopeDisplay(
      [channel(1, source), channel(2, marker)],
      'triggered',
      1,
      16
    );

    const triggerSample =
      display.channels[1]?.samples[display.triggerPosition ?? 0];
    assert.equal(triggerSample, 34);
  });

  it('keeps a periodic waveform stationary as new samples arrive', () => {
    const first = createSidScoreScopeDisplay(
      [channel(1, repeatedWave(48))],
      'triggered',
      1,
      16
    );
    const second = createSidScoreScopeDisplay(
      [channel(1, repeatedWave(55))],
      'triggered',
      1,
      16
    );

    assert.equal(first.triggered, true);
    assert.equal(second.triggered, true);
    assert.deepEqual(second.channels[0]?.samples, first.channels[0]?.samples);
  });

  it('falls back to the newest samples when the trigger source is silent', () => {
    const samples = new Array<number>(32).fill(0);
    const display = createSidScoreScopeDisplay(
      [channel(1, samples)],
      'triggered',
      1,
      8
    );

    assert.equal(display.triggered, false);
    assert.deepEqual(display.channels[0]?.samples, new Array<number>(8).fill(0));
  });

  it('falls back to free mode when the selected trigger voice is unavailable', () => {
    const display = createSidScoreScopeDisplay(
      [channel(1, sequence(10))],
      'triggered',
      3,
      4
    );

    assert.equal(display.triggered, false);
    assert.deepEqual(display.channels[0]?.samples, [6, 7, 8, 9]);
  });
});

function channel(
  voiceIndex: number,
  samples: readonly number[]
): SidScoreScopeChannel {
  return { voiceIndex, samples };
}

function sequence(length: number): readonly number[] {
  return Array.from({ length }, (_value, index) => index);
}

function repeatedWave(length: number): readonly number[] {
  const period = [-1, -0.5, 0.5, 1];
  return Array.from(
    { length },
    (_value, index) => period[index % period.length] ?? 0
  );
}

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SID_ENVELOPE_RATE_PERIODS,
  sidAttackCurve,
  sidCurveDurationCycles,
  sidFallingEnvelopeCurve,
  sidSustainLevel,
  simulateSidEnvelope
} from '../browser/sid-envelope-model';

test('SID envelope model uses the measured 16-step rate table', () => {
  assert.deepEqual(SID_ENVELOPE_RATE_PERIODS, [
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
  ]);
});

test('SID attack duration is linear and rate controlled', () => {
  assert.equal(sidCurveDurationCycles(sidAttackCurve(0)), 255 * 8);
  assert.equal(sidCurveDurationCycles(sidAttackCurve(15)), 255 * 31250);
});

test('SID falling envelope uses the exponential divider thresholds', () => {
  const curve = sidFallingEnvelopeCurve(0, 0xff, 0);

  assert.equal(sidCurveDurationCycles(curve), 756 * 8);
  assert.equal(cycleAtLevel(curve, 0x5d) - cycleAtLevel(curve, 0x5e), 8);
  assert.equal(cycleAtLevel(curve, 0x5c) - cycleAtLevel(curve, 0x5d), 16);
  assert.equal(cycleAtLevel(curve, 0x05) - cycleAtLevel(curve, 0x06), 240);
});

test('SID sustain nibble maps to repeated four-bit envelope level', () => {
  assert.equal(sidSustainLevel(0), 0x00);
  assert.equal(sidSustainLevel(10), 0xaa);
  assert.equal(sidSustainLevel(15), 0xff);
});

test('SID gate off during attack releases from the current level', () => {
  const timeline = simulateSidEnvelope(
    { attack: 4, decay: 0, sustain: 15, release: 0 },
    4000,
    [
      { cycle: 0, gate: true },
      { cycle: 740, gate: false }
    ]
  );

  assert.equal(timeline.maximumLevel, 4);
  assert.equal(timeline.endLevel, 0);
});

test('SID release rate changes the level reached in a fixed time', () => {
  const fast = simulateSidEnvelope(
    { attack: 0, decay: 0, sustain: 15, release: 0 },
    10_000,
    [
      { cycle: 0, gate: true },
      { cycle: 3000, gate: false }
    ]
  );
  const slow = simulateSidEnvelope(
    { attack: 0, decay: 0, sustain: 15, release: 15 },
    10_000,
    [
      { cycle: 0, gate: true },
      { cycle: 3000, gate: false }
    ]
  );

  assert.equal(fast.endLevel, 0);
  assert.equal(slow.endLevel, 255);
});

function cycleAtLevel(
  curve: readonly { readonly elapsedCycles: number; readonly level: number }[],
  level: number
): number {
  const point = curve.find((candidate) => candidate.level === level);
  assert.ok(point);
  return point.elapsedCycles;
}

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createSidAdsrEnvelopeVisualization
} from '../browser/sid-instrument-visualization';

test('SID instrument ADSR visualization creates ordered envelope points', () => {
  const visualization = createSidAdsrEnvelopeVisualization({
    attack: 1,
    decay: 4,
    sustain: 10,
    release: 3
  });

  assert.equal(visualization.viewBox, '0 0 280 104');
  assert.equal(visualization.points.length, 5);
  assert.equal(visualization.points[0]?.x, 12);
  assert.equal(visualization.points[0]?.y, 80);
  assert.equal(visualization.points[1]?.y, 10);
  assert.equal(visualization.points[4]?.x, 268);
  assert.equal(visualization.points[4]?.y, 80);
  for (let index = 1; index < visualization.points.length; index += 1) {
    const current = visualization.points[index];
    const previous = visualization.points[index - 1];
    assert.ok(current);
    assert.ok(previous);
    assert.ok(current.x > previous.x);
  }
  assert.deepEqual(
    visualization.labels.map((label) => label.label),
    ['A', 'D', 'S', 'R']
  );
});

test('SID instrument ADSR visualization maps sustain level to vertical position', () => {
  const lowSustain = createSidAdsrEnvelopeVisualization({
    attack: 4,
    decay: 4,
    sustain: 0,
    release: 4
  });
  const highSustain = createSidAdsrEnvelopeVisualization({
    attack: 4,
    decay: 4,
    sustain: 15,
    release: 4
  });

  assert.equal(lowSustain.sustainY, 80);
  assert.equal(highSustain.sustainY, 10);
  assert.ok(highSustain.sustainY < lowSustain.sustainY);
});

test('SID instrument ADSR visualization expands slower rate segments', () => {
  const fastAttack = createSidAdsrEnvelopeVisualization({
    attack: 0,
    decay: 4,
    sustain: 10,
    release: 4
  });
  const slowAttack = createSidAdsrEnvelopeVisualization({
    attack: 15,
    decay: 4,
    sustain: 10,
    release: 4
  });

  const fastAttackWidth =
    pointAt(fastAttack.points, 1).x - pointAt(fastAttack.points, 0).x;
  const slowAttackWidth =
    pointAt(slowAttack.points, 1).x - pointAt(slowAttack.points, 0).x;

  assert.ok(slowAttackWidth > fastAttackWidth);
});

function pointAt<T>(items: readonly T[], index: number): T {
  const item = items[index];
  assert.ok(item);
  return item;
}

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

  assert.equal(visualization.viewBox, '0 0 280 126');
  assert.ok(visualization.points.length > 500);
  assert.equal(visualization.points[0]?.x, 12);
  assert.equal(visualization.points[0]?.y, 80);
  assert.equal(visualization.points.at(-1)?.x, 268);
  assert.equal(visualization.points.at(-1)?.y, 80);
  for (let index = 1; index < visualization.points.length; index += 1) {
    const current = visualization.points[index];
    const previous = visualization.points[index - 1];
    assert.ok(current);
    assert.ok(previous);
    assert.ok(current.x >= previous.x);
  }
  assert.deepEqual(
    visualization.labels.map((label) => label.label),
    ['A', 'D', 'S', 'R']
  );
});

test('SID instrument visualization includes gate articulation settings', () => {
  const visualization = createSidAdsrEnvelopeVisualization({
    attack: 1,
    decay: 4,
    sustain: 10,
    release: 3,
    gateMode: 'retrigger',
    gateMin: 4,
    hardRestart: true
  });

  assert.equal(
    visualization.gate.pointsAttribute,
    '12,112 17,112 17,103 204,103 204,112 268,112'
  );
  assert.equal(visualization.gate.detailText, 'RETRIGGER  MIN 4F  RESTART');
  assert.match(visualization.ariaLabel, /Gate mode is retrigger/u);
  assert.match(visualization.ariaLabel, /Minimum gate-on time is 4 PAL frames/u);
  assert.match(visualization.ariaLabel, /Restart is enabled/u);
});

test('SID instrument visualization reports legato without restart', () => {
  const visualization = createSidAdsrEnvelopeVisualization({
    attack: 1,
    decay: 4,
    sustain: 10,
    release: 3,
    gateMode: 'legato',
    gateMin: 1,
    hardRestart: false
  });

  assert.equal(visualization.gate.detailText, 'LEGATO  MIN 1F');
  assert.match(visualization.ariaLabel, /Gate mode is legato/u);
  assert.match(visualization.ariaLabel, /Minimum gate-on time is 1 PAL frame\./u);
  assert.doesNotMatch(visualization.ariaLabel, /Restart is enabled/u);
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

test('SID instrument ADSR visualization reports measured phase durations', () => {
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

  const fastAttackDuration = labelDuration(fastAttack, 'A');
  const slowAttackDuration = labelDuration(slowAttack, 'A');

  assert.equal(fastAttackDuration, 255 * 8);
  assert.equal(slowAttackDuration, 255 * 31250);
  assert.match(slowAttack.ariaLabel, /Attack 8\.1s/u);
});

function labelDuration(
  visualization: ReturnType<typeof createSidAdsrEnvelopeVisualization>,
  label: 'A' | 'D' | 'R'
): number {
  const duration = visualization.labels.find(
    (candidate) => candidate.label === label
  )?.durationCycles;
  assert.ok(duration !== undefined);
  return duration;
}

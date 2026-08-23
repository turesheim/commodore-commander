import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createSidSfxSettings
} from '../common/sid-sfx-effect';
import {
  createSidSfxEnvelopeVisualization
} from '../browser/sid-sfx-envelope-visualization';

test('SID SFX envelope plots gate position on the effect timeline', () => {
  const visualization = createSidSfxEnvelopeVisualization({
    ...createSidSfxSettings('blip'),
    lengthTicks: 8,
    gateOffTick: 2
  });

  assert.equal(visualization.gateX, 75);
  assert.match(visualization.ariaLabel, /Gate is cleared at tick 2/u);
});

test('SID SFX envelope releases from a partial attack level', () => {
  const visualization = createSidSfxEnvelopeVisualization({
    ...createSidSfxSettings('blip'),
    lengthTicks: 8,
    gateOffTick: 2,
    attack: 15,
    release: 0
  });

  assert.equal(visualization.maximumLevel, 1);
  assert.equal(visualization.endLevel, 0);
});

test('SID SFX envelope uses the selected release rate', () => {
  const settings = {
    ...createSidSfxSettings('blip'),
    lengthTicks: 8,
    gateOffTick: 2,
    sustain: 15
  };
  const fast = createSidSfxEnvelopeVisualization({
    ...settings,
    release: 0
  });
  const slow = createSidSfxEnvelopeVisualization({
    ...settings,
    release: 15
  });

  assert.equal(fast.endLevel, 0);
  assert.ok(slow.endLevel > 0);
});

test('SID SFX envelope applies scripted ADSR assignments before gate off', () => {
  const settings = {
    ...createSidSfxSettings('blip'),
    lengthTicks: 8,
    gateOffTick: 2,
    sustain: 15,
    release: 15
  };
  const unchanged = createSidSfxEnvelopeVisualization(settings);
  const reassigned = createSidSfxEnvelopeVisualization({
    ...settings,
    scriptedAssignments: [
      { tick: 2, parameter: 'ADSR', value: '0,0,15,0' }
    ]
  });

  assert.ok(unchanged.endLevel > 0);
  assert.equal(reassigned.endLevel, 0);
});

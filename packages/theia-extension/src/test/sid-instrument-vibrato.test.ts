import test from 'node:test';
import assert from 'node:assert/strict';

import {
  effectiveVibratoRiseFrames,
  vibratoIncrementToRiseFrames,
  vibratoRiseFramesToIncrement
} from '../browser/sid-instrument-vibrato';

test('SID Instrument converts vibrato rise frames to protocol increment', () => {
  assert.equal(vibratoRiseFramesToIncrement(64, 0), 0);
  assert.equal(vibratoRiseFramesToIncrement(64, 4), 16);
  assert.equal(vibratoRiseFramesToIncrement(128, 4), 32);
  assert.equal(vibratoRiseFramesToIncrement(10, 20), 1);
});

test('SID Instrument converts protocol increment back to rise frames', () => {
  assert.equal(vibratoIncrementToRiseFrames(64, 0), 0);
  assert.equal(vibratoIncrementToRiseFrames(64, 16), 4);
  assert.equal(vibratoIncrementToRiseFrames(128, 32), 4);
  assert.equal(vibratoIncrementToRiseFrames(10, 20), 1);
});

test('SID Instrument keeps rise editable while vibrato amplitude is off', () => {
  assert.equal(vibratoRiseFramesToIncrement(0, 4), 16);
  assert.equal(vibratoIncrementToRiseFrames(0, 16), 4);
});

test('SID Instrument reports effective rise after protocol quantization', () => {
  assert.equal(effectiveVibratoRiseFrames(64, 4), 4);
  assert.equal(effectiveVibratoRiseFrames(10, 20), 10);
});

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_MIDI_MODE,
  isMidiEnabledForMode,
  toMidiMode
} from '../browser/sid-instrument-midi-mode';

test('SID Instrument defaults MIDI mode to Instrument', () => {
  assert.equal(DEFAULT_MIDI_MODE, 'instrument');
  assert.equal(toMidiMode(''), 'instrument');
  assert.equal(toMidiMode('unknown'), 'instrument');
});

test('SID Instrument preserves explicit MIDI mode selections', () => {
  assert.equal(toMidiMode('song'), 'song');
  assert.equal(toMidiMode('instrument'), 'instrument');
  assert.equal(toMidiMode('playAlong'), 'playAlong');
});

test('SID Instrument enables MIDI according to playback mode', () => {
  assert.equal(isMidiEnabledForMode('song', false), false);
  assert.equal(isMidiEnabledForMode('song', true), false);
  assert.equal(isMidiEnabledForMode('instrument', false), true);
  assert.equal(isMidiEnabledForMode('instrument', true), false);
  assert.equal(isMidiEnabledForMode('playAlong', false), true);
  assert.equal(isMidiEnabledForMode('playAlong', true), true);
});

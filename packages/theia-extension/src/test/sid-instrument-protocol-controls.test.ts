import test from 'node:test';
import assert from 'node:assert/strict';

import { isSidInstrumentProtocolNumericControl } from '../browser/sid-instrument-protocol-controls';

test('SID Instrument vibrato controls send instrument updates', () => {
  for (const id of ['vibratoDelay', 'vibratoRate', 'vibratoAmp', 'vibratoInc']) {
    assert.equal(isSidInstrumentProtocolNumericControl(id), true, id);
  }
});

test('SID Instrument local-only controls do not send instrument updates', () => {
  assert.equal(isSidInstrumentProtocolNumericControl('filterSweep'), false);
  assert.equal(isSidInstrumentProtocolNumericControl('filterMin'), false);
  assert.equal(isSidInstrumentProtocolNumericControl('filterMax'), false);
});

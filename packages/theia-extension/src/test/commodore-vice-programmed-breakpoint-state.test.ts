import assert from 'node:assert/strict';
import { test } from 'node:test';

import { COMMODORE_VICE_PROGRAMMED_BREAKPOINT_RAW_ID } from '../common/commodore-vice-programmed-breakpoints';
import {
  isProgrammedSourceBreakpoint,
  programmedBreakpointId
} from '../browser/commodore-vice-programmed-breakpoint-state';

test('programmed breakpoint ids are read from source breakpoint raw data', () => {
  const programmed = programmedSourceBreakpoint(7);
  const regular = { raw: { line: 55 } };

  assert.equal(programmedBreakpointId(programmed), 7);
  assert.equal(isProgrammedSourceBreakpoint(programmed), true);
  assert.equal(programmedBreakpointId(regular), undefined);
  assert.equal(isProgrammedSourceBreakpoint(regular), false);
});

function programmedSourceBreakpoint(id: number): {
  raw: {
    line: number;
    [COMMODORE_VICE_PROGRAMMED_BREAKPOINT_RAW_ID]: number;
  };
} {
  return {
    raw: {
      line: 55,
      [COMMODORE_VICE_PROGRAMMED_BREAKPOINT_RAW_ID]: id
    }
  };
}

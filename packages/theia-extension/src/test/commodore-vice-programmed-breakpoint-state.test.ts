import assert from 'node:assert/strict';
import { test } from 'node:test';

import { COMMODORE_VICE_PROGRAMMED_BREAKPOINT_RAW_ID } from '../common/commodore-vice-programmed-breakpoints';
import {
  isProgrammedSourceBreakpoint,
  programmedBreakpointId,
  pruneHiddenProgrammedBreakpointIds,
  rememberHiddenProgrammedBreakpointIds,
  visibleProgrammedBreakpoints
} from '../browser/commodore-vice-programmed-breakpoint-state';

test('programmed breakpoints are visible until their marker is removed', () => {
  const hidden = new Set<number>();
  const breakpoints = [
    { id: 7, address: '$1009' },
    { id: 8, address: '$1010' }
  ];

  assert.deepEqual(visibleProgrammedBreakpoints(breakpoints, hidden), breakpoints);

  rememberHiddenProgrammedBreakpointIds(
    hidden,
    new Map([[7, breakpoints[0]]]),
    [programmedSourceBreakpoint(7)]
  );

  assert.deepEqual(visibleProgrammedBreakpoints(breakpoints, hidden), [
    breakpoints[1]
  ]);
});

test('removed programmed marker ids are forgotten when the compiled breakpoint disappears', () => {
  const hidden = new Set([7]);

  pruneHiddenProgrammedBreakpointIds(hidden, [{ id: 8 }]);

  assert.deepEqual([...hidden], []);
  assert.deepEqual(
    visibleProgrammedBreakpoints([{ id: 8, address: '$1009' }], hidden),
    [{ id: 8, address: '$1009' }]
  );
});

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

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { COMMODORE_VICE_PROGRAMMED_BREAKPOINT_RAW_ID } from '../common/commodore-vice-programmed-breakpoints';
import {
  removeIgnoringProgrammedBreakpoints
} from '../browser/commodore-vice-debug-source-breakpoint-patch';

test('programmed source breakpoint remove is ignored', () => {
  let doRemoveCalled = false;
  let setBreakpointsCalled = false;
  const breakpoint = {
    id: 'programmed-marker',
    uri: 'file:///tmp/screencolors.asm',
    enabled: true,
    raw: {
      line: 55,
      [COMMODORE_VICE_PROGRAMMED_BREAKPOINT_RAW_ID]: 7
    }
  };
  const model = {
    origins: [breakpoint],
    uri: breakpoint.uri,
    breakpoints: {
      setBreakpoints: () => {
        setBreakpointsCalled = true;
      }
    },
    doRemove: () => {
      doRemoveCalled = true;
      return [];
    }
  };

  removeIgnoringProgrammedBreakpoints.call(model as never);

  assert.equal(doRemoveCalled, false);
  assert.equal(setBreakpointsCalled, false);
});

test('regular source breakpoint remove still updates breakpoints', () => {
  let setBreakpointsCalled = false;
  const breakpoint = {
    id: 'regular-marker',
    uri: 'file:///tmp/debug-demo.asm',
    enabled: true,
    raw: {
      line: 67
    }
  };
  const model = {
    origins: [breakpoint],
    uri: breakpoint.uri,
    breakpoints: {
      setBreakpoints: () => {
        setBreakpointsCalled = true;
      }
    },
    doRemove: () => []
  };

  removeIgnoringProgrammedBreakpoints.call(model as never);

  assert.equal(setBreakpointsCalled, true);
});

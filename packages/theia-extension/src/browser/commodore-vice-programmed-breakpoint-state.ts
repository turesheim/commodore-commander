import { COMMODORE_VICE_PROGRAMMED_BREAKPOINT_RAW_ID } from '../common/commodore-vice-programmed-breakpoints';

export interface SourceBreakpointLike {
  raw: object;
}

export function programmedBreakpointId(
  breakpoint: SourceBreakpointLike
): number | undefined {
  const id = (breakpoint.raw as {
    [COMMODORE_VICE_PROGRAMMED_BREAKPOINT_RAW_ID]?: unknown;
  })[COMMODORE_VICE_PROGRAMMED_BREAKPOINT_RAW_ID];
  return typeof id === 'number' ? id : undefined;
}

export function isProgrammedSourceBreakpoint(
  breakpoint: SourceBreakpointLike
): boolean {
  return programmedBreakpointId(breakpoint) !== undefined;
}

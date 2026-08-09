import { COMMODORE_VICE_PROGRAMMED_BREAKPOINT_RAW_ID } from '../common/commodore-vice-programmed-breakpoints';

export interface ProgrammedBreakpointLike {
  id: number;
}

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

export function rememberHiddenProgrammedBreakpointIds(
  hiddenIds: Set<number>,
  knownBreakpointsById: ReadonlyMap<number, unknown>,
  removed: readonly SourceBreakpointLike[]
): void {
  for (const breakpoint of removed) {
    const id = programmedBreakpointId(breakpoint);
    if (id !== undefined && knownBreakpointsById.has(id)) {
      hiddenIds.add(id);
    }
  }
}

export function pruneHiddenProgrammedBreakpointIds(
  hiddenIds: Set<number>,
  reportedBreakpoints: readonly ProgrammedBreakpointLike[]
): void {
  const reportedIds = new Set(reportedBreakpoints.map((breakpoint) => breakpoint.id));
  for (const hiddenId of hiddenIds) {
    if (!reportedIds.has(hiddenId)) {
      hiddenIds.delete(hiddenId);
    }
  }
}

export function visibleProgrammedBreakpoints<T extends ProgrammedBreakpointLike>(
  breakpoints: readonly T[],
  hiddenIds: ReadonlySet<number>
): T[] {
  return breakpoints.filter((breakpoint) => !hiddenIds.has(breakpoint.id));
}

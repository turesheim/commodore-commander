import URI from '@theia/core/lib/common/uri';
import { injectable } from '@theia/core/shared/inversify';
import { BreakpointManager } from '@theia/debug/lib/browser/breakpoint/breakpoint-manager';
import type { SourceBreakpoint } from '@theia/debug/lib/browser/breakpoint/breakpoint-marker';

import {
  COMMODORE_VICE_PROGRAMMED_BREAKPOINT_RAW_ID
} from '../common/commodore-vice-programmed-breakpoints';

type ProgrammedBreakpointRaw = SourceBreakpoint['raw'] & {
  [COMMODORE_VICE_PROGRAMMED_BREAKPOINT_RAW_ID]?: unknown;
};

@injectable()
export class CommodoreViceBreakpointManager extends BreakpointManager {
  private allowProgrammedBreakpointRemovalDepth = 0;

  withProgrammedBreakpointRemovalAllowed<T>(callback: () => T): T {
    this.allowProgrammedBreakpointRemovalDepth += 1;
    try {
      return callback();
    } finally {
      this.allowProgrammedBreakpointRemovalDepth -= 1;
    }
  }

  override setBreakpoints(uri: URI, breakpoints: SourceBreakpoint[]): void {
    super.setBreakpoints(
      uri,
      this.allowProgrammedBreakpointRemovalDepth > 0
        ? breakpoints
        : this.withProtectedProgrammedBreakpoints(uri, breakpoints)
    );
  }

  override enableAllBreakpoints(enabled: boolean): void {
    const changedByUri = new Map<string, SourceBreakpoint[]>();
    for (const uriString of this.getUris()) {
      const uri = new URI(uriString);
      const changed = this.getBreakpoints(uri).filter((breakpoint) =>
        breakpoint.enabled !== enabled
      );
      if (changed.length > 0) {
        changedByUri.set(uriString, changed);
      }
    }

    super.enableAllBreakpoints(enabled);

    for (const [uriString, changed] of changedByUri) {
      this.onDidChangeBreakpointsEmitter.fire({
        uri: new URI(uriString),
        added: [],
        removed: [],
        changed
      });
    }
  }

  override removeBreakpoints(): void {
    if (this.allowProgrammedBreakpointRemovalDepth > 0) {
      super.removeBreakpoints();
      return;
    }

    const uriStrings = [...this.getUris()];
    for (const uriString of uriStrings) {
      const uri = new URI(uriString);
      const breakpoints = this.getBreakpoints(uri)
        .filter(isProgrammedSourceBreakpoint)
        .map(preservedProgrammedSourceBreakpoint);
      super.setBreakpoints(uri, breakpoints);
    }
    this.setFunctionBreakpoints([]);
    this.clearInstructionBreakpoints();
  }

  override save(): void {
    const data: BreakpointManager.Data = {
      breakpointsEnabled: this.breakpointsEnabled,
      breakpoints: {}
    };
    for (const uriString of this.getUris()) {
      const uri = new URI(uriString);
      const breakpoints = this.getBreakpoints(uri)
        .filter((breakpoint) => !isProgrammedSourceBreakpoint(breakpoint));
      if (breakpoints.length > 0) {
        data.breakpoints[uriString] = breakpoints;
      }
    }

    const functionBreakpoints = this.getFunctionBreakpoints();
    if (functionBreakpoints.length > 0) {
      data.functionBreakpoints = functionBreakpoints;
    }

    const exceptionBreakpoints = [...this.getExceptionBreakpoints()];
    if (exceptionBreakpoints.length > 0) {
      data.exceptionBreakpoints = exceptionBreakpoints;
    }

    const instructionBreakpoints = this.getInstructionBreakpoints();
    if (instructionBreakpoints.length > 0) {
      data.instructionBreakpoints = [...instructionBreakpoints];
    }

    this.storage.setData('breakpoints', data);
  }

  private withProtectedProgrammedBreakpoints(
    uri: URI,
    breakpoints: SourceBreakpoint[]
  ): SourceBreakpoint[] {
    const requestedProgrammedBreakpointIds = new Set(
      breakpoints
        .map(programmedBreakpointId)
        .filter((id): id is number => id !== undefined)
    );
    const preserved = this.getBreakpoints(uri)
      .filter(isProgrammedSourceBreakpoint)
      .filter((breakpoint) =>
        !requestedProgrammedBreakpointIds.has(programmedBreakpointId(breakpoint)!)
      )
      .filter((breakpoint) =>
        !breakpoints.some((candidate) => candidate.id === breakpoint.id)
      )
      .map(preservedProgrammedSourceBreakpoint);
    return preserved.length > 0
      ? [...breakpoints, ...preserved]
      : breakpoints;
  }
}

function preservedProgrammedSourceBreakpoint(
  breakpoint: SourceBreakpoint
): SourceBreakpoint {
  return {
    ...breakpoint,
    raw: { ...breakpoint.raw }
  };
}

function isProgrammedSourceBreakpoint(
  breakpoint: SourceBreakpoint
): boolean {
  return programmedBreakpointId(breakpoint) !== undefined;
}

function programmedBreakpointId(
  breakpoint: SourceBreakpoint
): number | undefined {
  const id =
    (breakpoint.raw as ProgrammedBreakpointRaw)[COMMODORE_VICE_PROGRAMMED_BREAKPOINT_RAW_ID];
  return typeof id === 'number' ? id : undefined;
}

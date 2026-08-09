import { DebugSourceBreakpoint } from '@theia/debug/lib/browser/model/debug-source-breakpoint';
import type { SourceBreakpoint } from '@theia/debug/lib/browser/breakpoint/breakpoint-marker';

import { isProgrammedSourceBreakpoint } from './commodore-vice-programmed-breakpoint-state';

const PATCHED = Symbol.for(
  'commodoreCommander.debugSourceBreakpointTogglePreservesMarkers'
);

type PatchableDebugSourceBreakpoint = DebugSourceBreakpoint & {
  [PATCHED]?: true;
};

type BreakpointManagerWithProgrammedRemoval = {
  withProgrammedBreakpointRemovalAllowed?: <T>(callback: () => T) => T;
};

type DebugSourceBreakpointWithDoRemove = DebugSourceBreakpoint & {
  doRemove(origins: SourceBreakpoint[]): SourceBreakpoint[] | undefined;
};

export function installDebugSourceBreakpointTogglePatch(): void {
  const prototype = DebugSourceBreakpoint.prototype as PatchableDebugSourceBreakpoint;
  if (prototype[PATCHED]) {
    return;
  }
  prototype[PATCHED] = true;
  prototype.setEnabled = function setEnabled(enabled: boolean): void {
    const originIds = new Set(this.origins.map((origin) => origin.id));
    const breakpoints = this.breakpoints.getBreakpoints(this.uri);
    let shouldUpdate = false;
    for (const breakpoint of breakpoints) {
      if (originIds.has(breakpoint.id) && breakpoint.enabled !== enabled) {
        breakpoint.enabled = enabled;
        shouldUpdate = true;
      }
    }
    if (shouldUpdate) {
      this.breakpoints.setBreakpoints(this.uri, breakpoints);
    }
  };
  prototype.remove = function remove(): void {
    const sourceBreakpoint = this as DebugSourceBreakpointWithDoRemove;
    const breakpoints = sourceBreakpoint.doRemove(sourceBreakpoint.origins);
    if (!breakpoints) {
      return;
    }
    const breakpointManager =
      this.breakpoints as BreakpointManagerWithProgrammedRemoval;
    const removeBreakpoints = () => {
      this.breakpoints.setBreakpoints(this.uri, breakpoints);
    };
    if (
      this.origins.some(isProgrammedSourceBreakpoint) &&
      typeof breakpointManager.withProgrammedBreakpointRemovalAllowed === 'function'
    ) {
      breakpointManager.withProgrammedBreakpointRemovalAllowed(removeBreakpoints);
      return;
    }
    removeBreakpoints();
  };
}

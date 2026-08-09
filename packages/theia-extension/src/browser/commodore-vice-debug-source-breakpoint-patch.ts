import { DebugSourceBreakpoint } from '@theia/debug/lib/browser/model/debug-source-breakpoint';

const PATCHED = Symbol.for(
  'commodoreCommander.debugSourceBreakpointTogglePreservesMarkers'
);

type PatchableDebugSourceBreakpoint = DebugSourceBreakpoint & {
  [PATCHED]?: true;
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
}

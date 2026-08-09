import type { DebugSourceBreakpoint } from '@theia/debug/lib/browser/model/debug-source-breakpoint';
import type { SourceBreakpoint } from '@theia/debug/lib/browser/breakpoint/breakpoint-marker';

import { isProgrammedSourceBreakpoint } from './commodore-vice-programmed-breakpoint-state';

const PATCHED = Symbol.for(
  'commodoreCommander.debugSourceBreakpointTogglePreservesMarkers'
);

type PatchableDebugSourceBreakpoint = DebugSourceBreakpoint & {
  [PATCHED]?: true;
};

type DebugSourceBreakpointWithDoRemove = DebugSourceBreakpoint & {
  doRemove(origins: SourceBreakpoint[]): SourceBreakpoint[] | undefined;
};

export function installDebugSourceBreakpointTogglePatch(): void {
  const { DebugSourceBreakpoint } = require(
    '@theia/debug/lib/browser/model/debug-source-breakpoint'
  ) as typeof import('@theia/debug/lib/browser/model/debug-source-breakpoint');
  const prototype = DebugSourceBreakpoint.prototype as PatchableDebugSourceBreakpoint;
  if (prototype[PATCHED]) {
    return;
  }
  prototype[PATCHED] = true;
  prototype.setEnabled = setEnabledPreservingMarkerIds;
  prototype.remove = removeIgnoringProgrammedBreakpoints;
}

export function setEnabledPreservingMarkerIds(
  this: DebugSourceBreakpoint,
  enabled: boolean
): void {
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
}

export function removeIgnoringProgrammedBreakpoints(
  this: DebugSourceBreakpoint
): void {
  if (this.origins.some(isProgrammedSourceBreakpoint)) {
    return;
  }
  const sourceBreakpoint = this as DebugSourceBreakpointWithDoRemove;
  const breakpoints = sourceBreakpoint.doRemove(sourceBreakpoint.origins);
  if (!breakpoints) {
    return;
  }
  this.breakpoints.setBreakpoints(this.uri, breakpoints);
}

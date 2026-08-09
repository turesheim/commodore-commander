import URI from '@theia/core/lib/common/uri';
import { injectable } from '@theia/core/shared/inversify';
import { BreakpointManager } from '@theia/debug/lib/browser/breakpoint/breakpoint-manager';
import type { SourceBreakpoint } from '@theia/debug/lib/browser/breakpoint/breakpoint-marker';

import { isProgrammedSourceBreakpoint } from './commodore-vice-programmed-breakpoint-state';

@injectable()
export class CommodoreViceBreakpointManager extends BreakpointManager {
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
}

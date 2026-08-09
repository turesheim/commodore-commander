import type { DebugProtocol } from '@vscode/debugprotocol';

export const COMMODORE_VICE_PROGRAMMED_BREAKPOINTS_EVENT =
  'commodoreViceProgrammedBreakpoints';
export const COMMODORE_VICE_LIST_PROGRAMMED_BREAKPOINTS_REQUEST =
  'commodore-vice/listProgrammedBreakpoints';
export const COMMODORE_VICE_SET_PROGRAMMED_BREAKPOINT_ENABLED_REQUEST =
  'commodore-vice/setProgrammedBreakpointEnabled';

export interface CommodoreViceProgrammedBreakpoint {
  id: number;
  address: string;
  enabled: boolean;
  installed: boolean;
  canRemove: false;
  source?: DebugProtocol.Source;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  checkpointNumber?: number;
}

export interface CommodoreViceProgrammedBreakpointsEvent {
  breakpoints: CommodoreViceProgrammedBreakpoint[];
}

export interface CommodoreViceListProgrammedBreakpointsResponse {
  breakpoints: CommodoreViceProgrammedBreakpoint[];
}

export interface CommodoreViceSetProgrammedBreakpointEnabledResponse {
  breakpoint: CommodoreViceProgrammedBreakpoint;
}

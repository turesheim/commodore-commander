import type { DebugProtocol } from '@vscode/debugprotocol';
import { DisposableCollection } from '@theia/core/lib/common';
import { FileUri } from '@theia/core/lib/common/file-uri';
import URI from '@theia/core/lib/common/uri';
import { inject, injectable } from '@theia/core/shared/inversify';
import type { DebugContribution } from '@theia/debug/lib/browser/debug-contribution';
import { DebugSessionConnection } from '@theia/debug/lib/browser/debug-session-connection';
import {
  BreakpointManager,
  type SourceBreakpointsChangeEvent
} from '@theia/debug/lib/browser/breakpoint/breakpoint-manager';
import {
  SourceBreakpoint
} from '@theia/debug/lib/browser/breakpoint/breakpoint-marker';

import { COMMODORE_VICE_DEBUG_TYPE } from '../common/commodore-vice-debug';
import {
  COMMODORE_VICE_PROGRAMMED_BREAKPOINT_RAW_ADDRESS,
  COMMODORE_VICE_PROGRAMMED_BREAKPOINT_RAW_ID,
  COMMODORE_VICE_PROGRAMMED_BREAKPOINTS_EVENT,
  type CommodoreViceProgrammedBreakpoint,
  type CommodoreViceProgrammedBreakpointsEvent
} from '../common/commodore-vice-programmed-breakpoints';
import { CommodoreViceBreakpointManager } from './commodore-vice-breakpoint-manager';

const SYNC_SOURCE_BREAKPOINTS_REQUEST = 'commodore-vice/syncSourceBreakpoints';

interface ProgrammedBreakpointSessionState {
  readonly programmedBreakpointsById: Map<number, CommodoreViceProgrammedBreakpoint>;
  updatingProgrammedMarkers: boolean;
}

type ProgrammedBreakpointRaw = DebugProtocol.SourceBreakpoint & {
  [COMMODORE_VICE_PROGRAMMED_BREAKPOINT_RAW_ID]?: number;
  [COMMODORE_VICE_PROGRAMMED_BREAKPOINT_RAW_ADDRESS]?: string;
};

@injectable()
export class CommodoreViceBreakpointStateContribution implements DebugContribution {
  @inject(BreakpointManager)
  protected readonly breakpointManager!: BreakpointManager;

  register(configType: string, connection: DebugSessionConnection): void {
    if (configType !== COMMODORE_VICE_DEBUG_TYPE) {
      return;
    }

    const toDispose = new DisposableCollection();
    const state: ProgrammedBreakpointSessionState = {
      programmedBreakpointsById: new Map(),
      updatingProgrammedMarkers: false
    };
    toDispose.push(
      this.breakpointManager.onDidChangeBreakpoints((event) => {
        if (state.updatingProgrammedMarkers) {
          return;
        }
        void this.handleBreakpointChange(connection, state, event);
      })
    );
    toDispose.push(
      connection.onDidCustomEvent((event) => {
        this.handleDebugSessionCustomEvent(state, event);
      })
    );
    toDispose.push(
      connection.onDidClose(() => {
        this.removeProgrammedBreakpointMarkers(state);
        toDispose.dispose();
      })
    );
    void this.syncAllSourceBreakpoints(connection);
  }

  protected async handleBreakpointChange(
    connection: DebugSessionConnection,
    state: ProgrammedBreakpointSessionState,
    event: SourceBreakpointsChangeEvent
  ): Promise<void> {
    if (event.removed.some(isProgrammedSourceBreakpoint)) {
      this.restoreRemovedProgrammedBreakpoints(state, event.uri, event.removed);
    }
    await this.syncSourceBreakpoints(connection, event.uri);
  }

  protected handleDebugSessionCustomEvent(
    state: ProgrammedBreakpointSessionState,
    event: DebugProtocol.Event
  ): void {
    if (event.event !== COMMODORE_VICE_PROGRAMMED_BREAKPOINTS_EVENT) {
      return;
    }
    const body = asProgrammedBreakpointsEvent(event.body);
    if (!body) {
      return;
    }
    state.programmedBreakpointsById.clear();
    for (const breakpoint of body.breakpoints) {
      state.programmedBreakpointsById.set(breakpoint.id, breakpoint);
    }
    this.applyProgrammedBreakpointMarkers(state, body.breakpoints);
  }

  protected applyProgrammedBreakpointMarkers(
    state: ProgrammedBreakpointSessionState,
    breakpoints: readonly CommodoreViceProgrammedBreakpoint[]
  ): void {
    const breakpointsByUri = groupProgrammedBreakpointsByUri(breakpoints);
    const uriStrings = new Set<string>([
      ...breakpointsByUri.keys(),
      ...this.programmedBreakpointMarkerUris()
    ]);
    state.updatingProgrammedMarkers = true;
    try {
      for (const uriString of uriStrings) {
        const uri = new URI(uriString);
        const sourceBreakpoints = this.breakpointManager.getBreakpoints(uri);
        const programmedBreakpoints = breakpointsByUri.get(uriString) ?? [];
        const programmedLines = new Set(
          programmedBreakpoints.map((breakpoint) => breakpoint.line)
        );
        const nextBreakpoints = sourceBreakpoints.filter((breakpoint) =>
          !isProgrammedSourceBreakpoint(breakpoint) &&
          !programmedLines.has(breakpoint.raw.line)
        );
        for (const breakpoint of programmedBreakpoints) {
          const existing = sourceBreakpoints.find((candidate) =>
            candidate.raw.line === breakpoint.line
          );
          nextBreakpoints.push(
            createProgrammedSourceBreakpoint(uri, breakpoint, existing)
          );
        }
        this.withProgrammedBreakpointRemovalAllowed(() => {
          this.breakpointManager.setBreakpoints(uri, nextBreakpoints);
        });
      }
    } finally {
      state.updatingProgrammedMarkers = false;
    }
  }

  protected restoreRemovedProgrammedBreakpoints(
    state: ProgrammedBreakpointSessionState,
    uri: URI,
    removed: readonly SourceBreakpoint[]
  ): void {
    const restored = removed
      .filter(isProgrammedSourceBreakpoint)
      .map((breakpoint) =>
        disabledProgrammedSourceBreakpoint(
          uri,
          breakpoint,
          state.programmedBreakpointsById.get(programmedBreakpointId(breakpoint)!)
        )
      );
    if (restored.length === 0) {
      return;
    }

    state.updatingProgrammedMarkers = true;
    try {
      const existing = this.breakpointManager.getBreakpoints(uri);
      const restoredLines = new Set(restored.map((breakpoint) => breakpoint.raw.line));
      this.breakpointManager.setBreakpoints(uri, [
        ...existing.filter((breakpoint) =>
          !restoredLines.has(breakpoint.raw.line)
        ),
        ...restored
      ]);
    } finally {
      state.updatingProgrammedMarkers = false;
    }
  }

  protected removeProgrammedBreakpointMarkers(
    state: ProgrammedBreakpointSessionState
  ): void {
    const uriStrings = this.programmedBreakpointMarkerUris();
    state.updatingProgrammedMarkers = true;
    try {
      for (const uriString of uriStrings) {
        const uri = new URI(uriString);
        this.withProgrammedBreakpointRemovalAllowed(() => {
          this.breakpointManager.setBreakpoints(
            uri,
            this.breakpointManager
              .getBreakpoints(uri)
              .filter((breakpoint) => !isProgrammedSourceBreakpoint(breakpoint))
          );
        });
      }
    } finally {
      state.updatingProgrammedMarkers = false;
      state.programmedBreakpointsById.clear();
    }
  }

  protected programmedBreakpointMarkerUris(): string[] {
    const uris = new Set<string>();
    for (const breakpoint of this.breakpointManager.getBreakpoints()) {
      if (isProgrammedSourceBreakpoint(breakpoint)) {
        uris.add(breakpoint.uri);
      }
    }
    return [...uris];
  }

  protected async syncAllSourceBreakpoints(
    connection: DebugSessionConnection
  ): Promise<void> {
    const uris = new Set(
      this.breakpointManager.getBreakpoints().map((breakpoint) => breakpoint.uri)
    );
    for (const uri of uris) {
      await this.syncSourceBreakpoints(connection, new URI(uri));
    }
  }

  protected async syncSourceBreakpoints(
    connection: DebugSessionConnection,
    uri: URI
  ): Promise<void> {
    try {
      await connection.sendCustomRequest<DebugProtocol.Response>(
        SYNC_SOURCE_BREAKPOINTS_REQUEST,
        {
          source: debugSourceForUri(uri),
          breakpoints: this.breakpointManager
            .getBreakpoints(uri)
            .map((breakpoint) => toSourceBreakpointState(breakpoint)),
          sourceModified: false
        }
      );
    } catch (error) {
      console.warn('Could not sync Commodore VICE breakpoint state:', error);
    }
  }

  private withProgrammedBreakpointRemovalAllowed(callback: () => void): void {
    const breakpointManager = this.breakpointManager;
    if (breakpointManager instanceof CommodoreViceBreakpointManager) {
      breakpointManager.withProgrammedBreakpointRemovalAllowed(callback);
      return;
    }
    callback();
  }
}

function toSourceBreakpointState(
  breakpoint: SourceBreakpoint
): DebugProtocol.SourceBreakpoint & { enabled: boolean; markerId: string } {
  return {
    ...breakpoint.raw,
    enabled: breakpoint.enabled,
    markerId: breakpoint.id
  };
}

function debugSourceForUri(uri: URI): DebugProtocol.Source {
  return {
    name: uri.displayName,
    path: uri.scheme === 'file' ? uri.path.fsPath() : uri.toString()
  };
}

function groupProgrammedBreakpointsByUri(
  breakpoints: readonly CommodoreViceProgrammedBreakpoint[]
): Map<string, CommodoreViceProgrammedBreakpoint[]> {
  const result = new Map<string, CommodoreViceProgrammedBreakpoint[]>();
  for (const breakpoint of breakpoints) {
    if (!breakpoint.source?.path || breakpoint.line === undefined) {
      continue;
    }
    const uri = FileUri.create(breakpoint.source.path).toString();
    const sourceBreakpoints = result.get(uri) ?? [];
    sourceBreakpoints.push(breakpoint);
    result.set(uri, sourceBreakpoints);
  }
  return result;
}

function createProgrammedSourceBreakpoint(
  uri: URI,
  breakpoint: CommodoreViceProgrammedBreakpoint,
  existing: SourceBreakpoint | undefined
): SourceBreakpoint {
  const raw: ProgrammedBreakpointRaw = {
    line: breakpoint.line!,
    [COMMODORE_VICE_PROGRAMMED_BREAKPOINT_RAW_ID]: breakpoint.id,
    [COMMODORE_VICE_PROGRAMMED_BREAKPOINT_RAW_ADDRESS]: breakpoint.address
  };
  const created = SourceBreakpoint.create(uri, raw);
  return {
    ...created,
    ...(existing ? { id: existing.id } : {}),
    enabled: breakpoint.enabled,
    raw
  };
}

function disabledProgrammedSourceBreakpoint(
  uri: URI,
  removed: SourceBreakpoint,
  descriptor: CommodoreViceProgrammedBreakpoint | undefined
): SourceBreakpoint {
  const raw = removed.raw as ProgrammedBreakpointRaw;
  const restoredRaw: ProgrammedBreakpointRaw = {
    line: descriptor?.line ?? raw.line,
    [COMMODORE_VICE_PROGRAMMED_BREAKPOINT_RAW_ID]:
      descriptor?.id ?? raw[COMMODORE_VICE_PROGRAMMED_BREAKPOINT_RAW_ID],
    [COMMODORE_VICE_PROGRAMMED_BREAKPOINT_RAW_ADDRESS]:
      descriptor?.address ?? raw[COMMODORE_VICE_PROGRAMMED_BREAKPOINT_RAW_ADDRESS]
  };
  return {
    ...SourceBreakpoint.create(uri, restoredRaw, removed),
    enabled: false,
    raw: restoredRaw
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

function asProgrammedBreakpointsEvent(
  body: unknown
): CommodoreViceProgrammedBreakpointsEvent | undefined {
  if (!body || typeof body !== 'object') {
    return undefined;
  }
  const candidate = body as Partial<CommodoreViceProgrammedBreakpointsEvent>;
  if (!Array.isArray(candidate.breakpoints)) {
    return undefined;
  }
  return {
    breakpoints: candidate.breakpoints.filter(isProgrammedBreakpoint)
  };
}

function isProgrammedBreakpoint(
  value: unknown
): value is CommodoreViceProgrammedBreakpoint {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<CommodoreViceProgrammedBreakpoint>;
  return typeof candidate.id === 'number' &&
    typeof candidate.address === 'string' &&
    typeof candidate.enabled === 'boolean' &&
    typeof candidate.installed === 'boolean' &&
    candidate.canRemove === false;
}

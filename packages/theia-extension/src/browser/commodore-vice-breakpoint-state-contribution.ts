import type { DebugProtocol } from '@vscode/debugprotocol';
import { DisposableCollection } from '@theia/core/lib/common';
import URI from '@theia/core/lib/common/uri';
import { inject, injectable } from '@theia/core/shared/inversify';
import type { DebugContribution } from '@theia/debug/lib/browser/debug-contribution';
import { DebugSessionConnection } from '@theia/debug/lib/browser/debug-session-connection';
import { BreakpointManager } from '@theia/debug/lib/browser/breakpoint/breakpoint-manager';
import type { SourceBreakpoint } from '@theia/debug/lib/browser/breakpoint/breakpoint-marker';

import { COMMODORE_VICE_DEBUG_TYPE } from '../common/commodore-vice-debug';

const SYNC_SOURCE_BREAKPOINTS_REQUEST = 'commodore-vice/syncSourceBreakpoints';

@injectable()
export class CommodoreViceBreakpointStateContribution implements DebugContribution {
  @inject(BreakpointManager)
  protected readonly breakpointManager!: BreakpointManager;

  register(configType: string, connection: DebugSessionConnection): void {
    if (configType !== COMMODORE_VICE_DEBUG_TYPE) {
      return;
    }

    const toDispose = new DisposableCollection();
    toDispose.push(
      this.breakpointManager.onDidChangeBreakpoints((event) => {
        void this.syncSourceBreakpoints(connection, event.uri);
      })
    );
    toDispose.push(connection.onDidClose(() => toDispose.dispose()));
    void this.syncAllSourceBreakpoints(connection);
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

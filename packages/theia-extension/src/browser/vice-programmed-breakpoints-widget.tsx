import * as React from 'react';

import { codicon, ReactWidget } from '@theia/core/lib/browser';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { MessageService } from '@theia/core/lib/common/message-service';
import { DisposableCollection } from '@theia/core/lib/common';
import {
  DebugSession,
  DebugState
} from '@theia/debug/lib/browser/debug-session';
import {
  DebugSessionManager
} from '@theia/debug/lib/browser/debug-session-manager';
import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';

import { COMMODORE_VICE_DEBUG_TYPE } from '../common/commodore-vice-debug';
import {
  COMMODORE_VICE_LIST_PROGRAMMED_BREAKPOINTS_REQUEST,
  COMMODORE_VICE_SET_PROGRAMMED_BREAKPOINT_ENABLED_REQUEST,
  type CommodoreViceListProgrammedBreakpointsResponse,
  type CommodoreViceProgrammedBreakpoint,
  type CommodoreViceSetProgrammedBreakpointEnabledResponse
} from '../common/commodore-vice-programmed-breakpoints';

export const VICE_PROGRAMMED_BREAKPOINTS_WIDGET_ID =
  'commodore-commander.vice-programmed-breakpoints';

@injectable()
export class ViceProgrammedBreakpointsWidget extends ReactWidget {
  @inject(DebugSessionManager)
  protected readonly debugSessionManager!: DebugSessionManager;

  @inject(MessageService)
  protected readonly messageService!: MessageService;

  protected readonly toDispose = new DisposableCollection();
  protected breakpoints: CommodoreViceProgrammedBreakpoint[] = [];
  protected readonly busyBreakpointIds = new Set<number>();
  protected loading = false;
  protected error: string | undefined;

  @postConstruct()
  protected init(): void {
    this.id = VICE_PROGRAMMED_BREAKPOINTS_WIDGET_ID;
    this.title.label = 'Programmed Breakpoints';
    this.title.caption = 'VICE Programmed Breakpoints';
    this.title.iconClass = codicon('debug-breakpoint-log');
    this.title.closable = true;
    this.addClass('cc-vice-programmed-breakpoints-widget');

    this.toDispose.pushAll([
      this.debugSessionManager.onDidChangeActiveDebugSession(() =>
        this.handleDebugSessionChanged()
      ),
      this.debugSessionManager.onDidChange(() =>
        this.handleDebugSessionChanged()
      ),
      this.debugSessionManager.onDidDestroyDebugSession((session) =>
        this.handleDebugSessionDestroyed(session)
      )
    ]);
    void this.refresh();
  }

  override dispose(): void {
    this.toDispose.dispose();
    super.dispose();
  }

  setBreakpoints(
    breakpoints: readonly CommodoreViceProgrammedBreakpoint[]
  ): void {
    this.breakpoints = [...breakpoints].sort(compareProgrammedBreakpoints);
    this.loading = false;
    this.error = undefined;
    this.update();
  }

  async refresh(): Promise<void> {
    const session = this.currentViceSession();
    if (!session) {
      this.breakpoints = [];
      this.loading = false;
      this.error = undefined;
      this.update();
      return;
    }

    this.loading = true;
    this.error = undefined;
    this.update();
    try {
      const response = await session.sendCustomRequest(
        COMMODORE_VICE_LIST_PROGRAMMED_BREAKPOINTS_REQUEST,
        {}
      );
      const body =
        response.body as CommodoreViceListProgrammedBreakpointsResponse | undefined;
      this.setBreakpoints(body?.breakpoints ?? []);
    } catch (error) {
      this.error = errorMessage(error);
    } finally {
      this.loading = false;
      this.update();
    }
  }

  protected handleDebugSessionChanged(): void {
    const session = this.currentViceSession();
    if (!session) {
      this.breakpoints = [];
      this.error = undefined;
      this.loading = false;
      this.update();
      return;
    }
    if (session.state !== DebugState.Inactive) {
      void this.refresh();
    }
  }

  protected handleDebugSessionDestroyed(session: DebugSession): void {
    if (session.configuration.type !== COMMODORE_VICE_DEBUG_TYPE) {
      return;
    }
    this.breakpoints = [];
    this.error = undefined;
    this.loading = false;
    this.update();
  }

  protected override onActivateRequest(msg: Message): void {
    super.onActivateRequest(msg);
    this.node.focus();
  }

  protected currentViceSession(): DebugSession | undefined {
    const session = this.debugSessionManager.currentSession;
    return session?.configuration.type === COMMODORE_VICE_DEBUG_TYPE
      ? session
      : undefined;
  }

  protected async toggleBreakpoint(
    breakpoint: CommodoreViceProgrammedBreakpoint
  ): Promise<void> {
    const session = this.currentViceSession();
    if (!session || !breakpoint.installed) {
      return;
    }

    this.busyBreakpointIds.add(breakpoint.id);
    this.update();
    try {
      const response = await session.sendCustomRequest(
        COMMODORE_VICE_SET_PROGRAMMED_BREAKPOINT_ENABLED_REQUEST,
        {
          id: breakpoint.id,
          enabled: !breakpoint.enabled
        }
      );
      const body =
        response.body as CommodoreViceSetProgrammedBreakpointEnabledResponse | undefined;
      if (body?.breakpoint) {
        this.setBreakpoints(upsertBreakpoint(this.breakpoints, body.breakpoint));
      } else {
        await this.refresh();
      }
    } catch (error) {
      this.messageService.error(
        `Unable to toggle programmed breakpoint: ${errorMessage(error)}`
      );
    } finally {
      this.busyBreakpointIds.delete(breakpoint.id);
      this.update();
    }
  }

  protected render(): React.ReactNode {
    return (
      <div className='cc-vice-programmed-breakpoints'>
        <div className='cc-vice-programmed-breakpoints__toolbar'>
          <span className='cc-vice-programmed-breakpoints__title'>
            Programmed breakpoints
          </span>
          <span className='cc-vice-programmed-breakpoints__count'>
            {this.loading ? '...' : this.breakpoints.length}
          </span>
          <button
            className='theia-button secondary cc-vice-programmed-breakpoints__refresh'
            disabled={this.loading}
            onClick={() => void this.refresh()}
            title='Refresh programmed breakpoints'
            type='button'
          >
            <span className={codicon('refresh')} aria-hidden='true' />
            <span>Refresh</span>
          </button>
        </div>
        <div className='cc-vice-programmed-breakpoints__body'>
          {this.error && (
            <div className='cc-vice-programmed-breakpoints__error'>
              {this.error}
            </div>
          )}
          {this.breakpoints.length > 0 ? this.renderTable() : (
            <div className='cc-vice-programmed-breakpoints__empty'>
              No programmed breakpoints
            </div>
          )}
        </div>
      </div>
    );
  }

  protected renderTable(): React.ReactNode {
    return (
      <table className='cc-vice-programmed-breakpoints__table'>
        <thead>
          <tr>
            <th>On</th>
            <th>Location</th>
            <th>Address</th>
            <th>Checkpoint</th>
            <th>Remove</th>
          </tr>
        </thead>
        <tbody>
          {this.breakpoints.map((breakpoint) =>
            this.renderBreakpointRow(breakpoint)
          )}
        </tbody>
      </table>
    );
  }

  protected renderBreakpointRow(
    breakpoint: CommodoreViceProgrammedBreakpoint
  ): React.ReactNode {
    const busy = this.busyBreakpointIds.has(breakpoint.id);
    const toggleTitle = breakpoint.enabled
      ? 'Disable programmed breakpoint'
      : 'Enable programmed breakpoint';
    const location = formatBreakpointLocation(breakpoint);
    return (
      <tr key={breakpoint.id}>
        <td>
          <input
            aria-label={toggleTitle}
            checked={breakpoint.enabled}
            disabled={busy || !breakpoint.installed}
            onChange={() => void this.toggleBreakpoint(breakpoint)}
            title={toggleTitle}
            type='checkbox'
          />
        </td>
        <td
          className='cc-vice-programmed-breakpoints__location'
          title={formatBreakpointPath(breakpoint)}
        >
          {location}
        </td>
        <td className='cc-vice-programmed-breakpoints__address'>
          {breakpoint.address}
        </td>
        <td className='cc-vice-programmed-breakpoints__checkpoint'>
          {breakpoint.checkpointNumber ?? (breakpoint.installed ? '-' : 'Pending')}
        </td>
        <td>
          <button
            aria-label='Remove programmed breakpoint unavailable'
            className='theia-button secondary cc-vice-programmed-breakpoints__remove'
            disabled={true}
            title='Remove the .break directive from source to delete this breakpoint'
            type='button'
          >
            <span className={codicon('trash')} aria-hidden='true' />
          </button>
        </td>
      </tr>
    );
  }
}

function upsertBreakpoint(
  breakpoints: readonly CommodoreViceProgrammedBreakpoint[],
  breakpoint: CommodoreViceProgrammedBreakpoint
): CommodoreViceProgrammedBreakpoint[] {
  const next = breakpoints.filter((candidate) => candidate.id !== breakpoint.id);
  next.push(breakpoint);
  return next.sort(compareProgrammedBreakpoints);
}

function compareProgrammedBreakpoints(
  left: CommodoreViceProgrammedBreakpoint,
  right: CommodoreViceProgrammedBreakpoint
): number {
  const leftLine = left.line ?? Number.MAX_SAFE_INTEGER;
  const rightLine = right.line ?? Number.MAX_SAFE_INTEGER;
  if (leftLine !== rightLine) {
    return leftLine - rightLine;
  }
  return left.address.localeCompare(right.address);
}

function formatBreakpointLocation(
  breakpoint: CommodoreViceProgrammedBreakpoint
): string {
  if (!breakpoint.source?.path || breakpoint.line === undefined) {
    return breakpoint.address;
  }
  return `${shortFileName(breakpoint.source.path)}:${breakpoint.line}`;
}

function formatBreakpointPath(
  breakpoint: CommodoreViceProgrammedBreakpoint
): string {
  if (!breakpoint.source?.path || breakpoint.line === undefined) {
    return breakpoint.address;
  }
  return `${breakpoint.source.path}:${breakpoint.line}`;
}

function shortFileName(filePath: string): string {
  return filePath.split(/[\\/]/u).pop() || filePath;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

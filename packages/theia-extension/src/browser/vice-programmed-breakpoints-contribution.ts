import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { AbstractViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { DisposableCollection } from '@theia/core/lib/common';
import {
  DebugSessionManager,
  type DebugSessionCustomEvent
} from '@theia/debug/lib/browser/debug-session-manager';
import { inject, injectable } from '@theia/core/shared/inversify';

import { COMMODORE_VICE_DEBUG_TYPE } from '../common/commodore-vice-debug';
import {
  COMMODORE_VICE_PROGRAMMED_BREAKPOINTS_EVENT,
  type CommodoreViceProgrammedBreakpoint,
  type CommodoreViceProgrammedBreakpointsEvent
} from '../common/commodore-vice-programmed-breakpoints';
import {
  VICE_PROGRAMMED_BREAKPOINTS_WIDGET_ID,
  ViceProgrammedBreakpointsWidget
} from './vice-programmed-breakpoints-widget';

@injectable()
export class ViceProgrammedBreakpointsContribution
  extends AbstractViewContribution<ViceProgrammedBreakpointsWidget>
  implements FrontendApplicationContribution
{
  @inject(DebugSessionManager)
  protected readonly debugSessionManager!: DebugSessionManager;

  protected readonly toDispose = new DisposableCollection();

  constructor() {
    super({
      widgetId: VICE_PROGRAMMED_BREAKPOINTS_WIDGET_ID,
      widgetName: 'Programmed Breakpoints',
      defaultWidgetOptions: {
        area: 'bottom',
        rank: 226
      },
      toggleCommandId: 'commodoreCommander.viceProgrammedBreakpoints.toggle'
    });
  }

  async onStart(): Promise<void> {
    this.toDispose.pushAll([
      this.debugSessionManager.onDidReceiveDebugSessionCustomEvent((event) => {
        void this.handleDebugSessionCustomEvent(event);
      }),
      this.debugSessionManager.onDidChangeActiveDebugSession(() => {
        void this.refreshOpenWidget();
      }),
      this.debugSessionManager.onDidChange(() => {
        void this.refreshOpenWidget();
      })
    ]);
  }

  onStop(): void {
    this.toDispose.dispose();
  }

  protected async handleDebugSessionCustomEvent(
    event: DebugSessionCustomEvent
  ): Promise<void> {
    if (
      event.event !== COMMODORE_VICE_PROGRAMMED_BREAKPOINTS_EVENT ||
      event.session.configuration.type !== COMMODORE_VICE_DEBUG_TYPE
    ) {
      return;
    }
    const body = asProgrammedBreakpointsEvent(event.body);
    if (!body) {
      return;
    }
    const widget = this.tryGetWidget() ??
      (body.breakpoints.length > 0
        ? await this.openView({ reveal: false })
        : undefined);
    widget?.setBreakpoints(body.breakpoints);
  }

  protected async refreshOpenWidget(): Promise<void> {
    const widget = this.tryGetWidget();
    if (widget) {
      await widget.refresh();
    }
  }
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

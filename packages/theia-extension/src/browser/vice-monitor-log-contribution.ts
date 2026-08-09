import {
  FrontendApplication,
  FrontendApplicationContribution
} from '@theia/core/lib/browser';
import { AbstractViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { DisposableCollection } from '@theia/core/lib/common';
import {
  DebugSessionManager,
  type DebugSessionCustomEvent
} from '@theia/debug/lib/browser/debug-session-manager';
import { inject, injectable } from '@theia/core/shared/inversify';

import { COMMODORE_VICE_DEBUG_TYPE } from '../common/commodore-vice-debug';
import {
  COMMODORE_VICE_MONITOR_LOG_EVENT,
  type CommodoreViceMonitorLogEvent
} from '../common/commodore-vice-monitor-log';
import {
  VICE_MONITOR_LOG_WIDGET_ID,
  ViceMonitorLogWidget
} from './vice-monitor-log-widget';

@injectable()
export class ViceMonitorLogContribution
  extends AbstractViewContribution<ViceMonitorLogWidget>
  implements FrontendApplicationContribution
{
  @inject(DebugSessionManager)
  protected readonly debugSessionManager!: DebugSessionManager;

  protected readonly toDispose = new DisposableCollection();

  constructor() {
    super({
      widgetId: VICE_MONITOR_LOG_WIDGET_ID,
      widgetName: 'VICE Monitor',
      defaultWidgetOptions: {
        area: 'bottom',
        rank: 225
      },
      toggleCommandId: 'commodoreCommander.viceMonitor.toggleProtocolLog'
    });
  }

  async onStart(): Promise<void> {
    this.toDispose.push(
      this.debugSessionManager.onDidReceiveDebugSessionCustomEvent((event) => {
        void this.handleDebugSessionCustomEvent(event);
      })
    );
  }

  onStop(): void {
    this.toDispose.dispose();
  }

  async onDidInitializeLayout(_app: FrontendApplication): Promise<void> {
    await this.openView();
  }

  protected async handleDebugSessionCustomEvent(
    event: DebugSessionCustomEvent
  ): Promise<void> {
    if (
      event.event !== COMMODORE_VICE_MONITOR_LOG_EVENT ||
      event.session.configuration.type !== COMMODORE_VICE_DEBUG_TYPE
    ) {
      return;
    }
    const logEvent = asViceMonitorLogEvent(event.body);
    if (!logEvent) {
      return;
    }
    const widget = this.tryGetWidget() ?? await this.openView({ reveal: false });
    widget.appendEntry(logEvent);
  }
}

function asViceMonitorLogEvent(
  body: unknown
): CommodoreViceMonitorLogEvent | undefined {
  if (!body || typeof body !== 'object') {
    return undefined;
  }
  const candidate = body as Partial<CommodoreViceMonitorLogEvent>;
  if (
    candidate.category !== 'user' &&
    candidate.category !== 'input' &&
    candidate.category !== 'output'
  ) {
    return undefined;
  }
  if (typeof candidate.message !== 'string') {
    return undefined;
  }
  return candidate as CommodoreViceMonitorLogEvent;
}

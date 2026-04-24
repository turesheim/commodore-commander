import {
  FrontendApplication,
  FrontendApplicationContribution
} from '@theia/core/lib/browser';
import { AbstractViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { injectable } from '@theia/core/shared/inversify';

import {
  SID_SCORE_PROTOCOL_LOG_WIDGET_ID,
  SidScoreProtocolLogWidget
} from './sidscore-protocol-log-widget';

@injectable()
export class SidScoreProtocolLogContribution
  extends AbstractViewContribution<SidScoreProtocolLogWidget>
  implements FrontendApplicationContribution
{
  constructor() {
    super({
      widgetId: SID_SCORE_PROTOCOL_LOG_WIDGET_ID,
      widgetName: 'SIDScore Protocol',
      defaultWidgetOptions: {
        area: 'bottom',
        rank: 220
      },
      toggleCommandId: 'commodoreCommander.sidscore.toggleProtocolLog'
    });
  }

  async onDidInitializeLayout(_app: FrontendApplication): Promise<void> {
    await this.openView({ reveal: true });
  }
}

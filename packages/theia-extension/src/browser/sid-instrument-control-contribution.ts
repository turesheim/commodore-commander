import {
  FrontendApplication,
  FrontendApplicationContribution
} from '@theia/core/lib/browser';
import { AbstractViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { injectable } from '@theia/core/shared/inversify';

import {
  SID_INSTRUMENT_CONTROL_WIDGET_ID,
  SidInstrumentControlWidget
} from './sid-instrument-control-widget';

@injectable()
export class SidInstrumentControlContribution
  extends AbstractViewContribution<SidInstrumentControlWidget>
  implements FrontendApplicationContribution
{
  constructor() {
    super({
      widgetId: SID_INSTRUMENT_CONTROL_WIDGET_ID,
      widgetName: 'SID Instrument',
      defaultWidgetOptions: {
        area: 'right',
        rank: 120
      },
      toggleCommandId: 'commodoreCommander.sidscore.toggleInstrumentControls'
    });
  }

  async onDidInitializeLayout(_app: FrontendApplication): Promise<void> {
    await this.openView();
  }
}

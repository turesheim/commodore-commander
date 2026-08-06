import {
  FrontendApplication,
  FrontendApplicationContribution
} from '@theia/core/lib/browser';
import { AbstractViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { injectable } from '@theia/core/shared/inversify';

import {
  SID_SFX_EDITOR_WIDGET_ID,
  SidSfxEditorWidget
} from './sid-sfx-editor-widget';

@injectable()
export class SidSfxEditorContribution
  extends AbstractViewContribution<SidSfxEditorWidget>
  implements FrontendApplicationContribution
{
  constructor() {
    super({
      widgetId: SID_SFX_EDITOR_WIDGET_ID,
      widgetName: 'SID SFX',
      defaultWidgetOptions: {
        area: 'right',
        rank: 132
      },
      toggleCommandId: 'commodoreCommander.sidscore.toggleSfxEditor'
    });
  }

  async onDidInitializeLayout(_app: FrontendApplication): Promise<void> {
    await this.openView({ activate: false });
  }
}

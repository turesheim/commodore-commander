import { AbstractViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { injectable } from '@theia/core/shared/inversify';

import {
  SID_SFX_EDITOR_WIDGET_ID,
  SidSfxEditorWidget
} from './sid-sfx-editor-widget';

@injectable()
export class SidSfxEditorContribution
  extends AbstractViewContribution<SidSfxEditorWidget>
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
}

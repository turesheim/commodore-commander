import { AbstractViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { injectable } from '@theia/core/shared/inversify';

import {
  VICE_MEMORY_WIDGET_ID,
  ViceMemoryWidget
} from './vice-memory-widget';

@injectable()
export class ViceMemoryContribution
  extends AbstractViewContribution<ViceMemoryWidget>
{
  constructor() {
    super({
      widgetId: VICE_MEMORY_WIDGET_ID,
      widgetName: 'Memory',
      defaultWidgetOptions: {
        area: 'bottom',
        rank: 230
      },
      toggleCommandId: 'commodoreCommander.viceMemory.toggle'
    });
  }
}

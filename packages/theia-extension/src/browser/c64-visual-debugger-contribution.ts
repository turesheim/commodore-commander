import { AbstractViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { injectable } from '@theia/core/shared/inversify';

import {
  C64_VISUAL_DEBUGGER_WIDGET_ID,
  C64VisualDebuggerWidget
} from './c64-visual-debugger-widget';

@injectable()
export class C64VisualDebuggerContribution
  extends AbstractViewContribution<C64VisualDebuggerWidget>
{
  constructor() {
    super({
      widgetId: C64_VISUAL_DEBUGGER_WIDGET_ID,
      widgetName: 'C64 Visual Debugger',
      defaultWidgetOptions: {
        area: 'right',
        rank: 240
      },
      toggleCommandId: 'commodoreCommander.c64VisualDebugger.toggle'
    });
  }
}

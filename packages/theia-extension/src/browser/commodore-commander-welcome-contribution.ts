import {
  ApplicationShell,
  WidgetManager
} from '@theia/core/lib/browser';
import {
  CommandContribution,
  CommandRegistry
} from '@theia/core/lib/common';
import { inject, injectable } from '@theia/core/shared/inversify';
import { GettingStartedCommand } from '@theia/getting-started/lib/browser/getting-started-contribution';
import { GettingStartedWidget } from '@theia/getting-started/lib/browser/getting-started-widget';

import { CommodoreCommanderGettingStartedWidget } from './commodore-commander-getting-started-widget';

@injectable()
export class CommodoreCommanderWelcomeContribution implements CommandContribution {
  @inject(ApplicationShell)
  protected readonly shell!: ApplicationShell;

  @inject(WidgetManager)
  protected readonly widgetManager!: WidgetManager;

  registerCommands(registry: CommandRegistry): void {
    registry.registerHandler(GettingStartedCommand.id, {
      execute: () => this.openWelcome(),
      isEnabled: () => true,
      isVisible: () => true
    });
  }

  protected async openWelcome(): Promise<CommodoreCommanderGettingStartedWidget> {
    const widget = await this.widgetManager.getOrCreateWidget<CommodoreCommanderGettingStartedWidget>(
      GettingStartedWidget.ID
    );

    if (!this.shell.getTabBarFor(widget)) {
      await this.shell.addWidget(widget, { area: 'main' });
    }

    await this.shell.activateWidget(widget.id);
    widget.update();
    return widget;
  }
}

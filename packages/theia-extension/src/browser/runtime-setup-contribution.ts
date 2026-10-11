import { ConfirmDialog } from '@theia/core/lib/browser';
import { CommonMenus } from '@theia/core/lib/browser/common-frontend-contribution';
import { OpenerService } from '@theia/core/lib/browser/opener-service';
import { Command, CommandContribution, CommandRegistry, MenuContribution, MenuModelRegistry } from '@theia/core/lib/common';
import { MessageService } from '@theia/core/lib/common/message-service';
import { inject, injectable } from '@theia/core/shared/inversify';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { RuntimeSetupService } from '../common/runtime-setup-service';
import { openBundledDocumentationPreview } from './commodore-commander-bundled-docs';

export const CHECK_RUNTIME_SETUP: Command = {
  id: 'commodoreCommander.checkRuntimeSetup',
  category: 'Commodore Commander', label: 'Check Runtime Setup'
};

@injectable()
export class RuntimeSetupContribution implements CommandContribution, MenuContribution {
  @inject(RuntimeSetupService)
  protected readonly service!: RuntimeSetupService;
  @inject(WorkspaceService)
  protected readonly workspaceService!: WorkspaceService;
  @inject(OpenerService)
  protected readonly openerService!: OpenerService;
  @inject(MessageService)
  protected readonly messageService!: MessageService;

  protected checking = false;

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(CHECK_RUNTIME_SETUP, {
      execute: () => this.check(), isEnabled: () => !this.checking
    });
  }

  registerMenus(menus: MenuModelRegistry): void {
    menus.registerMenuAction(CommonMenus.HELP, { commandId: CHECK_RUNTIME_SETUP.id, order: '7' });
  }

  protected async check(): Promise<void> {
    this.checking = true;
    try {
      const root = (await this.workspaceService.roots)[0];
      const report = await this.service.check(root?.resource.toString());
      const content = document.createElement('div');
      content.dataset.runtimeSetupReport = 'true';
      content.style.maxWidth = '650px';
      content.style.maxHeight = '65vh';
      content.style.overflow = 'auto';
      const summary = document.createElement('p');
      summary.textContent = `${report.platform} · ${report.machine} · ${report.launchMode}`;
      content.appendChild(summary);
      for (const check of report.checks) {
        const heading = document.createElement('h3');
        heading.textContent = `${check.name}: ${check.state === 'ready' ? 'Ready' : 'Needs attention'}`;
        const detail = document.createElement('p');
        detail.style.whiteSpace = 'pre-wrap';
        detail.style.overflowWrap = 'anywhere';
        detail.textContent = check.detail;
        content.append(heading, detail);
      }
      const note = document.createElement('p');
      note.textContent = 'These checks verify tool loading and the selected VICE protocol. Run a program to verify display, input and debugging. Build and launch configurations can override these defaults.';
      content.appendChild(note);
      // The command completes when the report is displayed, not when dismissed.
      void new ConfirmDialog({ title: 'Runtime Setup', msg: content, ok: 'Open Setup Guide', cancel: 'Close' }).open()
        .then(confirmed => confirmed
          ? openBundledDocumentationPreview(this.openerService, 'runtime-setup.md')
          : undefined)
        .catch(error => this.messageService.error(`Could not open setup guide: ${String(error)}`));
    } catch (error) {
      await this.messageService.error(`Could not check runtime setup: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.checking = false;
    }
  }
}

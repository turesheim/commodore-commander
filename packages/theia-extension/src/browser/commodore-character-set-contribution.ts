import {
  ApplicationShell,
  defaultHandlerPriority,
  OpenHandler,
  WidgetManager,
  type OpenerOptions
} from '@theia/core/lib/browser';
import {
  CommonMenus
} from '@theia/core/lib/browser/common-frontend-contribution';
import {
  Command,
  CommandContribution,
  CommandRegistry,
  MenuContribution,
  MenuModelRegistry,
  QuickInputService,
  type QuickPickValue
} from '@theia/core/lib/common';
import { MessageService } from '@theia/core/lib/common/message-service';
import URI from '@theia/core/lib/common/uri';
import { FileDialogService } from '@theia/filesystem/lib/browser';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { inject, injectable } from '@theia/core/shared/inversify';

import {
  COMMODORE_CHARACTER_SET_FILE_EXTENSION,
  COMMODORE_LEGACY_CHARACTER_SET_FILE_EXTENSION,
  COMMODORE_CHARACTER_SET_TEMPLATES,
  createCharacterSetDocumentFromTemplate,
  serializeCharacterSetDocument,
  type CommodoreCharacterSetTemplate,
  type CommodoreCharacterSetTemplateId
} from '../common/commodore-character-set-format';
import {
  COMMODORE_CHARACTER_SET_WIDGET_FACTORY_ID,
  CommodoreCharacterSetWidget,
  type CommodoreCharacterSetWidgetOptions
} from './commodore-character-set-widget';

export namespace CommodoreCharacterSetCommands {
  export const NEW: Command = {
    id: 'commodoreCommander.charset.new',
    category: 'Commodore Commander',
    label: 'New Character Set',
    iconClass: 'codicon codicon-symbol-color'
  };
}

@injectable()
export class CommodoreCharacterSetContribution
  implements CommandContribution, MenuContribution, OpenHandler
{
  readonly id = 'commodore-character-set-opener';
  readonly label = 'Commodore Character Set Editor';
  readonly iconClass = 'codicon codicon-symbol-color';

  @inject(ApplicationShell)
  protected readonly shell!: ApplicationShell;

  @inject(FileDialogService)
  protected readonly fileDialogService!: FileDialogService;

  @inject(FileService)
  protected readonly fileService!: FileService;

  @inject(MessageService)
  protected readonly messageService!: MessageService;

  @inject(QuickInputService)
  protected readonly quickInputService!: QuickInputService;

  @inject(WidgetManager)
  protected readonly widgetManager!: WidgetManager;

  @inject(WorkspaceService)
  protected readonly workspaceService!: WorkspaceService;

  canHandle(uri: URI, _options?: OpenerOptions): number {
    return isCharacterSetUri(uri) ? defaultHandlerPriority + 20 : 0;
  }

  open(uri: URI, _options?: OpenerOptions): Promise<object | undefined> {
    return this.openCharacterSet(uri);
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(CommodoreCharacterSetCommands.NEW, {
      execute: () => this.createCharacterSet(),
      isEnabled: () => this.workspaceService.opened,
      isVisible: () => true
    });
  }

  registerMenus(menus: MenuModelRegistry): void {
    menus.registerMenuAction(CommonMenus.FILE_NEW_CONTRIBUTIONS, {
      commandId: CommodoreCharacterSetCommands.NEW.id,
      label: CommodoreCharacterSetCommands.NEW.label,
      icon: CommodoreCharacterSetCommands.NEW.iconClass,
      order: '6'
    });
  }

  protected async createCharacterSet(): Promise<void> {
    await this.workspaceService.ready;
    const template = await this.pickCharacterSetTemplate();
    if (!template) {
      return;
    }

    const root = (await this.workspaceService.roots)[0];
    const target = await this.fileDialogService.showSaveDialog(
      {
        title: 'New Character Set',
        saveLabel: 'Create',
        inputValue: `${template.defaultFileName}${COMMODORE_CHARACTER_SET_FILE_EXTENSION}`,
        filters: {
          'Commodore Commander Character Set': [
            COMMODORE_CHARACTER_SET_FILE_EXTENSION.slice(1)
          ]
        }
      },
      root
    );
    if (!target) {
      return;
    }

    const uri = ensureCharacterSetExtension(target);
    const document = createCharacterSetDocumentFromTemplate(
      template.id,
      uri.path.name || template.defaultName
    );
    await this.fileService.write(uri, serializeCharacterSetDocument(document));
    await this.openCharacterSet(uri);
  }

  protected async pickCharacterSetTemplate(): Promise<
    CommodoreCharacterSetTemplate | undefined
  > {
    const picks: QuickPickValue<CommodoreCharacterSetTemplateId>[] =
      COMMODORE_CHARACTER_SET_TEMPLATES.map((template) => ({
        label: template.label,
        description: template.description,
        value: template.id
      }));
    const selected = await this.quickInputService.pick(picks, {
      placeHolder: 'Select starting character set',
      activeItem: picks[0]
    });
    return selected
      ? COMMODORE_CHARACTER_SET_TEMPLATES.find(
          (template) => template.id === selected.value
        )
      : undefined;
  }

  protected async openCharacterSet(uri: URI): Promise<object | undefined> {
    if (!isCharacterSetUri(uri)) {
      return undefined;
    }

    try {
      const options: CommodoreCharacterSetWidgetOptions = {
        uri: uri.toString()
      };
      const widget = await this.widgetManager.getOrCreateWidget<
        CommodoreCharacterSetWidget
      >(COMMODORE_CHARACTER_SET_WIDGET_FACTORY_ID, options);
      if (!widget.isAttached) {
        await this.shell.addWidget(widget, { area: 'main' });
      }
      this.shell.activateWidget(widget.id);
      return widget;
    } catch (error) {
      this.messageService.error(
        `Could not open character set editor: ${toErrorMessage(error)}`
      );
      return undefined;
    }
  }
}

export function isCharacterSetUri(uri: URI): boolean {
  if (uri.scheme !== 'file') {
    return false;
  }
  const extension = uri.path.ext.toLowerCase();
  return extension === COMMODORE_CHARACTER_SET_FILE_EXTENSION ||
    extension === COMMODORE_LEGACY_CHARACTER_SET_FILE_EXTENSION;
}

function ensureCharacterSetExtension(uri: URI): URI {
  const extension = uri.path.ext.toLowerCase();
  if (
    uri.scheme === 'file' &&
    extension === COMMODORE_CHARACTER_SET_FILE_EXTENSION
  ) {
    return uri;
  }
  if (
    uri.scheme === 'file' &&
    extension === COMMODORE_LEGACY_CHARACTER_SET_FILE_EXTENSION
  ) {
    return uri.withPath(
      uri.path.dir.join(`${uri.path.name}${COMMODORE_CHARACTER_SET_FILE_EXTENSION}`)
    );
  }
  return uri.withPath(
    uri.path.dir.join(`${uri.path.base}${COMMODORE_CHARACTER_SET_FILE_EXTENSION}`)
  );
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

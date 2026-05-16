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
  COMMODORE_SPRITE_FILE_EXTENSION,
  COMMODORE_SPRITE_TEMPLATES,
  createSpriteDocumentFromTemplate,
  serializeSpriteDocument,
  type CommodoreSpriteTemplate,
  type CommodoreSpriteTemplateId
} from '../common/commodore-sprite-format';
import {
  COMMODORE_SPRITE_WIDGET_FACTORY_ID,
  CommodoreSpriteWidget,
  type CommodoreSpriteWidgetOptions
} from './commodore-sprite-widget';

export namespace CommodoreSpriteCommands {
  export const NEW: Command = {
    id: 'commodoreCommander.sprite.new',
    category: 'Commodore Commander',
    label: 'New Sprite',
    iconClass: 'codicon codicon-symbol-misc'
  };
}

@injectable()
export class CommodoreSpriteContribution
  implements CommandContribution, MenuContribution, OpenHandler
{
  readonly id = 'commodore-sprite-opener';
  readonly label = 'Commodore Sprite Editor';
  readonly iconClass = 'codicon codicon-symbol-misc';

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
    return isSpriteUri(uri) ? defaultHandlerPriority + 20 : 0;
  }

  open(uri: URI, _options?: OpenerOptions): Promise<object | undefined> {
    return this.openSprite(uri);
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(CommodoreSpriteCommands.NEW, {
      execute: () => this.createSprite(),
      isEnabled: () => this.workspaceService.opened,
      isVisible: () => true
    });
  }

  registerMenus(menus: MenuModelRegistry): void {
    menus.registerMenuAction(CommonMenus.FILE_NEW_CONTRIBUTIONS, {
      commandId: CommodoreSpriteCommands.NEW.id,
      label: CommodoreSpriteCommands.NEW.label,
      icon: CommodoreSpriteCommands.NEW.iconClass,
      order: '8'
    });
  }

  protected async createSprite(): Promise<void> {
    await this.workspaceService.ready;
    const template = await this.pickSpriteTemplate();
    if (!template) {
      return;
    }

    const root = (await this.workspaceService.roots)[0];
    const target = await this.fileDialogService.showSaveDialog(
      {
        title: 'New Sprite',
        saveLabel: 'Create',
        inputValue: `${template.defaultFileName}${COMMODORE_SPRITE_FILE_EXTENSION}`,
        filters: {
          'Commodore Commander Sprite': [
            COMMODORE_SPRITE_FILE_EXTENSION.slice(1)
          ]
        }
      },
      root
    );
    if (!target) {
      return;
    }

    const uri = ensureSpriteExtension(target);
    const document = createSpriteDocumentFromTemplate(
      template.id,
      uri.path.name || template.defaultName
    );
    await this.fileService.write(uri, serializeSpriteDocument(document));
    await this.openSprite(uri);
  }

  protected async pickSpriteTemplate(): Promise<
    CommodoreSpriteTemplate | undefined
  > {
    const picks: QuickPickValue<CommodoreSpriteTemplateId>[] =
      COMMODORE_SPRITE_TEMPLATES.map((template) => ({
        label: template.label,
        description: template.description,
        value: template.id
      }));
    const selected = await this.quickInputService.pick(picks, {
      placeHolder: 'Select starting sprite',
      activeItem: picks[0]
    });
    return selected
      ? COMMODORE_SPRITE_TEMPLATES.find(
          (template) => template.id === selected.value
        )
      : undefined;
  }

  protected async openSprite(uri: URI): Promise<object | undefined> {
    if (!isSpriteUri(uri)) {
      return undefined;
    }

    try {
      const options: CommodoreSpriteWidgetOptions = {
        uri: uri.toString()
      };
      const widget = await this.widgetManager.getOrCreateWidget<
        CommodoreSpriteWidget
      >(COMMODORE_SPRITE_WIDGET_FACTORY_ID, options);
      if (!widget.isAttached) {
        await this.shell.addWidget(widget, { area: 'main' });
      }
      this.shell.activateWidget(widget.id);
      return widget;
    } catch (error) {
      this.messageService.error(
        `Could not open sprite editor: ${toErrorMessage(error)}`
      );
      return undefined;
    }
  }
}

export function isSpriteUri(uri: URI): boolean {
  return uri.scheme === 'file' &&
    uri.path.ext.toLowerCase() === COMMODORE_SPRITE_FILE_EXTENSION;
}

function ensureSpriteExtension(uri: URI): URI {
  if (
    uri.scheme === 'file' &&
    uri.path.ext.toLowerCase() === COMMODORE_SPRITE_FILE_EXTENSION
  ) {
    return uri;
  }
  return uri.withPath(
    uri.path.dir.join(`${uri.path.base}${COMMODORE_SPRITE_FILE_EXTENSION}`)
  );
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

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
  COMMODORE_CHARACTER_SET_TEMPLATES,
  type CommodoreCharacterSetTemplate,
  type CommodoreCharacterSetTemplateId
} from '../common/commodore-character-set-format';
import {
  COMMODORE_SCREEN_DEFAULT_COLUMNS,
  COMMODORE_SCREEN_DEFAULT_ROWS,
  COMMODORE_SCREEN_FILE_EXTENSION,
  COMMODORE_SCREEN_MAX_COLUMNS,
  COMMODORE_SCREEN_MAX_ROWS,
  COMMODORE_SCREEN_MIN_COLUMNS,
  COMMODORE_SCREEN_MIN_ROWS,
  createDefaultScreenDocument,
  serializeScreenDocument
} from '../common/commodore-screen-format';
import {
  COMMODORE_SCREEN_WIDGET_FACTORY_ID,
  CommodoreScreenWidget,
  type CommodoreScreenWidgetOptions
} from './commodore-screen-widget';

export namespace CommodoreScreenCommands {
  export const NEW: Command = {
    id: 'commodoreCommander.screen.new',
    category: 'Commodore Commander',
    label: 'New Screen',
    iconClass: 'codicon codicon-layout'
  };
}

@injectable()
export class CommodoreScreenContribution
  implements CommandContribution, MenuContribution, OpenHandler
{
  readonly id = 'commodore-screen-opener';
  readonly label = 'Commodore Screen Editor';
  readonly iconClass = 'codicon codicon-layout';

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
    return isScreenUri(uri) ? defaultHandlerPriority + 20 : 0;
  }

  open(uri: URI, _options?: OpenerOptions): Promise<object | undefined> {
    return this.openScreen(uri);
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(CommodoreScreenCommands.NEW, {
      execute: () => this.createScreen(),
      isEnabled: () => this.workspaceService.opened,
      isVisible: () => true
    });
  }

  registerMenus(menus: MenuModelRegistry): void {
    menus.registerMenuAction(CommonMenus.FILE_NEW_CONTRIBUTIONS, {
      commandId: CommodoreScreenCommands.NEW.id,
      label: CommodoreScreenCommands.NEW.label,
      icon: CommodoreScreenCommands.NEW.iconClass,
      order: '7'
    });
  }

  protected async createScreen(): Promise<void> {
    await this.workspaceService.ready;
    const template = await this.pickCharacterSetTemplate();
    if (!template) {
      return;
    }
    const dimensions = await this.promptDimensions();
    if (!dimensions) {
      return;
    }

    const root = (await this.workspaceService.roots)[0];
    const target = await this.fileDialogService.showSaveDialog(
      {
        title: 'New Screen',
        saveLabel: 'Create',
        inputValue: 'untitled-screen.screen',
        filters: {
          'Commodore Commander Screen': [
            COMMODORE_SCREEN_FILE_EXTENSION.slice(1)
          ]
        }
      },
      root
    );
    if (!target) {
      return;
    }

    const uri = ensureScreenExtension(target);
    const document = createDefaultScreenDocument(uri.path.name || 'Screen', {
      characterSetTemplateId: template.id,
      columns: dimensions.columns,
      rows: dimensions.rows
    });
    await this.fileService.write(uri, serializeScreenDocument(document));
    await this.openScreen(uri);
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
      activeItem: picks[1] ?? picks[0]
    });
    return selected
      ? COMMODORE_CHARACTER_SET_TEMPLATES.find(
          (template) => template.id === selected.value
        )
      : undefined;
  }

  protected async promptDimensions(): Promise<
    { columns: number; rows: number } | undefined
  > {
    const input = await this.quickInputService.input({
      placeHolder: 'Screen size, columns x rows',
      value: `${COMMODORE_SCREEN_DEFAULT_COLUMNS}x${COMMODORE_SCREEN_DEFAULT_ROWS}`,
      validateInput: async (value) =>
        parseDimensions(value) === undefined
          ? `Enter columns x rows from ${COMMODORE_SCREEN_MIN_COLUMNS}-${COMMODORE_SCREEN_MAX_COLUMNS} by ${COMMODORE_SCREEN_MIN_ROWS}-${COMMODORE_SCREEN_MAX_ROWS}.`
          : undefined
    });
    return input === undefined ? undefined : parseDimensions(input);
  }

  protected async openScreen(uri: URI): Promise<object | undefined> {
    if (!isScreenUri(uri)) {
      return undefined;
    }

    try {
      const options: CommodoreScreenWidgetOptions = {
        uri: uri.toString()
      };
      const widget = await this.widgetManager.getOrCreateWidget<
        CommodoreScreenWidget
      >(COMMODORE_SCREEN_WIDGET_FACTORY_ID, options);
      if (!widget.isAttached) {
        await this.shell.addWidget(widget, { area: 'main' });
      }
      this.shell.activateWidget(widget.id);
      return widget;
    } catch (error) {
      this.messageService.error(
        `Could not open screen editor: ${toErrorMessage(error)}`
      );
      return undefined;
    }
  }
}

export function isScreenUri(uri: URI): boolean {
  return uri.scheme === 'file' &&
    uri.path.ext.toLowerCase() === COMMODORE_SCREEN_FILE_EXTENSION;
}

function ensureScreenExtension(uri: URI): URI {
  if (
    uri.scheme === 'file' &&
    uri.path.ext.toLowerCase() === COMMODORE_SCREEN_FILE_EXTENSION
  ) {
    return uri;
  }
  return uri.withPath(
    uri.path.dir.join(`${uri.path.base}${COMMODORE_SCREEN_FILE_EXTENSION}`)
  );
}

function parseDimensions(
  value: string
): { columns: number; rows: number } | undefined {
  const match = /^\s*(\d+)\s*(?:x|,|\s)\s*(\d+)\s*$/iu.exec(value);
  if (!match) {
    return undefined;
  }
  const columns = Number.parseInt(match[1] ?? '', 10);
  const rows = Number.parseInt(match[2] ?? '', 10);
  if (
    !Number.isFinite(columns) ||
    !Number.isFinite(rows) ||
    columns < COMMODORE_SCREEN_MIN_COLUMNS ||
    columns > COMMODORE_SCREEN_MAX_COLUMNS ||
    rows < COMMODORE_SCREEN_MIN_ROWS ||
    rows > COMMODORE_SCREEN_MAX_ROWS
  ) {
    return undefined;
  }
  return { columns, rows };
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

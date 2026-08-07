import {
  defaultHandlerPriority,
  OpenHandler,
  type OpenerOptions
} from '@theia/core/lib/browser/opener-service';
import {
  Command,
  CommandContribution,
  CommandRegistry,
  MenuContribution,
  MenuModelRegistry,
  QuickInputService,
  type QuickPickValue,
  Resource,
  ResourceResolver,
  SelectionService,
  UriSelection
} from '@theia/core/lib/common';
import { MessageService } from '@theia/core/lib/common/message-service';
import URI from '@theia/core/lib/common/uri';
import { EditorManager } from '@theia/editor/lib/browser';
import { NavigatorContextMenu } from '@theia/navigator/lib/browser/navigator-contribution';
import { inject, injectable } from '@theia/core/shared/inversify';

import {
  CommodorePrgService,
  type CommodorePrgService as CommodorePrgServiceProxy
} from '../common/commodore-prg-service';
import {
  CommodoreViceLaunchConfigurationContribution
} from './commodore-vice-launch-configuration-contribution';

const PRG_DISASSEMBLY_SCHEME = 'cc-prg-disassembly';

type PrgAction = 'run' | 'debug' | 'disassemble';

export namespace CommodorePrgCommands {
  export const RUN: Command = {
    id: 'commodoreCommander.prg.run',
    category: 'Commodore Commander',
    label: 'Run PRG',
    iconClass: 'codicon codicon-play'
  };
  export const DEBUG: Command = {
    id: 'commodoreCommander.prg.debug',
    category: 'Commodore Commander',
    label: 'Debug PRG',
    iconClass: 'codicon codicon-debug-alt'
  };
  export const DISASSEMBLE: Command = {
    id: 'commodoreCommander.prg.disassemble',
    category: 'Commodore Commander',
    label: 'Disassemble PRG',
    iconClass: 'codicon codicon-file-code'
  };
}

@injectable()
export class CommodorePrgContribution
  implements CommandContribution, MenuContribution, OpenHandler, ResourceResolver
{
  readonly id = 'commodore-prg-opener';
  readonly label = 'Commodore PRG';
  readonly iconClass = 'codicon codicon-file-binary';

  @inject(CommodorePrgService)
  protected readonly prgService!: CommodorePrgServiceProxy;

  @inject(CommodoreViceLaunchConfigurationContribution)
  protected readonly viceLauncher!: CommodoreViceLaunchConfigurationContribution;

  @inject(EditorManager)
  protected readonly editorManager!: EditorManager;

  @inject(MessageService)
  protected readonly messageService!: MessageService;

  @inject(QuickInputService)
  protected readonly quickInputService!: QuickInputService;

  @inject(SelectionService)
  protected readonly selectionService!: SelectionService;

  canHandle(uri: URI, _options?: OpenerOptions): number {
    return isPrgUri(uri) ? defaultHandlerPriority + 10 : 0;
  }

  async open(uri: URI, _options?: OpenerOptions): Promise<object | undefined> {
    return this.offerPrgActions(uri);
  }

  resolve(uri: URI): Resource {
    if (uri.scheme !== PRG_DISASSEMBLY_SCHEME) {
      throw new Error(
        `Expected ${PRG_DISASSEMBLY_SCHEME}: URI. Was: ${uri.toString()}.`
      );
    }

    return new CommodorePrgDisassemblyResource(
      uri,
      prgUriFromDisassemblyUri(uri),
      this.prgService
    );
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(CommodorePrgCommands.RUN, {
      execute: (resource?: unknown) => this.runPrg(resource),
      isEnabled: (resource?: unknown) => Boolean(this.getPrgResource(resource)),
      isVisible: (resource?: unknown) => Boolean(this.getPrgResource(resource))
    });
    commands.registerCommand(CommodorePrgCommands.DEBUG, {
      execute: (resource?: unknown) => this.debugPrg(resource),
      isEnabled: (resource?: unknown) => Boolean(this.getPrgResource(resource)),
      isVisible: (resource?: unknown) => Boolean(this.getPrgResource(resource))
    });
    commands.registerCommand(CommodorePrgCommands.DISASSEMBLE, {
      execute: (resource?: unknown) => this.disassemblePrg(resource),
      isEnabled: (resource?: unknown) => Boolean(this.getPrgResource(resource)),
      isVisible: (resource?: unknown) => Boolean(this.getPrgResource(resource))
    });
  }

  registerMenus(menus: MenuModelRegistry): void {
    menus.registerMenuAction(NavigatorContextMenu.NAVIGATION, {
      commandId: CommodorePrgCommands.RUN.id,
      label: CommodorePrgCommands.RUN.label,
      icon: CommodorePrgCommands.RUN.iconClass,
      order: '1_prg_run'
    });
    menus.registerMenuAction(NavigatorContextMenu.NAVIGATION, {
      commandId: CommodorePrgCommands.DEBUG.id,
      label: CommodorePrgCommands.DEBUG.label,
      icon: CommodorePrgCommands.DEBUG.iconClass,
      order: '1_prg_debug'
    });
    menus.registerMenuAction(NavigatorContextMenu.NAVIGATION, {
      commandId: CommodorePrgCommands.DISASSEMBLE.id,
      label: CommodorePrgCommands.DISASSEMBLE.label,
      icon: CommodorePrgCommands.DISASSEMBLE.iconClass,
      order: '1_prg_disassemble'
    });
  }

  protected async offerPrgActions(uri: URI): Promise<object | undefined> {
    if (!isPrgUri(uri)) {
      return undefined;
    }

    const picks: QuickPickValue<PrgAction>[] = [
      {
        label: 'Run PRG',
        description: 'Start in the emulator',
        value: 'run'
      },
      {
        label: 'Debug PRG',
        description: 'Start a debug session',
        value: 'debug'
      },
      {
        label: 'Disassemble PRG',
        description: 'Open 6502 disassembly in an editor',
        value: 'disassemble'
      }
    ];
    const selected = await this.quickInputService.pick(picks, {
      placeHolder: `Open ${uri.path.base}`,
      activeItem: picks[0]
    });

    switch (selected?.value) {
      case 'run':
        await this.startPrg(uri, true);
        return undefined;
      case 'debug':
        await this.startPrg(uri, false);
        return undefined;
      case 'disassemble':
        return this.openDisassembly(uri);
      default:
        return undefined;
    }
  }

  protected async runPrg(resource?: unknown): Promise<void> {
    const uri = this.getPrgResource(resource);
    if (!uri) {
      this.messageService.warn('Select a .prg file before running.');
      return;
    }
    await this.startPrg(uri, true);
  }

  protected async debugPrg(resource?: unknown): Promise<void> {
    const uri = this.getPrgResource(resource);
    if (!uri) {
      this.messageService.warn('Select a .prg file before debugging.');
      return;
    }
    await this.startPrg(uri, false);
  }

  protected async disassemblePrg(resource?: unknown): Promise<object | undefined> {
    const uri = this.getPrgResource(resource);
    if (!uri) {
      this.messageService.warn('Select a .prg file before disassembling.');
      return undefined;
    }
    return this.openDisassembly(uri);
  }

  protected async startPrg(uri: URI, noDebug: boolean): Promise<void> {
    try {
      await this.viceLauncher.startProgram(uri, noDebug);
    } catch (error) {
      this.messageService.error(
        `Could not ${noDebug ? 'run' : 'debug'} ${uri.path.base}: ` +
          `${toErrorMessage(error)}`
      );
    }
  }

  protected openDisassembly(uri: URI): Promise<object | undefined> {
    return this.editorManager.open(prgDisassemblyUri(uri), {
      mode: 'activate',
      preview: false
    });
  }

  protected getPrgResource(resource?: unknown): URI | undefined {
    const uri =
      toUri(resource) ??
      UriSelection.getUri(this.selectionService.selection) ??
      this.editorManager.currentEditor?.editor.uri;

    return uri && isPrgUri(uri) ? uri : undefined;
  }
}

class CommodorePrgDisassemblyResource implements Resource {
  readonly readOnly = true;
  readonly autosaveable = false;

  constructor(
    readonly uri: URI,
    protected readonly sourceUri: URI,
    protected readonly prgService: CommodorePrgServiceProxy
  ) {}

  dispose(): void {}

  async readContents(): Promise<string> {
    const result = await this.prgService.disassemble({
      resourceUri: this.sourceUri.toString()
    });
    return result.text;
  }
}

function prgDisassemblyUri(prgUri: URI): URI {
  const baseName = sanitizeDisassemblyBaseName(prgUri.path.base);
  return new URI(`${PRG_DISASSEMBLY_SCHEME}:/${baseName}.asm`).withQuery(
    `resource=${encodeURIComponent(prgUri.toString())}`
  );
}

function prgUriFromDisassemblyUri(uri: URI): URI {
  const resource = new URLSearchParams(uri.query).get('resource');
  if (!resource) {
    throw new Error('PRG disassembly URI is missing its source resource.');
  }
  return new URI(resource);
}

function sanitizeDisassemblyBaseName(baseName: string): string {
  const normalized = baseName.replace(/[^A-Za-z0-9._-]+/gu, '_');
  return normalized.length > 0 ? normalized : 'program.prg';
}

function isPrgUri(uri: URI): boolean {
  return uri.scheme === 'file' && uri.path.ext.toLowerCase() === '.prg';
}

function toUri(resource: unknown): URI | undefined {
  if (resource instanceof URI) {
    return resource;
  }
  return UriSelection.getUri(resource);
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

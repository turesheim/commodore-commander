import {
  OpenerService,
  open
} from '@theia/core/lib/browser/opener-service';
import {
  ApplicationShell,
  type FrontendApplicationContribution,
  WidgetManager
} from '@theia/core/lib/browser';
import {
  CommandService,
  type CommandService as CommandServiceType
} from '@theia/core/lib/common/command';
import { DebugConfigurationManager } from '@theia/debug/lib/browser/debug-configuration-manager';
import { DebugSessionManager } from '@theia/debug/lib/browser/debug-session-manager';
import type { DebugConfigurationSessionOptions } from '@theia/debug/lib/browser/debug-session-options';
import type { DebugConfiguration } from '@theia/debug/lib/common/debug-common';
import { DebugWidget } from '@theia/debug/lib/browser/view/debug-widget';
import { FileUri } from '@theia/core/lib/common/file-uri';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import URI from '@theia/core/lib/common/uri';
import { inject, injectable } from '@theia/core/shared/inversify';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { parse as parseJsonC } from 'jsonc-parser';
import {
  VICE_MEMORY_WIDGET_ID,
  ViceMemoryWidget
} from './vice-memory-widget';

export const SCREEN_CAPTURE_STATE_KEY = '__commodoreCommanderScreenCapture';
export const SCREEN_CAPTURE_API_KEY = '__commodoreCommanderScreenCaptureApi';
const OUTLINE_WIDGET_FACTORY_ID = 'outline-view';
const SCREEN_CAPTURE_LAUNCH_PROVIDER_TYPE = 'launch.json';

interface ScreenCaptureState {
  requested?: string;
  opened?: string;
  error?: string;
}

export interface CommodoreCommanderScreenCaptureApi {
  collapseBottomPanel?: () => Promise<boolean>;
  executeCommand?: (
    commandId: string,
    args?: readonly unknown[]
  ) => Promise<boolean>;
  openDebugView?: () => Promise<boolean>;
  openMemoryView?: () => Promise<boolean>;
  openOutlineView?: () => Promise<boolean>;
  openSourceFile?: (filePath: string) => Promise<boolean>;
  revealMemoryTextColumn?: () => Promise<boolean>;
  runEditorAction?: (actionId: string) => Promise<boolean>;
  setEditorSource?: (
    source: string,
    marker?: { needle?: string; offset?: number }
  ) => Promise<boolean>;
  setEditorMarker?: (
    marker?: { needle?: string; offset?: number }
  ) => Promise<boolean>;
  setSourceBreakpoint?: (
    marker?: { needle?: string; offset?: number }
  ) => Promise<boolean>;
  showScreenMemory?: () => Promise<boolean>;
  startLaunchConfiguration?: (
    name: string,
    configuration?: DebugConfiguration,
    workspaceFolderUri?: string
  ) => Promise<boolean>;
  showMnemonicHover?: () => Promise<boolean>;
  showReferences?: () => Promise<boolean>;
}

type ScreenCaptureWindow = Window & {
  [SCREEN_CAPTURE_STATE_KEY]?: ScreenCaptureState;
  [SCREEN_CAPTURE_API_KEY]?: CommodoreCommanderScreenCaptureApi;
};

@injectable()
export class CommodoreCommanderScreenCaptureContribution
  implements FrontendApplicationContribution {
  @inject(OpenerService)
  protected readonly openerService!: OpenerService;

  @inject(WorkspaceService)
  protected readonly workspaceService!: WorkspaceService;

  @inject(ApplicationShell)
  protected readonly shell!: ApplicationShell;

  @inject(WidgetManager)
  protected readonly widgetManager!: WidgetManager;

  @inject(CommandService)
  protected readonly commandService!: CommandServiceType;

  @inject(DebugConfigurationManager)
  protected readonly debugConfigurations!: DebugConfigurationManager;

  @inject(DebugSessionManager)
  protected readonly debugSessionManager!: DebugSessionManager;

  @inject(FileService)
  protected readonly fileService!: FileService;

  initialize(): void {
    this.installScreenCaptureApi();
  }

  protected installScreenCaptureApi(): void {
    const captureWindow = window as ScreenCaptureWindow;
    captureWindow[SCREEN_CAPTURE_API_KEY] = {
      ...captureWindow[SCREEN_CAPTURE_API_KEY],
      collapseBottomPanel: async () => this.collapseBottomPanelForScreenCapture(),
      executeCommand: async (commandId, args) =>
        this.executeCommandForScreenCapture(commandId, args),
      openDebugView: async () => this.openWidgetForScreenCapture(
        DebugWidget.ID,
        'left',
        420,
        400
      ),
      openMemoryView: async () => this.openWidgetForScreenCapture(
        VICE_MEMORY_WIDGET_ID,
        'bottom',
        320,
        230
      ),
      openOutlineView: async () => this.openOutlineViewForScreenCapture(),
      openSourceFile: async (filePath) =>
        this.openSourceFileForScreenCapture(filePath),
      revealMemoryTextColumn: async () =>
        this.revealMemoryTextColumnForScreenCapture(),
      showScreenMemory: async () => this.showScreenMemoryForScreenCapture(),
      startLaunchConfiguration: async (name, configuration, workspaceFolderUri) =>
        this.startLaunchConfigurationForScreenCapture(
          name,
          configuration,
          workspaceFolderUri
        )
    };
  }

  protected async openSourceFileForScreenCapture(
    filePath: string
  ): Promise<boolean> {
    const state: ScreenCaptureState = { requested: filePath };
    (window as ScreenCaptureWindow)[SCREEN_CAPTURE_STATE_KEY] = state;

    try {
      await this.workspaceService.ready;
      const uri = toUri(filePath);
      await open(this.openerService, uri);
      state.opened = uri.toString();
      return true;
    } catch (error) {
      state.error = error instanceof Error ? error.message : String(error);
      console.warn('Unable to open screen capture file.', error);
      return false;
    }
  }

  protected async collapseBottomPanelForScreenCapture(): Promise<boolean> {
    await this.shell.collapsePanel('bottom');
    return true;
  }

  protected async executeCommandForScreenCapture(
    commandId: string,
    args: readonly unknown[] = []
  ): Promise<boolean> {
    await this.commandService.executeCommand(commandId, ...args);
    return true;
  }

  protected async startLaunchConfigurationForScreenCapture(
    name: string,
    configuration?: DebugConfiguration,
    workspaceFolderUri?: string
  ): Promise<boolean> {
    await this.workspaceService.ready;
    const workspaceRootUri = this.workspaceService.tryGetRoots()[0]?.resource;
    const options =
      this.findLaunchConfigurationForScreenCapture(name, workspaceFolderUri) ??
      (await this.readLaunchConfigurationForScreenCapture(
        name,
        workspaceRootUri
      )) ??
      this.providedLaunchConfigurationForScreenCapture(
        name,
        configuration,
        workspaceFolderUri,
        workspaceRootUri
      );
    if (!options) {
      console.warn(`Unable to find launch configuration: ${name}`);
      return false;
    }

    this.debugConfigurations.current = options;
    void this.debugSessionManager.start({
      ...options,
      startedByUser: true
    })
      .catch((error) =>
        console.warn(`Unable to start launch configuration: ${name}`, error)
      );
    return true;
  }

  protected providedLaunchConfigurationForScreenCapture(
    name: string,
    configuration: DebugConfiguration | undefined,
    workspaceFolderUri: string | undefined,
    workspaceRootUri: URI | undefined
  ): DebugConfigurationSessionOptions | undefined {
    if (!configuration) {
      return undefined;
    }
    return {
      name,
      configuration: {
        ...configuration,
        name
      },
      providerType: SCREEN_CAPTURE_LAUNCH_PROVIDER_TYPE,
      workspaceFolderUri: workspaceFolderUri ?? workspaceRootUri?.toString()
    };
  }

  protected findLaunchConfigurationForScreenCapture(
    name: string,
    workspaceFolderUri: string | undefined
  ): DebugConfigurationSessionOptions | undefined {
    return Array.from(this.debugConfigurations.all)
      .find((candidate): candidate is DebugConfigurationSessionOptions =>
        'configuration' in candidate &&
        candidate.name === name &&
        (!workspaceFolderUri ||
          candidate.workspaceFolderUri === workspaceFolderUri)
      );
  }

  protected async readLaunchConfigurationForScreenCapture(
    name: string,
    workspaceRootUri: URI | undefined
  ): Promise<DebugConfigurationSessionOptions | undefined> {
    if (!workspaceRootUri) {
      return undefined;
    }

    const launchUri = workspaceRootUri.resolve('.theia').resolve('launch.json');
    if (!await this.fileService.exists(launchUri)) {
      return undefined;
    }

    const content = await this.fileService.read(launchUri, {
      acceptTextOnly: true
    });
    const parsed = parseJsonC(content.value);
    if (!isRecord(parsed) || !Array.isArray(parsed.configurations)) {
      return undefined;
    }

    const configuration = parsed.configurations.find(
      (candidate): candidate is DebugConfiguration =>
        isRecord(candidate) && candidate.name === name
    );
    if (!configuration) {
      return undefined;
    }

    return {
      name,
      configuration,
      providerType: SCREEN_CAPTURE_LAUNCH_PROVIDER_TYPE,
      workspaceFolderUri: workspaceRootUri.toString()
    };
  }

  protected async showScreenMemoryForScreenCapture(): Promise<boolean> {
    const widget = await this.widgetManager.getOrCreateWidget<ViceMemoryWidget>(
      VICE_MEMORY_WIDGET_ID
    );
    widget.showScreenPresetForScreenCapture();
    return true;
  }

  protected async revealMemoryTextColumnForScreenCapture(): Promise<boolean> {
    const widget = await this.widgetManager.getOrCreateWidget<ViceMemoryWidget>(
      VICE_MEMORY_WIDGET_ID
    );
    widget.revealTextColumnForScreenCapture();
    return true;
  }

  protected async openWidgetForScreenCapture(
    widgetId: string,
    area: 'left' | 'right' | 'bottom',
    size: number,
    rank: number
  ): Promise<boolean> {
    await this.workspaceService.ready;
    const widget = await this.widgetManager.getOrCreateWidget(widgetId);
    if (!widget.isAttached) {
      await this.shell.addWidget(widget, { area, rank });
    }

    this.shell.expandPanel(area);
    this.shell.resize(size, area);
    await revealWidgetForScreenCapture(this.shell, widget.id);
    return true;
  }

  protected async openOutlineViewForScreenCapture(): Promise<boolean> {
    await this.workspaceService.ready;
    const widget = await this.widgetManager.getOrCreateWidget(
      OUTLINE_WIDGET_FACTORY_ID
    );
    if (!widget.isAttached) {
      await this.shell.addWidget(widget, { area: 'right', rank: 500 });
    }

    this.shell.expandPanel('right');
    this.shell.resize(320, 'right');
    await revealWidgetForScreenCapture(this.shell, widget.id);
    return true;
  }
}

function toUri(value: string): URI {
  if (/^[a-z][a-z0-9+.-]*:/iu.test(value)) {
    return new URI(value);
  }
  return FileUri.create(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function revealWidgetForScreenCapture(
  shell: ApplicationShell,
  widgetId: string
): Promise<void> {
  await Promise.race([
    shell.revealWidget(widgetId).catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, 2000))
  ]);
}

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
import { DebugSession, DebugState } from '@theia/debug/lib/browser/debug-session';
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
import {
  C64_VISUAL_DEBUGGER_WIDGET_ID,
  C64VisualDebuggerWidget
} from './c64-visual-debugger-widget';

export const SCREEN_CAPTURE_STATE_KEY = '__commodoreCommanderScreenCapture';
export const SCREEN_CAPTURE_API_KEY = '__commodoreCommanderScreenCaptureApi';
const OUTLINE_WIDGET_FACTORY_ID = 'outline-view';
const SCREEN_CAPTURE_LAUNCH_PROVIDER_TYPE = 'launch.json';
const C64_BASIC_READY_SCREEN_COMMODORE = [3, 15, 13, 13, 15, 4, 15, 18, 5];
const C64_BASIC_READY_SCREEN_READY = [18, 5, 1, 4, 25];
const SCREEN_CAPTURE_SPRITE_BITMAP = [
  0x00, 0x7e, 0x00,
  0x01, 0x81, 0x80,
  0x02, 0x00, 0x40,
  0x04, 0x3c, 0x20,
  0x08, 0x42, 0x10,
  0x10, 0x81, 0x08,
  0x21, 0x00, 0x84,
  0x22, 0x66, 0x44,
  0x44, 0x66, 0x22,
  0x48, 0x00, 0x12,
  0x50, 0x81, 0x0a,
  0x50, 0x42, 0x0a,
  0x48, 0x3c, 0x12,
  0x44, 0x00, 0x22,
  0x22, 0x18, 0x44,
  0x21, 0xff, 0x84,
  0x10, 0x18, 0x08,
  0x08, 0x18, 0x10,
  0x04, 0x3c, 0x20,
  0x02, 0x42, 0x40,
  0x01, 0x81, 0x80,
  0x00
];

interface ScreenCaptureState {
  requested?: string;
  opened?: string;
  error?: string;
}

export interface CommodoreCommanderScreenCaptureApi {
  collapseBottomPanel?: () => Promise<boolean>;
  continueDebugSession?: (reason?: string) => Promise<boolean>;
  executeCommand?: (
    commandId: string,
    args?: readonly unknown[]
  ) => Promise<boolean>;
  openDebugView?: () => Promise<boolean>;
  openC64VisualDebugger?: () => Promise<boolean>;
  openMemoryView?: () => Promise<boolean>;
  openOutlineView?: () => Promise<boolean>;
  prepareC64VisualDebuggerDemoState?: () => Promise<boolean>;
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
  showC64VisualDebuggerView?: (view: string) => Promise<boolean>;
  startLaunchConfiguration?: (
    name: string,
    configuration?: DebugConfiguration,
    workspaceFolderUri?: string
  ) => Promise<boolean>;
  showMnemonicHover?: () => Promise<boolean>;
  showReferences?: () => Promise<boolean>;
  waitForDebugStopped?: (
    reason?: string,
    timeoutMs?: number
  ) => Promise<boolean>;
  waitForC64BasicReady?: (timeoutMs?: number) => Promise<boolean>;
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
      continueDebugSession: async (reason) =>
        this.continueDebugSessionForScreenCapture(reason),
      executeCommand: async (commandId, args) =>
        this.executeCommandForScreenCapture(commandId, args),
      openDebugView: async () => this.openWidgetForScreenCapture(
        DebugWidget.ID,
        'left',
        420,
        400
      ),
      openC64VisualDebugger: async () =>
        this.openC64VisualDebuggerForScreenCapture(),
      openMemoryView: async () => this.openWidgetForScreenCapture(
        VICE_MEMORY_WIDGET_ID,
        'bottom',
        320,
        230
      ),
      openOutlineView: async () => this.openOutlineViewForScreenCapture(),
      prepareC64VisualDebuggerDemoState: async () =>
        this.prepareC64VisualDebuggerDemoStateForScreenCapture(),
      openSourceFile: async (filePath) =>
        this.openSourceFileForScreenCapture(filePath),
      revealMemoryTextColumn: async () =>
        this.revealMemoryTextColumnForScreenCapture(),
      showC64VisualDebuggerView: async (view) =>
        this.showC64VisualDebuggerViewForScreenCapture(view),
      showScreenMemory: async () => this.showScreenMemoryForScreenCapture(),
      startLaunchConfiguration: async (name, configuration, workspaceFolderUri) =>
        this.startLaunchConfigurationForScreenCapture(
          name,
          configuration,
          workspaceFolderUri
        ),
      waitForC64BasicReady: async (timeoutMs) =>
        this.waitForC64BasicReadyForScreenCapture(timeoutMs),
      waitForDebugStopped: async (reason, timeoutMs) =>
        this.waitForDebugStoppedForScreenCapture(reason, timeoutMs)
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

  protected async continueDebugSessionForScreenCapture(
    reason?: string
  ): Promise<boolean> {
    const thread = this.debugSessionManager.currentThread;
    if (!thread) {
      return false;
    }
    if (this.debugSessionManager.state !== DebugState.Stopped) {
      return true;
    }
    if (reason && thread.stoppedDetails?.reason !== reason) {
      return true;
    }
    await thread.continue();
    return true;
  }

  protected async waitForDebugStoppedForScreenCapture(
    reason: string | undefined,
    timeoutMs = 10000
  ): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() <= deadline) {
      const thread = this.debugSessionManager.currentThread;
      if (
        thread &&
        this.debugSessionManager.state === DebugState.Stopped &&
        (!reason || thread.stoppedDetails?.reason === reason)
      ) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return false;
  }

  protected async waitForC64BasicReadyForScreenCapture(
    timeoutMs = 10000
  ): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() <= deadline) {
      const session = this.debugSessionManager.currentSession;
      const thread = this.debugSessionManager.currentThread;
      if (
        session?.configuration.type === 'commodore-vice' &&
        thread &&
        this.debugSessionManager.state === DebugState.Stopped
      ) {
        if (await this.isC64BasicReadyScreenForScreenCapture(session)) {
          return true;
        }
        await thread.continue();
      }
      await sleep(100);
    }
    return false;
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

  protected async openC64VisualDebuggerForScreenCapture(): Promise<boolean> {
    return this.openWidgetForScreenCapture(
      C64_VISUAL_DEBUGGER_WIDGET_ID,
      'right',
      640,
      240
    );
  }

  protected async showC64VisualDebuggerViewForScreenCapture(
    view: string
  ): Promise<boolean> {
    await this.openC64VisualDebuggerForScreenCapture();
    const widget = await this.widgetManager.getOrCreateWidget<C64VisualDebuggerWidget>(
      C64_VISUAL_DEBUGGER_WIDGET_ID
    );
    return widget.showViewForScreenCapture(view);
  }

  protected async isC64BasicReadyScreenForScreenCapture(
    session: DebugSession
  ): Promise<boolean> {
    const response = await session.sendRequest(
      'readMemory',
      {
        count: 1000,
        memoryReference: '0x0400'
      },
      5000
    );
    const data = response.body?.data;
    if (!data) {
      return false;
    }
    const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
    return includesSequence(bytes, C64_BASIC_READY_SCREEN_COMMODORE) &&
      includesSequence(bytes, C64_BASIC_READY_SCREEN_READY);
  }

  protected async prepareC64VisualDebuggerDemoStateForScreenCapture(): Promise<boolean> {
    const session = this.debugSessionManager.currentSession;
    if (
      session?.configuration.type !== 'commodore-vice' ||
      this.debugSessionManager.state !== DebugState.Stopped
    ) {
      return false;
    }

    await this.writeC64MemoryForScreenCapture(
      session,
      0x2000,
      SCREEN_CAPTURE_SPRITE_BITMAP
    );
    await this.writeC64MemoryForScreenCapture(session, 0x07f8, [0x80]);
    await this.writeC64MemoryForScreenCapture(session, 0xd000, [80, 100]);
    await this.writeC64MemoryForScreenCapture(session, 0xd010, [0x00]);
    await this.writeC64MemoryForScreenCapture(session, 0xd015, [0x01]);
    await this.writeC64MemoryForScreenCapture(session, 0xd017, [0x00]);
    await this.writeC64MemoryForScreenCapture(session, 0xd01c, [0x00]);
    await this.writeC64MemoryForScreenCapture(session, 0xd01d, [0x00]);
    await this.writeC64MemoryForScreenCapture(session, 0xd027, [0x02]);
    return true;
  }

  protected async writeC64MemoryForScreenCapture(
    session: DebugSession,
    address: number,
    bytes: readonly number[]
  ): Promise<void> {
    await session.sendRequest(
      'writeMemory',
      {
        data: bytesToBase64(bytes),
        memoryReference: `0x${address.toString(16).toUpperCase().padStart(4, '0')}`
      },
      5000
    );
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function includesSequence(
  bytes: Uint8Array,
  sequence: readonly number[]
): boolean {
  for (let index = 0; index <= bytes.length - sequence.length; index += 1) {
    if (sequence.every((value, offset) => bytes[index + offset] === value)) {
      return true;
    }
  }
  return false;
}

function bytesToBase64(bytes: readonly number[]): string {
  return btoa(String.fromCharCode(...bytes.map((byte) => byte & 0xff)));
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

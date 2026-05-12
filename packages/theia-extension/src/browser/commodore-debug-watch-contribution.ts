import type { DebugProtocol } from '@vscode/debugprotocol';
import {
  FrontendApplicationContribution,
  QuickInputService,
  StorageService
} from '@theia/core/lib/browser';
import {
  Command,
  CommandContribution,
  CommandRegistry,
  DisposableCollection,
  MenuContribution,
  MenuModelRegistry,
  type QuickPickValue
} from '@theia/core/lib/common';
import { MessageService } from '@theia/core/lib/common/message-service';
import { EditorContextMenu } from '@theia/editor/lib/browser';
import { EditorManager } from '@theia/editor/lib/browser';
import {
  DebugMenus
} from '@theia/debug/lib/browser/debug-frontend-application-contribution';
import {
  DebugSession,
  DebugState
} from '@theia/debug/lib/browser/debug-session';
import { DebugSessionManager } from '@theia/debug/lib/browser/debug-session-manager';
import { DebugWatchManager } from '@theia/debug/lib/browser/debug-watch-manager';
import { MonacoEditor } from '@theia/monaco/lib/browser/monaco-editor';
import { inject, injectable } from '@theia/core/shared/inversify';

import { COMMODORE_VICE_DEBUG_TYPE } from '../common/commodore-vice-debug';

const STORAGE_KEY = 'commodore-commander.debug.watchpoints';
const DATA_BREAKPOINT_TIMEOUT_MS = 5000;

type WatchpointAccessType = NonNullable<DebugProtocol.DataBreakpoint['accessType']>;

interface PersistedDebugWatchpoints {
  watchpoints: ViceDebugWatchpoint[];
}

interface ViceDebugWatchpoint {
  expression: string;
  bytes: number;
  accessType: WatchpointAccessType;
  condition?: string;
  hitCondition?: string;
  enabled: boolean;
}

export namespace CommodoreDebugWatchCommands {
  export const ADD_WATCH: Command = {
    id: 'commodoreCommander.debug.addWatch',
    category: 'Commodore Commander',
    label: 'Add Expression to Watch',
    iconClass: 'codicon codicon-eye'
  };
  export const ADD_WATCHPOINT: Command = {
    id: 'commodoreCommander.debug.addWatchpoint',
    category: 'Commodore Commander',
    label: 'Add Memory Watchpoint',
    iconClass: 'codicon codicon-debug-breakpoint-data'
  };
  export const MANAGE_WATCHPOINTS: Command = {
    id: 'commodoreCommander.debug.manageWatchpoints',
    category: 'Commodore Commander',
    label: 'Manage Memory Watchpoints',
    iconClass: 'codicon codicon-list-selection'
  };
  export const CLEAR_WATCHPOINTS: Command = {
    id: 'commodoreCommander.debug.clearWatchpoints',
    category: 'Commodore Commander',
    label: 'Clear Memory Watchpoints',
    iconClass: 'codicon codicon-close-all'
  };
}

@injectable()
export class CommodoreDebugWatchContribution
  implements CommandContribution, FrontendApplicationContribution, MenuContribution
{
  @inject(DebugSessionManager)
  protected readonly debugSessionManager!: DebugSessionManager;

  @inject(DebugWatchManager)
  protected readonly debugWatchManager!: DebugWatchManager;

  @inject(EditorManager)
  protected readonly editorManager!: EditorManager;

  @inject(MessageService)
  protected readonly messageService!: MessageService;

  @inject(QuickInputService)
  protected readonly quickInputService!: QuickInputService;

  @inject(StorageService)
  protected readonly storageService!: StorageService;

  protected readonly toDispose = new DisposableCollection();
  protected watchpoints: ViceDebugWatchpoint[] = [];
  protected loaded = false;

  async onStart(): Promise<void> {
    await this.loadWatchpoints();
    this.toDispose.push(
      this.debugSessionManager.onDidStartDebugSession((session) => {
        void this.applyWatchpoints(session, false);
      })
    );
  }

  onStop(): void {
    this.toDispose.dispose();
    if (this.loaded) {
      void this.saveWatchpoints();
    }
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(CommodoreDebugWatchCommands.ADD_WATCH, {
      execute: () => this.addWatchExpression(),
      isEnabled: () => true,
      isVisible: () => true
    });
    commands.registerCommand(CommodoreDebugWatchCommands.ADD_WATCHPOINT, {
      execute: () => this.addWatchpoint(),
      isEnabled: () => true,
      isVisible: () => true
    });
    commands.registerCommand(CommodoreDebugWatchCommands.MANAGE_WATCHPOINTS, {
      execute: () => this.manageWatchpoints(),
      isEnabled: () => true,
      isVisible: () => true
    });
    commands.registerCommand(CommodoreDebugWatchCommands.CLEAR_WATCHPOINTS, {
      execute: () => this.clearWatchpoints(),
      isEnabled: () => this.watchpoints.length > 0,
      isVisible: () => true
    });
  }

  registerMenus(menus: MenuModelRegistry): void {
    menus.registerMenuAction(DebugMenus.DEBUG_NEW_BREAKPOINT, {
      commandId: CommodoreDebugWatchCommands.ADD_WATCHPOINT.id,
      label: CommodoreDebugWatchCommands.ADD_WATCHPOINT.label,
      icon: CommodoreDebugWatchCommands.ADD_WATCHPOINT.iconClass,
      order: '4_cc_watchpoint'
    });
    menus.registerMenuAction(DebugMenus.DEBUG_BREAKPOINTS, {
      commandId: CommodoreDebugWatchCommands.MANAGE_WATCHPOINTS.id,
      label: CommodoreDebugWatchCommands.MANAGE_WATCHPOINTS.label,
      icon: CommodoreDebugWatchCommands.MANAGE_WATCHPOINTS.iconClass,
      order: '8_cc_manage_watchpoints'
    });
    menus.registerMenuAction(DebugMenus.DEBUG_BREAKPOINTS, {
      commandId: CommodoreDebugWatchCommands.CLEAR_WATCHPOINTS.id,
      label: CommodoreDebugWatchCommands.CLEAR_WATCHPOINTS.label,
      icon: CommodoreDebugWatchCommands.CLEAR_WATCHPOINTS.iconClass,
      order: '9_cc_clear_watchpoints'
    });
    menus.registerMenuAction(EditorContextMenu.COMMANDS, {
      commandId: CommodoreDebugWatchCommands.ADD_WATCH.id,
      label: CommodoreDebugWatchCommands.ADD_WATCH.label,
      icon: CommodoreDebugWatchCommands.ADD_WATCH.iconClass,
      order: '2_cc_add_watch'
    });
    menus.registerMenuAction(EditorContextMenu.COMMANDS, {
      commandId: CommodoreDebugWatchCommands.ADD_WATCHPOINT.id,
      label: CommodoreDebugWatchCommands.ADD_WATCHPOINT.label,
      icon: CommodoreDebugWatchCommands.ADD_WATCHPOINT.iconClass,
      order: '2_cc_add_watchpoint'
    });
  }

  protected async addWatchExpression(): Promise<void> {
    const expression = await this.promptExpression(
      'Add watch expression',
      this.currentEditorExpression()
    );
    if (!expression) {
      return;
    }
    this.debugWatchManager.addWatchExpression(expression);
    this.debugSessionManager.open('auto');
  }

  protected async addWatchpoint(): Promise<void> {
    await this.loadWatchpoints();
    const watchpoint = await this.promptWatchpoint();
    if (!watchpoint) {
      return;
    }

    if (this.hasWatchpoint(watchpoint)) {
      this.messageService.info(`Memory watchpoint already exists for ${watchpoint.expression}.`);
      return;
    }

    this.watchpoints.push(watchpoint);
    await this.saveWatchpoints();
    const applied = await this.applyWatchpoints(this.currentViceSession(), true);
    if (!applied) {
      this.messageService.info(
        `Memory watchpoint for ${watchpoint.expression} will be installed in the next VICE debug session.`
      );
    }
  }

  protected async manageWatchpoints(): Promise<void> {
    await this.loadWatchpoints();
    type ManagerAction =
      | { type: 'add' }
      | { type: 'apply' }
      | { type: 'clear' }
      | { type: 'select'; index: number };

    const picks: QuickPickValue<ManagerAction>[] = [
      {
        label: '$(plus) Add Memory Watchpoint...',
        description: 'Create a new VICE data breakpoint',
        value: { type: 'add' }
      },
      ...this.watchpoints.map((watchpoint, index): QuickPickValue<ManagerAction> => ({
        label: `${watchpoint.enabled ? '$(debug-breakpoint-data)' : '$(circle-slash)'} ${watchpoint.expression}`,
        description: formatWatchpointDescription(watchpoint),
        detail: formatWatchpointDetail(watchpoint),
        value: { type: 'select', index }
      })),
      {
        label: '$(sync) Install Watchpoints Now',
        description: 'Reinstall enabled watchpoints in the active VICE session',
        value: { type: 'apply' }
      },
      {
        label: '$(close-all) Clear Memory Watchpoints',
        description: 'Delete all saved memory watchpoints',
        value: { type: 'clear' }
      }
    ];

    const action = (await this.quickInputService.pick(picks, {
      placeHolder: 'Manage memory watchpoints'
    }))?.value;
    if (!action) {
      return;
    }

    switch (action.type) {
      case 'add':
        await this.addWatchpoint();
        break;
      case 'apply':
        await this.applyWatchpoints(this.currentViceSession(), true);
        break;
      case 'clear':
        await this.clearWatchpoints();
        break;
      case 'select':
        await this.manageWatchpoint(action.index);
        break;
    }
  }

  protected async manageWatchpoint(index: number): Promise<void> {
    const watchpoint = this.watchpoints[index];
    if (!watchpoint) {
      return;
    }
    type WatchpointAction = 'toggle' | 'edit' | 'delete';
    const toggleLabel = watchpoint.enabled ? 'Disable' : 'Enable';
    const action = (await this.quickInputService.pick<QuickPickValue<WatchpointAction>>([
      {
        label: `$(${watchpoint.enabled ? 'circle-slash' : 'check'}) ${toggleLabel}`,
        description: `${toggleLabel} ${watchpoint.expression}`,
        value: 'toggle'
      },
      {
        label: '$(edit) Edit',
        description: 'Change expression, bytes, access, condition, or hit condition',
        value: 'edit'
      },
      {
        label: '$(trash) Delete',
        description: `Remove ${watchpoint.expression}`,
        value: 'delete'
      }
    ], {
      placeHolder: `${watchpoint.expression} - ${formatWatchpointDescription(watchpoint)}`
    }))?.value;

    if (!action) {
      return;
    }
    switch (action) {
      case 'toggle':
        this.watchpoints[index] = {
          ...watchpoint,
          enabled: !watchpoint.enabled
        };
        await this.saveWatchpoints();
        await this.applyWatchpoints(this.currentViceSession(), true);
        break;
      case 'edit':
        await this.editWatchpoint(index);
        break;
      case 'delete':
        this.watchpoints.splice(index, 1);
        await this.saveWatchpoints();
        await this.applyWatchpoints(this.currentViceSession(), true);
        break;
    }
  }

  protected async editWatchpoint(index: number): Promise<void> {
    const existing = this.watchpoints[index];
    if (!existing) {
      return;
    }
    const edited = await this.promptWatchpoint(existing);
    if (!edited) {
      return;
    }
    if (this.hasWatchpoint(edited, index)) {
      this.messageService.info(`Memory watchpoint already exists for ${edited.expression}.`);
      return;
    }
    this.watchpoints[index] = edited;
    await this.saveWatchpoints();
    await this.applyWatchpoints(this.currentViceSession(), true);
  }

  protected async clearWatchpoints(): Promise<void> {
    await this.loadWatchpoints();
    if (this.watchpoints.length === 0) {
      return;
    }
    this.watchpoints = [];
    await this.saveWatchpoints();
    const applied = await this.applyWatchpoints(this.currentViceSession(), true);
    if (!applied) {
      this.messageService.info('Cleared memory watchpoints.');
    }
  }

  protected async applyWatchpoints(
    session: DebugSession | undefined,
    report: boolean
  ): Promise<boolean> {
    await this.loadWatchpoints();
    if (!session || !this.isViceDebugSession(session)) {
      return false;
    }
    if (!session.capabilities.supportsDataBreakpoints) {
      if (report) {
        this.messageService.warn('The active debug session does not support memory watchpoints.');
      }
      return false;
    }

    const breakpoints: DebugProtocol.DataBreakpoint[] = [];
    const failures: string[] = [];
    for (const watchpoint of this.watchpoints.filter((candidate) => candidate.enabled)) {
      try {
        const response = await session.sendRequest('dataBreakpointInfo', {
          name: watchpoint.expression,
          variablesReference: 0,
          bytes: watchpoint.bytes
        }, DATA_BREAKPOINT_TIMEOUT_MS);
        const dataId = response.body.dataId;
        if (!dataId) {
          failures.push(`${watchpoint.expression}: ${response.body.description ?? 'not resolved'}`);
          continue;
        }
        const breakpoint: DebugProtocol.DataBreakpoint = {
          dataId,
          accessType: watchpoint.accessType
        };
        if (watchpoint.condition) {
          breakpoint.condition = watchpoint.condition;
        }
        if (watchpoint.hitCondition) {
          breakpoint.hitCondition = watchpoint.hitCondition;
        }
        breakpoints.push(breakpoint);
      } catch (error) {
        failures.push(`${watchpoint.expression}: ${toErrorMessage(error)}`);
      }
    }

    const response = await session.sendRequest('setDataBreakpoints', {
      breakpoints
    }, DATA_BREAKPOINT_TIMEOUT_MS);
    failures.push(
      ...response.body.breakpoints
        .filter((breakpoint) => !breakpoint.verified)
        .map((breakpoint) => breakpoint.message ?? 'Unverified memory watchpoint.')
    );

    if (failures.length > 0 && report) {
      this.messageService.warn(
        `Some memory watchpoints could not be installed: ${failures.join('; ')}`
      );
    } else if (report) {
      this.messageService.info(
        breakpoints.length === 0
          ? 'Cleared memory watchpoints.'
          : `Installed ${breakpoints.length} memory watchpoint${breakpoints.length === 1 ? '' : 's'}.`
      );
    }
    return true;
  }

  protected async loadWatchpoints(): Promise<void> {
    if (this.loaded) {
      return;
    }
    const state = await this.storageService.getData<PersistedDebugWatchpoints>(
      STORAGE_KEY,
      { watchpoints: [] }
    );
    this.watchpoints = sanitizeWatchpoints(state.watchpoints);
    this.loaded = true;
  }

  protected saveWatchpoints(): Promise<void> {
    return this.storageService.setData<PersistedDebugWatchpoints>(STORAGE_KEY, {
      watchpoints: this.watchpoints
    });
  }

  protected hasWatchpoint(watchpoint: ViceDebugWatchpoint, exceptIndex?: number): boolean {
    return this.watchpoints.some((candidate, index) =>
      index !== exceptIndex &&
      candidate.enabled === watchpoint.enabled &&
      candidate.expression === watchpoint.expression &&
      candidate.bytes === watchpoint.bytes &&
      candidate.accessType === watchpoint.accessType &&
      candidate.condition === watchpoint.condition &&
      candidate.hitCondition === watchpoint.hitCondition
    );
  }

  protected async promptWatchpoint(
    existing?: ViceDebugWatchpoint
  ): Promise<ViceDebugWatchpoint | undefined> {
    const expression = await this.promptExpression(
      'Watch memory expression or address',
      existing?.expression ?? this.currentEditorExpression()
    );
    if (!expression) {
      return undefined;
    }

    const bytesInput = await this.quickInputService.input({
      placeHolder: 'Number of bytes to watch',
      value: String(existing?.bytes ?? 1),
      validateInput: async (value) =>
        parseByteCount(value) === undefined
          ? 'Enter a byte count from 1 to 65536.'
          : undefined
    });
    if (bytesInput === undefined) {
      return undefined;
    }
    const bytes = parseByteCount(bytesInput);
    if (bytes === undefined) {
      return undefined;
    }

    const accessType = await this.pickAccessType(existing?.accessType);
    if (!accessType) {
      return undefined;
    }

    const condition = await this.promptOptionalInput(
      'VICE condition expression, empty for none',
      existing?.condition,
      async (value) =>
        conditionByteLength(value) > 0xff
          ? 'VICE checkpoint conditions must be 255 bytes or shorter.'
          : undefined
    );
    if (condition === null) {
      return undefined;
    }

    const hitCondition = await this.promptOptionalInput(
      'Hit condition, empty for none (examples: 5, >= 5, % 10)',
      existing?.hitCondition,
      async (value) =>
        value.trim().length > 0 && !isValidHitConditionInput(value)
          ? 'Use a hit count like 5, == 5, >= 5, or % 10.'
          : undefined
    );
    if (hitCondition === null) {
      return undefined;
    }

    return {
      expression,
      bytes,
      accessType,
      ...(condition ? { condition } : {}),
      ...(hitCondition ? { hitCondition } : {}),
      enabled: existing?.enabled ?? true
    };
  }

  protected async promptExpression(
    placeHolder: string,
    value: string | undefined
  ): Promise<string | undefined> {
    const expression = await this.quickInputService.input({
      placeHolder,
      value: value ?? '',
      validateInput: async (input) =>
        input.trim().length === 0
          ? 'Enter a register, label, or address.'
          : undefined
    });
    const trimmed = expression?.trim();
    return trimmed ? trimmed : undefined;
  }

  protected async promptOptionalInput(
    placeHolder: string,
    value: string | undefined,
    validateInput?: (input: string) => Promise<string | undefined>
  ): Promise<string | undefined | null> {
    const input = await this.quickInputService.input({
      placeHolder,
      value: value ?? '',
      ...(validateInput ? { validateInput } : {})
    });
    if (input === undefined) {
      return null;
    }
    const trimmed = input.trim();
    return trimmed ? trimmed : undefined;
  }

  protected async pickAccessType(
    current: WatchpointAccessType = 'write'
  ): Promise<WatchpointAccessType | undefined> {
    const picks: QuickPickValue<WatchpointAccessType>[] = [
      {
        label: 'Write',
        description: 'Stop when the address is stored',
        value: 'write'
      },
      {
        label: 'Read',
        description: 'Stop when the address is loaded',
        value: 'read'
      },
      {
        label: 'Read / Write',
        description: 'Stop when the address is loaded or stored',
        value: 'readWrite'
      }
    ];
    return (await this.quickInputService.pick(picks, {
      placeHolder: 'Select memory watchpoint access',
      activeItem: picks.find((pick) => pick.value === current) ?? picks[0]
    }))?.value;
  }

  protected currentViceSession(): DebugSession | undefined {
    const session = this.debugSessionManager.currentSession;
    return session && this.isViceDebugSession(session) ? session : undefined;
  }

  protected isViceDebugSession(session: DebugSession): boolean {
    return session.configuration.type === COMMODORE_VICE_DEBUG_TYPE &&
      (session.configuration as { noDebug?: boolean }).noDebug !== true &&
      session.state !== DebugState.Inactive;
  }

  protected currentEditorExpression(): string | undefined {
    const editor = MonacoEditor.get(this.editorManager.currentEditor);
    const model = editor?.getControl().getModel();
    const control = editor?.getControl();
    const selection = control?.getSelection();
    if (!model || !control || !selection) {
      return undefined;
    }

    const selected = model.getValueInRange(selection).trim();
    if (selected) {
      return trimExpression(selected);
    }

    const position = control.getPosition();
    if (!position) {
      return undefined;
    }
    const word = model.getWordAtPosition(position);
    if (!word) {
      return undefined;
    }
    const line = model.getLineContent(position.lineNumber);
    const prefix = line[word.startColumn - 2] === '$' ? '$' : '';
    return trimExpression(`${prefix}${word.word}`);
  }
}

function sanitizeWatchpoints(
  watchpoints: readonly ViceDebugWatchpoint[] | undefined
): ViceDebugWatchpoint[] {
  return (watchpoints ?? [])
    .map((watchpoint) => {
      const bytes = parseByteCount(String(watchpoint.bytes));
      const condition = String(watchpoint.condition ?? '').trim();
      const hitCondition = String(watchpoint.hitCondition ?? '').trim();
      return {
        expression: String(watchpoint.expression ?? '').trim(),
        bytes,
        accessType: watchpoint.accessType,
        ...(condition ? { condition } : {}),
        ...(hitCondition ? { hitCondition } : {}),
        enabled: watchpoint.enabled !== false
      };
    })
    .filter((watchpoint): watchpoint is ViceDebugWatchpoint =>
      watchpoint.expression.length > 0 &&
      watchpoint.bytes !== undefined &&
      (watchpoint.accessType === 'read' ||
        watchpoint.accessType === 'write' ||
        watchpoint.accessType === 'readWrite')
    );
}

function parseByteCount(input: string): number | undefined {
  const value = Number.parseInt(input.trim(), 10);
  return Number.isInteger(value) && value >= 1 && value <= 0x10000
    ? value
    : undefined;
}

function isValidHitConditionInput(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) {
    return true;
  }
  let valueText = trimmed;
  let modulo = false;
  const prefixMatch = /^(==|=|!=|<=|>=|<|>|%)\s*(.+)$/u.exec(trimmed);
  if (prefixMatch) {
    modulo = prefixMatch[1] === '%';
    valueText = prefixMatch[2].trim();
  } else {
    const moduloSuffixMatch = /^(.+?)\s*%$/u.exec(trimmed);
    if (moduloSuffixMatch) {
      modulo = true;
      valueText = moduloSuffixMatch[1].trim();
    }
  }
  const value = parseNumericInput(valueText);
  return value !== undefined && (!modulo || value > 0);
}

function parseNumericInput(input: string): number | undefined {
  const trimmed = input.trim();
  if (/^\$[0-9a-f]+$/iu.test(trimmed)) {
    return Number.parseInt(trimmed.slice(1), 16);
  }
  if (/^0x[0-9a-f]+$/iu.test(trimmed)) {
    return Number.parseInt(trimmed.slice(2), 16);
  }
  if (/^[0-9]+$/u.test(trimmed)) {
    return Number.parseInt(trimmed, 10);
  }
  return undefined;
}

function conditionByteLength(input: string): number {
  const normalized = input.trim().replace(/^if\b\s*/iu, '').trim();
  return new TextEncoder().encode(normalized).length;
}

function formatWatchpointDescription(watchpoint: ViceDebugWatchpoint): string {
  return [
    watchpoint.enabled ? 'enabled' : 'disabled',
    accessTypeLabel(watchpoint.accessType),
    `${watchpoint.bytes} byte${watchpoint.bytes === 1 ? '' : 's'}`
  ].join(', ');
}

function formatWatchpointDetail(watchpoint: ViceDebugWatchpoint): string | undefined {
  const details = [
    watchpoint.condition ? `if ${watchpoint.condition}` : undefined,
    watchpoint.hitCondition ? `hit ${watchpoint.hitCondition}` : undefined
  ].filter((detail): detail is string => Boolean(detail));
  return details.length > 0 ? details.join(' | ') : undefined;
}

function accessTypeLabel(accessType: WatchpointAccessType): string {
  switch (accessType) {
    case 'read':
      return 'read';
    case 'write':
      return 'write';
    case 'readWrite':
      return 'read/write';
  }
}

function trimExpression(value: string): string {
  return value
    .replace(/^[,;:\s]+/u, '')
    .replace(/[,;:\s]+$/u, '')
    .trim();
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

import * as React from 'react';

import { codicon, ReactWidget } from '@theia/core/lib/browser';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import {
  CommandRegistry,
  DisposableCollection
} from '@theia/core/lib/common';
import {
  PreferenceService
} from '@theia/core/lib/common/preferences';
import {
  DebugSession
} from '@theia/debug/lib/browser/debug-session';
import {
  DebugSessionManager,
  type DebugSessionCustomEvent
} from '@theia/debug/lib/browser/debug-session-manager';
import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';

import { COMMODORE_VICE_DEBUG_TYPE } from '../common/commodore-vice-debug';
import {
  COMMODORE_VICE_EMBED_DEBUG_EVENT,
  COMMODORE_VICE_EMBED_PROTOCOL,
  CommodoreViceEmbedService,
  type CommodoreViceEmbedClient,
  type CommodoreViceEmbedDebugEvent,
  type CommodoreViceEmbedFrameEvent,
  type CommodoreViceEmbedKeyEvent,
  type CommodoreViceEmbedOutputEvent,
  type CommodoreViceEmbedProtocolEvent,
  type CommodoreViceEmbedService as CommodoreViceEmbedServiceProxy,
  type CommodoreViceEmbedStatusEvent,
  type CommodoreViceEmbedStatusState
} from '../common/commodore-vice-embed-service';
import {
  COMMODORE_MACHINE_PROFILE_PREFERENCE,
  COMMODORE_MACHINE_PROFILE_WIDGET_ID,
  CommodoreMachineProfileCommands,
  CommodoreMachineProfileSelectionService
} from './commodore-machine-profile-selection';

type ViceRuntimeOwner = 'debug' | 'standalone';

@injectable()
export class CommodoreMachineProfileWidget
  extends ReactWidget
  implements CommodoreViceEmbedClient {
  @inject(CommodoreMachineProfileSelectionService)
  protected readonly machineProfileSelection!: CommodoreMachineProfileSelectionService;

  @inject(CommodoreViceEmbedService)
  protected readonly viceEmbedService!: CommodoreViceEmbedServiceProxy;

  @inject(PreferenceService)
  protected readonly preferenceService!: PreferenceService;

  @inject(DebugSessionManager)
  protected readonly debugSessionManager!: DebugSessionManager;

  @inject(CommandRegistry)
  protected readonly commands!: CommandRegistry;

  protected readonly toDispose = new DisposableCollection();
  protected canvas: HTMLCanvasElement | undefined;
  protected frame: CommodoreViceEmbedFrameEvent | undefined;
  protected status: CommodoreViceEmbedStatusState = 'idle';
  protected statusMessage = 'Off';
  protected lastOutput = '';
  protected starting = false;
  protected runtimeOwner: ViceRuntimeOwner | undefined;
  protected activeDebugSessionId: string | undefined;

  @postConstruct()
  protected init(): void {
    this.id = COMMODORE_MACHINE_PROFILE_WIDGET_ID;
    this.title.label = 'Machine';
    this.title.caption = 'Commodore Machine and VICE';
    this.title.iconClass = codicon('circuit-board');
    this.title.closable = false;
    this.addClass('cc-machine-profile-widget');
    this.viceEmbedService.setClient(this);
    this.toDispose.pushAll([
      this.preferenceService.onPreferenceChanged((event) => {
        if (event.preferenceName === COMMODORE_MACHINE_PROFILE_PREFERENCE) {
          this.handleMachinePreferenceChanged();
        }
      }),
      this.debugSessionManager.onDidStartDebugSession((session) =>
        this.handleDebugSessionStarted(session)
      ),
      this.debugSessionManager.onDidDestroyDebugSession((session) =>
        this.handleDebugSessionDestroyed(session)
      ),
      this.debugSessionManager.onDidReceiveDebugSessionCustomEvent((event) =>
        this.handleDebugSessionCustomEvent(event)
      )
    ]);
    this.update();
  }

  override dispose(): void {
    this.viceEmbedService.setClient(undefined);
    this.toDispose.dispose();
    super.dispose();
  }

  protected override onActivateRequest(msg: Message): void {
    super.onActivateRequest(msg);
    this.canvas?.focus();
  }

  onViceEmbedFrame(event: CommodoreViceEmbedFrameEvent): void {
    this.runtimeOwner = 'standalone';
    this.frame = event;
    this.drawFrame();
    this.update();
  }

  onViceEmbedStatus(event: CommodoreViceEmbedStatusEvent): void {
    this.applyStatus(event, 'standalone');
  }

  onViceEmbedOutput(event: CommodoreViceEmbedOutputEvent): void {
    this.applyOutput(event);
  }

  protected override onAfterAttach(msg: Message): void {
    super.onAfterAttach(msg);
    this.drawFrame();
  }

  protected render(): React.ReactNode {
    const machine = this.machineProfileSelection.getActiveMachineConfiguration();
    const profile = this.machineProfileSelection.getActiveMachineProfile();
    const screen = profile.screenLayouts[0];
    const isPowered = this.isPowered();
    const aspectRatio = this.frame
      ? `${this.frame.width} / ${this.frame.height}`
      : screen
        ? `${screen.columns * screen.characterCell.width} / ${screen.rows * screen.characterCell.height}`
        : '4 / 3';

    return (
      <div
        className='cc-machine-profile'
        style={styles.container}
      >
        <div style={styles.header}>
          <div style={styles.heading}>
            <div style={styles.eyebrow}>Active Machine</div>
            <div style={styles.machineName}>{profile.displayName}</div>
            <div
              style={styles.status}
              title={this.lastOutput || this.statusMessage}
            >
              {this.statusMessage}
            </div>
          </div>
          <div style={styles.controls}>
            <button
              className='theia-button secondary'
              title='Select active machine'
              onClick={this.selectMachine}
              style={styles.iconButton}
            >
              <span className={codicon('circuit-board')} />
            </button>
            <button
              className={`theia-button ${isPowered ? 'secondary' : 'main'}`}
              title={isPowered ? 'Turn active machine off' : 'Turn active machine on'}
              disabled={this.starting}
              onClick={this.togglePower}
              style={styles.button}
            >
              <span className={codicon(isPowered ? 'debug-stop' : 'debug-start')} />
              {isPowered ? 'OFF' : 'ON'}
            </button>
            <button
              className='theia-button secondary'
              title='Reset active machine'
              disabled={!isPowered || this.starting}
              onClick={this.resetMachine}
              style={styles.button}
            >
              <span className={codicon('debug-restart')} />
              RESET
            </button>
          </div>
        </div>

        <dl style={styles.facts}>
          {this.renderFact('CPU', profile.cpu.primary)}
          {this.renderFact('VICE', profile.vice.executable)}
          {machine.model ? this.renderFact('Model', machine.model) : undefined}
          {machine.viceArgs && machine.viceArgs.length > 0
            ? this.renderFact('Args', machine.viceArgs.join(' '))
            : undefined}
          {screen
            ? this.renderFact('Screen', `${screen.columns}x${screen.rows}`)
            : undefined}
        </dl>

        <div
          className='cc-machine-vice-screen'
          style={styles.screen}
          onMouseDown={this.focusCanvas}
        >
          <div
            style={{
              ...styles.viewport,
              aspectRatio
            }}
          >
            <canvas
              ref={this.setCanvasRef}
              tabIndex={0}
              role='application'
              aria-label='Embedded VICE'
              onKeyDown={this.handleKeyDown}
              onKeyUp={this.handleKeyUp}
              style={styles.canvas}
            />
            {!this.frame && (
              <div style={styles.emptyState}>
                {this.status === 'error' ? this.statusMessage : profile.family}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  protected renderFact(label: string, value: string): React.ReactNode {
    return (
      <React.Fragment key={label}>
        <dt style={styles.factLabel}>{label}</dt>
        <dd style={styles.factValue}>{value}</dd>
      </React.Fragment>
    );
  }

  protected readonly selectMachine = async (): Promise<void> => {
    await this.commands.executeCommand(
      CommodoreMachineProfileCommands.SELECT_MACHINE_PROFILE.id
    );
  };

  protected readonly togglePower = async (): Promise<void> => {
    if (this.isPowered()) {
      await this.powerOff();
      return;
    }
    await this.powerOnStandalone();
  };

  protected async powerOnStandalone(): Promise<void> {
    this.starting = true;
    this.runtimeOwner = 'standalone';
    this.status = 'starting';
    this.statusMessage = 'Starting patched VICE.';
    this.frame = undefined;
    this.update();
    try {
      await this.viceEmbedService.launch({
        machine: this.machineProfileSelection.getActiveMachineConfiguration()
      });
    } catch (error) {
      this.applyStatus({
        state: 'error',
        message: error instanceof Error ? error.message : String(error)
      }, 'standalone');
    }
  }

  protected async powerOff(): Promise<void> {
    const session = this.currentEmbeddedViceDebugSession();
    if (session && this.runtimeOwner !== 'standalone') {
      await this.debugSessionManager.terminateSession(session);
      return;
    }

    await this.viceEmbedService.stop();
    this.runtimeOwner = undefined;
    this.activeDebugSessionId = undefined;
    this.frame = undefined;
    this.applyStatus({ state: 'stopped', message: 'Off' }, 'standalone');
  }

  protected readonly resetMachine = async (): Promise<void> => {
    const session = this.currentEmbeddedViceDebugSession();
    if (session && this.runtimeOwner === 'debug') {
      await session.sendCustomRequest('commodoreViceEmbedReset');
      return;
    }
    await this.viceEmbedService.reset();
  };

  protected handleMachinePreferenceChanged(): void {
    if (this.runtimeOwner === 'standalone' && this.isPowered()) {
      void this.powerOnStandalone();
      return;
    }
    this.update();
  }

  protected handleDebugSessionStarted(session: DebugSession): void {
    if (!this.isEmbeddedViceDebugSession(session)) {
      return;
    }
    this.runtimeOwner = 'debug';
    this.activeDebugSessionId = session.id;
    this.starting = true;
    this.status = 'starting';
    this.statusMessage = 'Starting debug VICE.';
    this.frame = undefined;
    this.update();
  }

  protected handleDebugSessionDestroyed(session: DebugSession): void {
    if (session.id !== this.activeDebugSessionId) {
      return;
    }
    this.runtimeOwner = undefined;
    this.activeDebugSessionId = undefined;
    this.starting = false;
    this.frame = undefined;
    this.applyStatus({ state: 'stopped', message: 'Off' }, 'debug');
  }

  protected handleDebugSessionCustomEvent(
    event: DebugSessionCustomEvent
  ): void {
    if (
      event.event !== COMMODORE_VICE_EMBED_DEBUG_EVENT ||
      !this.isEmbeddedViceDebugSession(event.session) ||
      !isViceEmbedDebugEvent(event.body)
    ) {
      return;
    }

    this.runtimeOwner = 'debug';
    this.activeDebugSessionId = event.session.id;
    if (event.body.type === 'output') {
      this.applyOutput(event.body);
      return;
    }
    this.handleProtocolEvent(event.body);
  }

  protected handleProtocolEvent(event: CommodoreViceEmbedProtocolEvent): void {
    switch (event.type) {
      case 'hello':
        this.applyStatus({
          state: 'running',
          message: event.machine
            ? `Patched VICE ready (${event.machine}).`
            : 'Patched VICE ready.'
        }, this.runtimeOwner);
        return;
      case 'frame':
        this.frame = event;
        this.drawFrame();
        this.update();
        return;
      case 'status':
        this.applyStatus(event, this.runtimeOwner);
        return;
    }
  }

  protected applyStatus(
    event: CommodoreViceEmbedStatusEvent,
    owner: ViceRuntimeOwner | undefined
  ): void {
    this.runtimeOwner = event.state === 'running' || event.state === 'starting'
      ? owner ?? this.runtimeOwner
      : event.state === 'stopped' || event.state === 'error'
        ? undefined
        : this.runtimeOwner;
    this.status = event.state;
    this.statusMessage = event.message ?? (event.state === 'idle' ? 'Off' : event.state);
    this.starting = event.state === 'starting';
    if (event.state === 'stopped' || event.state === 'error') {
      this.activeDebugSessionId = undefined;
    }
    this.update();
  }

  protected applyOutput(event: CommodoreViceEmbedOutputEvent): void {
    const text = event.text.trim();
    if (text) {
      this.lastOutput = `${event.stream}: ${text.slice(0, 200)}`;
      this.update();
    }
  }

  protected readonly setCanvasRef = (canvas: HTMLCanvasElement | null): void => {
    this.canvas = canvas ?? undefined;
    this.drawFrame();
  };

  protected readonly focusCanvas = (): void => {
    this.canvas?.focus();
  };

  protected readonly handleKeyDown = (event: React.KeyboardEvent<HTMLCanvasElement>): void => {
    this.sendKeyEvent(event, true);
  };

  protected readonly handleKeyUp = (event: React.KeyboardEvent<HTMLCanvasElement>): void => {
    this.sendKeyEvent(event, false);
  };

  protected sendKeyEvent(event: React.KeyboardEvent<HTMLCanvasElement>, pressed: boolean): void {
    if (!event.metaKey) {
      event.preventDefault();
      event.stopPropagation();
    }
    const keyEvent: CommodoreViceEmbedKeyEvent = {
      code: event.code,
      key: event.key,
      keyCode: event.keyCode,
      pressed,
      repeat: event.repeat,
      shift: event.shiftKey,
      ctrl: event.ctrlKey,
      alt: event.altKey,
      meta: event.metaKey
    };
    const session = this.currentEmbeddedViceDebugSession();
    if (session && this.runtimeOwner === 'debug') {
      void session.sendCustomRequest('commodoreViceEmbedKey', keyEvent);
      return;
    }
    void this.viceEmbedService.sendKey(keyEvent);
  }

  protected drawFrame(): void {
    const canvas = this.canvas;
    const frame = this.frame;
    if (!canvas || !frame) {
      return;
    }
    const expectedLength = frame.width * frame.height * 4;
    const bytes = decodeBase64(frame.data);
    if (bytes.length !== expectedLength) {
      this.status = 'error';
      this.statusMessage = `Invalid VICE frame size: ${bytes.length}/${expectedLength}.`;
      this.update();
      return;
    }
    canvas.width = frame.width;
    canvas.height = frame.height;
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }
    const imageData = new ImageData(
      new Uint8ClampedArray(bytes),
      frame.width,
      frame.height
    );
    context.putImageData(imageData, 0, 0);
  }

  protected isPowered(): boolean {
    return this.status === 'running' ||
      this.status === 'starting' ||
      Boolean(this.currentEmbeddedViceDebugSession()) ||
      this.runtimeOwner === 'debug' ||
      this.runtimeOwner === 'standalone';
  }

  protected currentViceDebugSession(): DebugSession | undefined {
    const session = this.debugSessionManager.currentSession;
    return session && this.isViceDebugSession(session) ? session : undefined;
  }

  protected currentEmbeddedViceDebugSession(): DebugSession | undefined {
    const session = this.currentViceDebugSession();
    return session && this.isEmbeddedViceDebugSession(session)
      ? session
      : undefined;
  }

  protected isViceDebugSession(session: DebugSession): boolean {
    return session.configuration.type === COMMODORE_VICE_DEBUG_TYPE;
  }

  protected isEmbeddedViceDebugSession(session: DebugSession): boolean {
    return this.isViceDebugSession(session) &&
      session.configuration.viceLaunchMode !== 'externalWindow';
  }
}

function isViceEmbedDebugEvent(
  value: unknown
): value is CommodoreViceEmbedDebugEvent {
  return Boolean(value) &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (value as { protocol?: unknown }).protocol === COMMODORE_VICE_EMBED_PROTOCOL &&
    typeof (value as { type?: unknown }).type === 'string';
}

function decodeBase64(value: string): Uint8Array {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
    overflow: 'hidden',
    color: 'var(--theia-foreground)',
    background: 'var(--theia-editor-background)'
  } satisfies React.CSSProperties,
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    padding: '10px 10px 8px',
    borderBottom: '1px solid var(--theia-panel-border)'
  } satisfies React.CSSProperties,
  heading: {
    minWidth: 0
  } satisfies React.CSSProperties,
  eyebrow: {
    color: 'var(--theia-descriptionForeground)',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase'
  } satisfies React.CSSProperties,
  machineName: {
    fontSize: 16,
    fontWeight: 600,
    lineHeight: 1.25,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  } satisfies React.CSSProperties,
  status: {
    color: 'var(--theia-descriptionForeground)',
    fontSize: 12,
    lineHeight: 1.35,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  } satisfies React.CSSProperties,
  controls: {
    display: 'flex',
    flexShrink: 0,
    gap: 6
  } satisfies React.CSSProperties,
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    minWidth: 58,
    justifyContent: 'center'
  } satisfies React.CSSProperties,
  iconButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    minWidth: 28,
    paddingLeft: 0,
    paddingRight: 0
  } satisfies React.CSSProperties,
  facts: {
    display: 'grid',
    gap: '4px 10px',
    gridTemplateColumns: 'max-content minmax(0, 1fr)',
    margin: 0,
    padding: '8px 10px',
    borderBottom: '1px solid var(--theia-panel-border)'
  } satisfies React.CSSProperties,
  factLabel: {
    color: 'var(--theia-descriptionForeground)',
    fontSize: 12,
    margin: 0
  } satisfies React.CSSProperties,
  factValue: {
    fontSize: 12,
    margin: 0,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  } satisfies React.CSSProperties,
  screen: {
    position: 'relative',
    flex: 1,
    minHeight: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 8,
    background: '#050608'
  } satisfies React.CSSProperties,
  viewport: {
    position: 'relative',
    maxWidth: '100%',
    maxHeight: '100%',
    width: '100%',
    height: 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  } satisfies React.CSSProperties,
  canvas: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    imageRendering: 'pixelated',
    outline: 'none'
  } satisfies React.CSSProperties,
  emptyState: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--theia-disabledForeground)',
    fontSize: 18,
    letterSpacing: 0
  } satisfies React.CSSProperties
};

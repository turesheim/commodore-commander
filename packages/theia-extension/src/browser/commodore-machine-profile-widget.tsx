import * as React from 'react';

import { codicon, ReactWidget } from '@theia/core/lib/browser';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import {
  Disposable,
  DisposableCollection
} from '@theia/core/lib/common/disposable';
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

import {
  COMMODORE_MACHINE_PROFILES,
  type CommodoreMachineProfile,
  type CommodoreMachineProfileId
} from '@commodore-commander/language-support/runtime';
import { COMMODORE_VICE_DEBUG_TYPE } from '../common/commodore-vice-debug';
import {
  COMMODORE_VICE_EMBED_DEBUG_EVENT,
  COMMODORE_VICE_EMBED_PROTOCOL,
  CommodoreViceEmbedService,
  type CommodoreViceEmbedClient,
  type CommodoreViceEmbedDebugEvent,
  type CommodoreViceEmbedFrameEvent,
  type CommodoreViceEmbedKeyEvent,
  type CommodoreViceEmbedMouseEvent,
  type CommodoreViceEmbedOutputEvent,
  type CommodoreViceEmbedProtocolEvent,
  type CommodoreViceEmbedService as CommodoreViceEmbedServiceProxy,
  type CommodoreViceEmbedStatusEvent,
  type CommodoreViceEmbedStatusState
} from '../common/commodore-vice-embed-service';
import {
  createViceEmbedFrameSocket,
  type ViceEmbedBinaryFrame
} from './vice-embed-frame-stream';
import {
  calculateViceCanvasDisplaySize,
  type ViceCanvasDisplaySize
} from './vice-canvas-scaling';
import {
  createViceEmbedKeyEvent,
  isViceEmbedCommodoreFunctionKeyEvent,
  ViceEmbedKeyEventTracker
} from './vice-keyboard-mapping';
import {
  DEFAULT_COMMODORE_EMULATOR_VICE_MENU_SHORTCUT,
  DEFAULT_COMMODORE_EMULATOR_VIRTUAL_KEYBOARD_SHORTCUT,
  COMMODORE_EMULATOR_VICE_MENU_SHORTCUT_PREFERENCE,
  COMMODORE_EMULATOR_VIRTUAL_KEYBOARD_SHORTCUT_PREFERENCE,
  matchesCommodoreEmulatorShortcut,
  resolveCommodoreEmulatorShortcutLabel
} from './commodore-emulator-shortcuts';
import {
  COMMODORE_MACHINE_PROFILE_PREFERENCE,
  COMMODORE_MACHINE_PROFILE_WIDGET_ID,
  CommodoreMachineProfileSelectionService
} from './commodore-machine-profile-selection';
import {
  createCommodoreVirtualKeyboardKeyEvent,
  createCommodoreVirtualKeyboardModifierKeyEvent,
  getCommodoreVirtualKeyboardLayout,
  isCommodoreVirtualKeyboardModifierKey,
  isCommodoreVirtualKeyboardShiftKey,
  resolveCommodoreVirtualKeyboardKey,
  type CommodoreVirtualKeyboardGlyph,
  type CommodoreVirtualKeyboardKey,
  type CommodoreVirtualKeyboardModifier
} from './commodore-virtual-keyboard-layout';
import { CommodorePetsciiGlyphIcon } from './commodore-petscii-glyph';

type ViceRuntimeOwner = 'debug' | 'standalone';
type ViceEmbedRenderableFrame = CommodoreViceEmbedFrameEvent | ViceEmbedBinaryFrame;
type ViceEmbedFrameBytes =
  | Uint8Array<ArrayBufferLike>
  | Uint8ClampedArray<ArrayBufferLike>;

interface ActiveVirtualKeyboardKey {
  readonly keyId: string;
  readonly modifier?: CommodoreVirtualKeyboardModifier;
}

interface PressedVirtualMouseKey {
  readonly keyEvent: CommodoreViceEmbedKeyEvent;
  readonly modifierKeyEvent?: CommodoreViceEmbedKeyEvent;
  readonly consumedModifierLatch?: CommodoreVirtualKeyboardModifier;
}

interface VirtualKeyboardKeyRenderState {
  readonly active: boolean;
  readonly modifierActive: boolean;
  readonly displayModifier?: CommodoreVirtualKeyboardModifier;
}

interface VirtualKeyboardPanelPosition {
  readonly left: number;
  readonly top: number;
}

interface VirtualKeyboardDragState {
  readonly pointerOffsetX: number;
  readonly pointerOffsetY: number;
  readonly panelWidth: number;
  readonly panelHeight: number;
}

const MOUSE_CAPTURE_MAX_RELATIVE_DELTA = 63;
const MOUSE_CAPTURE_MIN_RELATIVE_DELTA = 2;
const MOUSE_CAPTURE_JITTER_HOLD_MS = 120;
const VICE_MENU_HINT_HEIGHT = 20;

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

  protected readonly toDispose = new DisposableCollection();
  protected screenElement: HTMLDivElement | undefined;
  protected resizeObserver: ResizeObserver | undefined;
  protected canvas: HTMLCanvasElement | undefined;
  protected virtualKeyboardOverlayElement: HTMLDivElement | undefined;
  protected virtualKeyboardPanelElement: HTMLDivElement | undefined;
  protected frame: ViceEmbedRenderableFrame | undefined;
  protected canvasDisplaySize: ViceCanvasDisplaySize | undefined;
  protected frameSocket: WebSocket | undefined;
  protected status: CommodoreViceEmbedStatusState = 'idle';
  protected statusMessage = 'Off';
  protected lastOutput = '';
  protected starting = false;
  protected runtimeOwner: ViceRuntimeOwner | undefined;
  protected activeDebugSessionId: string | undefined;
  protected frameRate: number | undefined;
  protected frameRateSampleStarted = 0;
  protected frameRateSampleFrames = 0;
  protected mouseCaptured = false;
  protected pendingMouseXRel = 0;
  protected pendingMouseYRel = 0;
  protected pendingMouseMoveStarted = 0;
  protected pendingMouseMoveAnimationFrame: number | undefined;
  protected virtualKeyboardVisible = false;
  protected hostShiftPressed = false;
  protected hostCommodorePressed = false;
  protected hostControlPressed = false;
  protected virtualShiftLatched = false;
  protected virtualCommodoreLatched = false;
  protected virtualControlLatched = false;
  protected readonly keyEventTracker = new ViceEmbedKeyEventTracker();
  protected readonly activeVirtualKeyboardKeys =
    new Map<string, ActiveVirtualKeyboardKey>();
  protected pressedVirtualMouseKey: PressedVirtualMouseKey | undefined;
  protected virtualKeyboardPanelPosition: VirtualKeyboardPanelPosition | undefined;
  protected virtualKeyboardDrag: VirtualKeyboardDragState | undefined;

  @postConstruct()
  protected init(): void {
    this.id = COMMODORE_MACHINE_PROFILE_WIDGET_ID;
    this.title.label = 'Emulator';
    this.title.caption = 'Commodore Emulator and VICE';
    this.title.iconClass = codicon('device-desktop');
    this.title.closable = false;
    this.addClass('cc-machine-profile-widget');
    this.viceEmbedService.setClient(this);
    this.frameSocket = createViceEmbedFrameSocket(
      this.onViceEmbedBinaryFrame,
      this.onViceEmbedFrameSocketError
    );
    document.addEventListener('pointerlockchange', this.handlePointerLockChanged);
    document.addEventListener('pointerlockerror', this.handlePointerLockError);
    document.addEventListener('keydown', this.handleDocumentKeyDown, true);
    document.addEventListener('keyup', this.handleDocumentKeyUp, true);
    document.addEventListener('mousemove', this.handleCapturedMouseMove, true);
    document.addEventListener('mousemove', this.handleVirtualKeyboardDocumentMouseMove, true);
    document.addEventListener('mousedown', this.handleCapturedMouseButtonDown, true);
    document.addEventListener('mouseup', this.handleCapturedMouseButtonUp, true);
    document.addEventListener('mouseup', this.handleVirtualKeyboardDocumentMouseUp, true);
    document.addEventListener('contextmenu', this.handleCapturedContextMenu, true);
    window.addEventListener('blur', this.handleWindowBlur);
    this.toDispose.pushAll([
      Disposable.create(() => {
        document.removeEventListener('pointerlockchange', this.handlePointerLockChanged);
        document.removeEventListener('pointerlockerror', this.handlePointerLockError);
        document.removeEventListener('keydown', this.handleDocumentKeyDown, true);
        document.removeEventListener('keyup', this.handleDocumentKeyUp, true);
        document.removeEventListener('mousemove', this.handleCapturedMouseMove, true);
        document.removeEventListener('mousemove', this.handleVirtualKeyboardDocumentMouseMove, true);
        document.removeEventListener('mousedown', this.handleCapturedMouseButtonDown, true);
        document.removeEventListener('mouseup', this.handleCapturedMouseButtonUp, true);
        document.removeEventListener('mouseup', this.handleVirtualKeyboardDocumentMouseUp, true);
        document.removeEventListener('contextmenu', this.handleCapturedContextMenu, true);
        window.removeEventListener('blur', this.handleWindowBlur);
      }),
      this.preferenceService.onPreferenceChanged((event) => {
        if (event.preferenceName === COMMODORE_MACHINE_PROFILE_PREFERENCE) {
          this.handleMachinePreferenceChanged();
          return;
        }
        if (
          event.preferenceName === COMMODORE_EMULATOR_VIRTUAL_KEYBOARD_SHORTCUT_PREFERENCE ||
          event.preferenceName === COMMODORE_EMULATOR_VICE_MENU_SHORTCUT_PREFERENCE
        ) {
          this.update();
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
    this.clearVirtualKeyboardState(true);
    this.clearPendingMouseMove();
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    if (this.isMouseCaptureActive()) {
      document.exitPointerLock();
    }
    this.viceEmbedService.setClient(undefined);
    this.frameSocket?.close();
    this.frameSocket = undefined;
    this.toDispose.dispose();
    super.dispose();
  }

  protected override onActivateRequest(msg: Message): void {
    super.onActivateRequest(msg);
    this.canvas?.focus();
  }

  protected readonly setScreenRef = (element: HTMLDivElement | null): void => {
    if (this.screenElement === (element ?? undefined)) {
      return;
    }
    this.resizeObserver?.disconnect();
    this.screenElement = element ?? undefined;
    if (this.screenElement && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(this.handleScreenResize);
      this.resizeObserver.observe(this.screenElement);
    } else {
      this.resizeObserver = undefined;
    }
    if (this.refreshCanvasDisplaySize()) {
      this.update();
    }
  };

  protected readonly handleScreenResize = (): void => {
    if (this.refreshCanvasDisplaySize()) {
      this.update();
    }
  };

  onViceEmbedFrame(event: CommodoreViceEmbedFrameEvent): void {
    this.applyFrame(event, 'standalone');
  }

  onViceEmbedStatus(event: CommodoreViceEmbedStatusEvent): void {
    this.applyStatus(event, 'standalone');
  }

  onViceEmbedOutput(event: CommodoreViceEmbedOutputEvent): void {
    this.applyOutput(event);
  }

  protected readonly onViceEmbedBinaryFrame = (event: ViceEmbedBinaryFrame): void => {
    this.applyFrame(event, this.runtimeOwner === 'debug' ? 'debug' : 'standalone');
  };

  protected readonly onViceEmbedFrameSocketError = (message: string): void => {
    this.lastOutput = `frame socket: ${message}`;
    this.update();
  };

  protected override onAfterAttach(msg: Message): void {
    super.onAfterAttach(msg);
    this.drawFrame();
  }

  protected render(): React.ReactNode {
    const profile = this.machineProfileSelection.getActiveMachineProfile();
    const screen = profile.screenLayouts[0];
    const isPowered = this.isPowered();
    const machineSelectorDisabled = this.starting || this.hasEmbeddedViceDebugSession();
    const aspectRatio = this.frame
      ? `${this.frame.width} / ${this.frame.height}`
      : screen
        ? `${screen.columns * screen.characterCell.width} / ${screen.rows * screen.characterCell.height}`
        : '4 / 3';
    const emptyStateText = this.emptyStateText();

    return (
      <div
        className='cc-machine-profile'
        style={styles.container}
      >
        <div style={styles.header}>
          <div style={styles.heading}>
            <select
              aria-label='Active Commodore machine'
              disabled={machineSelectorDisabled}
              onChange={this.changeMachineProfile}
              style={styles.machineSelect}
              title={
                machineSelectorDisabled
                  ? 'Machine profile is locked while the emulator is starting or debugging.'
                  : 'Select active Commodore machine'
              }
              value={profile.id}
            >
              {COMMODORE_MACHINE_PROFILES.map((machineProfile) => (
                <option
                  key={machineProfile.id}
                  value={machineProfile.id}
                >
                  {machineProfile.displayName}
                </option>
              ))}
            </select>
          </div>
          <div style={styles.controls}>
            <div
              style={{
                ...styles.frameRate,
                ...(!isPowered ? styles.frameRateDisabled : {})
              }}
              title='Displayed emulator frame rate'
            >
              FPS {this.frameRate === undefined ? '--' : Math.round(this.frameRate)}
            </div>
            <button
              aria-checked={isPowered}
              aria-label={isPowered ? 'Turn active machine off' : 'Turn active machine on'}
              className='cc-machine-power-switch'
              role='switch'
              title={isPowered ? 'Turn active machine off' : 'Turn active machine on'}
              disabled={this.starting}
              onClick={this.togglePower}
              style={{
                ...styles.powerSwitch,
                ...(isPowered ? styles.powerSwitchOn : styles.powerSwitchOff),
                ...(this.starting ? styles.powerSwitchDisabled : {})
              }}
            >
              <span
                aria-hidden='true'
                style={{
                  ...styles.powerSwitchThumb,
                  ...(isPowered ? styles.powerSwitchThumbOn : styles.powerSwitchThumbOff)
                }}
              />
            </button>
            <button
              className='theia-button secondary'
              title={this.mouseCaptured
                ? `Release mouse capture. Press ${this.viceMenuShortcutLabel()} to open the VICE menu without leaving capture mode. Press ESC to exit capture mode.`
                : `Capture mouse in the emulator canvas. Press ${this.viceMenuShortcutLabel()} to open the VICE menu. Press ESC to exit capture mode.`}
              disabled={!isPowered || this.starting}
              onMouseDown={this.handleMouseCaptureButtonMouseDown}
              style={styles.button}
            >
              <span className={codicon(this.mouseCaptured ? 'unlock' : 'lock')} />
              {this.mouseCaptured ? 'RELEASE' : 'CAPTURE'}
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

        <div
          className='cc-machine-vice-screen'
          ref={this.setScreenRef}
          style={styles.screen}
          onMouseDown={this.handleScreenMouseDown}
        >
          <div
            style={{
              ...styles.viewport,
              ...this.canvasDisplayStyle(),
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
              onMouseDown={this.handleCanvasMouseDown}
              style={styles.canvas}
            />
            {!this.frame && emptyStateText && (
              <div style={styles.emptyState}>
                {emptyStateText}
              </div>
            )}
            {this.virtualKeyboardVisible && isPowered && !this.starting && (
              this.renderVirtualKeyboardOverlay(profile)
            )}
          </div>
          <div style={styles.menuHint}>
            {`Keyboard ${this.virtualKeyboardShortcutLabel()} · Menu ${this.viceMenuShortcutLabel()}`}
          </div>
        </div>
      </div>
    );
  }

  protected renderVirtualKeyboardOverlay(
    profile: CommodoreMachineProfile
  ): React.ReactNode {
    const layout = getCommodoreVirtualKeyboardLayout(profile.id);
    return (
      <div
        aria-label={`${layout.title} virtual keyboard`}
        ref={this.setVirtualKeyboardOverlayElement}
        role='dialog'
        style={styles.virtualKeyboardOverlay}
        onMouseDown={this.handleVirtualKeyboardOverlayMouseDown}
      >
        <div
          ref={this.setVirtualKeyboardPanelElement}
          style={this.virtualKeyboardPanelStyle()}
          onMouseDown={this.handleVirtualKeyboardPanelMouseDown}
        >
          <div
            style={styles.virtualKeyboardHeader}
            title='Drag to move virtual keyboard'
            onMouseDown={this.handleVirtualKeyboardHeaderMouseDown}
          >
            <div style={styles.virtualKeyboardTitleBlock}>
              <div style={styles.virtualKeyboardKicker}>
                {profile.displayName}
              </div>
              <div style={styles.virtualKeyboardTitle}>
                {layout.title}
              </div>
            </div>
            <button
              aria-label='Hide virtual keyboard'
              className='theia-button secondary'
              title={`Hide virtual keyboard (${this.virtualKeyboardShortcutLabel()})`}
              onClick={this.hideVirtualKeyboard}
              onMouseDown={this.handleVirtualKeyboardCloseMouseDown}
              style={styles.virtualKeyboardCloseButton}
            >
              <span className={codicon('close')} />
            </button>
          </div>
          <div style={styles.virtualKeyboardRows}>
            {layout.rows.map((row, rowIndex) => (
              <div
                key={`row-${rowIndex}`}
                style={styles.virtualKeyboardRow}
              >
                {row.map((key, keyIndex) => this.renderVirtualKeyboardKey(
                  key,
                  rowIndex,
                  keyIndex
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  protected renderVirtualKeyboardKey(
    key: CommodoreVirtualKeyboardKey,
    rowIndex: number,
    keyIndex: number
  ): React.ReactNode {
    const state = this.virtualKeyboardKeyState(key);
    const disabled = !key.input &&
      !key.shiftedInput &&
      !key.commodoreInput &&
      !key.controlInput &&
      !isCommodoreVirtualKeyboardModifierKey(key);
    const label = this.virtualKeyboardKeyDisplayLabel(key, state);
    const glyph = this.virtualKeyboardKeyDisplayGlyph(key, state);
    return (
      <button
        type='button'
        key={`${rowIndex}-${keyIndex}-${key.label}`}
        aria-pressed={state.active || state.modifierActive}
        disabled={disabled}
        title={this.virtualKeyboardKeyTitle(key, disabled)}
        onMouseDown={(event) => this.handleVirtualKeyboardKeyMouseDown(event, key)}
        style={this.virtualKeyboardKeyStyle(key, state, disabled)}
      >
        {this.renderVirtualKeyboardKeyFace(key, label, glyph, state)}
      </button>
    );
  }

  protected renderVirtualKeyboardKeyFace(
    key: CommodoreVirtualKeyboardKey,
    label: string,
    glyph: CommodoreVirtualKeyboardGlyph | undefined,
    state: VirtualKeyboardKeyRenderState
  ): React.ReactNode {
    if (isCommodoreVirtualKeyboardModifierKey(key, 'commodore')) {
      return <CommodoreLogoMark style={styles.virtualKeyboardCommodoreLogo} />;
    }
    return (
      <span
        style={{
          ...styles.virtualKeyboardTextFace,
          ...virtualKeyboardTextFitStyle(key, label),
          ...(state.displayModifier ? styles.virtualKeyboardKeyLayerLabel : {})
        }}
      >
        {glyph ? (
          <CommodorePetsciiGlyphIcon
            screenCode={glyph.screenCode}
            title={label}
            style={styles.virtualKeyboardGlyph}
          />
        ) : this.renderVirtualKeyboardTextLabel(label)}
      </span>
    );
  }

  protected renderVirtualKeyboardTextLabel(label: string): React.ReactNode {
    const parts = label.trim().split(/\s+/u);
    if (parts.length < 2 || label.length < 6) {
      return label;
    }
    return parts.map((part) => (
      <span key={part} style={styles.virtualKeyboardTextLine}>
        {part}
      </span>
    ));
  }

  protected readonly setVirtualKeyboardOverlayElement = (
    element: HTMLDivElement | null
  ): void => {
    this.virtualKeyboardOverlayElement = element ?? undefined;
  };

  protected readonly setVirtualKeyboardPanelElement = (
    element: HTMLDivElement | null
  ): void => {
    this.virtualKeyboardPanelElement = element ?? undefined;
  };

  protected emptyStateText(): string | undefined {
    if (this.status === 'error') {
      return this.statusMessage;
    }
    if (!this.isPowered()) {
      return 'Powered off';
    }
    if (this.status === 'starting') {
      return this.statusMessage;
    }
    return undefined;
  }

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
    this.statusMessage = 'Starting emulator.';
    this.frame = undefined;
    this.refreshCanvasDisplaySize();
    this.resetFrameRate();
    this.drawFrame();
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
    this.releaseMouseCapture();
    this.clearVirtualKeyboardState(true);
    this.virtualKeyboardVisible = false;
    const session = this.currentEmbeddedViceDebugSession();
    if (session && this.runtimeOwner !== 'standalone') {
      await this.debugSessionManager.terminateSession(session);
      return;
    }

    await this.viceEmbedService.stop();
    this.runtimeOwner = undefined;
    this.activeDebugSessionId = undefined;
    this.frame = undefined;
    this.refreshCanvasDisplaySize();
    this.resetFrameRate();
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

  protected readonly openViceMenu = async (): Promise<void> => {
    this.focusCanvas();
    const session = this.currentEmbeddedViceDebugSession();
    if (session && this.runtimeOwner === 'debug') {
      await session.sendCustomRequest('commodoreViceEmbedMenu');
    } else {
      await this.viceEmbedService.openMenu();
    }
    window.setTimeout(() => this.focusCanvas(), 0);
  };

  protected readonly toggleVirtualKeyboard = (): void => {
    if (!this.isPowered() || this.starting) {
      return;
    }
    if (this.virtualKeyboardVisible) {
      this.clearVirtualKeyboardState(true);
    }
    this.virtualKeyboardVisible = !this.virtualKeyboardVisible;
    this.focusCanvas();
    this.update();
  };

  protected readonly hideVirtualKeyboard = (): void => {
    if (!this.virtualKeyboardVisible) {
      return;
    }
    this.clearVirtualKeyboardState(true);
    this.virtualKeyboardVisible = false;
    this.focusCanvas();
    this.update();
  };

  async powerOnForScreenCapture(timeoutMs = 60000): Promise<boolean> {
    if (!this.isPowered()) {
      await this.powerOnStandalone();
    }
    return this.waitForScreenCaptureCondition(
      () => this.status === 'running' && !this.starting && this.frame !== undefined,
      timeoutMs
    );
  }

  async showVirtualKeyboardForScreenCapture(timeoutMs = 60000): Promise<boolean> {
    if (!await this.powerOnForScreenCapture(timeoutMs)) {
      return false;
    }
    this.virtualKeyboardVisible = true;
    this.focusCanvas();
    this.update();
    return this.waitForScreenCaptureCondition(
      () => this.virtualKeyboardVisible && this.virtualKeyboardOverlayElement !== undefined,
      timeoutMs
    );
  }

  async powerOffForScreenCapture(): Promise<boolean> {
    if (this.isPowered()) {
      await this.powerOff();
    }
    return true;
  }

  protected readonly handleVirtualKeyboardOverlayMouseDown = (
    event: React.MouseEvent<HTMLDivElement>
  ): void => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.focusCanvas();
  };

  protected readonly handleVirtualKeyboardPanelMouseDown = (
    event: React.MouseEvent<HTMLDivElement>
  ): void => {
    event.stopPropagation();
  };

  protected readonly handleVirtualKeyboardCloseMouseDown = (
    event: React.MouseEvent<HTMLButtonElement>
  ): void => {
    event.stopPropagation();
  };

  protected readonly handleVirtualKeyboardHeaderMouseDown = (
    event: React.MouseEvent<HTMLDivElement>
  ): void => {
    if (event.button !== 0) {
      return;
    }
    const overlay = this.virtualKeyboardOverlayElement;
    const panel = this.virtualKeyboardPanelElement;
    if (!overlay || !panel) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.focusCanvas();

    const overlayRect = overlay.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const position = this.clampVirtualKeyboardPanelPosition(
      panelRect.left - overlayRect.left,
      panelRect.top - overlayRect.top,
      panelRect.width,
      panelRect.height
    );
    this.virtualKeyboardPanelPosition = position;
    this.virtualKeyboardDrag = {
      pointerOffsetX: event.clientX - panelRect.left,
      pointerOffsetY: event.clientY - panelRect.top,
      panelWidth: panelRect.width,
      panelHeight: panelRect.height
    };
    this.update();
  };

  protected async waitForScreenCaptureCondition(
    predicate: () => boolean,
    timeoutMs: number
  ): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (predicate()) {
        return true;
      }
      await new Promise<void>((resolve) => window.setTimeout(resolve, 100));
    }
    return predicate();
  }

  protected readonly handleVirtualKeyboardDocumentMouseMove = (
    event: MouseEvent
  ): void => {
    const drag = this.virtualKeyboardDrag;
    const overlay = this.virtualKeyboardOverlayElement;
    if (!drag || !overlay) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    const overlayRect = overlay.getBoundingClientRect();
    const position = this.clampVirtualKeyboardPanelPosition(
      event.clientX - overlayRect.left - drag.pointerOffsetX,
      event.clientY - overlayRect.top - drag.pointerOffsetY,
      drag.panelWidth,
      drag.panelHeight
    );
    if (
      this.virtualKeyboardPanelPosition?.left === position.left &&
      this.virtualKeyboardPanelPosition.top === position.top
    ) {
      return;
    }
    this.virtualKeyboardPanelPosition = position;
    this.update();
  };

  protected handleVirtualKeyboardKeyMouseDown(
    event: React.MouseEvent<HTMLButtonElement>,
    key: CommodoreVirtualKeyboardKey
  ): void {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.focusCanvas();

    const latchModifier = this.virtualKeyboardLatchModifier(key);
    if (latchModifier) {
      this.releasePressedVirtualMouseKey();
      this.toggleVirtualModifierLatch(latchModifier);
      this.update();
      return;
    }

    const modifier = this.virtualKeyboardModifierForKey(key);
    const keyEvent = createCommodoreVirtualKeyboardKeyEvent(key, modifier, true);
    if (!keyEvent) {
      return;
    }

    this.releasePressedVirtualMouseKey();
    const modifierKeyEvent = modifier && this.isVirtualModifierLatched(modifier)
      ? this.createVirtualKeyboardHeldModifierEvent(modifier, true)
      : undefined;
    if (modifierKeyEvent) {
      this.sendKeyEventPayload(modifierKeyEvent);
    }
    this.sendKeyEventPayload(keyEvent);
    const activeKey = this.toActiveVirtualKeyboardKey(key, modifier);
    this.activeVirtualKeyboardKeys.set('virtual-mouse', activeKey);
    this.pressedVirtualMouseKey = {
      keyEvent,
      modifierKeyEvent,
      consumedModifierLatch: modifier && this.isVirtualModifierLatched(modifier)
        ? modifier
        : undefined
    };
    this.update();
  }

  protected readonly handleVirtualKeyboardDocumentMouseUp = (event: MouseEvent): void => {
    const wasDragging = this.virtualKeyboardDrag !== undefined;
    this.virtualKeyboardDrag = undefined;
    if (wasDragging) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (this.releasePressedVirtualMouseKey() || wasDragging) {
      this.update();
    }
  };

  protected readonly handleWindowBlur = (): void => {
    const releasedTrackedKeys = this.releaseTrackedKeyboardKeys();
    if (
      releasedTrackedKeys ||
      this.pressedVirtualMouseKey ||
      this.hostShiftPressed ||
      this.hostCommodorePressed ||
      this.hostControlPressed ||
      this.virtualShiftLatched ||
      this.virtualCommodoreLatched ||
      this.virtualControlLatched ||
      this.activeVirtualKeyboardKeys.size > 0
    ) {
      this.clearVirtualKeyboardState(true);
      this.update();
    }
  };

  protected readonly toggleMouseCapture = (): void => {
    if (this.isMouseCaptureActive()) {
      this.releaseMouseCapture();
      return;
    }
    this.requestMouseCapture();
  };

  protected readonly changeMachineProfile = async (
    event: React.ChangeEvent<HTMLSelectElement>
  ): Promise<void> => {
    await this.machineProfileSelection.setWorkspaceMachineProfile(
      event.currentTarget.value as CommodoreMachineProfileId
    );
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
    this.statusMessage = 'Starting emulator.';
    this.frame = undefined;
    this.refreshCanvasDisplaySize();
    this.drawFrame();
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
    this.refreshCanvasDisplaySize();
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
            ? `Emulator ready (${event.machine}).`
            : 'Emulator ready.'
        }, this.runtimeOwner);
        return;
      case 'frame':
        this.applyFrame(event, this.runtimeOwner);
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
      this.frame = undefined;
      this.refreshCanvasDisplaySize();
      this.drawFrame();
      this.resetFrameRate();
      this.releaseMouseCapture();
      this.clearVirtualKeyboardState(false);
      this.virtualKeyboardVisible = false;
    }
    this.update();
  }

  protected applyFrame(
    event: ViceEmbedRenderableFrame,
    owner: ViceRuntimeOwner | undefined
  ): void {
    const previousFrame = this.frame;
    const shouldUpdate = this.starting ||
      this.status !== 'running' ||
      previousFrame?.width !== event.width ||
      previousFrame?.height !== event.height;
    const frameRateChanged = this.updateFrameRate();
    this.runtimeOwner = owner ?? this.runtimeOwner;
    this.status = 'running';
    this.statusMessage = 'Emulator running';
    this.starting = false;
    this.frame = event;
    this.drawFrame();
    const displaySizeChanged = this.refreshCanvasDisplaySize();
    if (shouldUpdate || frameRateChanged || displaySizeChanged) {
      this.update();
    }
  }

  protected refreshCanvasDisplaySize(): boolean {
    const next = this.calculateCanvasDisplaySize();
    const previous = this.canvasDisplaySize;
    const changed =
      previous?.width !== next?.width ||
      previous?.height !== next?.height ||
      previous?.scale !== next?.scale;
    this.canvasDisplaySize = next;
    return changed;
  }

  protected calculateCanvasDisplaySize(): ViceCanvasDisplaySize | undefined {
    if (!this.frame || !this.screenElement) {
      return undefined;
    }
    return calculateViceCanvasDisplaySize(
      this.frame.width,
      this.frame.height,
      this.screenElement.clientWidth,
      this.screenElement.clientHeight - VICE_MENU_HINT_HEIGHT
    );
  }

  protected canvasDisplayStyle(): React.CSSProperties {
    const displaySize = this.canvasDisplaySize;
    if (!displaySize) {
      return {};
    }
    return {
      width: displaySize.width,
      height: displaySize.height,
      maxWidth: 'none',
      maxHeight: 'none',
      flexShrink: 0
    };
  }

  protected virtualKeyboardPanelStyle(): React.CSSProperties {
    const position = this.virtualKeyboardPanelPosition;
    if (!position) {
      return styles.virtualKeyboardPanel;
    }
    return {
      ...styles.virtualKeyboardPanel,
      position: 'absolute',
      left: position.left,
      top: position.top
    };
  }

  protected clampVirtualKeyboardPanelPosition(
    left: number,
    top: number,
    panelWidth: number,
    panelHeight: number
  ): VirtualKeyboardPanelPosition {
    const overlayRect = this.virtualKeyboardOverlayElement?.getBoundingClientRect();
    if (!overlayRect) {
      return {
        left: Math.max(0, left),
        top: Math.max(0, top)
      };
    }
    const maxLeft = Math.max(0, overlayRect.width - panelWidth);
    const maxTop = Math.max(0, overlayRect.height - panelHeight);
    return {
      left: Math.min(Math.max(0, left), maxLeft),
      top: Math.min(Math.max(0, top), maxTop)
    };
  }

  protected virtualKeyboardKeyStyle(
    key: CommodoreVirtualKeyboardKey,
    state: VirtualKeyboardKeyRenderState,
    disabled: boolean
  ): React.CSSProperties {
    const width = key.width ?? 1;
    return {
      ...styles.virtualKeyboardKey,
      ...virtualKeyboardKeyVariantStyle(key),
      ...(state.active || state.modifierActive ? styles.virtualKeyboardKeyActive : {}),
      ...(disabled ? styles.virtualKeyboardKeyDisabled : {}),
      flex: `${width} 1 ${Math.max(24, width * 24)}px`,
      minWidth: Math.max(22, width * 22)
    };
  }

  protected virtualKeyboardKeyState(
    key: CommodoreVirtualKeyboardKey
  ): VirtualKeyboardKeyRenderState {
    const activeEntries = [...this.activeVirtualKeyboardKeys.values()]
      .filter((entry) => entry.keyId === key.id);
    const displayModifier =
      activeEntries.find((entry) => entry.modifier)?.modifier ??
      this.virtualKeyboardModifierForKey(key);
    const latchModifier = this.virtualKeyboardLatchModifier(key);
    const modifierActive = latchModifier !== undefined &&
      this.isVirtualModifierActive(latchModifier);
    return {
      active: activeEntries.length > 0,
      modifierActive,
      displayModifier
    };
  }

  protected virtualKeyboardKeyDisplayLabel(
    key: CommodoreVirtualKeyboardKey,
    state: VirtualKeyboardKeyRenderState
  ): string {
    return this.virtualKeyboardKeyDisplayLabelForModifier(
      key,
      state.displayModifier
    );
  }

  protected virtualKeyboardKeyDisplayGlyph(
    key: CommodoreVirtualKeyboardKey,
    state: VirtualKeyboardKeyRenderState
  ): CommodoreVirtualKeyboardGlyph | undefined {
    return this.virtualKeyboardKeyDisplayGlyphForModifier(
      key,
      state.displayModifier
    );
  }

  protected virtualKeyboardKeyDisplayLabelForModifier(
    key: CommodoreVirtualKeyboardKey,
    modifier: CommodoreVirtualKeyboardModifier | undefined
  ): string {
    switch (modifier) {
      case 'control':
        return key.control ?? key.label;
      case 'commodore':
        return key.commodore ?? key.label;
      case 'shift':
        return key.shifted ?? key.label;
      case undefined:
        return key.label;
    }
  }

  protected virtualKeyboardKeyDisplayGlyphForModifier(
    key: CommodoreVirtualKeyboardKey,
    modifier: CommodoreVirtualKeyboardModifier | undefined
  ): CommodoreVirtualKeyboardGlyph | undefined {
    switch (modifier) {
      case 'control':
        return key.controlGlyph;
      case 'commodore':
        return key.commodoreGlyph;
      case 'shift':
        return key.shiftedGlyph;
      case undefined:
        return undefined;
    }
  }

  protected virtualKeyboardKeyTitle(
    key: CommodoreVirtualKeyboardKey,
    disabled: boolean
  ): string {
    if (disabled) {
      return `${key.label} is shown for layout reference.`;
    }
    const latchModifier = this.virtualKeyboardLatchModifier(key);
    if (latchModifier) {
      return `Toggle virtual ${this.virtualKeyboardModifierLabel(latchModifier)}`;
    }
    const layers = [
      key.shifted || key.shiftedGlyph
        ? `Shift ${this.virtualKeyboardKeyTitleForLayer(key.shifted, key.shiftedGlyph)}`
        : undefined,
      key.commodore || key.commodoreGlyph
        ? `Commodore ${this.virtualKeyboardKeyTitleForLayer(key.commodore, key.commodoreGlyph)}`
        : undefined,
      key.control || key.controlGlyph
        ? `CTRL ${this.virtualKeyboardKeyTitleForLayer(key.control, key.controlGlyph)}`
        : undefined
    ].filter(isString);
    return layers.length > 0
      ? `${key.label} / ${layers.join(' / ')}`
      : key.label;
  }

  protected virtualKeyboardKeyTitleForLayer(
    label: string | undefined,
    glyph: CommodoreVirtualKeyboardGlyph | undefined
  ): string {
    const parts = [
      label,
      glyph ? `screen $${formatHexByte(glyph.screenCode)}` : undefined
    ].filter(isString);
    return parts.join(' ');
  }

  protected isVirtualModifierActive(
    modifier: CommodoreVirtualKeyboardModifier
  ): boolean {
    switch (modifier) {
      case 'shift':
        return this.hostShiftPressed || this.virtualShiftLatched;
      case 'commodore':
        return this.hostCommodorePressed || this.virtualCommodoreLatched;
      case 'control':
        return this.hostControlPressed || this.virtualControlLatched;
    }
  }

  protected isVirtualModifierLatched(
    modifier: CommodoreVirtualKeyboardModifier
  ): boolean {
    switch (modifier) {
      case 'shift':
        return this.virtualShiftLatched;
      case 'commodore':
        return this.virtualCommodoreLatched;
      case 'control':
        return this.virtualControlLatched;
    }
  }

  protected virtualKeyboardModifierForKey(
    key: CommodoreVirtualKeyboardKey
  ): CommodoreVirtualKeyboardModifier | undefined {
    if (!isCommodoreVirtualKeyboardModifierKey(key, 'control') &&
      this.isVirtualModifierActive('control') &&
      key.control) {
      return 'control';
    }
    if (!isCommodoreVirtualKeyboardModifierKey(key, 'commodore') &&
      this.isVirtualModifierActive('commodore') &&
      key.commodore) {
      return 'commodore';
    }
    if (!isCommodoreVirtualKeyboardShiftKey(key) &&
      this.isVirtualModifierActive('shift') &&
      key.shiftedInput !== undefined) {
      return 'shift';
    }
    return undefined;
  }

  protected virtualKeyboardLatchModifier(
    key: CommodoreVirtualKeyboardKey
  ): CommodoreVirtualKeyboardModifier | undefined {
    if (isCommodoreVirtualKeyboardModifierKey(key, 'shift')) {
      return 'shift';
    }
    if (isCommodoreVirtualKeyboardModifierKey(key, 'commodore')) {
      return 'commodore';
    }
    if (isCommodoreVirtualKeyboardModifierKey(key, 'control')) {
      return 'control';
    }
    return undefined;
  }

  protected toggleVirtualModifierLatch(
    modifier: CommodoreVirtualKeyboardModifier
  ): void {
    switch (modifier) {
      case 'shift':
        this.virtualShiftLatched = !this.virtualShiftLatched;
        return;
      case 'commodore':
        this.virtualCommodoreLatched = !this.virtualCommodoreLatched;
        return;
      case 'control':
        this.virtualControlLatched = !this.virtualControlLatched;
        return;
    }
  }

  protected clearVirtualModifierLatch(
    modifier: CommodoreVirtualKeyboardModifier
  ): void {
    switch (modifier) {
      case 'shift':
        this.virtualShiftLatched = false;
        return;
      case 'commodore':
        this.virtualCommodoreLatched = false;
        return;
      case 'control':
        this.virtualControlLatched = false;
        return;
    }
  }

  protected createVirtualKeyboardHeldModifierEvent(
    modifier: CommodoreVirtualKeyboardModifier | undefined,
    pressed: boolean
  ): CommodoreViceEmbedKeyEvent | undefined {
    if (!modifier || modifier === 'shift') {
      return undefined;
    }
    return createCommodoreVirtualKeyboardModifierKeyEvent(modifier, pressed);
  }

  protected virtualKeyboardModifierLabel(
    modifier: CommodoreVirtualKeyboardModifier
  ): string {
    switch (modifier) {
      case 'shift':
        return 'SHIFT';
      case 'commodore':
        return 'Commodore';
      case 'control':
        return 'CTRL';
    }
  }

  protected toActiveVirtualKeyboardKey(
    key: CommodoreVirtualKeyboardKey,
    modifier: CommodoreVirtualKeyboardModifier | undefined
  ): ActiveVirtualKeyboardKey {
    return {
      keyId: key.id,
      modifier
    };
  }

  protected trackVirtualKeyboardKey(event: KeyboardEvent, pressed: boolean): void {
    if (!this.virtualKeyboardVisible || !this.hasEmulatorKeyboardFocus(event)) {
      return;
    }
    const hostModifier = hostVirtualKeyboardModifier(event);
    if (hostModifier) {
      this.setHostVirtualKeyboardModifier(hostModifier, pressed);
      this.update();
      return;
    }

    const identity = keyboardEventIdentity(event);
    if (!pressed) {
      if (this.activeVirtualKeyboardKeys.delete(identity)) {
        this.update();
      }
      return;
    }

    const keyEvent = createViceEmbedKeyEvent(
      this.keyboardEventForEmulator(event),
      true
    );
    const profile = this.machineProfileSelection.getActiveMachineProfile();
    const layout = getCommodoreVirtualKeyboardLayout(profile.id);
    const resolved = resolveCommodoreVirtualKeyboardKey(layout, keyEvent);
    if (!resolved) {
      return;
    }

    const activeKey = this.toActiveVirtualKeyboardKey(
      resolved.key,
      resolved.modifier ?? this.virtualKeyboardModifierForKey(resolved.key)
    );
    this.activeVirtualKeyboardKeys.set(identity, activeKey);
    this.update();
  }

  protected setHostVirtualKeyboardModifier(
    modifier: CommodoreVirtualKeyboardModifier,
    pressed: boolean
  ): void {
    switch (modifier) {
      case 'shift':
        this.hostShiftPressed = pressed;
        return;
      case 'commodore':
        this.hostCommodorePressed = pressed;
        return;
      case 'control':
        this.hostControlPressed = pressed;
        return;
    }
  }

  protected releasePressedVirtualMouseKey(): boolean {
    const pressedKey = this.pressedVirtualMouseKey;
    if (!pressedKey) {
      return false;
    }
    this.sendKeyEventPayload({
      ...pressedKey.keyEvent,
      pressed: false,
      repeat: false
    });
    if (pressedKey.modifierKeyEvent) {
      this.sendKeyEventPayload({
        ...pressedKey.modifierKeyEvent,
        pressed: false,
        repeat: false
      });
    }
    this.pressedVirtualMouseKey = undefined;
    this.activeVirtualKeyboardKeys.delete('virtual-mouse');
    if (pressedKey.consumedModifierLatch) {
      this.clearVirtualModifierLatch(pressedKey.consumedModifierLatch);
    }
    return true;
  }

  protected clearVirtualKeyboardState(releaseMouseKey: boolean): void {
    if (releaseMouseKey) {
      this.releasePressedVirtualMouseKey();
    }
    this.keyEventTracker.reset();
    this.hostShiftPressed = false;
    this.hostCommodorePressed = false;
    this.hostControlPressed = false;
    this.virtualShiftLatched = false;
    this.virtualCommodoreLatched = false;
    this.virtualControlLatched = false;
    this.activeVirtualKeyboardKeys.clear();
    this.pressedVirtualMouseKey = undefined;
    this.virtualKeyboardDrag = undefined;
  }

  protected virtualKeyboardShortcut(): unknown {
    return this.preferenceService.get<unknown>(
      COMMODORE_EMULATOR_VIRTUAL_KEYBOARD_SHORTCUT_PREFERENCE,
      DEFAULT_COMMODORE_EMULATOR_VIRTUAL_KEYBOARD_SHORTCUT
    );
  }

  protected viceMenuShortcut(): unknown {
    return this.preferenceService.get<unknown>(
      COMMODORE_EMULATOR_VICE_MENU_SHORTCUT_PREFERENCE,
      DEFAULT_COMMODORE_EMULATOR_VICE_MENU_SHORTCUT
    );
  }

  protected virtualKeyboardShortcutLabel(): string {
    return resolveCommodoreEmulatorShortcutLabel(
      this.virtualKeyboardShortcut(),
      DEFAULT_COMMODORE_EMULATOR_VIRTUAL_KEYBOARD_SHORTCUT
    );
  }

  protected viceMenuShortcutLabel(): string {
    return resolveCommodoreEmulatorShortcutLabel(
      this.viceMenuShortcut(),
      DEFAULT_COMMODORE_EMULATOR_VICE_MENU_SHORTCUT
    );
  }

  protected updateFrameRate(): boolean {
    const now = window.performance.now();
    if (this.frameRateSampleStarted <= 0) {
      this.frameRateSampleStarted = now;
      this.frameRateSampleFrames = 0;
    }

    this.frameRateSampleFrames += 1;
    const elapsed = now - this.frameRateSampleStarted;
    if (elapsed < 500) {
      return false;
    }

    const frameRate = (this.frameRateSampleFrames * 1000) / elapsed;
    const changed = this.frameRate === undefined ||
      Math.abs(this.frameRate - frameRate) >= 0.5;
    this.frameRate = frameRate;
    this.frameRateSampleStarted = now;
    this.frameRateSampleFrames = 0;
    return changed;
  }

  protected resetFrameRate(): void {
    this.frameRate = undefined;
    this.frameRateSampleStarted = 0;
    this.frameRateSampleFrames = 0;
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

  protected readonly handleMouseCaptureButtonMouseDown = (
    event: React.MouseEvent<HTMLButtonElement>
  ): void => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.toggleMouseCapture();
  };

  protected readonly handleScreenMouseDown = (
    event: React.MouseEvent<HTMLDivElement>
  ): void => {
    if (event.button !== 0) {
      return;
    }
    this.requestMouseCaptureFromGesture(event);
  };

  protected readonly handleCanvasMouseDown = (
    event: React.MouseEvent<HTMLCanvasElement>
  ): void => {
    if (event.button !== 0) {
      return;
    }
    this.requestMouseCaptureFromGesture(event);
  };

  protected requestMouseCaptureFromGesture(event: React.MouseEvent): void {
    this.focusCanvas();
    if (this.isMouseCaptureActive() || !this.isPowered()) {
      return;
    }
    this.requestMouseCapture();
    event.preventDefault();
    event.stopPropagation();
  }

  protected requestMouseCapture(): void {
    const canvas = this.canvas;
    if (!canvas || !this.isPowered()) {
      return;
    }
    if (this.isMouseCaptureActive()) {
      this.syncMouseCaptureState();
      return;
    }
    canvas.focus();
    try {
      const result = canvas.requestPointerLock() as Promise<void> | void;
      if (isPromiseLike(result)) {
        void result
          .then(() => this.syncMouseCaptureState())
          .catch((error) => this.reportMouseCaptureError(error));
      } else {
        window.setTimeout(() => this.syncMouseCaptureState(), 0);
      }
    } catch (error) {
      this.reportMouseCaptureError(error);
    }
  }

  protected releaseMouseCapture(): void {
    if (this.isMouseCaptureActive()) {
      document.exitPointerLock();
    }
    this.clearPendingMouseMove();
    if (this.mouseCaptured) {
      this.mouseCaptured = false;
      this.update();
    }
  }

  protected readonly handlePointerLockChanged = (): void => {
    this.syncMouseCaptureState();
  };

  protected syncMouseCaptureState(): void {
    const captured = this.isMouseCaptureActive();
    if (captured === this.mouseCaptured) {
      return;
    }
    this.mouseCaptured = captured;
    if (!captured) {
      this.clearPendingMouseMove();
    }
    this.update();
  }

  protected readonly handlePointerLockError = (): void => {
    this.reportMouseCaptureError(new Error('Pointer lock was rejected.'));
  };

  protected reportMouseCaptureError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.lastOutput = `mouse capture: ${message}`;
    this.update();
  }

  protected readonly handleCapturedMouseMove = (event: MouseEvent): void => {
    if (!this.isMouseCaptureActive()) {
      return;
    }
    this.consumeCapturedMouseEvent(event);
    const xRel = normalizePointerMovement(event.movementX);
    const yRel = normalizePointerMovement(event.movementY);
    if (xRel !== 0 || yRel !== 0) {
      this.queueMouseMove(xRel, yRel);
    }
  };

  protected readonly handleCapturedMouseButtonDown = (event: MouseEvent): void => {
    this.handleCapturedMouseButton(event, true);
  };

  protected readonly handleCapturedMouseButtonUp = (event: MouseEvent): void => {
    this.handleCapturedMouseButton(event, false);
  };

  protected readonly handleCapturedContextMenu = (event: MouseEvent): void => {
    if (this.isMouseCaptureActive()) {
      this.consumeCapturedMouseEvent(event);
    }
  };

  protected handleCapturedMouseButton(event: MouseEvent, pressed: boolean): void {
    if (!this.isMouseCaptureActive()) {
      return;
    }
    this.consumeCapturedMouseEvent(event);
    const button = browserMouseButtonToSdlButton(event.button);
    if (button === undefined) {
      return;
    }
    this.flushPendingMouseMove();
    this.sendMouseEvent({
      xRel: 0,
      yRel: 0,
      button,
      pressed
    });
  }

  protected consumeCapturedMouseEvent(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  protected isMouseCaptureActive(): boolean {
    const pointerLockElement = document.pointerLockElement;
    if (!pointerLockElement) {
      return false;
    }
    return pointerLockElement === this.canvas ||
      this.node.contains(pointerLockElement);
  }

  protected queueMouseMove(xRel: number, yRel: number): void {
    const now = window.performance.now();
    if (
      this.pendingMouseMoveStarted > 0 &&
      now - this.pendingMouseMoveStarted > MOUSE_CAPTURE_JITTER_HOLD_MS
    ) {
      this.pendingMouseXRel = 0;
      this.pendingMouseYRel = 0;
      this.pendingMouseMoveStarted = 0;
    }
    if (this.pendingMouseMoveStarted <= 0) {
      this.pendingMouseMoveStarted = now;
    }
    this.pendingMouseXRel += xRel;
    this.pendingMouseYRel += yRel;
    if (this.pendingMouseMoveAnimationFrame !== undefined) {
      return;
    }
    this.pendingMouseMoveAnimationFrame = window.requestAnimationFrame(
      this.flushQueuedMouseMove
    );
  }

  protected readonly flushQueuedMouseMove = (): void => {
    this.pendingMouseMoveAnimationFrame = undefined;
    this.flushPendingMouseMove();
  };

  protected flushPendingMouseMove(): void {
    if (this.pendingMouseMoveAnimationFrame !== undefined) {
      window.cancelAnimationFrame(this.pendingMouseMoveAnimationFrame);
      this.pendingMouseMoveAnimationFrame = undefined;
    }
    if (!this.isMouseCaptureActive()) {
      this.pendingMouseXRel = 0;
      this.pendingMouseYRel = 0;
      return;
    }
    const xRel = toMouseDelta(this.pendingMouseXRel);
    const yRel = toMouseDelta(this.pendingMouseYRel);
    if (isMouseJitterDelta(xRel, yRel)) {
      return;
    }
    this.pendingMouseXRel = 0;
    this.pendingMouseYRel = 0;
    this.pendingMouseMoveStarted = 0;
    if (xRel === 0 && yRel === 0) {
      return;
    }
    this.sendMouseEvent({ xRel, yRel });
  }

  protected clearPendingMouseMove(): void {
    if (this.pendingMouseMoveAnimationFrame !== undefined) {
      window.cancelAnimationFrame(this.pendingMouseMoveAnimationFrame);
      this.pendingMouseMoveAnimationFrame = undefined;
    }
    this.pendingMouseXRel = 0;
    this.pendingMouseYRel = 0;
    this.pendingMouseMoveStarted = 0;
  }

  protected readonly handleDocumentKeyDown = (event: KeyboardEvent): void => {
    if (this.handleVirtualKeyboardShortcut(event, true)) {
      return;
    }
    if (this.handleViceMenuShortcut(event, true)) {
      return;
    }
    if (this.handleCommodoreFunctionKey(event, true)) {
      return;
    }
    this.trackVirtualKeyboardKey(event, true);
  };

  protected readonly handleDocumentKeyUp = (event: KeyboardEvent): void => {
    if (this.handleVirtualKeyboardShortcut(event, false)) {
      return;
    }
    if (this.handleViceMenuShortcut(event, false)) {
      return;
    }
    if (this.handleCommodoreFunctionKey(event, false)) {
      return;
    }
    this.trackVirtualKeyboardKey(event, false);
  };

  protected handleVirtualKeyboardShortcut(
    event: KeyboardEvent,
    pressed: boolean
  ): boolean {
    if (!this.shouldHandleVirtualKeyboardShortcut(event)) {
      return false;
    }
    this.consumeEmulatorShortcutEvent(event);
    if (pressed && !event.repeat) {
      this.toggleVirtualKeyboard();
    }
    return true;
  }

  protected shouldHandleVirtualKeyboardShortcut(event: KeyboardEvent): boolean {
    return this.isPowered() &&
      !this.starting &&
      matchesCommodoreEmulatorShortcut(
        event,
        this.virtualKeyboardShortcut(),
        DEFAULT_COMMODORE_EMULATOR_VIRTUAL_KEYBOARD_SHORTCUT
      );
  }

  protected handleViceMenuShortcut(
    event: KeyboardEvent,
    pressed: boolean
  ): boolean {
    if (!this.shouldHandleEmulatorShortcut(
      event,
      this.viceMenuShortcut(),
      DEFAULT_COMMODORE_EMULATOR_VICE_MENU_SHORTCUT
    )) {
      return false;
    }
    this.consumeEmulatorShortcutEvent(event);
    if (pressed && !event.repeat) {
      void this.openViceMenu();
    }
    return true;
  }

  protected handleCommodoreFunctionKey(
    event: KeyboardEvent,
    pressed: boolean
  ): boolean {
    if (
      !this.isPowered() ||
      this.starting ||
      !isViceEmbedCommodoreFunctionKeyEvent(event) ||
      !this.hasEmulatorKeyboardFocus(event)
    ) {
      return false;
    }

    this.consumeEmulatorShortcutEvent(event);
    this.sendKeyEventPayload(
      this.keyEventTracker.createKeyEvent(
        this.keyboardEventForEmulator(event),
        pressed
      )
    );
    this.trackVirtualKeyboardKey(event, pressed);
    return true;
  }

  protected shouldHandleEmulatorShortcut(
    event: KeyboardEvent,
    configuredShortcut: unknown,
    fallbackShortcut: string
  ): boolean {
    if (
      !this.isPowered() ||
      this.starting ||
      !matchesCommodoreEmulatorShortcut(event, configuredShortcut, fallbackShortcut)
    ) {
      return false;
    }
    return this.hasEmulatorKeyboardFocus(event);
  }

  protected hasEmulatorKeyboardFocus(event: KeyboardEvent): boolean {
    if (this.isMouseCaptureActive()) {
      return true;
    }
    const target = event.target;
    if (target instanceof Node && this.node.contains(target)) {
      return true;
    }
    const activeElement = document.activeElement;
    return activeElement instanceof Node && this.node.contains(activeElement);
  }

  protected consumeEmulatorShortcutEvent(event: KeyboardEvent): void {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

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
    const hostModifier = hostVirtualKeyboardModifier(event);
    if (hostModifier) {
      this.setHostVirtualKeyboardModifier(hostModifier, pressed);
      if (this.virtualKeyboardVisible) {
        this.update();
      }
    }
    const keyEvent: CommodoreViceEmbedKeyEvent =
      this.keyEventTracker.createKeyEvent(
        this.keyboardEventForEmulator(event),
        pressed
      );
    this.sendKeyEventPayload(keyEvent);
  }

  protected releaseTrackedKeyboardKeys(): boolean {
    const releases = this.keyEventTracker.releasePressedMatrixKeys();
    for (const keyEvent of releases) {
      this.sendKeyEventPayload(keyEvent);
    }
    return releases.length > 0;
  }

  protected keyboardEventForEmulator(
    event: React.KeyboardEvent<HTMLCanvasElement> | KeyboardEvent
  ): React.KeyboardEvent<HTMLCanvasElement> | KeyboardEvent | NormalizedKeyboardEventLike {
    if (
      this.hostCommodorePressed &&
      event.altKey &&
      !isHostCommodoreKeyEvent(event)
    ) {
      const unmodified = unmodifiedKeyboardEventFromCode(event);
      if (unmodified) {
        return unmodified;
      }
    }
    return event;
  }

  protected sendKeyEventPayload(keyEvent: CommodoreViceEmbedKeyEvent): void {
    const session = this.currentEmbeddedViceDebugSession();
    if (session && this.runtimeOwner === 'debug') {
      void session.sendCustomRequest('commodoreViceEmbedKey', keyEvent);
      return;
    }
    void this.viceEmbedService.sendKey(keyEvent);
  }

  protected sendMouseEvent(event: CommodoreViceEmbedMouseEvent): void {
    const session = this.currentEmbeddedViceDebugSession();
    if (session && this.runtimeOwner === 'debug') {
      void session.sendCustomRequest('commodoreViceEmbedMouse', event);
      return;
    }
    void this.viceEmbedService.sendMouse(event);
  }

  protected drawFrame(): void {
    const canvas = this.canvas;
    if (!canvas) {
      return;
    }
    const frame = this.frame;
    if (!frame) {
      this.clearCanvas(canvas);
      return;
    }
    const expectedLength = frame.width * frame.height * 4;
    const bytes = getFrameBytes(frame);
    if (bytes.length !== expectedLength) {
      this.status = 'error';
      this.statusMessage = `Invalid VICE frame size: ${bytes.length}/${expectedLength}.`;
      this.update();
      return;
    }
    if (canvas.width !== frame.width) {
      canvas.width = frame.width;
    }
    if (canvas.height !== frame.height) {
      canvas.height = frame.height;
    }
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }
    context.imageSmoothingEnabled = false;
    const imageData = new ImageData(toClampedBytes(bytes), frame.width, frame.height);
    context.putImageData(imageData, 0, 0);
  }

  protected clearCanvas(canvas: HTMLCanvasElement): void {
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }
    context.imageSmoothingEnabled = false;
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  protected isPowered(): boolean {
    return this.status === 'running' ||
      this.status === 'starting';
  }

  protected hasEmbeddedViceDebugSession(): boolean {
    return this.debugSessionManager.sessions.some((session) =>
      this.isEmbeddedViceDebugSession(session)
    );
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
      session.configuration.viceLaunchMode !== 'external' &&
      session.configuration.viceLaunchMode !== 'externalWindow';
  }
}

function getFrameBytes(frame: ViceEmbedRenderableFrame): ViceEmbedFrameBytes {
  return typeof frame.data === 'string'
    ? decodeBase64(frame.data)
    : frame.data;
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

function toClampedBytes(bytes: ViceEmbedFrameBytes): Uint8ClampedArray<ArrayBuffer> {
  return bytes instanceof Uint8ClampedArray && bytes.buffer instanceof ArrayBuffer
    ? bytes as Uint8ClampedArray<ArrayBuffer>
    : new Uint8ClampedArray(bytes) as Uint8ClampedArray<ArrayBuffer>;
}

function browserMouseButtonToSdlButton(button: number): number | undefined {
  switch (button) {
    case 0:
      return 1;
    case 1:
      return 2;
    case 2:
      return 3;
    default:
      return undefined;
  }
}

interface NormalizedKeyboardEventLike {
  readonly code: string;
  readonly key: string;
  readonly keyCode: number;
  readonly repeat: boolean;
  readonly shiftKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly metaKey: boolean;
}

function hostVirtualKeyboardModifier(
  event: Pick<KeyboardEvent, 'code' | 'key'>
): CommodoreVirtualKeyboardModifier | undefined {
  if (event.code === 'ShiftLeft' ||
    event.code === 'ShiftRight' ||
    event.key === 'Shift') {
    return 'shift';
  }
  if (isHostCommodoreKeyEvent(event)) {
    return 'commodore';
  }
  if (event.code === 'ControlLeft' ||
    event.code === 'ControlRight' ||
    event.key === 'Control') {
    return 'control';
  }
  return undefined;
}

function isHostCommodoreKeyEvent(
  event: Pick<KeyboardEvent, 'code' | 'key'>
): boolean {
  return event.code === 'AltLeft';
}

function unmodifiedKeyboardEventFromCode(
  event: Pick<KeyboardEvent, 'code' | 'repeat' | 'shiftKey' | 'ctrlKey' | 'metaKey'>
): NormalizedKeyboardEventLike | undefined {
  const key = unmodifiedKeyFromCode(event.code);
  if (!key) {
    return undefined;
  }
  return {
    code: event.code,
    key,
    keyCode: key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0,
    repeat: event.repeat,
    shiftKey: event.shiftKey,
    ctrlKey: event.ctrlKey,
    altKey: false,
    metaKey: event.metaKey
  };
}

function unmodifiedKeyFromCode(code: string): string | undefined {
  const letterMatch = /^Key([A-Z])$/u.exec(code);
  if (letterMatch) {
    return letterMatch[1].toLowerCase();
  }
  const digitMatch = /^Digit(\d)$/u.exec(code);
  if (digitMatch) {
    return digitMatch[1];
  }
  switch (code) {
    case 'Space':
      return ' ';
    case 'Comma':
      return ',';
    case 'Period':
      return '.';
    case 'Slash':
      return '/';
    case 'Semicolon':
      return ';';
    case 'Quote':
      return "'";
    case 'BracketLeft':
      return '[';
    case 'BracketRight':
      return ']';
    case 'Minus':
      return '-';
    case 'Equal':
      return '=';
    case 'Backslash':
      return '\\';
    default:
      return undefined;
  }
}

function keyboardEventIdentity(
  event: Pick<KeyboardEvent, 'code' | 'key' | 'keyCode'>
): string {
  return event.code || `${event.key}:${event.keyCode}`;
}

function formatHexByte(value: number): string {
  return (value & 0xff).toString(16).toUpperCase().padStart(2, '0');
}

function isString(value: string | undefined): value is string {
  return typeof value === 'string';
}

function normalizePointerMovement(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return value;
}

function isPromiseLike(value: unknown): value is Promise<void> {
  return Boolean(value) &&
    typeof value === 'object' &&
    typeof (value as { then?: unknown }).then === 'function';
}

function toMouseDelta(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const clamped = Math.max(
    -MOUSE_CAPTURE_MAX_RELATIVE_DELTA,
    Math.min(MOUSE_CAPTURE_MAX_RELATIVE_DELTA, value)
  );
  return clamped < 0 ? Math.ceil(clamped) : Math.floor(clamped);
}

function isMouseJitterDelta(xRel: number, yRel: number): boolean {
  return Math.abs(xRel) + Math.abs(yRel) > 0 &&
    Math.abs(xRel) < MOUSE_CAPTURE_MIN_RELATIVE_DELTA &&
    Math.abs(yRel) < MOUSE_CAPTURE_MIN_RELATIVE_DELTA;
}

function virtualKeyboardKeyVariantStyle(
  key: CommodoreVirtualKeyboardKey
): React.CSSProperties {
  switch (key.variant) {
    case 'function':
      return styles.virtualKeyboardFunctionKey;
    case 'modifier':
      return styles.virtualKeyboardModifierKey;
    case 'system':
      return styles.virtualKeyboardSystemKey;
    case 'space':
      return styles.virtualKeyboardSpaceKey;
    case 'normal':
    default:
      return {};
  }
}

function virtualKeyboardTextFitStyle(
  key: CommodoreVirtualKeyboardKey,
  label: string
): React.CSSProperties {
  const width = key.width ?? 1;
  const compactLength = label.replace(/\s+/gu, '').length;
  if (compactLength <= Math.max(3, Math.floor(width * 3))) {
    return {};
  }
  if (compactLength <= Math.max(5, Math.floor(width * 4))) {
    return {
      fontSize: 9,
      lineHeight: '10px'
    };
  }
  if (compactLength <= Math.max(7, Math.floor(width * 6))) {
    return {
      fontSize: 8.5,
      lineHeight: '9px'
    };
  }
  return {
    fontSize: 7.5,
    lineHeight: '8px'
  };
}

// Symbol geometry adapted from the public-domain Commodore logo SVG on Wikimedia Commons.
function CommodoreLogoMark(
  props: { readonly style?: React.CSSProperties }
): React.ReactElement {
  return (
    <svg
      aria-hidden='true'
      focusable='false'
      preserveAspectRatio='xMidYMid meet'
      style={props.style}
      viewBox='0 0 108.5 105.3'
    >
      <path
        d='m52.625 0c-29.054 0-52.625 23.571-52.625 52.625s23.571 52.594 52.625 52.594c5.5874 0 10.98-0.88711 16.031-2.5v-26.25c-4.3621 2.5362-9.4669 4-14.938 4-15.988 0-28.938-12.465-28.938-27.844s12.95-27.844 28.938-27.844c5.4706 0 10.575 1.4638 14.938 4v-26.281c-5.0513-1.6148-10.444-2.5-16.031-2.5z'
        fill='currentColor'
      />
      <path
        d='M108.35 32.62 90.8 50.87H69.13V32.62h39.22ZM108.35 72.82 90.8 54.57H69.13v18.25h39.22Z'
        fill='currentColor'
      />
    </svg>
  );
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '8px 10px',
    borderBottom: '1px solid var(--theia-panel-border)'
  } satisfies React.CSSProperties,
  heading: {
    minWidth: 0,
    flex: '0 1 240px'
  } satisfies React.CSSProperties,
  machineSelect: {
    width: '100%',
    maxWidth: 240,
    minWidth: 0,
    height: 24,
    color: 'var(--theia-dropdown-foreground)',
    background: 'var(--theia-dropdown-background)',
    border: '1px solid var(--theia-dropdown-border)',
    borderRadius: 2,
    font: 'inherit',
    fontSize: 13,
    lineHeight: '22px'
  } satisfies React.CSSProperties,
  frameRate: {
    color: 'var(--theia-descriptionForeground)',
    fontSize: 12,
    lineHeight: '22px',
    minWidth: 46,
    whiteSpace: 'nowrap'
  } satisfies React.CSSProperties,
  frameRateDisabled: {
    color: 'var(--theia-disabledForeground)'
  } satisfies React.CSSProperties,
  controls: {
    display: 'flex',
    flexShrink: 0,
    alignItems: 'center',
    gap: 6
  } satisfies React.CSSProperties,
  powerSwitch: {
    position: 'relative',
    width: 42,
    height: 22,
    flexShrink: 0,
    padding: 0,
    borderRadius: 11,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--theia-button-border, transparent)',
    boxSizing: 'border-box',
    cursor: 'pointer',
    transition: 'background 120ms ease, border-color 120ms ease'
  } satisfies React.CSSProperties,
  powerSwitchOff: {
    background: 'var(--theia-input-background)',
    borderColor: 'var(--theia-input-border)'
  } satisfies React.CSSProperties,
  powerSwitchOn: {
    background: 'var(--theia-button-background)',
    borderColor: 'var(--theia-button-background)'
  } satisfies React.CSSProperties,
  powerSwitchDisabled: {
    cursor: 'default',
    opacity: 0.65
  } satisfies React.CSSProperties,
  powerSwitchThumb: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 16,
    height: 16,
    borderRadius: '50%',
    background: 'var(--theia-button-foreground)',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.35)',
    transition: 'transform 120ms ease, background 120ms ease'
  } satisfies React.CSSProperties,
  powerSwitchThumbOff: {
    transform: 'translateX(0)',
    background: 'var(--theia-input-foreground)'
  } satisfies React.CSSProperties,
  powerSwitchThumbOn: {
    transform: 'translateX(20px)'
  } satisfies React.CSSProperties,
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    minWidth: 58,
    justifyContent: 'center'
  } satisfies React.CSSProperties,
  screen: {
    position: 'relative',
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    overflow: 'auto',
    padding: 0,
    background: 'var(--theia-editor-background)'
  } satisfies React.CSSProperties,
  viewport: {
    position: 'relative',
    maxWidth: '100%',
    maxHeight: 'calc(100% - 20px)',
    width: '100%',
    height: 'auto',
    flexShrink: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid #000',
    boxSizing: 'border-box',
    background: '#000'
  } satisfies React.CSSProperties,
  canvas: {
    display: 'block',
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
  } satisfies React.CSSProperties,
  menuHint: {
    flexShrink: 0,
    minHeight: 20,
    lineHeight: '20px',
    color: 'var(--theia-descriptionForeground)',
    fontSize: 11,
    textAlign: 'center'
  } satisfies React.CSSProperties,
  virtualKeyboardOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    bottom: 8,
    zIndex: 3,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    padding: 0,
    boxSizing: 'border-box',
    background: 'transparent',
    pointerEvents: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none'
  } satisfies React.CSSProperties,
  virtualKeyboardPanel: {
    width: 'min(100%, 620px)',
    maxHeight: '50%',
    overflow: 'auto',
    boxSizing: 'border-box',
    padding: 6,
    borderRadius: 6,
    border: '1px solid var(--theia-editorWidget-border, var(--theia-panel-border))',
    background: 'var(--theia-editorWidget-background, var(--theia-editor-background))',
    boxShadow: '0 6px 18px rgba(0, 0, 0, 0.34)',
    pointerEvents: 'auto',
    userSelect: 'none',
    WebkitUserSelect: 'none'
  } satisfies React.CSSProperties,
  virtualKeyboardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 4,
    cursor: 'move',
    touchAction: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none'
  } satisfies React.CSSProperties,
  virtualKeyboardTitleBlock: {
    minWidth: 0
  } satisfies React.CSSProperties,
  virtualKeyboardKicker: {
    color: 'var(--theia-descriptionForeground)',
    fontSize: 9,
    lineHeight: '11px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  } satisfies React.CSSProperties,
  virtualKeyboardTitle: {
    color: 'var(--theia-foreground)',
    fontSize: 11,
    fontWeight: 600,
    lineHeight: '13px',
    letterSpacing: 0
  } satisfies React.CSSProperties,
  virtualKeyboardCloseButton: {
    width: 22,
    minWidth: 22,
    height: 20,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    flexShrink: 0,
    cursor: 'pointer'
  } satisfies React.CSSProperties,
  virtualKeyboardRows: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3
  } satisfies React.CSSProperties,
  virtualKeyboardRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: 3,
    minWidth: 0
  } satisfies React.CSSProperties,
  virtualKeyboardKey: {
    position: 'relative',
    minHeight: 24,
    maxWidth: 78,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    padding: '3px 2px',
    borderRadius: 4,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--theia-input-border)',
    color: 'var(--theia-foreground)',
    background: 'var(--theia-input-background)',
    font: 'inherit',
    fontSize: 11,
    fontWeight: 600,
    lineHeight: '12px',
    letterSpacing: 0,
    textAlign: 'center',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    cursor: 'pointer',
    userSelect: 'none',
    WebkitUserSelect: 'none'
  } satisfies React.CSSProperties,
  virtualKeyboardKeyActive: {
    borderColor: '#6fd25f',
    color: '#111111',
    background: '#a9ff9f',
    boxShadow: '0 0 0 1px #6fd25f inset'
  } satisfies React.CSSProperties,
  virtualKeyboardKeyDisabled: {
    cursor: 'default',
    opacity: 0.52
  } satisfies React.CSSProperties,
  virtualKeyboardFunctionKey: {
    color: 'var(--theia-button-secondaryForeground)',
    background: 'var(--theia-button-secondaryBackground)'
  } satisfies React.CSSProperties,
  virtualKeyboardModifierKey: {
    color: 'var(--theia-button-foreground)',
    background: 'var(--theia-button-background)'
  } satisfies React.CSSProperties,
  virtualKeyboardSystemKey: {
    color: 'var(--theia-descriptionForeground)',
    background: 'var(--theia-editor-background)'
  } satisfies React.CSSProperties,
  virtualKeyboardSpaceKey: {
    color: 'var(--theia-foreground)',
    background: 'var(--theia-editor-background)'
  } satisfies React.CSSProperties,
  virtualKeyboardTextFace: {
    width: '100%',
    minWidth: 0,
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: '12px',
    whiteSpace: 'normal',
    overflow: 'hidden',
    textAlign: 'center',
    userSelect: 'none',
    WebkitUserSelect: 'none'
  } satisfies React.CSSProperties,
  virtualKeyboardTextLine: {
    display: 'block',
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'clip'
  } satisfies React.CSSProperties,
  virtualKeyboardKeyLayerLabel: {
    color: 'inherit',
    fontWeight: 600
  } satisfies React.CSSProperties,
  virtualKeyboardGlyph: {
    width: '1em',
    height: '1em',
    display: 'block',
    overflow: 'visible'
  } satisfies React.CSSProperties,
  virtualKeyboardCommodoreLogo: {
    width: '1.35em',
    height: '1.35em',
    display: 'block',
    userSelect: 'none',
    WebkitUserSelect: 'none'
  } satisfies React.CSSProperties
};

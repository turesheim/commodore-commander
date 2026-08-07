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
  COMMODORE_MACHINE_PROFILE_PREFERENCE,
  COMMODORE_MACHINE_PROFILE_WIDGET_ID,
  CommodoreMachineProfileSelectionService
} from './commodore-machine-profile-selection';

type ViceRuntimeOwner = 'debug' | 'standalone';
type ViceEmbedRenderableFrame = CommodoreViceEmbedFrameEvent | ViceEmbedBinaryFrame;
type ViceEmbedFrameBytes =
  | Uint8Array<ArrayBufferLike>
  | Uint8ClampedArray<ArrayBufferLike>;

const VICE_MENU_KEY = {
  code: 'F12',
  key: 'F12',
  keyCode: 123,
  repeat: false,
  shift: false,
  ctrl: false,
  alt: false,
  meta: false
} as const;

const MOUSE_CAPTURE_MAX_RELATIVE_DELTA = 63;
const MOUSE_CAPTURE_MIN_RELATIVE_DELTA = 2;
const MOUSE_CAPTURE_JITTER_HOLD_MS = 120;

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
  protected canvas: HTMLCanvasElement | undefined;
  protected frame: ViceEmbedRenderableFrame | undefined;
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

  @postConstruct()
  protected init(): void {
    this.id = COMMODORE_MACHINE_PROFILE_WIDGET_ID;
    this.title.label = 'Machine';
    this.title.caption = 'Commodore Machine and VICE';
    this.title.iconClass = codicon('circuit-board');
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
    document.addEventListener('mousedown', this.handleCapturedMouseButtonDown, true);
    document.addEventListener('mouseup', this.handleCapturedMouseButtonUp, true);
    document.addEventListener('contextmenu', this.handleCapturedContextMenu, true);
    this.toDispose.pushAll([
      Disposable.create(() => {
        document.removeEventListener('pointerlockchange', this.handlePointerLockChanged);
        document.removeEventListener('pointerlockerror', this.handlePointerLockError);
        document.removeEventListener('keydown', this.handleDocumentKeyDown, true);
        document.removeEventListener('keyup', this.handleDocumentKeyUp, true);
        document.removeEventListener('mousemove', this.handleCapturedMouseMove, true);
        document.removeEventListener('mousedown', this.handleCapturedMouseButtonDown, true);
        document.removeEventListener('mouseup', this.handleCapturedMouseButtonUp, true);
        document.removeEventListener('contextmenu', this.handleCapturedContextMenu, true);
      }),
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
    this.clearPendingMouseMove();
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
            <div style={styles.eyebrow}>Active Machine</div>
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
            <div
              style={styles.status}
              title={this.lastOutput || this.statusMessage}
            >
              {this.statusMessage}
            </div>
            <div
              style={styles.frameRate}
              title='Displayed emulator frame rate'
            >
              FPS {this.frameRate === undefined ? '--' : Math.round(this.frameRate)}
            </div>
          </div>
          <div style={styles.controls}>
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
                ? 'Release mouse capture. Press F12 to open the VICE menu without leaving capture mode. Press ESC to exit capture mode.'
                : 'Capture mouse in the emulator canvas. Press F12 to open the VICE menu. Press ESC to exit capture mode.'}
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
          style={styles.screen}
          onMouseDown={this.handleScreenMouseDown}
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
              onMouseDown={this.handleCanvasMouseDown}
              style={styles.canvas}
            />
            {!this.frame && emptyStateText && (
              <div style={styles.emptyState}>
                {emptyStateText}
              </div>
            )}
          </div>
          <div style={styles.menuHint}>
            Press F12 for emulated machine menu.
          </div>
        </div>
      </div>
    );
  }

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
    this.resetFrameRate();
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
    const session = this.currentEmbeddedViceDebugSession();
    if (session && this.runtimeOwner !== 'standalone') {
      await this.debugSessionManager.terminateSession(session);
      return;
    }

    await this.viceEmbedService.stop();
    this.runtimeOwner = undefined;
    this.activeDebugSessionId = undefined;
    this.frame = undefined;
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
      this.resetFrameRate();
      this.releaseMouseCapture();
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
    if (shouldUpdate || frameRateChanged) {
      this.update();
    }
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
    this.handleViceMenuShortcut(event, true);
  };

  protected readonly handleDocumentKeyUp = (event: KeyboardEvent): void => {
    this.handleViceMenuShortcut(event, false);
  };

  protected handleViceMenuShortcut(event: KeyboardEvent, pressed: boolean): void {
    if (!this.shouldHandleViceMenuShortcut(event)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (!pressed || event.repeat) {
      return;
    }
    void this.openViceMenu();
  }

  protected shouldHandleViceMenuShortcut(event: KeyboardEvent): boolean {
    if (!this.isPowered() || this.starting || !isViceMenuKeyEvent(event)) {
      return false;
    }
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
    const frame = this.frame;
    if (!canvas || !frame) {
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
    const imageData = new ImageData(toClampedBytes(bytes), frame.width, frame.height);
    context.putImageData(imageData, 0, 0);
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

function isViceMenuKeyEvent(event: Pick<KeyboardEvent, 'code' | 'key' | 'keyCode'>): boolean {
  return event.code === VICE_MENU_KEY.code ||
    event.key === VICE_MENU_KEY.key ||
    event.keyCode === VICE_MENU_KEY.keyCode;
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
  machineSelect: {
    width: '100%',
    maxWidth: 240,
    minWidth: 0,
    height: 24,
    marginTop: 3,
    color: 'var(--theia-dropdown-foreground)',
    background: 'var(--theia-dropdown-background)',
    border: '1px solid var(--theia-dropdown-border)',
    borderRadius: 2,
    font: 'inherit',
    fontSize: 13,
    lineHeight: '22px'
  } satisfies React.CSSProperties,
  status: {
    color: 'var(--theia-descriptionForeground)',
    fontSize: 12,
    lineHeight: 1.35,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  } satisfies React.CSSProperties,
  frameRate: {
    color: 'var(--theia-descriptionForeground)',
    fontSize: 12,
    lineHeight: 1.35,
    marginTop: 2,
    whiteSpace: 'nowrap'
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
    border: '1px solid var(--theia-button-border, transparent)',
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
    overflow: 'hidden',
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
  } satisfies React.CSSProperties
};

import { isCancelled } from '@theia/core/lib/common';
import { CHANNEL_ON_WINDOW_EVENT } from '@theia/core/lib/electron-common/electron-api';
import { ContainerModule } from '@theia/core/shared/inversify';
import { app, BrowserWindow, powerMonitor } from 'electron';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  COMMODORE_COMMANDER_SYSTEM_RESUME_EVENT,
  COMMODORE_COMMANDER_SYSTEM_SUSPEND_EVENT
} from '../common/commodore-commander-electron-events';

const cancellationFilterInstalled = Symbol.for(
  'commodoreCommander.electronMain.cancellationFilterInstalled'
);
const sleepResumeEventsInstalled = Symbol.for(
  'commodoreCommander.electronMain.sleepResumeEventsInstalled'
);
const screenCaptureConfigEnv = 'COMMODORE_COMMANDER_SCREEN_CAPTURE_CONFIG';
const screenCaptureApiKey = '__commodoreCommanderScreenCaptureApi';
const renderRecoveryAfterResumeMs = 30000;
const renderRecoveryReloadTimeoutMs = 1000;

type RenderProcessGoneReason = Electron.RenderProcessGoneDetails['reason'];

const windowsWithRendererRecovery = new WeakSet<BrowserWindow>();
const windowsBeingReloaded = new WeakSet<BrowserWindow>();
let recoverRenderersAfterResumeUntil = 0;

export default new ContainerModule(() => {
  installCancellationRejectionFilter();
  installSleepResumeWindowEvents();
  installElectronScreenCapture();
});

function installCancellationRejectionFilter(): void {
  const globalState = globalThis as Record<symbol, boolean>;
  if (globalState[cancellationFilterInstalled]) {
    return;
  }
  globalState[cancellationFilterInstalled] = true;

  process.on('unhandledRejection', (reason) => {
    if (isTheiaCancellation(reason)) {
      return;
    }
    console.error('Unhandled promise rejection in Electron main process.', reason);
  });
}

function isTheiaCancellation(reason: unknown): boolean {
  return reason instanceof Error
    ? isCancelled(reason) || reason.message === 'Cancelled'
    : false;
}

function installSleepResumeWindowEvents(): void {
  const globalState = globalThis as Record<symbol, boolean>;
  if (globalState[sleepResumeEventsInstalled]) {
    return;
  }
  globalState[sleepResumeEventsInstalled] = true;

  void app.whenReady().then(() => {
    BrowserWindow.getAllWindows().forEach((window) => attachRendererRecovery(window));
    app.on('browser-window-created', (_event, window) => {
      attachRendererRecovery(window);
    });

    powerMonitor.on('suspend', () => {
      recoverRenderersAfterResumeUntil = 0;
      sendWindowEventToAllWindows(COMMODORE_COMMANDER_SYSTEM_SUSPEND_EVENT);
    });
    powerMonitor.on('resume', () => {
      recoverRenderersAfterResumeUntil = Date.now() + renderRecoveryAfterResumeMs;
      recoverCrashedWindowsAfterResume();
      setTimeout(() => {
        recoverCrashedWindowsAfterResume();
        sendWindowEventToAllWindows(COMMODORE_COMMANDER_SYSTEM_RESUME_EVENT);
      }, renderRecoveryReloadTimeoutMs);
    });
  });
}

function attachRendererRecovery(window: BrowserWindow): void {
  if (windowsWithRendererRecovery.has(window)) {
    return;
  }
  windowsWithRendererRecovery.add(window);

  window.webContents.on('render-process-gone', (_event, details) => {
    if (!shouldReloadAfterRendererExit(details.reason)) {
      return;
    }
    console.warn(
      `Commodore Commander renderer exited (${details.reason}, exit code ${details.exitCode}); reloading window.`
    );
    reloadWindowIgnoringCache(window, `renderer process exited with ${details.reason}`);
  });

  window.on('unresponsive', () => {
    if (Date.now() > recoverRenderersAfterResumeUntil) {
      return;
    }

    console.warn('Commodore Commander renderer became unresponsive after system resume; restarting renderer.');
    try {
      if (!window.isDestroyed() && !window.webContents.isDestroyed() && !window.webContents.isCrashed()) {
        window.webContents.forcefullyCrashRenderer();
      }
    } catch (error) {
      console.warn('Could not crash unresponsive renderer after system resume.', error);
    }

    setTimeout(() => {
      reloadWindowIgnoringCache(window, 'renderer stayed unresponsive after system resume');
    }, renderRecoveryReloadTimeoutMs);
  });
}

function shouldReloadAfterRendererExit(reason: RenderProcessGoneReason): boolean {
  return reason === 'abnormal-exit' ||
    reason === 'killed' ||
    reason === 'crashed' ||
    reason === 'oom';
}

function recoverCrashedWindowsAfterResume(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed() || window.webContents.isDestroyed()) {
      continue;
    }
    attachRendererRecovery(window);
    if (window.webContents.isCrashed()) {
      reloadWindowIgnoringCache(window, 'renderer was crashed after system resume');
    }
  }
}

function reloadWindowIgnoringCache(window: BrowserWindow, reason: string): void {
  if (
    windowsBeingReloaded.has(window) ||
    window.isDestroyed() ||
    window.webContents.isDestroyed()
  ) {
    return;
  }

  windowsBeingReloaded.add(window);
  console.warn(`Reloading Commodore Commander window: ${reason}.`);
  try {
    window.webContents.reloadIgnoringCache();
  } catch (error) {
    windowsBeingReloaded.delete(window);
    console.warn(`Could not reload Commodore Commander window: ${reason}.`, error);
    return;
  }

  const clearReloading = (): void => {
    windowsBeingReloaded.delete(window);
  };
  window.webContents.once('did-finish-load', clearReloading);
  setTimeout(clearReloading, 10000);
}

function sendWindowEventToAllWindows(event: string): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!canSendWindowEvent(window)) {
      continue;
    }
    try {
      window.webContents.send(CHANNEL_ON_WINDOW_EVENT, event);
    } catch (error) {
      console.warn(`Could not send Electron window event "${event}".`, error);
    }
  }
}

function canSendWindowEvent(window: BrowserWindow): boolean {
  if (
    window.isDestroyed() ||
    window.webContents.isDestroyed() ||
    window.webContents.isCrashed()
  ) {
    return false;
  }

  try {
    void window.webContents.mainFrame;
    return true;
  } catch {
    return false;
  }
}

interface ElectronScreenCaptureConfig {
  readonly outputDir: string;
  readonly sourcePath: string;
  readonly timeoutMs: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly captures: readonly ElectronScreenCapture[];
}

interface ElectronScreenCapture {
  readonly outputPath: string;
  readonly sourcePath?: string;
  readonly source?: string;
  readonly marker?: ScreenCaptureMarker;
  readonly steps?: readonly ElectronScreenCaptureStep[];
  readonly afterSteps?: readonly ElectronScreenCaptureStep[];
}

interface ScreenCaptureMarker {
  readonly needle?: string;
  readonly offset?: number;
}

type ElectronScreenCaptureStep =
  | {
      readonly type: 'executeCommand';
      readonly commandId: string;
      readonly args?: readonly unknown[];
    }
  | {
      readonly type: 'continueDebugSession';
      readonly reason?: string;
    }
  | { readonly type: 'collapseBottomPanel' }
  | { readonly type: 'openSourceFile'; readonly filePath: string }
  | { readonly type: 'runEditorAction'; readonly actionId: string }
  | { readonly type: 'showMnemonicHover' }
  | { readonly type: 'showReferences' }
  | { readonly type: 'openDebugView' }
  | { readonly type: 'openEmulatorView' }
  | { readonly type: 'openC64VisualDebugger' }
  | { readonly type: 'openMachineView' }
  | { readonly type: 'openMemoryView' }
  | { readonly type: 'openOutlineView' }
  | { readonly type: 'openSidSfxEditor' }
  | { readonly type: 'prepareC64VisualDebuggerDemoState' }
  | { readonly type: 'powerOffMachine' }
  | { readonly type: 'revealMemoryTextColumn' }
  | {
      readonly type: 'editInputValue';
      readonly selector: string;
      readonly value: string;
      readonly commit?: 'blur' | 'enter';
      readonly timeoutMs?: number;
    }
  | {
      readonly type: 'setEditorMarker';
      readonly marker?: ScreenCaptureMarker;
    }
  | {
      readonly type: 'setSourceBreakpoint';
      readonly marker?: ScreenCaptureMarker;
    }
  | { readonly type: 'showScreenMemory' }
  | {
      readonly type: 'showMachineVirtualKeyboard';
      readonly timeoutMs?: number;
    }
  | {
      readonly type: 'showMemoryRange';
      readonly expression: string;
      readonly length?: string;
      readonly bytesPerRow?: number;
      readonly textMode?: string;
    }
  | {
      readonly type: 'showC64VisualDebuggerView';
      readonly view: string;
    }
  | {
      readonly type: 'startLaunchConfiguration';
      readonly name: string;
      readonly configuration?: unknown;
      readonly workspaceFolderUri?: string;
    }
  | { readonly type: 'stopDebugSession' }
  | {
      readonly type: 'waitForVisibleText';
      readonly selector: string;
      readonly text: string;
      readonly timeoutMs?: number;
    }
  | {
      readonly type: 'clickVisibleText';
      readonly selector: string;
      readonly text: string;
      readonly timeoutMs?: number;
    }
  | {
      readonly type: 'waitForInputValue';
      readonly selector: string;
      readonly value: string;
      readonly timeoutMs?: number;
    }
  | {
      readonly type: 'waitForBodyText';
      readonly text: string;
      readonly timeoutMs?: number;
    }
  | {
      readonly type: 'waitForDebugStopped';
      readonly reason?: string;
      readonly timeoutMs?: number;
    }
  | {
      readonly type: 'waitForC64BasicReady';
      readonly timeoutMs?: number;
    }
  | { readonly type: 'wait'; readonly ms: number };

function installElectronScreenCapture(): void {
  const configPath = process.env[screenCaptureConfigEnv];
  if (!configPath) {
    return;
  }

  const config = readScreenCaptureConfig(configPath);
  let started = false;
  const startupTimer = setTimeout(() => {
    if (started) {
      return;
    }
    console.error('Timed out waiting for the Electron Theia frontend.');
    app.exit(1);
  }, config.timeoutMs);

  app.on('browser-window-created', (_event, window) => {
    void startWhenScreenCaptureApiIsReady(window, config, () => started)
      .then(async (ready) => {
        if (!ready || started) {
          return;
        }
        started = true;
        clearTimeout(startupTimer);
        await runElectronScreenCapture(window, config);
      })
      .catch((error) => {
        started = true;
        clearTimeout(startupTimer);
        console.error(screenCaptureErrorMessage(error));
        app.exit(1);
      });
  });
}

function readScreenCaptureConfig(configPath: string): ElectronScreenCaptureConfig {
  const raw = JSON.parse(readFileSync(configPath, 'utf8')) as Partial<
    ElectronScreenCaptureConfig
  >;
  if (!raw.outputDir || !raw.sourcePath || !raw.captures) {
    throw new Error(`Invalid screen capture config: ${configPath}`);
  }
  return {
    outputDir: raw.outputDir,
    sourcePath: raw.sourcePath,
    timeoutMs: raw.timeoutMs ?? 60000,
    viewportWidth: raw.viewportWidth ?? 1280,
    viewportHeight: raw.viewportHeight ?? 800,
    captures: raw.captures
  };
}

async function startWhenScreenCaptureApiIsReady(
  window: BrowserWindow,
  config: ElectronScreenCaptureConfig,
  isStarted: () => boolean
): Promise<boolean> {
  while (!window.isDestroyed() && !isStarted()) {
    const ready = await evaluateInWindow<boolean>(
      window,
      `Boolean(window[${JSON.stringify(screenCaptureApiKey)}]?.openSourceFile)`,
      false
    );
    if (ready) {
      return true;
    }
    await delay(250);
  }
  return false;
}

async function runElectronScreenCapture(
  window: BrowserWindow,
  config: ElectronScreenCaptureConfig
): Promise<void> {
  window.setContentSize(config.viewportWidth, config.viewportHeight);
  window.webContents.setZoomFactor(1);
  window.show();
  window.focus();

  const opened = await callScreenCaptureApi<boolean>(
    window,
    'openSourceFile',
    [config.sourcePath],
    false,
    config.timeoutMs
  );
  if (!opened) {
    throw new Error(`Unable to open screen capture source: ${config.sourcePath}`);
  }

  await waitForBodyText(window, 'Kick Assembler', config.timeoutMs);
  await waitForBodyText(window, 'lib/shared.asm', config.timeoutMs);
  await waitForCondition(
    window,
    `!document.querySelector('.theia-preload')`,
    config.timeoutMs
  );
  await callScreenCaptureApi<boolean>(
    window,
    'openOutlineView',
    [],
    false
  );
  await delay(250);

  for (const capture of config.captures) {
    await clearTransientUi(window);
    if (capture.sourcePath) {
      const opened = await callScreenCaptureApi<boolean>(
        window,
        'openSourceFile',
        [capture.sourcePath],
        false,
        config.timeoutMs
      );
      if (!opened) {
        throw new Error(`Unable to open screen capture source: ${capture.sourcePath}`);
      }
    }
    if (capture.source !== undefined) {
      await setEditorSource(window, capture.source, capture.marker, config.timeoutMs);
    }
    for (const step of capture.steps ?? []) {
      await runScreenCaptureStep(window, step, config.timeoutMs);
    }
    await capturePage(window, capture.outputPath);
    for (const step of capture.afterSteps ?? []) {
      await runScreenCaptureStep(window, step, config.timeoutMs);
    }
  }

  console.log(`Captured Theia screenshots in ${config.outputDir}`);
  app.exit(0);
}

async function runScreenCaptureStep(
  window: BrowserWindow,
  step: ElectronScreenCaptureStep,
  timeoutMs: number
): Promise<void> {
  console.log(`Screen capture step: ${step.type}`);
  switch (step.type) {
    case 'executeCommand': {
      const executed = await callScreenCaptureApi<boolean>(
        window,
        'executeCommand',
        [step.commandId, step.args ?? []],
        false,
        timeoutMs
      );
      if (!executed) {
        throw new Error(`Unable to execute command: ${step.commandId}`);
      }
      return;
    }
    case 'continueDebugSession': {
      const continued = await callScreenCaptureApi<boolean>(
        window,
        'continueDebugSession',
        [step.reason],
        false,
        timeoutMs
      );
      if (!continued) {
        throw new Error('Unable to continue debug session.');
      }
      return;
    }
    case 'collapseBottomPanel': {
      const collapsed = await callScreenCaptureApi<boolean>(
        window,
        'collapseBottomPanel',
        [],
        false,
        timeoutMs
      );
      if (!collapsed) {
        throw new Error('Unable to collapse bottom panel.');
      }
      return;
    }
    case 'openSourceFile': {
      const opened = await callScreenCaptureApi<boolean>(
        window,
        'openSourceFile',
        [step.filePath],
        false,
        timeoutMs
      );
      if (!opened) {
        throw new Error(`Unable to open screen capture source: ${step.filePath}`);
      }
      return;
    }
    case 'runEditorAction': {
      const ran = await callScreenCaptureApi<boolean>(
        window,
        'runEditorAction',
        [step.actionId],
        false,
        timeoutMs
      );
      if (!ran) {
        throw new Error(`Unable to run editor action: ${step.actionId}`);
      }
      return;
    }
    case 'showMnemonicHover': {
      const showed = await callScreenCaptureApi<boolean>(
        window,
        'showMnemonicHover',
        [],
        false,
        timeoutMs
      );
      if (!showed) {
        throw new Error('Unable to show mnemonic hover.');
      }
      return;
    }
    case 'showReferences': {
      const showed = await callScreenCaptureApi<boolean>(
        window,
        'showReferences',
        [],
        false,
        timeoutMs
      );
      if (!showed) {
        throw new Error('Unable to show references.');
      }
      return;
    }
    case 'openDebugView': {
      const opened = await callScreenCaptureApi<boolean>(
        window,
        'openDebugView',
        [],
        false,
        timeoutMs
      );
      if (!opened) {
        throw new Error('Unable to open debug view.');
      }
      return;
    }
    case 'openEmulatorView': {
      const opened = await callScreenCaptureApi<boolean>(
        window,
        'openEmulatorView',
        [],
        false,
        timeoutMs
      );
      if (!opened) {
        throw new Error('Unable to open emulator view.');
      }
      return;
    }
    case 'openC64VisualDebugger': {
      const opened = await callScreenCaptureApi<boolean>(
        window,
        'openC64VisualDebugger',
        [],
        false,
        timeoutMs
      );
      if (!opened) {
        throw new Error('Unable to open C64 Visual Debugger.');
      }
      return;
    }
    case 'openMachineView': {
      const opened = await callScreenCaptureApi<boolean>(
        window,
        'openMachineView',
        [],
        false,
        timeoutMs
      );
      if (!opened) {
        throw new Error('Unable to open Machine view.');
      }
      return;
    }
    case 'openMemoryView': {
      const opened = await callScreenCaptureApi<boolean>(
        window,
        'openMemoryView',
        [],
        false,
        timeoutMs
      );
      if (!opened) {
        throw new Error('Unable to open memory view.');
      }
      return;
    }
    case 'openOutlineView': {
      const opened = await callScreenCaptureApi<boolean>(
        window,
        'openOutlineView',
        [],
        false,
        timeoutMs
      );
      if (!opened) {
        throw new Error('Unable to open outline view.');
      }
      return;
    }
    case 'openSidSfxEditor': {
      const opened = await callScreenCaptureApi<boolean>(
        window,
        'openSidSfxEditor',
        [],
        false,
        timeoutMs
      );
      if (!opened) {
        throw new Error('Unable to open SID SFX editor.');
      }
      return;
    }
    case 'powerOffMachine': {
      const poweredOff = await callScreenCaptureApi<boolean>(
        window,
        'powerOffMachine',
        [],
        false,
        timeoutMs
      );
      if (!poweredOff) {
        throw new Error('Unable to power off Machine view emulator.');
      }
      return;
    }
    case 'prepareC64VisualDebuggerDemoState': {
      const prepared = await callScreenCaptureApi<boolean>(
        window,
        'prepareC64VisualDebuggerDemoState',
        [],
        false,
        timeoutMs
      );
      if (!prepared) {
        throw new Error('Unable to prepare C64 Visual Debugger demo state.');
      }
      return;
    }
    case 'revealMemoryTextColumn': {
      const revealed = await callScreenCaptureApi<boolean>(
        window,
        'revealMemoryTextColumn',
        [],
        false,
        timeoutMs
      );
      if (!revealed) {
        throw new Error('Unable to reveal memory text column.');
      }
      return;
    }
    case 'editInputValue': {
      await editInputValue(
        window,
        step.selector,
        step.value,
        step.commit ?? 'blur',
        step.timeoutMs ?? timeoutMs
      );
      return;
    }
    case 'setEditorMarker': {
      const marked = await callScreenCaptureApi<boolean>(
        window,
        'setEditorMarker',
        [step.marker],
        false,
        timeoutMs
      );
      if (!marked) {
        throw new Error('Unable to set editor marker.');
      }
      return;
    }
    case 'setSourceBreakpoint': {
      const set = await callScreenCaptureApi<boolean>(
        window,
        'setSourceBreakpoint',
        [step.marker],
        false,
        timeoutMs
      );
      if (!set) {
        throw new Error('Unable to set source breakpoint.');
      }
      return;
    }
    case 'showScreenMemory': {
      const shown = await callScreenCaptureApi<boolean>(
        window,
        'showScreenMemory',
        [],
        false,
        timeoutMs
      );
      if (!shown) {
        throw new Error('Unable to show screen memory preset.');
      }
      return;
    }
    case 'showMachineVirtualKeyboard': {
      const waitTimeoutMs = step.timeoutMs ?? timeoutMs;
      const shown = await callScreenCaptureApi<boolean>(
        window,
        'showMachineVirtualKeyboard',
        [waitTimeoutMs],
        false,
        waitTimeoutMs + 1000
      );
      if (!shown) {
        throw new Error('Unable to show Machine view virtual keyboard.');
      }
      return;
    }
    case 'showMemoryRange': {
      const shown = await callScreenCaptureApi<boolean>(
        window,
        'showMemoryRange',
        [step.expression, step.length, step.bytesPerRow, step.textMode],
        false,
        timeoutMs
      );
      if (!shown) {
        throw new Error(`Unable to show memory range: ${step.expression}`);
      }
      return;
    }
    case 'showC64VisualDebuggerView': {
      const shown = await callScreenCaptureApi<boolean>(
        window,
        'showC64VisualDebuggerView',
        [step.view],
        false,
        timeoutMs
      );
      if (!shown) {
        throw new Error(`Unable to show C64 Visual Debugger view: ${step.view}`);
      }
      return;
    }
    case 'startLaunchConfiguration': {
      const started = await callScreenCaptureApi<boolean>(
        window,
        'startLaunchConfiguration',
        [step.name, step.configuration, step.workspaceFolderUri],
        false,
        timeoutMs
      );
      if (!started) {
        throw new Error(`Unable to start launch configuration: ${step.name}`);
      }
      return;
    }
    case 'stopDebugSession': {
      const stopped = await callScreenCaptureApi<boolean>(
        window,
        'stopDebugSession',
        [],
        false,
        timeoutMs
      );
      if (!stopped) {
        throw new Error('Unable to stop debug session.');
      }
      return;
    }
    case 'waitForVisibleText':
      await waitForVisibleText(
        window,
        step.selector,
        step.text,
        step.timeoutMs ?? timeoutMs
      );
      return;
    case 'clickVisibleText':
      await clickVisibleText(
        window,
        step.selector,
        step.text,
        step.timeoutMs ?? timeoutMs
      );
      return;
    case 'waitForInputValue':
      await waitForInputValue(
        window,
        step.selector,
        step.value,
        step.timeoutMs ?? timeoutMs
      );
      return;
    case 'waitForBodyText':
      await waitForBodyText(window, step.text, step.timeoutMs ?? timeoutMs);
      return;
    case 'waitForDebugStopped': {
      const waitTimeoutMs = step.timeoutMs ?? timeoutMs;
      const stopped = await callScreenCaptureApi<boolean>(
        window,
        'waitForDebugStopped',
        [step.reason, waitTimeoutMs],
        false,
        waitTimeoutMs + 1000
      );
      if (!stopped) {
        throw new Error(
          step.reason
            ? `Timed out waiting for debug stop reason: ${step.reason}`
            : 'Timed out waiting for debug stop.'
        );
      }
      return;
    }
    case 'waitForC64BasicReady': {
      const waitTimeoutMs = step.timeoutMs ?? timeoutMs;
      const ready = await callScreenCaptureApi<boolean>(
        window,
        'waitForC64BasicReady',
        [waitTimeoutMs],
        false,
        waitTimeoutMs + 1000
      );
      if (!ready) {
        throw new Error('Timed out waiting for the C64 BASIC ready screen.');
      }
      return;
    }
    case 'wait':
      await delay(step.ms);
      return;
  }
}

async function setEditorSource(
  window: BrowserWindow,
  source: string,
  marker: ScreenCaptureMarker | undefined,
  timeoutMs: number
): Promise<void> {
  const updated = await callScreenCaptureApi<boolean>(
    window,
    'setEditorSource',
    [source, marker],
    false,
    timeoutMs
  );
  if (!updated) {
    throw new Error('Unable to set screenshot editor source.');
  }
  await delay(300);
}

async function editInputValue(
  window: BrowserWindow,
  selector: string,
  value: string,
  commit: 'blur' | 'enter',
  timeoutMs: number
): Promise<void> {
  await waitForCondition(
    window,
    `(() => {
      const input = document.querySelector(${JSON.stringify(selector)});
      if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) {
        return false;
      }
      const rect = input.getBoundingClientRect();
      const style = window.getComputedStyle(input);
      return rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        !input.readOnly &&
        !input.disabled;
    })()`,
    timeoutMs,
    `Timed out waiting for editable input: ${selector}.`
  );

  const edited = await evaluateInWindow<boolean>(
    window,
    `(() => {
      const input = document.querySelector(${JSON.stringify(selector)});
      if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) {
        return false;
      }
      input.focus();
      input.select?.();
      input.value = ${JSON.stringify(value)};
      input.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        data: ${JSON.stringify(value)},
        inputType: 'insertText'
      }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      if (${JSON.stringify(commit)} === 'enter') {
        const eventInit = {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true
        };
        input.dispatchEvent(new KeyboardEvent('keydown', eventInit));
        input.dispatchEvent(new KeyboardEvent('keyup', eventInit));
      } else {
        input.blur();
      }
      input.dispatchEvent(new FocusEvent('blur', {
        bubbles: false,
        cancelable: false
      }));
      input.dispatchEvent(new FocusEvent('focusout', {
        bubbles: true,
        cancelable: false
      }));
      return true;
    })()`,
    false,
    timeoutMs
  );
  if (!edited) {
    throw new Error(`Unable to edit input: ${selector}`);
  }
}

async function clearTransientUi(window: BrowserWindow): Promise<void> {
  await evaluateInWindow(
    window,
    `(() => {
      const eventInit = {
        key: 'Escape',
        code: 'Escape',
        keyCode: 27,
        which: 27,
        bubbles: true,
        cancelable: true
      };
      for (const target of [document.activeElement, document.body, window]) {
        target?.dispatchEvent(new KeyboardEvent('keydown', eventInit));
        target?.dispatchEvent(new KeyboardEvent('keyup', eventInit));
      }
    })()`,
    undefined
  );
  await callScreenCaptureApi(window, 'collapseBottomPanel', [], undefined, 5000)
    .catch(() => undefined);
  await delay(150);
}

async function callScreenCaptureApi<T>(
  window: BrowserWindow,
  method: string,
  args: readonly unknown[],
  fallback: T,
  timeoutMs = 10000
): Promise<T> {
  return evaluateInWindow<T>(
    window,
    `(async () => {
      const api = window[${JSON.stringify(screenCaptureApiKey)}];
      const method = api?.[${JSON.stringify(method)}];
      if (typeof method !== 'function') {
        return ${JSON.stringify(fallback)};
      }
      return await method.apply(api, ${JSON.stringify(args)});
    })()`,
    fallback,
    timeoutMs
  );
}

async function waitForVisibleText(
  window: BrowserWindow,
  selector: string,
  text: string,
  timeoutMs: number
): Promise<void> {
  await waitForCondition(
    window,
    `(() => {
      const elements = [...document.querySelectorAll(${JSON.stringify(selector)})];
      return elements.some((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          (element.textContent ?? '').includes(${JSON.stringify(text)});
      });
    })()`,
    timeoutMs,
    `Timed out waiting for "${text}" in ${selector}.`
  );
}

async function clickVisibleText(
  window: BrowserWindow,
  selector: string,
  text: string,
  timeoutMs: number
): Promise<void> {
  await waitForVisibleText(window, selector, text, timeoutMs);
  const clicked = await evaluateInWindow<boolean>(
    window,
    `(() => {
      const elements = [...document.querySelectorAll(${JSON.stringify(selector)})];
      const element = elements.find((candidate) => {
        const rect = candidate.getBoundingClientRect();
        const style = window.getComputedStyle(candidate);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          (candidate.textContent ?? '').includes(${JSON.stringify(text)});
      });
      if (!(element instanceof HTMLElement)) {
        return false;
      }
      element.click();
      return true;
    })()`,
    false,
    timeoutMs
  );
  if (!clicked) {
    throw new Error(`Unable to click "${text}" in ${selector}.`);
  }
  await delay(150);
}

async function waitForInputValue(
  window: BrowserWindow,
  selector: string,
  value: string,
  timeoutMs: number
): Promise<void> {
  await waitForCondition(
    window,
    `(() => {
      const input = document.querySelector(${JSON.stringify(selector)});
      if (!input || !('value' in input)) {
        return false;
      }
      const rect = input.getBoundingClientRect();
      const style = window.getComputedStyle(input);
      return rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        input.value === ${JSON.stringify(value)};
    })()`,
    timeoutMs,
    `Timed out waiting for ${selector} to equal "${value}".`
  );
}

async function waitForBodyText(
  window: BrowserWindow,
  text: string,
  timeoutMs: number
): Promise<void> {
  await waitForCondition(
    window,
    `document.body.innerText.includes(${JSON.stringify(text)})`,
    timeoutMs,
    `Timed out waiting for visible text: ${text}`
  );
}

async function waitForCondition(
  window: BrowserWindow,
  expression: string,
  timeoutMs: number,
  message = 'Timed out waiting for screen capture condition.'
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const matched = await evaluateInWindow<boolean>(window, expression, false);
    if (matched) {
      return;
    }
    await delay(250);
  }
  throw new Error(message);
}

async function evaluateInWindow<T>(
  window: BrowserWindow,
  expression: string,
  fallback: T,
  timeoutMs?: number
): Promise<T> {
  if (window.isDestroyed() || window.webContents.isDestroyed()) {
    return fallback;
  }

  const evaluated = window.webContents.executeJavaScript(expression, true)
    .catch(() => fallback);
  if (timeoutMs === undefined) {
    return evaluated;
  }
  return Promise.race([
    evaluated,
    delay(timeoutMs).then(() => fallback)
  ]);
}

async function capturePage(
  window: BrowserWindow,
  outputPath: string
): Promise<void> {
  mkdirSync(path.dirname(outputPath), { recursive: true });
  const image = await window.webContents.capturePage();
  writeFileSync(outputPath, image.toPNG());
  console.log(`Captured ${outputPath}`);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function screenCaptureErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

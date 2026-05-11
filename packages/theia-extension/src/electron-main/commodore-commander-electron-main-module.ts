import { isCancelled } from '@theia/core/lib/common';
import { ContainerModule } from '@theia/core/shared/inversify';
import { app, BrowserWindow } from 'electron';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const cancellationFilterInstalled = Symbol.for(
  'commodoreCommander.electronMain.cancellationFilterInstalled'
);
const screenCaptureConfigEnv = 'COMMODORE_COMMANDER_SCREEN_CAPTURE_CONFIG';
const screenCaptureApiKey = '__commodoreCommanderScreenCaptureApi';

export default new ContainerModule(() => {
  installCancellationRejectionFilter();
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
  | { readonly type: 'openSourceFile'; readonly filePath: string }
  | { readonly type: 'runEditorAction'; readonly actionId: string }
  | { readonly type: 'showMnemonicHover' }
  | { readonly type: 'showReferences' }
  | { readonly type: 'openDebugView' }
  | { readonly type: 'openMemoryView' }
  | { readonly type: 'openOutlineView' }
  | { readonly type: 'revealMemoryTextColumn' }
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
      readonly type: 'startLaunchConfiguration';
      readonly name: string;
      readonly configuration?: unknown;
      readonly workspaceFolderUri?: string;
    }
  | {
      readonly type: 'waitForVisibleText';
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
    case 'waitForVisibleText':
      await waitForVisibleText(
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

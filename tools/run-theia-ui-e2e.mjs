#!/usr/bin/env node
import { existsSync, statSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const screenCaptureConfigEnv = 'COMMODORE_COMMANDER_SCREEN_CAPTURE_CONFIG';
const defaultOutputDir = path.join(repoRoot, 'test-results', 'theia-ui-e2e');
const debugLaunchName = 'UI E2E: Debug debug-demo in VICE';
const visualDebugLaunchName = 'UI E2E: Debug visual-debugger-demo in VICE';
const fixtureNames = ['debug-demo', 'visual-debugger-demo'];

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  assertElectronAppBuilt();
  await mkdir(options.outputDir, { recursive: true });

  const workspacePath = options.workspacePath ??
    await mkdtemp(path.join(tmpdir(), 'cc-theia-ui-e2e-workspace-'));
  const configDir = await mkdtemp(path.join(tmpdir(), 'cc-theia-ui-e2e-'));
  const configPath = path.join(configDir, 'config.json');
  const userDataDir = path.join(configDir, 'electron-user-data');

  try {
    const fixtureWorkspace = await prepareWorkspace(workspacePath, options);
    const config = createAutomationConfig(fixtureWorkspace, options);
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');

    const electronExecutable = resolveElectronExecutable();
    await runElectronAutomation(
      electronExecutable,
      configPath,
      userDataDir,
      fixtureWorkspace.workspacePath,
      options
    );
    verifyCaptureOutputs(config);
    console.log(`Theia UI e2e passed. Artifacts: ${options.outputDir}`);
  } finally {
    await rm(configDir, { recursive: true, force: true }).catch(() => undefined);
    if (!options.keepWorkspace && !options.workspacePath) {
      await rm(workspacePath, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

function parseArgs(args) {
  const options = {
    outputDir: defaultOutputDir,
    timeoutMs: 90000,
    viewportWidth: 1440,
    viewportHeight: 900,
    viceExecutable: process.env.THEIA_UI_E2E_VICE_EXECUTABLE ??
      process.env.VICE_EXECUTABLE,
    viceResourcesPath: process.env.THEIA_UI_E2E_VICE_RESOURCES_PATH ??
      process.env.VICE_RESOURCES_PATH,
    viceArgs: parseViceArgs(
      process.env.THEIA_UI_E2E_VICE_ARGS ?? process.env.VICE_ARGS
    ),
    keepWorkspace: false,
    verbose: false,
    help: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case '--output-dir':
        options.outputDir = resolvePathArg(valueArg(args, ++index, arg));
        break;
      case '--workspace':
        options.workspacePath = resolvePathArg(valueArg(args, ++index, arg));
        break;
      case '--timeout':
        options.timeoutMs = positiveInteger(valueArg(args, ++index, arg), arg);
        break;
      case '--viewport':
        parseViewport(options, valueArg(args, ++index, arg));
        break;
      case '--vice-executable':
        options.viceExecutable = valueArg(args, ++index, arg);
        break;
      case '--vice-resources':
        options.viceResourcesPath = resolvePathArg(valueArg(args, ++index, arg));
        break;
      case '--vice-args':
        options.viceArgs = parseViceArgs(valueArg(args, ++index, arg));
        break;
      case '--keep-workspace':
        options.keepWorkspace = true;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '-h':
      case '--help':
        options.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

async function prepareWorkspace(workspacePath, options) {
  await mkdir(path.join(workspacePath, 'lib'), { recursive: true });
  await mkdir(path.join(workspacePath, 'out'), { recursive: true });
  await mkdir(path.join(workspacePath, '.theia'), { recursive: true });
  await writeFile(
    path.join(workspacePath, 'main.asm'),
    [
      '// Theia UI e2e workspace bootstrap.',
      '#import "lib/shared.asm"',
      '',
      '*=$1000',
      'Start:',
      '    rts',
      ''
    ].join('\n'),
    'utf8'
  );
  await writeFile(
    path.join(workspacePath, 'lib', 'shared.asm'),
    [
      '.label screen = $0400',
      'SharedRoutine:',
      '    rts',
      ''
    ].join('\n'),
    'utf8'
  );

  const fixtures = {};
  for (const fixtureName of fixtureNames) {
    fixtures[fixtureName] = await copyFixture(workspacePath, fixtureName);
  }

  await writeFile(
    path.join(workspacePath, '.theia', 'launch.json'),
    `${JSON.stringify({
      version: '0.2.0',
      configurations: [
        createLaunchConfiguration(debugLaunchName, fixtures['debug-demo'], options),
        createLaunchConfiguration(
          visualDebugLaunchName,
          fixtures['visual-debugger-demo'],
          options
        )
      ]
    }, null, 2)}\n`,
    'utf8'
  );

  return {
    workspacePath,
    mainSourcePath: path.join(workspacePath, 'main.asm'),
    debug: fixtures['debug-demo'],
    visual: fixtures['visual-debugger-demo']
  };
}

async function copyFixture(workspacePath, fixtureName) {
  const fixtureRoot = path.join(
    repoRoot,
    'packages',
    'debug-adapter',
    'src',
    'test',
    'e2e',
    'fixtures',
    fixtureName
  );
  const sourceFile = `${fixtureName}.asm`;
  const programFile = `${fixtureName}.prg`;
  const debugInfoFile = `${fixtureName}.dbg`;
  const sourcePath = path.join(workspacePath, sourceFile);
  const programPath = path.join(workspacePath, 'out', programFile);
  const debugInfoPath = path.join(workspacePath, 'out', debugInfoFile);

  await Promise.all([
    copyFile(path.join(fixtureRoot, sourceFile), sourcePath),
    copyFile(path.join(fixtureRoot, programFile), programPath)
  ]);
  const debugInfoText = await readFile(
    path.join(fixtureRoot, debugInfoFile),
    'utf8'
  );
  await writeFile(
    debugInfoPath,
    rewritePrimarySource(debugInfoText, sourceFile, sourcePath),
    'utf8'
  );

  return {
    debugInfoPath,
    programPath,
    sourcePath
  };
}

function createAutomationConfig(fixtureWorkspace, options) {
  const workspaceFolderUri = pathToFileURL(fixtureWorkspace.workspacePath).href;
  const debugLaunchConfiguration = createLaunchConfiguration(
    debugLaunchName,
    fixtureWorkspace.debug,
    options
  );
  const visualDebugLaunchConfiguration = createLaunchConfiguration(
    visualDebugLaunchName,
    fixtureWorkspace.visual,
    options
  );
  const debugBasicReadyBreakpoint = {
    needle: '        jsr MarkStepTarget',
    offset: 0
  };

  return {
    outputDir: options.outputDir,
    sourcePath: fixtureWorkspace.mainSourcePath,
    timeoutMs: options.timeoutMs,
    viewportWidth: options.viewportWidth,
    viewportHeight: options.viewportHeight,
    captures: [
      {
        outputPath: path.join(options.outputDir, 'debug-startup-memory.png'),
        sourcePath: fixtureWorkspace.debug.sourcePath,
        marker: debugBasicReadyBreakpoint,
        steps: [
          { type: 'openDebugView' },
          { type: 'openMemoryView' },
          { type: 'openOutlineView' },
          {
            type: 'setSourceBreakpoint',
            marker: debugBasicReadyBreakpoint
          },
          {
            type: 'startLaunchConfiguration',
            name: debugLaunchName,
            configuration: debugLaunchConfiguration,
            workspaceFolderUri
          },
          {
            type: 'waitForVisibleText',
            selector: '.theia-debug-container',
            text: '6510 Registers',
            timeoutMs: options.timeoutMs
          },
          {
            type: 'waitForC64BasicReady',
            timeoutMs: options.timeoutMs
          },
          { type: 'openMemoryView' },
          {
            type: 'showMemoryRange',
            expression: '$0400',
            length: '1',
            bytesPerRow: 8,
            textMode: 'screen'
          },
          {
            type: 'waitForVisibleText',
            selector: '.cc-vice-memory-widget',
            text: 'Read 1 byte(s)',
            timeoutMs: options.timeoutMs
          },
          {
            type: 'waitForVisibleText',
            selector: '.cc-vice-memory-widget',
            text: '$0400 $0400-$0400',
            timeoutMs: options.timeoutMs
          },
          {
            type: 'editInputValue',
            selector: '.cc-vice-memory-widget input[title^="$0400 ="]',
            value: '01',
            commit: 'blur',
            timeoutMs: options.timeoutMs
          },
          {
            type: 'waitForInputValue',
            selector: '.cc-vice-memory-widget input[title="$0400 = 1"]',
            value: '01',
            timeoutMs: options.timeoutMs
          },
          {
            type: 'openSourceFile',
            filePath: fixtureWorkspace.debug.sourcePath
          },
          {
            type: 'waitForVisibleText',
            selector: '#outline-view, .theia-outline-view',
            text: 'AfterBasicReady',
            timeoutMs: options.timeoutMs
          }
        ],
        afterSteps: [
          { type: 'stopDebugSession' },
          { type: 'wait', ms: 500 }
        ]
      },
      {
        outputPath: path.join(options.outputDir, 'visual-debugger-overview.png'),
        sourcePath: fixtureWorkspace.visual.sourcePath,
        steps: [
          {
            type: 'startLaunchConfiguration',
            name: visualDebugLaunchName,
            configuration: visualDebugLaunchConfiguration,
            workspaceFolderUri
          },
          {
            type: 'waitForC64BasicReady',
            timeoutMs: options.timeoutMs
          },
          { type: 'prepareC64VisualDebuggerDemoState' },
          { type: 'openC64VisualDebugger' },
          {
            type: 'showC64VisualDebuggerView',
            view: 'overview'
          },
          {
            type: 'waitForVisibleText',
            selector: '.cc-c64-visual-debugger-widget',
            text: 'VIC-II Registers',
            timeoutMs: options.timeoutMs
          },
          {
            type: 'waitForVisibleText',
            selector: '.cc-c64-visual-debugger-widget',
            text: 'C64 machine state refreshed.',
            timeoutMs: options.timeoutMs
          }
        ]
      },
      {
        outputPath: path.join(options.outputDir, 'visual-debugger-sprites.png'),
        steps: [
          {
            type: 'showC64VisualDebuggerView',
            view: 'sprites'
          },
          {
            type: 'waitForVisibleText',
            selector: '.cc-c64-visual-debugger-widget',
            text: 'Sprite 0',
            timeoutMs: options.timeoutMs
          },
          {
            type: 'waitForVisibleText',
            selector: '.cc-c64-visual-debugger-widget',
            text: 'Pointer',
            timeoutMs: options.timeoutMs
          }
        ]
      },
      {
        outputPath: path.join(options.outputDir, 'visual-debugger-screen.png'),
        steps: [
          {
            type: 'showC64VisualDebuggerView',
            view: 'screen'
          },
          {
            type: 'waitForVisibleText',
            selector: '.cc-c64-visual-debugger-widget',
            text: 'Screen codes at',
            timeoutMs: options.timeoutMs
          },
          {
            type: 'waitForVisibleText',
            selector: '.cc-c64-visual-debugger-widget',
            text: 'Color RAM at $D800',
            timeoutMs: options.timeoutMs
          }
        ]
      },
      {
        outputPath: path.join(options.outputDir, 'visual-debugger-cia.png'),
        steps: [
          {
            type: 'showC64VisualDebuggerView',
            view: 'cia'
          },
          {
            type: 'waitForVisibleText',
            selector: '.cc-c64-visual-debugger-widget',
            text: 'CIA #1',
            timeoutMs: options.timeoutMs
          },
          {
            type: 'waitForVisibleText',
            selector: '.cc-c64-visual-debugger-widget',
            text: 'Keyboard Matrix',
            timeoutMs: options.timeoutMs
          }
        ],
        afterSteps: [
          { type: 'stopDebugSession' },
          { type: 'wait', ms: 500 }
        ]
      }
    ]
  };
}

function createLaunchConfiguration(name, fixture, options) {
  const configuration = {
    type: 'commodore-vice',
    request: 'launch',
    name,
    program: path.relative(path.dirname(fixture.sourcePath), fixture.programPath),
    debugInfo: path.relative(path.dirname(fixture.sourcePath), fixture.debugInfoPath),
    sourceRoot: '.',
    machine: {
      profile: 'c64',
      model: 'c64',
      viceArgs: []
    },
    stopOnEntry: false,
    suppressSaveBeforeStart: true,
    openDebug: 'openOnSessionStart',
    internalConsoleOptions: 'neverOpen'
  };

  if (options.viceResourcesPath) {
    configuration.viceResourcesPath = options.viceResourcesPath;
  }
  if (options.viceExecutable) {
    configuration.viceExecutable = options.viceExecutable;
  }
  if (options.viceArgs.length > 0) {
    configuration.viceArgs = options.viceArgs;
  }

  return configuration;
}

function assertElectronAppBuilt() {
  const backendMain = path.join(
    repoRoot,
    'applications',
    'electron',
    'lib',
    'backend',
    'electron-main.js'
  );
  const frontendIndex = path.join(
    repoRoot,
    'applications',
    'electron',
    'lib',
    'frontend',
    'index.html'
  );
  if (!existsSync(backendMain) || !existsSync(frontendIndex)) {
    throw new Error(
      'The Theia Electron app is not built. Run `npm run theia:build` first.'
    );
  }
}

function resolveElectronExecutable() {
  const requireFromElectronApp = createRequire(
    path.join(repoRoot, 'applications', 'electron', 'package.json')
  );
  const executable = requireFromElectronApp('electron');
  if (typeof executable !== 'string') {
    throw new Error('Unable to resolve Electron executable.');
  }
  return executable;
}

async function runElectronAutomation(
  electronExecutable,
  configPath,
  userDataDir,
  workspacePath,
  options
) {
  const appDir = path.join(repoRoot, 'applications', 'electron');
  const electronMain = path.join(appDir, 'lib', 'backend', 'electron-main.js');
  const args = [
    '--force-device-scale-factor=1',
    '--disable-gpu',
    ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
    `--user-data-dir=${userDataDir}`,
    electronMain,
    workspacePath
  ];
  const child = spawn(electronExecutable, args, {
    cwd: appDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      [screenCaptureConfigEnv]: configPath,
      THEIA_DISABLE_SECURITY_WARNINGS: 'true'
    }
  });

  const log = createProcessLog(child, options.verbose);
  const result = await new Promise((resolve) => {
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });

  if (result.code !== 0) {
    const tail = log.tail().join('\n');
    throw new Error(
      [
        `Theia UI e2e failed (${result.code ?? result.signal}).`,
        tail
      ].filter(Boolean).join('\n')
    );
  }
}

function verifyCaptureOutputs(config) {
  const missing = config.captures
    .map((capture) => capture.outputPath)
    .filter((outputPath) => {
      if (!existsSync(outputPath)) {
        return true;
      }
      return statSync(outputPath).size <= 0;
    });
  if (missing.length > 0) {
    throw new Error(`Theia UI e2e did not write artifacts: ${missing.join(', ')}`);
  }
}

function createProcessLog(child, verbose) {
  const lines = [];
  const append = (chunk) => {
    const text = chunk.toString();
    if (verbose) {
      process.stdout.write(text);
    }
    for (const line of text.split(/\r?\n/u)) {
      if (!line) {
        continue;
      }
      lines.push(line);
      if (lines.length > 160) {
        lines.shift();
      }
    }
  };

  child.stdout.on('data', append);
  child.stderr.on('data', append);

  return {
    tail: () => [...lines]
  };
}

function rewritePrimarySource(debugInfoText, sourceFile, sourcePath) {
  const escapedSourceFile = escapeRegExp(sourceFile);
  const sourceLine = new RegExp(
    `(\\n\\s*1,)[^\\n]*${escapedSourceFile}(?=\\r?\\n)`,
    'u'
  );
  const rewritten = debugInfoText.replace(sourceLine, (_match, prefix) =>
    `${prefix}${sourcePath}`
  );
  if (rewritten === debugInfoText) {
    throw new Error(`Could not rewrite primary source path in ${sourceFile}.`);
  }
  return rewritten;
}

function parseViceArgs(value) {
  if (!value?.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every((entry) => typeof entry === 'string')) {
      return parsed;
    }
  } catch {
    // Fall through to whitespace splitting.
  }
  return value.split(/\s+/u).filter(Boolean);
}

function parseViewport(options, value) {
  const match = /^(\d+)x(\d+)$/u.exec(value);
  if (!match) {
    throw new Error('--viewport must use WIDTHxHEIGHT, for example 1280x800.');
  }
  options.viewportWidth = Number(match[1]);
  options.viewportHeight = Number(match[2]);
}

function positiveInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer.`);
  }
  return parsed;
}

function valueArg(args, index, flag) {
  const value = args[index];
  if (!value) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function resolvePathArg(value) {
  if (value.startsWith('~/')) {
    return path.resolve(process.env.HOME ?? repoRoot, value.slice(2));
  }
  return path.resolve(repoRoot, value);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function printHelp() {
  console.log(`Usage: npm run test:e2e:theia:ui -- [options]

Runs focused Electron/Theia UI e2e scenarios for the VICE debugger. The command
requires a built Electron app and a graphical desktop session.

Options:
  --output-dir <path>      Artifact directory. Default: test-results/theia-ui-e2e
  --workspace <path>       Workspace to prepare and open. Default: temporary dir
  --viewport <WxH>         Web contents size. Default: 1440x900
  --timeout <ms>           Startup/action timeout. Default: 90000
  --vice-executable <path> Override launch viceExecutable
  --vice-resources <path>  Override launch viceResourcesPath
  --vice-args <args>       Override launch viceArgs; JSON array or whitespace list
  --keep-workspace         Keep the generated temporary workspace
  --verbose                Stream Electron/Theia logs
  -h, --help               Show this help

Environment overrides:
  THEIA_UI_E2E_VICE_EXECUTABLE, THEIA_UI_E2E_VICE_RESOURCES_PATH,
  THEIA_UI_E2E_VICE_ARGS. The generic VICE_EXECUTABLE, VICE_RESOURCES_PATH,
  and VICE_ARGS variables are also honored.
`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

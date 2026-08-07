#!/usr/bin/env node
import { existsSync, statSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultCaptureWorkspacePath = path.join(repoRoot, '.theia', 'screen-capture');
const screenCaptureConfigEnv = 'COMMODORE_COMMANDER_SCREEN_CAPTURE_CONFIG';
const debugLaunchName = 'Debug debug-demo';
const visualDebugLaunchName = 'Debug visual-debugger-demo';
const defaults = {
  characterSetPath: path.join(defaultCaptureWorkspacePath, 'c64-lower-upper.charset'),
  outputDir: path.join(repoRoot, 'docs'),
  debugSourcePath: path.join(defaultCaptureWorkspacePath, 'debug-demo.asm'),
  visualDebugSourcePath: path.join(
    defaultCaptureWorkspacePath,
    'visual-debugger-demo.asm'
  ),
  sidScorePath: path.join(defaultCaptureWorkspacePath, 'player.sidscore'),
  sourcePath: path.join(defaultCaptureWorkspacePath, 'main.asm'),
  workspacePath: defaultCaptureWorkspacePath,
  viewportWidth: 1440,
  viewportHeight: 900
};

const overviewSource = [
  '#import "lib/shared.asm"',
  '#importif FEATURE_ENABLED "lib/conditional.asm"',
  '#import "vendor/macros.asm"',
  '',
  '.const SCREEN = $0400',
  '.var currentRow = 0',
  '',
  '.namespace Game {',
  '    .macro DrawSprite(x, y) {',
  '        asl A',
  '        sta SCREEN,x',
  '    }',
  '',
  'Draw:',
  '    asl A',
  '    sta SCREEN',
  '    jsr Update',
  '',
  'Update:',
  '    inc currentRow',
  '    rts',
  '}',
  '',
  'EntryPoint:',
  '    jsr Game.Draw',
  '    rts'
].join('\n');

const sidScorePlayerSource = [
  'TITLE "Screen Capture Groove"',
  'AUTHOR "Commodore Commander"',
  '',
  'TEMPO 140',
  'TIME 4/4',
  'SYSTEM PAL',
  '',
  'INSTR lead WAVE=PULSE+TRI ADSR=3,4,10,4 PW=$0800',
  'INSTR bass WAVE=PULSE ADSR=6,4,10,4 PW=$0800 PWMIN=$0100 PWMAX=$0F00 PWSWEEP=-16',
  '',
  'VOICE 1 lead:',
  '  O5 L8 C E G > C < G E C R',
  '  C D E G A G E D',
  '',
  'VOICE 2 bass:',
  '  O2 L4 C G < B > C',
  '',
  'VOICE 3 lead:',
  '  O4 L8 R C E G R G E C'
].join('\n');

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  if (!options.sourcePathProvided) {
    await prepareDefaultCaptureSource(options);
  }

  assertElectronAppBuilt();
  if (!options.sourcePathProvided) {
    await buildDefaultDebugCaptureProgram(options);
  }
  await mkdir(options.outputDir, { recursive: true });
  const restoreRootLaunchConfig = options.sourcePathProvided
    ? undefined
    : await installWorkspaceRootDebugLaunchConfig(options);

  const electronExecutable = resolveElectronExecutable();
  const configDir = await mkdtemp(path.join(tmpdir(), 'cc-theia-screenshots-'));
  const configPath = path.join(configDir, 'config.json');
  const userDataDir = path.join(configDir, 'electron-user-data');
  const captureConfig = createCaptureConfig(options);
  await writeFile(
    configPath,
    JSON.stringify(captureConfig, null, 2),
    'utf8'
  );

  try {
    await runElectronCapture(electronExecutable, configPath, userDataDir, options);
    verifyCaptureOutputs(captureConfig);
  } finally {
    await restoreRootLaunchConfig?.();
    await rm(configDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function parseArgs(args) {
  const options = {
    outputDir: defaults.outputDir,
    characterSetPath: defaults.characterSetPath,
    debugSourcePath: defaults.debugSourcePath,
    visualDebugSourcePath: defaults.visualDebugSourcePath,
    sidScorePath: defaults.sidScorePath,
    sourcePath: defaults.sourcePath,
    workspacePath: defaults.workspacePath,
    viewportWidth: defaults.viewportWidth,
    viewportHeight: defaults.viewportHeight,
    timeoutMs: 60000,
    verbose: false,
    help: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case '--output-dir':
        options.outputDir = resolvePathArg(valueArg(args, ++index, arg));
        break;
      case '--source':
        options.sourcePath = resolvePathArg(valueArg(args, ++index, arg));
        options.sourcePathProvided = true;
        break;
      case '--workspace':
        options.workspacePath = resolvePathArg(valueArg(args, ++index, arg));
        if (!options.sourcePathProvided) {
          options.sourcePath = path.join(options.workspacePath, 'main.asm');
          options.characterSetPath = path.join(
            options.workspacePath,
            'c64-lower-upper.charset'
          );
          options.sidScorePath = path.join(options.workspacePath, 'player.sidscore');
          options.debugSourcePath = path.join(options.workspacePath, 'debug-demo.asm');
          options.visualDebugSourcePath = path.join(
            options.workspacePath,
            'visual-debugger-demo.asm'
          );
        }
        break;
      case '--timeout':
        options.timeoutMs = Number(valueArg(args, ++index, arg));
        if (!Number.isInteger(options.timeoutMs) || options.timeoutMs <= 0) {
          throw new Error('--timeout must be a positive integer in milliseconds.');
        }
        break;
      case '--viewport':
        parseViewport(options, valueArg(args, ++index, arg));
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

async function prepareDefaultCaptureSource(options) {
  const sourceDirectory = path.dirname(options.sourcePath);
  await mkdir(path.join(sourceDirectory, 'lib'), { recursive: true });
  await mkdir(path.join(sourceDirectory, '.theia'), { recursive: true });
  await writeFile(options.sourcePath, `${overviewSource}\n`, 'utf8');
  await writeFile(
    options.characterSetPath,
    createCharacterSetFixtureContent(),
    'utf8'
  );
  await writeFile(options.sidScorePath, `${sidScorePlayerSource}\n`, 'utf8');
  await copyFile(
    path.join(repoRoot, 'example-workspace/kickassembler/debug-demo.asm'),
    options.debugSourcePath
  );
  await copyFile(
    path.join(
      repoRoot,
      'example-workspace/kickassembler/visual-debugger-demo.asm'
    ),
    options.visualDebugSourcePath
  );
  await writeFile(
    path.join(sourceDirectory, 'lib', 'shared.asm'),
    [
      '.label spriteWidth = 24',
      'SharedRoutine:',
      '    rts',
      ''
    ].join('\n'),
    'utf8'
  );
  await writeFile(
    path.join(sourceDirectory, 'commodore-commander.build.json'),
    `${JSON.stringify(createDefaultDebugBuildConfig(), null, 2)}\n`,
    'utf8'
  );
  await writeFile(
    path.join(sourceDirectory, '.theia', 'launch.json'),
    `${JSON.stringify(createDefaultDebugLaunchConfig(options), null, 2)}\n`,
    'utf8'
  );
  await writeFile(
    path.join(sourceDirectory, '.theia', 'tasks.json'),
    `${JSON.stringify(createDefaultDebugTasksConfig(), null, 2)}\n`,
    'utf8'
  );
}

async function buildDefaultDebugCaptureProgram(options) {
  const buildCliPath = path.join(
    repoRoot,
    'packages/theia-extension/lib/node/kick-assembler-headless-build.js'
  );
  await buildCaptureProgram(options, buildCliPath, 'debug-demo');
  await buildCaptureProgram(options, buildCliPath, 'visual-debugger-demo');
}

async function buildCaptureProgram(options, buildCliPath, programName) {
  await runCommand(
    process.execPath,
    [
      buildCliPath,
      '--workspace',
      options.workspacePath,
      '--program',
      programName
    ],
    {
      cwd: repoRoot,
      verbose: options.verbose,
      failureMessage: `Unable to build the ${programName} screen-capture fixture.`
    }
  );
}

function createDefaultDebugBuildConfig() {
  return {
    profiles: {
      debug: {
        javaRuntime: 'java',
        javaArgs: [],
        libraryRoots: ['lib'],
        outputFolder: 'out',
        showMemory: true,
        debug: false,
        viceSymbols: true,
        debugDump: true,
        symbolFile: true,
        assemblerArgs: [],
        generatedAssets: []
      }
    },
    defaultProfile: 'debug',
    programs: [
      {
        name: 'debug-demo',
        root: 'debug-demo.asm',
        profile: 'debug',
        runProgram: 'out/debug-demo.prg',
        machine: {
          profile: 'c64',
          model: 'c64',
          viceArgs: []
        }
      },
      {
        name: 'visual-debugger-demo',
        root: 'visual-debugger-demo.asm',
        profile: 'debug',
        runProgram: 'out/visual-debugger-demo.prg',
        machine: {
          profile: 'c64',
          model: 'c64',
          viceArgs: []
        }
      }
    ]
  };
}

function createDefaultDebugLaunchConfig(options) {
  return {
    version: '0.2.0',
    configurations: [
      createDebugLaunchConfiguration(options),
      createVisualDebugLaunchConfiguration(options)
    ]
  };
}

function createDefaultDebugTasksConfig() {
  return {
    version: '2.0.0',
    tasks: [
      createDebugBuildTaskConfiguration(),
      createVisualDebugBuildTaskConfiguration()
    ]
  };
}

async function installWorkspaceRootDebugLaunchConfig(options) {
  const launchPath = path.join(repoRoot, '.theia', 'launch.json');
  const originalContent = existsSync(launchPath)
    ? await readFile(launchPath, 'utf8')
    : undefined;
  await mkdir(path.dirname(launchPath), { recursive: true });
  await writeFile(
    launchPath,
    `${JSON.stringify({
      version: '0.2.0',
      configurations: [
        createWorkspaceRootDebugLaunchConfiguration(options),
        createWorkspaceRootVisualDebugLaunchConfiguration(options)
      ]
    }, null, 2)}\n`,
    'utf8'
  );
  const tasksPath = path.join(repoRoot, '.theia', 'tasks.json');
  const originalTasksContent = existsSync(tasksPath)
    ? await readFile(tasksPath, 'utf8')
    : undefined;
  await writeFile(
    tasksPath,
    `${JSON.stringify(createDefaultDebugTasksConfig(), null, 2)}\n`,
    'utf8'
  );

  return async () => {
    if (originalContent !== undefined) {
      await writeFile(launchPath, originalContent, 'utf8');
    } else {
      await rm(launchPath, { force: true });
    }
    if (originalTasksContent !== undefined) {
      await writeFile(tasksPath, originalTasksContent, 'utf8');
    } else {
      await rm(tasksPath, { force: true });
    }
  };
}

function createDebugLaunchConfiguration(options) {
  return {
    type: 'commodore-vice',
    request: 'launch',
    name: debugLaunchName,
    program: 'out/debug-demo.prg',
    debugInfo: 'out/debug-demo.dbg',
    sourceRoot: '.',
    preLaunchTask: 'Commodore Commander: Build debug-demo',
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
}

function createVisualDebugLaunchConfiguration(options) {
  return {
    type: 'commodore-vice',
    request: 'launch',
    name: visualDebugLaunchName,
    program: 'out/visual-debugger-demo.prg',
    debugInfo: 'out/visual-debugger-demo.dbg',
    sourceRoot: '.',
    preLaunchTask: 'Commodore Commander: Build visual-debugger-demo',
    machine: {
      profile: 'c64',
      model: 'c64',
      viceArgs: []
    },
    stopOnEntry: false,
    suppressSaveBeforeStart: true,
    openDebug: 'neverOpen',
    internalConsoleOptions: 'neverOpen'
  };
}

function createWorkspaceRootDebugLaunchConfiguration(options) {
  const fixtureRoot = normalizeLaunchPath(path.relative(repoRoot, options.workspacePath));
  return {
    ...createDebugLaunchConfiguration(options),
    program: normalizeLaunchPath(path.join(fixtureRoot, 'out/debug-demo.prg')),
    debugInfo: normalizeLaunchPath(path.join(fixtureRoot, 'out/debug-demo.dbg')),
    sourceRoot: fixtureRoot || '.'
  };
}

function createWorkspaceRootVisualDebugLaunchConfiguration(options) {
  const fixtureRoot = normalizeLaunchPath(path.relative(repoRoot, options.workspacePath));
  return {
    ...createVisualDebugLaunchConfiguration(options),
    program: normalizeLaunchPath(
      path.join(fixtureRoot, 'out/visual-debugger-demo.prg')
    ),
    debugInfo: normalizeLaunchPath(
      path.join(fixtureRoot, 'out/visual-debugger-demo.dbg')
    ),
    sourceRoot: fixtureRoot || '.'
  };
}

function createDebugBuildTaskConfiguration() {
  return {
    label: 'Commodore Commander: Build debug-demo',
    type: 'commodore-kickassembler-build',
    task: 'build',
    executionType: 'customExecution',
    programName: 'debug-demo',
    profileName: 'debug',
    group: 'build',
    problemMatcher: [],
    presentation: {
      reveal: 'silent',
      panel: 'dedicated',
      showReuseMessage: false
    }
  };
}

function createVisualDebugBuildTaskConfiguration() {
  return {
    label: 'Commodore Commander: Build visual-debugger-demo',
    type: 'commodore-kickassembler-build',
    task: 'build',
    executionType: 'customExecution',
    programName: 'visual-debugger-demo',
    profileName: 'debug',
    group: 'build',
    problemMatcher: [],
    presentation: {
      reveal: 'silent',
      panel: 'dedicated',
      showReuseMessage: false
    }
  };
}

function createCaptureConfig(options) {
  const debugBasicReadyBreakpoint = {
    needle: '        jsr MarkStepTarget',
    offset: 0
  };

  return {
    outputDir: options.outputDir,
    sourcePath: options.sourcePath,
    timeoutMs: options.timeoutMs,
    viewportWidth: options.viewportWidth,
    viewportHeight: options.viewportHeight,
    captures: [
      {
        outputPath: path.join(options.outputDir, 'theia-mnemonic-hover.png'),
        source: overviewSource,
        marker: {
          needle: '    asl A',
          offset: '    asl'.length
        },
        steps: [
          { type: 'showMnemonicHover' },
          { type: 'waitForBodyText', text: 'ASL (Arithmetic Shift Left)' },
          { type: 'wait', ms: 250 }
        ]
      },
      {
        outputPath: path.join(options.outputDir, 'theia-character-set-editor.png'),
        sourcePath: options.characterSetPath,
        steps: [
          {
            type: 'executeCommand',
            commandId: 'core.collapse.all.tabs'
          },
          {
            type: 'waitForVisibleText',
            selector: '.cc-character-set-editor',
            text: 'Import .64C',
            timeoutMs: options.timeoutMs
          },
          { type: 'wait', ms: 500 }
        ]
      },
      {
        outputPath: path.join(options.outputDir, 'theia-sidscore-player.png'),
        sourcePath: options.sidScorePath,
        source: sidScorePlayerSource,
        marker: {
          needle: 'VOICE 1 lead:',
          offset: 0
        },
        steps: [
          {
            type: 'executeCommand',
            commandId: 'commodoreCommander.sidscore.play'
          },
          {
            type: 'waitForVisibleText',
            selector: '.cc-sidscore-waveforms',
            text: 'SIDScore playback',
            timeoutMs: options.timeoutMs
          },
          {
            type: 'waitForVisibleText',
            selector: '.cc-sid-instrument',
            text: 'Instrument',
            timeoutMs: options.timeoutMs
          },
          { type: 'wait', ms: 1000 }
        ],
        afterSteps: [
          {
            type: 'executeCommand',
            commandId: 'commodoreCommander.sidscore.stop'
          },
          { type: 'wait', ms: 250 }
        ]
      },
      {
        outputPath: path.join(options.outputDir, 'theia-sid-sfx-editor.png'),
        sourcePath: options.sidScorePath,
        steps: [
          { type: 'openSidSfxEditor' },
          {
            type: 'waitForVisibleText',
            selector: '.cc-sid-sfx-widget',
            text: 'Preset',
            timeoutMs: options.timeoutMs
          },
          {
            type: 'waitForVisibleText',
            selector: '.cc-sid-sfx-widget',
            text: 'Source',
            timeoutMs: options.timeoutMs
          },
          { type: 'wait', ms: 750 }
        ]
      },
      {
        outputPath: path.join(options.outputDir, 'theia-vice-debugging.png'),
        sourcePath: options.debugSourcePath,
        marker: debugBasicReadyBreakpoint,
        steps: [
          { type: 'openDebugView' },
          { type: 'openMemoryView' },
          { type: 'openOutlineView' },
          { type: 'showScreenMemory' },
          {
            type: 'setSourceBreakpoint',
            marker: debugBasicReadyBreakpoint
          },
          {
            type: 'startLaunchConfiguration',
            name: debugLaunchName,
            configuration: createDebugLaunchConfiguration(options),
            workspaceFolderUri: pathToFileURL(options.workspacePath).href
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
          { type: 'wait', ms: 250 },
          { type: 'showScreenMemory' },
          {
            type: 'waitForVisibleText',
            selector: '.cc-vice-memory-widget',
            text: 'Read 1000 byte(s)',
            timeoutMs: options.timeoutMs
          },
          {
            type: 'waitForVisibleText',
            selector: '.cc-vice-memory-widget',
            text: '$0400-$07E7',
            timeoutMs: options.timeoutMs
          },
          {
            type: 'openSourceFile',
            filePath: options.debugSourcePath
          },
          {
            type: 'waitForVisibleText',
            selector: '#outline-view, .theia-outline-view',
            text: 'AfterBasicReady',
            timeoutMs: options.timeoutMs
          },
          { type: 'revealMemoryTextColumn' },
          { type: 'wait', ms: 1000 }
        ],
        afterSteps: [
          {
            type: 'executeCommand',
            commandId: 'workbench.action.debug.stop'
          },
          { type: 'wait', ms: 500 }
        ]
      },
      {
        outputPath: path.join(
          options.outputDir,
          'theia-c64-visual-debugger-vic.png'
        ),
        sourcePath: options.visualDebugSourcePath,
        steps: [
          {
            type: 'startLaunchConfiguration',
            name: visualDebugLaunchName,
            configuration: createVisualDebugLaunchConfiguration(options),
            workspaceFolderUri: pathToFileURL(options.workspacePath).href
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
          },
          { type: 'wait', ms: 1000 }
        ]
      },
      {
        outputPath: path.join(
          options.outputDir,
          'theia-c64-visual-debugger-sprites.png'
        ),
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
          },
          { type: 'wait', ms: 500 }
        ]
      },
      {
        outputPath: path.join(
          options.outputDir,
          'theia-c64-visual-debugger-screen.png'
        ),
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
          },
          { type: 'wait', ms: 500 }
        ]
      },
      {
        outputPath: path.join(
          options.outputDir,
          'theia-c64-visual-debugger-cia.png'
        ),
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
          },
          { type: 'wait', ms: 500 }
        ],
        afterSteps: [
          {
            type: 'executeCommand',
            commandId: 'workbench.action.debug.stop'
          },
          { type: 'wait', ms: 500 }
        ]
      }
    ]
  };
}

function createCharacterSetFixtureContent() {
  const requireFromRepo = createRequire(import.meta.url);
  const {
    createCharacterSetDocumentFromTemplate,
    serializeCharacterSetDocument
  } = requireFromRepo(
    path.join(
      repoRoot,
      'packages/theia-extension/lib/common/commodore-character-set-format.js'
    )
  );
  return serializeCharacterSetDocument(
    createCharacterSetDocumentFromTemplate(
      'c64-lower-upper',
      'c64-lower-upper'
    )
  );
}

function assertElectronAppBuilt() {
  const backendMain = path.join(
    repoRoot,
    'applications/electron/lib/backend/electron-main.js'
  );
  const frontendIndex = path.join(
    repoRoot,
    'applications/electron/lib/frontend/index.html'
  );

  if (!existsSync(backendMain) || !existsSync(frontendIndex)) {
    throw new Error(
      'The Theia Electron app is not built. Run `npm run theia:build` first.'
    );
  }
}

function resolveElectronExecutable() {
  const requireFromElectronApp = createRequire(
    path.join(repoRoot, 'applications/electron/package.json')
  );
  const executable = requireFromElectronApp('electron');
  if (typeof executable !== 'string') {
    throw new Error('Unable to resolve Electron executable.');
  }
  return executable;
}

async function runElectronCapture(
  electronExecutable,
  configPath,
  userDataDir,
  options
) {
  const appDir = path.join(repoRoot, 'applications/electron');
  const electronMain = path.join(appDir, 'lib/backend/electron-main.js');
  const args = [
    '--force-device-scale-factor=1',
    '--disable-gpu',
    `--user-data-dir=${userDataDir}`,
    electronMain,
    options.workspacePath
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
        `Theia Electron screenshot capture failed (${result.code ?? result.signal}).`,
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
    throw new Error(
      `Screenshot capture completed without writing: ${missing.join(', ')}`
    );
  }
}

async function runCommand(command, args, options) {
  const child = spawn(command, args, {
    cwd: options.cwd,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const log = createProcessLog(child, options.verbose);
  const result = await new Promise((resolve) => {
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });

  if (result.code !== 0) {
    const tail = log.tail().join('\n');
    throw new Error(
      [
        `${options.failureMessage} (${result.code ?? result.signal}).`,
        tail
      ].filter(Boolean).join('\n')
    );
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
      if (lines.length > 120) {
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

function parseViewport(options, value) {
  const match = /^(\d+)x(\d+)$/u.exec(value);
  if (!match) {
    throw new Error('--viewport must use WIDTHxHEIGHT, for example 1280x800.');
  }
  options.viewportWidth = Number(match[1]);
  options.viewportHeight = Number(match[2]);
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

function normalizeLaunchPath(value) {
  return value.split(path.sep).join('/');
}

function printHelp() {
  console.log(`Usage: npm run screenshots:theia -- [options]

Captures deterministic Theia screenshots from the Electron application. The
command requires a built Electron app and a graphical desktop session.

Options:
  --output-dir <path>      Screenshot output directory. Default: docs
  --source <path>          Kick Assembler file to open.
  --workspace <path>       Workspace root to open. Default: .theia/screen-capture
  --viewport <WxH>         Web contents size. Default: 1440x900
  --timeout <ms>           Startup/action timeout. Default: 60000
  --verbose                Stream Electron/Theia logs.
  -h, --help               Show this help.
`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

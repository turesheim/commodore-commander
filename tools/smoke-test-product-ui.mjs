import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// Launch the packaged application, with its own backend/frontend and bundled
// runtime discovery. A development Electron entry point would miss packaging bugs.
export async function smokeTestProductUi(layout, outputDir, timeoutMs = 90000) {
  await mkdir(outputDir, { recursive: true });
  const testRoot = await mkdtemp(path.join(os.tmpdir(), 'cc-product-ui-'));
  const workspace = path.join(testRoot, 'workspace');
  await mkdir(path.join(workspace, 'lib'), { recursive: true });
  const sourcePath = path.join(workspace, 'main.asm');
  await writeFile(sourcePath, '#import "lib/shared.asm"\n*=$1000\nStart: rts\n');
  await writeFile(path.join(workspace, 'lib', 'shared.asm'), '.label screen = $0400\n');
  const configPath = path.join(testRoot, 'config.json');
  const chargen = await readFile(path.join(layout.appResourcesDir,
    'lib', 'backend', 'assets', 'vice', 'darwin-arm64', 'VICE.app',
    'Contents', 'Resources', 'share', 'vice', 'C64', 'chargen-901225-01.bin'));
  // C64 screen codes for READY.; derive the expected pixels from the packaged ROM.
  const readyScreenCodes = [18, 5, 1, 4, 25, 46];
  const readyRows = Array.from({ length: 8 }, (_, row) => readyScreenCodes.flatMap(code =>
    Array.from({ length: 8 }, (_, col) => (chargen[code * 8 + row] >> (7 - col)) & 1)
  ));
  const captures = [1, 2].map(cycle => ({
    outputPath: path.join(outputDir, `machine-${cycle}.png`),
    steps: [
      { type: 'openMachineView' },
      { type: 'showMachineVirtualKeyboard', timeoutMs: 20000 },
      { type: 'waitForVisibleText', selector: '.cc-machine-profile-widget', text: 'FPS', timeoutMs: 20000 },
      { type: 'waitForCanvasContent', selector: '.cc-machine-vice-screen canvas', timeoutMs: 20000 },
      // A RAM pattern proves painting, but not that BASIC accepts input yet.
      { type: 'waitForCanvasGlyphs', selector: '.cc-machine-vice-screen canvas', rows: readyRows, timeoutMs: 20000 },
      { type: 'assertCanvasKeyboardResponse', selector: '.cc-machine-vice-screen canvas', text: 'poke 53280,2', timeoutMs: 10000 }
    ],
    afterSteps: [
      { type: 'powerOffMachine', replayLateFrame: true },
      { type: 'waitForVisibleText', selector: '.cc-machine-profile-widget', text: 'Powered off', timeoutMs: 10000 }
    ]
  }));
  await writeFile(configPath, JSON.stringify({
    outputDir, sourcePath, timeoutMs, viewportWidth: 1440, viewportHeight: 900, captures
  }, null, 2));
  // Keep a reviewable config after the isolated profile/workspace is removed.
  await writeFile(path.join(outputDir, 'config.json'), await readFile(configPath));
  for (const capture of captures) {
    await rm(capture.outputPath, { force: true });
  }
  await rm(path.join(outputDir, 'failure.png'), { force: true });
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
    name !== 'ELECTRON_RUN_AS_NODE' && !name.startsWith('DYLD_') &&
    !name.startsWith('VICE_') && !name.startsWith('THEIA_UI_E2E_VICE_')
  ));
  env.COMMODORE_COMMANDER_SCREEN_CAPTURE_CONFIG = configPath;
  env.THEIA_DISABLE_SECURITY_WARNINGS = 'true';
  let child;
  let timer;
  let log = '';
  try {
    child = spawn(layout.executablePath, [
      '--force-device-scale-factor=1', '--disable-gpu',
      `--user-data-dir=${path.join(testRoot, 'user-data')}`, workspace
    ], {
      cwd: workspace, env, detached: true, stdio: ['ignore', 'pipe', 'pipe']
    });
    const appendLog = chunk => { log = (log + chunk.toString()).slice(-64000); };
    child.stdout.on('data', appendLog);
    child.stderr.on('data', appendLog);
    await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (code, signal) => code === 0 ? resolve() : reject(
        new Error(`Packaged Electron UI exited with ${signal ?? `code ${code}`}.`)
      ));
      timer = setTimeout(() => reject(new Error(
        `Packaged Electron UI did not finish within ${timeoutMs} ms.`
      )), timeoutMs);
    });
    if (log.split('Verified visible canvas content in .cc-machine-vice-screen canvas.').length - 1 !== captures.length) {
      throw new Error('Packaged app did not execute every canvas-content assertion.');
    }
    if (log.split('Verified canvas keyboard response in .cc-machine-vice-screen canvas.').length - 1 !== captures.length) {
      throw new Error('Packaged app did not execute every keyboard-response assertion.');
    }
    if (log.split('Verified canvas glyphs in .cc-machine-vice-screen canvas.').length - 1 !== captures.length) {
      throw new Error('Packaged app did not execute every BASIC-ready assertion.');
    }
    if (log.split('Replayed a queued Machine frame after power off.').length - 1 !== captures.length) {
      throw new Error('Packaged app did not execute every late-frame regression check.');
    }
    for (const capture of captures) {
      const png = await readFile(capture.outputPath);
      if (!png.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
        throw new Error(`Missing valid UI screenshot: ${capture.outputPath}`);
      }
    }
    console.log('Packaged Electron UI smoke test passed: editor opened, Machine rendered visible content and executed BASIC keyboard input, power off and restart succeeded.');
  } catch (error) {
    throw new Error(`${error.message}\n${log.trim()}\nUI artifacts: ${outputDir}`);
  } finally {
    clearTimeout(timer);
    // This detached process group belongs exclusively to this test. Also clean
    // up a VICE child left behind when Electron exits on an assertion failure.
    if (child?.pid) {
      try { process.kill(-child.pid, 'SIGKILL'); } catch (error) {
        if (error.code !== 'ESRCH') { throw error; }
      }
    }
    if (child && child.exitCode === null && child.signalCode === null) {
      await new Promise(resolve => child.once('close', resolve));
    }
    await writeFile(path.join(outputDir, 'electron.log'), log);
    await rm(testRoot, { recursive: true, force: true });
  }
}

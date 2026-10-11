#!/usr/bin/env node
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = createRequire(path.join(root, 'applications/electron/package.json'));
const WebSocket = load('ws');
const outputDir = path.join(root, 'test-results/theia-ui-e2e/language-navigation');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await check();
    if (value) return value;
    await delay(50);
  }
  throw new Error(`Timed out after ${timeout} ms`);
}
async function main() {
  const temp = await fs.realpath(await fs.mkdtemp(path.join(tmpdir(), 'cc-language-navigation-')));
  const workspace = path.join(temp, 'workspace');
  const mainPath = path.join(workspace, 'main.asm');
  const library = path.join(temp, 'library');
  const libraryPath = path.join(library, 'lib/target.asm');
  await fs.mkdir(path.join(library, 'lib'), { recursive: true });
  await fs.mkdir(path.join(workspace, '.theia'), { recursive: true });
  await fs.mkdir(path.join(temp, 'config'));
  await fs.mkdir(outputDir, { recursive: true });
  const source = [
    '*=$1000', '#import "lib/target.asm"', '.namespace Game {', 'First: {', 'loop:',
    '  bne loop // first', '}', 'Second: {', 'loop:', '  bne loop // second', '}', '}',
    '  jsr Library.Target', '  jsr Game.First.loop', '!again:', '  nop',
    '  jmp !again-', '  jmp !again++', '!again:', '  nop', '!again:', '  rts',
    '  jmp !++', '!:', '  nop', '!:', '  rts'
  ].join('\n');
  await fs.writeFile(mainPath, source);
  await fs.writeFile(libraryPath, '// Distinct navigation target\n.filenamespace Library\nTarget:\n  rts\n  jsr Game.Second.loop\n');
  await fs.writeFile(path.join(workspace, 'unrelated.asm'), '.filenamespace Library\nTarget:\n  rts\n');
  await fs.writeFile(path.join(workspace, 'commodore-commander.build.json'), JSON.stringify({
    libraryRoots: ['../library'], programs: [{ name: 'main', root: 'main.asm' }, { name: 'unrelated', root: 'unrelated.asm' }]
  }));
  let log = '', ws, exitResult;
  const child = spawn(load('electron'), [path.join(root, 'applications/electron/lib/backend/electron-main.js'), workspace,
    '--disable-gpu', ...(process.platform === 'linux' ? ['--no-sandbox', '--disable-dev-shm-usage'] : []), '--no-cluster', '--remote-debugging-port=0', `--user-data-dir=${path.join(temp, 'user-data')}`], {
    cwd: path.join(root, 'applications/electron'), detached: true, env: { ...process.env,
      THEIA_CONFIG_DIR: path.join(temp, 'config'), THEIA_DISABLE_SECURITY_WARNINGS: 'true' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', chunk => { log += chunk; });
  child.stderr.on('data', chunk => { log += chunk; });
  const exited = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => { exitResult = { code, signal }; resolve(exitResult); });
  });
  const timer = setTimeout(() => { try { process.kill(-child.pid, 'SIGTERM'); } catch {} }, 90000);
  try {
    const port = await until(() => {
      if (exitResult) throw new Error(`Electron exited: ${JSON.stringify(exitResult)}`);
      return log.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/)?.[1];
    });
    const target = await until(async () => {
      const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      return pages.find(page => page.type === 'page' && page.url.includes('index.html'));
    });
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
    let sequence = 0;
    const pending = new Map();
    ws.on('message', raw => {
      const response = JSON.parse(raw.toString());
      const waiter = pending.get(response.id);
      if (waiter) { pending.delete(response.id); clearTimeout(waiter.timer); waiter.resolve(response); }
    });
    async function send(method, params) {
      const id = ++sequence;
      const response = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
        pending.set(id, { resolve, timer });
        ws.send(JSON.stringify({ id, method, params }));
      });
      if (response.error) throw new Error(JSON.stringify(response.error));
      return response.result;
    }
    async function evaluate(expression) {
      const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    }
    const api = 'window.__commodoreCommanderScreenCaptureApi';
    await until(() => evaluate(`Boolean(${api}?.openSourceFile && ${api}?.showReferences && ${api}?.setEditorMarker)`));
    assert.equal(await evaluate(`${api}.openSourceFile(${JSON.stringify(mainPath)})`), true);
    async function capture(name) {
      await delay(120);
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      await fs.writeFile(path.join(outputDir, name), Buffer.from(shot.data, 'base64'));
    }
    async function clickSymbol(needle, leaf, linkedText, expectedLine, targetComment, sourcePath = mainPath) {
      assert.equal(await evaluate(`${api}.openSourceFile(${JSON.stringify(sourcePath)})`), true);
      assert.equal(await evaluate(`${api}.setEditorMarker(${JSON.stringify({ needle, offset: needle.indexOf(leaf) + 1 })})`), true);
      const point = await until(() => evaluate(`(() => {
        for (const line of document.querySelectorAll('.monaco-editor .view-line')) {
          if (!line.textContent.replace(/\\u00a0/g, ' ').includes(${JSON.stringify(needle)})) continue;
          const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) {
            const node = walker.currentNode;
            const offset = node.textContent.indexOf(${JSON.stringify(leaf)});
            if (offset < 0) continue;
            const range = document.createRange();
            range.setStart(node, offset + 1); range.setEnd(node, offset + 2);
            const rect = range.getBoundingClientRect();
            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
          }
        }
        return undefined;
      })()`));
      const mac = process.platform === 'darwin';
      // CDP modifier mask: Alt=1, Ctrl=2, Meta=4, Shift=8.
      const modifier = mac ? 4 : 2;
      const key = mac ? 'Meta' : 'Control';
      const code = mac ? 'MetaLeft' : 'ControlLeft';
      const windowsVirtualKeyCode = mac ? 91 : 17;
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode, modifiers: modifier });
      try {
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point, modifiers: modifier });
        await until(() => evaluate(`Array.from(document.querySelectorAll('.goto-definition-link')).some(link => link.textContent === ${JSON.stringify(linkedText)})`));
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1, modifiers: modifier });
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1, modifiers: modifier });
      } finally {
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode, modifiers: 0 });
      }
      await until(() => evaluate(`document.getElementById('status-bar-editor-status-cursor-position')?.textContent.includes('Ln ${expectedLine},')`));
      if (targetComment) await until(() => evaluate(`Array.from(document.querySelectorAll('.monaco-editor .view-line')).some(line => line.textContent.replace(/\\u00a0/g, ' ').includes(${JSON.stringify(targetComment)}))`));
      console.log(`${mac ? 'CMD' : 'CTRL'}+click: ${needle} -> declaration line ${expectedLine}`);
    }
    await clickSymbol('jsr Library.Target', 'Target', 'Library.Target', 3, 'Distinct navigation target');
    await capture('01-cross-file-definition.png');
    await clickSymbol('jsr Game.Second.loop', 'loop', 'Game.Second.loop', 9, 'bne loop // second', libraryPath);
    await clickSymbol('bne loop // first', 'loop', 'loop', 5);
    await clickSymbol('bne loop // second', 'loop', 'loop', 9);
    await clickSymbol('jsr Game.First.loop', 'loop', 'Game.First.loop', 5);
    await capture('02-local-scope-definition.png');
    await clickSymbol('jmp !again-', '!again-', '!again-', 15);
    await clickSymbol('jmp !again++', '!again++', '!again++', 21);
    await clickSymbol('jmp !++', '!++', '!++', 26);
    await capture('03-directional-definition.png');
    console.log('Language navigation UI e2e passed: program include graphs, external libraries, local and directional targets.');
  } finally {
    clearTimeout(timer);
    ws?.close();
    if (!exitResult) process.kill(-child.pid, 'SIGTERM');
    const shutdownTimer = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }, 3000);
    await exited;
    clearTimeout(shutdownTimer);
    await fs.writeFile(path.join(outputDir, 'electron.log'), log);
    await fs.rm(temp, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

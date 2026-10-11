#!/usr/bin/env node
import { execFile, spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function smokeTestVice(resourcesPath, timeoutMs = 15000) {
  const executable = path.join(resourcesPath, 'bin', 'x64sc');
  const env = Object.fromEntries(Object.entries(process.env)
    .filter(([name]) => !name.startsWith('DYLD_') && name !== 'LD_LIBRARY_PATH' && name !== 'LD_PRELOAD'));
  // Exercise early path discovery too; it precedes normal argv initialization.
  try {
    await promisify(execFile)(executable, ['-version'], {
      env, timeout: timeoutMs, killSignal: 'SIGKILL'
    });
  } catch (error) {
    throw new Error(`VICE version check failed: ${error.message}\n${error.stdout ?? ''}${error.stderr ?? ''}`);
  }
  const runtime = path.join(repoRoot, 'packages', 'vice-runtime', 'lib');
  const { ViceFrameTransport } = await import(pathToFileURL(path.join(runtime, 'vice-frame-transport.js')).href);
  const { parseViceEmbedBinaryFrameRecord } = await import(pathToFileURL(path.join(runtime, 'vice-binary-frame.js')).href);
  const workingDirectory = await mkdtemp(path.join(os.tmpdir(), 'cc-vice-smoke-'));
  let child;
  let timer;
  let log = '';
  let resolveFrame;
  let rejectFrame;
  let frameCount = 0;
  const frameReady = new Promise((resolve, reject) => {
    resolveFrame = resolve;
    rejectFrame = reject;
  });
  // Startup can fail while the loopback server is still being opened.
  frameReady.catch(() => undefined);
  const transport = new ViceFrameTransport({
    onFrame: record => {
      const frame = parseViceEmbedBinaryFrameRecord(record);
      frameCount++;
      // Require ongoing rendering and visible content, not an initial blank.
      const firstPixel = frame.data.readUInt32LE(0) & 0x00ffffff;
      if (frameCount >= 5) {
        for (let offset = 4; offset < frame.data.length; offset += 4) {
          if (frame.data[offset + 3] > 0 &&
              (frame.data.readUInt32LE(offset) & 0x00ffffff) !== firstPixel) {
            resolveFrame(frame);
            return;
          }
        }
      }
    },
    onError: error => rejectFrame(error),
    onSocketError: error => rejectFrame(error)
  });

  try {
    const port = await transport.start();
    child = spawn(executable, [
      '-default', '-cc-embed', '-cc-frame-port', String(port),
      '-cc-command-fd', '3', '-directory', path.join(resourcesPath, 'share', 'vice')
    ], {
      cwd: workingDirectory,
      // Do not inherit user VICE configuration or dynamic-loader overrides.
      env,
      stdio: ['ignore', 'pipe', 'pipe', 'pipe']
    });
    const appendLog = chunk => { log = (log + chunk.toString()).slice(-8000); };
    child.stdout.on('data', appendLog);
    child.stderr.on('data', appendLog);
    child.on('error', rejectFrame);
    child.on('exit', (code, signal) => rejectFrame(
      new Error(`VICE exited before producing a frame (${signal ?? `exit ${code}`}).`)
    ));
    timer = setTimeout(() => rejectFrame(new Error(
      `VICE produced no visible content within ${timeoutMs} ms (${frameCount} frames received).`
    )), timeoutMs);
    const frame = await frameReady;
    console.log(`VICE package smoke test received ${frameCount} frames, including ${frame.width}x${frame.height} visible RGBA content.`);
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${log.trim()}`);
  } finally {
    clearTimeout(timer);
    transport.stop();
    // VICE's macOS exit cleanup can hang; the smoke test owns this child only.
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = new Promise(resolve => child.once('exit', resolve));
      child.kill('SIGKILL');
      await exited;
    }
    await rm(workingDirectory, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) {
    console.error('Usage: node tools/smoke-test-vice.mjs <runtime root containing bin and share/vice>');
    process.exitCode = 1;
  } else {
    smokeTestVice(path.resolve(process.argv[2])).catch(error => {
      console.error(error.message);
      process.exitCode = 1;
    });
  }
}

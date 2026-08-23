#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const productName = 'Commodore Commander';
const sidScoreCliJar = 'sidscore-cli-0.7.1.jar';
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SRAP_MAGIC = 0x53524150;
const SRAP_VERSION = 1;
const SRAP_HEADER_BYTES = 24;
const FRAME_HELLO = 0x01;
const FRAME_HELLO_ACK = 0x02;
const FRAME_SCAN_MIDI_DEVICES = 0x17;
const FRAME_MIDI_DEVICE_LIST = 0x27;
const FRAME_ERROR = 0x7f;
const CAP_MIDI_DEVICE_LIST = 1 << 6;
const CAP_MIDI_STATE = 1 << 7;

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const layout = resolvePackageLayout(options.packageDir);
  verifyPackageLayout(layout);
  await smokeTestSidScore(layout, options);
  console.log(`Product package smoke test passed: ${path.relative(repoRoot, layout.packageDir)}`);
}

function parseArgs(args) {
  const options = {
    packageDir: defaultPackageDir(),
    javaCommand: process.env.COMMODORE_COMMANDER_JAVA_RUNTIME ?? 'java',
    timeoutMs: 15000,
    help: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case '--package-dir':
        options.packageDir = resolvePathArg(valueArg(args, ++index, arg));
        break;
      case '--java-command':
        options.javaCommand = valueArg(args, ++index, arg);
        break;
      case '--timeout':
        options.timeoutMs = positiveInteger(valueArg(args, ++index, arg), arg);
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

function resolvePackageLayout(packageDir) {
  const normalizedPackageDir = path.resolve(repoRoot, packageDir);
  const macAppResources = path.join(normalizedPackageDir, 'Contents', 'Resources', 'app');
  if (existsSync(macAppResources)) {
    return {
      packageDir: normalizedPackageDir,
      appResourcesDir: macAppResources,
      executablePath: path.join(normalizedPackageDir, 'Contents', 'MacOS', productName),
      kickAssemblerJarPath: path.join(
        macAppResources,
        'lib',
        'backend',
        'assets',
        'kickassembler',
        'KickAss.jar'
      ),
      sidScoreCliJarPath: path.join(
        macAppResources,
        'lib',
        'backend',
        'assets',
        'sidscore',
        sidScoreCliJar
      )
    };
  }

  const portableAppResources = path.join(normalizedPackageDir, 'resources', 'app');
  if (existsSync(portableAppResources)) {
    const executableName = process.platform === 'win32'
      ? `${productName}.exe`
      : 'commodore-commander';
    return {
      packageDir: normalizedPackageDir,
      appResourcesDir: portableAppResources,
      executablePath: path.join(normalizedPackageDir, executableName),
      kickAssemblerJarPath: path.join(
        portableAppResources,
        'lib',
        'backend',
        'assets',
        'kickassembler',
        'KickAss.jar'
      ),
      sidScoreCliJarPath: path.join(
        portableAppResources,
        'lib',
        'backend',
        'assets',
        'sidscore',
        sidScoreCliJar
      )
    };
  }

  throw new Error(`Unsupported product package layout: ${normalizedPackageDir}`);
}

function verifyPackageLayout(layout) {
  const requiredPaths = [
    [layout.packageDir, 'product package directory'],
    [layout.executablePath, 'product executable'],
    [path.join(layout.appResourcesDir, 'package.json'), 'packaged package.json'],
    [path.join(layout.appResourcesDir, 'lib', 'backend', 'electron-main.js'), 'packaged backend'],
    [path.join(layout.appResourcesDir, 'lib', 'frontend', 'index.html'), 'packaged frontend'],
    [path.join(layout.appResourcesDir, 'plugins'), 'packaged plugins'],
    [layout.kickAssemblerJarPath, 'packaged Kick Assembler jar'],
    [layout.sidScoreCliJarPath, 'packaged SIDScore jar']
  ];

  for (const [requiredPath, description] of requiredPaths) {
    assertPath(requiredPath, description);
  }

  if (process.platform !== 'win32') {
    const mode = statSync(layout.executablePath).mode;
    if ((mode & 0o111) === 0) {
      throw new Error(`Product executable is not executable: ${layout.executablePath}`);
    }
  }
}

async function smokeTestSidScore(layout, options) {
  const { createSidScorePlayerServerArgs } = await importSidScoreLaunchModule();
  const args = createSidScorePlayerServerArgs({
    kickAssemblerJarPath: layout.kickAssemblerJarPath,
    sidScoreCliJarPath: layout.sidScoreCliJarPath,
    platform: process.platform
  });
  const child = spawn(options.javaCommand, args, {
    cwd: layout.appResourcesDir,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const log = createProcessLog(child);

  try {
    const ready = await waitForSidScoreReady(child, log, options.timeoutMs);
    await scanMidiDevices(ready.port, options.timeoutMs);
  } finally {
    if (!child.killed && child.exitCode === null && child.signalCode === null) {
      child.kill();
    }
    await waitForExit(child, 3000).catch(() => undefined);
  }
}

async function importSidScoreLaunchModule() {
  const modulePath = path.join(
    repoRoot,
    'packages',
    'theia-extension',
    'lib',
    'node',
    'sidscore-launch.js'
  );
  assertPath(modulePath, 'built SIDScore launch module');
  return import(pathToFileURL(modulePath).href);
}

function waitForSidScoreReady(child, log, timeoutMs) {
  return new Promise((resolve, reject) => {
    let stdoutBuffer = '';

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for SIDScore player server ready event.\n${log.tail()}`));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timeout);
      child.stdout.off('data', onStdout);
      child.off('error', onError);
      child.off('exit', onExit);
    };

    const onStdout = (chunk) => {
      stdoutBuffer += chunk.toString();
      let newline = stdoutBuffer.indexOf('\n');
      while (newline >= 0) {
        const line = stdoutBuffer.slice(0, newline).trim();
        stdoutBuffer = stdoutBuffer.slice(newline + 1);
        const ready = parseReadyEvent(line);
        if (ready) {
          cleanup();
          resolve(ready);
          return;
        }
        newline = stdoutBuffer.indexOf('\n');
      }
    };

    const onError = (error) => {
      cleanup();
      reject(new Error(`Failed to start SIDScore player server: ${error.message}\n${log.tail()}`));
    };

    const onExit = (code, signal) => {
      cleanup();
      reject(
        new Error(
          `SIDScore player server exited before ready (${formatExit(code, signal)}).\n${log.tail()}`
        )
      );
    };

    child.stdout.on('data', onStdout);
    child.once('error', onError);
    child.once('exit', onExit);
  });
}

async function scanMidiDevices(port, timeoutMs) {
  const socket = await connectToServer(port, timeoutMs);
  const reader = new SrapFrameReader(socket);
  try {
    socket.write(createFrame(FRAME_HELLO, payload()
      .str('Commodore Commander product smoke')
      .u16(SRAP_VERSION)
      .u16(SRAP_VERSION)
      .u32(CAP_MIDI_DEVICE_LIST | CAP_MIDI_STATE)
      .toBuffer()));
    const helloAck = await reader.waitFor(
      frame => frame.type === FRAME_HELLO_ACK || frame.type === FRAME_ERROR,
      'HELLO_ACK',
      timeoutMs
    );
    throwIfErrorFrame(helloAck);

    const requestId = 1;
    socket.write(createFrame(FRAME_SCAN_MIDI_DEVICES, payload().u32(requestId).toBuffer()));
    const deviceList = await reader.waitFor(
      frame => frame.type === FRAME_MIDI_DEVICE_LIST || frame.type === FRAME_ERROR,
      'MIDI_DEVICE_LIST',
      timeoutMs
    );
    throwIfErrorFrame(deviceList);
    const responseRequestId = deviceList.payload.readUInt32LE(0);
    if (responseRequestId !== requestId) {
      throw new Error(
        `Unexpected MIDI device list request id: ${responseRequestId}; expected ${requestId}.`
      );
    }
    const deviceCount = deviceList.payload.readUInt16LE(4);
    console.log(`SIDScore MIDI scan returned ${deviceCount} device(s).`);
  } finally {
    socket.on('error', () => undefined);
    reader.dispose();
    socket.destroy();
  }
}

function connectToServer(port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    const timeout = setTimeout(() => {
      cleanup();
      socket.destroy();
      reject(new Error(`Timed out connecting to SIDScore player server on port ${port}.`));
    }, timeoutMs);
    const cleanup = () => {
      clearTimeout(timeout);
      socket.off('connect', onConnect);
      socket.off('error', onError);
    };
    const onConnect = () => {
      cleanup();
      resolve(socket);
    };
    const onError = (error) => {
      cleanup();
      reject(new Error(`Could not connect to SIDScore player server: ${error.message}`));
    };
    socket.once('connect', onConnect);
    socket.once('error', onError);
  });
}

class SrapFrameReader {
  constructor(socket) {
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.frames = [];
    this.waiters = [];
    this.disposed = false;
    this.onData = chunk => this.read(chunk);
    this.onClose = () => this.failAll(new Error('SIDScore player server socket closed.'));
    this.onError = error => this.failAll(error);
    socket.on('data', this.onData);
    socket.on('close', this.onClose);
    socket.on('error', this.onError);
  }

  waitFor(predicate, description, timeoutMs) {
    if (this.disposed) {
      return Promise.reject(new Error('SIDScore protocol reader is disposed.'));
    }

    const existingIndex = this.frames.findIndex(predicate);
    if (existingIndex >= 0) {
      const [frame] = this.frames.splice(existingIndex, 1);
      return Promise.resolve(frame);
    }

    return new Promise((resolve, reject) => {
      const waiter = {
        predicate,
        resolve,
        reject,
        timeout: setTimeout(() => {
          this.waiters = this.waiters.filter(candidate => candidate !== waiter);
          reject(new Error(`Timed out waiting for SIDScore ${description} frame.`));
        }, timeoutMs)
      };
      this.waiters.push(waiter);
    });
  }

  read(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= SRAP_HEADER_BYTES) {
      const magic = this.buffer.readUInt32LE(0);
      if (magic !== SRAP_MAGIC) {
        this.failAll(new Error(`Invalid SRAP magic: 0x${magic.toString(16)}.`));
        return;
      }
      const version = this.buffer.readUInt8(4);
      if (version !== SRAP_VERSION) {
        this.failAll(new Error(`Unsupported SRAP version: ${version}.`));
        return;
      }
      const payloadLength = this.buffer.readUInt32LE(20);
      if (this.buffer.length < SRAP_HEADER_BYTES + payloadLength) {
        return;
      }
      const frame = {
        type: this.buffer.readUInt8(5),
        flags: this.buffer.readUInt16LE(6),
        sequence: this.buffer.readUInt32LE(8),
        payload: this.buffer.subarray(SRAP_HEADER_BYTES, SRAP_HEADER_BYTES + payloadLength)
      };
      this.buffer = this.buffer.subarray(SRAP_HEADER_BYTES + payloadLength);
      this.push(frame);
    }
  }

  push(frame) {
    const waiter = this.waiters.find(candidate => candidate.predicate(frame));
    if (!waiter) {
      this.frames.push(frame);
      return;
    }
    clearTimeout(waiter.timeout);
    this.waiters = this.waiters.filter(candidate => candidate !== waiter);
    waiter.resolve(frame);
  }

  failAll(error) {
    for (const waiter of this.waiters) {
      clearTimeout(waiter.timeout);
      waiter.reject(error);
    }
    this.waiters = [];
  }

  dispose() {
    this.disposed = true;
    this.socket.off('data', this.onData);
    this.socket.off('close', this.onClose);
    this.socket.off('error', this.onError);
    this.failAll(new Error('SIDScore protocol reader disposed.'));
  }
}

function createFrame(type, framePayload) {
  const header = Buffer.alloc(SRAP_HEADER_BYTES);
  header.writeUInt32LE(SRAP_MAGIC, 0);
  header.writeUInt8(SRAP_VERSION, 4);
  header.writeUInt8(type, 5);
  header.writeUInt16LE(0, 6);
  header.writeUInt32LE(0, 8);
  header.writeBigUInt64LE(process.hrtime.bigint(), 12);
  header.writeUInt32LE(framePayload.length, 20);
  return Buffer.concat([header, framePayload]);
}

function payload() {
  const chunks = [];
  return {
    u16(value) {
      const buffer = Buffer.alloc(2);
      buffer.writeUInt16LE(value & 0xffff, 0);
      chunks.push(buffer);
      return this;
    },
    u32(value) {
      const buffer = Buffer.alloc(4);
      buffer.writeUInt32LE(value >>> 0, 0);
      chunks.push(buffer);
      return this;
    },
    str(value) {
      const encoded = Buffer.from(value, 'utf8');
      if (encoded.length > 0xffff) {
        throw new Error(`SIDScore protocol string is too long: ${encoded.length} bytes.`);
      }
      this.u16(encoded.length);
      chunks.push(encoded);
      return this;
    },
    toBuffer() {
      return Buffer.concat(chunks);
    }
  };
}

function throwIfErrorFrame(frame) {
  if (frame.type !== FRAME_ERROR) {
    return;
  }

  const requestId = frame.payload.length >= 4 ? frame.payload.readUInt32LE(0) : 0;
  let message = `SIDScore protocol error for request ${requestId}.`;
  if (frame.payload.length >= 14) {
    const messageLength = frame.payload.readUInt16LE(12);
    const messageStart = 14;
    const messageEnd = Math.min(messageStart + messageLength, frame.payload.length);
    message = frame.payload.subarray(messageStart, messageEnd).toString('utf8');
  }
  throw new Error(message);
}

function parseReadyEvent(line) {
  if (!line.startsWith('{')) {
    return undefined;
  }
  try {
    const event = JSON.parse(line);
    if (
      event?.event === 'ready' &&
      event.protocol === 'srap-server' &&
      event.version === SRAP_VERSION &&
      Number.isInteger(event.port)
    ) {
      return event;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function createProcessLog(child) {
  const lines = [];
  const append = (chunk) => {
    for (const line of chunk.toString().split(/\r?\n/u)) {
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
    tail: () => lines.join('\n')
  };
}

function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Timed out waiting for SIDScore player server shutdown.'));
    }, timeoutMs);
    child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

function assertPath(requiredPath, description) {
  if (!existsSync(requiredPath)) {
    throw new Error(`Missing ${description}: ${path.relative(repoRoot, requiredPath)}`);
  }
}

function defaultPackageDir() {
  switch (process.platform) {
    case 'darwin':
      return path.join('dist', 'nightly', `${productName}-${process.platform}-${process.arch}.app`);
    case 'win32':
      return path.join('dist', 'nightly', `commodore-commander-${process.platform}-${process.arch}`);
    case 'linux':
      return path.join('dist', 'nightly', `commodore-commander-${process.platform}-${process.arch}`);
    default:
      return path.join('dist', 'nightly', `commodore-commander-${process.platform}-${process.arch}`);
  }
}

function resolvePathArg(value) {
  if (value.startsWith('~/')) {
    return path.resolve(process.env.HOME ?? repoRoot, value.slice(2));
  }
  return path.resolve(repoRoot, value);
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

function formatExit(code, signal) {
  return signal ? `signal ${signal}` : `exit ${code}`;
}

function printHelp() {
  console.log(`Usage: npm run test:product-package -- [options]

Runs smoke tests against a packaged Commodore Commander product directory.

Options:
  --package-dir <path>  Product package directory. Defaults to current platform output.
  --java-command <cmd>  Java command used for SIDScore. Default: java
  --timeout <ms>        SIDScore startup/protocol timeout. Default: 15000
  -h, --help            Show this help
`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

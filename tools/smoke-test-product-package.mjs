#!/usr/bin/env node
import { execFile, spawn } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import { promisify } from 'node:util';
import { bundledViceLayout, packagedViceResources } from './vice-embed/runtime-layout.cjs';
import { smokeTestVice } from './smoke-test-vice.mjs';
import { smokeTestProductUi } from './smoke-test-product-ui.mjs';

const productName = 'Commodore Commander';
const sidScoreCliJar = 'sidscore-cli-0.8.0.jar';
const sidScorePluginJar = 'sidscore-kickass-plugin.jar';
const sidScoreMainClass = 'net/resheim/sidscore/SIDScoreCLI.class';
const sidScoreModuleExporterClass = 'net/resheim/sidscore/export/SIDScoreModuleExporter.class';
const sidScorePluginClass = 'net/resheim/cc/sidscore/kickass/SIDScoreArchive.class';
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
  await smokeTestKickAssembler(layout, options);
  if (bundledViceLayout()) {
    const resources = packagedViceResources(layout.appResourcesDir);
    await smokeTestVice(resources, options.timeoutMs, {
      outputPath: path.join(options.outputDir, 'vice-default.log')
    });
    await smokeTestVice(resources, options.timeoutMs, {
      soundDevice: 'cc-smoke-missing-audio', expectSoundError: true,
      outputPath: path.join(options.outputDir, 'vice-audio-error.log')
    });
  }
  await smokeTestSidScore(layout, options);
  if (bundledViceLayout()) {
    await smokeTestProductUi(layout, options.outputDir, options.uiTimeoutMs);
  }
  console.log(`Product package smoke test passed: ${path.relative(repoRoot, layout.packageDir)}`);
}

function parseArgs(args) {
  const options = {
    packageDir: defaultPackageDir(),
    javaCommand: process.env.COMMODORE_COMMANDER_JAVA_RUNTIME ?? 'java',
    timeoutMs: 15000,
    uiTimeoutMs: 90000,
    outputDir: path.join(repoRoot, 'test-results', 'product-package'),
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
      case '--ui-timeout':
        options.uiTimeoutMs = positiveInteger(valueArg(args, ++index, arg), arg);
        break;
      case '--output-dir':
        options.outputDir = resolvePathArg(valueArg(args, ++index, arg));
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
      ),
      sidScorePluginJarPath: path.join(
        macAppResources,
        'lib',
        'backend',
        'assets',
        'sidscore',
        sidScorePluginJar
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
      ),
      sidScorePluginJarPath: path.join(
        portableAppResources,
        'lib',
        'backend',
        'assets',
        'sidscore',
        sidScorePluginJar
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
    [layout.sidScoreCliJarPath, 'packaged SIDScore jar'],
    [layout.sidScorePluginJarPath, 'packaged SIDScore KickAssembler plugin jar']
  ];

  for (const [requiredPath, description] of requiredPaths) {
    assertPath(requiredPath, description);
  }
  readJarClassMajorVersion(layout.sidScoreCliJarPath, sidScoreMainClass);
  readJarClassMajorVersion(layout.sidScoreCliJarPath, sidScoreModuleExporterClass);
  readJarClassMajorVersion(layout.sidScorePluginJarPath, sidScorePluginClass);

  if (process.platform !== 'win32') {
    const mode = statSync(layout.executablePath).mode;
    if ((mode & 0o111) === 0) {
      throw new Error(`Product executable is not executable: ${layout.executablePath}`);
    }
  }
}

async function smokeTestKickAssembler(layout, options) {
  const workingDirectory = await mkdtemp(path.join(os.tmpdir(), 'cc-kickass-smoke-'));
  try {
    const source = path.join(workingDirectory, 'main.asm');
    const program = path.join(workingDirectory, 'main.prg');
    await writeFile(source, '*=$1000\nStart: lda #$2a\nsta $0400\nrts\n');
    await promisify(execFile)(options.javaCommand, [
      '-jar', layout.kickAssemblerJarPath, source, '-o', program
    ], { cwd: workingDirectory, timeout: options.timeoutMs, killSignal: 'SIGKILL' });
    const actual = await readFile(program);
    const expected = Buffer.from([0x00, 0x10, 0xa9, 0x2a, 0x8d, 0x00, 0x04, 0x60]);
    if (!actual.equals(expected)) {
      throw new Error(`Kick Assembler emitted unexpected PRG bytes: ${actual.toString('hex')}`);
    }
    console.log('Packaged Kick Assembler compiled a program with the expected load address and 6502 instructions.');
  } catch (error) {
    throw new Error(`Packaged Kick Assembler smoke test failed: ${error.message}\n${error.stdout ?? ''}${error.stderr ?? ''}`);
  } finally {
    await rm(workingDirectory, { recursive: true, force: true });
  }
}

async function smokeTestSidScore(layout, options) {
  const sidScoreClassMajorVersion = readJarClassMajorVersion(
    layout.sidScoreCliJarPath,
    sidScoreMainClass
  );
  await assertJavaCommandSupportsClassVersion(
    options.javaCommand,
    sidScoreClassMajorVersion,
    options.timeoutMs
  );

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

function readJarClassMajorVersion(jarPath, classEntryName) {
  const classFile = readJarEntry(jarPath, classEntryName);
  if (classFile.length < 8 || classFile.readUInt32BE(0) !== 0xcafebabe) {
    throw new Error(`Invalid Java class file in ${path.basename(jarPath)}: ${classEntryName}`);
  }
  return classFile.readUInt16BE(6);
}

async function assertJavaCommandSupportsClassVersion(javaCommand, classMajorVersion, timeoutMs) {
  const requiredJavaRelease = javaReleaseForClassMajorVersion(classMajorVersion);
  const runtime = await readJavaRuntimeVersion(javaCommand, timeoutMs);
  console.log(
    `SIDScore Java runtime: ${javaCommand} -> ${runtime.version} ` +
    `(Java ${runtime.major}); bundled SIDScore requires Java ${requiredJavaRelease}+.`
  );
  if (runtime.major < requiredJavaRelease) {
    throw new Error(
      `SIDScore Java runtime is Java ${runtime.major}, but the bundled SIDScore jar ` +
      `requires Java ${requiredJavaRelease}+ (class file major ${classMajorVersion}). ` +
      'Install a newer Java runtime or set COMMODORE_COMMANDER_JAVA_RUNTIME.'
    );
  }
}

function readJavaRuntimeVersion(javaCommand, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(javaCommand, ['-version'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';
    const timeout = setTimeout(() => {
      cleanup();
      child.kill('SIGKILL');
      reject(new Error(`Timed out checking Java runtime version: ${javaCommand}`));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timeout);
      child.stdout.off('data', onOutput);
      child.stderr.off('data', onOutput);
      child.off('error', onError);
      child.off('exit', onExit);
    };
    const onOutput = (chunk) => {
      output += chunk.toString();
    };
    const onError = (error) => {
      cleanup();
      reject(new Error(`Failed to run Java runtime ${javaCommand}: ${error.message}`));
    };
    const onExit = (code, signal) => {
      cleanup();
      if (code !== 0) {
        reject(new Error(`Java runtime version check failed (${formatExit(code, signal)}).\n${output}`));
        return;
      }
      try {
        resolve(parseJavaRuntimeVersion(output));
      } catch (error) {
        reject(error);
      }
    };

    child.stdout.on('data', onOutput);
    child.stderr.on('data', onOutput);
    child.once('error', onError);
    child.once('exit', onExit);
  });
}

function parseJavaRuntimeVersion(output) {
  const match = output.match(/(?:openjdk|java) version "([^"]+)"/iu);
  if (!match) {
    throw new Error(`Could not parse Java runtime version output.\n${output}`);
  }
  const version = match[1];
  const major = parseJavaMajorVersion(version);
  if (!Number.isInteger(major)) {
    throw new Error(`Could not parse Java major version from: ${version}`);
  }
  return { version, major };
}

function parseJavaMajorVersion(version) {
  const legacy = version.match(/^1\.(\d+)/u);
  if (legacy) {
    return Number.parseInt(legacy[1], 10);
  }
  const modern = version.match(/^(\d+)/u);
  return modern ? Number.parseInt(modern[1], 10) : NaN;
}

function javaReleaseForClassMajorVersion(classMajorVersion) {
  if (classMajorVersion < 45) {
    throw new Error(`Unsupported Java class file major version: ${classMajorVersion}`);
  }
  return classMajorVersion - 44;
}

function readJarEntry(jarPath, entryName) {
  const jar = readFileSync(jarPath);
  const centralDirectory = findZipCentralDirectory(jar, jarPath);

  let entryOffset = centralDirectory.offset;
  for (let index = 0; index < centralDirectory.entries; index += 1) {
    if (jar.readUInt32LE(entryOffset) !== 0x02014b50) {
      throw new Error(`Invalid ZIP central directory in ${jarPath}.`);
    }

    const compressionMethod = jar.readUInt16LE(entryOffset + 10);
    const compressedSize = jar.readUInt32LE(entryOffset + 20);
    const fileNameLength = jar.readUInt16LE(entryOffset + 28);
    const extraLength = jar.readUInt16LE(entryOffset + 30);
    const commentLength = jar.readUInt16LE(entryOffset + 32);
    const localHeaderOffset = jar.readUInt32LE(entryOffset + 42);
    const fileNameStart = entryOffset + 46;
    const fileNameEnd = fileNameStart + fileNameLength;
    const fileName = jar.subarray(fileNameStart, fileNameEnd).toString('utf8');

    if (fileName === entryName) {
      return readZipEntryData(
        jar,
        jarPath,
        entryName,
        localHeaderOffset,
        compressedSize,
        compressionMethod
      );
    }

    entryOffset = fileNameEnd + extraLength + commentLength;
  }

  throw new Error(`Missing ${entryName} in ${jarPath}.`);
}

function findZipCentralDirectory(zip, zipPath) {
  const minOffset = Math.max(0, zip.length - 65_557);
  for (let offset = zip.length - 22; offset >= minOffset; offset -= 1) {
    if (zip.readUInt32LE(offset) === 0x06054b50) {
      return {
        entries: zip.readUInt16LE(offset + 10),
        offset: zip.readUInt32LE(offset + 16)
      };
    }
  }
  throw new Error(`Could not find ZIP central directory in ${zipPath}.`);
}

function readZipEntryData(
  zip,
  zipPath,
  entryName,
  localHeaderOffset,
  compressedSize,
  compressionMethod
) {
  if (zip.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
    throw new Error(`Invalid ZIP local header for ${entryName} in ${zipPath}.`);
  }

  const fileNameLength = zip.readUInt16LE(localHeaderOffset + 26);
  const extraLength = zip.readUInt16LE(localHeaderOffset + 28);
  const dataStart = localHeaderOffset + 30 + fileNameLength + extraLength;
  const compressed = zip.subarray(dataStart, dataStart + compressedSize);
  switch (compressionMethod) {
    case 0:
      return Buffer.from(compressed);
    case 8:
      return inflateRawSync(compressed);
    default:
      throw new Error(
        `Unsupported ZIP compression method ${compressionMethod} for ${entryName} in ${zipPath}.`
      );
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
  --java-command <cmd>  Java command for Kick Assembler and SIDScore. Default: java
  --timeout <ms>        Compiler/emulator/player startup timeout. Default: 15000
  --ui-timeout <ms>     Packaged macOS UI timeout. Default: 90000
  --output-dir <path>   Packaged UI logs/screenshots. Default: test-results/product-package
  -h, --help            Show this help
`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

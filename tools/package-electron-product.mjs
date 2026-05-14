#!/usr/bin/env node
import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const productName = 'Commodore Commander';
const macExecutableName = productName;
const linuxExecutableName = 'commodore-commander';
const windowsExecutableName = `${productName}.exe`;
const defaultBundleId = 'net.resheim.commodore-commander';
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const electronAppRoot = path.join(repoRoot, 'applications', 'electron');

const options = parseOptions(process.argv.slice(2));
const outputPath = path.resolve(
  repoRoot,
  options.output ?? defaultOutputPath(process.platform, process.arch)
);
const bundleId = options.bundleId ?? process.env.CC_BUNDLE_ID ?? defaultBundleId;
const signingIdentity = options.signingIdentity ?? process.env.CC_CODESIGN_IDENTITY ?? '-';

await main();

async function main() {
  assertBuiltApplication();

  const packageJson = readJson(path.join(electronAppRoot, 'package.json'));
  const version = String(packageJson.version ?? '0.0.0');

  switch (process.platform) {
    case 'darwin':
      await packageMacApplication(packageJson, version);
      break;
    case 'win32':
      await packagePortableApplication(packageJson, windowsExecutableName);
      break;
    case 'linux':
      await packagePortableApplication(packageJson, linuxExecutableName);
      break;
    default:
      throw new Error(`Unsupported packaging platform: ${process.platform}`);
  }

  console.log(`Packaged ${productName} at ${path.relative(repoRoot, outputPath)}`);
}

async function packageMacApplication(packageJson, version) {
  const electronSourceAppPath = path.join(
    repoRoot,
    'node_modules',
    'electron',
    'dist',
    'Electron.app'
  );
  assertPath(electronSourceAppPath, 'Electron runtime app');

  await replaceDirectory(outputPath, electronSourceAppPath);
  await removeQuarantine(outputPath);
  prepareMacBundle(version);
  await installApplicationPayload(
    packageJson,
    path.join(outputPath, 'Contents', 'Resources', 'app')
  );

  if (!options.skipSign) {
    signApplication(outputPath, signingIdentity);
  }
}

async function packagePortableApplication(packageJson, executableName) {
  const electronRuntimeRoot = path.join(repoRoot, 'node_modules', 'electron', 'dist');
  assertPath(electronRuntimeRoot, 'Electron runtime directory');

  await replaceDirectory(outputPath, electronRuntimeRoot);
  preparePortableRuntime(executableName);
  await installApplicationPayload(packageJson, path.join(outputPath, 'resources', 'app'));
}

function assertBuiltApplication() {
  for (const requiredPath of [
    path.join(electronAppRoot, 'lib', 'backend', 'electron-main.js'),
    path.join(electronAppRoot, 'lib', 'frontend', 'index.html'),
    path.join(electronAppRoot, 'plugins'),
    path.join(electronAppRoot, 'assets', 'cc.icns'),
    path.join(electronAppRoot, 'assets', 'cc_256.png')
  ]) {
    assertPath(requiredPath, 'built Electron application asset');
  }
}

function assertPath(requiredPath, description) {
  if (!fs.existsSync(requiredPath)) {
    throw new Error(
      `Missing ${description}: ${path.relative(repoRoot, requiredPath)}. ` +
        'Run `npm run theia:build` first.'
    );
  }
}

async function replaceDirectory(targetPath, sourcePath) {
  await fs.promises.rm(targetPath, { recursive: true, force: true });
  await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.promises.cp(sourcePath, targetPath, {
    recursive: true,
    dereference: false,
    preserveTimestamps: true,
    verbatimSymlinks: true,
    filter: source => path.basename(source) !== '.DS_Store'
  });
}

async function removeQuarantine(appPath) {
  runOptional('xattr', ['-cr', appPath]);
}

function prepareMacBundle(version) {
  const contentsPath = path.join(outputPath, 'Contents');
  const resourcesPath = path.join(contentsPath, 'Resources');
  const macOsPath = path.join(contentsPath, 'MacOS');
  const infoPlistPath = path.join(contentsPath, 'Info.plist');
  const electronExecutablePath = path.join(macOsPath, 'Electron');
  const productExecutablePath = path.join(macOsPath, macExecutableName);

  if (fs.existsSync(productExecutablePath)) {
    fs.rmSync(productExecutablePath);
  }
  fs.renameSync(electronExecutablePath, productExecutablePath);
  fs.cpSync(
    path.join(electronAppRoot, 'assets', 'cc.icns'),
    path.join(resourcesPath, 'cc.icns')
  );
  fs.rmSync(path.join(resourcesPath, 'default_app.asar'), { force: true });
  fs.rmSync(path.join(resourcesPath, 'app'), { recursive: true, force: true });

  setPlistValue(infoPlistPath, 'CFBundleDisplayName', productName);
  setPlistValue(infoPlistPath, 'CFBundleName', productName);
  setPlistValue(infoPlistPath, 'CFBundleExecutable', macExecutableName);
  setPlistValue(infoPlistPath, 'CFBundleIconFile', 'cc.icns');
  setPlistValue(infoPlistPath, 'CFBundleIdentifier', bundleId);
  setPlistValue(infoPlistPath, 'CFBundleShortVersionString', version);
  setPlistValue(infoPlistPath, 'CFBundleVersion', version);
  deletePlistValue(infoPlistPath, 'ElectronAsarIntegrity');
}

function preparePortableRuntime(executableName) {
  const resourcesPath = path.join(outputPath, 'resources');
  const sourceExecutableName = process.platform === 'win32' ? 'electron.exe' : 'electron';
  const sourceExecutablePath = path.join(outputPath, sourceExecutableName);
  const productExecutablePath = path.join(outputPath, executableName);

  assertPath(sourceExecutablePath, 'Electron runtime executable');
  if (sourceExecutablePath !== productExecutablePath && fs.existsSync(productExecutablePath)) {
    fs.rmSync(productExecutablePath);
  }
  if (sourceExecutablePath !== productExecutablePath) {
    fs.renameSync(sourceExecutablePath, productExecutablePath);
  }
  if (process.platform !== 'win32') {
    fs.chmodSync(productExecutablePath, 0o755);
  }

  fs.rmSync(path.join(resourcesPath, 'default_app.asar'), { force: true });
  fs.rmSync(path.join(resourcesPath, 'app'), { recursive: true, force: true });
  fs.cpSync(
    path.join(electronAppRoot, 'assets', 'cc_256.png'),
    path.join(outputPath, 'cc_256.png')
  );
}

async function installApplicationPayload(packageJson, appResourcesPath) {
  await fs.promises.mkdir(appResourcesPath, { recursive: true });

  const packagedPackageJson = {
    ...packageJson,
    productName,
    main: 'lib/backend/electron-main.js'
  };
  await fs.promises.writeFile(
    path.join(appResourcesPath, 'package.json'),
    `${JSON.stringify(packagedPackageJson, null, 2)}\n`
  );

  for (const entry of ['assets', 'lib', 'plugins']) {
    await fs.promises.cp(path.join(electronAppRoot, entry), path.join(appResourcesPath, entry), {
      recursive: true,
      dereference: false,
      preserveTimestamps: true,
      verbatimSymlinks: true,
      filter: source => path.basename(source) !== '.DS_Store'
    });
  }
}

function signApplication(appPath, identity) {
  run('codesign', ['--force', '--deep', '--sign', identity, appPath]);
  run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath]);
}

function setPlistValue(plistPath, key, value) {
  const setResult = runOptional('/usr/libexec/PlistBuddy', [
    '-c',
    `Set :${key} ${value}`,
    plistPath
  ]);
  if (setResult.status === 0) {
    return;
  }
  run('/usr/libexec/PlistBuddy', ['-c', `Add :${key} string ${value}`, plistPath]);
}

function deletePlistValue(plistPath, key) {
  runOptional('/usr/libexec/PlistBuddy', ['-c', `Delete :${key}`, plistPath]);
}

function run(command, args) {
  const result = runOptional(command, args);
  if (result.status === 0) {
    return result;
  }

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  throw new Error(
    `${command} ${args.join(' ')} failed with ${result.signal ?? `exit ${result.status}`}` +
      (output ? `\n${output}` : '')
  );
}

function runOptional(command, args) {
  return childProcess.spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function defaultOutputPath(platform, arch) {
  switch (platform) {
    case 'darwin':
      return path.join('dist', 'nightly', `${productName}-${platform}-${arch}.app`);
    case 'win32':
      return path.join('dist', 'nightly', `commodore-commander-${platform}-${arch}`);
    case 'linux':
      return path.join('dist', 'nightly', `commodore-commander-${platform}-${arch}`);
    default:
      return path.join('dist', 'nightly', `commodore-commander-${platform}-${arch}`);
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseOptions(args) {
  const parsed = {
    bundleId: undefined,
    output: undefined,
    signingIdentity: undefined,
    skipSign: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case '--bundle-id':
        parsed.bundleId = readOptionValue(args, ++index, arg);
        break;
      case '--identity':
        parsed.signingIdentity = readOptionValue(args, ++index, arg);
        break;
      case '--output':
        parsed.output = readOptionValue(args, ++index, arg);
        break;
      case '--skip-sign':
        parsed.skipSign = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  return parsed;
}

function readOptionValue(args, index, option) {
  const value = args[index];
  if (!value) {
    throw new Error(`Expected a value after ${option}.`);
  }
  return value;
}

#!/usr/bin/env node

import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, rm, stat } from 'node:fs/promises';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_PACKAGE_VERSION = '1.17.1';
const RIPGREP_RELEASES_BY_PACKAGE_VERSION = new Map([
    ['1.17.1', 'v15.0.1']
]);
const MULTI_ARCH_LINUX_VERSION = 'v13.0.0-4';
const MULTI_ARCH_LINUX_TARGETS = new Set([
    'arm-unknown-linux-gnueabihf',
    'powerpc64le-unknown-linux-gnu',
    's390x-unknown-linux-gnu'
]);

const force = process.argv.includes('--force');
const dryRun = process.argv.includes('--dry-run');

function getTarget() {
    const arch = process.env.npm_config_arch || os.arch();

    switch (os.platform()) {
        case 'darwin':
            return arch === 'arm64'
                ? 'aarch64-apple-darwin'
                : 'x86_64-apple-darwin';
        case 'win32':
            return arch === 'x64'
                ? 'x86_64-pc-windows-msvc'
                : arch === 'arm64'
                    ? 'aarch64-pc-windows-msvc'
                    : 'i686-pc-windows-msvc';
        case 'linux':
            return arch === 'x64'
                ? 'x86_64-unknown-linux-musl'
                : arch === 'arm' || arch === 'armv7l'
                    ? 'arm-unknown-linux-gnueabihf'
                    : arch === 'arm64'
                        ? 'aarch64-unknown-linux-musl'
                        : arch === 'ppc64'
                            ? 'powerpc64le-unknown-linux-gnu'
                            : arch === 'riscv64'
                                ? 'riscv64gc-unknown-linux-gnu'
                                : arch === 's390x'
                                    ? 's390x-unknown-linux-gnu'
                                    : 'i686-unknown-linux-musl';
        default:
            throw new Error(`Unknown platform: ${os.platform()}`);
    }
}

async function readRipgrepPackageVersion() {
    try {
        const packageLockPath = path.join(REPO_ROOT, 'package-lock.json');
        const packageLock = JSON.parse(await readFile(packageLockPath, 'utf8'));
        return packageLock.packages?.['node_modules/@vscode/ripgrep']?.version ?? DEFAULT_PACKAGE_VERSION;
    } catch (error) {
        console.warn(`Could not read @vscode/ripgrep version from package-lock.json: ${error.message}`);
        return DEFAULT_PACKAGE_VERSION;
    }
}

async function fileExists(filePath) {
    try {
        const existing = await stat(filePath);
        return existing.isFile() && existing.size > 0;
    } catch {
        return false;
    }
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function download(url, destination, redirectsRemaining = 5) {
    await new Promise((resolve, reject) => {
        const request = https.get(url, {
            headers: {
                'user-agent': 'commodore-commander-ci'
            }
        }, response => {
            const statusCode = response.statusCode ?? 0;
            if (statusCode >= 300 && statusCode < 400 && response.headers.location) {
                response.resume();
                if (redirectsRemaining <= 0) {
                    reject(new Error(`Too many redirects while downloading ${url}`));
                    return;
                }

                const redirectUrl = new URL(response.headers.location, url).toString();
                download(redirectUrl, destination, redirectsRemaining - 1).then(resolve, reject);
                return;
            }

            if (statusCode !== 200) {
                response.resume();
                reject(new Error(`Download failed with HTTP ${statusCode}`));
                return;
            }

            pipeline(response, createWriteStream(destination)).then(resolve, reject);
        });

        request.on('error', reject);
    });
}

async function downloadWithRetries(url, destination) {
    let lastError;

    for (let attempt = 1; attempt <= 5; attempt++) {
        try {
            await rm(destination, { force: true });
            await download(url, destination);
            return;
        } catch (error) {
            lastError = error;
            if (attempt === 5) {
                break;
            }

            const delay = 1000 * 2 ** attempt;
            console.warn(`Download attempt ${attempt} failed: ${error.message}`);
            await wait(delay);
        }
    }

    throw lastError;
}

async function main() {
    const packageVersion = await readRipgrepPackageVersion();
    const packageReleaseVersion = RIPGREP_RELEASES_BY_PACKAGE_VERSION.get(packageVersion);
    if (!packageReleaseVersion) {
        throw new Error(
            `No ripgrep release mapping for @vscode/ripgrep ${packageVersion}. ` +
            'Update tools/prepare-vscode-ripgrep-cache.mjs before running npm ci.'
        );
    }

    const target = getTarget();
    const releaseVersion = MULTI_ARCH_LINUX_TARGETS.has(target) ? MULTI_ARCH_LINUX_VERSION : packageReleaseVersion;
    const extension = os.platform() === 'win32' ? '.zip' : '.tar.gz';
    const assetName = `ripgrep-${releaseVersion}-${target}${extension}`;
    const cacheDir = path.join(os.tmpdir(), `vscode-ripgrep-cache-${packageVersion}`);
    const assetPath = path.join(cacheDir, assetName);
    const tempPath = `${assetPath}.tmp`;
    const assetUrl = `https://github.com/microsoft/ripgrep-prebuilt/releases/download/${releaseVersion}/${assetName}`;

    console.log(`@vscode/ripgrep cache: ${assetPath}`);
    console.log(`@vscode/ripgrep asset: ${assetUrl}`);

    if (dryRun) {
        return;
    }

    if (!force && await fileExists(assetPath)) {
        console.log('Using existing @vscode/ripgrep cached asset.');
        return;
    }

    await mkdir(cacheDir, { recursive: true });
    await downloadWithRetries(assetUrl, tempPath);
    if (!await fileExists(tempPath)) {
        throw new Error(`Downloaded asset is empty: ${tempPath}`);
    }

    if (force) {
        await rm(assetPath, { force: true });
    }
    await rename(tempPath, assetPath);
    console.log(`Prepared @vscode/ripgrep cached asset: ${assetPath}`);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});

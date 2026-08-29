/**
 * This file can be edited to customize webpack configuration.
 * To reset delete this file and rerun theia build again.
 */
// @ts-check
const configs = require('./gen-webpack.config.js');
const nodeConfig = require('./gen-webpack.node.config.js');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

const frontendOutputPath = configs[0].output.path;
const outputPath = nodeConfig.config.output.path;
const bundledDocsPath = path.resolve(__dirname, '..', '..', 'bundled-docs');
const bundledDocsTargetPath = path.resolve(frontendOutputPath, 'assets', 'docs');
const sidScoreCliJar = 'sidscore-cli-0.7.2.jar';
const sidScoreAssetsTargetPath = path.resolve(outputPath, 'assets', 'sidscore');
const supportsBundledViceAssets =
    process.platform === 'darwin' && process.arch === 'arm64';
const skipViceAssets =
    process.env.COMMODORE_COMMANDER_SKIP_VICE_ASSETS === '1' ||
    !supportsBundledViceAssets;
const viceInfoPlistPath = skipViceAssets
    ? undefined
    : require.resolve(
        '@commodore-commander/theia-extension/assets/vice/darwin-arm64/VICE.app/Contents/Info.plist'
    );
const viceAppPath = viceInfoPlistPath
    ? path.resolve(path.dirname(viceInfoPlistPath), '..')
    : undefined;
const viceAppTargetPath = path.resolve(
    outputPath,
    'assets',
    'vice',
    'darwin-arm64',
    'VICE.app'
);

class CleanSidScoreAssetsPlugin {
    apply(compiler) {
        compiler.hooks.beforeRun.tap('CleanSidScoreAssetsPlugin', () => {
            fs.rmSync(sidScoreAssetsTargetPath, { recursive: true, force: true });
        });
    }
}

class CleanBundledDocsAssetsPlugin {
    apply(compiler) {
        compiler.hooks.beforeRun.tap('CleanBundledDocsAssetsPlugin', () => {
            fs.rmSync(bundledDocsTargetPath, { recursive: true, force: true });
        });
    }
}

class CopyViceAppBundlePlugin {
    apply(compiler) {
        compiler.hooks.afterEmit.tap('CopyViceAppBundlePlugin', () => {
            fs.rmSync(viceAppTargetPath, { recursive: true, force: true });
            fs.cpSync(viceAppPath, viceAppTargetPath, {
                recursive: true,
                preserveTimestamps: true,
                verbatimSymlinks: true,
                filter: source => path.basename(source) !== '.DS_Store'
            });
            prepareMacOsAppBundle(viceAppTargetPath);
        });
    }
}

function prepareMacOsAppBundle(appPath) {
    makeWritable(appPath);

    if (process.platform !== 'darwin') {
        return;
    }

    run('xattr', ['-cr', appPath]);
    const identity = process.env.VICE_CODESIGN_IDENTITY ?? '-';
    const machOFiles = collectMachOFiles(appPath);
    for (const machOFile of machOFiles) {
        run('codesign', ['--force', '--sign', identity, machOFile]);
    }

    run('codesign', [
        '--force',
        '--deep',
        '--sign',
        identity,
        appPath
    ]);
    run('codesign', [
        '--verify',
        '--deep',
        '--strict',
        '--verbose=2',
        appPath
    ]);
    for (const machOFile of machOFiles) {
        run('codesign', ['--verify', machOFile]);
    }
}

function makeWritable(entryPath) {
    const stats = fs.lstatSync(entryPath);
    if (!stats.isSymbolicLink()) {
        fs.chmodSync(entryPath, stats.mode | 0o200);
    }

    if (!stats.isDirectory()) {
        return;
    }

    for (const entry of fs.readdirSync(entryPath)) {
        makeWritable(path.join(entryPath, entry));
    }
}

function run(command, args) {
    const result = childProcess.spawnSync(command, args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
    });
    if (result.status === 0) {
        return;
    }

    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
    throw new Error(
        `${command} ${args.join(' ')} failed with ${
            result.signal ?? `exit ${result.status}`
        }${output ? `\n${output}` : ''}`
    );
}

function collectMachOFiles(entryPath) {
    const stats = fs.lstatSync(entryPath);
    if (stats.isSymbolicLink()) {
        return [];
    }

    if (stats.isDirectory()) {
        return fs
            .readdirSync(entryPath)
            .flatMap(entry => collectMachOFiles(path.join(entryPath, entry)));
    }

    return isMachO(entryPath) ? [entryPath] : [];
}

function isMachO(filePath) {
    const fd = fs.openSync(filePath, 'r');
    try {
        const buffer = Buffer.alloc(4);
        const bytesRead = fs.readSync(fd, buffer, 0, 4, 0);
        return bytesRead === 4 && MACHO_MAGIC.has(buffer.readUInt32BE(0));
    } finally {
        fs.closeSync(fd);
    }
}

const MACHO_MAGIC = new Set([
    0xfeedface,
    0xfeedfacf,
    0xcefaedfe,
    0xcffaedfe,
    0xcafebabe,
    0xbebafeca,
    0xcafebabf,
    0xbfbafeca
]);

/**
 * Expose bundled modules on window.theia.moduleName namespace, e.g.
 * window['theia']['@theia/core/lib/common/uri'].
 * Such syntax can be used by external code, for instance, for testing.
configs[0].module.rules.push({
    test: /\.js$/,
    loader: require.resolve('@theia/application-manager/lib/expose-loader')
}); */

configs[0].plugins.push(
    new CopyWebpackPlugin({
        patterns: [
            {
                from: bundledDocsPath,
                to: bundledDocsTargetPath,
                globOptions: {
                    ignore: ['**/.DS_Store']
                }
            }
        ]
    })
);
configs[0].plugins.push(new CleanBundledDocsAssetsPlugin());

nodeConfig.config.plugins.push(
    new CopyWebpackPlugin({
        patterns: [
            {
                from: require.resolve(
                    '@commodore-commander/theia-extension/assets/kickassembler/KickAss.jar'
                ),
                to: path.resolve(
                    outputPath,
                    'assets',
                    'kickassembler',
                    'KickAss.jar'
                )
            },
            {
                from: require.resolve(
                    '@commodore-commander/theia-extension/assets/kickassembler/KickAss.cfg'
                ),
                to: path.resolve(
                    outputPath,
                    'assets',
                    'kickassembler',
                    'KickAss.cfg'
                )
            },
            {
                from: require.resolve(
                    `@commodore-commander/theia-extension/assets/sidscore/${sidScoreCliJar}`
                ),
                to: path.resolve(sidScoreAssetsTargetPath, sidScoreCliJar)
            }
        ]
    })
);
nodeConfig.config.plugins.push(new CleanSidScoreAssetsPlugin());
if (skipViceAssets) {
    console.warn(
        `Skipping bundled VICE app copy for ${process.platform}-${process.arch}.`
    );
} else {
    nodeConfig.config.plugins.push(new CopyViceAppBundlePlugin());
}

module.exports = [
    ...configs,
    nodeConfig.config
];

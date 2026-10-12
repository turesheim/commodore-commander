# Electron Application

`applications/electron` is the desktop product harness for Commodore Commander.
It loads `@commodore-commander/theia-extension` alongside Theia's workbench,
editor, debugger, task, terminal, plugin, and AI integrations. Product branding,
the default theme, splash screen, and window settings are configured here.

Language services, custom asset editors, SIDScore, and VICE integration are
provided by the extension and its supporting packages, rather than implemented
in this application directory.

## Build and run

From the repository root:

```sh
npm ci
npm run theia:build
npm run theia:start
```

`theia:build` compiles the supporting packages, rebuilds Electron native
modules, downloads the configured local plugins, and bundles the application.
The extension build can build/sync patched VICE on macOS Apple Silicon and Linux x64.
On Windows, build it first in MSYS2 MINGW64; asset sync then copies the staged
runtime. See
[`tools/vice-embed`](../../tools/vice-embed/README.md) for prerequisites and
options for using an external runtime.

## Packaging

`npm run package:mac` builds the product and writes
`dist/mac/Commodore Commander.app`. `npm run package:current` builds and packages
the current platform; the default output is under `dist/nightly`.

The nightly workflow targets macOS, Windows, and Linux. It skips packaging when
the branch commit matches its last successful run; manual dispatch can set
`force` to rebuild it. Package smoke tests run before upload. Packages include
app assets, bundled documentation, Kick Assembler, SIDScore 0.8.0 (Java 21+),
and applicable VICE assets. The patched embedded VICE build is currently
supplied for macOS Apple Silicon, Windows x64 and Linux x64 (Ubuntu 24.04 baseline). Stock external
VICE is an optional compatibility mode.

The Linux archive includes `LINUX-SETUP.txt`: configure its Electron
`chrome-sandbox` helper as root-owned mode 4755 once after extraction/update,
then launch the IDE as the normal user. CI tests this installed-package setup
without `--no-sandbox`; Ubuntu 24.04 restricts unprivileged user namespaces.

Package tests compile a small program with the bundled Kick Assembler and verify
the emitted PRG bytes, then exercise SIDScore startup and its SRAP/MIDI protocol.
On macOS Apple Silicon, Windows x64 and Linux x64 they also start bundled VICE, require visible native
frames, and launch the packaged Electron app in an isolated workspace/profile.
The UI test opens an assembly source and checks Machine canvas pixels through
two power-on/off cycles. It types `POKE53280,2` through Electron keyboard input
after matching the BASIC `READY.` glyphs against the bundled C64 character ROM,
then requires the emulated border color to change. Uniform or transparent frames
fail; FPS alone does not pass. Logs and screenshots, including the UI state on
failure, are retained as nightly test artifacts. The power-off check deliberately
replays an already-sent frame and requires the view to stay off before restarting.
The test waits for each typed prefix to appear as ROM glyphs before releasing the
key, then holds Return until the border changes. Fixed host-time key holds can
miss C64 keyboard scans on slow runners; this is not a typing throughput benchmark. Run locally:

```sh
npm run test:product-package -- --package-dir "dist/nightly/Commodore Commander.app"
```

The VICE dylib dependency graph is bundled without requiring Homebrew on the
user's machine. Linux bundles linked non-glibc libraries with relative ELF search
paths and runs the product UI test under Xvfb. Windows builds in MSYS2 MINGW64,
bundles the transitive PE DLL imports beside the executables, then tests the
product with the build prefix removed and MinGW/MSYS2 removed from PATH.
Fresh-host acceptance and minimum OS coverage remain release work. External VICE stays in
separate development tests.

macOS bundles are ad-hoc signed by default. Developer ID signing is supported;
notarization and installer image creation remain manual release steps. See the
[root README](../../README.md#product-packages) for signing configuration.

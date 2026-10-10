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
The extension build can build/sync patched VICE on macOS Apple Silicon; see
[`tools/vice-embed`](../../tools/vice-embed/README.md) for prerequisites and
options for using an external runtime.

## Packaging

`npm run package:mac` builds the product and writes
`dist/mac/Commodore Commander.app`. `npm run package:current` builds and packages
the current platform; the default output is under `dist/nightly`.

The nightly workflow targets macOS, Windows, and Linux and runs package smoke
tests before upload. Packaging includes the app assets, bundled documentation,
Kick Assembler, SIDScore, and applicable VICE assets. The patched embedded VICE
build is currently supplied for macOS Apple Silicon; other platforms can use an
external VICE installation.

macOS bundles are ad-hoc signed by default. Developer ID signing is supported;
notarization and installer image creation remain manual release steps. See the
[root README](../../README.md#product-packages) for signing configuration.

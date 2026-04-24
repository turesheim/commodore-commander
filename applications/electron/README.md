# Electron App

`applications/electron` is the primary Theia product harness for Commodore
Commander.

This package exists so local testing can move toward the desktop-oriented shape
the product will likely need as runtime, emulator, and filesystem integration
grow.

Current scope:

- Electron target for local manual testing
- minimal product identity owned by application config
- default Theia workbench features only
- local `@commodore-commander/theia-extension` loading
- macOS `.app` bundle assembly from the built Electron application

Intentionally deferred:

- debugger integration
- language/editor wiring beyond package loading
- cross-platform runtime packaging for VICE or related tools
- notarization and installer image creation

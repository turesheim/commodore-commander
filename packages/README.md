# Packages

Commodore Commander uses TypeScript npm workspaces for the active Theia product.
The Electron application lives in `applications/electron`.

| Package | Responsibility |
| --- | --- |
| `language-support` | Documents, includes, symbols, editor services, machine profiles, reference data, and build planning. No Theia dependency. |
| `vice-runtime` | VICE resource/executable discovery, launch flags, and external process launch/termination, and standalone embedded process ownership. No Theia or DAP dependency. |
| `debug-adapter` | DAP sessions, VICE binary monitor connections, breakpoints, source mapping, stack reconstruction, and disassembly. Uses `vice-runtime` for process lifecycle. |
| `theia-extension` | Theia commands, views, editors, preferences, build execution, and integration with the debug adapter and runtime. |
| `core` | Preserved Java debug-info models/parser and numeric utilities. Outside the npm product build. |

Build the product from the repository root with `npm run theia:build`. The
build order is language support, VICE runtime, debug adapter, Theia extension,
and Electron frontend/backend bundling. The debug adapter's standalone build
also builds its runtime dependency, including in the focused VICE CI lane.

The runtime extraction is partial: the standalone embedded child process and
command pipe now live in `vice-runtime`, while standalone/debug launch policy,
the frame socket/WebSocket bridge, and machine selection remain in the Theia
backend. DAP-specific monitor connection management stays in the debug adapter.
Further extraction should preserve these different lifecycle owners and the
existing launch behavior.

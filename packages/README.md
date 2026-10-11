# Packages

Commodore Commander uses TypeScript npm workspaces for the active Theia product.
The Electron application lives in `applications/electron`.

| Package | Responsibility |
| --- | --- |
| `language-support` | Documents, includes, symbols, editor services, machine profiles, reference data, and build planning. No Theia dependency. |
| `vice-runtime` | VICE resource/executable discovery, launch flags, external process lifecycle, standalone embedded process ownership, native frame parsing/transport, and embedded stdout framing. No Theia or DAP dependency. |
| `debug-adapter` | DAP sessions, VICE binary monitor connections, breakpoints, source mapping, stack reconstruction, and disassembly. Uses `vice-runtime` for process lifecycle. |
| `theia-extension` | Theia commands, views, editors, preferences, build execution, and integration with the debug adapter and runtime. |
| `core` | Preserved Java debug-info models/parser and numeric utilities. Outside the npm product build. |

Build the product from the repository root with `npm run theia:build`. The
build order is language support, VICE runtime, debug adapter, Theia extension,
and Electron frontend/backend bundling. The debug adapter's standalone build
also builds its runtime dependency, including in the focused VICE CI lane.

The runtime extraction is partial: the standalone embedded child process,
command pipe, shared binary frame parser, native loopback frame socket, and
mixed stdout framing now live in `vice-runtime`. Standalone/debug launch policy,
the browser WebSocket bridge, and machine selection remain in the Theia backend.
The browser bridge is isolated in `CommodoreViceFrameBridge` within
`theia-extension`; emulator session coordination remains in
`CommodoreViceEmbedServiceImpl`.
JSON event interpretation and frame/output policy remain in the consuming
Theia service and DAP session. DAP-specific monitor connection management stays
in the debug adapter.
Further extraction should preserve these different lifecycle owners and the
existing launch behavior.

# Theia Extension

`@commodore-commander/theia-extension` connects Commodore Commander domain
services to the Theia/Electron product.

## Responsibilities

- branding, welcome page, menus, bundled help, and machine/profile selection
- Monaco language registration, syntax, hover, completion, navigation, rename,
  outline, workspace symbols, semantic tokens, folding, formatting, and fixes
- Kick Assembler build execution, build console, build-on-save, profile
  selection, Theia build tasks/pre-launch tasks, and headless `cc-kickass-build`
- `commodore-vice` launch configuration and debug-adapter integration
- Memory and C64 Visual Debugger views, Watch commands, persistent memory
  watchpoints, and debugger state integration
- character-set, screen, and sprite editors, including import/export and
  stopped-session memory transfers
- SIDScore runtime/player, MIDI input, instrument and SFX controls, waveform
  and spectrogram views
- embedded VICE canvas/input, standalone/debug launch coordination through
  `vice-runtime`, browser WebSocket transport, and Electron sleep/resume
  recovery

Language/build planning services belong to `packages/language-support`. DAP and
binary-monitor behavior belong to `packages/debug-adapter`. VICE resource and
executable discovery, shared launch flags, debugger process lifecycle helpers,
standalone child-process/command-pipe ownership, binary frame parsing, native
loopback frame transport, embedded stdout framing, and the CCV1 JSON wire codec
belong to `packages/vice-runtime`.

Editor lookup keeps a long-lived `KickAssemblerLookupService` and clears its
document analysis cache on frontend shutdown and workspace changes.
`KickAssemblerWorkspaceFiles` shares concurrent file discovery per root across
lookup, workspace symbols and include completion. Create/delete notifications
and completed file operations invalidate overlapping roots; workspace changes
and shutdown clear the inventory. Complete snapshots expire after five seconds
to cover missed/excluded watcher events; incomplete discovery is retried on the
next request. Traversal order, source extensions and excluded directories are
preserved. `KickAssemblerWorkspaceDocuments` shares disk reads/text models for
up to five seconds; all file changes and operation endpoints invalidate matching
files/subtrees. Missing/unreadable files are retried, and snapshots outside the
latest candidate set are released without dropping concurrent callers. Open
editor text always overrides disk snapshots. Workspace changes/shutdown clear
all caches. Active-machine selection remains here. The language service reuses
the last assembled index for equivalent ordered inputs/machine, returning an
independent mutable copy; changed inputs trigger fresh assembly. Namespace
and lexical resolution belong to the language service; navigation, references,
leaf rename and semantic tokens share its bindings. Definition links include
the full source-token range. Native CTRL+click (Windows/Linux), CMD+click
(macOS) and F12 use those definitions; with `editor.multiCursorModifier` set
to `ctrlCmd`, Monaco switches click navigation to Alt/Option to avoid a conflict.
Workspace symbols display named containers. Include-graph file selection
remains work.

The local `vice-runtime-resolver.ts` is an integration wrapper: it resolves the
selected machine/model and supplies the extension's asset location and
preference error hint to shared runtime discovery. The browser WebSocket bridge,
JSON stdout event handling, frame/output policy, and choosing standalone versus
debugger ownership remain here for now. The backend also chooses when a native
frame disconnect releases the listener. Further extraction requires preserving RPC
client ownership, process ownership, and cleanup. Frontend RPC disconnection
continues to detach the client without terminating an owned standalone emulator.

The shared stdout decoder only separates text lines, text preceding a binary
record, and complete CCB1 records. This backend still validates and forwards
fallback binary/JSON frames, reports malformed JSON as both status and output,
and truncates overflow output to the existing 32 MiB limit. DAP intentionally
uses different forwarding and overflow rules.

The runtime JSON codec parses the CCV1 envelope and encodes commands. The local
`commodore-vice-embed-protocol.ts` retains typed input commands and stricter
frame/status field validation, including timestamp fallback and optional-field
normalization. The browser/RPC contract remains in the common service module;
its protocol version is checked against the runtime wire version in tests.

[`CommodoreViceFrameBridge`](src/node/commodore-vice-frame-bridge.ts) owns the
browser-facing WebSocket listener, origin/path checks, connected clients,
latest-frame cache, and slow-client handling. It forwards opaque binary records;
the runtime transport or standalone stdout consumer validates frames first.
`clearFrame()` drops the cached image when an emulator session ends while
retaining browser connections for the next session. `stop()` releases the
listener and browser sockets as the backend shuts down. Restarting the bridge
replaces its previous listener and retains the cached frame.

[`CommodoreViceEmbedServiceImpl`](src/node/commodore-vice-embed-service-impl.ts)
coordinates the process, native frame transport, stdout decoder, and browser
bridge. RPC disconnection still detaches only the frontend client. The bridge
does not own or terminate emulator processes. This separation remains inside
the Theia package because browser origin rules and backend WebSocket integration
are product integration policy.

## Build and verification

Use `npm run theia:build` from the repository root to build all dependencies and
bundle the desktop app. Once language support, VICE runtime, and the debug
adapter are built, run extension unit tests with:

```sh
npm test --workspace @commodore-commander/theia-extension
```

The extension build runs `sync:vice-assets`; on macOS Apple Silicon it can
trigger a patched VICE build. For tests that deliberately use an external VICE,
set `COMMODORE_COMMANDER_SKIP_VICE_ASSETS=1`.

Electron packaging and signing are owned by `applications/electron` and the
scripts under `tools`. See the [root README](../../README.md) and
[`bundled-docs`](../../bundled-docs) for product workflows and current limits.

Language navigation has a real Electron gesture regression: after building,
run `npm run test:e2e:language:ui` from the repository root (on Linux, through
`bash tools/run-with-xvfb.sh`). It checks cross-file and local-scope targets,
including declaration line numbers and qualified link ranges.

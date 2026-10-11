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
loopback frame transport, and embedded stdout framing belong to
`packages/vice-runtime`.

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

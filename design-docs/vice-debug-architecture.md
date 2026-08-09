# VICE Debug Architecture

## Scope

The current Theia debug path uses a TypeScript-first VICE DAP adapter wired
into Theia's debug contribution points. The active Theia debug path does not
emulate the previous IDE debug APIs.

The Theia app contributes the `commodore-vice` debugger to Theia's native Run
and Debug infrastructure. Custom PRG run/debug commands, status-bar actions,
navigator actions, and the direct VICE runtime RPC launcher have been removed
so launch now flows through Theia launch configurations instead of parallel UI.
When Start Debugging or Start Without Debugging is invoked from an active Kick
Assembler source file without a matching `commodore-vice` launch entry, the
frontend asks whether to create or update `.theia/launch.json`; accepting starts
the current program through the newly written configuration. Start Without
Debugging sets DAP `noDebug` and starts VICE without `-binarymonitor` or
`-initbreak`.

The current Theia debug path does not attempt to:

- port the previous debug model
- preserve the previous class graph in a new framework
- provide Linux, Windows, or Intel macOS embedded VICE payloads yet
- emulate previous memory-rendering APIs

## What Was Added

### `packages/debug-adapter`

The active TypeScript package now provides:

- `DapConnection`
- `ViceDebugSession`
- `ViceMonitorConnection`
- `ViceMonitorRequests`
- `loadKickAssemblerDebugInfo`
- complete NMOS 6502 `disassemble6502`

This layer owns:

- DAP stdio framing
- VICE binary monitor request encoding and response decoding
- response correlation by request ID
- monitor event mapping for stop/resume, checkpoint, register, and memory
  responses
- binary monitor diagnostic events mirrored to Theia as
  `commodoreViceMonitorLog` DAP custom events, using `LOG` adapter notes,
  `TX` outbound commands, and `RX` inbound responses
- Kick Assembler `.dbg` source/label/line mapping; `.dbg` files are produced
  by Kick Assembler `-debugdump`. The configured debug dump is authoritative
  for source breakpoint mapping; nearby debug dumps are fallback discovery only
  when no configured `.dbg` can be read
- VICE process launch with Kick Assembler `.vs` VICE symbol files passed
  through `-moncommands` when present, plus `-binarymonitor`,
  `-binarymonitoraddress`, and `-initbreak ready` for debugging. VICE reads
  `.vs` files natively, including labels and `break` commands. If no `.vs`
  file is available, the adapter can pass a generated labels-only monitor
  command file derived from `.dbg` labels. Monitor command files do not resume
  execution. The binary monitor synchronizes DAP breakpoints while VICE is
  still stopped at startup after Theia sends `configurationDone`. UI-created
  source breakpoints are always submitted as binary-monitor checkpoints, both
  at startup and when added while VICE is running. `noDebug` launches omit the
  monitor command file, binary monitor, and initial break
- DAP request handling for launch, source breakpoints, conditional
  breakpoints, hit conditions, logpoints/tracepoints, data breakpoints,
  conditional watchpoints, continue, pause, step in, step over, step out, stack
  frames, scopes/variables, register writes, evaluation, loaded sources,
  readMemory, writeMemory, trace history, and disassemble
- DAP breakpoint-location discovery backed by Kick Assembler `.dbg` line
  mappings, with `sourceRoot` support for relative source paths

### Theia Wiring

The Theia extension now contributes:

- debug type `commodore-vice`
- launch configuration schema and snippets
- `supportsConfigurationDoneRequest` in the adapter capabilities so Theia
  sends `configurationDone` after source breakpoint setup
- `sourceRoot` launch configuration support so relative `.dbg` source entries
  can be resolved against the workspace
- workspace-derived launch configurations from
  `commodore-commander.build.json`
- a frontend bridge from Theia's built-in Start Debugging and Start Without
  Debugging commands to `.theia/launch.json` creation for the active assembler
  source when no matching VICE launch configuration exists
- a Memory view available from Theia's View list that reads and writes
  hexadecimal ranges from the active stopped VICE debug session, with
  comma-separated monitors, `start-end` ranges, zero-page, stack, screen,
  color-RAM, and program-memory presets, 40-column C64 screen rows, advanced
  memory-space dropdown and bank combobox controls, persisted settings, and
  ASCII, custom text, or bitmap C64 PETSCII/screen-code renderings with
  upper/graphics and lower/upper charset selection plus labeled control bytes
- a VICE Monitor view available from Theia's View list that subscribes to the
  adapter's `commodoreViceMonitorLog` custom events and shows binary monitor
  command/response traffic for breakpoint and monitor diagnostics, with a
  clipboard export for sharing the current log
- a Debug breakpoints menu action for managing persistent memory watchpoints,
  including add, enable/disable, edit, delete, clear, and active-session
  reinstall operations
- DAP adapter startup through Theia's backend debug adapter contribution

Breakpoints, data breakpoints, conditional breakpoints/watchpoints, logpoints,
stack frames, variables, stepping controls, memory reads/writes, register
writes, adapter-observed trace history, loaded sources, complete NMOS 6502
disassembly, start/stop lifecycle, and launch/snippet authoring are surfaced
through Theia's existing debug views and configuration paths rather than new
custom run/debug UI. The Memory view uses the active `commodore-vice` debug session's DAP
`readMemory` and `writeMemory` requests and only refreshes while the target CPU
is stopped.

## Runtime Seams

There is still no separate reusable `packages/vice-runtime` package. The active
runtime seams are TypeScript-only:

- the shared Theia backend resolver for machine profile, executable, and VICE
  argument selection in
  `packages/theia-extension/src/node/vice-runtime-resolver.ts`
- the debug adapter's session-owned VICE process launch and monitor socket in
  `packages/debug-adapter/src/vice-runtime.ts` and
  `packages/debug-adapter/src/vice-monitor.ts`

## Embedded VICE Direction

The default VICE launch surface should be the embedded view, represented by
`commodoreCommander.VICE.launchMode = "embedded"`. Stock external VICE must
remain available through `external` and through the existing
`commodoreCommander.VICE.runtimePath`, `viceExecutable`, and `viceResourcesPath`
overrides.

The patched runtime baseline is VICE 3.10.0. In the SourceForge SVN browser the
release is tagged as `v3.10`, with source under
`https://sourceforge.net/p/vice-emu/code/HEAD/tree/tags/v3.10/vice/`.

RetroDebugger demonstrates the viable embedding model: it embeds/forks the VICE
engine and renders emulator frames directly while forwarding keyboard and
joystick input into VICE internals. Commodore Commander should follow that
capability model, but keep the emulator external-process-oriented: run a
patched VICE/helper process that exposes a local frame/input transport to the
Theia view instead of linking VICE into the Electron process.

The patched runtime contract should provide:

- a video frame stream suitable for a Theia canvas without using binary-monitor
  Display Get polling
- keyboard matrix, joystick, mouse, and later peripheral input injection while
  the CPU is running
- optional binary-monitor/DAP attachment for debugging the same running machine
- explicit fallback to stock external VICE when a compatible patched runtime is
  not available

The first implementation pass adds the Theia-side service and canvas:

- `packages/theia-extension/src/common/commodore-vice-embed-service.ts`
  defines the frame/input RPC contract
- `packages/theia-extension/src/node/commodore-vice-embed-service-impl.ts`
  launches a patched SDL VICE process, owns the local frame socket, and bridges
  its low-rate stdin/stdout control protocol
- `packages/theia-extension/src/browser/vice-embedded-widget.tsx` renders the
  latest `rgba8888` frame on a focusable canvas and forwards keyboard input
- `tools/vice-embed/vice-3.10.0-commodore-embed.patch` applies the matching
  native SDL hook patch to VICE 3.10.0
- `tools/vice-embed/Makefile` exports, patches, builds, stages, signs, and
  verifies the patched macOS Apple Silicon runtime used by the product asset
  sync

The current native patch emits `CCB1` binary frame records with a fixed
little-endian header followed by native/logical `rgba8888` bytes. Large SDL 2x
presentation surfaces are collapsed to the logical pixel grid before transport
so the high-rate path moves a C64 frame as 384x272 instead of 768x544. The
Theia backend opens a local TCP socket, launches VICE with
`-cc-frame-port <port>`, parses those records from the accepted socket, and
forwards them to the browser over a dedicated binary WebSocket. The high-rate
display path therefore does not depend on DAP custom events or DAP stdout
handling. Debug launches reserve this backend frame socket before VICE starts,
and the debug adapter does not forward video frames as DAP events. stdout
remains for status/logging and for compatibility with older or manual embedded
launches that still emit `CCB1` records there.

## Testing Notes

The TypeScript seams are easier to test because:

- `.dbg` parsing can be exercised against inline Kick Assembler fixtures
- `ViceMonitorRequests` centralizes request-body encoding
- `ViceMonitorConnection` keeps response waiting and event mapping separate
  from DAP request handling
- `ViceDebugSession` can evolve independently from Theia UI code

Current automated coverage includes `.dbg` parsing, full NMOS 6502
disassembly, stack-frame reconstruction, VICE binary monitor request encoding,
monitor traffic event emission, and a real VICE end-to-end suite under
`packages/debug-adapter/src/test/e2e`. The real VICE lane launches the adapter
over stdio, starts VICE through the production launch path, and verifies DAP
behavior for launch, entry stops, source breakpoints, breakpoint monitor-log
events, stepping, data breakpoints, memory reads/writes, trace-history
last-write provenance, logpoints, ROM source fallback, and visual-debugger
memory snapshots. A Linux GitHub Actions workflow and matching Docker rig run
this suite against Debian's `/usr/bin/x64sc` with the repository bundled VICE
resources.

The built Electron app also has a Theia UI e2e harness in
`tools/run-theia-ui-e2e.mjs`, wired into GitHub Actions on Linux under Xvfb. It
prepares temporary debugger fixtures, launches real VICE sessions through
Theia, asserts the Debug and Memory views, writes a byte through the Memory
view, and checks the C64 Visual Debugger overview, sprites, screen, and CIA
tabs.

## Current Limitations

This pass still does not include:

- cycle-accurate execution-history stack reconstruction for non-`JSR` or
  asynchronous interrupt provenance
- joystick, mouse, and other peripheral input in the native embedded VICE patch
- arbitrary textual monitor checkpoint action commands; the binary monitor path
  supports conditions, while logpoints are adapter-managed
- non-macOS embedded VICE payloads
- Intel macOS embedded VICE payloads
- complete build-policy handling for configured runs; generated and existing
  launch entries can use Kick Assembler `preLaunchTask` wiring, but there is
  still no run picker or full `ifStale`/`always`/`never` policy flow

## Recommended Next Steps

1. Broaden the real VICE and Theia UI e2e lanes with additional regression
   scenarios.
2. Improve disassembly with richer symbol rendering.
3. Extend embedded VICE discovery to Linux, Windows, and Intel macOS payloads.

# VICE Debug Architecture

## Scope

The current Theia debug path uses a TypeScript-first VICE DAP adapter wired
into Theia's debug contribution points. The older Java debugger remains
reference material; the active Theia debug path does not emulate Eclipse debug
APIs.

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

- port the Eclipse debug model
- preserve the Eclipse class graph in a new framework
- provide Linux, Windows, or Intel macOS embedded VICE payloads yet
- provide a Java runtime abstraction package for Theia
- reconstruct a complete 6502 call stack or emulate Eclipse memory-rendering APIs

## What Was Added

### `packages/debug-adapter`

The active TypeScript package now provides:

- `DapConnection`
- `ViceDebugSession`
- `ViceMonitorConnection`
- `ViceMonitorRequests`
- `loadKickAssemblerDebugInfo`
- first-pass `disassemble6502`

This layer owns:

- DAP stdio framing
- VICE binary monitor request encoding and response decoding
- response correlation by request ID
- monitor event mapping for stop/resume, checkpoint, register, and memory
  responses
- Kick Assembler `.dbg` source/label/line mapping
- VICE process launch with `-binarymonitor`, `-binarymonitoraddress`, and
  `-initbreak ready` for debugging; `noDebug` launches omit the monitor and
  initial break
- DAP request handling for launch, source breakpoints, data breakpoints,
  continue, pause, step in, step over, step out, stack frames,
  scopes/variables, register writes, evaluation, loaded sources, readMemory,
  writeMemory, and disassemble
- DAP breakpoint-location discovery backed by Kick Assembler `.dbg` line
  mappings, with `sourceRoot` support for relative source paths

### Theia Wiring

The Theia extension now contributes:

- debug type `commodore-vice`
- launch configuration schema and snippets
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
- DAP adapter startup through Theia's backend debug adapter contribution

Breakpoints, data breakpoints, stack frames, variables, stepping controls,
memory reads/writes, register writes, loaded sources, first-pass disassembly,
start/stop lifecycle, and launch/snippet authoring are surfaced through Theia's
existing debug views and configuration paths rather than new custom run/debug
UI. The Memory view uses the active `commodore-vice` debug session's DAP
`readMemory` and `writeMemory` requests and only refreshes while the target CPU
is stopped, matching the Eclipse memory-view model without bringing forward the
Eclipse debug UI APIs.

## Reference Material Preserved

The Java monitor protocol extraction under
`packages/debug-adapter/src/main/java/net/resheim/cc/debugadapter/monitor/protocol`
remains as reference material:

- `ViceBinaryMonitorProtocol`
- `ViceMonitorCommandId`
- `ViceMonitorResponseId`
- `ViceMonitorCommand`
- `ViceMonitorRequest`
- `ViceMonitorRequests`
- `ViceMonitorResponseHeader`
- `ViceMonitorResponseFrame`
- `ViceMonitorResponseDecoder`
- `ViceMonitorFrameCodec`
- `ViceMonitorProtocolException`
- `ViceMonitorCheckpointSpec`
- `ViceMonitorMemoryType`

The Eclipse debugger classes also remain as reference-only sources for behavior:

- `VICELaunchDelegate`
- `VICEDebugTarget`
- `VICEThread`
- `VICEStackFrame`
- `VICERegisterGroup`
- `VICEMemoryBlock` and `ExtendedVICEMemoryBlock`
- `VICEBreakpoint`, `VICEWatchpoint`, and marker-backed checkpoint handling
- `MonitorEventDispatcher`

## Reused Semantics

From `VICELaunchDelegate`:

- selecting the VICE machine target
- locating `vice.ini`
- building debug launch arguments
- starting the emulator process
- representing the binary monitor endpoint

From `IBinaryMonitor`, `Command`, and `Response`:

- protocol constants
- command IDs
- response IDs
- command encoding
- frame decoding
- request builders

From `VICEDebugTarget` and `VICEThread`:

- request ID allocation
- framed command transmission
- step/resume/suspend request encoding
- checkpoint request encoding
- register refresh after stops and register writes through `REGISTERS_SET`

From `MonitorEventDispatcher`:

- raw frame decoding
- monitor response to domain-event mapping
- register descriptor/value parsing
- memory response parsing
- debugger-originated memory writes through `MEMORY_SET`

From `VICEStackFrame`:

- a single CPU frame named from the program counter
- mapping PC values back to Kick Assembler source lines
- exposing registers and debug labels as debug variables

## Runtime Seams

There is still no separate reusable `packages/vice-runtime` package. The active
runtime seams are TypeScript-only:

- the shared Theia backend resolver for machine profile, executable, and VICE
  argument selection in
  `packages/theia-extension/src/node/vice-runtime-resolver.ts`
- the debug adapter's session-owned VICE process launch and monitor socket in
  `packages/debug-adapter/src/vice-runtime.ts` and
  `packages/debug-adapter/src/vice-monitor.ts`

## Testing Notes

The TypeScript seams are easier to test because:

- `.dbg` parsing can be exercised against committed Kick Assembler fixtures
- `ViceMonitorRequests` centralizes request-body encoding
- `ViceMonitorConnection` keeps response waiting and event mapping separate
  from DAP request handling
- `ViceDebugSession` can evolve independently from Theia UI code

Current automated coverage is intentionally focused on `.dbg` parsing and
first-pass disassembly plus VICE binary monitor request encoding for register
reads/writes, memory writes, checkpoint creation, and data breakpoints. Live
VICE monitor fixtures should be added next.

## Current Limitations

This pass still does not include:

- live-session automated tests against a real VICE binary monitor
- true call stack reconstruction beyond the single CPU frame
- non-macOS embedded VICE payloads
- Intel macOS embedded VICE payloads
- complete illegal-opcode disassembly coverage
- Theia task-provider integration for build-before-debug workflows

## Recommended Next Steps

1. Exercise the DAP adapter against live VICE sessions and capture monitor
   protocol fixtures for automated session tests.
2. Improve disassembly with complete illegal-opcode coverage and richer symbol
   rendering.
3. Extend embedded VICE discovery to Linux, Windows, and Intel macOS payloads.

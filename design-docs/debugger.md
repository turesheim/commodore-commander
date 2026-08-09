# Debugger Support

Commodore Commander implements debugger support through Theia's native Debug
Adapter Protocol integration. The product contributes a `commodore-vice` debug
type, starts the TypeScript debug adapter from Theia's backend debug service,
and keeps emulator communication inside the adapter through VICE's binary
monitor protocol.

There is no parallel Commodore-specific run/debug UI. Theia's own Start
Debugging and Start Without Debugging commands create or use
`.theia/launch.json` configurations. `noDebug` launches start VICE without the
binary monitor.

## Runtime Architecture

- `packages/theia-extension` contributes the Theia debug type, launch schema,
  launch creation bridge, Memory view, and related frontend views.
- `packages/debug-adapter` implements DAP over stdio and owns the VICE binary
  monitor socket.
- `packages/debug-adapter/src/vice-monitor.ts` encodes and decodes the VICE
  binary monitor frames for memory, registers, checkpoints, stepping, pause,
  resume, and process shutdown.
- The adapter emits a `commodoreViceMonitorLog` DAP custom event for VICE
  binary monitor diagnostics. The Theia VICE Monitor view consumes those
  events and shows adapter notes (`LOG`), outbound monitor commands (`TX`),
  and inbound monitor responses (`RX`) with request IDs, command/response
  names, byte counts, decoded summaries, and hex payload previews.
- For embedded debug launches, the Theia backend owns one reserved VICE frame
  transport per Commodore Commander instance, while the debug adapter owns the
  emulator process and binary monitor port. Repeated launch-resolution calls
  reuse the reserved frame port, and a second debug launch cannot silently
  replace a frame transport that is already connected to an emulator.
- Kick Assembler produces `.dbg` files when builds run with `-debugdump`.
  Those files are parsed by the adapter to map source lines, labels, loaded
  sources, stack frame locations, breakpoint locations, source breakpoints,
  and `.break` debug-info breakpoints.
- Debug launches use the configured `.dbg` file only when it matches the
  launched `.prg` basename. If no matching configured dump is available,
  fallback candidates are limited to exact launched-PRG basename matches, such
  as `program.prg` -> `program.dbg`, in the launch directory, `cwd`, and
  workspace `out` folder. The adapter must not choose arbitrary nearby debug
  dumps by address overlap, because unrelated programs often occupy the same
  C64 address range.
- VICE consumes Kick Assembler `.vs` VICE symbol files natively through
  `-moncommands`; it does not consume `.dbg` files directly. For debug
  launches, the adapter looks for the `.vs` file next to the selected `.dbg`
  file or launched PRG and passes it to VICE. This lets VICE install labels
  and any `break` commands emitted by Kick Assembler. If no `.vs` file is
  available, the adapter falls back to a generated labels-only monitor command
  file derived from `.dbg` labels. Monitor command files do not resume the
  machine; VICE remains under the `-initbreak ready` startup stop while Theia
  sends breakpoints and the adapter installs DAP source breakpoints through
  the binary monitor. An explicit `-moncommands` entry in `viceArgs` is left
  untouched, but the adapter still inspects the referenced file so `.dbg`
  `.break` entries are not double-installed when the same address is already
  present as a VICE `break` command.
- Source breakpoints use `<Segment>` line mappings from Kick Assembler debug
  dumps. The `.dbg` `<Breakpoints>` block may be empty for ordinary editor
  breakpoints; it is not required for DAP source breakpoints.
- UI-created source breakpoints are adapter-managed DAP breakpoints. They are
  not appended to the Kick Assembler `.vs` file. Breakpoints received before
  VICE is ready are mapped through `.dbg` and submitted as binary-monitor
  execution checkpoints on the first CPU halt. Breakpoints added after the
  machine is already running are submitted through the binary monitor as soon
  as the monitor connection is available. Theia filters disabled source
  breakpoints out of the standard DAP `setBreakpoints` request, so the Theia
  extension also sends a Commodore-specific full source-breakpoint state
  request containing marker IDs and enabled flags. Once that full state has
  been seen for a source file, missing entries in the DAP `setBreakpoints`
  list are treated as disabled, not removed. Disabled UI breakpoints are
  toggled with VICE `CHECKPOINT_TOGGLE`; removed UI breakpoints are deleted
  through the binary monitor with `CHECKPOINT_DELETE`.
- Kick Assembler `.break` directives are written in assembly source code.
  When the source is compiled, Kick Assembler emits them into the `.dbg`
  `<Breakpoints>` block and emits matching `break` commands in the `.vs`
  monitor command file. The `.vs` file is the runtime authority for these
  programmed breakpoints: VICE installs them natively from `-moncommands`,
  while `.dbg` is used by the adapter to map stopped addresses back to source
  and to avoid double-installing the same address. If no `.vs` file is
  available, the adapter can install `.dbg` breakpoint entries as a fallback.
  Source-authored programmed breakpoints are not deleted through UI
  breakpoint removal; removing the `.break` directive from source and
  rebuilding removes them from the authoritative `.vs` file. The Theia
  extension exposes these source-owned breakpoints as managed markers in the
  normal Breakpoints view. They can be enabled or disabled there; removal
  attempts preserve the managed marker and its current enabled state, since
  remove and disable are distinct Theia actions. Programmed breakpoint markers
  are also excluded from persisted user-authored breakpoints. The full
  source-breakpoint state sync carries a marker flag so the adapter toggles
  these entries with `CHECKPOINT_TOGGLE` but never reconciles them as UI-owned
  checkpoints. Fallback `.dbg` breakpoint entries installed by the adapter use
  the same non-removable UI path.
- Explicit VICE monitor command files can also install breakpoints outside the
  adapter's checkpoint map, for example Kick Assembler `.vs` files containing
  `break` commands. Unknown VICE checkpoint hits are reported as DAP
  `breakpoint` stops instead of being auto-resumed.
- DAP source breakpoints are remembered when Theia sends `setBreakpoints`,
  even if that happens before `launch` has loaded Kick Assembler debug info.
  The adapter advertises `supportsConfigurationDoneRequest` so Theia completes
  breakpoint setup with `configurationDone`. After `.dbg` loading, the adapter
  re-resolves pending source breakpoints, sends DAP breakpoint-changed events
  for newly verified bindings, and synchronizes VICE checkpoints at the first
  stopped monitor state before the initial resume. This avoids losing
  breakpoints in embedded/autostart launch timing.
- VICE can report more than one startup stop while `-moncommands` and
  `-initbreak ready` settle. The adapter serializes initial stop handling and
  only reports one DAP `stopped` event until the client continues or steps.
- If a requested source breakpoint line has no exact mapping, the adapter can
  bind it to the next nearby mapped line in the same source file. This supports
  common editor clicks on comments or blank lines immediately above executable
  assembler statements while still rejecting distant unmapped lines.
- For C64 launches, the adapter loads bundled VICE BASIC/KERNAL ROM images and
  parses VICE monitor aliases from `share/vice/C64/c64mem.sym` to expose
  generated ROM disassembly sources for OS addresses. `c64mem.sym` is VICE
  metadata copied into the packaged runtime, not original Commodore source.
- Stack-frame source locations prefer exact address mappings and otherwise use
  a bounded nearest-line fallback for call-stack navigation. If no source line
  can be correlated, the adapter falls back to a generated sourceReference
  document built by disassembling the launched PRG image, then to a generated
  sourceReference document disassembled from live VICE memory at the frame
  address.

The implementation follows the VICE binary monitor command format: memory
reads/writes carry side-effect, memory-space, and bank fields; register writes
use the `REGISTERS_SET` command; source breakpoints and data breakpoints both
use VICE checkpoints with different CPU-operation masks; conditional source and
data breakpoints use the VICE checkpoint condition command.

Protocol reference: [VICE Manual, Binary monitor](https://vice-emu.sourceforge.io/vice_13.html).

## Implemented DAP Features

- Launch and terminate VICE through Theia.
- Start Without Debugging through DAP `noDebug`, without `-binarymonitor`.
- Source breakpoints backed by Kick Assembler `.dbg` line mappings.
- VICE monitor labels derived from the selected Kick Assembler `.dbg` labels
  and passed through `-moncommands`.
- Nearby unmapped source breakpoint lines resolved to the next mapped
  executable line.
- Kick Assembler `.break` programmed breakpoints installed by VICE from the
  selected `.vs` monitor command file, with `.dbg` used for source mapping and
  fallback installation when needed.
- Conditional source breakpoints through VICE checkpoint conditions.
- Hit-count source breakpoints interpreted by the adapter before surfacing a
  stop to the DAP client.
- Source logpoints/tracepoints. Static logpoints use non-stopping VICE
  checkpoints; logpoints that need live register values stop briefly so the
  adapter can refresh registers, emit the log message, and resume.
- Breakpoint-location discovery for valid assembled instruction lines.
- Data breakpoints/watchpoints for C64 memory labels or addresses, using VICE
  load/store checkpoints.
- Conditional data breakpoints/watchpoints through VICE checkpoint conditions.
- Hit-count data breakpoints/watchpoints interpreted by the adapter.
- Read/write watchpoints are installed as separate VICE load and store
  checkpoints so a hit can report the actual access type.
- Watchpoint stops include the watched range, actual read/write access type,
  current PC, and current watched byte values in the stopped-event description
  and Debug Console output.
- A persistent Theia watchpoint manager supports add, enable/disable, edit,
  delete, clear, and reinstall actions without requiring a custom debug view.
- Watch expressions for registers, labels, and address expressions. In Watch
  context, labels and addresses show the current byte value and keep a DAP
  memory reference for Memory view navigation.
- Kick Assembler `.watch` entries from debug dumps appear as a live memory
  scope in the Variables view.
- Adapter-observed Trace History appears as a Variables scope and can also be
  queried from the Debug Console with `.trace`, `.lastwrite`, and
  `.regchanges`. It records stopped/logpoint PC samples, register snapshots,
  register changes, watched memory accesses, and debugger-originated memory
  writes.
- Continue, pause, step in, step over, and step out.
- Stack frame for the current CPU PC, with source mapping where available.
- Register and Kick Assembler label scopes.
- Register editing through DAP `setVariable`.
- Evaluation of registers, labels, and addresses.
- Memory reads and writes through DAP `readMemory` and `writeMemory`.
- DAP memory events after debugger-originated memory writes when the client
  declares memory-event support.
- Loaded sources and complete NMOS 6502 disassembly, including undocumented
  opcodes.
- Generated PRG disassembly sources for stack-frame addresses that cannot be
  mapped back to original source.
- Generated C64 BASIC/KERNAL ROM disassembly sources for stack-frame addresses
  in bundled ROM ranges.
- Generated live-memory disassembly sources for stack-frame addresses outside
  the launched PRG image.
- VICE Monitor protocol view backed by DAP custom events from the adapter's
  binary monitor connection.

## Memory View

The Theia Memory view is a bottom-panel view exposed through Theia's View list.
It reads and writes through the active stopped `commodore-vice` debug session;
it does not open a separate VICE monitor connection.

Implemented behavior:

- read-only status when no stopped VICE debug session is active
- editable byte cells when the stopped debug session supports `writeMemory`
- comma-separated monitor expressions, such as `$0400-$07e7, message`
- range syntax using `start-end`
- numeric addresses using `$`, `0x`, or decimal notation
- Kick Assembler labels resolved through DAP `evaluate`
- presets for zero page, stack, screen memory, color RAM, and program memory
- 8, 16, 32, and 40 byte row widths; screen and color presets default to 40
  columns for the C64 display width
- ASCII and custom text-map renderings
- bitmap C64 PETSCII and screen-code renderings with upper/graphics and
  lower/upper charset selection, reverse-video glyphs, and labeled PETSCII
  control bytes
- changed-byte highlighting after refresh
- persisted address/range, length, columns, text mode, character set, custom
  map, advanced memory-space dropdown, bank combobox, side-effect, and
  auto-refresh settings
- memory-space and bank values passed through to the adapter for VICE monitor
  memory reads/writes
- a PC action that opens memory at the current program counter

Memory refresh still happens only while the target is stopped. This matches the
Eclipse-era behavior and avoids flooding VICE with monitor requests while the
emulator is running.

## VICE Monitor View

The VICE Monitor view is a bottom-panel diagnostic view for the active
`commodore-vice` debug session. It does not open another monitor socket.
Instead, the debug adapter mirrors its session-owned binary monitor traffic as
DAP custom events. The view can copy the current log to the clipboard as
tab-separated text.

The view uses compact direction labels:

- `LOG` adapter decisions such as the loaded `.dbg`, selected `.vs` monitor
  command files, `setBreakpoints`, `configurationDone`, and checkpoint
  synchronization. Skipped source breakpoints include the full source path and
  active debug-info path so wrong-debug-dump selection is visible in copied logs
- `TX` binary monitor command frames sent to VICE
- `RX` binary monitor response and asynchronous event frames received from
  VICE

For breakpoint diagnosis, the expected startup sequence is a `.vs` selection
note when a Kick Assembler VICE symbol file exists, a `configurationDone` note,
one or more `CHECKPOINT_SET` commands for DAP-managed source or `.dbg`
breakpoints, and `CHECKPOINT_INFO` responses that return the installed VICE
checkpoint numbers. Source-owned `.break` entries installed by the `.vs` file
are discovered with `CHECKPOINT_LIST` and associated with their `.dbg` mappings
by address, not reinstalled by the adapter. A later breakpoint hit should
appear as a `CHECKPOINT_INFO` response with `hit=1`. If a remembered breakpoint
is not installable, the adapter logs a `LOG` row with the skip reason before
returning without a `CHECKPOINT_SET`. Disabling an installed UI breakpoint or
source-owned programmed breakpoint should produce `CHECKPOINT_TOGGLE enabled=0`;
removing an installed UI breakpoint should produce `CHECKPOINT_DELETE`.
Programmed breakpoints must not produce
`CHECKPOINT_DELETE` from UI removal controls.

## Remaining Work

- Full PETSCII/charset rendering can be made more faithful by loading real C64
  character ROM data instead of using text approximations.
- Stack traces reconstruct caller frames from page-$01 stack entries that
  validate against real `JSR` instructions in memory. Arbitrary pushes and
  asynchronous interrupt provenance still require richer execution metadata.
  Unmapped stack-frame addresses can still open in generated PRG disassembly,
  or in live-memory disassembly for addresses outside the PRG image, but
  returning from that disassembly to original source requires `.dbg` mappings
  for the address.
- Conditional branches such as `BNE` and plain `JMP` do not create stack frames
  because they do not push a return address. Stack-frame names include nearest
  containing label context so loops are still visible without misrepresenting
  branch targets as calls.
- Theia plus VICE UI automation covers debug startup, Memory view rendering and
  byte editing, and the C64 Visual Debugger overview, sprite, screen, and CIA
  views. It runs locally through `npm run test:e2e:theia:ui` after the Electron
  app is built and in GitHub Actions on Linux under Xvfb.
- Debug-adapter VICE e2e fixtures cover `debug-demo`,
  `visual-debugger-demo`, and `screencolors`; `debug-demo` covers regular
  source breakpoints, including source breakpoints sent before `launch`, while
  `screencolors` covers comment-line breakpoint binding against Kick Assembler
  `<Segment>` mappings, embedded VICE breakpoint startup, and `.break`
  debug-info breakpoint installation from `.dbg` `<Breakpoints>`.
- Build-before-debug has Theia task-provider and generated `preLaunchTask`
  wiring for Kick Assembler builds. Remaining work is run-picker and
  build-policy behavior for configured runs, plus any clean-task workflow that
  should be exposed through Theia tasks.
- VICE textual monitor `command <checknum> ...` actions are not exposed through
  the binary monitor protocol used here. Logpoints are therefore implemented in
  the adapter with VICE stop/non-stop checkpoints rather than arbitrary VICE
  action commands.
- Trace History is not full MAME-style PC history yet. It only contains states
  observed through DAP stops, logpoint stop/resume, register edits, watched
  memory writes, and Memory view writes; complete "who last wrote any byte"
  provenance needs emulator-side execution and memory tracking.

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
- For embedded debug launches, the Theia backend owns one reserved VICE frame
  transport per Commodore Commander instance, while the debug adapter owns the
  emulator process and binary monitor port. Repeated launch-resolution calls
  reuse the reserved frame port, and a second debug launch cannot silently
  replace a frame transport that is already connected to an emulator.
- Kick Assembler produces `.dbg` files when builds run with `-debugdump`.
  Those files are parsed by the adapter to map source lines, labels, loaded
  sources, stack frame locations, breakpoint locations, source breakpoints,
  and `.break` debug-info breakpoints.
- Debug launches prefer the configured `.dbg` file but also search the PRG
  directory and nearby output folders for debug dumps whose address ranges
  overlap the launched PRG.
- VICE does not consume Kick Assembler `.dbg` files directly. For debug
  launches, the adapter derives a temporary VICE monitor command file from
  the selected `.dbg` labels and passes it to VICE with `-moncommands`. The
  generated file does not resume the machine; VICE remains under the
  `-initbreak ready` startup stop while Theia sends breakpoints and the adapter
  installs VICE checkpoints through the binary monitor. Source and `.break`
  breakpoints are still installed through the binary monitor. An explicit
  `-moncommands` entry in `viceArgs` is left untouched.
- Source breakpoints use `<Segment>` line mappings from Kick Assembler debug
  dumps. The `.dbg` `<Breakpoints>` block may be empty for ordinary editor
  breakpoints; it is not required for DAP source breakpoints.
- Kick Assembler `.break` directives are written in assembly source code.
  When the source is compiled, Kick Assembler emits them into the `.dbg`
  `<Breakpoints>` block. The adapter installs those entries as VICE execution
  checkpoints but does not surface them as Theia gutter breakpoints.
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
- Kick Assembler `.break` debug-info breakpoints from `.dbg` `<Breakpoints>`.
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

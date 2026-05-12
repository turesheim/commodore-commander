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
- Kick Assembler `.dbg` files are parsed by the adapter to map source lines,
  labels, loaded sources, stack frame locations, breakpoint locations, and
  source breakpoints.
- Debug launches prefer the configured `.dbg` file but also search the PRG
  directory and nearby output folders for debug dumps whose address ranges
  overlap the launched PRG.
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
- Live Theia plus VICE UI automation is still missing. Current coverage is
  unit-level protocol/build verification plus manual live-session testing.
- Build-before-debug still needs proper Theia task integration. Today the
  launch bridge can create debug configurations from build-plan data, but debug
  launch and build execution are not a complete task pipeline.
- VICE textual monitor `command <checknum> ...` actions are not exposed through
  the binary monitor protocol used here. Logpoints are therefore implemented in
  the adapter with VICE stop/non-stop checkpoints rather than arbitrary VICE
  action commands.

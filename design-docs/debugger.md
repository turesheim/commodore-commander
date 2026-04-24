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

The implementation follows the VICE binary monitor command format: memory
reads/writes carry side-effect, memory-space, and bank fields; register writes
use the `REGISTERS_SET` command; source breakpoints and data breakpoints both
use VICE checkpoints with different CPU-operation masks.

Protocol reference: [VICE Manual, Binary monitor](https://vice-emu.sourceforge.io/vice_13.html).

## Implemented DAP Features

- Launch and terminate VICE through Theia.
- Start Without Debugging through DAP `noDebug`, without `-binarymonitor`.
- Source breakpoints backed by Kick Assembler `.dbg` line mappings.
- Breakpoint-location discovery for valid assembled instruction lines.
- Data breakpoints/watchpoints for C64 memory labels or addresses, using VICE
  load/store checkpoints.
- Continue, pause, step in, step over, and step out.
- Stack frame for the current CPU PC, with source mapping where available.
- Register and Kick Assembler label scopes.
- Register editing through DAP `setVariable`.
- Evaluation of registers, labels, and addresses.
- Memory reads and writes through DAP `readMemory` and `writeMemory`.
- DAP memory events after debugger-originated memory writes when the client
  declares memory-event support.
- Loaded sources and first-pass disassembly.

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
- The current stack trace intentionally reports the current CPU frame only.
  Reconstructing a reliable call stack on 6502 requires more than stack bytes,
  because arbitrary pushes and interrupts are indistinguishable without richer
  execution metadata.
- Disassembly currently covers the maintained first-pass opcode table. Illegal
  opcode parity remains future work.
- Live Theia plus VICE UI automation is still missing. Current coverage is
  unit-level protocol/build verification plus manual live-session testing.
- Build-before-debug still needs proper Theia task integration. Today the
  launch bridge can create debug configurations from build-plan data, but debug
  launch and build execution are not a complete task pipeline.

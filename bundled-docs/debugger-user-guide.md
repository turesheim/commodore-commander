# Debugger User Guide

This guide walks through the Commodore Commander VICE debugger from first
launch to more advanced breakpoint and watchpoint workflows.

The debugger uses Theia's normal Run and Debug UI and a `commodore-vice` Debug
Adapter Protocol session. It launches VICE as an external process and talks to
the VICE binary monitor for breakpoints, registers, memory, stepping, and
watchpoints.

## Before You Start

Use a workspace that contains a Kick Assembler program and a build
configuration. If your workspace does not have one yet, Commodore Commander can
create `commodore-commander.build.json` the first time it needs build or launch
data.

For the best source-level debugging experience, make sure the active build
profile creates debug information:

- `debugDump: true` creates the Kick Assembler `.dbg` file used for source line
  mapping.
- `symbolFile: true` and `viceSymbols: true` are useful when you also want VICE
  monitor symbols.
- `runProgram` should point to the PRG that VICE will launch.

See [Build Configuration](build-configuration.md) for project and launch
configuration details.

Commodore Commander uses bundled VICE when it is packaged for the current
platform. To override that bundle, set this preference before launching:

- `commodoreCommander.VICE.runtimePath`: VICE runtime or installation root
  containing `share/vice`. When that root also contains `bin`, Commodore
  Commander selects the VICE emulator for the active machine profile, such as
  `x64sc`, `x128`, or `xvic`.

You normally do not point Settings at one VICE executable because VICE is a
suite of machine-specific emulators. For an exceptional single launch,
`.theia/launch.json` can still set `viceExecutable` to a command or absolute
path and `viceResourcesPath` to the matching runtime root.

## Start A Debug Session

1. Open the main Kick Assembler source file for the program.
2. Select the intended build profile from the status bar if your workspace has
   multiple profiles.
3. Run **Run > Start Debugging** or press `F5`.
4. If no matching VICE launch configuration exists, accept the prompt to create
   one. Commodore Commander writes a `.theia/launch.json` entry and a matching
   Kick Assembler build task.
5. VICE starts and the debugger connects to the binary monitor.
6. If `stopOnEntry` is enabled, execution stops before the program runs. If it
   is disabled, VICE runs until a breakpoint, watchpoint, pause, or program
   stop.

Use **Run > Start Without Debugging** or `Ctrl+F5` when you want to launch the
PRG in VICE without the binary monitor. In that mode breakpoints, memory views,
watchpoints, and stepping are not available.

## Source Breakpoints

Source breakpoints are backed by Kick Assembler `.dbg` line mappings. A
breakpoint can only be installed on a source line that maps to assembled code.

1. Start or prepare a debug session with a `.dbg` file available.
2. Open a source file that belongs to the debug dump.
3. Click the editor gutter beside an assembled instruction line.
4. Start or continue the session.
5. When the CPU reaches the mapped address, execution stops and Theia shows the
   current stack frame, registers, variables, and source location.

If a breakpoint cannot be installed, hover or inspect it in the Breakpoints view
for the message. The usual reason is that the source line did not map to a
generated address in the active `.dbg` file.

## Conditional Source Breakpoints

Conditional source breakpoints use VICE checkpoint conditions. VICE evaluates
the condition before reporting the checkpoint hit to the adapter.

1. Add a source breakpoint in the editor gutter.
2. In the Breakpoints view, edit the breakpoint and add an expression in the
   **Condition** field.
3. Use VICE monitor expression syntax. Commodore Commander also accepts and
   strips an optional leading `if`.
4. Continue execution.

Examples:

```text
A == $01
X >= $10
PC == $0810
```

Conditions are sent to VICE and are limited to 255 UTF-8 bytes. If VICE rejects
the expression, the breakpoint is marked unverified and the error is shown in
the Breakpoints view.

## Hit Conditions

Hit conditions are interpreted by the debug adapter. They work for source
breakpoints and memory watchpoints.

1. Edit a source breakpoint in the Breakpoints view.
2. Set the **Hit Count** or **Hit Condition** field.
3. Continue execution.

Supported forms:

```text
5       stop on hit 5
== 5    stop on hit 5
!= 5    stop except on hit 5
>= 5    stop on hit 5 and later
> 5     stop after hit 5
<= 5    stop through hit 5
< 5     stop before hit 5
% 10    stop every 10 hits
10%     stop every 10 hits
```

The hit counter resets when the breakpoint is reinstalled, for example after a
new `setBreakpoints` request.

## Logpoints And Tracepoints

A logpoint records a message instead of stopping at the source line. Commodore
Commander uses VICE non-stopping checkpoints when possible. If the message needs
live register values, the adapter briefly stops, refreshes registers, writes
the log output, and resumes.

1. Right-click in the editor gutter on an assembled instruction line.
2. Choose the Theia action for adding a logpoint.
3. Enter the log message.
4. Run or continue the program.
5. Read logpoint output in the Debug Console.

Message placeholders:

```text
{address}    mapped C64 address for the source line
{hitcount}   number of times this logpoint has been hit
{A}          current register value, if available
{X}          current register value, if available
{Y}          current register value, if available
{labelName}  Kick Assembler label address, if known to the adapter
```

Example:

```text
IRQ at {address}, A={A}, X={X}, hit={hitcount}
```

Conditions and hit conditions can be combined with logpoints in the same way as
regular source breakpoints.

## Trace History

Commodore Commander keeps an adapter-side trace history for the active debug
session. It records the current PC, disassembled instruction, register values,
register changes, source location when known, and watched memory access details
whenever the debugger observes a stop, logpoint stop/resume, register edit, or
Memory view write.

When execution is stopped:

1. Open Theia's Variables view.
2. Expand **Trace History**.
3. Expand a trace entry to inspect the PC, instruction, changed registers,
   source location, memory access details, and register snapshot.

The Debug Console also accepts trace commands:

```text
.trace              show the latest trace entries
.trace 20           show the latest 20 trace entries
.trace clear        clear trace history and observed writes
.lastwrite $0400    show the last observed write to a byte
.regchanges A       show recent observed changes for a register
```

Write provenance is based on observed debugger events. A CPU write is recorded
when a matching write watchpoint stops the debugger; a debugger-originated
Memory view write is also recorded. Bytes that were never watched or written
through the debugger have no last-write record.

## Add A Watch Expression

Watch expressions are regular Theia debugger watches. Commodore Commander can
evaluate registers, labels, numeric addresses, and simple address expressions.

1. Select a register, label, address, or expression in the editor.
2. Right-click and choose **Add Expression to Watch**.
3. Start or stop in a `commodore-vice` debug session.
4. Inspect the expression in Theia's Watch view.

Examples:

```text
A
X
message
message+1
$0400
```

In Watch context, a label or address shows the current byte value at that
address. Kick Assembler `.watch` entries from debug dumps also appear as a live
memory scope in the Variables view.

## Memory Watchpoints

Memory watchpoints are DAP data breakpoints backed by VICE load/store
checkpoints. You can watch a label, an address, or an address expression.

1. Select a label or address in the editor, or place the caret on one.
2. Right-click and choose **Add Memory Watchpoint**. You can also use the Debug
   breakpoint menu's new-breakpoint action.
3. Enter the expression or address to watch.
4. Enter the number of bytes to watch.
5. Choose **Write**, **Read**, or **Read / Write**.
6. Optionally enter a VICE condition.
7. Optionally enter a hit condition such as `5`, `>= 5`, or `% 10`.
8. If a compatible VICE debug session is active, the watchpoint is installed
   immediately. Otherwise it is saved and installed in the next session.

When a watchpoint hits, the debugger stops with reason `data breakpoint`. The
stop description and Debug Console output include:

- the watched address or range
- the actual access type, read or write
- the current program counter
- the current byte value, or current bytes for a range

For a one-byte watchpoint you might see:

```text
VICE write watchpoint, $0400, PC $0812, value $20
```

For a range watchpoint you might see:

```text
VICE read watchpoint, $0400-$0407, PC $0830, bytes $20 $20 $01 $02 ...
```

Read/write watchpoints are installed as separate VICE read and write
checkpoints so the debugger can report which kind of access actually occurred.

## Manage Watchpoints

Saved memory watchpoints persist across sessions.

1. Open the Debug side bar.
2. Open the Breakpoints menu.
3. Choose **Manage Memory Watchpoints**.
4. Select an existing watchpoint or one of the global actions.

Available actions:

- **Add Memory Watchpoint...** creates another watchpoint.
- **Install Watchpoints Now** reinstalls enabled watchpoints into the active
  VICE debug session.
- **Clear Memory Watchpoints** deletes all saved watchpoints.
- Selecting a watchpoint opens actions to enable or disable it, edit it, or
  delete it.

Editing a watchpoint lets you change the expression, byte count, access type,
VICE condition, and hit condition. Disabled watchpoints stay saved but are not
sent to the active debug session.

## Memory View

The Memory view reads and writes through the active stopped `commodore-vice`
debug session.

1. Start a VICE debug session.
2. Stop at a breakpoint, watchpoint, pause, or step.
3. Open **View > Memory**.
4. Enter an address, label, range, or comma-separated list of monitors.
5. Press refresh, or use one of the presets.

Useful inputs:

```text
$0400
$0400-$07e7
message
$0400-$07e7, message
```

Useful presets:

- **Zero Page** opens `$0000`.
- **Stack** opens `$0100`.
- **Screen** opens `$0400` with C64-width rows.
- **Color** opens `$d800`.
- **Program** opens the default program area.

The view can show hex bytes, ASCII, custom text-map output, PETSCII, and C64
screen-code glyphs. It can also write bytes while the target is stopped if the
debug session supports `writeMemory`.

## C64 Visual Debugger

The C64 Visual Debugger view turns the stopped VICE machine state into
C64-specific panels instead of only generic CPU and memory state.

1. Start a VICE debug session.
2. Stop at a breakpoint, watchpoint, pause, or step.
3. Open **View > C64 Visual Debugger**.
4. Press refresh, or leave **Auto** enabled to refresh whenever execution stops.

The **VIC-II** tab shows:

- VIC-II registers from `$d000-$d02e`
- decoded control bits for display mode, scrolling, raster high bit, screen
  geometry, sprite flags, IRQ status, and IRQ mask
- current raster line from `$d011/$d012`
- current VIC bank, screen memory, character memory, and bitmap memory
  addresses

The **Sprites** tab shows all eight hardware sprites with coordinates, sprite
pointer address, color, multicolor mode, expansion, priority, and collision
flags. VIC and CIA registers are read through VICE's I/O bank, and the sprite
preview is rendered from the sprite data in the current VIC bank as VIC-visible
RAM. This keeps sprites correct when CPU-visible ROM or I/O mapping covers the
same address range.

The **Screen RAM** tab reads the full 1 KB screen matrix selected by `$d018`,
including sprite pointers at `$03f8-$03ff`, and shows the visible 40x25
screen-code grid, color RAM swatches, and the 2 KB character source in the
current VIC bank. Screen and custom character bytes are read as VIC-visible RAM.
In VIC banks 0 and 2, `$1000/$1800` use the C64 character ROM window; other
character bases are read as RAM/custom character data.

The **CIA / Keyboard** tab shows CIA #1 and CIA #2 ports, data-direction
registers, timers, TOD fields, interrupt sources, timer control bits, and the
raw CIA #1 keyboard matrix port state.

## Registers, Variables, And Stack

When execution is stopped:

1. Open Theia's Variables view.
2. Expand **6510 Registers** to inspect CPU registers.
3. Edit a register value directly in the Variables view when needed.
4. Expand **Kick Assembler Labels** to inspect known label addresses.
5. Expand **Kick Assembler Watches** to inspect `.watch` memory values from the
   debug dump.
6. Use the Call Stack view to navigate source-backed stack frames.

The stack trace always includes the current PC frame. Caller frames are
reconstructed from page-$01 stack entries that match real 6502 `JSR`
instructions. Branches and plain jumps do not create call-stack frames because
they do not push return addresses on the 6502 stack.

If a stack address does not map to original source, the adapter opens generated
PRG disassembly, ROM disassembly, or live memory disassembly so the frame still
lands on an address-accurate instruction.

## Stepping And Control

Use Theia's standard debug controls:

- **Continue** resumes VICE.
- **Pause** suspends the emulator through the binary monitor.
- **Step Into** advances one instruction.
- **Step Over** advances one instruction and steps over subroutines.
- **Step Out** runs until the current subroutine returns.
- **Stop** terminates the debug-owned VICE process.

The debugger keeps VICE integration external-process-oriented. Closing or
stopping a debug session terminates the emulator process owned by that session.

## Troubleshooting

If source breakpoints stay unverified:

1. Confirm that the active build creates a `.dbg` file.
2. Confirm that the launched PRG matches the debug dump.
3. Confirm that the source file path in the `.dbg` file can be resolved from
   `sourceRoot`, the workspace, or the PRG directory.
4. Move the breakpoint to an assembled instruction line.

If a conditional breakpoint or watchpoint is rejected:

1. Keep the condition under 255 UTF-8 bytes.
2. Use VICE monitor expression syntax.
3. Prefer numeric addresses when VICE does not know a label name.

If watchpoints do not install:

1. Make sure a `commodore-vice` debug session is active.
2. Make sure the session is not a Start Without Debugging session.
3. Check that the expression resolves to a C64 memory address.
4. Use **Manage Memory Watchpoints > Install Watchpoints Now** after editing.

If the Memory view is read-only:

1. Stop the target first. Memory refreshes only while the CPU is stopped.
2. Confirm that the active debug session is `commodore-vice`.
3. Confirm that the launch was started with debugging, not `noDebug`.

## Current Limits

- VICE checkpoint conditions are supported through the binary monitor, but
  arbitrary textual monitor checkpoint action commands are not exposed through
  the binary monitor path used here. Logpoints are therefore adapter-managed.
- Trace History is adapter-observed history, not full emulator PC history.
  It records stopped/logpoint samples, register edits, watched memory writes,
  and Memory view writes. Continuous "who last wrote any byte" provenance still
  requires broader emulator-side execution and memory tracking.
- Multi-byte watchpoint hits report the watched range and the current bytes in
  that range. VICE does not report the exact sub-address inside the range in the
  checkpoint hit response.
- Memory and C64 Visual Debugger refresh intentionally happen only while the
  target is stopped to avoid flooding VICE with monitor requests while the
  emulator is running.
- Raster cycle is shown when the active VICE monitor register set exposes a
  cycle register. Otherwise the C64 Visual Debugger still shows the raster line
  from the VIC-II registers and reports the cycle as unavailable.

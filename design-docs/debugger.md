# Debugger Support

## Integration and ownership

The product contributes `commodore-vice` to Theia's native DAP integration.
Start Debugging and Start Without Debugging create/use `.theia/launch.json`;
`noDebug` launches omit the binary monitor and initial break. The standalone
embedded emulator remains a separate lifecycle.

`ViceDebugSession` owns the debug/no-debug process and binary-monitor connection.
`vice-runtime` supplies discovery, launch/process helpers and shared embedded
wire mechanisms. Theia owns launch/machine preferences, UI adaptation and the
browser frame bridge. See [VICE architecture](vice-debug-architecture.md) for
frame/input paths, shutdown policies and the partial runtime extraction.

Memory and Visual Debugger requests use the active DAP session. The VICE Monitor
view consumes diagnostic DAP events; none of these views opens another monitor
socket. Embedded video uses the backend's native frame transport/WebSocket,
not DAP frame forwarding.

## Debug metadata and source selection

Kick Assembler `-debugdump` produces `.dbg` mappings for lines, labels, sources,
watch entries and programmed `.break` locations. VICE reads `.vs` monitor
commands, not `.dbg` files.

Configured debug info must match the launched PRG basename. Fallback discovery
looks for that same basename beside the PRG, in `cwd`, and in relevant `out`
directories. Address overlap may produce a warning but must not select an
unrelated dump: different C64 programs commonly occupy the same address range.

The adapter prefers a `.vs` file beside the selected dump/PRG. Without one it
can generate a labels-only monitor file from `.dbg`. Explicit `-moncommands`
arguments are preserved and inspected for existing `break` addresses to avoid
double-installation. Monitor command files do not resume execution.

Source breakpoints use `<Segment>` mappings; an empty `.dbg` `<Breakpoints>`
block does not prevent ordinary editor breakpoints. An unmapped requested line
may bind to the next nearby executable line in the same file; distant unmapped
lines remain unverified. `sourceRoot` resolves relative debug-info source paths.

## Startup synchronization

The adapter advertises `supportsConfigurationDoneRequest` and retains source
breakpoints received before `launch`. After loading `.dbg`, it resolves pending
bindings and emits breakpoint-changed events. VICE remains at the
`-initbreak ready` halt while Theia submits breakpoint state and
`configurationDone`; checkpoints are synchronized before the first resume.

VICE can report several startup halts. The adapter serializes initial-stop
handling and reports one DAP `stopped` event until the client continues/steps.
The initial halt may be in KERNAL/autostart code rather than the user program.
Breakpoints added while running are installed once the monitor is available.

## Breakpoint authority

| Kind | Authority | Runtime mechanism | UI removal |
| --- | --- | --- | --- |
| Editor source breakpoint | Theia user marker/full state | Adapter-managed binary-monitor execution checkpoint | Deletes owned checkpoint |
| Source-authored `.break` | Rebuilt `.vs`, with `.dbg` mapping/fallback | VICE installs `break` commands; adapter installs `.dbg` fallback only when needed | Cannot remove the source-owned marker/checkpoint; edit source and rebuild |
| Data watchpoint | DAP state/persistent Theia watchpoint manager | Separate VICE load/store checkpoints | Deletes owned checkpoints |

Theia's standard `setBreakpoints` omits disabled markers. The extension also
sends full source-breakpoint state with marker IDs, enabled flags and programmed
ownership. After full state is known, omission from standard DAP state means
*disabled*, not removed. Disable uses `CHECKPOINT_TOGGLE`; removal of a UI-owned
checkpoint uses `CHECKPOINT_DELETE`. Marker IDs survive disable even when the
resolved executable line differs from the requested line.

Programmed markers appear in the normal Breakpoints view and can be toggled,
but remove paths preserve them. They are excluded from persisted user-owned
breakpoints and protected during marker rewrites. Standard `setBreakpoints`
reports their bindings but does not toggle/reconcile their runtime state;
the full-state request performs those operations.

VICE checkpoint numbers for `.vs`-owned breakpoints are volatile. Before a UI
toggle the adapter refreshes them with `CHECKPOINT_LIST`. If VICE rejects a
stale number, it clears the association, refreshes and retries. Source-owned
checkpoints are associated by address rather than reinstalled or deleted.
Unknown checkpoint hits, including explicit monitor-file breakpoints, produce
DAP breakpoint stops rather than automatic resume.

Conditional source/data breakpoints use VICE checkpoint conditions. Hit counts
are interpreted by the adapter. Static logpoints use non-stopping checkpoints;
logpoints needing live registers briefly stop, refresh, log and resume.
Watchpoint stops report range, actual read/write access, PC and current bytes.
The persistent manager supports add, toggle, edit, delete, clear and reinstall.

## Stack, source fallback and trace limits

The current PC is mapped through exact `.dbg` addresses, then a bounded nearby
source-line fallback. Unmapped frames can open generated PRG disassembly,
bundled C64 BASIC/KERNAL disassembly or live-memory disassembly. ROM aliases
come from VICE `share/vice/C64/c64mem.sym`; these documents are generated
sources, not original Commodore source.

Caller reconstruction examines page-$01 stack entries that validate against
real `JSR` instructions in memory. `BNE` and plain `JMP` do not create call
frames; nearest label context still names the current frame. Arbitrary stack
pushes and asynchronous interrupts need richer execution metadata.

Trace History records adapter-observed stops/logpoints, registers, watched
accesses and debugger-originated writes. `.trace`, `.lastwrite` and
`.regchanges` query it; complete execution history or last-write provenance for
any arbitrary byte requires emulator-side tracking.

## DAP and view behavior

The adapter provides launch/no-debug, continue/pause/stepping, source/data
breakpoints, breakpoint locations, stack/scopes/variables, register editing,
evaluation, loaded sources, memory read/write and complete NMOS 6502 disassembly
including undocumented opcodes. Capability details are in the
[adapter README](../packages/debug-adapter/README.md); user workflows are in the
[debugger guide](../bundled-docs/debugger-user-guide.md).

Watch expressions for registers/labels/addresses retain memory references;
label/address watches show live byte values. Kick Assembler `.watch` entries
appear as a live memory scope. Memory writes emit DAP memory events when the
client advertises support.

The Memory view reads/edits only while the target is stopped. It supports
comma-separated expressions, `start-end` ranges, labels via DAP `evaluate`,
zero-page/stack/screen/color/program presets and 8/16/32/40-byte rows. Rendering
includes ASCII, custom maps and bitmap C64 PETSCII/screen codes with charset,
reverse-video and control-byte handling. It highlights changed bytes and
persists ranges, display options, memory-space/bank, side-effect and refresh
settings. Those monitor fields are passed through to the adapter. A PC action
opens the current instruction's memory address.

The VICE Monitor view shows `commodoreViceMonitorLog` events as `LOG` decisions,
`TX` commands and `RX` responses, including IDs, decoded summaries and hex
previews. Clipboard export preserves the diagnostic rows. For breakpoint
troubleshooting, expect metadata selection, `configurationDone`,
`CHECKPOINT_SET`/`CHECKPOINT_INFO` for adapter-owned bindings and
`CHECKPOINT_LIST` for `.vs` ownership. Skips log source/debug-info paths and
reasons. Disable should toggle; source-owned UI removal must not delete a
checkpoint. A hit carries `CHECKPOINT_INFO hit=1`.

## Verification and remaining work

[Real VICE and Electron UI tests](vice-e2e-test-rig.md) cover debug startup,
source/programmed checkpoints, Memory byte editing and Visual Debugger tabs.
They complement focused adapter/runtime tests; they do not establish complete
feature or platform parity.

Remaining work includes configured-run selection/build policies, clean-task UX,
richer symbols/charset fidelity and execution-history provenance. Arbitrary
textual VICE `command <checknum> ...` actions are not exposed through the binary
monitor path; logpoints remain adapter-managed.

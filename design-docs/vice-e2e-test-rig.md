# Real VICE E2E Test Rig

## Purpose

The real VICE end-to-end rig verifies the debug adapter against an actual VICE
process and binary monitor session. It complements the adapter's parser,
protocol-encoding, disassembly, trace-history, and runtime unit tests.

The rig is intentionally outside the normal unit-test path. Real emulator tests
need a runnable VICE binary, local TCP monitor access, process teardown, and
more wall-clock time than the default package tests should require.

## Ownership

The test rig lives under `packages/debug-adapter/src/test/e2e` because it tests
the debug adapter as a debugger client sees it:

- DAP messages go over adapter stdio.
- The adapter launches VICE through its production launch path.
- The adapter connects to the VICE binary monitor over localhost.
- Test assertions observe only DAP responses, DAP events, generated sources,
  memory reads/writes, console output, and visual-debugger memory snapshots.

The rig does not instantiate `ViceDebugSession` directly. That boundary is
deliberate: direct construction would be an integration test of adapter
internals, not an end-to-end test of DAP framing, launch arguments, monitor
connection setup, event ordering, and teardown.

## Main Pieces

- `dap-client.ts`
  Minimal DAP client for tests. It spawns the built adapter with Node, frames
  requests over stdio, waits for responses/events with timeouts, captures Debug
  Console output, and writes transcripts on teardown.

- `vice-environment.ts`
  Resolves the opt-in real VICE environment. The suite runs only when
  `VICE_E2E=1` is set. It accepts `VICE_RESOURCES_PATH`, `VICE_EXECUTABLE`, and
  `VICE_ARGS`, and otherwise falls back to the bundled macOS Apple Silicon VICE
  resource tree when present.

- `fixtures.ts`
  Copies committed golden fixtures into a temporary workspace per test and
  rewrites the primary `.dbg` source path to the temporary source copy. Kick
  Assembler debug dumps contain source paths, so this rewrite keeps source
  breakpoint matching portable across checkout locations.

- `visual-snapshot.ts`
  Headless visual-debugger snapshot reader. It uses DAP `readMemory`,
  `evaluate`, and `commodore-vice/banksAvailable` behavior to assert the same
  C64 state that the Theia visual debugger depends on, without starting Theia
  or rendering React UI.

- `fixtures/debug-demo`
  Golden source, PRG, and DBG for debugger-session behavior: entry stops,
  source breakpoints, stepping, data breakpoints, memory writes, ROM fallback
  frames, trace history, and logpoints.

- `fixtures/visual-debugger-demo`
  Golden source, PRG, and DBG for C64 display-state coverage: VIC bank
  decoding, screen memory, color RAM, sprite pointer/state, and visual-debugger
  snapshot assumptions.

## Run Commands

Default behavior compiles and skips the real VICE tests:

```text
npm run test:e2e:vice --workspace @commodore-commander/debug-adapter
```

Real emulator run:

```text
VICE_E2E=1 npm run test:e2e:vice --workspace @commodore-commander/debug-adapter
```

Optional runtime overrides:

```text
VICE_E2E=1 \
VICE_RESOURCES_PATH=/path/to/VICE.app/Contents/Resources \
VICE_EXECUTABLE=x64sc \
VICE_ARGS='["-silent"]' \
npm run test:e2e:vice --workspace @commodore-commander/debug-adapter
```

`VICE_ARGS` may be JSON string-array syntax for arguments containing spaces.
For simple local runs it may also be a whitespace-separated string.

## Covered Behaviors

The current suite covers:

- real VICE launch through the adapter
- `stopOnEntry`
- DAP capability negotiation
- source breakpoints installed through Kick Assembler `.dbg` mappings
- continue-to-source-stop synchronization
- step in, step over, and step out
- data breakpoints backed by VICE store checkpoints
- DAP `writeMemory` plus `readMemory` round trips
- trace-history last-write provenance
- generated KERNAL ROM stack-frame source fallback
- source logpoints that briefly stop, log, and resume when live registers are
  needed
- visual-debugger memory snapshots for VIC bank, screen RAM, color RAM, sprite
  pointer, sprite position, and sprite color

## Synchronization Rules

The tests synchronize on DAP events and observable stopped state, not sleeps.

One important VICE detail is `-initbreak ready`: the initial monitor stop can
occur while VICE autostart or KERNAL code is still active. Tests that need a
specific user-code location continue through unrelated stops until the top
stack frame matches the expected fixture source and line.

Logpoint tests similarly wait for either matching output or another stop. If a
non-target stop arrives first, the test continues and waits again. This models
real debug-client behavior and avoids assuming a particular VICE startup stop
sequence.

## Artifacts

Every e2e session writes artifacts under:

```text
test-results/vice-e2e/<test-name>/
```

The directory contains:

- `dap-transcript.jsonl`
  Timestamped client/adapter DAP messages.

- `adapter-output.log`
  Aggregated DAP output events, including launch command output and Debug
  Console text.

- `adapter-stderr.log`
  Debug adapter stderr.

`test-results/` is ignored by Git because these files are diagnostic outputs,
not golden inputs.

## Fixture Maintenance

Golden fixture changes must keep source, PRG, and DBG files together. Do not
update a fixture PRG without the matching DBG, because source breakpoints and
stack-frame assertions depend on address-to-source mappings.

When changing fixture source:

1. Rebuild the matching PRG and DBG with Kick Assembler debug dump enabled.
2. Keep the rebuilt files under the same fixture directory.
3. Re-run `VICE_E2E=1 npm run test:e2e:vice --workspace @commodore-commander/debug-adapter`.
4. Review any assertion changes against actual product behavior, not just new
   addresses.

The e2e fixture source may diverge from example workspace programs when the
test needs stricter determinism. For example, the visual fixture keeps screen
text and sprite pointer state coherent at the snapshot stop point.

## CI Expectations

The suite can run in CI only when the runner provides:

- a compatible VICE binary and resource directory
- permission to launch emulator processes
- permission to bind a local binary-monitor port on `127.0.0.1`
- enough timeout budget for multiple fresh VICE sessions

CI should keep the normal unit suite mandatory and treat the real VICE lane as
an additional platform/runtime job. A missing VICE runtime should skip the e2e
lane, not fail default package tests.

## Current Limits

This rig does not yet automate Theia UI rendering. The visual-debugger coverage
asserts the stopped C64 state consumed by the widget, not pixel output from the
React view.

It also does not cover non-macOS bundled runtime discovery yet. The environment
resolver accepts external VICE paths so Linux, Windows, and Intel macOS jobs can
be added without changing the adapter test harness.

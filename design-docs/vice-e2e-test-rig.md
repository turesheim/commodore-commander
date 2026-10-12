# Real VICE E2E Test Rig

## Boundaries

The opt-in rig in
[`packages/debug-adapter/src/test/e2e`](../packages/debug-adapter/src/test/e2e)
spawns the built adapter over stdio and lets it launch real VICE through the
production runtime helpers. Assertions use DAP responses/events, generated
sources, console output and memory/register state. It does not instantiate
`ViceDebugSession` directly.

Real emulator tests require a runnable binary/data directory, local TCP access
and process teardown. Unit suites remain independent of an installed emulator:

```sh
npm test --workspace @commodore-commander/vice-runtime
npm test --workspace @commodore-commander/debug-adapter
COMMODORE_COMMANDER_SKIP_VICE_ASSETS=1 npm test --workspace @commodore-commander/theia-extension
```

The extension command assumes its workspace dependencies are already built.
Skipping asset sync avoids invoking the native build; it does not supply a VICE
binary for integration tests.

## Components

| Component | Responsibility |
| --- | --- |
| `dap-client.ts` | Adapter subprocess, DAP framing, response/event timeouts and transcripts |
| `vice-environment.ts` | `VICE_E2E` opt-in, runtime overrides and embedded-transport capability detection |
| `fixtures.ts` | Per-test temporary workspace and rewritten `.dbg` source paths |
| `visual-snapshot.ts` | C64 state through DAP memory/evaluation/bank queries without Theia rendering |
| [`tools/run-theia-ui-e2e.mjs`](../tools/run-theia-ui-e2e.mjs) | Built Electron app, launch configurations, Debug/Memory/Visual Debugger UI assertions and screenshots |
| [`tools/smoke-test-product-package.mjs`](../tools/smoke-test-product-package.mjs) | Packaged Kick Assembler PRG output and SIDScore SRAP/MIDI; macOS Apple Silicon/Linux x64 native VICE frames plus packaged Electron Machine painting, BASIC keyboard execution and restart |

Golden fixtures are `debug-demo` (debug-session behavior),
`visual-debugger-demo` (C64 display/bank state) and `screencolors` (comment-line
breakpoint resolution and programmed `.break` behavior). Keep source, PRG,
DBG and any VS monitor commands together when rebuilding fixtures.

## Running

Without `VICE_E2E=1`, the adapter e2e command builds and skips emulator cases:

```sh
npm run test:e2e:vice --workspace @commodore-commander/debug-adapter
```

To use the bundled macOS Apple Silicon runtime when available:

```sh
VICE_E2E=1 npm run test:e2e:vice --workspace @commodore-commander/debug-adapter
```

For another installation, set `VICE_RESOURCES_PATH`, `VICE_EXECUTABLE` and
optional `VICE_ARGS` (JSON string array or simple whitespace-separated flags):

```sh
VICE_E2E=1 \
VICE_RESOURCES_PATH=/path/to/VICE.app/Contents/Resources \
VICE_EXECUTABLE=x64sc \
VICE_ARGS='["+sound"]' \
npm run test:e2e:vice --workspace @commodore-commander/debug-adapter
```

The UI rig requires a built Electron app and a graphical session:

```sh
npm run theia:build
npm run test:e2e:theia:ui
```

It accepts `--vice-executable`, `--vice-resources`, `--vice-args` and the
corresponding `THEIA_UI_E2E_VICE_EXECUTABLE`,
`THEIA_UI_E2E_VICE_RESOURCES_PATH`, `THEIA_UI_E2E_VICE_ARGS` overrides.

## Coverage and synchronization

The DAP suite covers launch/capabilities, startup and dynamic source breakpoints,
Theia enable/disable state, programmed checkpoints, exact-PRG debug-info
selection, stepping, watchpoints, memory read/write and last-write provenance,
ROM fallback, logpoints and visual-debugger memory snapshots. Embedded startup
cases run only when the binary supports `-cc-embed`.

The UI suite covers launch, register scope, stopped Memory rendering/byte
editing and Visual Debugger overview/sprite/screen/CIA tabs. It is not a complete
embedded input or frame-performance test.

Synchronize on DAP events and observable state. `-initbreak ready` can stop in
KERNAL/autostart code before user code; source-specific tests continue through
unrelated stops until the expected source/line is reached. Logpoint tests wait
for matching output or another stop and resume as necessary. Targeted timing
checks may introduce a delay; a delay alone is not evidence of a correct stop.

## CI and artifacts

[`.github/workflows/vice-e2e.yml`](../.github/workflows/vice-e2e.yml) runs runtime
unit tests and real DAP sessions on Linux, plus a separate Electron UI lane
under Xvfb. Both use distro `x64sc` and resolved ROM/data resources. Resource
resolution uses installed data when available and upstream VICE data otherwise.
Stock Linux VICE does not exercise the patched embedded transport; those cases
are skipped. The [Docker rig](../tools/docker/README.md) provides the Linux DAP
lane locally.

Ignored diagnostic outputs:

- `test-results/vice-e2e/<test-name>/`: `dap-transcript.jsonl`,
  `adapter-output.log`, `adapter-stderr.log`.
- `test-results/theia-ui-e2e/`: UI screenshots and runner diagnostics.
- `test-results/product-package/`: packaged macOS/Linux Machine screenshots, capture configuration and Electron log; retained by the nightly workflow even on failure.

Missing runtime or unsupported embedded capability produces an explicit skip;
check executed/skipped counts before claiming coverage. Fixture changes must
rebuild matching PRG/DBG/VS artifacts and rerun the real suite. Review assertion
changes against product behavior, not just changed addresses.

The nightly package lane exercises bundled discovery and Electron keyboard input
on macOS Apple Silicon and Linux x64 (Ubuntu 24.04, Xvfb/software rendering).
Linux configures the packaged Electron sandbox helper as root-owned mode 4755,
matching `LINUX-SETUP.txt`; the product test does not disable Chromium sandboxing.
Native startup uses the normal sound initialization. GUI failures retain a bounded
Machine status/native-output report as well as screenshots, so an initialized
blank frame cannot hide later emulator startup failures.
The headless Linux runner supplies a PulseAudio null sink, so the default sound
device initializes while the Machine workflow runs. This checks the host audio
API path, not physical audibility or audio fidelity.
The ELF packaging fixture runs after removing build libraries and moving the runtime.
Physical keyboard/mouse behavior, Windows packaged UI/embedded transport and
fresh-host/minimum-OS acceptance remain outside this coverage.

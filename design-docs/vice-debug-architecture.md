# VICE Debug Architecture

## Scope and package boundaries

The Theia product uses the `commodore-vice` TypeScript DAP adapter and keeps
VICE in a separate process. Both debugging and Start Without Debugging use
Theia launch configurations. The standalone embedded emulator has its own
lifecycle and does not require a program or binary monitor.

| Package/component | Owns | Leaves to its caller |
| --- | --- | --- |
| `packages/vice-runtime` | Resource/executable discovery, launch flags, debug launch/termination helpers, standalone process/command pipe, CCB1 parsing and loopback transport, stdout framing, CCV1 JSON codec | Machine/preferences, session policy, DAP and browser integration |
| `packages/debug-adapter` | DAP stdio, `ViceDebugSession`, binary-monitor connection/protocol, breakpoints, source mapping, stack reconstruction, disassembly | Theia UI, runtime mechanism, browser video transport |
| `packages/theia-extension` | Launch schema/configuration, machine/preferences, frontend input, session coordination, browser WebSocket bridge, Memory/Visual Debugger/Monitor views | Language/build planning, DAP behavior, shared runtime mechanism |
| `applications/electron` | Desktop app bundling, packaging and Electron integration | Domain and debugger behavior |

The runtime package has no Theia, language-support, or DAP dependency. Its
resource resolver receives the extension's backend directory so bundled asset
lookup remains relative to the product. Machine/model selection stays in the
Theia `vice-runtime-resolver.ts` wrapper.

## Lifecycle ownership

- Standalone: `CommodoreViceEmbedServiceImpl` coordinates
  `ViceStandaloneProcess`, stdout decoding and the native frame listener.
  Explicit stop sends SIGTERM and releases ownership immediately; late child
  callbacks cannot affect a replacement session.
- Debug/no-debug: `ViceDebugSession` owns the launched process. For embedded
  launches, Theia reserves a frame port before starting the adapter. Repeated
  resolution reuses an unconnected reservation; an already connected emulator
  prevents another debug launch from replacing its transport.
- A debug launch takes over by stopping a standalone-owned process first.
  Native disconnect releases the debug frame reservation and cached image.
- Frontend RPC disconnection detaches the client without terminating the
  standalone emulator. Backend shutdown releases owned process/transport state.
- The adapter uses the runtime termination helper with SIGKILL when terminating
  its debuggee, preserving the current workaround for macOS VICE exit-cleanup
  crashes. This does not apply the same shutdown policy to standalone sessions.

## Embedded frame and input paths

The patched baseline is VICE 3.10.0. The native patch, build/staging scripts and
wire specification live in [`tools/vice-embed`](../tools/vice-embed/README.md)
and [`PROTOCOL.md`](../tools/vice-embed/PROTOCOL.md).

The primary frame path is:

```text
VICE SDL surface -> CCB1 / loopback TCP -> ViceFrameTransport
  -> CommodoreViceFrameBridge / binary WebSocket -> browser canvas
```

VICE sends complete RGBA8888 SDL surfaces without downsampling or compression.
The native patch limits ordinary frame emission to a minimum 16 ms interval;
frame dimensions follow the emitted surface. Browser presentation handles
scaling. Debug frames bypass DAP custom events and adapter stdout forwarding.

`ViceFrameTransport` owns the loopback listener and record validation/reassembly.
`CommodoreViceFrameBridge` stays in Theia and owns WebSocket endpoint/origin
checks, cached-frame replay and slow-client handling. Clearing the frame cache
retains browser connections; stopping the bridge releases its listener and
clients. The bridge does not own emulator processes.

Commands use CCV1 JSON lines on inherited fd 3, with stdin fallback for manual
launches without `-cc-command-fd`. Standalone commands go through the backend;
debug-session commands go through adapter custom requests. Keyboard, mouse,
menu, reset and quit have native hooks. Joystick and resize remain reserved
messages. Mouse input requires the selected VICE mouse device/emulation to be
enabled; browser pointer lock supplies relative movement.

## Stdout and JSON policy

`ViceEmbeddedStdoutDecoder` separates text, CCV1 lines and fallback CCB1 records
with a 32 MiB buffer bound. It does not interpret JSON or validate pixel data.
The shared JSON codec handles the prefix, serialization, supported event types
and `hello` version check. Event-field validation and forwarding remain caller
policy:

| Consumer | JSON events | Fallback binary frames | Invalid JSON / overflow |
| --- | --- | --- | --- |
| Theia standalone backend | Validates/normalizes frame and status fields, including timestamp fallback | Validates and forwards records to the browser bridge | Reports JSON error status and original output; truncates overflow output to the limit |
| DAP session | Preserves envelope fields; handles hello/status and suppresses frame forwarding | Discards complete framed records without pixel validation | Reports JSON error status without echoing the malformed line; warns on overflow and retains its output policy |

The browser/RPC types remain in the common Theia service module. They do not
import the Node runtime entry point; tests check the shared protocol version.

## Debug startup and source behavior

The adapter advertises `supportsConfigurationDoneRequest`, retains breakpoints
received before launch, loads `.dbg` mappings and synchronizes checkpoints at
the initial CPU halt before resuming. Startup stops are serialized to avoid
multiple DAP `stopped` events before a client resume/step.

Configured/fallback debug dumps must match the launched PRG basename; address
overlap alone must not select another program's dump. `.vs` monitor command
files are authoritative for source-authored `.break` checkpoints. DAP-managed
source breakpoints use the binary monitor. Detailed reconciliation, source
fallback and diagnostic rules are in [Debugger Support](debugger.md).

## Verification and remaining work

Runtime and adapter tests cover protocol, process, framing and monitor behavior.
Real DAP and Electron UI lanes are described in the
[VICE E2E rig](vice-e2e-test-rig.md). Linux CI uses stock external VICE; embedded
transport cases need the patched runtime and are skipped when unsupported.

macOS Apple Silicon product smoke tests check the bundled VICE's early startup
and require continuing CCB1 frames with visible content over loopback. Native
packaging includes the complete non-system dylib dependency graph, including
`@rpath` references and sdl2-compat's dynamically loaded SDL3, and
removes build-machine search paths so local Homebrew libraries cannot mask
missing payloads. These checks cover native startup and frame delivery; browser
painting still belongs to the Electron UI tests.

Runtime extraction is partial. Theia still owns launch/session policy, machine
selection, JSON validation, browser transport and RPC cleanup; the adapter
retains its DAP-specific binary-monitor connection. Remaining product gaps
include joystick/resize native hooks, bundled Linux/Windows/Intel macOS embedded
payloads, cycle-accurate execution provenance, richer symbol presentation and
configured-run build policies. See [the implementation plan](plan.md).

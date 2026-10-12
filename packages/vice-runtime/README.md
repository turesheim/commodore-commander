# VICE Runtime

`@commodore-commander/vice-runtime` owns reusable Node.js code for running VICE
as an external process. It has no Theia, language-support, or DAP dependency.

## Responsibilities

- locate VICE resources from configured paths, executable locations, bundled
  assets, and platform-specific system locations
- resolve an executable from an explicit path, a runtime's `bin` directory or
  root, or a command name for PATH lookup
- build PRG launch arguments for debug, no-debug, and embedded sessions,
  including local `vice.ini` lookup and optional monitor command files
- launch a process with an optional binary-monitor port and embedded command fd
- terminate a debug-owned process with a timeout and forced-kill fallback
- own a standalone embedded process, its command pipe, output callbacks,
  launch failures, and natural exit notifications
- share embedded launch flags and keyboard/mouse defaults between the adapter
  and the Theia backend
- parse native CCB1 binary frames through one shared implementation
- own the emulator's loopback TCP frame listener, socket, and stream reassembly
- separate embedded stdout text/JSON lines and fallback binary records
- encode CCV1 JSON commands and parse the shared event envelope

Resource discovery requires the caller's `runtimeDirectory`. The Theia wrapper
passes its own backend directory so bundled assets remain relative to the
extension, rather than moving with this package. The wrapper also supplies the
preference name used in the missing-runtime error message.

The debug adapter chooses when to launch/terminate and when to force-kill VICE;
this package provides the mechanism. Binary-monitor protocol and DAP events
remain in `packages/debug-adapter`.

`ViceStandaloneProcess` owns one standalone child process and uses the same
command-fd selection as the debug launch helper: fd 3 on macOS/Linux and
standard input (fd 0) on Windows. The native Windows reader polls the inherited
Win32 pipe without blocking the SDL loop; it does not treat extra Node pipes as
CRT descriptors. It accepts already-resolved
commands/arguments, inherits the environment, and does not require a PRG or
allocate a monitor port. Replacing/stopping a process releases ownership and
suppresses its later output and exit callbacks. Explicit stop retains
the previous standalone behavior: send SIGTERM without waiting for exit or
applying the debugger's forced-kill policy. Natural exit and asynchronous spawn
failure are delivered to the caller through callbacks.
Command-pipe failure while active stops/releases the owned child and reports
`onError`; late pipe errors after stop/replacement are handled without affecting
the replacement session or crashing the backend.

`ViceFrameTransport` listens on `127.0.0.1` with an ephemeral port and delivers
validated CCB1 records through callbacks. Its decoder reassembles fragmented
records, skips unrelated bytes, reports invalid frames, and bounds buffered
data. Replacing a native socket resets partial records and ignores late events
from the replaced socket. Explicit stop releases the listener and socket without
calling the disconnect callback; the caller chooses session cleanup after a
natural disconnect.

`ViceEmbeddedStdoutDecoder` reassembles the mixed stdout stream used by embedded
VICE, delivering newline-terminated text, text preceding a CCB1 record, and
complete binary records through callbacks. It validates record lengths and
retains the existing 32 MiB buffer bound. Consumers interpret JSON, validate or
discard binary payloads, and decide how overflow data is reported. `reset()`
discards partial stdout when the caller changes sessions. This differs from
the native frame decoder, which skips unrelated bytes and validates pixel data.

The CCV1 JSON codec owns the wire prefix, JSON serialization/parsing, supported
event types, and `hello` version check. It preserves event fields without
validating frame/status contents. The Theia consumer validates and normalizes
those fields; the adapter preserves the envelope payload. Malformed prefixed
JSON still throws, allowing each consumer to retain its error/output policy.
Command fields are serialized unchanged. This codec does not implement reserved
input commands in the native VICE patch.

`probeViceRuntime` runs a bounded `-version` process to check native executable
loading. Embedded checks also pass `-cc-embed` and require the versioned CCV1
hello; stock VICE cannot pass solely by printing a version. This does not boot
a machine or validate live frames/input. Explicit invalid resource overrides
fail instead of falling back to another installation.

The Theia backend still chooses standalone versus debug ownership, resolves
machine/preferences, chooses protocol commands, reports status, interprets
stdout JSON events and fallback frames, and manages the browser WebSocket bridge.
This extraction does not complete the runtime migration.

## Verification

From the repository root, after installing dependencies:

```sh
npm test --workspace @commodore-commander/vice-runtime
```

The tests build the package and exercise resource/executable resolution,
argument construction, process launch/termination, standalone command-pipe
input, callback isolation, binary frame validation/reassembly, native socket
lifecycle, mixed stdout framing, and CCV1 JSON wire compatibility without
requiring a VICE installation. Socket tests bind loopback TCP.

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

Resource discovery requires the caller's `runtimeDirectory`. The Theia wrapper
passes its own backend directory so bundled assets remain relative to the
extension, rather than moving with this package. The wrapper also supplies the
preference name used in the missing-runtime error message.

The debug adapter chooses when to launch/terminate and when to force-kill VICE;
this package provides the mechanism. Binary-monitor protocol and DAP events
remain in `packages/debug-adapter`.

`ViceStandaloneProcess` owns one standalone child process and uses the same
command-fd selection as the debug launch helper. It accepts already-resolved
commands/arguments, inherits the environment, and does not require a PRG or
allocate a monitor port. Replacing/stopping a process releases ownership and
suppresses its later output and exit callbacks. Explicit stop retains
the previous standalone behavior: send SIGTERM without waiting for exit or
applying the debugger's forced-kill policy. Natural exit and asynchronous spawn
failure are delivered to the caller through callbacks.

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

The Theia backend still chooses standalone versus debug ownership, resolves
machine/preferences, encodes protocol commands, reports status, interprets
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
lifecycle, and mixed stdout framing without requiring a VICE installation.
Socket tests bind loopback TCP.

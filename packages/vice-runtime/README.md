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

The Theia backend still chooses standalone versus debug ownership, resolves
machine/preferences, encodes protocol commands, reports status, and manages
frame sockets and the browser WebSocket bridge. This extraction does not
complete the runtime migration.

## Verification

From the repository root, after installing dependencies:

```sh
npm test --workspace @commodore-commander/vice-runtime
```

The tests build the package and exercise resource/executable resolution,
argument construction, process launch/termination, standalone command-pipe
input, and callback isolation without requiring a VICE installation.

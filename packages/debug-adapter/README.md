# Debug Adapter

`packages/debug-adapter` is the TypeScript-first VICE DAP adapter used by the
Theia product.

What is here:

- Kick Assembler `.dbg` source-to-address parsing
- source breakpoint mapping that no longer depends on Eclipse markers or `IFile`
- breakpoint-location discovery and `sourceRoot` handling for relative `.dbg`
  source paths
- a DAP stdio transport and VICE debug session
- VICE process launch with binary monitor wiring for debugging
- `noDebug` launch support for Theia/VS Code Start Without Debugging flows,
  starting VICE without the binary monitor or `-initbreak`
- VICE monitor protocol IDs, request builders, frame decoding, and response
  correlation
- DAP support for launch, source breakpoints, data breakpoints/watchpoints,
  continue, pause, step in, step over, step out, stack frames, register
  variables, register writes, label variables, memory reads/writes, loaded
  sources, evaluation, and first-pass disassembly. The Theia extension's Memory
  view consumes `readMemory` and `writeMemory`; memory UI state remains outside
  the adapter.

What is not here yet:

- cycle-accurate stack reconstruction
- non-macOS embedded VICE payload discovery
- complete illegal-opcode disassembly coverage
- complete replacement of every Eclipse debug view

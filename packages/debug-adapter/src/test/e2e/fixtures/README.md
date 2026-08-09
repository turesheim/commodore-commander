# VICE E2E Fixtures

These fixtures are committed as golden PRG/DBG pairs so the real VICE
regression suite can test the debug adapter without rebuilding Kick Assembler
programs during every run.

- `debug-demo` covers debugger startup, source breakpoints, stepping,
  data breakpoints, trace history, logpoints, and disassembly fallback.
- `visual-debugger-demo` covers C64 display-state reads used by the visual
  debugger.
- `screencolors` covers breakpoint binding on a comment line immediately above
  executable code when the Kick Assembler `.dbg` `<Breakpoints>` section is
  empty, plus `.break`-style debug-info breakpoint installation in the e2e
  suite.

The e2e runner copies each fixture to a temporary workspace before launch and
rewrites the primary `.dbg` source path to that temporary copy. That keeps
breakpoint source matching portable even though Kick Assembler debug dumps store
source paths.

If one of these programs changes, rebuild the matching `.prg` and `.dbg`
together and review the test assertions that depend on label addresses, source
line mappings, screen memory, VIC registers, or sprite state.

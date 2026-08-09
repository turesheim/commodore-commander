# VICE E2E Fixtures

These fixtures are committed as golden Kick Assembler outputs so the real VICE
regression suite can test the debug adapter without rebuilding programs during
every run.

- `debug-demo` covers debugger startup, source breakpoints, stepping,
  data breakpoints, trace history, logpoints, and disassembly fallback.
- `visual-debugger-demo` covers C64 display-state reads used by the visual
  debugger.
- `screencolors` covers breakpoint binding on a comment line immediately above
  a source-authored `.break`, plus programmed breakpoint behavior from matching
  `.dbg` and `.vs` output.

The e2e runner copies each fixture to a temporary workspace before launch and
rewrites the primary `.dbg` source path to that temporary copy. Tests that need
VICE-native programmed breakpoints can also opt in to copying the matching
`.vs` file. That keeps breakpoint source matching portable even though Kick
Assembler debug dumps store source paths.

If one of these programs changes, rebuild the matching `.prg`, `.dbg`, and
`.vs` together and review the test assertions that depend on label addresses,
source line mappings, screen memory, VIC registers, or sprite state.

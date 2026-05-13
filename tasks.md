# Current Task Priorities

The implementation plan and migration gap are tracked in
`design-docs/plan.md`. This file is a short priority index.

1. Add an incremental TypeScript workspace index for Kick Assembler lookup,
   completion, rename, workspace symbols, hovers, semantic tokens, and
   diagnostics.

2. Align the semantic parser, Langium outline path, compatibility scanner, and
   project loader so shared editor services do not diverge on common Kick
   Assembler constructs.

3. Add Theia task integration for Kick Assembler build, build-before-debug, and
   headless-equivalent execution.

4. Improve KickAss diagnostic attribution and build-config validation.

5. Extend VICE debug coverage with live monitor fixtures, richer disassembly,
   monitor-console support, and better data breakpoint UX.

6. Wire generated VICE launch configurations to build tasks and the workspace
   Active Machine preference where appropriate.

7. Expand reference data and hardware-aware editor feedback after the shared
   index and diagnostics path are stable.

8. Grow SIDScore TypeScript editor services while keeping bundled SIDScoreCLI
   behavior synchronized with the sibling `../SIDScore` source.

9. Add cross-platform VICE payload packaging and distribution signing only
   after the Theia runtime/debug path is stable.

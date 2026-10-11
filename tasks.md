# Current Task Priorities

The implementation plan and migration gap are tracked in
`design-docs/plan.md`. This file is a short priority index.

1. Add an incremental TypeScript workspace index for Kick Assembler lookup,
   completion, rename, workspace symbols, hovers, semantic tokens, and
   diagnostics.

2. Align the semantic parser, Langium outline path, compatibility scanner, and
   project loader so shared editor services do not diverge on common Kick
   Assembler constructs.

3. Harden existing Theia build/pre-launch tasks and add missing clean and
   headless-equivalent task behavior.

4. Improve KickAss diagnostic attribution and build-config validation.

5. Extend existing real VICE/UI regressions, symbol presentation and watchpoint
   UX while preserving the shared runtime and distinct session owners.

6. Complete configured-run build policies and workspace Active Machine defaults
   in generated VICE launch configurations; build-task wiring already exists.

7. Expand reference data and hardware-aware editor feedback after the shared
   index and diagnostics path are stable.

8. Grow SIDScore TypeScript editor services while keeping bundled SIDScoreCLI
   behavior synchronized with the sibling `../SIDScore` source.

9. Add cross-platform VICE payload packaging and distribution signing only
   after the Theia runtime/debug path is stable.

# Current Task Priorities

The implementation plan and migration gap are tracked in
`design-docs/plan.md`. This file is a short priority index.

The bounded editor lookup-reuse round is implemented: discovery, disk models,
document analysis and assembled indexes are reused with explicit invalidation.
Changed input still causes full assembly; per-document index updates remain work.

1. Align the semantic parser, Langium outline path, compatibility scanner, and
   project loader so shared editor services do not diverge on common Kick
   Assembler constructs.

2. Harden existing Theia build/pre-launch tasks and add missing clean and
   headless-equivalent task behavior.

3. Improve KickAss diagnostic attribution and build-config validation.

4. Extend existing real VICE/UI regressions, symbol presentation and watchpoint
   UX while preserving the shared runtime and distinct session owners.

5. Complete configured-run build policies and workspace Active Machine defaults
   in generated VICE launch configurations; build-task wiring already exists.

6. Expand reference data and hardware-aware editor feedback after the shared
   index and diagnostics path are stable.

7. Grow SIDScore TypeScript editor services while keeping bundled SIDScoreCLI
   behavior synchronized with the sibling `../SIDScore` source.

8. Add cross-platform VICE payload packaging and distribution signing only
   after the Theia runtime/debug path is stable.

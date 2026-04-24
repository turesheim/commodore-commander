# Packages

This directory contains migration scaffolding for a future Theia-oriented
Commodore Commander architecture.

The code here is intentionally additive:

- the existing Eclipse/PDE product stays intact
- `packages/language-support` is now TypeScript-first
- `packages/debug-adapter` is now the TypeScript-first VICE DAP adapter for
  Theia launch configurations and debug sessions
- Java extractions that still matter as behavior references are kept explicitly
  as reference material
- Eclipse UI, workspace, launch tab, and debug model code remains in place
  until it can be redesigned cleanly

These packages are not wired into the current Tycho build yet. That is
deliberate so the existing product remains buildable while the new architecture
is reviewed and iterated on.

The runnable Theia application package now lives outside this folder in
`applications/electron` so the package-level modules can stay focused on
reusable logic and Theia integration seams.

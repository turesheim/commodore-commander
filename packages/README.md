# Packages

This directory contains the package-level modules for the Theia-oriented
Commodore Commander architecture.

The code here is intentionally additive:

- `packages/language-support` is now TypeScript-first
- `packages/debug-adapter` is now the TypeScript-first VICE DAP adapter for
  Theia launch configurations and debug sessions
- Java extractions that still matter outside the active language/debug runtime
  are kept explicitly scoped

These packages are wired through the npm workspace and the Electron application
under `applications/electron`.

The runnable Theia application package now lives outside this folder in
`applications/electron` so the package-level modules can stay focused on
reusable logic and Theia integration seams.

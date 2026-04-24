# AGENTS.md

## Purpose

This repository contains a Theia based IDE for building applications for the Commodore range of 8-bit computers.

## Working rules

- Prefer small, reviewable changes over large speculative rewrites.
- Preserve domain behavior and protocol knowledge whenever possible.
- Keep existing code working unless the task explicitly targets migration scaffolding.
- Do not replace Eclipse-specific code with guessed Theia code unless the mapping is obvious and low-risk.
- When in doubt, isolate logic behind interfaces and leave TODOs.
- When changing SIDScore behavior or replacing a bundled `sidscore-cli-*.jar`, update the corresponding source code in `../SIDScore` in the same task. Do not leave SIDScore changes as jar-only updates unless `../SIDScore` is unavailable, and call that out explicitly.

## Product documentation

- All files in `bundled-docs` shall be included in the product build.
- Every bundled document shall be linked from the Help section of the welcome page.
- Every bundled document shall also be linked from the Help section of the main menu.


## Rules

This IDE is now TypeScript-first for language support.

Rules:
- `packages/language-support` for TypeScript language logic
- `packages/theia-extension` for Theia-facing integration
- `packages/debug-adapter` for VICE debugging work
- `packages/vice-runtime` for emulator/runtime process handling

## Target architecture

When creating migration scaffolding, prefer this structure:

- `packages/core`
  Shared domain logic, models, debug-info parsing, protocol primitives
- `packages/language-support`
  Language-related logic and future language-server-oriented code
- `packages/debug-adapter`
  Future DAP adapter for VICE
- `packages/vice-runtime`
  Process launching, runtime discovery, config, and monitor connection management
- `packages/theia-extension`
  Theia-specific commands, views, and integration glue

Do not force code into these modules if the fit is unclear; document the uncertainty instead.

## Design constraints

- Avoid adding unnecessary dependencies.
- Keep VICE integration external-process-oriented.
- Treat debugging as DAP-oriented architecture.

## Review expectations

When you finish:
- summarize changed files
- summarize remaining manual work
- call out any assumptions explicitly
- do not claim the migration is complete if it is only scaffolded

## Review guidelines

- Do not silently delete working code without replacing it or documenting why.
- Do not mark scaffolding as complete migration.
- Prefer explicit TODOs over speculative implementations.
- Preserve domain semantics and protocol meanings.

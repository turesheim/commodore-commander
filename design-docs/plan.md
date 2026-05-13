# Current Implementation Plan

## Direction

Commodore Commander is now organized around the Theia-based application and
TypeScript-first language/debug packages. Keep changes additive and reviewable
while the remaining shared services mature.

The current architecture is TypeScript-first for language support. Do not
design a Java language server or preserve Java as a language-support runtime
dependency.

## Current Baseline

- `packages/language-support` is the TypeScript language logic package. It owns
  syntax assets, text/location models, include resolution, semantic parsing,
  Langium structural outline support, lookup, hovers, completions, rename,
  symbols, semantic tokens, folding, formatting, quick fixes, machine profiles,
  and build planning.
- `packages/theia-extension` adapts the shared language/build/debug services to
  Theia. It registers Kick Assembler and SIDScore languages, file icons,
  bundled documentation, welcome content, machine-profile UI, Kick Assembler
  build UI, `commodore-vice` launch configuration support, and Memory/SIDScore
  views.
- `packages/debug-adapter` is the TypeScript VICE DAP adapter. It owns DAP
  framing, VICE binary monitor communication, `.dbg` mapping, breakpoints,
  data breakpoints, register/label variables, memory read/write, stepping,
  loaded sources, evaluation, hardware-stack call-frame reconstruction, and
  complete NMOS 6502 disassembly.
- `applications/electron` is the runnable Theia Electron application package.
- `packages/core` is a Java debug-info extraction/reference package. It is not
  a language-support runtime target.

## Implementation Phases

1. Stabilize TypeScript language foundations.
   - Add an incremental, backend-neutral workspace index shared by completion,
     rename, references, workspace symbols, hovers, semantic tokens, and
     diagnostics.
   - Align the compatibility scanner, semantic parser, project loader, and
     Langium outline model so they do not disagree on common Kick Assembler
     constructs.
   - Extend diagnostics and editor services from structural/name-based behavior
     toward compiler-relevant behavior without embedding KickAss or Java into
     the language package.

2. Make build integration Theia-native.
   - Keep `commodore-commander.build.json` as the project build model.
   - Harden the existing Theia task integration for build and
     build-before-debug, and add clean/headless-equivalent task coverage where
     it is still missing.
   - Improve build-config validation, source attribution, generated-asset
     handling, and marker ranges from KickAss output.
   - Add a configuration editor only after the schema and validation behavior
     are stable.

3. Close the run/debug workflow gap.
   - Continue using Theia launch configurations and the `commodore-vice` DAP
     adapter instead of rebuilding previous launch tabs.
   - Wire generated launch entries to build tasks and the workspace Active
     Machine preference where appropriate.
   - Keep expanding the opt-in real VICE e2e session tests and make them
     repeatable in CI where a VICE runtime is available.
   - Improve disassembly, monitor-console coverage, deeper live watchpoint
     telemetry, and source/label presentation.
   - Extract `packages/vice-runtime` only when VICE process discovery,
     packaging, and argument construction become shared outside the current
     Theia/debug-adapter seams.

4. Fill user-facing Theia gaps deliberately.
   - Keep Theia integration thin: adapt shared services to Monaco, Theia debug,
     Theia tasks, Theia menus, and Theia views.
   - Avoid custom views when Theia already has a native concept, such as debug
     sessions, launch configurations, problems, terminals, or tasks.
   - Add custom views only for Commodore-specific value: machine profile,
     memory, SIDScore waveform/instruments, and future asset tooling.

5. Grow SIDScore support without jar-only drift.
   - Keep current SIDScore playback as separate-process SIDScoreCLI integration.
   - Add TypeScript editor services for SIDScore only after the grammar and
     language semantics are stable enough to test.
   - When changing SIDScore behavior or bundled SIDScoreCLI jars, update the
     sibling `../SIDScore` source in the same task or call out that it is
     unavailable.

6. Prepare distribution last.
   - Keep local Electron startup/build scripts working while architecture is in
     flux.
   - Add Linux, Windows, and Intel macOS VICE payload handling after the runtime
     resolver and packaging model are stable.
   - Treat real signing, notarization, installers, and app-bundle polish as
     distribution work, not language/debug foundation work.

## Migration Gap

| Area | Previous IDE baseline | Current Theia plan/status | Remaining gap |
| --- | --- | --- | --- |
| Source editing | Workbench-integrated editor, TM4E syntax, hovers, annotations, and outline | Monaco language registration, TextMate syntax, hovers, completions, definition/reference, rename, symbols, semantic tokens, folding, formatting, quick fixes | Compiler-accurate semantics, incremental index, deeper diagnostics, and richer reference coverage |
| Project model | Resource-backed project model, project nature, automatic builder | File/path based workspace planner, `commodore-commander.build.json`, and Theia build-task provider | Stronger validation, clean-task coverage, and richer task UX |
| Build execution | Incremental builder, console, problem markers | Theia backend build service, save-triggered builds, console widget, problem markers, headless CLI | Build-before-debug tasks, richer KickAss diagnostic attribution, form/schema UX |
| Run workflow | Launch shortcuts and direct PRG launch behavior | Theia Start Debugging / Start Without Debugging with generated or existing `launch.json`, plus Kick Assembler `preLaunchTask` wiring | No separate run picker; configured-run build policies are not fully surfaced; Active Machine default is not yet written into generated source launch entries |
| Debug protocol | VICE binary monitor debugger | TypeScript DAP adapter over VICE binary monitor with opt-in real VICE e2e coverage | Broader e2e/CI coverage, better data/trace UX, cycle-accurate execution-history stack provenance |
| Memory UI | Memory monitors and renderings | Theia Memory view via DAP `readMemory`/`writeMemory` | More faithful C64 charset/ROM rendering and deeper rendering parity |
| Disassembly | Disassembly view and label parsing | Complete NMOS 6502 DAP disassemble support | Richer symbol rendering |
| Machine/runtime selection | Launch configuration tabs and bundled VICE assumptions | Machine profiles in TypeScript; macOS Apple Silicon embedded VICE path | Cross-platform VICE payloads, runtime-package extraction if reuse requires it |
| SIDScore | Separate external toolchain integration | Theia syntax registration plus external SIDScoreCLI player-server integration | TypeScript SIDScore language intelligence, diagnostics, export workflow, and richer controls |
| Packaging | Historical product build | Local Theia Electron app package | Distributable packaging, signing/notarization, platform payload matrix |
| Documentation | Product docs and repository docs | Bundled docs registered in welcome/help plus design docs | Keep design docs, bundled docs manifest, and product help links synchronized |

## Non-Goals For The Current Passes

- Do not attempt a blind framework conversion.
- Do not emulate previous workspace resources, launch tabs, or debug model
  classes in TypeScript.
- Do not introduce a Java language server.
- Do not claim feature parity while the Theia variant is still scaffolded.
- Do not add speculative abstractions before a shared caller actually needs
  them.

## Near-Term Definition Of Done

- `npm run theia:build` succeeds after each meaningful Theia package change.
- Language-support behavior has focused tests under
  `packages/language-support/test`.
- Debug adapter protocol behavior has focused tests under
  `packages/debug-adapter/src/test`.
- The design docs state what is implemented, what is reference-only, and what
  remains a gap against the previous IDE.
- Any migration report or porting matrix uses `portable`, `refactorable`, and
  `rewrite` categories consistently.

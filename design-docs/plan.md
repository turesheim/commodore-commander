# Current Implementation Plan

## Direction

Commodore Commander is moving toward a Theia-based variant through additive,
reviewable extraction. The Eclipse/PDE product remains the working baseline and
must stay buildable while Theia support matures.

The current migration is TypeScript-first for language support. Existing Java
language-related code is reference material only; do not design a Java language
server or preserve Java as a language-support runtime dependency.

## Current Baseline

### Eclipse Product Still Present

- `net.resheim.eclipse.cc.ui` contains the active Eclipse editor, builder,
  launch, VICE debug model, memory/rendering views, product workbench, and
  command/UI integration.
- `net.resheim.eclipse.cc.kickassembler.parser` contains the generated Java
  Kick Assembler parser bundle and tests.
- The root Maven/Tycho build remains the Eclipse product build.

### Theia Variant In Progress

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
  loaded sources, evaluation, and first-pass disassembly.
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
   - Add Theia task integration for build, clean, build-before-debug, and
     headless-equivalent execution.
   - Improve build-config validation, source attribution, generated-asset
     handling, and marker ranges from KickAss output.
   - Add a configuration editor only after the schema and validation behavior
     are stable.

3. Close the run/debug workflow gap.
   - Continue using Theia launch configurations and the `commodore-vice` DAP
     adapter instead of rebuilding Eclipse launch tabs.
   - Wire generated launch entries to build tasks and the workspace Active
     Machine preference where appropriate.
   - Add live VICE monitor fixtures and automated session tests.
   - Improve disassembly, monitor-console coverage, data breakpoint UX, and
     source/label presentation.
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

## Eclipse-To-Theia Gap

| Area | Eclipse IDE baseline | Current Theia plan/status | Remaining gap |
| --- | --- | --- | --- |
| Source editing | Eclipse editor, TM4E syntax, hovers, annotations, outline, workbench integration | Monaco language registration, TextMate syntax, hovers, completions, definition/reference, rename, symbols, semantic tokens, folding, formatting, quick fixes | Compiler-accurate semantics, incremental index, deeper diagnostics, and richer reference coverage |
| Project model | Eclipse resources, project nature, automatic builder | File/path based workspace planner and `commodore-commander.build.json` | No Eclipse workspace emulation by design; needs stronger validation and Theia task integration |
| Build execution | Eclipse incremental builder, console, problem markers | Theia backend build service, save-triggered builds, console widget, problem markers, headless CLI | Build-before-debug tasks, richer KickAss diagnostic attribution, form/schema UX |
| Run workflow | Eclipse launch shortcuts and direct PRG launch behavior | Theia Start Debugging / Start Without Debugging with generated or existing `launch.json` | No separate run picker; Active Machine default is not yet written into generated launch entries |
| Debug protocol | Eclipse debug model over VICE binary monitor | TypeScript DAP adapter over VICE binary monitor | Live monitor fixtures, full illegal-opcode disassembly, better data/trace UX, no full 6502 call stack |
| Memory UI | Eclipse memory monitors and renderings | Theia Memory view via DAP `readMemory`/`writeMemory` | More faithful C64 charset/ROM rendering and deeper parity with Eclipse renderings |
| Disassembly | Eclipse disassembly view and label parsing | First-pass DAP disassemble support | Complete opcode coverage and richer symbol rendering |
| Machine/runtime selection | Eclipse launch configuration tabs and bundled VICE assumptions | Machine profiles in TypeScript; macOS Apple Silicon embedded VICE path | Cross-platform VICE payloads, runtime-package extraction if reuse requires it |
| SIDScore | Not an Eclipse parity feature in this repository's Java code path | Theia syntax registration plus external SIDScoreCLI player-server integration | TypeScript SIDScore language intelligence, diagnostics, export workflow, and richer controls |
| Packaging | Tycho/PDE product build | Local Theia Electron app package | Distributable packaging, signing/notarization, platform payload matrix |
| Documentation | Eclipse/product docs and repository docs | Bundled docs registered in welcome/help plus design docs | Keep design docs, bundled docs manifest, and product help links synchronized |

## Non-Goals For The Current Passes

- Do not attempt a blind Eclipse-to-Theia framework conversion.
- Do not emulate Eclipse workspace resources, launch tabs, or debug model
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
  remains a gap against the Eclipse IDE.
- Any migration report or porting matrix uses `portable`, `refactorable`, and
  `rewrite` categories consistently.

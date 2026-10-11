# Current Implementation Plan

## Baseline

The active product is Theia/Electron with TypeScript language and debug support.
Keep changes small and preserve working domain/protocol behavior.

| Package | Current role |
| --- | --- |
| `language-support` | Framework-neutral documents, include resolution, semantic parsing/outline, editor services, machine/reference data and build planning |
| `vice-runtime` | Shared discovery, launch/process helpers, standalone command pipe, native CCB1 transport, stdout framing and CCV1 JSON codec |
| `debug-adapter` | DAP over stdio, VICE binary monitor, debug-info/source mapping, breakpoints/watchpoints, memory/register operations, stack reconstruction and disassembly |
| `theia-extension` | Monaco/Theia adaptation, build execution/tasks, launch integration, session policy, browser emulator bridge and product views/help |
| `applications/electron` | Desktop application and distribution packaging |
| `core` | Preserved Java debug-info/numeric reference code, outside the npm product build |

Runtime extraction is already implemented in part. Do not plan it as a new
package or mark it complete: Theia owns product/session policy and the adapter
owns DAP-specific monitor behavior. See
[VICE architecture](vice-debug-architecture.md) for current boundaries.

## 1.0 release priorities

The goal is reliable installation and edit/build/run/debug workflows for the
supported product. Track acceptance evidence and scope decisions in
[the 1.0 release checklist](https://github.com/turesheim/commodore-commander/issues/114).
Full Eclipse feature parity and complete architectural migration are not release
requirements.

| Order | Required outcome | Issue |
| --- | --- | --- |
| 1 | Explicit OS/CPU/machine support matrix, usable Java/VICE setup and clean-host verification | [#107](https://github.com/turesheim/commodore-commander/issues/107) |
| 2 | Reliable emulator restart/model switching, recovery and bounded process cleanup | [#108](https://github.com/turesheim/commodore-commander/issues/108) |
| 3 | Named-run selection, build policies and machine defaults through native Theia launches | [#109](https://github.com/turesheim/commodore-commander/issues/109) |
| 4 | Asset editor save/reopen/export integrity | [#110](https://github.com/turesheim/commodore-commander/issues/110) |
| 5 | Actual packaged UI, build/debug and SIDScore workflows tested on supported platforms | [#111](https://github.com/turesheim/commodore-commander/issues/111) |
| 6 | Verified first-run guide and complete offline Help | [#113](https://github.com/turesheim/commodore-commander/issues/113) |
| 7 | Versioned, tested release artifacts, installation/trust checks and redistribution material | [#112](https://github.com/turesheim/commodore-commander/issues/112) |

Platform scope bounds the other gates. Nightlies package macOS, Windows and
Linux, but patched embedded VICE currently targets macOS Apple Silicon only;
1.0 requires our patched display/input transport on all supported platforms.
Stock external VICE remains a compatibility option, not a replacement for this
release requirement. CPU/OS/model coverage still needs verification. Java 21+ is
currently external; Check Runtime Setup reports loading/protocol readiness and
configuration errors without booting a machine. Live frame/input/debug checks
remain separate acceptance gates. Nightlies skip unchanged commits unless explicitly forced.
Signing/notarization and stable-release installation remain work.

Existing 1.0 feature commitments remain visible: SIDScore language reference and
editor assistance (#67), simple BASIC editing/running (#19/#15), and numeric
conversion hover (#52). Complete them or explicitly revise scope before tagging;
they have not been silently deferred. Kick Assembler directive help (#16) is
implemented. SIDScore 0.8.0 syntax, outline, external playback and export
integration already exist; language intelligence and broader workflow validation
remain work. SIDScore behavior/JAR changes must include sibling `../SIDScore`
source, or explicitly report its absence.

## Engineering boundaries and deferred work

- Preserve shared build/editor discovery and lexical/namespace identities for
  navigation, CTRL/CMD+click, references, rename, semantic tokens and outline.
  Config-specific discovery filters and compiler-relevant diagnostics remain
  gaps. Delta indexes and broader macro/conditional semantics can wait unless
  needed to fix promised workflows. See [language architecture](language-support-architecture.md)
  and the [language-support report](ts-language-support-report.md).
- Keep Program/Profile/Run in `commodore-commander.build.json`; existing tasks
  and `preLaunchTask` wiring need policy integration, validation, diagnostics and
  clean/headless-equivalent behavior. See [build and launch design](target-build-run.md).
- Preserve separate standalone/debug owners and shutdown/validation policies;
  extend the [existing real VICE/UI test rig](vice-e2e-test-rig.md). Further runtime
  extraction and richer trace provenance are not blanket release prerequisites.
  Keep Theia origin/preferences policy out of the shared runtime.

## Completion criteria for each change

- Run package tests and builds appropriate to the changed boundary; use real
  VICE/UI coverage when launch, transport or integration behavior changes.
- Keep relevant READMEs and design documents synchronized, concise and explicit
  about implemented behavior, reference-only material and remaining gaps.
- Include every bundled document in the product and link it from both welcome
  Help and main-menu Help.
- Preserve domain semantics; do not emulate the former IDE class graph or claim
  full migration/feature parity from scaffolding.

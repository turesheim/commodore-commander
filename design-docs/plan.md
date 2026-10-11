# Current Implementation Plan

## Baseline

The active product is Theia/Electron with TypeScript language and debug support.
Keep changes small and preserve working domain/protocol behavior.

| Package | Current role |
| --- | --- |
| `language-support` | Framework-neutral documents, include resolution, semantic parsing, Langium outline, editor services, machine/reference data and build planning |
| `vice-runtime` | Shared discovery, launch/process helpers, standalone command pipe, native CCB1 transport, stdout framing and CCV1 JSON codec |
| `debug-adapter` | DAP over stdio, VICE binary monitor, debug-info/source mapping, breakpoints/watchpoints, memory/register operations, stack reconstruction and disassembly |
| `theia-extension` | Monaco/Theia adaptation, build execution/tasks, launch integration, session policy, browser emulator bridge and product views/help |
| `applications/electron` | Desktop application and distribution packaging |
| `core` | Preserved Java debug-info/numeric reference code, outside the npm product build |

Runtime extraction is already implemented in part. Do not plan it as a new
package or mark it complete: Theia owns product/session policy and the adapter
owns DAP-specific monitor behavior. See
[VICE architecture](vice-debug-architecture.md) for current boundaries.

## Next work

1. **Language consistency.** The bounded lookup-reuse round covers discovery,
   disk models, document analysis and assembled indexes. Input changes still
   trigger full assembly. Namespace and lexical identities now drive navigation
   (including CTRL/CMD+click), references, leaf rename and semantic tokens. Next,
   make lookup follow the include graph and expanded source order, then align
   the project loader/Langium outline. File namespaces and same-document
   directional labels are supported. Extend
   compiler-relevant diagnostics without introducing a Java language server. See [language architecture](language-support-architecture.md)
   and the [language-support report](ts-language-support-report.md).

2. **Build and launch integration.** Keep program/profile/run definitions in
   `commodore-commander.build.json`. Build tasks and generated `preLaunchTask`
   wiring already exist; harden validation, diagnostic attribution,
   generated-asset handling and clean/headless-equivalent task behavior.
   Configured-run `ifStale`/`always`/`never` policies and workspace Active Machine
   defaults are not fully wired into generated launches. See
   [Program/Profile/Run](target-build-run.md).

3. **Runtime and debugger boundaries.** Reuse `vice-runtime` where shared callers
   need the same mechanism. Preserve distinct standalone/debug shutdown,
   stdout-validation and launch policies. Keep expanding
   [real VICE and Electron UI regressions](vice-e2e-test-rig.md), source/label
   presentation and watchpoint/trace UX. Avoid speculative abstractions or
   moving Theia origin/preferences policy into the runtime.

4. **Product gaps.** Use native Theia concepts for tasks, sessions, problems and
   launch configuration. Add custom views for Commodore-specific value. Grow
   SIDScore TypeScript editor services only as its semantics become testable;
   preserve the external SIDScoreCLI player architecture. SIDScore behavior or
   JAR updates must include the sibling `../SIDScore` source, or explicitly
   report that it is unavailable.

5. **Distribution.** Existing nightly workflows package macOS, Windows and
   Linux. Bundled patched embedded VICE currently targets macOS Apple Silicon;
   other payloads, signing/notarization and installer polish remain work.

## Remaining gaps

| Area | Implemented | Remaining |
| --- | --- | --- |
| Language | Monaco editor services, reference lookup, cached analysis/index assembly and bounded/event-invalidated file/disk snapshots | Include-precise lookup, cross-file directional labels, delta updates and compiler-accurate semantics |
| Build/project | File/path planner, program/profile/run config, backend and headless builds, Theia tasks/markers | Stronger validation, diagnostic attribution, clean-task and configuration UX |
| Launch | Theia debug/no-debug configurations and generated build-before-debug tasks | Configured-run policy flow, run selection and Active Machine defaults |
| Debug | DAP binary monitor, breakpoints/watchpoints, Memory/Visual Debugger/Monitor views, disassembly, observed trace history | Broader regressions, richer symbols/trace UX and execution-history provenance |
| Runtime | Shared mechanism with separate standalone/debug owners | Further extraction only where reuse is clear; cross-platform embedded payloads |
| SIDScore | Syntax registration and external player-server integration | Language intelligence, diagnostics, export workflow and controls |
| Distribution | Electron package and nightly platform workflows | Signing/notarization and installer-specific work |

## Completion criteria for each change

- Run package tests and builds appropriate to the changed boundary; use real
  VICE/UI coverage when launch, transport or integration behavior changes.
- Keep relevant READMEs and design documents synchronized, concise and explicit
  about implemented behavior, reference-only material and remaining gaps.
- Include every bundled document in the product and link it from both welcome
  Help and main-menu Help.
- Preserve domain semantics; do not emulate the former IDE class graph or claim
  full migration/feature parity from scaffolding.

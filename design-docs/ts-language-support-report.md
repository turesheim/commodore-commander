# TypeScript Language-Support Status

## Implemented

The active language package is TypeScript-first and framework-neutral. Theia
frontend consumers use its browser-safe `runtime` export; Node build/project
consumers use the package root. Both load compiler output from `dist/`.
Maintained sources remain `.ts`, including committed Langium generator output;
old emitted JS/declaration/map copies under `src/` have been removed.

| Area | Current behavior |
| --- | --- |
| Documents/includes | Text/position/range models, file-URI/loading helpers, relative/search-root imports and recursive project graph |
| Semantic model | Expressions, scopes, namespace/macro/function/pseudocommand/struct/enum constructs, imports/import-once, segments/PC, conditionals/loops, labels and generated/data metadata |
| Scanner/outline | Scanner facade over semantics; separate Langium structural outline; SIDScore subtune/effect outline |
| Lookup/editor | Cached project/XML analysis and last assembled index; definition/reference queries, HTML hovers, completion, rename, workspace symbols, semantic tokens, folding, formatting and quick fixes |
| Hardware reference | Bundled 6502/C64 I/O XML plus typed machine profiles and machine-filtered I/O/ROM/memory/zero-page facts |
| Build planning | Program/profile/run settings, standalone root detection, affected-program dependencies, output/generated assets, machine overrides and KickAss command rendering |
| Diagnostics | Structural/include diagnostics and KickAss output parsing/range expansion; Theia translates results to markers |
| SIDScore integration | Syntax/outline and generated assembly dependency planning; compilation/player behavior stays in external SIDScore tooling |

The build regenerates Langium TypeScript, compiles to `dist` and copies syntax
and reference assets. Tests run directly against TypeScript with Node type
stripping. Build/package export behavior and editor semantics are separate
verification boundaries; see the
[package README](../packages/language-support/README.md) for commands.

## Reference-only material

Preserved Java source-tree/parser material and `KickAssembler.g4` under
`packages/language-support/reference` inform behavior/parity work. They are
not runtime parser inputs or a Java language server. XML datasets and TextMate
syntax assets are active product inputs and must remain packaged.

## Deferred and external responsibilities

- Shared incremental workspace state and include-graph-precise lookup. Theia
  reuses file discovery and disk text models for up to five seconds with file-event
  invalidation, overlaying current editor text. Unchanged ordered inputs/machine
  reuse index assembly with independent mutable results; changed input still
  triggers full assembly.
- Compiler-accurate KickAss expression/directive edge cases, macro expansion,
  conditional evaluation and generated-symbol materialization.
- Compiler-grade diagnostics, completion/rename/formatting/quick-fix parity,
  broader reference facts and richer presentation.
- Compiler-accurate TypeScript SIDScore language intelligence.

Debug-info parsing and VICE sessions belong to `debug-adapter`, not a future
language-package implementation. Theia/Monaco UI, tasks/preferences and build
execution belong to `theia-extension` and its headless runner. SIDScore runtime
changes must also update the sibling source repository as required by
`AGENTS.md`.

## Assumptions and next step

Structural/tolerant parsing is appropriate for editing while full compiler
parity remains explicitly unfinished. Paths/file URIs replace former workspace
resource objects; framework adapters must not leak their APIs into this package.

The bounded lookup-reuse round covers file discovery, disk models, document
analysis and assembled indexes. Comparison/result copying remains per request;
delta updates and full compiler parity remain unfinished. Align outline, scanner,
semantic and project views before expanding compiler-relevant behavior.
See [language architecture](language-support-architecture.md) and
[the implementation plan](plan.md).

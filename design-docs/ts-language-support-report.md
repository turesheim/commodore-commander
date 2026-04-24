# TypeScript Language-Support Report

## Scope

This document describes the current TypeScript-first language-support slice for
Commodore Commander.

It does not attempt full Kick Assembler parser parity, a Java language server,
or debugging features. Theia UI integration exists separately in
`packages/theia-extension`; this package remains the editor-neutral language
logic layer.

## Ported

The following pieces now exist under `packages/language-support` as TypeScript
runtime code:

- preserved syntax assets in `packages/language-support/syntaxes`
- `TextDocumentModel` plus explicit `DocumentPosition`, `SourceRange`, and
  `SourceLocation`
- file-URI and filesystem document-loading helpers
- include/import resolution scaffolding for `#import` and `#importif`
- recursive project loading that builds a source tree without Eclipse resources
- workspace build planning that derives root assembler programs from the same
  include-tree semantics used by the Eclipse builder
- initial symbol indexing for:
  - label declarations
  - `.const`
  - `.var`
  - data-labelled byte/word/dword blocks
- a TypeScript semantic model for:
  - expression trees with literals, identifiers, unary/binary operators,
    conditionals, calls, members, indexes, and arrays
  - scopes for root, blocks, namespaces, macros, functions, pseudocommands,
    structs, enums, segments, program counters, conditionals, and loops
  - `#import`, `#importif`, and `#importonce`
  - segment definitions/selections and `.pc` blocks
  - conditional assembly structure and loop variables
  - local labels, anonymous/bang labels, generated symbols, enum members,
    parameters, and richer directive records
- a runtime-safe lookup service for definitions/references
- hover-content formatting for reference-driven tooltips
- preserved HTML hover content for reference docs, including embedded `<pre>`,
  `<table>`, and `<svg>`
- editor-neutral feature services for:
  - symbol, directive, include-path, mnemonic, and addressing-mode completion
  - rename preparation and workspace edit planning
  - workspace symbol search
  - semantic highlighting token classification
  - folding ranges
  - document formatting edits
  - quick fixes for supported structural diagnostics and include syntax
- a first Langium-backed structural grammar under `src/langium/`, with
  generated AST/services committed as TypeScript build inputs
- a Langium-backed outline model exported through `src/outline/`
- a KickAssembler compiler-output diagnostic parser for summary lines,
  single-error stack output, and source-token range expansion
- an outline model builder for:
  - `#import`, `#importif`, `#importonce`
  - `.segmentdef`, `.segment`, `.pc`
  - `.namespace`, `.macro`, `.function`, `.struct`, `.enum`,
    `.pseudocommand`
  - `.const`, `.var`, `.label`, and plain labels
- XML reference parsing for:
  - 6502 mnemonics from `reference/6502.xml`
  - C64 I/O addresses and ids from `reference/c64/c64io.xml`
- typed Commodore machine profiles for C64, C128, VIC-20, Plus/4, C16, PET,
  CBM-II, CBM-II 5x0, and C64DTV
- profile-aware reference lookup for machine I/O, ROM, memory-map, and
  zero-page symbols
- bundled reference-asset specs so products can ship those XML datasets outside
  any workspace layout
- a browser-safe `runtime` entrypoint for Theia-facing consumers
- Theia-facing outline exports kept on that browser-safe runtime path
- direct Node-based tests using `--experimental-strip-types`

## Referenced Only

These assets remain valuable, but are no longer on the language-support runtime
path:

- `net.resheim.eclipse.cc.builder.KickAssemblerProjectParser`
- `packages/language-support/reference/java/net/resheim/cc/language/*`
- `packages/language-support/reference/antlr/KickAssembler.g4`
- Java-side `DataLabel` semantics used as a behavior reference
- `net.resheim.eclipse.cc.editor.Mnemonics`
- `net.resheim.eclipse.cc.editor.IOMap`
- `reference/KickAssembler.pdf` as a reference for selecting the first
  project/code-structure constructs to model in the Langium outline pass
- Eclipse `plugin.xml` registration used only to preserve file extensions,
  grammar scope name, and language-configuration wiring intent

## Deferred

The following work is intentionally left for later passes:

- compiler-accurate KickAss parity for every expression/directive edge case
- actual macro/pseudocommand expansion and generated symbol materialization
- evaluation of conditional assembly branches against a configured symbol
  environment
- precise diagnostics beyond missing-include and scanner-structure hints
- compiler-accurate completion, rename, formatting, and quick-fix parity
- broader hover coverage and richer editor presentation
- include-graph-precise and incremental lookup
- debug-metadata parsing and richer canonical diagnostic attribution from
  assembler output
- all debugging and VICE integration

## Still Outside This Package

These areas remain outside `packages/language-support`:

- Eclipse editors and viewer configuration
- Eclipse builders and project natures
- Eclipse launch/source-lookup/debug integration
- PDE/plugin registration as a runtime mechanism
- Theia frontend/backend adaptation in `packages/theia-extension`
- VICE debugging in `packages/debug-adapter`
- SIDScore playback/runtime orchestration

## Assumptions

- A structural Langium parser is acceptable for the current TypeScript pass as
  long as full semantic parity is documented as unfinished.
- Preserving syntax assets is higher priority than speculative semantic
  features.
- Filesystem paths and file URIs are the correct abstraction boundary for this
  stage, not Eclipse workspace resources.

## Next Recommended Pass

1. Add an incremental, backend-neutral index shared by completion, rename,
   references, workspace symbols, hovers, and diagnostics.
2. Align the scanner-based lookup and project loader with the Langium AST so
   outline, navigation, and diagnostics stop diverging on edge cases.
3. Extend the Langium grammar and semantic model toward compiler-relevant
   constructs without introducing Java into the runtime path.
4. Extend the new build planner so frontend/backend integrations can attach
   richer diagnostics, metadata parsing, and configuration without re-reading
   Eclipse classes.

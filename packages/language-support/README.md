# Language Support

`packages/language-support` is the TypeScript-first home for Commodore
Commander language logic.

This package intentionally stays below Theia and below the Eclipse runtime. It
preserves the existing syntax assets, ports the smallest useful document/import/
symbol foundations into TypeScript, and keeps the Java parser work as
reference-only material.

## Contents

- `syntaxes/`
  - TextMate grammars and language configurations for Kick Assembler and
    SIDScore
- `src/document/`
  - text document, line, offset, position, range, and location abstractions
- `src/resolution/`
  - file-URI helpers, filesystem document loading, and include resolution
- `src/parsing/`
  - compatibility scanner for callers that still consume include/symbol/
    diagnostic triples
- `src/semantic/`
  - expression parsing and the richer Kick Assembler semantic model
- `src/lookup/`
  - runtime-safe definition/reference lookup service for project and reference
    symbols
- `src/features/`
  - editor-neutral completion, rename, workspace-symbol, semantic-token,
    folding, formatting, and quick-fix services
- `src/reference/`
  - parsers plus bundled-asset specs for the preserved 6502 and C64 I/O XML
    reference datasets
- `src/machines/`
  - typed Commodore machine profiles for memory, ROM, display, CPU, banking,
    and VICE runtime metadata
- `src/symbols/`
  - symbol shapes and in-memory symbol index scaffolding
- `src/project/`
  - recursive project loading over `#import` / `#importif`
- `src/build/`
  - workspace build planning, project build configuration loading, program and
    profile resolution, standalone program discovery, and KickAss command-line
    rendering
- `src/runtime/`
  - browser-safe entrypoint for document/location/lookup APIs consumed by the
    Theia extension
- `reference/`
  - mixed runtime/reference assets, with XML datasets reused and Java/ANTLR
    material kept for behavior reference

## What This Pass Does

- preserves the existing grammar and language configuration assets
- adds a first SIDScore editor grammar/configuration from the draft language
  specification, without adding compiler semantics to this package
- provides a filesystem-backed `TextDocumentModel`
- introduces explicit `SourceLocation` / `SourceRange` abstractions
- resolves relative includes and optional include search roots
- builds an initial symbol index for labels, `.const`, and `.var`
- carries forward labeled data-block metadata as TypeScript scaffolding
- parses a richer semantic model for expressions, scopes, namespaces, macros,
  functions, pseudocommands, structs, enums, segments, conditionals,
  import-once, local/anonymous labels, generated symbols, parameters, and
  directive records
- adds a runtime-safe lookup service for definitions and references
- adds runtime-safe editor feature services for symbol/directive/include/
  mnemonic/addressing-mode completion, rename edit planning, workspace symbols,
  semantic highlighting tokens, folding ranges, formatting edits, and quick
  fixes
- parses preserved `6502.xml` and `c64io.xml` datasets for mnemonic and C64 I/O
  symbol definitions
- adds first-pass Commodore machine profiles for C64, C128, VIC-20, Plus/4,
  C16, PET, CBM-II, CBM-II 5x0, and C64DTV, including memory maps, I/O
  windows, ROM symbols, zero-page conventions, screen layouts, character-set
  metadata, bank-switching notes, CPU details, aliases, and VICE executable
  metadata
- filters reference lookup by active machine profile, keeping 6502 mnemonics
  shared while limiting C64 I/O XML symbols to C64-compatible profiles and
  adding profile-derived I/O, ROM, memory-map, and zero-page symbols
- exposes package-owned reference asset specs so products can bundle and load
  those datasets independently of the active workspace
- formats mnemonic and C64 I/O reference descriptions for editor hover tooltips
  while preserving embedded HTML such as `<pre>`, `<table>`, and `<svg>`
- resolves Theia/headless build configuration for named programs, build
  profiles, optional run entries, KickAss and Java runtimes, library roots,
  output folders, optional program machine sections, debug/symbol switches,
  generated assets, and custom assembler arguments
- detects standalone workspace `.asm` files that are not included anywhere else
  so they can be assembled or run without being listed in project config

## What This Pass Does Not Do

- run Java in the language-support runtime path
- provide compiler-accurate KickAss parser parity or macro expansion
- provide compiler-accurate completion, rename, formatting, or diagnostic
  fix-all parity
- provide exhaustive per-model reference data
- implement debugging
- provide include-graph-precise or incremental lookup yet
- own Theia UI wiring; that remains in `packages/theia-extension`

## Verification

The tests in `test/*.test.ts` run with Node's built-in type stripping:

```sh
npm test
```

The package also builds with `tsc`:

```sh
npm run build
```

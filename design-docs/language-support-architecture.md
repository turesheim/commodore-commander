# Language-Support Architecture

## Goal

Keep Commodore Commander language support TypeScript-first and framework-light
so Theia integration can consume it without inheriting Eclipse runtime
assumptions.

## Current Package Shape

### `packages/language-support/syntaxes`

Syntax assets:

- `kickassembler.tmLanguage.json`
- `kickassembler.language-configuration.json`
- `sidscore.tmLanguage.json`
- `sidscore.language-configuration.json`

The Kick Assembler assets are reused directly. SIDScore assets are first-pass
editor support derived from `../SIDScore/SIDScore_Language_Specification.md`
in the sibling SIDScore repository. Both languages are exposed through small
language manifests under `src/language/`.

### `packages/language-support/src`

Current runtime layers:

- `document/`
  - text storage plus line/offset conversion
- `location/`
  - document positions, ranges, and locations
- `resolution/`
  - file-URI/path helpers
  - filesystem document loading
  - include resolution with optional search roots
- `parsing/`
  - compatibility scanner for existing project-loading and lookup callers
- `langium/`
  - structural Kick Assembler grammar and generated AST/service inputs used by
    the outline path
- `semantic/`
  - TypeScript semantic model for expressions, scopes, imports, directives,
    segments, conditionals, generated symbols, data blocks, and richer symbol
    kinds
- `outline/`
  - editor-neutral Kick Assembler outline model
- `lookup/`
  - shared runtime-safe definition/reference queries
  - hover content formatting for reference symbols with preserved embedded HTML
- `features/`
  - editor-neutral completion, rename, workspace-symbol, semantic-token,
    folding, formatting, and quick-fix services
- `reference/`
  - XML reference parsing plus bundled asset specs for 6502 mnemonics and C64
    I/O symbols
- `machines/`
  - typed Commodore machine profiles and profile-aware reference facts
- `symbols/`
  - symbol shapes and in-memory index
- `project/`
  - recursive source-tree loading and project-level diagnostics
- `build/`
  - workspace build configuration loading, program/profile/run resolution,
    standalone root detection, and KickAss command-line rendering
- `runtime/`
  - browser-safe exports consumed by `packages/theia-extension`

### `packages/language-support/reference`

Mixed assets:

- runtime reference data:
  - `6502.xml`
  - `c64/c64io.xml`
- reference-only migration material:
  - preserved `KickAssembler.g4`
- Java parser/scaffolding from the earlier extraction

The XML datasets are now reused as runtime lookup inputs and packaged product
assets. The Java and ANTLR files remain reference-only material for later
parity work.

## Data Flow

1. A root source file is loaded as a `TextDocumentModel`.
2. The semantic parser builds a document model for imports, import-once,
   expression trees, scopes, namespaces, macros, functions, pseudocommands,
   structs, enums, segments, conditionals, local/anonymous labels, generated
   symbols, directives, and labelled data blocks.
3. The Langium outline path builds document symbols for structural navigation.
4. The compatibility scanner projects the semantic model back into the legacy
   include/symbol/diagnostic shape.
5. The include resolver maps `#import` / `#importif` to filesystem targets.
6. The project loader walks the include graph recursively.
7. The symbol index accumulates document-level symbol definitions.
8. The lookup service combines project symbols with XML and machine-profile
   reference definitions.
9. The hover formatter turns XML-heavy reference descriptions into preserved
   HTML fragments.
10. Editor feature services consume the semantic model, lookup index, reference
   symbols, and optional include-path candidates to produce framework-neutral
   completions, rename edits, workspace symbols, semantic tokens, folding
   ranges, formatting edits, and quick fixes.
11. The build planner resolves programs, profiles, runs, generated assets, and
    command-line settings from workspace configuration.
12. The Theia extension adapts editor requests onto the runtime-safe lookup API
    and loads bundled reference XML assets from `packages/language-support`
    before rendering reference hover HTML through Theia hover services with DOM
    content.

## Deliberate Constraints

- No `org.eclipse.*` types
- No Java language-support runtime dependency
- No Theia-specific APIs in the package core
- No debug/runtime orchestration in this package
- SIDScore support in this package is editor scaffolding only; compiler/player
  semantics remain out of scope for the TypeScript language-support package.

## Known Gaps

- The semantic model is tolerant and editor-oriented; it is not a full
  KickAss compiler front end.
- Conditional assembly is modelled structurally but not evaluated against a
  configured symbol environment.
- Macro and pseudocommand bodies are marked as generated-symbol scopes, but
  macro expansion is not executed.
- Diagnostics are broader than the old scanner, but still not compiler-grade.
- Completion, rename, semantic tokens, formatting, and quick fixes are
  structural/name-based editor services, not compiler-accurate parity.
- The current lookup pass still crawls the workspace on demand instead of using
  an incremental shared index.
- The build planner models configuration and command rendering, but Theia task
  integration and form-based validation are still outside this package.

## Next Architectural Step

Add an incremental, backend-neutral indexing boundary so editor features can
reuse shared lookup state without rescanning the workspace for each request.

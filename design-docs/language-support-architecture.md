# Language-Support Architecture

## Boundaries and source layout

`packages/language-support` owns framework-neutral TypeScript language logic.
Theia adapts its outputs to Monaco, filesystem services, tasks and product UI.
The package has no Theia/Eclipse runtime dependency; Java is required for
executing KickAss builds, not for editor lookup.

| Area | Responsibility |
| --- | --- |
| `document`, `location`, `resolution` | Text/range models, URI conversion, filesystem loading and include resolution |
| `semantic`, `parsing` | Tolerant semantic model and compatibility projections for existing callers |
| `langium`, `outline` | Retained structural parse API and semantic editor-neutral outline |
| `lookup`, `features`, `symbols` | Cached document analysis/index assembly and editor features |
| `reference`, `machines` | XML assets, hardware facts, profiles and filtered lookup |
| `project`, `build` | Recursive include graph, diagnostics and program/profile/run planning |

Maintained sources are `.ts`. `src/langium/generated/*.ts` is committed generator
output used as compiler input. JavaScript, declaration files and source maps
are build output under ignored `dist/`, not maintained copies under `src/`.
The build also copies `reference/` and `syntaxes/` assets to `dist/`.

The package root includes Node filesystem/build APIs. Its separate `runtime`
export is browser-safe and used by Theia frontend code. Both package exports
resolve to compiled `dist/src` modules; tests import `.ts` sources directly.
This distinction prevents frontend consumers from pulling filesystem/process
integration into their dependency graph.

## Parsing and editor flow

1. A `TextDocumentModel` stores source text and line/offset mappings.
2. The semantic parser models expressions, scopes, imports, namespaces,
   macros/functions/pseudocommands, structs/enums, segments, conditionals,
   local/anonymous labels, generated symbols and labelled data.
3. `scanKickAssemblerDocument` projects that model into the existing
   include/symbol/diagnostic shape. It is a compatibility facade, not a separate
   semantic authority.
4. Kick Assembler outline projects the same semantic declarations and lexical
   scopes, including file namespaces and label blocks. Segment/PC groups remain
   presentation only; anonymous/control scopes are flattened, and imported
   files stay outside the current document outline. Selection ranges match
   semantic declarations; container ranges include their children. The public
   Langium structural parse API remains available for compatibility. SIDScore
   outline scans subtunes/effects.
5. Lookup reads the semantic model directly and collects all declarations before
   binding source tokens to case-sensitive identities through
   `KickAssemblerScopeResolver`. Anonymous blocks/parameters use private
   document/scope keys; named namespaces and label scopes expose qualified
   label members. Constants/variables stay lexical; reopened namespaces share
   their associated lexical scope. Resolution follows parents, with `@`
   selecting root directly; nearer entities shadow qualified paths.
   `.filenamespace` enters an implicit namespace from the directive until EOF
   or its enclosing brace closes; successive directives nest. Each multi-label
   declaration has a private instance key. Direction/distance searches visit
   the nearest scope before parents, then use source order within each scope,
   including same-line labels.
   Scope body ranges end at their closing brace or EOF for unfinished text.
   Project declarations win; the active machine filters hardware references.
   Editor features consume this index/model and return framework-neutral edits,
   ranges, tokens and symbols. Rename changes the leaf identifier while keeping
   prefixes; semantic tokens use the same bindings, and workspace symbols carry
   named containers. Namespace/label-scope owner, multi-label and duplicate
   renames are rejected. Hover formatting preserves reference HTML.

The long-lived lookup service caches project/XML analysis and the last assembled
index. Reuse compares ordered URI/kind/text/language inputs, file boundaries
and active machine, not model versions. Changed inputs trigger fresh assembly
using reusable analysis; absent documents are evicted. A private index snapshot isolates first-build and
cache-hit callers, each receiving independent mutable maps, arrays, occurrences,
locations, address ranges and token bindings. Reference aliases within one
result are preserved.

Theia owns URI access, open-editor overlays, bundled XML and Monaco adapters.
`KickAssemblerWorkspaceLookup` uses the existing `KickAssemblerProjectLoader`
include graph to select configured program closures or inferred roots. Shared
files retain all owners; rename expands the declaration owners before preparing
edits. External libraries are matched against owning workspace programs. Relative
imports precede library roots supplied by a read-only build-configuration RPC.
Workspace symbols remain workspace-wide. Invalid configuration falls back to the
current file/relative imports. Graphs are rebuilt per request; existing discovery,
disk and language-analysis caches still provide bounded reuse.
Its definition links carry the full source-token range; native CTRL/CMD+click
and F12 use the same resolved targets. The language word pattern includes
direction suffixes and anonymous multi-labels. Monaco honors the multicursor preference
by moving click navigation to Alt/Option when CTRL/CMD is reserved for cursors.
`tools/run-language-navigation-ui-e2e.mjs` exercises real modifier-clicks across
external libraries, program boundaries, label scopes and directional labels in
the existing Linux UI CI job. A language test also verifies target addresses with bundled KickAss.
Its `KickAssemblerWorkspaceFiles` shares discovery per root across lookup,
workspace symbols and include completion. Structural file notifications and
completed operations invalidate overlapping roots, including moved directories.
Workspace changes/shutdown clear all caches; an event during discovery forces
pending callers to use a fresh inventory. Complete inventories expire after five
seconds to cover missed/excluded watcher events; filesystem failures are retried
on the next request. `KickAssemblerWorkspaceDocuments` similarly shares disk
reads/text models for five seconds, invalidating files/subtrees on all file
notifications and operation endpoints. Current editor text always wins; files
outside the latest candidate set are released without dropping concurrent reads.
Events during a read refresh its result; failed reads are retried. Without a
notification, disk content can remain stale until the next request after expiry.
Unchanged input reuses assembly; each request still compares inputs and copies
the result. Changed input causes full assembly, not per-document index updates.

## Project and build flow

`KickAssemblerProjectLoader` owns the shared recursive include graph and
diagnostics. `KickAssemblerLanguageSupport` supplies Node filesystem/relative/
search-root adapters for the existing build flow; editor lookup supplies Theia
URI/overlay adapters. Shared-file diagnostics are collected once, including
structural cycle warnings. `#importif` remains conservative without evaluating
conditions.

`expandKickAssemblerSource` projects each ordinary import occurrence into ordered
source lines, respecting `#importonce` and retaining original file/line mappings.
`buildProgramIndex` supplies file boundaries to the semantic parser: every file
starts in global scope, while returning restores the caller's namespace/block.
A child's file namespace cannot capture following caller declarations. Program
identities remain isolated; equivalent physical declarations merge references
across owners, while incompatible or partially unresolved bindings reject rename.
All editor locations refer to original files. The bundled compiler verifies scope
boundaries and directional target addresses. Conditional preprocessing, legacy
imports, missing files, unguarded cycles or projections over 2 MB/100,000 lines
or 256 nested files fall back to document-local analysis for the selected context. This is structural
source expansion, without macro execution or conditional evaluation.
Automatic editor/build discovery uses the browser-safe default directory policy
in `project/kick-assembler-source-discovery.ts`: `.git`, `.metadata`, `.theia`,
`dist`, `node_modules`, `out`, `src-gen` and `target`. Matching directory names
are skipped at every traversal depth. This filters automatic inventory, not
explicit imports or configured program roots. Build detection remains `.asm`-only;
editor inventories retain registered language extensions. Build planning also
honors configuration-specific excluded names/output/library/generated paths;
those additional filters are not yet supplied to the editor inventory.

The build planner identifies standalone assembly roots and resolves programs,
profiles, runs, output/generated assets and command-line settings. SIDScore
module declarations/configuration contribute generated assembly dependencies.
The Theia/headless runner owns process execution and compiler-output markers.

`reference/6502.xml` and `reference/c64/c64io.xml` are active lookup data;
`reference/java` and `reference/antlr` retain migration behavior references.
Syntax assets and language manifests expose Kick Assembler and initial SIDScore
editing support. Compiler/player semantics stay outside the TypeScript SIDScore
outline/syntax slice.

## Remaining work

- Per-document index updates beyond the implemented whole-snapshot reuse.
- Inline block bodies and legacy deferred imports.
  Scope-owner/prefix and multi-label rename, scope-aware completion and
  compiler-grade rename conflict checking.
- Graph snapshot reuse and editor adoption of configuration-specific discovery
  exclusions.
- Compiler-accurate semantics/diagnostics: configured conditional evaluation,
  macro/pseudocommand expansion and generated-symbol materialization.
- Richer editor/reference coverage and build-config/diagnostic attribution.

Keep language logic here, Theia adaptation in `theia-extension`, and DAP/debug
metadata in `debug-adapter`. The [status report](ts-language-support-report.md)
distinguishes implemented behavior from deferred work; [the plan](plan.md)
tracks priorities.

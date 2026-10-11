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
| `langium`, `outline` | Structural grammar/AST and editor-neutral outline models |
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
4. The Langium structural parser produces the Kick Assembler outline through
   its own path. SIDScore outline scans subtunes/effects. Aligning these paths
   with richer semantic lookup remains work.
5. Lookup combines project declarations/references with XML and machine facts.
   Project declarations win; the active machine filters hardware references.
   Editor features consume this index/model and return framework-neutral edits,
   ranges, tokens and symbols. Hover formatting preserves reference HTML.

The long-lived lookup service caches project/XML analysis and the last assembled
index. Reuse compares ordered URI/kind/text/language inputs and active machine,
not model versions. Changed inputs trigger fresh assembly using reusable analysis;
absent documents are evicted. A private index snapshot isolates first-build and
cache-hit callers, each receiving independent mutable maps, arrays, occurrences,
locations and address ranges. Reference aliases within one result are preserved.

Theia owns file selection, open-editor overlays, bundled XML and Monaco adapters.
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

The Node project loader resolves `#import`/`#importif` using source-relative or
configured search roots and builds a source graph, symbol index and diagnostics.
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
- Include-graph-precise lookup and consistency between outline and semantic paths.
- Compiler-accurate semantics/diagnostics: configured conditional evaluation,
  macro/pseudocommand expansion and generated-symbol materialization.
- Richer editor/reference coverage and build-config/diagnostic attribution.

Keep language logic here, Theia adaptation in `theia-extension`, and DAP/debug
metadata in `debug-adapter`. The [status report](ts-language-support-report.md)
distinguishes implemented behavior from deferred work; [the plan](plan.md)
tracks priorities.

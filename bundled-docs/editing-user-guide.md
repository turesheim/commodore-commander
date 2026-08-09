# Editing User Guide

This guide covers source editing for Kick Assembler projects in Commodore
Commander. Character sets, screens, sprites, SIDScore, and debugging have their
own guides.

## Open A Source File

Open a Kick Assembler source file from the workspace. Commodore Commander
assigns the Kick Assembler language mode to recognized assembler files and
scans the workspace for symbols, imports, and bundled reference entries.

The workspace scan skips tool folders such as `.git`, `.metadata`, `.theia`,
`node_modules`, and `target` so lookup results stay focused on project source
files.

Use the Active Machine selector in the right toolbar when you want reference
features to follow a specific Commodore profile. This affects machine-specific
reference symbols such as C64 I/O addresses.

## Completion

Use **Ctrl+Space** to request completion. Completion also appears while typing
common Kick Assembler triggers such as `.`, `#`, quoted import paths, path
separators, and 6502 mnemonic operands.

The editor can suggest:

- Kick Assembler directives and preprocessor directives
- labels, constants, variables, namespaces, macros, functions, structs, enums,
  and segments found in the workspace
- include paths from the current directory and other workspace source files
- 6502 mnemonics
- addressing-mode snippets such as `#$00`, `$0000,x`, and `($00),y`

Mnemonic completions use the bundled 6502 reference. When available, the
completion detail includes mnemonic descriptions, affected flags, legal
addressing modes, example syntax, and opcode values.

## Reference Help

Hover over a known 6502 mnemonic or machine reference symbol to see inline
documentation. Mnemonic hovers include opcode tables and diagrams when the
bundled reference provides them.

Use Cmd-click on macOS, Ctrl-click on Windows or Linux, or the editor context
menu's **Go to Definition** action to jump to a project declaration or bundled
reference entry.

Use **Find References** to list project uses of labels and symbols. Known 6502
mnemonics and machine reference symbols also report reference occurrences from
the current workspace scan.

Use workspace symbols when you need to jump by name across the project. The
symbol list includes labels, constants, variables, namespaces, macros,
functions, structs, enums, segments, and generated structural symbols.

## Rename

Use **Rename Symbol** on supported project symbols to update the current
workspace scan. Rename is intended for source symbols and intentionally avoids
rewriting text inside comments or string literals.

After a large rename, save the affected files and check the build output. The
rename engine is conservative, but assembler projects often use generated names,
string-based references, or macro conventions that deserve a build pass.

## Source Structure

The outline view shows labels, declarations, namespaces, macros, functions,
structs, enums, segments, and related structural symbols for the active source
file.

Folding groups namespaces, macros, functions, structs, enums, conditional
blocks, block comments, and runs of imports.

Document formatting normalizes indentation inside blocks and spacing around
common declarations while preserving source order and comments.

Quick fixes currently focus on structural source repairs, such as converting an
unquoted import path to canonical `#import "..."` form.

Semantic highlighting distinguishes source symbols, directives, mnemonics,
numbers, strings, comments, and known reference entries when the editor theme
uses semantic colors.

## Build Feedback While Editing

Saving a workspace `.asm` file triggers the Kick Assembler build service for the
active workspace build profile. Build output appears in the Kick Assembler
console, and compiler diagnostics are applied to the Problems view and source
editor.

The status bar shows the active build profile for the current Kick Assembler
source. Select it to choose another profile or create a new one. See
[Build Configuration](build-configuration.md) for workspace build files,
profiles, named programs, generated assets, and headless build use.

Use **F5** or **Ctrl+F5** from an active assembler source to create or reuse a
matching launch configuration and start the program through Theia's debug
session manager. See [Debugger User Guide](debugger-user-guide.md) for runtime
and breakpoint workflows.

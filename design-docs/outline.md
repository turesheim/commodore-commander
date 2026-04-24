# Outline Icons

This document is the icon specification for Commodore Commander outline entries.
The outline should continue to use Monaco document symbols. Do not introduce a
custom outline tree renderer just to choose icons.

## Icon Source

The language-support package owns the semantic outline kinds. The Theia
extension maps those kinds to Monaco `SymbolKind` values in
`packages/theia-extension/src/browser/kick-assembler-outline-contribution.ts`.

Theia renders outline icons from the Monaco symbol kind as Codicons:

```text
monaco.languages.SymbolKind.File -> codicon-symbol-file
monaco.languages.SymbolKind.Function -> codicon-symbol-function
```

The `Icon SVG` column below links to local SVG previews in `docs/icons/outline`.
These SVGs are selected from `@vscode/codicons` and are included for
documentation because the Codicons private-use Unicode glyphs do not render
reliably outside the workbench.

Use the `net.resheim.eclipse.cc.ui` PNG icons for file, editor, view, product,
and debug UI where they fit. Per-symbol outline entries should use Monaco
`SymbolKind` values.

## File And Folder Icons

Use plain Codicon file and folder icons for generic path-like entries. Kick
Assembler source files use the branded file icon asset because they represent
the primary source format handled by Commodore Commander.

| Entry type | State | Codicon name | Icon SVG | Icon class |
| --- | --- | --- | --- | --- |
| File | Any | `file` | [![file](../docs/icons/outline/file.svg)](../docs/icons/outline/file.svg) | `codicon-file` |
| Kick Assembler file (`.asm`, `.inc`, `.s`, `.a`, `.lib`, `.kick`, `.ka`, `.src`) | Any | Branded file icon | [![Kick Assembler file](../packages/theia-extension/assets/icons/asm_file_obj.svg)](../packages/theia-extension/assets/icons/asm_file_obj.svg) | `cc-kickassembler-file-icon` |
| Folder | Collapsed | `folder` | [![folder](../docs/icons/outline/folder.svg)](../docs/icons/outline/folder.svg) | `codicon-folder` |
| Folder | Expanded | `folder-opened` | [![folder-opened](../docs/icons/outline/folder-opened.svg)](../docs/icons/outline/folder-opened.svg) | `codicon-folder-opened` |

Use `folder-opened`, not the misspelled `Ffoler-opened`.

The current Theia code registers the branded Kick Assembler file icon through
`packages/theia-extension/src/browser/kick-assembler-file-associations.ts`.
There is no dedicated explorer-icon contribution file at this stage.

For Monaco document-symbol outline entries that represent files, use
`SymbolKind.File`. The current Theia outline provider lives in
`packages/theia-extension/src/browser/kick-assembler-outline-contribution.ts`
and renders as `codicon-symbol-file`, because Theia derives outline icon
classes from Monaco symbol kinds. If a future outline path supports direct
Codicon names, use `codicon-file` for file entries and
`codicon-folder`/`codicon-folder-opened` for folder entries.

## Construct Mapping

| Code construct | Outline kind | Monaco `SymbolKind` | Icon SVG | Rendered icon class | Rationale |
| --- | --- | --- | --- | --- | --- |
| Source import, include, or import-once directive (`#import`, `#importif`, `#importonce`) | `import` | `File` | [![symbol-file](../docs/icons/outline/symbol-file.svg)](../docs/icons/outline/symbol-file.svg) | `codicon-symbol-file` | Imports point at another source file or source dependency. This is the Monaco outline rendering of the plain `file` rule above. |
| Segment definition (`.segmentdef`) | `segment-definition` | `Class` | [![symbol-class](../docs/icons/outline/symbol-class.svg)](../docs/icons/outline/symbol-class.svg) | `codicon-symbol-class` | A segment definition describes a named structural definition used by later segment entries. |
| Active segment selection (`.segment`) | `segment` | `Module` | [![symbol-module](../docs/icons/outline/symbol-module.svg)](../docs/icons/outline/symbol-module.svg) | `codicon-symbol-module` | A segment groups following declarations and labels into a logical output area. |
| Program counter placement or block (`.pc`) | `program-counter` | `Number` | [![symbol-number](../docs/icons/outline/symbol-number.svg)](../docs/icons/outline/symbol-number.svg) | `codicon-symbol-number` | Program-counter entries are address-oriented and should stand apart from namespace-like groups. |
| Namespace block (`.namespace`) | `namespace` | `Namespace` | [![symbol-namespace](../docs/icons/outline/symbol-namespace.svg)](../docs/icons/outline/symbol-namespace.svg) | `codicon-symbol-namespace` | This is the direct Monaco equivalent. |
| Macro block (`.macro`) | `macro` | `Method` | [![symbol-method](../docs/icons/outline/symbol-method.svg)](../docs/icons/outline/symbol-method.svg) | `codicon-symbol-method` | Macros are callable assembler templates, but should remain visually distinct from Kick Assembler functions. |
| Function block (`.function`) | `function` | `Function` | [![symbol-function](../docs/icons/outline/symbol-function.svg)](../docs/icons/outline/symbol-function.svg) | `codicon-symbol-function` | This is the direct Monaco equivalent for a callable function. |
| Struct block (`.struct`) | `struct` | `Struct` | [![symbol-struct](../docs/icons/outline/symbol-struct.svg)](../docs/icons/outline/symbol-struct.svg) | `codicon-symbol-struct` | This is the direct Monaco equivalent. |
| Enum block (`.enum`) | `enum` | `Enum` | [![symbol-enum](../docs/icons/outline/symbol-enum.svg)](../docs/icons/outline/symbol-enum.svg) | `codicon-symbol-enum` | This is the direct Monaco equivalent. |
| Pseudocommand block (`.pseudocommand`) | `pseudocommand` | `Operator` | [![symbol-operator](../docs/icons/outline/symbol-operator.svg)](../docs/icons/outline/symbol-operator.svg) | `codicon-symbol-operator` | Pseudocommands behave like instruction-like custom operations rather than ordinary functions. |
| Constant directive (`.const`) | `constant` | `Constant` | [![symbol-constant](../docs/icons/outline/symbol-constant.svg)](../docs/icons/outline/symbol-constant.svg) | `codicon-symbol-constant` | This is the direct Monaco equivalent. |
| Variable directive (`.var`) | `variable` | `Variable` | [![symbol-variable](../docs/icons/outline/symbol-variable.svg)](../docs/icons/outline/symbol-variable.svg) | `codicon-symbol-variable` | This is the direct Monaco equivalent. |
| Label directive or source label (`.label`, `Name:`, `!:`) | `label` | `Field` | [![symbol-field](../docs/icons/outline/symbol-field.svg)](../docs/icons/outline/symbol-field.svg) | `codicon-symbol-field` | Labels name addressable positions or values in the assembled output. `Field` is a better fit than `Key`. |

The local SVG files are documentation previews only. The runtime still uses the
Codicon CSS classes shown in the table.

## Rules For Future Outline Work

- Add new outline constructs to this document before wiring their Theia icon
  mapping.
- Keep construct detection and tree shape in `packages/language-support`.
- Keep Monaco/Theia `SymbolKind` conversion in `packages/theia-extension`.
- Prefer one-word Monaco `SymbolKind` names in the current Theia outline path,
  because Theia derives the Codicon class from the lower-cased enum name.
- Avoid mapping unrelated constructs to the same symbol kind unless the visual
  grouping is intentional.
- Generic blocks, blank lines, and unrecognized lines should not receive their
  own outline icon unless they become explicit outline constructs.

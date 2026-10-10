# Outline Icon SVGs

These SVG files preserve Codicon previews for the Commodore Commander outline.
The Theia outline integration lives in
`packages/theia-extension/src/browser/kick-assembler-outline-contribution.ts`.

They are copied from `@vscode/codicons` 0.0.45, which is licensed under
CC-BY-4.0. See `LICENSE-CODICONS.txt` in this directory.

Some Codicon CSS classes share the same glyph but do not have separate source
SVG files in the package. Those aliases are copied under the class-specific
filename in this directory:

- `symbol-module.svg` uses the `symbol-namespace` glyph.
- `symbol-function.svg` uses the `symbol-method` glyph.
- `symbol-number.svg` uses the `symbol-numeric` glyph.
- `symbol-struct.svg` uses the `symbol-structure` glyph.

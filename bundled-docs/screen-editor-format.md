# Screen Editor Format

Commodore Commander screens are saved as `.screen` JSON files. The format is
intended for PETSCII-style screen artwork and stores the screen codes, color
RAM values, global VIC-II colors, and the character set needed to render the
screen.

## Structure

```json
{
  "format": "commodore-commander.screen",
  "version": 1,
  "metadata": {
    "machine": "c64"
  },
  "geometry": {
    "columns": 40,
    "rows": 25,
    "characterWidth": 8,
    "characterHeight": 8,
    "characterOrder": "screen-code"
  },
  "colorMode": "hires",
  "colors": {
    "border": 14,
    "background": 6,
    "foreground": 1,
    "multicolor1": 14,
    "multicolor2": 2
  },
  "characterSet": {
    "name": "C64 Lowercase Uppercase",
    "glyphs": [
      "0000000000000000"
    ]
  },
  "target": {
    "screenAddress": 1024,
    "colorAddress": 55296,
    "characterDataAddress": 8192
  },
  "cells": [
    {
      "character": 32,
      "color": 1
    }
  ]
}
```

The editor derives the screen name from the `.screen` filename. Legacy or
hand-written files with `metadata.name` still load, but the field is not
written when saving.

## Screen Data

`geometry.columns` and `geometry.rows` describe the visible screen grid. New C64
screens default to 40 columns by 25 rows, but the format supports 1-160 columns
and 1-100 rows for tooling and non-standard layouts.

`cells` is always normalized to `columns * rows` entries. Each cell has:

- `character`: a C64 screen code from 0-255.
- `color`: a color RAM nibble from 0-15.

The editor renders cells in row-major order.

## Character Sets

`characterSet.glyphs` embeds a full 256-character, screen-code ordered character
set. Each glyph uses the same 16-digit hexadecimal row format as `.charset`
files: 8 bytes per character, bit 7 leftmost.

The screen editor can start from the bundled blank, C64 upper/graphics, C64
lower/upper, or PET lower/upper character sets. It can also replace the
embedded character set with an existing `.charset` file.

The embedded character set is editable from the screen editor. Pixel edits,
flips, shifts, clears, and inversions update `characterSet.glyphs` directly, so
screen artwork and custom glyphs stay in the same `.screen` file.

## Machine Targets

The `target` block stores the editor's intended runtime placement:

- `screenAddress`: CPU-visible screen RAM address for screen-code transfers.
- `colorAddress`: color RAM address for color-code transfers.
- `characterDataAddress`: CPU-visible character-set byte address.

The editor defaults to `$0400` screen RAM, `$d800` color RAM, and `$2000`
character data. Target fields accept numeric addresses; VICE transfers also
accept labels that resolve in the active debug session.

## VICE Round-trip

The screen editor can read from and write to the active stopped
`commodore-vice` debug session through DAP `readMemory` and `writeMemory`.

- Screen + color scope transfers screen codes and color RAM.
- Screen RAM and Color RAM scopes transfer those byte ranges independently.
- Character set scope transfers the embedded 2048-byte character set.
- VIC colors scope transfers `$d020-$d023` for border, background, and
  multicolor registers.
- All screen data transfers screen codes, color RAM, character set bytes, and
  VIC colors.

## Import

`.seq` imports are interpreted as PETSCII control streams. Printable PETSCII
bytes are converted to screen-code cells from the top-left cell forward. The
importer also applies C64 text color controls, reverse on/off controls, clear
screen, home, return, cursor movement, and the C64 upper/graphics versus
lower/upper character-set controls.

The imported stream replaces the screen contents. Missing trailing cells are
padded with screen code 32.

## Color Modes

`hires` interprets each character row byte as eight one-bit pixels. A set bit
uses the cell color; a cleared bit uses the global background color.

`multicolor` interprets each row byte as four two-bit pixels:

```text
00 background
01 multicolor1
10 multicolor2
11 cell color
```

The color mode affects rendering and exports that consume the embedded glyphs.
The screen-code and color RAM byte exports are unchanged.

## Conversion

The editor can export:

- `.scr` screen-code bytes in row-major order.
- `.col` color RAM bytes in row-major order.
- KickAssembler `.asm` with separate character-code and color-code labels.

For standard C64 screens, `.scr` and `.col` exports are 1000 bytes each.

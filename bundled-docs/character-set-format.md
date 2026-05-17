# Character Set Format

Commodore Commander character sets are saved as `.charset` JSON files.
The format is intended to be stable, readable, easy to version-control, and
straightforward to convert with scripts.

## Structure

```json
{
  "format": "commodore-commander.charset",
  "version": 1,
  "metadata": {
    "machine": "c64"
  },
  "geometry": {
    "glyphWidth": 8,
    "glyphHeight": 8,
    "glyphCount": 256,
    "bytesPerGlyph": 8,
    "bitOrder": "msb-left",
    "byteOrder": "row-major",
    "characterOrder": "screen-code"
  },
  "colorMode": "hires",
  "colors": {
    "background": 0,
    "foreground": 1,
    "multicolor1": 2,
    "multicolor2": 5
  },
  "target": {
    "characterDataAddress": 8192
  },
  "glyphs": [
    "0000000000000000"
  ]
}
```

The editor derives the character set name from the `.charset` filename.
Legacy files with `metadata.name` still load, but the field is not written when
saving.

`glyphs` is always a 256-entry array. Each entry is 16 hexadecimal digits:
8 bytes, one byte per row, top-to-bottom. Within a row, bit 7 is the leftmost
pixel and bit 0 is the rightmost pixel. This matches the C64 hardware layout:
a full 256-character set is 256 * 8 bytes, or 2048 bytes.

## Color Modes

`hires` interprets each row byte as eight one-bit pixels.

`multicolor` interprets each row byte as four two-bit pixels. The bit-pair
values map to:

```text
00 background
01 multicolor1
10 multicolor2
11 foreground
```

The color fields are editor metadata. The raw character-set bytes remain the
same in both modes.

## Starting Templates

`File > New > Character Set` lets you choose one of these starting points:

- Blank: an empty 256-character set.
- C64 lowercase/uppercase: the lower/upper half of the bundled C64 character
  ROM.
- PET lowercase/uppercase: the lower/upper half of the bundled PET character
  ROM, expanded with inverse glyphs for screen codes 128-255.

## Conversion

The editor can export:

- `.64c` raw character bytes: exactly 2048 bytes in screen-code order.
- KickAssembler `.asm`: one label with 256 `.byte` rows.

Raw `.64c`, `.bin`, and `.chr` imports may include a two-byte C64 load address
before the character bytes, such as `$3800`. The importer skips that address
when it is present so the first glyph still begins on row 0.

The JSON format also converts directly to other common formats by reading the
`glyphs` array and writing each pair of hex digits as one byte.

## Machine Targets

The `target` block stores the editor's intended runtime placement:

- `characterDataAddress`: CPU-visible address for the first character byte.

The editor defaults to `$2000`. The target field accepts numeric addresses;
VICE transfers also accept labels that resolve in the active debug session.

## VICE Round-trip

The character set editor can read from and write to the active stopped
`commodore-vice` debug session through DAP `readMemory` and `writeMemory`.

- Selected-glyph scope transfers the selected 8-byte glyph at
  `characterDataAddress + glyphIndex * 8`.
- Full-character-set scope transfers all 2048 bytes starting at
  `characterDataAddress`.

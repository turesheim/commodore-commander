# Sprite Editor Format

Commodore Commander sprites are saved as `.sprite` JSON files. The format is
intended for C64, C128, and C64DTV VIC-II style hardware sprites while still
being usable as a portable 64-byte sprite asset for custom 8-bit Commodore
pipelines.

## Structure

```json
{
  "format": "commodore-commander.sprite",
  "version": 1,
  "metadata": {
    "machine": "c64"
  },
  "geometry": {
    "width": 24,
    "height": 21,
    "multicolorWidth": 12,
    "bytesPerRow": 3,
    "dataBytes": 63,
    "slotBytes": 64,
    "bitOrder": "msb-left",
    "byteOrder": "row-major",
    "hardware": "vic-ii-sprite"
  },
  "colorMode": "hires",
  "colors": {
    "background": 6,
    "foreground": 1,
    "multicolor1": 14,
    "multicolor2": 2
  },
  "data": "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
  "frames": [
    {
      "name": "Frame 1",
      "durationMs": 120,
      "data": "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
    }
  ],
  "animation": {
    "playback": "loop",
    "defaultFrameDurationMs": 120
  },
  "target": {
    "spriteDataAddress": 8192,
    "spritePointerIndex": 0,
    "screenAddress": 1024,
    "vicBank": 0,
    "c128VicMode": "c64-compatible",
    "c64dtvExtendedPalette": false
  }
}
```

The editor derives the sprite name from the `.sprite` filename. Legacy or
hand-written files with `metadata.name` still load, but the field is not
written when saving.

## Sprite Data

`frames` stores one or more animation frames. Each frame has a display name,
duration in milliseconds, and a 128-character hexadecimal `data` string
containing one complete 64-byte sprite slot.

The top-level `data` field mirrors the first frame for compatibility with early
single-sprite files. New editor behavior uses `frames`.

The first 63 bytes of each frame are the visible 24 by 21 sprite bitmap in
row-major order. Each row contains three bytes, and bit 7 is the leftmost pixel
of each byte.

The final byte is preserved as the unused byte in the C64/C128 64-byte sprite
slot. Commodore hardware ignores it for sprite pixels, but preserving it keeps
round-trips lossless for asset pipelines that store metadata there.

## Color Modes

`hires` interprets each row as 24 one-bit pixels:

```text
0 transparent/backdrop preview
1 sprite color
```

`multicolor` interprets each row as 12 two-bit wide pixels:

```text
00 transparent/backdrop preview
01 sprite multicolor 0 ($D025)
10 sprite color ($D027-$D02E)
11 sprite multicolor 1 ($D026)
```

The stored bitmap bytes are identical in both modes. The color mode controls
editing, preview rendering, and generated assembler comments.

## Import

`.spr` and `.bin` imports read one or more sprites from the selected file. The
importer accepts raw 63-byte data, raw 64-byte sprite slots, repeated sprite
slots, and the same data with a two-byte C64 load address prefix. Missing unused
slot bytes are padded with zero.

KickAssembler imports read literal `.byte`, `.by`, or `.bytes` data from a
symbol label. The importer accepts hexadecimal (`$ff` or `0xff`), binary
(`%11111111`), and decimal byte literals. Expressions are intentionally ignored
so that the imported bytes are deterministic.

## Conversion

The editor can export:

- `.spr` raw 64-byte sprite slot data. Multi-frame sheets are exported as
  consecutive 64-byte slots.
- KickAssembler `.asm` with labels for the sprite sheet, optional frame labels,
  21 rows of three `.byte` values per frame, and each unused slot byte.

The exported raw data can be copied directly into a VIC-II sprite page. In a C64
program, the sprite pointer value is the sprite data address divided by 64
within the active VIC bank.

## Animation

Frame durations are editor metadata for previewing and asset-pipeline export.
They do not change the raw sprite bytes. The editor can play a sheet with
`once`, `loop`, or `ping-pong` semantics.

## VICE Round-trip

The sprite editor can read from and write to the active stopped
`commodore-vice` debug session through DAP `readMemory` and `writeMemory`.

- Selected-frame scope transfers one 64-byte sprite slot.
- Sheet scope transfers all frames as consecutive 64-byte slots.
- Pointer writes store the computed sprite pointer byte at
  `screenAddress + $03f8 + spritePointerIndex`.

The memory address field accepts numeric addresses or labels resolvable by the
active debug session.

## Machine Targets

The `target` block stores the editor's intended runtime placement:

- `spriteDataAddress`: CPU-visible address for read/write memory transfers.
- `spritePointerIndex`: hardware sprite number 0-7.
- `screenAddress`: screen RAM base used for sprite pointer writes.
- `vicBank`: VIC bank 0-3 used to compute the pointer byte.
- `c128VicMode`: records that C128 output targets the 40-column VIC-IIe path.
- `c64dtvExtendedPalette`: records C64DTV extended-palette intent while keeping
  the bitmap bytes VIC-II compatible.

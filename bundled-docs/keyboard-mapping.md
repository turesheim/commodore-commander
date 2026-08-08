# Embedded Emulator Keyboard Mapping

Commodore Commander maps embedded emulator typing from the character your Mac
keyboard produces, not from the physical Commodore key position.

The virtual keyboard overlay is selected from the active machine profile. It is
currently supporting: C64, C64DTV, C128, VIC-20, Plus/4, C16, PET, CBM-II, and
CBM 5x0 profiles all expose a Commodore keyboard layout. Some of the detailed
translation rules below are C64-family specific because VICE exposes compatible
SDL/key-matrix behavior for those machines.

This matters on non-US layouts. On a Nordic ISO Mac keyboard, for example,
Shift+0 produces `=`, so the embedded emulator receives the Commodore `=` key.
Pressing plain `0` receives Commodore `0`.

## How Typing Is Interpreted

The embedded view receives browser keyboard events from Theia. For printable
input, Commodore Commander uses the visible `key` value from the active Mac
keyboard layout and translates that symbol to the closest key available on the
target Commodore keyboard.

Users do not need to know or press Commodore Shift for normal symbols. Mac
Shift is treated as a host-side way to produce characters. When the requested
Commodore symbol requires Shift on the active machine keyboard, Commodore
Commander synthesizes that emulated Shift internally for that single key press
where the embedded VICE key path can represent it.

Left Option/Alt is mapped to the Commodore `C=` key when the embedded emulator
has focus. Right Option remains host-only, so it can still be used for normal
Mac keyboard-layout symbols where the browser reports it separately.

For example:

- Pressing Shift+2 on a Nordic Mac keyboard produces `"`. Commodore Commander
  sends the Commodore key combination that creates `"`.
- Pressing Shift+7 on a Nordic Mac keyboard produces `/`. Commodore Commander
  sends the Commodore `/` key, not a shifted `?` key.
- Pressing Shift+, on a Nordic Mac keyboard produces `;`. Commodore Commander
  sends the Commodore `;` key, not a shifted `]` key.

Standalone host Shift and Right Option key presses are ignored by the text-entry
mapping so they do not latch or confuse the emulated Commodore keyboard. Left
Option is the explicit Commodore modifier.

## PETSCII

Commodore computers do not use ASCII internally. The emulated KERNAL and
screen editor interpret keyboard state and then produce PETSCII characters.

Commodore Commander therefore does not send PETSCII bytes directly when you
type in the embedded emulator. It sends keyboard state to VICE, and the
emulated machine produces PETSCII from that state. This keeps normal BASIC,
screen-editor behavior, cursor controls, and shifted Commodore symbols working
like keyboard input rather than pasted text.

## Common Nordic ISO Mac Cases

The following C64-family mappings are handled explicitly for the embedded VICE
keyboard path:

| Mac-produced character | Commodore result | Notes |
| --- | --- | --- |
| `0` | `0` | Plain digit stays a digit. |
| `=` | `=` | Nordic Mac Shift+0. |
| `!` | `!` | Synthesizes C64 Shift internally. |
| `"` | `"` | Nordic Mac Shift+2; synthesizes C64 Shift internally. |
| `#` | `#` | Synthesizes C64 Shift internally. |
| `$` | `$` | Synthesizes C64 Shift internally. |
| `¤` | `$` | Nordic Mac Shift+4; closest available C64 symbol. |
| `%` | `%` | Synthesizes C64 Shift internally. |
| `&` | `&` | Synthesizes C64 Shift internally. |
| `/` | `/` | Nordic Mac Shift+7. |
| `(` | `(` | Synthesizes C64 Shift internally. |
| `)` | `)` | Synthesizes C64 Shift internally. |
| `;` | `;` | Nordic Mac Shift+,. |
| `<` | `<` | Uses C64 matrix mapping. |
| `>` | `>` | Uses C64 matrix mapping. |
| `?` | `?` | Uses C64 matrix mapping. |
| `^` or `↑` | C64 up-arrow | The C64 up-arrow is a separate key, not ASCII caret. |
| `π` | C64 pi | Uses the C64 shifted up-arrow key. |

If the browser reports a shifted number-row key as the unshifted digit instead
of the visible symbol, Commodore Commander applies the same Nordic fallback for
the known shifted positions.

## Producing Pi And Up-Arrow On macOS

The pi and up-arrow symbols used by Commodore keyboards are not printed on
modern Mac keycaps, but they can still be entered from macOS:

- `π`: On most Apple keyboard layouts, press Right Option+P if your keyboard
  has a separate right Option key. Left Option is reserved for Commodore `C=`
  while the emulator has focus. If your active layout does not produce pi this
  way, use the virtual keyboard or the Character Viewer with
  Control+Command+Space and search for `pi`.
- Up-arrow: Type the character `^` and Commodore Commander maps it to the
  Commodore up-arrow key. On Nordic ISO Mac layouts, `^` is commonly a dead
  accent: press the caret/dead-circumflex key, then press Space to commit a
  plain `^`.
- `↑`: Commodore Commander also accepts the real Unicode up-arrow. Use the
  Character Viewer with Control+Command+Space and search for `up arrow`, or
  enable the macOS Unicode Hex Input source and hold Option while typing `2191`.

With the Unicode Hex Input source, `03C0` produces `π` and `2191` produces
`↑`. You only need this input source if your normal layout does not have a
convenient shortcut for the symbol.

## Function Keys

Mac F1-F8 map to the active Commodore profile's function keys in the embedded
emulator where that profile exposes those functions. The C64-family keyboard
has four physical function keys, with the even-numbered functions produced by
shifting the same key. Commodore Commander handles that internally:

| Mac key | Commodore result | Notes |
| --- | --- | --- |
| F1 | F1 | Physical C64 F1 key. |
| F2 | F2 | Shifted C64 F1 key. |
| F3 | F3 | Physical C64 F3 key. |
| F4 | F4 | Shifted C64 F3 key. |
| F5 | F5 | Physical C64 F5 key. |
| F6 | F6 | Shifted C64 F5 key. |
| F7 | F7 | Physical C64 F7 key. |
| F8 | F8 | Shifted C64 F7 key. |

When the embedded emulator has focus, unmodified F1-F8 are captured before
Theia keybindings and sent directly to the emulated machine. Modifier
combinations such as Cmd+F1 or Ctrl+F1 remain available to the IDE.

On many Macs, the top-row keys control brightness, volume, or other system
features by default. If pressing F1-F8 does not reach the emulator, hold the
Fn or Globe key while pressing F1-F8, or enable the macOS setting that uses
F1, F2, and so on as standard function keys.

F9-F12 are not Commodore function keys. In the Machine view, F11 toggles a
compact virtual keyboard overlay for the active machine profile, and F12 opens
the VICE menu.

Both shortcuts are configurable in settings:

| Setting | Default | Purpose |
| --- | --- | --- |
| `commodoreCommander.emulator.virtualKeyboardShortcut` | `F11` | Toggle the virtual keyboard overlay. |
| `commodoreCommander.emulator.viceMenuShortcut` | `F12` | Open the embedded VICE menu. |

Shortcut values use a simple key-combination format such as `F11`, `F12`,
`Ctrl+K`, `Option+K`, `Shift+F11`, or `Cmd+K`. The virtual keyboard shortcut
applies whenever an embedded emulator is running. The VICE menu shortcut
applies when the embedded emulator has focus or mouse capture is active.

When the virtual keyboard is visible, physical typing highlights the key in the
active Commodore profile that is actually being driven. Mouse clicks on virtual
keys send the same normalized keyboard events to the emulator. Click `SHIFT`,
`CTRL`, or the Commodore logo key to latch that modifier for the next mouse key
press. Holding a physical Shift, Control, or Left Option key previews the same
layer. Drag the top edge of the virtual keyboard to move it out of the way.

The virtual keycap shows the symbol or action that will be sent for the active
layer and hides the normal key label while the layer is active. The C64-family
layout includes Shift graphics, Commodore/PETSCII graphics, CTRL color
controls, Commodore extended colors, and reverse-video controls. Graphic
keycaps are rendered from the bundled C64 uppercase/graphics character ROM as
SVG paths, so they match the C64 screen glyphs instead of relying on approximate
Unicode characters. Other machine profiles use their own visible keyboard
layouts and can grow more machine-specific PETSCII detail independently.

The C64 `CTRL` layer follows PETSCII control codes. This means some labels are
effects rather than letters: `CTRL+E` selects white text, `CTRL+S` sends HOME,
`CTRL+N` switches to the lower/uppercase character set, and `CTRL+H`/`CTRL+I`
disable or enable the Shift+Commodore character-set toggle. Other control
combinations are shown as `^A`, `^B`, and so on when they have no common
screen-editor label.

## Editing And Cursor Keys

Backspace, Delete, Insert, and cursor keys are mapped through the active
Commodore profile. On C64-family profiles, Backspace and Delete both map to the
C64 delete key, Insert maps to shifted C64 delete, and cursor keys map to the
C64 cursor keys:

| Mac key | Commodore result |
| --- | --- |
| Backspace | Delete |
| Delete | Delete |
| Insert | Insert |
| Right Arrow | Cursor right |
| Left Arrow | Cursor left |
| Down Arrow | Cursor down |
| Up Arrow | Cursor up |

The C64 only has physical cursor-right and cursor-down keys. Cursor-left and
cursor-up are produced by synthesizing the required emulated Shift internally.

## Unsupported Characters

If the active Mac layout produces a printable character that is not available
on the target Commodore keyboard, Commodore Commander suppresses it instead of
falling back to physical key position. This avoids cases where a visible host
character unexpectedly turns into an unrelated Commodore symbol.

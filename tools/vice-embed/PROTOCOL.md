# Commodore Commander VICE Embed Protocol

The patched VICE process uses two transport records:

- `CCV1 ` newline-delimited JSON on stdout for status and compatibility
  events, and on the command input stream for control.
- `CCB1` binary frame records for rendered pixels. When Commodore Commander
  launches VICE, these records are sent over a local loopback TCP socket passed
  as `-cc-frame-port <port>`. A stdout fallback remains for manual/older
  `-cc-embed` launches without a frame port.

Other stdout/stderr content is treated as emulator log output.

## VICE to Commodore Commander

Hello:

```json
CCV1 {"type":"hello","protocol":"commodore-vice-embed-v1","machine":"sdl"}
```

Status:

```json
CCV1 {"type":"status","state":"running","message":"Frame transport enabled."}
```

Frame:

```text
offset  size  value
0       4     "CCB1"
4       1     frame type, 1 = rgba8888 frame
5       1     pixel format, 1 = rgba8888
6       2     header length, little-endian, currently 32
8       4     payload byte length, little-endian
12      4     frame id, little-endian
16      8     timestamp milliseconds, little-endian
24      2     width, little-endian
26      2     height, little-endian
28      4     flags, little-endian, currently 0
32      n     raw RGBA bytes, width * height * 4
```

The native patch emits complete SDL `rgba8888` frames without downsampling or
compression; the browser canvas is responsible for presentation scaling.
Commodore Commander default launches also disable VICE render filters and
request nearest GL filtering for the active video chip. SDL fullscreen custom
resolution is not used by the embedded view. The UI uses pixelated browser
upscaling to fit the available view while keeping wide frames at native size
instead of applying fractional downscaling.
Frame emission is limited to a minimum interval of 16 ms to avoid flooding the
frame transport during warp or over-rendering. `CommodoreViceEmbedServiceImpl`
opens the local frame socket, launches VICE with its port, parses the binary
records from that socket, and publishes them to the browser over
`/services/commodore-commander/vice-embed/frames` as binary WebSocket messages.
The service still accepts `CCB1` records on stdout as a compatibility fallback,
but the high-rate display path does not depend on DAP or the DAP stdout channel.
Debug launches reserve the same backend frame socket before VICE starts; the
debug adapter never forwards video frames as DAP events.

## Commodore Commander to VICE

Commodore Commander launches patched VICE with `-cc-command-fd 3` and writes
commands to that inherited file descriptor. Patched VICE still falls back to
stdin for manual launches that omit the flag.

Keyboard:

```json
CCV1 {"type":"key","code":"Quote","key":"\"","keyCode":222,"sdlKeyCode":50,"matrixRow":7,"matrixCol":3,"matrixShift":true,"pressed":true,"repeat":false,"shift":true,"ctrl":false,"alt":false,"meta":false,"sdlShift":false,"sdlCtrl":false,"sdlAlt":false}
```

`code`, `key`, `keyCode`, and the browser modifiers are retained for
compatibility. Current patched VICE builds prefer `sdlKeyCode` and the `sdl*`
modifiers so the browser can translate printable symbols from the active host
keyboard layout before VICE applies its SDL keyboard map. Commodore Commander
launches embedded VICE with the stock SDL symbolic keymap (`-keymap 0`) and US
host mapping (`-keyboardmapping 0`) because the browser has already normalized
the active host layout. Browser Shift and Option are host input details; they
are not exposed to users as Commodore Shift or Commodore key chords in the
normal text-entry path.
These fields are SDL key identities, not PETSCII bytes. The emulated machine
and its active KERNAL/screen-editor state remain responsible for producing
PETSCII characters from the resulting keyboard matrix state.
Printable input is symbolic: if the host layout reports `=`, Commodore
Commander sends the C64 `=` key; if it reports `0`, it sends C64 `0`. For
layouts or synthetic events that report a shifted `Digit*` as the unshifted
digit, Commodore Commander applies a small Nordic ISO Mac fallback for the
reported cases, such as Shift+2 producing the C64 quote glyph, Shift+4
producing C64 `$`, and Shift+0 producing the C64 equals key. The Nordic Mac
currency sign `¤` is also mapped to C64 `$` as the closest available Commodore
symbol. Printable host characters that are not available on the target
Commodore keyboard are sent as `sdlKeyCode: 0`, which patched VICE treats as
an explicit no-op instead of falling back to legacy keyCode position mapping.
For C64 keys that the SDL symbolic keymap cannot reconstruct from a browser
printable key, such as shifted top-row symbols, C64 F1-F8 shifted function-key
pairs, `<`, `>`, `?`, the C64 up-arrow, pi, DEL/Backspace, Insert, and the
cursor keys, Commodore Commander also sends `matrixRow`, `matrixCol`, and
optional `matrixShift`. Patched VICE uses those fields during normal emulation
to route the key through VICE's SDL keyboard event queue with the required
emulated Shift state, while still using the SDL key fields when the VICE SDL
menu is active.

Joystick:

```json
CCV1 {"type":"joystick","port":2,"mask":1}
```

Mouse:

```json
CCV1 {"type":"mouse","xRel":4,"yRel":-2,"button":1,"pressed":true}
```

Resize:

```json
CCV1 {"type":"resize","width":768,"height":544}
```

Reset:

```json
CCV1 {"type":"reset"}
```

Open SDL menu:

```json
CCV1 {"type":"menu"}
```

Quit:

```json
CCV1 {"type":"quit"}
```

The native patch handles keyboard, mouse, menu, reset, and quit commands. Mouse
commands are relative movement and SDL button numbers; they are pushed into
VICE's SDL event queue and require VICE mouse emulation to be enabled for the
active device. Embedded Commodore Commander launches enable VICE mouse grab by
default so browser pointer-lock mouse commands reach that path; VICE menu or
explicit launch arguments still control which input device is attached. The
menu command activates VICE's SDL main menu directly. Theia maps F12 to that
command when the embedded emulator is active. A native command reader consumes
the command stream independently of render cadence; while the SDL menu is
active, browser keyboard commands are pushed into SDL so the menu remains
controllable from the embedded canvas. Joystick
and resize messages are part of the contract so the Theia service API will not
need to change when those native hooks are added.

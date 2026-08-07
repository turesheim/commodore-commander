# Commodore Commander VICE Embed Protocol

The patched VICE process uses two transport records:

- `CCV1 ` newline-delimited JSON on stdout/stdin for control, status, and
  compatibility events.
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
resolution is not used by the embedded view. The UI uses integer upscaling and
gives small native frames at least a 2x readable presentation size while
keeping wide frames at native size instead of applying fractional downscaling.
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

Keyboard:

```json
CCV1 {"type":"key","code":"KeyA","key":"a","keyCode":65,"pressed":true,"repeat":false,"shift":false,"ctrl":false,"alt":false,"meta":false}
```

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
active device. The menu command activates VICE's SDL main menu directly. Theia
maps F12 to that command when the embedded emulator is active. While the SDL
menu is active, the patch polls stdin from the menu event loop and pushes
browser keyboard commands into SDL so the menu remains controllable from the
embedded canvas. Joystick and resize messages are part of the contract so the
Theia service API will not need to change when those native hooks are added.

# Commodore Commander VICE Embed Protocol

The patched VICE process uses a newline-delimited control protocol over its
standard streams. Each protocol line starts with `CCV1 `, followed by JSON.
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

```json
CCV1 {"type":"frame","frameId":1,"width":384,"height":272,"pixelFormat":"rgba8888","timestamp":1786000000000,"data":"...base64 RGBA bytes..."}
```

The first patch emits `rgba8888` base64 payloads so Theia can render a frame
without native browser extensions or a temporary file. This is simple and
portable, but it is not the intended final transport for full-speed rendering.
The native patch currently throttles frame emission to at most one frame every
100 ms and downsamples large SDL canvases by 2x to keep stdout/DAP volume
manageable.

## Commodore Commander to VICE

Keyboard:

```json
CCV1 {"type":"key","code":"KeyA","key":"a","keyCode":65,"pressed":true,"repeat":false,"shift":false,"ctrl":false,"alt":false,"meta":false}
```

Joystick:

```json
CCV1 {"type":"joystick","port":2,"mask":1}
```

Resize:

```json
CCV1 {"type":"resize","width":768,"height":544}
```

Reset:

```json
CCV1 {"type":"reset"}
```

Quit:

```json
CCV1 {"type":"quit"}
```

The initial native patch handles keyboard, reset, and quit commands. Joystick
and resize messages are part of the contract so the Theia service API will not
need to change when those native hooks are added.

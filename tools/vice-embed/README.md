# Commodore Commander Patched VICE

This directory contains the Commodore Commander embedded-display patch and build
flow for VICE. The patch targets upstream VICE 3.10.0, tagged as `v3.10` in the
SourceForge repository.

Build natively on macOS Apple Silicon, Windows x64 or Linux x64:

```sh
make -C tools/vice-embed package
make -C tools/vice-embed assets  # also copy into the extension assets
```

The Makefile exports VICE `v3.10` from SourceForge SVN, applies our display/input
patch and builds the SDL2 UI. Build outputs are isolated by platform. The Theia
extension build automatically builds a missing/stale runtime on macOS/Linux and
copies it into its assets. Windows requires the native build first in MSYS2 MINGW64;
asset sync fails for a missing/stale package. `npm run vice:package` and `npm run vice:assets` are equivalent shortcuts.

macOS requires Xcode command line tools and:

```sh
brew install autoconf automake dos2unix pkg-config sdl2_image subversion xa
```

Ubuntu 24.04 x64 is the Linux build/test baseline:

```sh
sudo apt-get install build-essential autoconf automake bison flex texinfo dos2unix \
  pkg-config libsdl2-dev libsdl2-image-dev libcurl4-openssl-dev \
  libasound2-dev libpulse-dev zlib1g-dev subversion xa65 patchelf
```

Windows x64 builds in the MSYS2 **MINGW64** shell, with Node.js on PATH:

```sh
pacman -S --needed make autoconf automake libtool bison flex texinfo dos2unix \
  subversion patch mingw-w64-x86_64-icoutils mingw-w64-x86_64-gcc mingw-w64-x86_64-pkgconf \
  mingw-w64-x86_64-xa65 mingw-w64-x86_64-SDL2 mingw-w64-x86_64-SDL2_image \
  mingw-w64-x86_64-curl
make -C tools/vice-embed PLATFORM=win32-x64 package
node --test tools/vice-embed/*.test.mjs
```

Windows packaging follows each executable/DLL's PE imports with MinGW objdump,
copies the transitive MinGW DLL graph into `bin`, and fails on unresolved imports
or MSYS/Cygwin dependencies. Windows system DLLs and API-set contracts stay with
the host. The Windows default disables build-host CPU tuning (`--disable-arch`)
and includes upstream README/license text. The product tests run outside the build shell after removing MinGW/MSYS2
from PATH, clearing MSYSTEM and moving the build prefix away. Native startup
preserves inherited output pipes rather than attaching to a console/closing them. The build runner is Windows Server
2022 x64; supported desktop/minimum Windows versions still need release verification.

| Platform | Staged runtime | Resource root |
| --- | --- | --- |
| macOS Apple Silicon | `dist/darwin-arm64/VICE.app` | `Contents/Resources` inside the app |
| Windows x64 | `dist/win32-x64` | The runtime directory itself |
| Linux x64 | `dist/linux-x64` | The runtime directory itself |

All resource roots contain `bin` and `share/vice`; macOS/Linux also have `lib`.
Windows DLLs live beside the executables in `bin`. macOS packaging follows
the non-system dylib graph, including `@rpath` and sdl2-compat's dynamically loaded
SDL3, removes build-machine paths and signs the app. Linux packaging follows ELF
linked dependencies, copies non-glibc libraries and sets relative `$ORIGIN`
search paths on executables and libraries. Missing or unbundled linked dependencies
fail packaging. The host supplies glibc/loader and SDL's dynamically loaded desktop,
graphics and audio drivers; this does not promise portability to musl or older glibc.

The Linux SDL2 runtime discovers ROMs relative to its `bin` directory, independent
of the configured build prefix. Product tests move that prefix away and start the
packaged emulator without a `-directory` override.
The Linux nightly runner is pinned to Ubuntu 24.04. Minimum OS and fresh-host
acceptance for 1.0 remain separate release work.

The macOS path-discovery patch supplies `proc_pidpath` with its required buffer
size, including during early startup before VICE has saved `argv[0]`.
Windows and Linux SDL2 discover ROMs relative to `bin`, independent of the build prefix.
After building the shared runtime package, check startup and live frames:

```sh
npm run build --workspace @commodore-commander/vice-runtime
node tools/smoke-test-vice.mjs tools/vice-embed/dist/darwin-arm64/VICE.app/Contents/Resources
# Linux headless testing requires Xvfb:
bash tools/run-with-xvfb.sh node tools/smoke-test-vice.mjs tools/vice-embed/dist/linux-x64
```

Nightly package tests on macOS Apple Silicon, Windows x64 and Linux x64 require continuing
visible frames with normal sound initialization, then launch the packaged Electron
app and verify BASIC `READY.`, keyboard execution, power off and restart. Headless
Linux runs require a sound server; the nightly runner supplies a PulseAudio null
sink and Xvfb with software rendering. Physical audio checks remain manual.
Logs/screenshots survive failures; see the
[product test instructions](../../applications/electron/README.md).
`node --test tools/vice-embed/*.test.mjs` additionally verifies ELF relocation on
Linux after deleting the original build libraries and compiles the actual native
frame writer to test partial sends, dropped newer frames and disconnect cleanup
with a deliberately small nonblocking socket buffer. Windows uses a loopback
TCP pair and Winsock errors; macOS/Linux use a Unix socket pair. Another native
fixture checks fragmented input through a Node-owned standard pipe. The Windows
PE fixture builds a DLL chain and executes it after removing its build libraries
and relocating the runtime. A copy or protocol hello alone
does not establish live runtime behavior.

The patch adds a small SDL-only transport enabled with `-cc-embed`. The patched
emulator still runs as an external process, but its SDL window is hidden while
it publishes rendered frames to a local loopback socket and accepts control
input on an inherited command file descriptor. Commodore Commander launches
that independent frame socket from `CommodoreViceEmbedServiceImpl` and paints
the latest frame into the Machine view canvas without routing display updates
through DAP.

The current patch is intentionally narrow:

- Frame publishing hooks into `src/arch/sdl/video_sdl2.c`.
- Hidden embedded SDL windows still run through the canvas refresh path so
  frames are emitted without showing the native window.
- Keyboard input reuses the SDL keyboard path in `src/arch/sdl/kbd.c`.
  Commodore Commander normalizes browser-visible printable keys to VICE's stock
  SDL symbolic US keymap (`-keymap 0 -keyboardmapping 0`). Unsupported printable
  host characters are ignored explicitly instead of falling through to
  positional keyCode mapping. Host Shift and Option are treated as host input
  details, not user-facing Commodore Shift chords. A narrow C64 matrix fallback
  handles keys the SDL symbolic map cannot reconstruct from browser events,
  including shifted top-row symbols, C64 F1-F8 shifted function-key pairs, the
  Nordic Mac `¤` to C64 `$`, C64 up-arrow/pi, DEL/Backspace, cursor keys, and
  `<`/`>`.
- Mouse input is sent as relative movement and button commands from the browser
  pointer-lock capture path. The native patch applies these through VICE's
  mouse driver (`mouse_move` and `mouse_button`) on the SDL/main loop.
- The embedded transport can open VICE's SDL menu directly. Theia maps F12 to
  that command when the embedded emulator is active. While that menu is active,
  embedded keyboard commands are turned into SDL key events so the menu can be
  controlled from Theia. Command input is consumed from VICE's SDL/main loop so
  SDL and AppKit operations stay on the main thread.
- Native errors go to stderr in embedded mode instead of waiting in a hidden
  SDL modal dialog. The backend forwards that diagnostic to Output/VICE; normal
  external VICE retains its visible dialogs. Audio-device recovery/fidelity still
  needs release acceptance.
- Reset commands trigger a normal machine CPU reset.
- Joystick commands are reserved by the protocol but are not implemented in the
  native patch yet.
- Frame output uses a binary `CCB1` header followed by complete SDL
  `rgba8888` bytes without downsampling or compression. The native patch limits
  frame emission to a minimum interval of 16 ms, which is fast enough for 50 Hz
  display while still avoiding unbounded frame traffic during warp or
  over-rendering.
- The nonblocking socket sender owns at most one pending frame. Partial sends
  resume on SDL/input polls; newer frames are dropped until that record drains.
  Socket backpressure must not truncate a CCB1 record or block input handling.
- Commodore Commander default launch arguments disable VICE render filters and
  request nearest GL filtering for the active video chip. The browser canvas is
  responsible for presentation scaling; SDL fullscreen custom resolution is not
  used by the embedded view. The UI preserves the frame aspect ratio and scales
  up or down to fit the available view, using pixelated browser rendering.
- Embedded launches enable VICE mouse grab by default so browser pointer-lock
  mouse commands are accepted by VICE's mouse and paddle input path. Input
  device selection remains controlled by VICE's own menu or explicit launch
  arguments.
- The Theia backend reserves a local frame socket through `vice-runtime`, passes
  it to VICE with `-cc-frame-port <port>`, passes command input with
  `-cc-command-fd 3` on macOS/Linux or `-cc-command-fd 0` on Windows, receives binary frames through the shared runtime
  transport, and forwards them to the browser over a dedicated binary WebSocket.
  stdout remains for JSON status/logging and as a
  compatibility fallback for manual `-cc-embed` launches without a frame port.
  The shared runtime stdout decoder separates text lines and binary records;
  Theia and DAP retain their own JSON and forwarding rules.
  Debug launches use the same frame socket and command fd; the debug adapter
  does not forward video frames as DAP events.

After building patched VICE, point `commodoreCommander.VICE.runtimePath` at the
runtime root that contains `share/vice`, or run `make -C tools/vice-embed assets`
before `npm run theia:build` so the packaged app uses the patched runtime.

For CI lanes that deliberately use an external system VICE instead of a bundled
runtime, set `COMMODORE_COMMANDER_SKIP_VICE_ASSETS=1` during the Theia build.
For a separately built runtime, set
`COMMODORE_COMMANDER_PATCHED_VICE_RUNTIME=/path/to/runtime` (the app root on macOS).
`COMMODORE_COMMANDER_PATCHED_VICE_APP` remains a compatible macOS alias.
To copy an existing staged runtime without triggering the automatic stale check,
set `COMMODORE_COMMANDER_SKIP_VICE_AUTO_REBUILD=1`.

Packaged native tests also request a deliberately nonexistent sound device,
require its stderr diagnostic and continuing visible frames. This exercises the
real SDL error path in addition to default startup; it does not bypass or replace
the default-device check. Native logs are retained as product test artifacts.

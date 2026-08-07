# Commodore Commander Patched VICE

This directory contains the Commodore Commander embedded-display patch and build
flow for VICE. The patch targets upstream VICE 3.10.0, tagged as `v3.10` in the
SourceForge repository.

Build and stage the patched macOS Apple Silicon app bundle with:

```sh
make -C tools/vice-embed package
```

On macOS, the build expects Xcode command line tools plus the normal VICE SDL2
build prerequisites. With Homebrew, the missing pieces are typically:

```sh
brew install autoconf automake pkg-config sdl2_image
```

The staged runtime is written to:

```text
tools/vice-embed/dist/darwin-arm64/VICE.app
```

Copy that runtime into the Theia extension assets with:

```sh
make -C tools/vice-embed assets
```

The equivalent npm shortcuts are:

```sh
npm run vice:package
npm run vice:assets
```

The Makefile exports VICE `v3.10` from SourceForge SVN, applies
`vice-3.10.0-commodore-embed.patch`, runs VICE autotools/configure, builds,
installs to a local prefix, stages a `VICE.app` layout, bundles non-system
Homebrew/local dylibs when possible, ad-hoc signs on macOS, and verifies that
`x64sc` contains the embedded `-cc-embed` transport flag.

The patch adds a small SDL-only transport enabled with `-cc-embed`. The patched
emulator still runs as an external process, but its SDL window is hidden while
it publishes rendered frames to a local loopback socket and accepts control
input on stdin. Commodore Commander launches that independent frame socket from
`CommodoreViceEmbedServiceImpl` and paints the latest frame into the Machine
view canvas without routing display updates through DAP.

The current patch is intentionally narrow:

- Frame publishing hooks into `src/arch/sdl/video_sdl2.c`.
- Hidden embedded SDL windows still run through the canvas refresh path so
  frames are emitted without showing the native window.
- Keyboard input reuses the SDL keyboard path in `src/arch/sdl/kbd.c`.
- Mouse input is sent as relative movement and button commands from the browser
  pointer-lock capture path and is pushed into VICE's SDL event queue.
- The embedded transport can open VICE's SDL menu directly. Theia maps F12 to
  that command when the embedded emulator is active. While that menu is active,
  the patch polls stdin from the menu event loop and turns embedded keyboard
  commands into SDL key events so the menu can be controlled from Theia.
- Reset commands trigger a normal machine CPU reset.
- Joystick commands are reserved by the protocol but are not implemented in the
  native patch yet.
- Frame output uses a binary `CCB1` header followed by complete SDL
  `rgba8888` bytes without downsampling or compression. The native patch limits
  frame emission to a minimum interval of 16 ms, which is fast enough for 50 Hz
  display while still avoiding unbounded frame traffic during warp or
  over-rendering.
- Commodore Commander default launch arguments disable VICE render filters and
  request nearest GL filtering for the active video chip. The browser canvas is
  responsible for presentation scaling.
- The Theia backend opens a local frame socket, passes it to VICE with
  `-cc-frame-port <port>`, parses binary frames from that socket, and forwards
  them to the browser over a dedicated binary WebSocket. stdout remains for
  JSON status/logging and as a compatibility fallback for manual `-cc-embed`
  launches without a frame port. Debug launches use the same frame socket; the
  debug adapter does not forward video frames as DAP events.

After building patched VICE, point `commodoreCommander.VICE.runtimePath` at the
runtime root that contains `share/vice`, or run `make -C tools/vice-embed assets`
before `npm run theia:build` so the packaged app uses the patched runtime.

For CI lanes that deliberately use an external system VICE instead of a bundled
runtime, set `COMMODORE_COMMANDER_SKIP_VICE_ASSETS=1` during the Theia build.
For local experiments with a separately built app bundle, set
`COMMODORE_COMMANDER_PATCHED_VICE_APP=/path/to/VICE.app`.

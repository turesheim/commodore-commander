# Build Configuration

The Commodore Commander build path reads project configuration from the workspace root before
falling back to auto-detected root `.asm` files.

Discovery order:

1. `COMMODORE_COMMANDER_BUILD_CONFIG`
2. `commodore-commander.build.json`
3. `.commodore-commander.build.json`
4. `.commodore-commander/build.json`

Relative paths are resolved from the workspace root.

When a workspace has no build config yet, the Theia backend creates
`commodore-commander.build.json` the first time build or run data is queried. It
creates:

- a `debug` build profile with explicit default values
- one or more programs for standalone `.asm` roots that are not included by
  another source file
- per-program `runProgram` paths inferred from `.file [name="..."]` directives
  where possible

The build model deliberately uses separate concepts:

- **program**: a source entry point that can be assembled into an artifact.
  Standalone assembly files in the workspace are auto-detected even when they
  are not listed in the config. A program can declare a `machine` section for
  generated VICE launch configurations; if it does not, the debug adapter uses
  the default C64 profile until Active Machine launch defaults are wired in.
- **profile**: reusable build settings such as output folders, symbols, debug
  dumps, toolchain paths, and custom assembler arguments.
- **run**: an optional named launch intent that selects a program, profile,
  machine, output PRG, and whether assembly is required before launching.

## Example

```json
{
  "javaRuntime": "/opt/jdk-21/bin/java",
  "kickAssemblerJar": "tools/KickAss.jar",
  "libraryRoots": ["library", "vendor/kickass"],
  "outputFolder": "out/debug",
  "runProgram": "out/debug/game.prg",
  "showMemory": true,
  "viceSymbols": true,
  "debugDump": true,
  "symbolFile": true,
  "assemblerArgs": ["-define", "LOCAL_BUILD"],
  "generatedAssets": ["generated"],
  "defaultProfile": "debug",
  "defaultProgram": "game",
  "defaultRun": "game-debug",
  "profiles": {
    "debug": {
      "outputFolder": "out/debug",
      "runProgram": "out/debug/game.prg",
      "debugDump": true,
      "symbolFile": true
    },
    "release": {
      "outputFolder": "out/release",
      "runProgram": "out/release/game.prg",
      "debugDump": false,
      "symbolFile": false,
      "assemblerArgs": ["-define", "RELEASE"]
    },
    "ci": {
      "javaArgs": ["-Xmx512m"],
      "assemblerArgs": ["-define", "CI"]
    }
  },
  "programs": [
    {
      "name": "game",
      "root": "src/game.asm",
      "profile": "debug",
      "machine": {
        "profile": "c64",
        "model": "c64c",
        "viceArgs": []
      },
      "outputFolder": "out/debug"
    },
    {
      "name": "loader",
      "root": "src/loader.asm",
      "machine": {
        "profile": "c128",
        "model": "c128dcr"
      },
      "generatedAssets": ["generated/loader"]
    },
    {
      "name": "sprite-test",
      "root": "experiments/sprite-test.asm"
    }
  ],
  "runs": [
    {
      "name": "game-debug",
      "program": "game",
      "profile": "debug",
      "runProgram": "out/debug/game.prg",
      "build": "ifStale"
    },
    {
      "name": "loader-only",
      "program": "loader",
      "profile": "release",
      "build": "always"
    }
  ]
}
```

## Settings

- `javaRuntime`: Java command or path. Defaults to `JAVA_HOME/bin/java` when
  `JAVA_HOME` is set, otherwise `java`.
- `javaArgs`: arguments placed before `-jar`.
- `kickAssemblerJar`: KickAss jar path. The Theia product supplies the bundled
  jar by default.
- `libraryRoots`: one or more KickAss `-libdir` roots. These also participate in
  include resolution for build planning.
- `outputFolder`: output directory for `-odir`.
- `runProgram`: PRG file to launch for the selected program or run. If omitted,
  the Run action looks for the program output name under the output folder and
  also honors Kick Assembler `.file [name="..."]` directives when creating
  default programs.
- `workingDirectory`: process working directory. Defaults to the root source
  file directory.
- `showMemory`, `debug`, `viceSymbols`, `debugDump`, `symbolFile`: boolean
  switches for `-showmem`, `-debug`, `-vicesymbols`, `-debugdump`, and
  `-symbolfile`.
- `symbolFileFolder`: optional `-symbolfiledir` path.
- `assemblerArgs`: extra KickAss arguments appended after the generated
  arguments so project-specific options can override defaults where KickAss
  permits it.
- `generatedAssets`: file or directory roots that should trigger rebuilds but
  should not be auto-detected as independent root programs.
- `defaultProfile`: profile used when a program does not name one.
- `defaultProgram`: preferred program name for UI selection.
- `defaultRun`: preferred named run for tools that choose a default.
- `profiles`: named build setting groups. Program settings override profile
  settings.
- `programs`: explicit root programs. Each object declares `root`, can declare
  `name`, `profile`, optional `machine`, and any build setting. When `machine`
  is omitted, generated launch entries currently rely on the debug adapter's
  default C64 profile.
- `runs`: optional named launch entries. Each entry declares `program` and can
  override `profile`, `machine`, `runProgram`, and `build`.
- `build`: run policy for named runs. Use `ifStale`, `always`, or `never`.
- `excludeDirectories`: additional directory names skipped during fallback
  auto-root scanning.

## Machine Sections

The workspace Active Machine setting uses the same machine shape as program and
run overrides:

```json
{
  "commodoreCommander.activeMachine": {
    "profile": "c64",
    "model": "c64",
    "viceArgs": []
  }
}
```

In `commodore-commander.build.json`, omit `machine` to use that Active Machine
setting. Add a `machine` section only when a program or run must launch on a
specific machine:

- `profile`: Commodore machine profile id, such as `c64`, `c128`, `vic20`,
  `plus4`, `c16`, `pet`, `cbm2`, `cbm5x0`, or `c64dtv`.
- `model`: optional VICE `-model` value for that profile. Examples include
  `c64c`, `c128dcr`, `vic20ntsc`, `plus4ntsc`, `c16`, `8032`, `610`, `510`,
  and `v2ntsc`.
- `viceArgs`: optional extra VICE command-line arguments appended after the
  selected profile/model arguments.

CI can override the toolchain without editing the project file:

- `COMMODORE_COMMANDER_KICKASS_JAR`
- `COMMODORE_COMMANDER_JAVA_RUNTIME`
- `COMMODORE_COMMANDER_BUILD_PROFILE`
- `COMMODORE_COMMANDER_BUILD_CONFIG`

## Headless Build

After building the TypeScript packages, use the same planner and command
renderer outside Theia:

```sh
node packages/theia-extension/lib/node/kick-assembler-headless-build.js . --profile ci
```

Useful options:

- `--list-programs`
- `--program game`
- `--profile ci`
- `--changed path/to/file.asm`
- `--config path/to/build.json`
- `--dry-run`

The root package also exposes:

```sh
npm run kickass:build -- --profile ci
```

## Theia UI

Theia follows the usual VS Code-style workflow:

- the status bar shows `Profile: <profile>` for Kick Assembler editors
- clicking that item opens a quick-pick profile selector
- the selector can create a new profile, which is immediately persisted as the
  active workspace profile
- save-triggered builds are requested for changed Kick Assembler files and
  routed through the workspace build planner
- Theia's native Start Debugging and Start Without Debugging commands create or
  use `commodore-vice` launch configurations
- from an active assembler source, F5/Ctrl+F5 can offer to create or append a
  matching `.theia/launch.json` entry and then start that entry
- generated launch entries use the selected program's machine section when
  present; otherwise the debug adapter falls back to the default C64 profile
- the right toolbar exposes Commodore machine selection for reference filtering
  and machine-profile UI; it is not a direct selected-machine launcher

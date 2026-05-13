# Program/Profile/Run

The Theia build model uses three separate concepts:

- **Program** = an assembly entry point that can produce a runnable artifact.
- **Profile** = the build settings used to assemble one or more programs.
- **Run** = an optional launch intent for starting a program.

The old build target/variant vocabulary is intentionally not supported.

## Program

_What can be assembled._

A program is a source root such as `src/game.asm`, `src/loader.asm`, or
`experiments/sprite-test.asm`. Programs may be declared in
`commodore-commander.build.json`, but the workspace planner also auto-detects
standalone `.asm` files that are not included by another source file.

A program can define:

- source root
- output folder
- `runProgram` path
- generated asset roots
- default build profile
- optional Commodore machine section for VICE launch overrides

## Profile

_How a program is assembled._

A profile contains reusable build settings such as:

- Java and KickAss runtime paths
- library roots
- output folder
- debug and symbol switches
- custom assembler arguments
- generated asset roots

Common profiles are `debug`, `release`, and `ci`. Program settings override
profile settings.

## Run

_How a program is launched._

A run optionally names a program, profile, machine, output PRG, and build
policy. It is useful when a workspace has several launchable utilities or when
the same program needs different launch behavior.

A run can define:

- program name
- profile name
- optional Commodore machine section
- PRG path to start
- build policy: `ifStale`, `always`, or `never`

The custom `Run Kick Assembler Program...` command has been removed. Launching
now goes through Theia's native Run and Debug commands and `launch.json`
configuration. From an active assembler source, F5/Ctrl+F5 can offer to create a
matching `commodore-vice` entry in `.theia/launch.json` and start that entry.
The debug-start bridge asks the build service for the active source's runnable
program, writes or updates the matching Kick Assembler build task in
`.theia/tasks.json`, and starts the debug configuration with a Kick Assembler
`preLaunchTask` unless an existing configuration already defines one.
Configured runs remain part of the build model, but there is still no separate
run picker and the `ifStale`/`always`/`never` build-policy flow is not fully
surfaced in the Theia launch path.

## Active Machine

_Which Commodore machine is active in the workspace._

The Active Machine is intentionally separate from build programs and runs. It
drives reference lookup filtering and is exposed through the right toolbar. The
old direct selected-machine launcher has been removed; VICE process startup now
belongs to Theia launch configurations and the debug adapter.

If a program has a `machine` section, generated launch entries use that
profile/model/options. Named run `machine` sections override the program
machine only for that named run. When no machine is provided, the debug adapter
falls back to the default C64 profile. Wiring the workspace Active Machine
preference into generated launch entries remains future Theia launch/task work.

Machine sections use this shape:

```json
{
  "profile": "c64",
  "model": "c64c",
  "viceArgs": []
}
```

# Theia Extension

`packages/theia-extension` is now a real Theia extension package instead of a
documentation placeholder.

Current responsibility:

- provide a minimal Commodore Commander product identity inside the Theia
  applications
- reuse the existing Commodore Commander product branding for the Theia
  preview, including the workbench icon, favicon, and Kick Assembler file icon
- show embedded VICE attribution and licensing information on the welcome page
- expose bundled user documentation from the welcome page
- act as the local extension package loaded by the Electron application package
- register the Kick Assembler language id, file associations, TextMate grammar,
  and Monaco language configuration
- adapt Monaco definition/reference requests onto the shared runtime-safe lookup
  service in `packages/language-support`
- load bundled 6502 and C64 I/O reference datasets from the product package,
  not from the active workspace
- provide Theia-managed HTML hover handling for shared mnemonic and C64 I/O
  reference data so embedded reference HTML, including SVG, renders intact
- execute Kick Assembler through the shared build planner, using project build
  config for programs, profiles, optional runs, library roots, output folders,
  debug and symbol switches, generated assets, run-program paths, and custom
  assembler arguments
- create a workspace build config, active profile, and discovered standalone
  programs on demand when none exists yet, using explicit default settings
  instead of an implicit fallback
- show a VS Code-style status-bar profile selector for Kick Assembler editors
- show a right-side Commodore machine view with toolbar actions backed by the
  workspace `commodoreCommander.activeMachine` preference
- contribute a `commodore-vice` debug type to Theia and use Theia's built-in
  Start Debugging / Start Without Debugging commands; from an active assembler
  file, missing VICE launch entries are offered as `.theia/launch.json`
  additions with `debugInfo` and `sourceRoot` fields and then started through
  Theia's debug session manager
- contribute a bottom-panel Memory view that reads and writes C64 memory from
  the active stopped `commodore-vice` debug session through DAP `readMemory`
  and `writeMemory`, including comma-separated monitors, `start-end` ranges,
  common address presets, label/address input, advanced memory-space dropdown
  and bank combobox controls, persisted settings, 40-column screen rows, and
  ASCII, custom text, or bitmap C64 PETSCII/screen-code rendering with
  upper/graphics and lower/upper charset selection plus labeled control bytes
- add commands for sending editor expressions to Theia's Watch view and for
  installing persistent VICE memory watchpoints through DAP data breakpoints
- provide a memory watchpoint manager in the Debug breakpoints menu with add,
  enable/disable, edit, delete, clear, and reinstall actions; watchpoints can
  include byte count, read/write access, VICE condition text, and DAP-style hit
  conditions
- filter editor reference lookup against the selected machine profile so
  machine-specific I/O, ROM, memory-map, and zero-page symbols do not bleed
  into unrelated machines
- provide `cc-kickass-build` as a headless entry point for CI builds that should
  use the same build configuration as the Theia backend

Current non-goals:

- custom editors
- custom run/debug UI outside Theia's native Run and Debug flow
- full task integration for build-before-run/debug
- full Eclipse memory-rendering API parity
- finished native desktop packaging and app-bundle branding
- deep language features beyond syntax plus lookup/service wiring

The package is intentionally small so the app can start for testing while the
rest of the migration remains reviewable.

# Runtime Setup

Open **Help → Check Runtime Setup** or use the link on the welcome page.
The report checks the first workspace folder's defaults, the selected machine,
Java, bundled tool JARs and the selected VICE executable. It does not start a
machine. A successful report confirms executable loading and protocol support;
run a program to verify display, keyboard input and debugging. Build settings
and `launch.json` can override the defaults checked here.

## Current package coverage

| Package | In-product Machine display | External VICE window |
| --- | --- | --- |
| macOS Apple Silicon | Bundled patched VICE 3.10.0 | Configure a compatible VICE installation |
| Windows x64 | Matching patched runtime not bundled yet; required for 1.0 | Optional compatibility mode; configure stock VICE |
| Linux x64 | Bundled patched VICE 3.10.0; Ubuntu 24.04 build/test baseline | Optional compatibility mode; configure stock VICE |
| macOS Intel / other architectures | No nightly package currently provided | No release support claim yet |

1.0 requires patched VICE with display streaming on all supported platforms.
This table describes current packages, not a completed acceptance matrix.
Minimum OS versions and clean-host support still need release verification.
Machine profiles provide reference/configuration data; their presence in the
selector does not mean every model has passed packaged acceptance tests.

## Java

Install Java **21 or newer** for the complete tool workflow. Java is currently
an external prerequisite; the product bundles Kick Assembler and SIDScore 0.8.0
JARs, not a Java runtime.

In Settings, set `commodoreCommander.tools.javaRuntime` to the Java executable
(for example, an installation's `bin/java` or `bin/java.exe`), not its directory.
Spaces in an absolute path are supported; do not add shell quotes or arguments.
With this setting empty, SIDScore uses `JAVA_HOME/bin/java` when `JAVA_HOME` is
set, otherwise `java` on the application process's PATH. A desktop launch can
have a different environment from a terminal.

Kick Assembler build definitions may also specify `javaRuntime` and `javaArgs`;
`COMMODORE_COMMANDER_JAVA_RUNTIME` can override build defaults. See
[Build Configuration](build-configuration.md).

## VICE

On macOS Apple Silicon and Linux x64, leave `commodoreCommander.VICE.runtimePath` empty to
discover the bundled patched runtime. For another installation, set it to a
runtime root with `bin` and `share/vice`, or a VICE distribution directory with
the emulators and machine data such as `C64`. The selected profile chooses its
emulator (`x64sc`, `x128`, `xvic`, etc.).

An explicitly configured invalid runtime path now fails visibly. Correct it or
clear it to restore automatic discovery; the product does not silently replace
your chosen installation with a bundled/system copy.

Stock VICE cannot send frames to the in-product Machine view. Set
`commodoreCommander.VICE.launchMode` to `external` to run/debug in its own
window. The standalone Machine power switch always requires a patched embedded
runtime; use F5/Ctrl+F5 with external launch mode for stock VICE.
Per-launch `viceResourcesPath`, `viceExecutable` and `viceLaunchMode` can override
these settings. See [Debugger User Guide](debugger-user-guide.md).

## Troubleshooting

- **Java needs attention:** install/select Java 21+, then rerun the check.
- **VICE resources not found:** select a complete installation for the chosen
  machine. An executable alone is insufficient.
- **Embedded protocol missing:** select patched VICE or use external launch mode
  for stock VICE. A version number alone does not prove embedded support.
- **Native executable cannot load:** reinstall a complete package/runtime for
  your OS/architecture; include the error and selected paths in a bug report.
- **Tools ready but Machine stays empty:** stop and restart the machine, inspect
  Output/VICE and report the selected profile/model and steps leading to the
  failure. The setup probe does not validate live frames or all ROM/model files.

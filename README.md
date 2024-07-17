# Commodore Commander

This project comprises of a set of plugins to the Eclipse IDE that adds support for building Commodore 64 applications using the Kick Assembler for the MOS 6510 processor and the VICE emulator for running and debugging. It currently have the following features:

## Editor

The editor is being rewritten in order to provide better support than basic editing features and tooltips.

![](docs/mnemonic-tooltip.png)

* Editor based on the 6502 TextMate grammar
* As with most Eclipse based editors:
  * "Quick diff" and revision information in the gutter (must be enabled)
  * Task and bookmarks
  * Search and navigation etc.
* Tooltips for 6510 mnemonics
* Tooltips for the Commodore 64 memory map

## Compiling and debugging

* Built in [Kick Assembler](http://theweb.dk/KickAssembler/Main.html#frontpage) compiler
* Built in [VICE](https://vice-emu.sourceforge.io) emulator
  * Currently only macOS on ARM
  * 64bit Windows GTK version (planned)
  * 64bit macoS Intel GTK version (planned)
* Automatic compilation when a file has changed
  * The source hierarchy is automatically calculated, so no need to specify main files.
* Problem markers when a compilation produces errors
* Compilation output to the Commodore Commander console
* Launch the Vice emulator when double clicking a *.prg file
* Support for Eclipse run and debug launch shortcuts.
* Launches will automatically pick up VICE configuration files found either in the same folder as the program, or in any of it's parent folders.
* Debug launches will in addition automatically pick up `*.vs` files created by Kick Assembler and start VICE in native monitor mode for debugging.

## Installing



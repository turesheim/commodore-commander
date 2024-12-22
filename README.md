# Commodore Commander

This project comprises of a set of plugins to the Eclipse IDE that adds support for building Commodore 64 applications using the [Kick Assembler](http://theweb.dk/KickAssembler/Main.html#frontpage) for the MOS 6510 processor and the [VICE emulator](https://vice-emu.sourceforge.io) for running and debugging. This project's focus will be on editing and debugging – not resource management, of which there are many other excellent tools.

It is still in a very early stage, but it is usable and currently have the following features:

## Editing

![](docs/editor.png)

* Editor with 6502 opcode syntax coloring
* As with most Eclipse based editors:
  * "Quick diff" and revision information
  * Task and bookmarks
  * Search and navigation
  * Block selection
  * `TODO` and `FIXME` markers
  * Bookmarks, and much more
* Tooltips for 6510 mnemonics
* Tooltips for the Commodore 64 memory map

## Compiling

Compilation is done automatically with the built-in [Kick Assembler](http://theweb.dk/KickAssembler/Main.html#frontpage) compiler whenever a source file has been changed.

* Problem markers when a compilation produces errors.
* Compilation output to the _Commodore Commander_ console view.

## Running

* Launches the VICE emulator when double clicking a `*.prg` file.
* Launches will automatically pick up VICE configuration files found either in the same folder as the program, or in any of it's parent folders.

## Debugging

The debugger implements a [VICE Binary Monitor](https://vice-emu.sourceforge.io/vice_12.html) interface and is currently fairly basic. It currently supports the following features:

* Built in [VICE](https://vice-emu.sourceforge.io) emulator
  * macOS GTK version on aarch64 and x86
  * Windows GTK x86 version (planned)
  * Linux GTK x86 version (planned)
* Support for Eclipse run and debug launch shortcuts.
* Debug launches pick up `*.vs` files created by Kick Assembler and passes these to VICE.
* Support for _step over_, _step into_, _step return_, _suspend_, _resume_ and _terminate_

### Breakpoints

![](docs/breakpoints.png)

The only type of _checkpoints_ currently supported are _breakpoints_. These are triggered whenever the _program counter_ enteres an address where a breakpoint has been added and will halt the emulator. Breakpoints can be individually disabled and enabled, and as usual be grouped, placed in working sets etc.

### Memory monitor

The memory monitor is used to observe and edit the main computer memory.

Using the **New Memory View** ![](docs/new_con.png) command you can create a view that is able to display one single area of memory at the time (**Add Memory Monitor** ![](docs/monitorexpression_tsk.png)). However you can add several areas to monitor in each view and you can add different _renderings_. Each rendering is a visualization of the memory area and may or may not be editable. The table renderings are typically editable, while the screen rendering shown below is not.

![](docs/memory.png)

Note that monitors are only updated when the CPU has stopped because of i.e. a breakpoint and any changes to the memory will only take effect when the CPU has resumed operation.

## Related resources

### Links

#### Embedded
- The Kick Assembler: http://theweb.dk/KickAssembler
- VICE, the Versatile Commodore Emulator: http://vice-emu.sourceforge.net

#### Commodore 64
- Cycle-accurate 6502 emulator in Javascript: https://github.com/Torlus/6502.js
- Tuned Simon's BASIC: https://github.com/godot64/TSB
- SpritePad C64 Pro: https://subchristsoftware.itch.io/spritepad-c64-pro
- CharPad C64 Pro: https://subchristsoftware.itch.io/charpad-c64-pro
- SpriteMate: https://www.spritemate.com
- GoatTracker2: https://sourceforge.net/projects/goattracker2
- Colordore: https://www.pepto.de/projects/colorvic/
- http://petscii.krissz.hu

#### Eclipse
- https://eclipse.dev/justj/?page=documentation
- [Inside the Memory View: A Guide for Debug Providers](https://www.eclipse.org/articles/Article-MemoryView)
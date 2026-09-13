# SIDScore modules in Kick Assembler

Commodore Commander embeds a `.sidscore` file in a Kick Assembler program
through two small components. SIDScore generates relocatable assembly via
`SIDScoreModuleExporter.generate(Path, String)`. The third-party
`SIDScoreArchive` plugin supplies that assembly as an `IAutoIncludeFile` during
the host program's ordinary Kick Assembler invocation. Kick Assembler itself
is unchanged. This uses its documented [Java plugin and auto-include API](https://www.theweb.dk/KickAssembler/webhelp/content/ch17s05s06.html).

Declare the score in the ASM source. The path is relative to the file containing
the declaration; the namespace and origin are the generated module's label
prefix and C64 load address:

```asm
// @sidscore "../music/theme.sidscore" as Music at $3000
.plugin "net.resheim.cc.sidscore.kickass.SIDScoreArchive"

// In initialization, select tune 1:
lda #1
jsr Music.init

// In the host's video-frame IRQ, after saving A, X, and Y:
jsr Music.play

// On a game event, queue an effect defined in TUNE 2:
jsr Music.tune2.effect_Zap
```

The source-local `// @sidscore` declaration is read before assembly and remains
a legal Kick Assembler comment. No `sidScoreModules` entry in a JSON file is
needed. Add one unconditional declaration per module, in the root ASM or an
unconditionally imported ASM file, with a distinct namespace and origin for
each. The scanner rejects declarations inside `#if` blocks. Register the plugin
once in the root ASM. The existing `sidScoreModules` build setting remains
available for projects that already use it; mixing both forms is allowed when
namespaces and origins do not conflict.

The headless builder can assemble such a project without any build JSON. The
IDE still creates its general build configuration for profiles and launch
settings on first use; SIDScore modules need no entry in that file.

The build runner launches Kick Assembler with the KickAss, SIDScore, and plugin
jars on the Java classpath, passing each discovered module through JVM
properties. The plugin writes the exact source it returns to Kick Assembler
under the program's output directory, at `generated/sidscore/Music.asm` in
this example. The `.dbg` source path points to that file. Editing the
`.sidscore` source or an imported subtune marks the owning program for rebuild.
External builds can
use the same plugin contract described in
[`tools/sidscore-kickass-plugin/README.md`](../tools/sidscore-kickass-plugin/README.md).

The module has no BASIC stub, fixed address, or IRQ installer. The plugin sets
its program counter from the configured origin. The host owns memory layout,
IRQ installation, and timing. A multi-tune module accepts tune number 1..N in
A at `Music.init` and advances the selected tune at `Music.play`; an invalid
number selects tune 1. Inline `TUNE` blocks and `IMPORT ... AS` sources both
become available, up to 254 tunes per module. A named
`Music.tuneN.effect_Name` entry point queues an
effect, and `Music.play` advances effects from other tunes along with the
selected music. Selecting an effect-only tune starts its effects immediately.
Call `play` once per video frame for the score's `SYSTEM` setting; preserve A,
X, and Y around an IRQ call. The module uses SID `$d400-$d418` and zero-page
`$fb-$fc` during calls.

Effects within one tune arbitrate by voice and priority. Effects from different
tunes currently have separate ownership state: if they use the same SID voice
at the same time, the later tune's register writes win. Use distinct fixed
`VOICE` assignments for effects that must overlap. Effect timelines longer
than 4096 frames fail export with a named error; all generated code and data
must fit the chosen C64 memory range. Global filter, route, cutoff, resonance,
and volume changes persist after an effect ends until music or another effect
overwrites them.

The previous SIDScore `--asm` and `--sid` exports remain standalone output
formats. They include fixed addresses and a BASIC stub, which makes them
unsuitable as general imported modules. Kick Assembler's
[`LoadSid`](https://theweb.dk/KickAssembler/webhelp/content/ch12s03.html) can
still import their bytes when the program can honor those fixed addresses.

Integration checks assemble a representative three-voice score at `$3000`
and `$4000` and verify that calls relocate. Multi-tune tests assemble inline
and imported effect-only tunes and check named effect triggers. The plugin
test verifies resolved JSR targets, generated source and debug path, and
failure for missing or invalid score files. Playback with a host IRQ in VICE
remains to be tested.
Kick Assembler's `.sym` output omits labels from auto-included plugin sources;
its `.vs` and `.dbg` outputs contain the module labels.

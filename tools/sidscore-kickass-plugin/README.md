# SIDScore KickAssembler plugin

`net.resheim.cc.sidscore.kickass.SIDScoreArchive` is a third-party KickAssembler
archive plugin. It asks SIDScore's module exporter for relocatable ASM and
supplies it as an `IAutoIncludeFile` during the same KickAssembler build.

Compile the Java plugin with `./build.sh`. The script writes
`resources/sidscore-kickass-plugin.jar` and requires JDK 21, the bundled
`resources/KickAss.jar`, and the corresponding
`resources/sidscore-cli-0.7.3.jar` containing `SIDScoreModuleExporter`.
`KICKASS_JAR`, `SIDSCORE_JAR`, and `OUTPUT_JAR` can override those paths.

For a Commodore Commander project, declare a module in the root ASM or an
imported ASM source, then register the plugin in the root:

```asm
// @sidscore "music/theme.sidscore" as Music at $3000
.plugin "net.resheim.cc.sidscore.kickass.SIDScoreArchive"
```

The score path is relative to the ASM file containing the declaration. The
build runner discovers unconditional declarations before assembly, so no
`sidScoreModules` JSON setting is needed. Multiple declarations can be used
when their namespaces and origins differ. Existing JSON module settings remain
supported.

The IDE/build runner supplies these JVM properties before KickAssembler starts:

```
-Dcc.sidscore.count=1
-Dcc.sidscore.0.source=/absolute/path/music.sidscore
-Dcc.sidscore.0.namespace=Music
-Dcc.sidscore.0.origin=$3000
-Dcc.sidscore.0.generatedAsm=/absolute/output/generated/music.asm
```

Indexes run from `0` to `count - 1`. All properties are required for every
module except `generatedAsm`, which is optional. Origins accept decimal,
`$`-prefixed hex, or `0x`-prefixed hex. Source
paths must be absolute and namespaces must be simple KickAssembler identifiers.
Each module must have a distinct namespace and origin. The plugin fails the
build with a source-specific message when SIDScore cannot parse or export a
file. When `generatedAsm` is set, the plugin atomically writes the exact ASM
stream it sends to KickAssembler and advertises that file URI in debug data.
Without it, KickAssembler sees a generated virtual ASM path in debug data.

The project source registers the plugin with:

```
.plugin "net.resheim.cc.sidscore.kickass.SIDScoreArchive"
```

The Java command must place KickAss, SIDScore CLI, and this plugin jar on the
classpath and launch `kickass.KickAssembler` instead of using `-jar`. The host
supplies the module origin and owns the IRQ. A multi-tune score still requires
only one plugin module entry: the exporter includes all its tunes in that
module, up to 254 tunes.

For a score with two tunes, select one by number in `A` when calling the root
`init`, then call root `play` once per video frame:

```asm
    lda #1
    jsr Music.init
    // From the host's frame IRQ:
    jsr Music.play
```

The generated module also exposes `Music.tune1.init/play` and
`Music.tune2.init/play`. Use the root entry points for normal playback: root
`play` advances the selected tune and any triggered effects from other tunes.
An effect named `Zap` in tune 2 is triggered with
`jsr Music.tune2.effect_Zap`; its SID writes begin on a subsequent `Music.play`
call. This lets an effect-only tune provide sound effects over tune 1 music.
Selecting an effect-only tune with `Music.init` automatically triggers that
tune's effects. Effects with a fixed `VOICE` use that SID voice, while
`VOICE ANY` selects an available effect voice. The caller must reserve
zero-page `$fb-$fc` while the player runs. The exporter rejects unsupported
effect parameters instead of silently omitting them. Each effect can last
1–4096 frames in the current module format.

The IRQ must save and restore `A`, `X`, and `Y` around `Music.play` and any
effect trigger. When effects from different tunes write the same SID voice in
one frame, the later tune's write wins. Use distinct fixed `VOICE` values for
effects intended to overlap. `VOICE ANY` allocates among active effects within
its own tune; it does not coordinate voice ownership across tunes.

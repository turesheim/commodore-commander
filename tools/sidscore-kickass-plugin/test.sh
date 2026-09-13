#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd "$script_dir/../.." && pwd)"
kickass_jar="${KICKASS_JAR:-$repo_dir/resources/KickAss.jar}"
sidscore_jar="${SIDSCORE_JAR:-$repo_dir/resources/sidscore-cli-0.7.3.jar}"
plugin_jar="${OUTPUT_JAR:-$repo_dir/resources/sidscore-kickass-plugin.jar}"
score_path="$script_dir/src/test/fixtures/effect_with_voice.sidscore"

"$script_dir/build.sh"
test_dir="$(mktemp -d)"
trap 'rm -rf "$test_dir"' EXIT

cat > "$test_dir/host.asm" <<'ASM'
.plugin "net.resheim.cc.sidscore.kickass.SIDScoreArchive"
*=$2000 "Host"
start:
    jsr Music.init
    jsr Music.play
    rts
ASM

classpath="$kickass_jar:$sidscore_jar:$plugin_jar"
generated_asm="$test_dir/generated/music.asm"
java -cp "$classpath" \
  -Dcc.sidscore.count=1 \
  "-Dcc.sidscore.0.source=$score_path" \
  -Dcc.sidscore.0.namespace=Music \
  '-Dcc.sidscore.0.origin=$3000' \
  "-Dcc.sidscore.0.generatedAsm=$generated_asm" \
  kickass.KickAssembler "$test_dir/host.asm" -odir "$test_dir" -vicesymbols -debugdump \
  > "$test_dir/valid.log" 2>&1 || {
    cat "$test_dir/valid.log" >&2
    exit 1
  }

if [[ ! -s "$generated_asm" ]]; then
  echo "Plugin did not materialize the generated ASM" >&2
  exit 1
fi
if ! grep -q 'Music' "$generated_asm"; then
  echo "Generated ASM is missing the configured namespace" >&2
  exit 1
fi
if ! grep -Fq "file://$generated_asm" "$test_dir/host.dbg"; then
  echo "Debug dump does not refer to the materialized ASM file" >&2
  cat "$test_dir/host.dbg" >&2
  exit 1
fi

python3 - "$test_dir/host.prg" <<'PY'
import pathlib
import sys

data = pathlib.Path(sys.argv[1]).read_bytes()
assert data[:2] == bytes([0x00, 0x20]), f"unexpected load address: {data[:2].hex()}"
assert data[2] == data[5] == 0x20, "host did not assemble both JSR instructions"
init = data[3] | (data[4] << 8)
play = data[6] | (data[7] << 8)
assert 0x3000 <= init < 0x10000, f"init outside SIDScore module: {init:04x}"
assert 0x3000 <= play < 0x10000, f"play outside SIDScore module: {play:04x}"
assert init != play, "init and play resolved to the same address"
assert len(data) > 0x1002, "generated music was not assembled into the PRG"
print(f"SIDScore plugin: Music.init=${init:04x}, Music.play=${play:04x}")
PY

multi_score_path="$script_dir/src/test/fixtures/multiple_tunes_with_effects.sidscore"
cat > "$test_dir/multi.asm" <<'ASM'
.plugin "net.resheim.cc.sidscore.kickass.SIDScoreArchive"
*=$2000 "Host"
start:
    lda #1
    jsr Score.init
    jsr Score.play
    jsr Score.tune1.effect_Blip
    jsr Score.tune2.effect_Zap
    jsr Score.play
    lda #2
    jsr Score.init
    jsr Score.play
    rts
ASM

multi_generated_asm="$test_dir/generated/multi.asm"
java -cp "$classpath" \
  -Dcc.sidscore.count=1 \
  "-Dcc.sidscore.0.source=$multi_score_path" \
  -Dcc.sidscore.0.namespace=Score \
  '-Dcc.sidscore.0.origin=$3000' \
  "-Dcc.sidscore.0.generatedAsm=$multi_generated_asm" \
  kickass.KickAssembler "$test_dir/multi.asm" -odir "$test_dir" -vicesymbols -debugdump \
  > "$test_dir/multi.log" 2>&1 || {
    cat "$test_dir/multi.log" >&2
    exit 1
  }
if ! grep -Fq "file://$multi_generated_asm" "$test_dir/multi.dbg"; then
  echo "Multi-tune debug dump does not refer to the generated ASM file" >&2
  exit 1
fi

python3 - "$test_dir/multi.prg" "$multi_generated_asm" <<'PY'
import pathlib
import re
import sys

data = pathlib.Path(sys.argv[1]).read_bytes()
asm = pathlib.Path(sys.argv[2]).read_text()
assert data[:2] == b'\x00\x20', f'unexpected load address: {data[:2].hex()}'
host = data[2:]
assert host[:2] == b'\xa9\x01', 'host did not select tune 1'
assert all(host[offset] == 0x20 for offset in (2, 5, 8, 11, 14, 19, 22)), 'host calls did not assemble as JSR'
assert host[17:19] == b'\xa9\x02', 'host did not select tune 2'
addresses = [host[offset + 1] | (host[offset + 2] << 8) for offset in (2, 5, 8, 11, 14, 19, 22)]
init, play, blip, zap, play_again, init_again, play_after_switch = addresses
assert init == init_again and play == play_again == play_after_switch, 'root entry points changed across tunes'
assert len({init, play, blip, zap}) == 4, 'effect trigger aliases another entry point'
assert all(address >= 0x3000 for address in addresses), 'a SIDScore entry point lies outside its module'
assert 'effect_Blip:' in asm, 'tune 1 effect was dropped from generated ASM'
assert 'effect_Zap:' in asm, 'effect-only tune was dropped from generated ASM'
assert asm.count('sfx_trigger:') == 2, 'effect triggers are missing their runtime'
assert asm.count('sfx_apply:') == 2, 'effect playback runtime is missing'
assert asm.count('sta $d400,x') >= 2, 'effect playback does not write SID voice registers'
assert re.search(r'sfx_data_1:\s*\.byte \$00,\$40', asm), 'Blip frequency was not encoded'
assert re.search(r'sfx_data_1:\s*\.byte \$00,\$30', asm), 'Zap frequency was not encoded'
print(f'SIDScore plugin: Score.init=${init:04x}, Score.play=${play:04x}, Blip=${blip:04x}, Zap=${zap:04x}')
PY

if java -cp "$classpath" \
  -Dcc.sidscore.count=1 \
  "-Dcc.sidscore.0.source=$test_dir/missing.sidscore" \
  -Dcc.sidscore.0.namespace=Music \
  '-Dcc.sidscore.0.origin=$3000' \
  kickass.KickAssembler "$test_dir/host.asm" -odir "$test_dir" \
  > "$test_dir/invalid.log" 2>&1; then
  echo "KickAssembler unexpectedly accepted a missing SIDScore source" >&2
  exit 1
fi
if ! grep -q "source is not a readable file" "$test_dir/invalid.log"; then
  cat "$test_dir/invalid.log" >&2
  exit 1
fi

printf 'THIS IS NOT A SIDSCORE FILE\n' > "$test_dir/broken.sidscore"
if java -cp "$classpath" \
  -Dcc.sidscore.count=1 \
  "-Dcc.sidscore.0.source=$test_dir/broken.sidscore" \
  -Dcc.sidscore.0.namespace=Music \
  '-Dcc.sidscore.0.origin=$3000' \
  kickass.KickAssembler "$test_dir/host.asm" -odir "$test_dir" \
  > "$test_dir/broken.log" 2>&1; then
  echo "KickAssembler unexpectedly accepted invalid SIDScore syntax" >&2
  exit 1
fi
if ! grep -q "failed to generate Music from $test_dir/broken.sidscore" "$test_dir/broken.log"; then
  cat "$test_dir/broken.log" >&2
  exit 1
fi

echo "SIDScore KickAssembler plugin integration test passed"

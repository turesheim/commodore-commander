#!/usr/bin/env bash
set -euo pipefail

vice_tag="${COMMODORE_COMMANDER_VICE_CI_TAG:-v3.10}"
vice_svn_url="${COMMODORE_COMMANDER_VICE_CI_SVN_URL:-https://svn.code.sf.net/p/vice-emu/code/tags/${vice_tag}/vice}"
data_dir="${COMMODORE_COMMANDER_VICE_CI_DATA_DIR:-${RUNNER_TEMP:-${TMPDIR:-/tmp}}/commodore-commander-vice-${vice_tag}-data}"

if command -v dpkg >/dev/null 2>&1; then
  packaged_basic="$(
    dpkg -L vice 2>/dev/null |
      grep '/C64/basic-901226-01\.bin$' |
      head -n 1 ||
      true
  )"
  if [ -n "$packaged_basic" ]; then
    dirname "$(dirname "$packaged_basic")"
    exit 0
  fi
fi

if [ ! -f "$data_dir/C64/basic-901226-01.bin" ] ||
   [ ! -f "$data_dir/C64/kernal-901227-03.bin" ] ||
   [ ! -f "$data_dir/C64/c64mem.sym" ]; then
  command -v svn >/dev/null 2>&1 || {
    echo "svn is required to export VICE resource data." >&2
    exit 1
  }
  rm -rf "$data_dir"
  mkdir -p "$(dirname "$data_dir")"
  svn export --quiet "$vice_svn_url/data" "$data_dir"
fi

test -f "$data_dir/C64/basic-901226-01.bin"
test -f "$data_dir/C64/kernal-901227-03.bin"
test -f "$data_dir/C64/c64mem.sym"
printf '%s\n' "$data_dir"

#!/usr/bin/env bash
set -euo pipefail

display="${XVFB_DISPLAY:-:99}"
screen="${XVFB_SCREEN:-1280x1024x24}"
xvfb_log="${XVFB_LOG:-/tmp/commodore-commander-xvfb.log}"

Xvfb "$display" -screen 0 "$screen" -nolisten tcp >"$xvfb_log" 2>&1 &
xvfb_pid=$!

cleanup() {
  kill "$xvfb_pid" >/dev/null 2>&1 || true
}
trap cleanup EXIT

sleep 1
if ! kill -0 "$xvfb_pid" >/dev/null 2>&1; then
  cat "$xvfb_log" >&2 || true
  exit 1
fi

export DISPLAY="$display"
export GSETTINGS_BACKEND="${GSETTINGS_BACKEND:-memory}"
export LIBGL_ALWAYS_SOFTWARE="${LIBGL_ALWAYS_SOFTWARE:-1}"
export NO_AT_BRIDGE="${NO_AT_BRIDGE:-1}"
npm run test:e2e:vice --workspace @commodore-commander/debug-adapter

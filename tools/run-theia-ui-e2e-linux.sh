#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$script_dir/run-with-xvfb.sh" \
  npm run test:e2e:theia:ui -- "$@"

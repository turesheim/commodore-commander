#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_PATH="${ROOT_DIR}/example-workspace"

cd "${ROOT_DIR}"
npm run theia:build

cd "${ROOT_DIR}/applications/electron"
"${ROOT_DIR}/node_modules/.bin/theia" start "${WORKSPACE_PATH}" --plugins=local-dir:plugins

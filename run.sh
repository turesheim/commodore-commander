#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_PATH="${ROOT_DIR}/example-workspace"

cd "${ROOT_DIR}"
mvn clean package -f ../SIDscore/net.resheim.sidscore/pom.xml && mv -f ../SIDscore/net.resheim.sidscore/bin/sidscore-cli-0.6.0.jar resources/
npm run theia:build

cd "${ROOT_DIR}/applications/electron"
"${ROOT_DIR}/node_modules/.bin/theia" start "${WORKSPACE_PATH}" --plugins=local-dir:plugins

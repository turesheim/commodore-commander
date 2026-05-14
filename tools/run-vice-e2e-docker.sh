#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
image="${VICE_E2E_DOCKER_IMAGE:-commodore-commander/vice-e2e:local}"
platform="${DOCKER_PLATFORM:-linux/amd64}"
node_modules_volume="${VICE_E2E_NODE_MODULES_VOLUME:-commodore-commander-vice-e2e-node-modules}"
npm_cache_volume="${VICE_E2E_NPM_CACHE_VOLUME:-commodore-commander-npm-cache}"

docker build \
  --platform "$platform" \
  --tag "$image" \
  --file "$repo_root/tools/docker/vice-e2e.Dockerfile" \
  "$repo_root/tools/docker"

docker run \
  --rm \
  --platform "$platform" \
  --volume "$repo_root:/workspace" \
  --volume "$node_modules_volume:/workspace/node_modules" \
  --volume "$npm_cache_volume:/root/.npm" \
  --workdir /workspace \
  --env CI=true \
  "$image" \
  "$@"

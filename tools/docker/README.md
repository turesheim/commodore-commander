# VICE E2E Docker Rig

Run the Linux VICE debugger end-to-end tests locally in a container:

```sh
npm run test:e2e:vice:docker
```

The container installs Debian's VICE package and runs `x64sc` behind a manual
Xvfb display via `tools/run-vice-e2e-linux.sh`. The Linux run uses VICE console
mode so the emulator process stays attached to the test harness. The container
discovers the installed VICE data directory from the Debian packages and passes
that directory through `-directory`.

The wrapper mounts the checkout at `/workspace`, installs only the
`@commodore-commander/debug-adapter` workspace dependencies, and stores
`node_modules` plus the npm cache in Docker volumes:

- `commodore-commander-vice-e2e-node-modules`
- `commodore-commander-npm-cache`

Useful overrides:

```sh
DOCKER_PLATFORM=linux/arm64 npm run test:e2e:vice:docker
VICE_E2E_DOCKER_IMAGE=cc-vice-e2e npm run test:e2e:vice:docker
```

To open a shell in the same image:

```sh
npm run test:e2e:vice:docker -- bash
```

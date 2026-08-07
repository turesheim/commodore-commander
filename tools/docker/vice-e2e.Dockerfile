FROM node:22-bookworm

ENV DEBIAN_FRONTEND=noninteractive

RUN sed -i \
      's/Components: main/Components: main contrib non-free non-free-firmware/' \
      /etc/apt/sources.list.d/debian.sources \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
      ca-certificates \
      dbus-x11 \
      subversion \
      vice \
      xauth \
      xvfb \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

ENV VICE_E2E=1
ENV VICE_EXECUTABLE=/usr/bin/x64sc

CMD ["bash", "-lc", "export VICE_RESOURCES_PATH=\"$(bash tools/resolve-vice-ci-resources.sh)\" && export VICE_ARGS=\"[\\\"-directory\\\",\\\"$VICE_RESOURCES_PATH\\\",\\\"-console\\\",\\\"+sound\\\"]\" && test -d \"$VICE_RESOURCES_PATH/C64\" && test -x \"$VICE_EXECUTABLE\" && npm ci --workspace @commodore-commander/debug-adapter --include-workspace-root=false && bash tools/run-vice-e2e-linux.sh"]

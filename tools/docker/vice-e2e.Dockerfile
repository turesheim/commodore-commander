FROM node:22-bookworm

ENV DEBIAN_FRONTEND=noninteractive

RUN sed -i \
      's/Components: main/Components: main contrib non-free non-free-firmware/' \
      /etc/apt/sources.list.d/debian.sources \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
      ca-certificates \
      dbus-x11 \
      vice \
      xauth \
      xvfb \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

ENV VICE_E2E=1
ENV VICE_EXECUTABLE=/usr/bin/x64sc
ENV VICE_RESOURCES_PATH=/workspace/net.sourceforge.vice.cocoa.macosx.aarch64/vice/VICE.app/Contents/Resources
ENV VICE_ARGS='["-directory","/workspace/net.sourceforge.vice.cocoa.macosx.aarch64/vice/VICE.app/Contents/Resources/share/vice","-console","+sound"]'

CMD ["bash", "-lc", "test -d \"$VICE_RESOURCES_PATH/share/vice\" && test -x \"$VICE_EXECUTABLE\" && npm ci --workspace @commodore-commander/debug-adapter --include-workspace-root=false && bash tools/run-vice-e2e-linux.sh"]

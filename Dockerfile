FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates python3 make g++ pkg-config && rm -rf /var/lib/apt/lists/*
COPY --chown=node:node bootstrap/ /bootstrap/
RUN mkdir -p /opt/hela && chown node:node /opt/hela
USER node
ARG HELA_PROFILE=dev-workspace
ARG HELA_WITHOUT_MODEL=0
ENV HELA_PROBE_DEBUG=1
RUN if [ "$HELA_WITHOUT_MODEL" = 1 ]; then node /bootstrap/scripts/install.mjs --mode runtime --profile "$HELA_PROFILE" --prefix /opt/hela --client skip --non-interactive --without-model; else node /bootstrap/scripts/install.mjs --mode runtime --profile "$HELA_PROFILE" --prefix /opt/hela --client skip --non-interactive; fi
RUN rm -rf /opt/hela/.build-home && chmod -R a+rX /opt/hela

FROM node:22-bookworm-slim
ARG HELA_PROFILE=dev-workspace
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates python3 && rm -rf /var/lib/apt/lists/*
COPY --from=build --chown=node:node /opt/hela/ /opt/hela/
RUN mkdir -p /data /workspace && chown node:node /data /workspace
USER node
ENV HOME=/data XDG_DATA_HOME=/data XDG_CACHE_HOME=/data/cache XDG_CONFIG_HOME=/data/config GUARDIAN_CENTRAL_DB=/data/memory.db GUARDIAN_PROJECT_ROOT=/workspace HELA_ECOSYSTEM_ROOT=/opt/hela/hela-mcp-ecosystem
ENV HELA_PROFILE=$HELA_PROFILE
ENV NEEDLE_ENGINE_PATH=/opt/hela/chaining-mcp/assets/needle/needle3 NEEDLE_MODEL_PATH=/opt/hela/chaining-mcp/assets/needle/needle3.cact NEEDLE_TOOL_INDEX_PATH=/data/needle-tools.idx
WORKDIR /workspace
CMD ["node", "/opt/hela/hela-runtime/dist/index.js"]

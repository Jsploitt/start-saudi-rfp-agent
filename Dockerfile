# The base image carries the browsers already, so we never run
# `npx playwright install`. The tag must match the playwright version in
# package.json exactly: image and library drift is a silent breakage.
ARG PLAYWRIGHT_VERSION=1.63.0

# --- dependencies -----------------------------------------------------------
# A separate stage, because better-sqlite3 is a native module and the base image
# has no compiler. prebuild-install usually finds a binary for this Node, but
# "usually" is not a property you want in the one build that happens on demo
# morning, so the toolchain is here as a fallback. It stays out of the runtime
# image: only node_modules is copied forward.
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble AS deps

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# npm ci from the lockfile, never a copied host node_modules: the Agent SDK
# ships a ~227 MB per-platform binary and the host has win32-x64. The lockfile
# carries all eight platform packages, so linux-x64 resolves here.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# --- runtime ----------------------------------------------------------------
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble

# The Agent SDK subprocess writes under HOME. Without a writable one it fails in
# a way that reads like an auth error.
ENV HOME=/home/app \
    NODE_ENV=production \
    DATA_DIR=/data \
    PORT=5173

RUN mkdir -p /home/app /data /app && chown -R 1000:1000 /home/app /data /app

WORKDIR /app

COPY --from=deps --chown=1000:1000 /app/node_modules ./node_modules
COPY --chown=1000:1000 package.json package-lock.json tsconfig.json ./
COPY --chown=1000:1000 src ./src
COPY --chown=1000:1000 public ./public
COPY --chown=1000:1000 fixtures ./fixtures
COPY --chown=1000:1000 start-saudi-kit ./start-saudi-kit

USER 1000
EXPOSE 5173
VOLUME ["/data"]

# tsconfig has noEmit and there is no build step, so tsx runs the TypeScript
# directly. That is why tsx is a runtime dependency, not a dev one.
#
# The binary is named directly rather than run through npx: npx puts an npm shim
# in front, SIGTERM lands on npm instead of the app, and a deploy then kills the
# process mid-write rather than letting it close its listeners and its database.
CMD ["./node_modules/.bin/tsx", "src/server.ts"]

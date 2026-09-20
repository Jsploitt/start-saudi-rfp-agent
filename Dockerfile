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

# --- the operator UI --------------------------------------------------------
# The React app is a build artifact, and without this stage the image shipped
# without one: `web/dist` does not exist, `existsSync(webDist)` is false, and
# the container serves a working API behind no interface at all. It answers its
# health check perfectly while being completely unusable, which is the worst
# way for this to fail.
#
# It builds here rather than on the host so the image does not depend on
# someone having remembered to run `vite build` before `git push`.
FROM node:22-bookworm-slim AS web

WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci && npm cache clean --force

COPY web/ ./
# The app imports two things from outside web/: `@contracts` ->
# ../src/contracts.ts, and `@brand` -> ../start-saudi-kit/brand. Both are
# resolved by vite at build time, so both have to be in the context.
#
# One file, not three. `contracts.ts` imports nothing at all, which is what
# lets this stage typecheck it without the server's node_modules — and it is
# why the dependency runs contract-first rather than the contract re-exporting
# from `events.ts`.
COPY src/contracts.ts /app/src/contracts.ts
COPY start-saudi-kit/brand /app/start-saudi-kit/brand
RUN npm run build

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

# The built UI. `server.ts` serves this directly and falls back to index.html
# for client routes, so /s/<id> survives a reload and a pasted link.
COPY --from=web --chown=1000:1000 /app/web/dist ./web/dist

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

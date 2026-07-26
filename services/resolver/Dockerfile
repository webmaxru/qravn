# syntax=docker/dockerfile:1

# ---- build stage: full toolchain, compiles TypeScript to dist/ ----
FROM node:22-alpine AS build
WORKDIR /app

# Install deps against the lockfile first for better layer caching. These are
# devDependencies only (typescript, vitest, oxlint); nothing ships at runtime.
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- runtime stage: distroless, non-root, no shell, no toolchain ----
# The service imports only Node built-ins (zero runtime dependencies), so the
# final image contains just the compiled dist/ and the Node runtime. No
# node_modules, no npm, no build tools -> tiny image and fast cold start for
# scale-to-zero Container Apps.
FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080

COPY --from=build /app/dist ./dist

EXPOSE 8080

# distroless has no shell, so use the exec form with the absolute node path.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD ["/nodejs/bin/node", "/app/dist/healthcheck.js"]

# The distroless nodejs image's ENTRYPOINT is already ["/nodejs/bin/node"].
# Runs as the built-in "nonroot" user (uid 65532).
CMD ["dist/index.js"]

# =============================================================================
# Geo Backend — Production Dockerfile
#
# Multi-stage build: deps → prisma → runtime
# Non-root user, dumb-init for PID 1 signal handling, optimized layer caching.
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Build — install deps, generate Prisma client, then prune
# ---------------------------------------------------------------------------
FROM node:jod-alpine3.23 AS build

WORKDIR /app

# Copy package manifests
COPY package.json package-lock.json ./

# Full install needed for Prisma CLI (devDependency)
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --ignore-scripts

# Copy schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Prune devDependencies (keeps generated client intact)
RUN npm prune --omit=dev

# ---------------------------------------------------------------------------
# Stage 2: Production Runtime
# ---------------------------------------------------------------------------
FROM node:jod-alpine3.23 AS runtime

LABEL maintainer="kiero-teknologi" \
      app.name="geo-backend" \
      app.environment="production"

# dumb-init + non-root user + system upgrade in single layer
RUN apk add --no-cache dumb-init && \
    apk upgrade --no-cache && \
    addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001 -G nodejs

WORKDIR /app

# Copy pruned production dependencies (includes generated Prisma client)
COPY --from=build --chown=appuser:nodejs /app/node_modules ./node_modules

# Copy application source selectively (no COPY . . — minimal attack surface)
COPY --chown=appuser:nodejs package.json ./
COPY --chown=appuser:nodejs index.js ./
COPY --chown=appuser:nodejs prisma ./prisma
COPY --chown=appuser:nodejs config ./config
COPY --chown=appuser:nodejs middleware ./middleware
COPY --chown=appuser:nodejs routes ./routes
COPY --chown=appuser:nodejs services ./services
COPY --chown=appuser:nodejs utils ./utils

# Create runtime directories (logs & archives are generated at runtime)
RUN mkdir -p logs archives && chown -R appuser:nodejs logs archives

USER appuser

ENV NODE_ENV=production

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "index.js"]
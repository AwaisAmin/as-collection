# syntax=docker/dockerfile:1.7
# Production image for apps/api. Build from the REPOSITORY ROOT (pnpm workspace):
#   docker build -f apps/api/Dockerfile -t as-collection-api .
#   docker run --env-file apps/api/.env -p 4000:4000 as-collection-api

ARG NODE_VERSION=24

# ---- build: install the workspace slice, compile, then extract a prod-only bundle ----
FROM node:${NODE_VERSION}-alpine AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /repo

# Manifests first so dependency layers are cached until a lockfile/package.json changes.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY packages/typescript-config/package.json packages/typescript-config/
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @as/api... --ignore-scripts

COPY packages/typescript-config packages/typescript-config
COPY apps/api apps/api
RUN pnpm --filter @as/api build \
 && pnpm --filter @as/api deploy --prod --legacy /out

# ---- runtime: minimal, non-root ----
FROM node:${NODE_VERSION}-alpine AS runtime
ENV NODE_ENV=production PORT=4000
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--enable-source-maps", "dist/main.js"]

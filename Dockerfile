# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@10.20.0 --activate
WORKDIR /repo

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/portifo-api/package.json packages/portifo-api/package.json
COPY packages/portifo-web/package.json packages/portifo-web/package.json
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build
# `build` (this stage) still has devDependencies like drizzle-kit and tsx —
# used directly as the `migrate`/`seed` one-off target in docker-compose.yml.

FROM build AS prod-deps
RUN CI=true pnpm install --prod --frozen-lockfile

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /repo

COPY --from=prod-deps /repo/pnpm-workspace.yaml /repo/package.json ./
COPY --from=prod-deps /repo/node_modules ./node_modules
COPY --from=prod-deps /repo/packages/portifo-api/package.json packages/portifo-api/package.json
COPY --from=prod-deps /repo/packages/portifo-api/node_modules packages/portifo-api/node_modules
COPY --from=prod-deps /repo/packages/portifo-api/dist packages/portifo-api/dist
# drizzle-kit reads these directly (not compiled by tsc — outside src/), needed
# at runtime so `drizzle-kit migrate` works against the production image.
COPY --from=prod-deps /repo/packages/portifo-api/drizzle.config.ts packages/portifo-api/drizzle.config.ts
COPY --from=prod-deps /repo/packages/portifo-api/drizzle packages/portifo-api/drizzle
COPY --from=prod-deps /repo/packages/portifo-web/dist packages/portifo-web/dist

WORKDIR /repo/packages/portifo-api
EXPOSE 3000
CMD ["node", "dist/index.js"]

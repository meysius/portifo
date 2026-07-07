# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Portifo — a portfolio tracker mobile app (multi-currency investments + cash, used as a mobile-web PWA). A pnpm workspace monorepo with two packages:

- `packages/portifo-web` — Vite + React + Ionic SPA (the mobile frontend, styled as an iOS-mode PWA)
- `packages/portifo-api` — backend on `simple-wire`, a thin opinionated framework over Express (see `packages/portifo-api/CLAUDE.md` for the framework's architecture rules — domain slices, DI, controllers)

**`docs/`** holds the product spec — flows, screens, and domain model. `docs/design-system.html` is the source of truth for design tokens (`--surface`, `--fg-1..3`, `--gain`, `--loss`, etc.) that `portifo-web` consumes.

## Commands

Run from repo root (pnpm workspace, `pnpm@10.20.0`):

```bash
pnpm dev         # runs dev in both packages in parallel (web on :5173, api on :3000)
pnpm build       # builds both packages
pnpm typecheck   # tsc --noEmit in both packages
pnpm lint        # oxlint (web only currently)
pnpm test        # no test scripts defined in either package yet
```

Per-package, or scope with pnpm's `--filter`/`-C`:

```bash
pnpm --filter portifo-api dev              # tsx watch src/index.ts
pnpm --filter portifo-api db:create        # createdb from DATABASE_URL
pnpm --filter portifo-api db:generate:migrations  # drizzle-kit generate
pnpm --filter portifo-api db:migrate       # drizzle-kit migrate
pnpm --filter portifo-api db:studio        # drizzle-kit studio

pnpm --filter portifo-web dev              # vite
pnpm --filter portifo-web preview          # vite preview
```

Both packages require a local `.env` (copy from `.env.example`): the API needs `DATABASE_URL` (Postgres); the web app needs `VITE_API_URL` (defaults to `http://localhost:3000`).

## Architecture

### Backend (`packages/portifo-api`)

Follows `simple-wire`'s three patterns — domain/presentation separation, domain split into department slices under `src/domain/<slice>/` (each with `.schema.ts` + `.repo.ts` + `.service.ts`), and manual constructor DI wired in `src/setup/app.ts`. New domains are registered in both `src/setup/app.ts` (instantiate repo/service, add controller) and `src/setup/db.ts` (schema aggregator for Drizzle). Full details and code patterns are in `packages/portifo-api/CLAUDE.md` — read it before adding a domain slice or controller.

DB layer is Drizzle ORM over Postgres; `drizzle-zod` derives Zod schemas/types from table definitions (`createSelectSchema`/`createInsertSchema`/`createUpdateSchema`) rather than hand-writing DTOs.

In production, `src/index.ts` serves the built web SPA as static files and falls back to `index.html` for client-side routing (`../../portifo-web/dist`) — the two packages ship as one deployable.

### Frontend (`packages/portifo-web`)

Vite + React + `@ionic/react`, routed with `IonReactRouter`/`react-router` and rendered in forced `mode: "ios"` for a native iOS feel regardless of host platform. Design system primitives live in `src/components/ds.tsx`, sourced from `docs/design-system.html`'s token names. Dev server proxies API routes to the backend — new API route prefixes must be added to the `server.proxy` map in `vite.config.ts` (`/users`, `/auth`, `/accounts`, `/transactions`, `/portfolio`, `/market` currently) or requests will 404 in dev.

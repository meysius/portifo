# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Portifo — a portfolio tracker mobile app (multi-currency investments + cash, used as a mobile-web PWA). A pnpm workspace monorepo with two packages:

- `packages/portifo-web` — Vite + React + Ionic SPA (the mobile frontend, styled as an iOS-mode PWA)
- `packages/portifo-api` — backend on `simple-wire`, a thin opinionated framework over Express (see `packages/portifo-api/CLAUDE.md` for the framework's architecture rules — domain slices, DI, controllers)

## How to work
Always check if a development server is running already on the expected ports (`:5173` for web, `:3000` for API). if not never try to start one in the background, always ask user to do this manually.

## Design system
`design-system/` is the design system (open `design-system/index.html` for the gallery). Before designing or building any screen, read `design-system/README.md` and `design-system/screen-anatomy.md`, and follow the rules in `design-system/components/<Name>/README.md` for every part you use. When a change alters a token or a component's rules, update `design-system/` in the same change.


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


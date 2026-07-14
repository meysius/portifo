# Portifo

A multi-currency portfolio tracker — investments and cash accounts in one place — built as a mobile-web PWA styled to feel native on iOS.

## Stack

- **`packages/portifo-web`** — Vite + React + [Ionic](https://ionicframework.com/) SPA, rendered in forced iOS mode for a native feel on any device
- **`packages/portifo-api`** — Node/Express backend on [`simple-wire`](https://www.npmjs.com/package/simple-wire), Postgres via Drizzle ORM
- Auth via Google OAuth; market data via [`yahoo-finance2`](https://www.npmjs.com/package/yahoo-finance2) (no API key required)

In production the API serves the built web app as static files, so the two packages ship as a single deployable process.

## Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/) `10.20.0` (`corepack enable` will pick this up from `packageManager` in `package.json`)
- A Postgres database
- A [Google OAuth client ID](https://console.cloud.google.com/apis/credentials) (Web application type) — add `http://localhost:5173` as an authorized JavaScript origin for local dev

## Setup

```bash
pnpm install

cp packages/portifo-api/.env.example packages/portifo-api/.env
cp packages/portifo-web/.env.example packages/portifo-web/.env
```

Fill in the copied `.env` files:

| File | Variable | Notes |
|---|---|---|
| `packages/portifo-api/.env` | `DATABASE_URL` | Postgres connection string |
| | `GOOGLE_CLIENT_ID` | Your Google OAuth client ID |
| | `SESSION_SECRET` | Any long random string (signs the session cookie) |
| `packages/portifo-web/.env` | `VITE_API_URL` | Defaults to `http://localhost:3000` |
| | `VITE_GOOGLE_CLIENT_ID` | Same Google OAuth client ID as above |

Create the database and run migrations:

```bash
pnpm --filter portifo-api db:create        # createdb from DATABASE_URL
pnpm --filter portifo-api db:migrate        # apply Drizzle migrations
```

Optionally seed some sample data — copy `packages/portifo-api/src/scripts/seed.data.example.json` to `seed.data.json` next to it (git-ignored), fill in your own accounts/transactions, then run:

```bash
pnpm --filter portifo-api seed
```

## Development

```bash
pnpm dev         # runs both packages in parallel — web on :5173, api on :3000
```

Other useful commands, run from the repo root:

```bash
pnpm build       # builds both packages
pnpm typecheck   # tsc --noEmit in both packages
pnpm lint        # oxlint (web only currently)
```

Per-package equivalents (or scope any command with pnpm's `--filter`):

```bash
pnpm --filter portifo-api dev              # tsx watch src/index.ts
pnpm --filter portifo-api db:studio        # drizzle-kit studio

pnpm --filter portifo-web dev              # vite
pnpm --filter portifo-web preview          # vite preview
```

## Deployment

Build both packages, then run the API in production mode — it serves the built web app itself:

```bash
pnpm build
NODE_ENV=production pnpm --filter portifo-api start
```

Set `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `SESSION_SECRET`, and `PORT` in the deployment environment, and add your production domain as an authorized JavaScript origin on the Google OAuth client.

## License

[MIT](LICENSE)

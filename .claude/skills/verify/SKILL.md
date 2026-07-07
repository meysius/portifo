---
name: verify
description: How to drive the Portifo apps in a real browser to verify frontend changes end-to-end.
---

# Verifying Portifo frontend changes

## Servers

`pnpm dev` from the repo root runs everything; individually: api on :3000,
portifo-web on :5173. Check `lsof -nP -iTCP:5173 -sTCP:LISTEN` first —
they're usually already running.

**Vite serves stale TS modules and CSS after edits.** Before driving the
app, `curl -s http://localhost:5173/src/<changed-file>` and grep for your
change; if stale, kill the vite process and restart it (`pnpm dev` in the
package, nohup + background).

## Browser handle

claude-in-chrome is often not connected. What works: `playwright-core`
(npm-install it in the scratchpad — it is NOT in the repo's node_modules)
driving the cached Chromium at
`~/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google
Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
(headless, viewport 390x844, deviceScaleFactor 2 for the iPhone target).

## Auth (no code changes needed)

Mint a session cookie: sign `{ sub: <userId> }` with `jsonwebtoken` using
`SESSION_SECRET` from `packages/portifo-api/.env`, set it as cookie
`portifo_session` for the app origin. Get a real user id:
`psql $DATABASE_URL -tAc "select id,email from users limit 3"`
(DATABASE_URL also in that .env; me.feghhi@gmail.com is the seeded main
user with holdings).

## Driving the app

- Tabs: `ion-tab-button[tab="holdings"|"transactions"|"accounts"|"settings"]`.
- Detail pages hide the tab bar — navigate back before switching tabs.
- On Holdings, `ion-item` #0 is the Cash row; holdings start at nth(1);
  asset detail is at `/asset/:symbol`.
- Emulate the OS theme with `page.emulateMedia({ colorScheme })`; the
  manual appearance setting persists in `localStorage["portifo.theme"]`
  (restore it to System when done).
- After `ion-tab-button` / segment clicks, allow ~400-600ms for Ionic
  transitions before screenshotting.

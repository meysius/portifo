# Production deploy

The server pulls its releases. GitHub has no credentials for it and no way in.

1. **On every push to `main`**, `.github/workflows/deploy.yml` builds the app and publishes a GitHub release named `deploy-<commit>`. It holds `portifo.tar.gz` and `release.txt` (the commit, plus the tarball's SHA-256), and is marked Latest. The workflow keeps the newest 5 releases and only needs the built-in `GITHUB_TOKEN`.
2. **GitHub's release webhook** calls `POST https://portifo.feghhi.com/hooks/github`. The API checks the HMAC signature (`GITHUB_WEBHOOK_SECRET`). When a release is published, it writes that release's commit to `/opt/portifo/shared/deploy-requested`. The API ignores every other release event.
3. **`portifo-deploy.path`** sees that file change and starts **`portifo-deploy.service`**, which runs `/usr/local/sbin/portifo-deploy`. **`portifo-deploy.timer`** also starts it every 5 minutes, in case a webhook is lost or the API is down.
4. **The script** reads `release.txt` from the Latest release on GitHub and stops if that commit is already live. Latest updates a few seconds after the "published" webhook. So if the webhook named a commit and Latest still shows the live one, the script re-checks every 5 seconds for up to 2 minutes. That commit only sets how long to wait. The script deploys whatever Latest says, so even a leaked webhook secret can only make the server check GitHub early. Once Latest is a commit that isn't live, the script downloads the tarball and checks it against the SHA-256. Then it extracts the release, runs `migrate.sh`, switches `/opt/portifo/current`, restarts `portifo` and waits for it to answer. If the new release doesn't come up, it switches back to the previous one and won't retry that commit.

Only `systemctl restart` and the checks run as root. Downloading, extracting, migrating and switching run as `portifo`. The script and units are installed by hand from this folder. Never install them from a release, so a push to `main` can't change what runs as root.

## Operating it

```bash
journalctl -u portifo-deploy -n 50        # what the last deploys did
systemctl start portifo-deploy            # check GitHub now
systemctl list-timers portifo-deploy      # next scheduled check
```

On GitHub, each webhook delivery and its response are listed under Settings → Webhooks → (the hook) → Recent Deliveries.

**Roll back:** mark an older release Latest with `gh release edit deploy-<commit> --latest`, or delete the bad release. The server deploys whatever is Latest at its next check, within 5 minutes (only a published release triggers an immediate check). Migrations never roll back, so each one must still work with the release before it.

**After a failed start:** the server won't retry that commit. Push a fix, or delete `/var/lib/portifo-deploy/failed-commit` and run `systemctl start portifo-deploy`.

## Installing or updating the server side

Run from a checkout, as root on the server, whenever any of these files change:

```bash
install -m 0755 deploy/portifo-deploy /usr/local/sbin/portifo-deploy
install -m 0644 deploy/portifo-deploy.service deploy/portifo-deploy.path deploy/portifo-deploy.timer deploy/portifo.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now portifo-deploy.path portifo-deploy.timer
```

The webhook needs `GITHUB_WEBHOOK_SECRET` (32+ random characters) in `/opt/portifo/shared/.env`. Set the same value on a repository webhook: Settings → Webhooks, payload URL `https://portifo.feghhi.com/hooks/github`, content type `application/json`, only the **Releases** event.

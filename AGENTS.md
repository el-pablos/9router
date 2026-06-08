# AGENTS.md — 9router (proxy.tams.codes)

> Project-native ops guide. Loaded automatically by the agent in this cwd.
> Scope: how this checkout is built, deployed, and served in production.

## What this is

- `/root/work/9router` is a checkout of `decolua/9router` (Next.js 16 app, plain JS).
- It is served in **production** at `https://proxy.tams.codes` as an OpenAI/Anthropic-compatible AI gateway.
- Runtime: Next.js **standalone** build (`output: "standalone"` in `next.config.mjs`), run under **PM2**, fronted by **nginx**.

## Runtime topology

```
Internet
  -> nginx (proxy.tams.codes, TLS via certbot)
       |- /_next/static/*  -> served FROM DISK (symlink)            [restart-immune]
       |- *.svg/png/ico/...-> served FROM DISK (public/ symlink)    [restart-immune]
       \- everything else  -> proxy http://127.0.0.1:20129  (PM2 app)
  PM2 app: 9router-source-20129  ->  .next/standalone/server.js  (PORT=20129, HOSTNAME=127.0.0.1)
```

- PM2 process name: **`9router-source-20129`**
- Internal bind: **`127.0.0.1:20129`**
- nginx site: `/etc/nginx/sites-available/proxy.tams.codes` (symlinked into `sites-enabled`)
- Shared state / DB: `/root/.9router/` (SQLite `better-sqlite3` at `/root/.9router/db/data.sqlite`) — NOT under the web root, never exposed.
- PM2 resurrect on reboot: `pm2-root.service` (systemd) + `pm2 save`.

## Static assets served from disk (why restarts are safe)

nginx serves static directly from disk via **stable symlinks**, so `pm2 restart` never causes 500s on assets:

```
/var/www/9router-static/_next/static -> /root/work/9router/.next/standalone/.next/static
/var/www/9router-static/public       -> /root/work/9router/.next/standalone/public
```

- `location ^~ /_next/static/ { root /var/www/9router-static; try_files $uri @app; }`
- regex `location ~* \.(svg|png|ico|jpe?g|gif|webp|woff2?|ttf|eot|webmanifest)$ { root .../public; try_files $uri @app; }`
- `location @app` = identical proxy fallback (so a missing file is still proxied — self-healing).
- `root` + nested symlink is used (NOT `alias`) because `alias`+`try_files` is buggy on nginx 1.18.
- Permissions: `/root` is `drwx--x--x` (world-traversable), children `drwxr-xr-x` — `www-data` can read through the symlinks. No chmod needed.
- Verify disk-serving: `curl -sI https://proxy.tams.codes/_next/static/css/<f>.css | grep x-static-source` → `disk`.

## Deploy / reload after code changes in this cwd

nginx does NOT need touching for code changes. After editing source:

**Shortcut: just run `./deploy.sh`** (in cwd) — it does build + symlink self-heal + rsync + pm2 restart + verify (health 200 and BUILD_ID match), and exits non-zero on failure. Use `./deploy.sh --no-build` to skip the build and only re-sync assets + restart. The manual steps below are what the script automates:

```bash
cd /root/work/9router
npm run build
rsync -a --delete .next/static/ .next/standalone/.next/static/
rsync -a --delete public/        .next/standalone/public/
NODE_ENV=production PORT=20129 HOSTNAME=127.0.0.1 \
  BASE_URL=https://proxy.tams.codes NEXT_PUBLIC_BASE_URL=https://proxy.tams.codes \
  CLOUD_URL=https://proxy.tams.codes NEXT_PUBLIC_CLOUD_URL=https://proxy.tams.codes \
  pm2 restart 9router-source-20129 --update-env
```

- The two `rsync` steps are REQUIRED: standalone build does NOT include static assets; symlinks point into `.next/standalone`, so assets must be copied there each build.
- During the ~2s restart, static stays HTTP 200 (served from disk); only dynamic routes (`/api`, `/v1`, pages) blip.
- Verify after: `curl -s -o /dev/null -w '%{http_code}' https://proxy.tams.codes/api/health` → `200`.
- `BUILD_ID` at `.next/BUILD_ID` must match `.next/standalone/.next/BUILD_ID` after rsync.
- Persist process list once: `pm2 save`.

If you change nginx config itself: `nginx -t && nginx -s reload` (graceful, zero downtime).
Pre-static-change nginx backup: `/root/backups/nginx-static-20260529T092811Z/proxy.tams.codes.bak`.

## Tests

- Unit tests live in `/root/work/9router/tests` (Vitest). Run from there:
  `CI=1 NO_COLOR=1 NODE_PATH=/tmp/node_modules /tmp/node_modules/.bin/vitest run --testTimeout=30000 unit/<file>.test.js`
- Vitest binary is at `/tmp/node_modules/.bin/vitest` (installed out-of-tree). Config aliases `@`→`src`, `open-sse`→`open-sse`.
- Known PRE-EXISTING failure (not from our work): `codex-refresh-token.test.js > keep old refresh_token` — global fetch isolation; ignore unless touching tokenRefresh.
- LSP `typescript-language-server` is NOT installed; `lsp_diagnostics` will say so. Rely on `npm run build` (it runs the TS check) instead.

## Codex provider — token classes (IMPORTANT)

- Codex backend `chatgpt.com/backend-api/codex/responses` ACCEPTS only tokens minted by the **Codex CLI OAuth client** (`client_id app_EMoam…`). It validates the CLIENT, not scopes.
- A raw **ChatGPT web session** `accessToken` from `chatgpt.com/api/auth/session` has `client_id app_X8zY…` (ChatGPT web app) → backend returns **401 Unauthorized** for inference, even though it has `model.request`/`model.read` scopes. This is an upstream OpenAI limitation; no 9router code can fix it.
- "Import ChatGPT Session" (`/api/oauth/codex/import-token`, authType `access_token`) stores the token without refresh and SKIPS the backend probe in the connection test (so the test shows green), but real inference may still 401 if the token is the wrong class.
- For a Codex connection that actually serves inference: use the **"Add" OAuth flow** (or `codex login` → import `~/.codex/auth.json`), which mints the `app_EMoam…` token.

## Conventions / guardrails

- Plain JS, no TypeScript syntax. Match existing patterns.
- NEVER commit/push unless explicitly asked. Origin is `decolua/9router`.
- NEVER print/persist real user tokens (ChatGPT session JSON, accessToken, sessionToken) outside the app DB import flow.
- Static assets under `/var/www/9router-static` are public client bundles only — DB/.env are NOT reachable there.

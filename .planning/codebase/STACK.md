# Technology Stack

**Analysis Date:** 2026-06-07

## Languages

**Primary:**
- JavaScript (ES modules, ESNext) — entire app, Node and browser code. No TypeScript; types come from JSDoc comments where annotated.

**Secondary:**
- Shell (`start.sh`) — single-line Docker convenience script.
- PowerShell — invoked at runtime by the CLI for Windows tray (NotifyIcon) instead of a native binary. See `cli/cli.js`.

## Runtime

**Environment:**
- Node.js 22 (`node:22-alpine` in `Dockerfile`).
- CLI requires `node >= 18.0.0` (`cli/package.json` engines).
- Bun is supported as an alternate runtime via `npm run dev:bun` / `start:bun` (`package.json`).

**Package Manager:**
- npm (no `pnpm-lock.yaml` or `yarn.lock`; `package.json` uses `npm install` in Dockerfile).
- Lockfile: not committed (`.gitignore` likely excludes; Docker build runs `npm install` without `npm ci`).

## Frameworks

**Core:**
- Next.js 16.1.6 (`next` in `package.json`) — App Router under `src/app/`, output mode `standalone` (`next.config.mjs`).
- React 19.2.4 / React DOM 19.2.4.
- Express 5.2.1 — used inside the MITM child process at `src/mitm/server.js`, not for the main HTTP server (Next.js handles the dashboard and `/api/*`).

**Testing:**
- Vitest 4.0.0 — only inside `tests/` (`tests/package.json`, `tests/vitest.config.js`). Vitest is installed under `/tmp/node_modules` per the test script and is not part of the root project deps.

**Build/Dev:**
- Webpack via Next.js (`next dev --webpack`, `next build --webpack`). Turbopack root is configured but webpack is the active builder.
- esbuild 0.25.12 — used by the CLI build script (`cli/scripts/build-cli.js`).
- Tailwind CSS v4 with `@tailwindcss/postcss` plugin (`postcss.config.mjs`).
- ESLint 9 with `eslint-config-next` (`eslint.config.mjs`).

## Key Dependencies

**Critical (request routing / proxy core, all in `package.json`):**
- `undici` 7.19.2 — primary HTTP client used by `open-sse/utils/proxyFetch.js` and providers; patches global fetch with proxy support.
- `http-proxy-middleware` 3.0.5 — used for `/v1/**` rewrites and proxying to upstream LLM providers.
- `socks-proxy-agent` 8.0.5 — outbound SOCKS proxy support for upstream calls.
- `node-forge` 1.3.3 — TLS / certificate generation for the MITM CA (`src/mitm/cert/`).
- `selfsigned` 5.5.0 — generates self-signed certs for local HTTPS.
- `jose` 6.1.3 — JWT signing/verification for the dashboard session and OIDC (`src/lib/auth/oidc.js`, `src/lib/auth/dashboardSession.js`).
- `bcryptjs` 3.0.3 — password hashing for the dashboard login.

**Database:**
- `sql.js` 1.14.1 — pure-JS SQLite, the always-available fallback (`src/lib/db/adapters/sqljsAdapter.js`).
- `better-sqlite3` 12.6.2 — declared in `optionalDependencies`. The CLI also lazy-installs it into `~/.9router/runtime/node_modules` (see `cli/hooks/postinstall.js`) to avoid blocking install on systems without build tools.
- Built-in `node:sqlite` (Node ≥22.5) and `bun:sqlite` are auto-detected at runtime in `src/lib/db/driver.js`. Driver fallback order: `bun:sqlite` → `better-sqlite3` → `node:sqlite` → `sql.js`.

**UI / dashboard:**
- `zustand` 5.0.10 — client-side state stores under `src/store/`.
- `@xyflow/react` 12.10.1 — flow graph editor (provider-nodes / combos UI).
- `@dnd-kit/*` (core 6.3.1, sortable 10.0.0, modifiers 9.0.0, utilities 3.2.2) — drag-and-drop in the dashboard.
- `@monaco-editor/react` 4.7.0 + `monaco-editor` 0.55.1 — JSON / code editing surfaces.
- `recharts` 3.7.0 — usage / observability charts.
- `material-symbols` 0.44.6 — icons.
- `marked` 18.0.1 — markdown rendering.

**Utilities:**
- `confbox` 0.2.4 — TOML / JSON5 / YAML config parsing for CLI tool settings (codex, cursor, etc.).
- `node-machine-id` 1.1.12 — stable machine fingerprint, used by API-key salting and provider request fingerprints.
- `uuid` 13.0.0.
- `open` 11.0.0 — opens browser for OAuth flows.
- `ora` 9.1.0 — CLI spinner (the CLI itself ships a hand-rolled spinner, but `ora` is also depended upon).

**CLI-only (`cli/package.json`):**
- `enquirer` 2.4.1 — interactive CLI prompts.
- `react` / `react-dom` 19.2.1 (peer expectations only; the runtime CLI is plain Node).
- Dev: `esbuild` 0.25.12, `nodemon` 3.1.14.
- `systray2` is intentionally NOT bundled. It is lazy-installed into `~/.9router/runtime/node_modules` by `cli/hooks/postinstall.js` on macOS/Linux only. Windows uses PowerShell `NotifyIcon` (no binary). Comment in `cli/package.json` documents this.

## Configuration

**Environment:**
- `.env.example` documents the runtime contract. Required: `JWT_SECRET`, `INITIAL_PASSWORD`, `DATA_DIR`. Recommended: `PORT` (default 20128), `NODE_ENV`, `API_KEY_SECRET`, `MACHINE_ID_SALT`, `BASE_URL`, `CLOUD_URL` (and `NEXT_PUBLIC_*` mirrors).
- Outbound proxy: `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`, `NO_PROXY` (lower-case variants supported). Managed by `src/lib/network/outboundProxy.js` and consumed by `open-sse/utils/proxyFetch.js`.
- Observability tuning: `OBSERVABILITY_ENABLED`, `OBSERVABILITY_MAX_RECORDS`, `OBSERVABILITY_BATCH_SIZE`, `OBSERVABILITY_FLUSH_INTERVAL_MS`, `OBSERVABILITY_MAX_JSON_SIZE` (`src/lib/db/repos/requestDetailsRepo.js`).
- Auth: `JWT_SECRET`, `AUTH_COOKIE_SECURE`, `REQUIRE_API_KEY`. OIDC settings (`oidcIssuerUrl`, `oidcClientId`, `oidcClientSecret`) live in the DB, not env.
- Misc: `SHUTDOWN_SECRET`, `TRAY_MODE`, `CODESPACES`, `UPDATER_PORT`, `UPDATER_PKG_NAME`, `NEXT_TRACING_ROOT_MODE`, `NEXT_DIST_DIR`, `NINEROUTER_PROXY_CLIENT_MAX_BODY_SIZE`, `TUNNEL_WORKER_URL`, `TUNNEL_TRANSPORT_PROTOCOL`/`CLOUDFLARED_PROTOCOL`.
- Provider overrides: `KIMI_CODING_OAUTH_CLIENT_ID`, `OPENAI_API_KEY`, `AZURE_*` (`open-sse/executors/azure.js`).
- `.env*` files are gitignored. Do not echo their contents.

**Build:**
- `next.config.mjs` — `output: "standalone"`, `serverExternalPackages` excludes the four SQLite drivers, custom `rewrites()` map `/v1/*`, `/v1/v1/*`, and `/codex/*` to `/api/v1/*` (Codex Responses path), webpack ignores `logs/`, `.next/`, `gitbook/`, `cli/` for the watcher.
- `jsconfig.json` — `@/*` alias to `src/*`; `open-sse` and `open-sse/*` aliases to the sibling SSE engine.
- `eslint.config.mjs` — extends `eslint-config-next/core-web-vitals`, overrides default ignores.
- `postcss.config.mjs` — Tailwind plugin only.
- `Dockerfile` — multi-stage (`builder` → `runner`), `node:22-alpine`, exposes 20128, copies `open-sse/`, `src/mitm/`, `node-forge`, and `next` explicitly because Next standalone tracing misses the MITM child process and fallback paths.
- `captain-definition` — CapRover deploys via the Dockerfile.

## Platform Requirements

**Development:**
- Node ≥18 for the CLI, Node 22 for the dashboard build (matches Docker base).
- Optional: build toolchain (python3, make, g++, linux-headers) only if `better-sqlite3` should be compiled — otherwise `sql.js` is used.
- Port 20128 (default dashboard / API), port 20129 (updater).

**Production:**
- Docker / CapRover via the bundled `Dockerfile` and `captain-definition`.
- Persistent volume mount at `/app/data` (`DATA_DIR=/app/data`) — SQLite file plus generated MITM CA cert, OAuth credential cache, MITM alias cache.
- Optional: published as `9router` npm package (`cli/package.json`) for `npx 9router` / `npm i -g 9router` self-host install.

---

*Stack analysis: 2026-06-07*

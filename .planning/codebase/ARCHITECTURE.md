<!-- refreshed: 2026-06-07 -->
# Architecture

**Analysis Date:** 2026-06-07

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         Clients (LLM SDKs / CLIs)                    │
│   OpenAI SDK · Claude · Gemini · Codex · Cursor · Kiro · Ollama …    │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │ HTTP(S) — /v1/*, /v1beta/*, /codex/*
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  Next.js App Router (process root)                   │
│            `src/app/layout.js` + `src/proxy.js` (middleware)         │
│  Auth gate (JWT / API key / CLI token / loopback) `src/dashboardGuard.js` │
└──────────┬──────────────────────────────────────────┬───────────────┘
           │                                          │
           ▼                                          ▼
┌──────────────────────────┐              ┌──────────────────────────┐
│   /api/v1/* route stubs  │              │  Dashboard UI (RSC)      │
│   `src/app/api/v1/...`   │              │  `src/app/(dashboard)/`  │
│   delegate to handlers   │              │  React 19 + zustand      │
└──────────┬───────────────┘              └────────────┬─────────────┘
           │                                            │
           ▼                                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│         App-side SSE handlers (DB-aware, Next.js bound)              │
│         `src/sse/handlers/{chat,embeddings,images,tts,...}.js`       │
│   - Auth: `src/sse/services/auth.js`                                  │
│   - Model resolve: `src/sse/services/model.js`                        │
│   - Token refresh: `src/sse/services/tokenRefresh.js`                 │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│             open-sse: framework-agnostic LLM router core             │
│   handlers/    — chatCore, image/tts/embeddings/search/fetch core    │
│   translator/  — request/response format conversion (hub = OpenAI)   │
│   executors/   — per-provider HTTP dispatch (codex, kiro, cursor…)   │
│   services/    — provider/model resolution, oauth refresh, fallback  │
│   rtk/         — caveman + tool-result compression filters           │
│   utils/       — stream helpers, proxy fetch, error formatting       │
│   `open-sse/index.js` (barrel)                                       │
└──────┬──────────────────────────────────┬───────────────────────────┘
       │                                  │
       ▼                                  ▼
┌──────────────────┐              ┌──────────────────────────────────┐
│  Outbound HTTP   │              │  Local SQLite (multi-driver)     │
│  `proxyFetch.js` │              │  `src/lib/db/driver.js`          │
│  + undici proxy  │              │  bun:sqlite → better-sqlite3 →   │
│  + SOCKS agents  │              │  node:sqlite → sql.js (fallback) │
└──────┬───────────┘              │  repos: connections, combos,     │
       │                           │  apiKeys, usage, requestDetails  │
       │                           └──────────────────────────────────┘
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│   Upstream LLM providers (Anthropic, OpenAI, Google, Kiro, Cursor,  │
│   Codex, Qwen, GitHub Copilot, Vertex, Ollama, Antigravity, …)      │
└─────────────────────────────────────────────────────────────────────┘

  Sidecar processes (managed by `src/lib/tunnel/...` and CLI):
  - MITM HTTPS server `src/mitm/server.js` (cert-pinned IDE intercept)
  - Cloudflare/Tailscale tunnels `src/lib/tunnel/{cloudflare,tailscale}/`
  - CLI launcher `cli/cli.js` + tray runtime `cli/hooks/trayRuntime.js`
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Edge middleware | Auth gating, public/private path classification, dashboard redirects | `src/proxy.js` → `src/dashboardGuard.js` |
| API route stubs | Thin Next.js handlers that initialize translators and forward to SSE handlers | `src/app/api/v1/**/route.js` |
| App SSE handlers | DB-aware orchestration: settings, combos, fallback, credential lookup | `src/sse/handlers/chat.js`, `src/sse/handlers/embeddings.js` |
| App SSE services | Bridges DB layer to open-sse (auth, model, token refresh) | `src/sse/services/{auth,model,tokenRefresh}.js` |
| open-sse core | Provider-agnostic chat pipeline, format translation, executor dispatch | `open-sse/handlers/chatCore.js`, `open-sse/handlers/chatCore/*.js` |
| Translator registry | source → openai → target format conversion (chat + responses) | `open-sse/translator/index.js` + `request/`, `response/` |
| Executors | Per-provider URL building, header signing, body shaping | `open-sse/executors/{codex,kiro,cursor,vertex,...}.js` |
| Provider services | Format detection, URL building, credential fallback, OAuth refresh | `open-sse/services/{provider,model,tokenRefresh,oauthCredentialManager}.js` |
| RTK filters | Tool-result compression and "caveman" prompt rewriting | `open-sse/rtk/{index.js,caveman.js,filters/}` |
| DB driver | Runtime-specific SQLite adapter selection + migration | `src/lib/db/driver.js`, `src/lib/db/migrate.js` |
| DB repos | Typed accessors per table (settings, connections, usage, …) | `src/lib/db/repos/*.js` |
| OAuth services | Per-provider OAuth flows + token import | `src/lib/oauth/services/*.js` |
| Tunnels | Cloudflared / Tailscale process supervision + watchdog | `src/lib/tunnel/{cloudflare,tailscale}/manager.js` |
| MITM server | TLS interception of IDE traffic, cert minting, model rewrite | `src/mitm/server.js`, `src/mitm/cert/*.js`, `src/mitm/handlers/*.js` |
| Dashboard UI | React 19 RSC pages + client components for management UI | `src/app/(dashboard)/dashboard/**` |
| State store | Client-side zustand stores (theme, user, providers, settings, …) | `src/store/*.js` |

## Pattern Overview

**Overall:** Layered Next.js monolith fronting a framework-agnostic LLM router (`open-sse`) plus optional sidecar processes (MITM, tunnels, CLI tray).

**Key Characteristics:**
- Format-agnostic translator hub: every request is normalized to OpenAI shape, then re-shaped to the upstream's native format. Adding a provider = one executor + (optional) two translators.
- Pluggable SQLite drivers selected at runtime to support node 18+, node 22.5+ (built-in), Bun, and binary-less environments via `sql.js`.
- Strict auth perimeter at edge middleware (`src/dashboardGuard.js`) before any route handler runs.
- Multi-runtime ready: same source serves `next dev`, `next build` standalone, Bun runtime, Docker, and a packaged CLI.
- Credential fallback loop in `src/sse/handlers/chat.js` rotates through provider connections on rate-limit / auth errors before surfacing failure.

## Layers

**Edge (middleware):**
- Purpose: Single auth gate for the entire app
- Location: `src/proxy.js`, `src/dashboardGuard.js`
- Contains: Path classification (public LLM API, public dashboard, always-protected, local-only), JWT + API-key + CLI-token validation
- Depends on: `src/lib/localDb.js`, `src/lib/auth/dashboardSession.js`, `src/shared/utils/machineId.js`
- Used by: All HTTP traffic

**Route stubs (`src/app/api/**`):**
- Purpose: Next.js wiring + CORS preflight + lazy translator init
- Location: `src/app/api/v1/`, `src/app/api/v1beta/`, `src/app/api/{providers,combos,usage,settings,oauth,tunnel,mcp,...}/`
- Contains: Tiny POST/GET handlers that call `handleChat`, `handleEmbeddings`, repo functions, etc.
- Depends on: `src/sse/handlers/*.js`, `src/lib/db/index.js`, `open-sse/translator/index.js`
- Used by: HTTP clients (LLM SDKs, dashboard UI, CLI)

**App SSE layer (`src/sse/`):**
- Purpose: Bridge between Next.js (DB, settings) and `open-sse`
- Location: `src/sse/handlers/`, `src/sse/services/`
- Contains: Settings load, combo expansion, credential pick, account fallback loop, model alias resolution, format detection by endpoint
- Depends on: `src/lib/db/index.js`, `open-sse/handlers/chatCore.js`, `open-sse/services/combo.js`
- Used by: API route stubs

**open-sse core:**
- Purpose: Framework-free LLM dispatch (could run in a Worker or other host)
- Location: `open-sse/`
- Contains: chatCore pipeline, executors, translators, rtk filters, stream helpers
- Depends on: `undici`, `socks-proxy-agent`, no Next.js APIs
- Used by: `src/sse/handlers/chat.js` (and could be embedded elsewhere)

**Persistence (`src/lib/db/`):**
- Purpose: Local SQLite store for all configuration + usage
- Location: `src/lib/db/{driver.js,migrate.js,adapters/,repos/,helpers/,migrations/}`
- Contains: Adapter selection, migration runner, repo functions per table
- Depends on: One of `bun:sqlite`, `better-sqlite3`, `node:sqlite`, `sql.js`
- Used by: SSE services, route handlers, edge middleware

**Dashboard UI (`src/app/(dashboard)/`):**
- Purpose: Local management console (React Server Components + client islands)
- Location: `src/app/(dashboard)/dashboard/`
- Contains: Pages per feature (providers, endpoint, usage, combos, MITM, skills, …) plus Client components
- Depends on: `src/shared/components/`, `src/store/`, `src/i18n/`, REST API in `src/app/api/`
- Used by: Browser users (gated by JWT auth)

**Sidecars:**
- MITM proxy (`src/mitm/`) — long-running HTTPS interceptor for IDE traffic
- Tunnel managers (`src/lib/tunnel/`) — cloudflared / tailscaled supervision
- CLI launcher (`cli/`) — npm-installable wrapper that starts the Next server, manages tray icon, provisions runtime SQLite

## Data Flow

### Primary Request Path (chat completion)

1. Client POSTs to `/v1/chat/completions` (or `/v1/messages`, `/v1/responses`, `/codex/...`) — rewritten to `/api/v1/...` by `next.config.mjs:46`
2. Edge middleware enforces auth (`src/proxy.js:1` → `src/dashboardGuard.js:165`)
3. Route stub initializes translators once and calls `handleChat` (`src/app/api/v1/chat/completions/route.js:29`)
4. App SSE handler reads settings, masks key, runs combo expansion (`src/sse/handlers/chat.js:28`)
5. Single-model path resolves alias and starts the credential fallback loop (`src/sse/handlers/chat.js:120`)
6. `getProviderCredentials` picks an active connection; `checkAndRefreshToken` mints/refreshes OAuth (`src/sse/services/auth.js`, `src/sse/services/tokenRefresh.js`)
7. `handleChatCore` runs the pipeline: format detect → tool dedupe → caveman/RTK → translateRequest → executor → stream/non-stream branch (`open-sse/handlers/chatCore.js`)
8. Executor builds upstream URL/headers/body and dispatches via `proxyFetch` (`open-sse/executors/<provider>.js`, `open-sse/utils/proxyFetch.js`)
9. Streaming response runs through `streamingHandler.js` which transforms upstream SSE → target SSE while logging usage (`open-sse/handlers/chatCore/streamingHandler.js`)
10. On terminal events, `usageDb.appendRequestLog` + `saveRequestDetail` persist usage (`src/lib/usageDb.js` → `src/lib/db/repos/usageRepo.js`, `requestDetailsRepo.js`)
11. On retriable error, fallback loop marks the connection unavailable and retries with the next account (`src/sse/handlers/chat.js:233`)

### Dashboard Read/Write Flow

1. Client navigates to `/dashboard/<page>` — middleware verifies `auth_token` cookie or `requireLogin=false`
2. Server component renders shell + reads any required server data
3. Client island fetches REST endpoints under `/api/<resource>` (e.g. `/api/providers`, `/api/usage/stream`)
4. Route handler calls a repo in `src/lib/db/repos/*.js`
5. Updates emit on `statsEmitter` for live dashboards (`src/lib/db/repos/usageRepo.js`)

### MITM Intercept Flow

1. CLI starts mitm via `src/mitm/manager.js` after elevation check (`src/mitm/winElevated.js`)
2. `src/mitm/server.js` binds 443 with SNI cert minting from `src/mitm/cert/generate.js`
3. Per-tool handler in `src/mitm/handlers/<tool>.js` rewrites body/headers and forwards to local 9router
4. Optional model alias rewrite via `src/mitm/dbReader.js` (read-only DB peek)

**State Management:**
- Server state: SQLite via `src/lib/db/index.js`. Module-level `global._dbAdapter` cache survives Next dev hot reload.
- Client state: zustand stores (`src/store/*.js`) — themes, user session, provider list, notifications, search, settings.
- In-flight token state: `global._dbAdapter`-style globals plus per-module caches (e.g. `cachedCliToken` in `dashboardGuard.js`, `claudeHeaderCache` in `open-sse/utils/`).

## Key Abstractions

**Executor (provider HTTP adapter):**
- Purpose: Encapsulates one upstream provider's URL, headers, body shaping, and stream parsing quirks
- Examples: `open-sse/executors/codex.js`, `open-sse/executors/kiro.js`, `open-sse/executors/vertex.js`
- Pattern: Subclass of `BaseExecutor` (`open-sse/executors/base.js`); `getExecutor(provider)` returns shared instance, falls back to `DefaultExecutor` for OpenAI-compatible upstreams

**Translator (format converter):**
- Purpose: Convert request/response between provider native shapes through an OpenAI hub format
- Examples: `open-sse/translator/request/openai-to-claude.js`, `open-sse/translator/response/kiro-to-openai.js`
- Pattern: `register(from, to, requestFn, responseFn)` populates two `Map<string,Function>` registries lazily seeded by `ensureInitialized()` in `open-sse/translator/index.js`

**DB Adapter:**
- Purpose: Uniform `{ all, get, run, exec, prepare, close }` API across SQLite engines
- Examples: `src/lib/db/adapters/{betterSqliteAdapter,nodeSqliteAdapter,bunSqliteAdapter,sqljsAdapter}.js`
- Pattern: Driver picks first available implementation; `getAdapter()` returns a memoized promise

**Repo:**
- Purpose: Domain-shaped accessors over a DB table, plus JSON column packing
- Examples: `src/lib/db/repos/connectionsRepo.js`, `src/lib/db/repos/usageRepo.js`
- Pattern: Each repo exports plain async functions; barrel re-exported from `src/lib/db/index.js`

**RTK Filter:**
- Purpose: Mutate request body for token savings (caveman prompt swap, tool-result compression)
- Examples: `open-sse/rtk/caveman.js`, `open-sse/rtk/applyFilter.js`, `open-sse/rtk/filters/*.js`
- Pattern: Pure functions invoked from `compressMessages`, `injectCaveman`, gated by settings flags

## Entry Points

**HTTP clients (LLM SDKs):**
- Location: `src/app/api/v1/**/route.js` (chat, messages, responses, embeddings, images, audio, search, web/fetch, models)
- Triggers: Any `/v1/*` request rewritten by `next.config.mjs`
- Responsibilities: Initialize translators, delegate to `handleChat`-family functions, return SSE/JSON

**Browser:**
- Location: `src/app/page.js` (redirect to `/dashboard`), `src/app/(dashboard)/dashboard/page.js`
- Triggers: User navigates to root or dashboard route
- Responsibilities: Auth-gated render via middleware, then RSC + client islands

**CLI:**
- Location: `cli/cli.js`
- Triggers: `npx 9router` / global install + spawn
- Responsibilities: Provision `~/.9router/runtime`, install optional native modules (`cli/hooks/postinstall.js`), start Next standalone server, manage tray icon

**MITM proxy:**
- Location: `src/mitm/server.js`
- Triggers: Spawned by `src/lib/cli-tools` route handlers or CLI tray
- Responsibilities: Bind localhost:443, mint per-host certs, route to provider handlers

**Bootstrap (server start):**
- Location: `src/app/layout.js` imports `src/shared/services/bootstrap.js`
- Triggers: Server module load (Next.js)
- Responsibilities: Outbound proxy env (`src/lib/network/initOutboundProxy.js`), watchdog auto-resume tunnels, console log capture

## Architectural Constraints

- **Threading:** Single Node/Bun event loop per process. No worker_threads. Streaming responses use AbortController + onDisconnect to drop upstream when client leaves.
- **Global state:** `global._dbAdapter` (DB singleton across HMR), module-level caches in `src/dashboardGuard.js` (`cachedCliToken`), `open-sse/utils/claudeHeaderCache.js`, `open-sse/translator/index.js` (`requestRegistry`, `responseRegistry`, `initialized`).
- **External packages:** Native SQLite drivers must be excluded from Next bundling — `next.config.mjs:16` lists `serverExternalPackages: ["better-sqlite3", "sql.js", "node:sqlite", "bun:sqlite"]`.
- **Path aliases:** `@/*` → `./src/*`, `open-sse` and `open-sse/*` → repo root (`jsconfig.json`). open-sse must NOT import from `@/` to remain framework-agnostic — bridging happens in `src/sse/`.
- **Process boundaries:** MITM proxy and tunnels run as separate child processes. Communication is through DB and HTTP, not in-process calls.
- **Lazy translator init:** `initTranslators()` (synchronous `require` graph) must be called once before the first request — every API route does `await ensureInitialized()`.
- **Body size:** Default proxy body cap is 128MB, overridable via `NINEROUTER_PROXY_CLIENT_MAX_BODY_SIZE` (`next.config.mjs:10`).

## Anti-Patterns

### Importing `@/lib/...` from open-sse

**What happens:** A file under `open-sse/` reaches into the Next-only DB layer with `@/lib/db` etc.
**Why it's wrong:** open-sse is meant to run outside Next (Workers, CLI). Adding a Next dependency breaks framework-agnostic isolation and creates a circular dependency through `src/sse/handlers/chat.js` (which already imports from open-sse).
**Do this instead:** Pass everything open-sse needs as parameters from `src/sse/`. Example: `src/sse/handlers/chat.js:201` constructs the full `handleChatCore` argument bag from settings before calling open-sse.

### Bypassing `src/lib/db/index.js`

**What happens:** A consumer calls `getAdapter()` and writes raw SQL.
**Why it's wrong:** Loses migration-time guarantees (`src/lib/db/migrate.js`) and JSON column packing (`src/lib/db/helpers/jsonCol.js`).
**Do this instead:** Add or reuse a function in `src/lib/db/repos/<resource>Repo.js` and re-export from `src/lib/db/index.js`.

### Mixing translator hubs

**What happens:** A new translator does `claude → kiro` directly.
**Why it's wrong:** Translation logic must always pivot through OpenAI to keep the registry an O(N) star, not O(N²) mesh. See `open-sse/translator/index.js:75` (`translateRequest` always does source → openai → target).
**Do this instead:** Add `claude-to-openai` (request) and `openai-to-kiro` (request) as separate translators; the registry composes them.

### Adding auth-sensitive routes without updating `dashboardGuard.js`

**What happens:** New route under `/api/...` ships with no entry in `PUBLIC_API_PATHS`, `PROTECTED_API_PATHS`, or `LOCAL_ONLY_PATHS`.
**Why it's wrong:** The middleware is deny-by-default for `/api/*` — but only after path classification. Routes that should be public LLM API (e.g. new `/v1/...` paths) must be added to `PUBLIC_PREFIXES`. Routes that spawn child processes must be in `LOCAL_ONLY_PATHS` or attackers on a tunnel can hit them.
**Do this instead:** When adding an API route, edit the matching list in `src/dashboardGuard.js:22-81`.

## Error Handling

**Strategy:** Convert all errors to structured `{ status, error }` shapes; let the chat fallback loop decide whether to retry or surface.

**Patterns:**
- `errorResponse(status, message)` from `open-sse/utils/error.js` for one-shot HTTP error JSON
- `unavailableResponse(status, message, retryAfter, retryAfterHuman)` for 5xx with retry hints
- `formatProviderError` normalizes upstream provider errors into the client-visible format
- Fallback loop in `src/sse/handlers/chat.js:166` consumes `result.success`/`result.status`/`result.error`/`result.resetsAtMs` and decides per `markAccountUnavailable` (`open-sse/services/accountFallback.js`) whether to retry

## Cross-Cutting Concerns

**Logging:**
- Server: namespaced helpers in `src/sse/utils/logger.js` (`log.request`, `log.info`, `log.warn`, `log.maskKey`)
- Console capture: `src/lib/consoleLogBuffer.js` (mounted in `src/app/layout.js`) feeds the in-app console viewer
- Request detail logging: `open-sse/handlers/chatCore/requestDetail.js` builds the structured record persisted by `saveRequestDetail`

**Validation:**
- Body parsing + minimal shape checks at handler entry (`src/sse/handlers/chat.js:30`)
- Format detection: endpoint-based first (`open-sse/translator/formats.js:detectFormatByEndpoint`), then body-based (`open-sse/services/provider.js:detectFormat`)
- API key validation: `validateApiKey` in `src/lib/db/repos/apiKeysRepo.js`

**Authentication:**
- Edge middleware: JWT (`auth_token` cookie) verified by `src/lib/auth/dashboardSession.js`, API key (Authorization/x-api-key), CLI machine-id token
- Provider OAuth: per-provider service in `src/lib/oauth/services/*.js`, refreshed lazily via `open-sse/services/tokenRefresh.js`

---

*Architecture analysis: 2026-06-07*

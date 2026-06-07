# Codebase Structure

**Analysis Date:** 2026-06-07

## Directory Layout

```
9router-fork/
├── src/                       # Next.js app source
│   ├── app/                   # App Router pages + API routes
│   │   ├── (dashboard)/       # Auth-gated dashboard route group
│   │   ├── api/               # REST + LLM API endpoints
│   │   ├── login/             # Public login page
│   │   ├── landing/           # Public landing page
│   │   ├── callback/          # OAuth redirect target
│   │   ├── layout.js          # Root layout (mounts bootstrap, i18n, theme)
│   │   ├── page.js            # `/` → redirects to `/dashboard`
│   │   └── globals.css        # Tailwind v4 entry
│   ├── sse/                   # Next-bound bridge to open-sse
│   │   ├── handlers/          # chat / embeddings / images / tts / search / fetch
│   │   ├── services/          # auth, model resolution, token refresh
│   │   └── utils/logger.js    # Namespaced server logger
│   ├── lib/                   # Server-only modules
│   │   ├── db/                # SQLite driver, adapters, repos, migrations
│   │   ├── auth/              # JWT sessions, login limiter, OIDC
│   │   ├── oauth/             # Per-provider OAuth flows
│   │   ├── tunnel/            # Cloudflared + Tailscale managers
│   │   ├── network/           # Outbound proxy, connection tester
│   │   ├── mcp/               # MCP stdio↔SSE bridge
│   │   ├── usage/             # Usage fetcher
│   │   ├── updater/           # In-app updater
│   │   ├── qoder/             # Qoder-specific helpers
│   │   ├── localDb.js         # Convenience re-exports from db/
│   │   ├── usageDb.js         # Usage helpers (re-exports)
│   │   ├── mitmAliasCache.js  # In-memory alias cache for MITM
│   │   ├── disabledModelsDb.js
│   │   ├── requestDetailsDb.js
│   │   ├── consoleLogBuffer.js
│   │   ├── dataDir.js
│   │   ├── providerNormalization.js
│   │   └── appUpdater.js
│   ├── mitm/                  # HTTPS interceptor (CommonJS sidecar)
│   │   ├── handlers/          # Per-tool: antigravity, copilot, kiro, cursor
│   │   ├── cert/              # Root CA + per-domain cert minting
│   │   ├── dns/               # DNS override config
│   │   ├── server.js          # Entry (binds 443, SNI)
│   │   ├── manager.js         # Process supervisor
│   │   ├── config.js          # Target hosts, URL patterns, model maps
│   │   ├── logger.js          # File + stdout logger
│   │   ├── paths.js           # Data dir + cert paths
│   │   ├── dbReader.js        # Read-only DB peek (no write deps)
│   │   ├── antigravityIdeVersion.js
│   │   └── winElevated.js     # Windows UAC elevation helper
│   ├── shared/                # Shared client + isomorphic utilities
│   │   ├── components/        # React components (Button, Modal, layouts/, …)
│   │   ├── constants/         # Provider/model/cliTools/locales registries
│   │   ├── hooks/             # useTheme, useCopyToClipboard
│   │   ├── services/          # bootstrap.js (server-side init)
│   │   └── utils/             # api, machineId, cn, providerModelsFetcher
│   ├── store/                 # zustand client stores
│   ├── models/                # Static model registry re-export
│   ├── i18n/                  # Runtime i18n provider + config
│   ├── proxy.js               # Next middleware entry (re-exports dashboardGuard)
│   └── dashboardGuard.js      # Auth + path classification middleware
├── open-sse/                  # Framework-agnostic LLM router (CJS-friendly ESM)
│   ├── handlers/              # chatCore, embeddingsCore, imageGenerationCore,
│   │                          # ttsCore, sttCore, responsesHandler, fetch/, search/
│   ├── translator/            # Format conversion (request/, response/, helpers/)
│   ├── executors/             # Per-provider HTTP dispatch
│   ├── services/              # provider, model, oauthCredentialManager, tokenRefresh,
│   │                          # combo, accountFallback, projectId, usage, compact
│   ├── rtk/                   # Tool-result compression + caveman prompt rewrites
│   ├── transformer/           # SSE↔JSON converter, responses transformer
│   ├── config/                # Provider/model/runtime/oauth constants
│   ├── utils/                 # streamHandler, proxyFetch, error, logger, …
│   └── index.js               # Public barrel
├── cli/                       # Standalone npm-installable CLI launcher
│   ├── cli.js                 # Bin entry
│   ├── src/cli/               # CLI implementation
│   ├── hooks/                 # postinstall, sqliteRuntime, trayRuntime
│   ├── scripts/               # Build CLI bundle, build MITM bundle
│   └── package.json           # Separate package: name=9router
├── tests/                     # Vitest tests
│   ├── unit/                  # Unit tests
│   ├── translator/            # Translator round-trip fixtures
│   └── vitest.config.js
├── skills/                    # Built-in agent "skills" (chat, image, tts, …)
├── docs/                      # Internal docs
├── gitbook/                   # Public docs site (excluded from build tracing)
├── i18n/                      # Translation JSON files
├── public/                    # Static assets served by Next
├── images/                    # README assets
├── scripts/                   # Repo-level scripts (translate-readme.js)
├── .planning/                 # GSD planning artifacts (this dir)
├── .codegraph/                # Code intelligence index (gitignored)
├── .github/                   # CI workflows
├── next.config.mjs            # Next config + URL rewrites
├── eslint.config.mjs
├── postcss.config.mjs
├── jsconfig.json              # Path aliases (@/*, open-sse, open-sse/*)
├── package.json               # 9router-app (root)
├── Dockerfile / DOCKER.md
├── start.sh
├── captain-definition         # CapRover deploy spec
├── README.md / README.zh-CN.md
├── CHANGELOG.md
└── LICENSE
```

## Directory Purposes

**`src/app/(dashboard)/dashboard/`:**
- Purpose: All authenticated UI pages
- Contains: One folder per feature (`providers/`, `endpoint/`, `usage/`, `combos/`, `proxy-pools/`, `media-providers/`, `mitm/`, `cli-tools/`, `console-log/`, `quota/`, `translator/`, `basic-chat/`, `skills/`, `profile/`)
- Key files: `page.js` (RSC entry per route), `*PageClient.js` (client island), `components/` (route-local components)

**`src/app/api/v1/` and `src/app/api/v1beta/`:**
- Purpose: Public LLM API surface (auth via API key / CLI token / loopback)
- Contains: `chat/completions`, `messages`, `responses`, `embeddings`, `images/generations`, `audio/{speech,transcriptions,voices}`, `search`, `web/fetch`, `models`
- Key files: `route.js` per endpoint — typically a thin POST wrapper

**`src/app/api/<resource>/`:**
- Purpose: Dashboard REST API (auth via JWT)
- Contains: `auth/`, `providers/`, `provider-nodes/`, `proxy-pools/`, `combos/`, `models/`, `usage/`, `oauth/`, `settings/`, `keys/`, `tags/`, `cli-tools/`, `mcp/`, `translator/`, `tunnel/`, `media-providers/`, `pricing/`, `version/`, `health/`, `init/`, `locale/`, `shutdown/`
- Key files: `route.js` per resource (REST verbs); `[id]/route.js` for instance ops

**`src/sse/`:**
- Purpose: Adapt open-sse to Next runtime (DB-backed settings, credentials, logging)
- Contains: `handlers/` (one per public capability), `services/` (auth/model/tokenRefresh)
- Key files: `src/sse/handlers/chat.js`, `src/sse/services/auth.js`, `src/sse/services/tokenRefresh.js`

**`src/lib/db/`:**
- Purpose: Persistent storage with multi-driver SQLite
- Contains: `driver.js` (adapter pick), `adapters/` (4 backends), `repos/` (one per table), `migrations/` + `migrate.js`, `helpers/` (jsonCol, kvStore, metaStore), `paths.js`, `schema.js`, `version.js`, `backup.js`, `index.js` (barrel)
- Key files: `src/lib/db/index.js` (public API), `src/lib/db/driver.js` (runtime detection)

**`src/mitm/`:**
- Purpose: HTTPS interceptor sidecar for IDE traffic
- Contains: `server.js` entry, `handlers/` per IDE, `cert/` for CA + leaf minting, `dns/` for split-horizon
- Key files: `src/mitm/server.js`, `src/mitm/manager.js`, `src/mitm/cert/generate.js`

**`open-sse/handlers/chatCore/`:**
- Purpose: chat pipeline split into focused phases
- Contains: `streamingHandler.js`, `nonStreamingHandler.js`, `sseToJsonHandler.js`, `requestDetail.js`
- Key files: `open-sse/handlers/chatCore.js` orchestrates these

**`open-sse/translator/`:**
- Purpose: Format conversion via OpenAI hub
- Contains: `request/<source>-to-<target>.js`, `response/<source>-to-<target>.js`, `helpers/`, `index.js`, `formats.js`
- Key files: `open-sse/translator/index.js` (registry + dispatch)

**`open-sse/executors/`:**
- Purpose: Per-provider HTTP adapters
- Contains: One file per provider plus `base.js`, `default.js`, `index.js`
- Key files: `open-sse/executors/index.js` (registry + `getExecutor`)

**`cli/`:**
- Purpose: `npm i -g 9router` launcher (separate package)
- Contains: `cli.js` bin, `src/cli/` impl, `hooks/postinstall.js` (lazy native module install), `hooks/trayRuntime.js`, `scripts/build-cli.js`
- Key files: `cli/cli.js`, `cli/hooks/postinstall.js`

## Key File Locations

**Entry Points:**
- `src/proxy.js`: Next middleware export
- `src/app/layout.js`: Root layout (mounts bootstrap)
- `src/app/page.js`: Root route (redirects)
- `cli/cli.js`: CLI bin
- `src/mitm/server.js`: MITM sidecar
- `open-sse/index.js`: Public router barrel
- `src/lib/db/index.js`: Public DB API barrel

**Configuration:**
- `next.config.mjs`: Next config + `/v1/*` rewrites
- `jsconfig.json`: Path aliases
- `eslint.config.mjs`: ESLint flat config
- `postcss.config.mjs`: Tailwind v4 wiring
- `package.json`: Root deps and scripts
- `cli/package.json`: CLI deps and bin
- `Dockerfile`: Container build
- `.env.example`: Documented env vars

**Core Logic:**
- `src/sse/handlers/chat.js`: Settings-aware chat orchestrator with combo + fallback
- `open-sse/handlers/chatCore.js`: Format-agnostic chat pipeline
- `open-sse/translator/index.js`: Translator registry
- `open-sse/executors/index.js`: Executor registry
- `src/dashboardGuard.js`: Auth gate
- `src/lib/db/driver.js`: Runtime SQLite picker

**Testing:**
- `tests/vitest.config.js`: Vitest setup
- `tests/unit/`: Unit tests
- `tests/translator/`: Format round-trip suites

## Naming Conventions

**Files:**
- Source files: camelCase `.js` (e.g. `chatCore.js`, `dashboardGuard.js`)
- React components: PascalCase `.js` (e.g. `Sidebar.js`, `ManualConfigModal.js`)
- Next route handlers: lowercase `route.js` per Next convention
- Page components: lowercase `page.js`, `layout.js` per Next convention
- Client islands inside dashboard pages: PascalCase + `PageClient` suffix (e.g. `EndpointPageClient.js`, `MitmPageClient.js`, `BasicChatPageClient.js`)
- Translator pairs: `<source>-to-<target>.js` (e.g. `openai-to-claude.js`)
- Executors: lowercase provider name (e.g. `gemini-cli.js`, `opencode-go.js`)
- CommonJS modules under `src/mitm/` use `require`/`module.exports` (sidecar runs without ESM bundler)

**Directories:**
- All-lowercase dashes for multi-word page routes (`media-providers`, `proxy-pools`, `cli-tools`)
- Lowercase for source folders (`handlers`, `services`, `repos`)
- Route group with parens: `(dashboard)` (Next route grouping; not in URL)
- Dynamic route segments: `[id]`, `[toolId]`, `[connectionId]`, `[kind]`

**Variables / functions:**
- camelCase for functions and locals
- SCREAMING_SNAKE_CASE for module-level constants (`PUBLIC_API_PATHS`, `LOOPBACK_HOSTS`, `HTTP_STATUS`, `FORMATS`)
- Internal export bag pattern: `export const __test__ = { ... }` (see `src/dashboardGuard.js:157`)

**Database:**
- camelCase table and column names (`providerConnections`, `apiKeys`, `requestDetails`, `isActive`, `createdAt`)
- JSON blob column always named `data` and packed via `helpers/jsonCol.js`

## Where to Add New Code

**New LLM API endpoint:**
- Route stub: `src/app/api/v1/<endpoint>/route.js` (thin handler, calls into `src/sse/handlers/`)
- Bridge logic: `src/sse/handlers/<feature>.js` (settings, auth, fallback)
- Format-agnostic core: `open-sse/handlers/<feature>Core.js`
- Update auth allowlist if introducing a new public prefix: `src/dashboardGuard.js:35` (`PUBLIC_PREFIXES`)
- Add URL rewrite if shipping a non-`/v1` external path: `next.config.mjs:46`

**New provider:**
- Executor: `open-sse/executors/<provider>.js` (extend `BaseExecutor`)
- Register: `open-sse/executors/index.js` (add to `executors` map)
- Translators (only if upstream uses non-OpenAI body):
  - `open-sse/translator/request/openai-to-<provider>.js`
  - `open-sse/translator/response/<provider>-to-openai.js`
  - Wire up in `ensureInitialized()` of `open-sse/translator/index.js:28`
- Provider config: `open-sse/config/providers.js` and `open-sse/config/providerModels.js`
- OAuth (if needed): `src/lib/oauth/services/<provider>.js` + register in `src/lib/oauth/services/index.js`
- Token refresh: extend `open-sse/services/tokenRefresh.js`
- Token import / login UI: dashboard component under `src/shared/components/<Provider>AuthModal.js`
- Provider icon mapping: `src/shared/components/ProviderIcon.js`

**New dashboard page:**
- Folder: `src/app/(dashboard)/dashboard/<feature>/`
- Files: `page.js` (RSC server component), optional `<Feature>PageClient.js` (client island), `components/` for route-local components
- Sidebar entry: `src/shared/components/Sidebar.js`
- Required REST endpoint: `src/app/api/<feature>/route.js`

**New REST endpoint (dashboard):**
- Route: `src/app/api/<resource>/route.js` (and `[id]/route.js` for instance ops)
- DB access: add or reuse a function in `src/lib/db/repos/<resource>Repo.js`
- Re-export from barrel: `src/lib/db/index.js`
- Update `PROTECTED_API_PATHS` in `src/dashboardGuard.js:48` if a new top-level path
- For routes that spawn child processes, add to `LOCAL_ONLY_PATHS` (`src/dashboardGuard.js:69`)

**New DB table:**
- Migration: append a new file under `src/lib/db/migrations/` and register in `src/lib/db/migrations/index.js`
- Schema: `src/lib/db/schema.js`
- Repo: new file in `src/lib/db/repos/<name>Repo.js`
- Barrel re-export: `src/lib/db/index.js`

**New translator:**
- Request: `open-sse/translator/request/<from>-to-<to>.js` calling `register(from, to, requestFn, null)`
- Response: `open-sse/translator/response/<from>-to-<to>.js` calling `register(from, to, null, responseFn)`
- Wire into `ensureInitialized()` (`open-sse/translator/index.js:28`)
- Always pivot through `FORMATS.OPENAI` — do not register direct non-OpenAI ↔ non-OpenAI pairs

**New tunnel/integration manager:**
- Folder: `src/lib/tunnel/<name>/{manager,config,healthCheck}.js`
- Public adapter: `src/lib/tunnel/index.js`
- Watchdog config: `src/lib/tunnel/shared/watchdogConfig.js`

**New MITM tool handler:**
- Handler: `src/mitm/handlers/<tool>.js` (CommonJS)
- Register: `src/mitm/server.js:29` (`handlers` map)
- Target hosts + URL patterns: `src/mitm/config.js`

**New zustand store:**
- File: `src/store/<name>Store.js`
- Re-export: `src/store/index.js`

**Shared utility:**
- Helpers used by client + server: `src/shared/utils/<name>.js`
- Server-only helpers: `src/lib/<name>.js`
- Provider/model registries: `src/shared/constants/`

**Tests:**
- Unit: `tests/unit/<module>.test.js`
- Translator round-trip: `tests/translator/<format>.test.js`

## Special Directories

**`.next/`:**
- Purpose: Next.js build output (`distDir` configurable via `NEXT_DIST_DIR`)
- Generated: Yes
- Committed: No

**`gitbook/`:**
- Purpose: External docs site
- Generated: No (authored)
- Committed: Yes
- Excluded from Next outputFileTracing (`next.config.mjs:21`)

**`.codegraph/`:**
- Purpose: Code intelligence index for the codegraph MCP server
- Generated: Yes
- Committed: No

**`.planning/`:**
- Purpose: GSD planning artifacts (specs, codebase maps, phase plans)
- Generated: By GSD commands
- Committed: Yes (project-specific, see project setup)

**`skills/`:**
- Purpose: Built-in "skills" (chat, image, stt, tts, web-fetch, web-search, embeddings) — bundled extension definitions consumed by the dashboard skills page
- Generated: No
- Committed: Yes

**`cli/app/`:**
- Purpose: Bundled Next standalone build that ships inside the npm CLI package
- Generated: Yes (by `cli/scripts/build-cli.js`)
- Committed: No (built on publish)

**`logs/`:**
- Purpose: Runtime log dumps
- Generated: Yes
- Committed: No (excluded from webpack watcher in `next.config.mjs:42`)

---

*Structure analysis: 2026-06-07*

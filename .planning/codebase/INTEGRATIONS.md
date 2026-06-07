# External Integrations

**Analysis Date:** 2026-06-07

## APIs & External Services

This is the central purpose of 9Router — it routes LLM API calls. Provider definitions live in `open-sse/config/providers.js` (60+ entries). Each entry declares `baseUrl`, `format` (claude / openai / gemini / etc.), optional `headers`, and optional `clientId` / `tokenUrl` / `authUrl` for OAuth-capable providers.

**Anthropic-format providers (chat completions / messages):**
- Anthropic Claude — `https://api.anthropic.com/v1/messages`. OAuth via `https://claude.ai/oauth/authorize` (PKCE). Configured in `src/lib/oauth/constants/oauth.js` `CLAUDE_CONFIG`.
- Z.AI GLM — `https://api.z.ai/api/anthropic/v1/messages`.
- Kimi / Kimi-Coding — `https://api.kimi.com/coding/v1/messages`. OAuth at `https://auth.kimi.com/api/oauth/token` (device-code flow, `KIMI_CODING_CONFIG`).
- MiniMax / MiniMax-CN — `https://api.minimax.io/anthropic/v1/messages`, `https://api.minimaxi.com/anthropic/v1/messages`.
- AgentRouter — `https://agentrouter.org/v1/messages`.

**OpenAI-format providers (chat completions):**
- OpenAI — `https://api.openai.com/v1/chat/completions`.
- DeepSeek, Groq, xAI Grok, Mistral, Perplexity, Together, Fireworks, Cerebras, Cohere, Nebius, SiliconFlow, Hyperbolic, NVIDIA, OpenRouter, Vercel AI Gateway, Chutes.
- Free-tier providers (~30): AIMLAPI, Novita, Modal, Reka, NLP Cloud, Bazaarlink, Completions, Enally, FreeTheAI, llm7, Lepton, Kluster, AI21, Inference.net, Predibase, Bytez, Morph, Longcat, Puter, UncloseAI, Scaleway, DeepInfra, SambaNova, nScale, Baseten, PublicAI, Nous Research, GLHF, Blackbox.
- Vendor coding APIs: Alibaba alicode (`coding.dashscope.aliyuncs.com`), Volcengine Ark, ByteDance ByteDance ByteDance ByteDance ByteDance Plus (`bytepluses.com`), Tencent CodeBuddy (`copilot.tencent.com`), Xiaomi MiMo (`xiaomimimo.com`), Xiaomi Token Plan (region-aware: `sgp` / `cn` / `ams`).
- IDE integrations: GitHub Copilot (`api.githubcopilot.com`, OAuth via GitHub device flow `Iv1.b507a08c87ecfe98`), Cursor (`api2.cursor.sh`, token import from local SQLite `state.vscdb`), Kiro (`codewhisperer.us-east-1.amazonaws.com`, AWS Builder ID / IDC device flow), Qoder (`api3.qoder.sh`), Antigravity (`daily-cloudcode-pa.googleapis.com`).
- KiloCode (`api.kilo.ai`), Cline (`api.cline.bot`), GitLab Duo (`gitlab.com/api/v4`), Opencode (`opencode.ai`).
- Local: ollama-local (`http://localhost:11434`), opencode (`http://localhost:4096`).

**Google / Gemini family:**
- Gemini API — `https://generativelanguage.googleapis.com/v1beta/models`. OAuth `clientId 681255809395-...apps.googleusercontent.com` (`GEMINI_CONFIG`).
- Gemini CLI — `https://cloudcode-pa.googleapis.com/v1internal`.
- Vertex AI — `https://aiplatform.googleapis.com` (Service Account JSON; URL built dynamically by `open-sse/executors/vertex.js`).
- Vertex Partner — same host, OpenAI-compatible global endpoint for Claude/Llama/Mistral/GLM.

**OpenAI Responses API (Codex):**
- ChatGPT Codex — `https://chatgpt.com/backend-api/codex/responses`. OAuth at `https://auth.openai.com/oauth/token` (PKCE, client `app_EMoamEEZ73f0CkXaXp7hrann`).

**Web-scrape providers (cookie auth):**
- Grok Web — `https://grok.com/rest/app-chat/conversations/new` (`authType: "cookie"`).
- Perplexity Web — `https://www.perplexity.ai/rest/sse/perplexity_ask` (`authType: "cookie"`).

**Image generation (`open-sse/handlers/imageProviders/`):**
- OpenAI Images, Gemini, Black Forest Labs, Cloudflare Workers AI, Codex, ComfyUI, fal.ai, HuggingFace, NanoBanana, RunwayML, SD WebUI, Stability AI.

**TTS (`open-sse/handlers/ttsProviders/`):**
- OpenAI, Gemini, Google TTS, ElevenLabs, MiniMax, OpenRouter, Edge TTS, Local Device.

**STT (`open-sse/handlers/sttCore.js`):**
- OpenAI Whisper, Deepgram (`api.deepgram.com/v1/listen`), AssemblyAI (`api.assemblyai.com/v1/audio/transcriptions`).

**Embeddings (`open-sse/handlers/embeddingProviders/`):**
- OpenAI, Gemini, generic OpenAI-compatible, Node-side compat.

**Web search and fetch (`open-sse/handlers/search/`, `open-sse/handlers/fetch/`):**
- Perplexity, OpenAI web search, plus a generic fetch normalizer that returns markdown.

**SDK/Client used for upstream calls:**
- Native `fetch` via `undici`, with `socks-proxy-agent` for SOCKS upstreams. The patched fetch lives in `open-sse/utils/proxyFetch.js`.

**Auth env vars per upstream:**
- Provider credentials are stored in the local SQLite DB (`provider_connections` table, `src/lib/db/repos/connectionsRepo.js`) — not in env. Env-driven exceptions: `OPENAI_API_KEY`, `AZURE_ENDPOINT` / `AZURE_API_VERSION` / `AZURE_DEPLOYMENT` / `AZURE_ORGANIZATION` (`open-sse/executors/azure.js`), `KIMI_CODING_OAUTH_CLIENT_ID`.

## Data Storage

**Databases:**
- SQLite — single file at `${DATA_DIR}/9router.db` (resolved by `src/lib/db/paths.js`).
- Adapter selected at runtime in this order (`src/lib/db/driver.js`): `bun:sqlite` (Bun only) → `better-sqlite3` (Node) → `node:sqlite` (Node ≥22.5) → `sql.js` (always-available fallback).
- Migrations under `src/lib/db/migrations/` (`001-initial.js` + `index.js`).
- Repos under `src/lib/db/repos/` cover settings, provider connections, provider nodes, proxy pools, API keys, combos, aliases, request details, request logs, disabled models, pricing, usage.
- Standalone DBs at the same DATA_DIR: `localDb.js`, `usageDb.js`, `requestDetailsDb.js`, `disabledModelsDb.js` — used by older code paths and high-volume observability.

**File Storage:**
- Local filesystem only. `DATA_DIR` (env, defaults to `~/.9router` or `%APPDATA%\9router`, resolved in `src/lib/dataDir.js`) holds the DB, MITM CA cert (`src/mitm/cert/`), MITM alias cache (`src/lib/mitmAliasCache.js`), and OAuth credential cache.

**Caching:**
- In-memory only. `mitmAliasCache.js` serializes to disk; `open-sse/utils/claudeHeaderCache.js` caches header sets per process; provider response caches are keyed by `CACHE_TTL` (`open-sse/config/runtimeConfig.js`).

## Authentication & Identity

**Dashboard auth:**
- Local — bcrypt-hashed password (initial value seeded from `INITIAL_PASSWORD`, default `123456` if unset; see `src/app/api/auth/login/route.js`).
- JWT session cookie signed with `JWT_SECRET` via `jose` (`src/lib/auth/dashboardSession.js`). Secure flag controlled by `AUTH_COOKIE_SECURE`.
- Login throttling in `src/lib/auth/loginLimiter.js`.

**OIDC (optional dashboard SSO):**
- `src/lib/auth/oidc.js` reads issuer / client id / client secret / scopes from DB settings (`oidcIssuerUrl`, `oidcClientId`, `oidcClientSecret`, `oidcScopes`).
- Verifies tokens via `createRemoteJWKSet` + `jwtVerify` from `jose`.
- Routes: `src/app/api/auth/oidc/`. Auth mode setting accepts `local` / `oidc` / `both`.

**API-key auth (for clients hitting `/v1/*`):**
- API keys stored in DB (`src/lib/db/repos/apiKeysRepo.js`), hashed with `API_KEY_SECRET` salt.
- Toggled by `REQUIRE_API_KEY` env or per-key flags.

**Upstream provider OAuth (in `src/lib/oauth/constants/oauth.js`):**
- Claude / Codex / OpenAI — Authorization Code + PKCE.
- Gemini / Antigravity — Standard OAuth2 (Google).
- Qwen / GitHub Copilot / Kimi-Coding / Kiro — Device Code Flow.
- iFlow — Authorization Code.
- KiloCode — Custom device-auth.
- Cline — Local-callback flow via `app.cline.bot`.
- Cursor — Token import from local IDE SQLite (`state.vscdb`).
- GitLab — Authorization Code + PKCE, also supports PAT.
- CodeBuddy (Tencent) — Browser OAuth polling.
- Routes per provider under `src/app/api/oauth/[provider]/` and dedicated dirs (`codex/`, `cursor/`, `iflow/`, `kiro/`, `gitlab/`).

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry / Datadog / Rollbar dependency).

**Logs:**
- Structured request logging via `src/lib/db/repos/requestDetailsRepo.js` (batched inserts to SQLite). Toggled by `OBSERVABILITY_ENABLED` / `ENABLE_REQUEST_LOGS`. Tunable batch size, flush interval, max records, max JSON size.
- App logger at `src/mitm/logger.js` and `src/lib/consoleLogBuffer.js` for ring-buffered console capture surfaced via `/api/v1/logs`.
- `open-sse/utils/requestLogger.js` and `debugLog.js` add provider-level diagnostics. `CURSOR_STREAM_DEBUG=1` and `CURSOR_PROTOBUF_DEBUG=1` enable extra Cursor debugging.

## CI/CD & Deployment

**Hosting:**
- Self-hosted via Docker (`Dockerfile`, exposes 20128). CapRover compatible (`captain-definition`, schemaVersion 2).
- npm-distributed CLI (`cli/`) for end users (`npm i -g 9router` then `9router`).

**CI Pipeline:**
- GitHub Actions: `.github/workflows/docker-publish.yml` (publishes the Docker image), `.github/workflows/gitbook-pages.yml` (builds the GitBook docs site).
- Dependabot config at `.github/dependabot.yml`.

## Environment Configuration

**Required env vars (`.env.example`):**
- `JWT_SECRET` — dashboard session signing key.
- `INITIAL_PASSWORD` — first-login password seed.
- `DATA_DIR` — SQLite + cache + cert root.

**Recommended:**
- `PORT` (default 20128), `NODE_ENV`.
- `API_KEY_SECRET`, `MACHINE_ID_SALT` — secrets used to derive hashed API keys.
- `BASE_URL` / `NEXT_PUBLIC_BASE_URL` — public origin (used by OIDC redirect URIs and internal sync).
- `CLOUD_URL` / `NEXT_PUBLIC_CLOUD_URL` — defaults to `https://9router.com`; powers `/api/sync/cloud` and CLI-tool config cards.
- `AUTH_COOKIE_SECURE`, `REQUIRE_API_KEY`, `ENABLE_REQUEST_LOGS`, `ENABLE_TRANSLATOR`, `OBSERVABILITY_ENABLED`.

**Outbound proxy:**
- `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`, `NO_PROXY` (lower-case variants accepted). Managed by `src/lib/network/outboundProxy.js`; `NINE_ROUTER_PROXY_MANAGED` flag tracks env mutations performed by the app.

**Tunnel / sync:**
- `TUNNEL_WORKER_URL` (default `https://abc-tunnel.us`), `TUNNEL_TRANSPORT_PROTOCOL` / `CLOUDFLARED_PROTOCOL`.
- `SHUTDOWN_SECRET` — gates `/api/shutdown` outside dev.

**Secrets location:**
- Runtime secrets: `.env` at repo root or DATA_DIR-mounted env file. `.env*` patterns are gitignored. The repo only ships `.env.example`.
- Per-provider OAuth tokens and API keys are stored in the SQLite DB under `provider_connections`, AES-protected at the application layer where applicable. Never read these out of the DB into logs.

## Webhooks & Callbacks

**Incoming:**
- OAuth redirect callbacks: `src/app/callback/` (top-level Next page used as a return URL for browser-based provider OAuth) and `src/app/api/auth/oidc/` for OIDC code exchange.
- `/api/oauth/[provider]/[action]` covers per-provider callback / device-poll endpoints.
- `/api/proxy-pools/cloudflare-deploy/`, `/api/proxy-pools/vercel-deploy/`, `/api/proxy-pools/deno-deploy/` accept deploy results.
- `/api/shutdown` accepts a POST with `SHUTDOWN_SECRET` (production only).

**Outgoing:**
- Cloud sync — `${BASE_URL}/api/sync/cloud` calls the configured `CLOUD_URL` for fleet config.
- Cloudflare Tunnel — `cloudflared` spawned by `src/lib/tunnel/cloudflare/cloudflared.js`, registered with `WORKER_URL` (`TUNNEL_WORKER_URL`).
- Tailscale — `tailscale` CLI invoked by `src/lib/tunnel/tailscale/tailscale.js`.
- Updater service — `src/lib/updater/updater.js` runs on `UPDATER_PORT` (default 20129), pulls from the npm registry for `UPDATER_PKG_NAME` (default `9router`).
- Each upstream provider listed above is itself an outgoing integration; calls flow through `open-sse/utils/proxyFetch.js`.

---

*Integration audit: 2026-06-07*

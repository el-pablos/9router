# Coding Conventions

**Analysis Date:** 2026-06-07

## Naming Patterns

**Files:**
- React components: `PascalCase.js` — e.g. `Button.js`, `Modal.js`, `KiroAuthModal.js` (`src/shared/components/`).
- Non-component modules / utilities / handlers / stores: `camelCase.js` — e.g. `dashboardGuard.js`, `chatCore.js`, `userStore.js`, `embeddingsCore.js`, `tokenRefresh.js`.
- Translator modules use kebab-case for the direction pair: `request/openai-to-claude.js`, `response/kiro-to-openai.js` (`open-sse/translator/`).
- Tests: `kebab-or-camel.test.js` — e.g. `dashboard-guard.test.js`, `embeddingsCore.test.js`, `bugs-codexCli-responses.test.js` (`tests/unit/`, `tests/translator/`).
- Next.js route files always lowercase `route.js` and `page.js`. Route groups use parentheses, e.g. `src/app/(dashboard)/dashboard/...`.
- DB layer is split by responsibility: `repos/<entity>Repo.js`, `adapters/<driver>Adapter.js`, `helpers/<thing>.js` under `src/lib/db/`.

**Functions:**
- camelCase for all functions: `validateApiKey`, `handleEmbeddingsCore`, `buildEmbeddingsBody`, `getRelativeTime`, `formatProviderError`.
- Boolean predicates use `is*` / `has*` / `can*` prefixes: `isLoopbackHostname`, `isPublicLlmApi`, `hasValidCliToken`, `canAccessPublicLlmApi`.
- React component functions use PascalCase and are usually `export default`: `export default function Button(...)`, `export default function Modal(...)`.

**Variables:**
- camelCase for locals and parameters.
- SCREAMING_SNAKE_CASE for module-level constants and config: `PUBLIC_API_PATHS`, `ALWAYS_PROTECTED`, `LOOPBACK_HOSTS`, `CLI_TOKEN_HEADER`, `DEFAULT_HEADERS`, `THEME_CONFIG`, `HTTP_STATUS`.

**Types / classes:**
- This codebase is JavaScript only (no TypeScript). Types are documented via JSDoc on public functions (see `open-sse/utils/error.js`, `src/shared/utils/api.js`).
- Custom Error subclasses use PascalCase: `MigrationAborted` in `src/lib/db/migrate.js`.

**Stores:**
- Zustand hooks use the `useXxxStore` convention with `default` export and a barrel re-export from `src/store/index.js`. Examples: `useUserStore`, `useProviderStore`, `useThemeStore`, `useNotificationStore`.

## Code Style

**Formatting:**
- No Prettier or Biome config detected. Effective style observed across `src/`, `open-sse/`, and `tests/`:
  - 2-space indentation.
  - Double quotes for strings (`"..."`), backticks for interpolation/multiline.
  - Semicolons at end of statements.
  - Trailing commas in multi-line object/array literals.
  - Arrow functions for callbacks and short helpers; `function` keyword for named top-level functions and React components.
- ESM only (`"type"` is implied by Next 16 + `module: "ESNext"` in `jsconfig.json`). All imports use ESM `import ... from "..."`.

**Linting:**
- ESLint 9 flat config in `eslint.config.mjs`, extending `eslint-config-next/core-web-vitals`.
- Default Next.js ignores are explicitly re-applied: `.next/**`, `out/**`, `build/**`, `next-env.d.ts`.
- No custom rule overrides — the project relies on Next core-web-vitals defaults.

## Import Organization

**Order observed across handlers, components, and tests:**
1. External packages (`react`, `next/server`, `zustand`, `vitest`, `node:fs`, `node:path`).
2. Internal aliases via `@/...` (resolves to `src/`).
3. Relative imports (`../../open-sse/...`, `./Button`, `./helpers/jsonCol.js`).
4. CSS / side-effect imports last where applicable.

**Path Aliases (`jsconfig.json`):**
- `@/*` → `./src/*` — used pervasively in `src/` and tests.
- `open-sse` and `open-sse/*` → repo-root `./open-sse/` — translation/handler engine kept out of Next bundle.
- The vitest config (`tests/vitest.config.js`) mirrors both aliases so tests can import either tree with the same paths used at runtime.

**File extensions:**
- Always include `.js` in relative imports (e.g. `import { translateRequest } from "../../open-sse/translator/index.js"`). Required because the open-sse engine is loaded directly by Node/vitest under ESM.

## Error Handling

**Patterns:**
- API/handler layer returns structured result objects, not throws: `handleEmbeddingsCore` returns `{ success, response, status?, error? }` and uses `createErrorResult(HTTP_STATUS.BAD_REQUEST, "...")` (see `open-sse/handlers/embeddingsCore.js`).
- OpenAI-shaped error bodies built by `buildErrorBody(statusCode, message)` in `open-sse/utils/error.js`; HTTP responses created via `errorResponse()`; SSE errors written through `writeStreamError(writer, ...)`.
- Upstream provider errors normalized through `parseUpstreamError(response, executor)` so each executor can override parsing.
- Route guards (`src/dashboardGuard.js`) return `NextResponse.json({ error: "..." }, { status: 401 | 403 })` instead of throwing.
- `try { ... } catch { return false; }` and `try { ... } catch {}` are the standard idioms for best-effort fallbacks (see `dashboardGuard.js:isLocalRequest`, `db-driver-chain.test.js` adapter cleanup).
- Long-running migrations throw a typed error (`MigrationAborted` in `src/lib/db/migrate.js`) so the outer transaction rolls back without losing the legacy JSON.
- Client-side `src/shared/utils/api.js#handleResponse` throws an `Error` enriched with `error.status` and `error.data` for callers to branch on.

## Logging

**Framework:** No external logger — handlers accept an injected `log` object with `debug` / `info` / `warn` / `error` methods. Tests pass `{ debug: vi.fn(), ... }` (`tests/unit/embeddingsCore.test.js`).

**Patterns:**
- Components/server modules use `console.warn` / `console.error` for unexpected branches (e.g. `console.warn` in `src/lib/db/driver.js` when an adapter is unavailable, `console.warn` for migration row-count mismatches in `migrate.js`).
- Handler logs follow a category-prefixed format: `log?.debug?.("EMBEDDINGS", \`${provider.toUpperCase()} | ${model} | ...\`)` and `log?.info?.("TOKEN", \`${provider.toUpperCase()} | refreshed for embeddings\`)`.
- Optional chaining on the log object (`log?.debug?.(...)`) is the convention so handlers run without a logger in tests.

## Comments

**When to Comment:**
- Block comments at the top of modules describe purpose and pipeline position (see `src/lib/db/index.js` "Public API barrel", `tests/unit/embeddingsCore.test.js` header, `migrate.js` migration semantics).
- Inline comments mark non-obvious branches, security-relevant gates (`dashboardGuard.js` "Public API paths — no auth required"), and DB invariants (`MIGRATED_MARKER`, "Track per-adapter so reusing same adapter skips re-run").
- Avoid restating what the code does; use comments for *why* / invariants / pitfalls (e.g. "Skip on Bun — better-sqlite3 native bindings unsupported" in `driver.js`).

**JSDoc:**
- Used on shared utility/public-API functions to document parameters and return shapes: `src/shared/utils/api.js`, `open-sse/utils/error.js`, `open-sse/handlers/embeddingsCore.js`.
- Format: `@param {type} name - description`, `@returns {type} description`. No TS-style typedefs.

## Function Design

**Size:** Handler entry points are large coordinators (e.g. `handleChatCore` in `open-sse/handlers/chatCore.js` decomposes into `chatCore/requestDetail.js`, `sseToJsonHandler.js`, `streamingHandler.js`, `nonStreamingHandler.js`). Helper modules stay small and single-purpose.

**Parameters:**
- Multi-arg public APIs use a single options object with destructuring at the call site: `handleEmbeddingsCore({ body, modelInfo, credentials, log, onCredentialsRefreshed, onRequestSuccess })`, `handleChatCore({ ... })`.
- Two- or three-arg helpers stay positional: `validateApiKey(apiKey)`, `buildErrorBody(statusCode, message)`, `getConsistentMachineId(salt)`.

**Return Values:**
- Server handlers return Web `Response` objects (`new Response(JSON.stringify(...), { status, headers })`) or wrapper results (`createErrorResult(...)`).
- Client utilities return parsed JSON or throw enriched `Error` (`src/shared/utils/api.js`).
- Translators return plain JS objects (the translated body) — never throw on supported inputs; bugs are logged as `it.fails` translator tests.

## Module Design

**Exports:**
- Components: `export default function ComponentName(...)`. Sub-components attached to the default export when tightly coupled (`Card.Section`, `Card.Row`, `Card.ListItem` in `src/shared/components/Card.js`; `ConfirmModal` named-exported alongside default `Modal`).
- Utilities and DB repos: named exports (`export function ...`) with a barrel index that re-exports.
- Stores: `export default useXxxStore` plus barrel re-export in `src/store/index.js`.

**Barrel Files:**
- `src/shared/components/index.js` re-exports every component.
- `src/shared/utils/index.js` re-exports `cn`, namespace-reexports `api`, and adds `generateId` / `getErrorCode` / `getRelativeTime`.
- `src/store/index.js` re-exports stores.
- `src/lib/db/index.js` is the canonical DB public surface: groups exports by domain (Settings, Provider connections, API keys, Combos, Aliases, Pricing, Disabled models, Usage, ...). New DB functionality goes through this barrel.
- `open-sse/translator/index.js` exposes `translateRequest` / `translateResponse` / `register`. The translator registry uses `require()` for lazy loading at runtime; tests must explicitly `import "./registerAll.js"` (see `tests/translator/registerAll.js`) before calling translate.

## Client / Server Boundary

- Every browser-only file starts with `"use client";` (e.g. `src/shared/components/Button.js`, `src/store/userStore.js`, `src/store/themeStore.js`). Server-only modules omit it.
- DB and auth modules under `src/lib/` are pure server code — they import `node:fs`, `node:path`, and SQLite adapters and must never be imported from a client component.
- `src/dashboardGuard.js` is the Next middleware/proxy that gates dashboard, `/api/*`, `/v1*`, and `/v1beta*` paths; new public LLM endpoints go under one of `PUBLIC_PREFIXES`, new authenticated routes are added to `PROTECTED_API_PATHS`, and host-secret/spawn routes go to `LOCAL_ONLY_PATHS`.

## State Management

- React state via Zustand stores under `src/store/`. Standard shape: `{ data, loading, error, lastFetched, set*, fetch*, invalidate }`.
- Cached fetches honor `CLIENT_STORE_TTL_MS` from `@/shared/constants/config` and accept `{ force: true }` to bypass (`useProviderStore.fetchProviders`).
- `useThemeStore` uses Zustand `persist` middleware keyed by `THEME_CONFIG.storageKey` and applies the theme via a `applyTheme()` side effect; do not branch on `window` without the `typeof window === "undefined"` guard already present.

## Styling

- Tailwind v4 (`tailwindcss`, `@tailwindcss/postcss` in `devDependencies`, `postcss.config.mjs`).
- Class composition uses `cn(...classes)` from `src/shared/utils/cn.js` — a minimal Boolean-filter+dedupe joiner. There is no `clsx`/`tailwind-merge`. Pass conditional segments as `condition && "class-name"`.
- Design tokens use CSS variables via `bg-surface`, `bg-surface-2`, `text-text-main`, `text-text-muted`, `border-border-subtle`, `shadow-[var(--shadow-elev)]`, `bg-brand-500`. Reuse these, do not hard-code hex unless mirroring an existing token (traffic-light dots in `Modal.js`).
- Material Symbols are rendered as `<span className="material-symbols-outlined ...">{icon}</span>`. Components like `Button` and `Modal` already accept an `icon`/`iconRight` prop name — pattern-match the existing components rather than inlining new icon containers.

---

*Convention analysis: 2026-06-07*

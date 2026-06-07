# Testing Patterns

**Analysis Date:** 2026-06-07

## Test Framework

**Runner:**
- Vitest 4.x (`tests/package.json` `devDependencies.vitest: ^4.0.0`).
- Config: `tests/vitest.config.js` — `environment: "node"`, `globals: true`, `include: ["**/*.test.js"]`, `maxConcurrency: 60`.

**Assertion Library:**
- Built-in `expect` from Vitest. No Chai/Jest extensions.

**Setup:**
- Vitest is installed under `/tmp/node_modules` because the root `package.json` (Next.js app) does not declare it. The `tests/` workspace shells out to that install via `NODE_PATH=/tmp/node_modules /tmp/node_modules/.bin/vitest`.
- Path aliases (`@/...`, `open-sse`) are mirrored in `tests/vitest.config.js` so test imports match runtime imports.
- `tests/README.md` documents the install path; `tests/translator/AGENTS.md` documents the translator-specific setup.

**Run Commands:**
```bash
# From tests/ directory (npm script in tests/package.json)
npm test                                           # vitest run --reporter=verbose
npm run test:watch                                 # vitest --reporter=verbose

# From repo root, full path (matches CI / agent usage)
NODE_PATH=/tmp/node_modules /tmp/node_modules/.bin/vitest run \
  --config tests/vitest.config.js --reporter=verbose

# Translator subset (default = no creds, offline)
npx vitest run --config tests/vitest.config.js "tests/translator/"

# Real-provider smoke (gated by env var, reads ~/.9router/db/data.sqlite)
RUN_REAL=1 npx vitest run --config tests/vitest.config.js "tests/translator/real/"
```

`--config tests/vitest.config.js` is required from the repo root — without it Vitest cannot resolve `@/...` subpath imports.

## Test File Organization

**Location:**
- Tests live in a top-level `tests/` workspace, not co-located with source files.
- Two subdirectories:
  - `tests/unit/` — handler/db/auth/translator unit tests (~50 files).
  - `tests/translator/` — data-driven translator coverage and bug-exposure tests, plus `tests/translator/real/` for live provider smokes.

**Naming:**
- `<feature>.test.js` for plain unit tests: `embeddingsCore.test.js`, `dashboard-guard.test.js`, `db-driver-chain.test.js`.
- `bugs-<area>.test.js` for known-bug exposure (`bugs-openai-bridge.test.js`, `bugs-claudeCode-context.test.js`, `bugs-kiro.test.js`).
- `<feature>.e2e.test.js` for in-process end-to-end (`rtk.e2e.test.js`, `rtk.multi-provider.e2e.test.js`).

**Structure:**
```
tests/
├── README.md                 # Setup + run instructions
├── package.json              # Workspace pinning vitest ^4
├── vitest.config.js          # Aliases (@/*, open-sse, open-sse/*)
├── unit/                     # Unit tests for handlers, db, translator pieces
│   ├── *.test.js
│   └── ...
└── translator/
    ├── AGENTS.md             # Translator test charter
    ├── matrix.js             # Reads PROVIDER_MODELS → builds test matrix
    ├── registerAll.js        # Eagerly imports every translator (mandatory)
    ├── coverage-all-models.test.js
    ├── format-roundtrip.test.js
    ├── bugs-*.test.js
    └── real/                 # RUN_REAL=1, calls live providers
```

## Test Structure

**Suite Organization (typical pattern):**
```javascript
import { describe, it, expect, vi, beforeEach } from "vitest";

// 1. Hoisted mocks for cross-module dependencies (use vi.hoisted)
const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  validateApiKey: vi.fn(),
}));

vi.mock("@/lib/localDb", () => ({
  getSettings: mocks.getSettings,
  validateApiKey: mocks.validateApiKey,
}));

// 2. Dynamic import AFTER mocks are registered
const { proxy } = await import("../../src/dashboardGuard.js");

// 3. Group by behaviour with nested describe
describe("dashboard guard public LLM API access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSettings.mockResolvedValue({ requireLogin: true });
  });

  it("allows loopback public LLM API without API key", async () => {
    const response = await proxy(request("/v1/chat/completions", { host: "localhost:20128" }));
    expect(response).toBe(mocks.nextResponse);
  });
});
```
(See `tests/unit/dashboard-guard.test.js`.)

**Patterns:**
- `beforeEach(vi.clearAllMocks)` resets call history between tests; `vi.resetModules()` is used when modules cache state (`tests/unit/db-driver-chain.test.js`, `db-migration-chain.test.js`).
- Temp directories for DB tests: `fs.mkdtempSync(path.join(os.tmpdir(), "9router-..."))`, `process.env.DATA_DIR = tempDir`, with `afterEach`/`afterAll` cleanup that closes adapters via `global._dbAdapter?.instance?.close?.()` and removes the dir.
- Helper builders inside the test file generate the request/options shape (`makeOptions(overrides)`, `makeProviderResponse(body, status)`, `request(pathname, headers)`, `createState()`). Override-by-spread keeps each test focused on the field under test.
- Behaviour grouped under `describe("<thing>", () => describe("<sub-behaviour>", ...))` rather than long flat lists.

## Mocking

**Framework:** Vitest's `vi` API exclusively (`vi.fn`, `vi.mock`, `vi.hoisted`, `vi.stubGlobal`, `vi.unstubAllGlobals`, `vi.doMock`, `vi.resetModules`).

**Hoisted module mocks:**
```javascript
vi.mock("../../open-sse/executors/index.js", () => ({
  getExecutor: vi.fn(() => ({ refreshCredentials: vi.fn().mockResolvedValue(null) })),
  hasSpecializedExecutor: vi.fn(() => false),
}));

vi.mock("../../open-sse/services/tokenRefresh.js", () => ({
  refreshWithRetry: vi.fn().mockResolvedValue(null),
}));
```
(See `tests/unit/embeddingsCore.test.js` — mocks the executor layer to avoid pulling in `uuid` and proxy-agent transitive deps.)

**Global stubs:**
```javascript
beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); });
afterEach(() => { vi.unstubAllGlobals(); });

vi.mocked(fetch).mockResolvedValueOnce(makeProviderResponse(VALID_EMBEDDING_RESPONSE));
const [, init] = vi.mocked(fetch).mock.calls[0];
const sent = JSON.parse(init.body);
expect(sent.model).toBe("text-embedding-ada-002");
```
This is the standard way to assert outbound HTTP shape without hitting the network.

**Hoisted shared mock object:**
`vi.hoisted(() => ({ ... vi.fn() ... }))` is used in `dashboard-guard.test.js` so the mock factory can reference the same `vi.fn()` instances that the test body asserts against.

**Dynamic adapter mocking (driver fallback chain):**
```javascript
vi.doMock("@/lib/db/adapters/betterSqliteAdapter.js", () => {
  throw new Error("simulated unavailable");
});
const { getAdapter } = await import("@/lib/db/driver.js");
```
(See `tests/unit/db-driver-chain.test.js`.) `vi.doMock` runs after import-time mocks, paired with `vi.resetModules()` per `beforeEach`.

**What to Mock:**
- Network calls — always stub `fetch` rather than hit real services in non-`real/` tests.
- Heavy-runtime modules (`open-sse/executors/index.js`, `open-sse/services/tokenRefresh.js`, `open-sse/utils/proxyFetch.js`) when their transitive deps (`uuid`, `socks-proxy-agent`) are not installed in CI.
- Next runtime (`next/server`) when testing middleware/guards in isolation.
- DB adapters (`@/lib/db/adapters/*`) when verifying fallback behaviour.
- `node-machine-id` / machineId helpers via `@/shared/utils/machineId`.

**What NOT to Mock:**
- The translator pipeline. `coverage-all-models.test.js` runs the real `translateRequest` against every entry in `PROVIDER_MODELS` to catch regressions; `tests/translator/registerAll.js` must be imported so registry side effects run under ESM.
- The DB layer in concurrency / migration tests — they exercise the real `better-sqlite3` / `node:sqlite` / `sql.js` adapters against a temp `DATA_DIR` to verify atomic counters and migration row-count assertions.

## Fixtures and Factories

**Test Data:**
- Inline factories produce minimal request/response shapes specific to each test:
```javascript
function makeProviderResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const VALID_EMBEDDING_RESPONSE = {
  object: "list",
  data: [{ object: "embedding", index: 0, embedding: [0.1, 0.2, 0.3] }],
  model: "text-embedding-ada-002",
  usage: { prompt_tokens: 3, total_tokens: 3 },
};
```
- Translator coverage uses `tests/translator/matrix.js` to derive the test matrix from `open-sse/config/providerModels.js` so adding a provider auto-extends coverage with no test edits.

**Location:**
- No `__fixtures__/` folder — every test owns its data inline. Adversarial / large inputs are generated by helper functions inside the file (`makeLongDiff`, `makeGitStatus`, `makeGrepOutput`, `makeFindOutput` in `tests/unit/rtk.test.js`).

## Coverage

**Requirements:** None enforced. There is no coverage threshold or `--coverage` script in `tests/package.json`.

**View Coverage:**
```bash
NODE_PATH=/tmp/node_modules /tmp/node_modules/.bin/vitest run \
  --config tests/vitest.config.js --coverage
```
(Vitest's built-in v8 coverage works if `@vitest/coverage-v8` is installed alongside `vitest` in `/tmp/node_modules`.)

## Test Types

**Unit Tests (`tests/unit/`):**
- Scope: a single handler / module / utility with all collaborators mocked.
- Examples: `embeddingsCore.test.js`, `dashboard-guard.test.js`, `xai-tokenRefresh.test.js`, `provider-validation.test.js`, `oauth-cursor-auto-import.test.js`.

**Translator Coverage (`tests/translator/`):**
- Tier 1 — `coverage-all-models.test.js`: every model in `PROVIDER_MODELS` must translate without throwing; `strip` semantics enforced.
- Tier 2 — `format-roundtrip.test.js`: tool-call ids, system messages, parallel calls survive the OpenAI bridge.
- Tier 3 — `bugs-*.test.js`: documented bridge bugs pinned via `it.fails`.

**Bug-Exposure (`it.fails`) Convention:**
- Confirmed-but-unfixed bugs use `it.fails(...)` so the test passes while the bug exists and turns red the moment it is fixed (a reminder to flip back to `it`).
- Each `it.fails` block carries a comment with the source `file:line` of the bug (see `tests/translator/AGENTS.md` §6 and §8 for the live registry).

**Integration / E2E:**
- In-process E2E for the RTK token-saver and multi-provider routing: `rtk.e2e.test.js`, `rtk.multi-provider.e2e.test.js` import the real handlers and feed crafted SSE/JSON.
- DB benchmark/concurrency: `db-benchmark.test.js`, `db-concurrent.test.js`, `db-sqlite-vs-lowdb.test.js` spin up real adapters against a temp dir.
- Translator real-provider smokes: `tests/translator/real/` gated by `RUN_REAL=1`. They read active connections from `~/.9router/db/data.sqlite`, send a tiny prompt per provider through `handleChatCore`, and **skip** (not fail) on credential errors (401/402/403/429).

**Concurrency:**
- `tests/vitest.config.js` sets `maxConcurrency: 60` so `it.concurrent` cases (~50 real providers in parallel) fit in one worker.

## Common Patterns

**Async Testing:**
```javascript
it("returns 401 when API key missing", async () => {
  mocks.validateApiKey.mockResolvedValue(false);
  const response = await proxy(request("/api/v1/chat/completions", { host: "router.example.com" }));
  expect(response.status).toBe(401);
});
```
- All handlers under test are async; tests are `async () => { await ... }` throughout.
- `mockResolvedValue` / `mockResolvedValueOnce` for stubbing async returns; `mockRejectedValueOnce` for transient failures.

**Error Testing:**
```javascript
vi.mocked(fetch).mockResolvedValueOnce(makeProviderErrorResponse(429, "rate limited"));
const result = await handleEmbeddingsCore(makeOptions());
expect(result.success).toBe(false);
expect(result.status).toBe(429);
```
- Handlers return `{ success: false, status, error }` — assert on the result object rather than wrapping in `expect(...).rejects` (which is reserved for places that genuinely throw, e.g. migration assertions).

**Module-Cache Isolation:**
```javascript
beforeEach(() => {
  delete global._dbAdapter;
  vi.resetModules();
});
```
Required for any test that imports `@/lib/db/driver.js` because the adapter is cached on `globalThis._dbAdapter` to survive Next.js dev hot-reload.

**Translator Tests — Mandatory Import:**
```javascript
import "./registerAll.js";  // before any translateRequest/translateResponse import
import { translateRequest } from "../../open-sse/translator/index.js";
```
Without `registerAll.js` the registry is empty under ESM (the engine uses `require()` for lazy loading), so `translateRequest` silently falls through to passthrough and tests false-pass.

---

*Testing analysis: 2026-06-07*

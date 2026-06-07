# Codebase Concerns

**Analysis Date:** 2026-06-07

## Tech Debt

**Duplicate provider detail page (uncommitted refactor):**
- Issue: `src/app/(dashboard)/dashboard/providers/[id]/page.js` (1,570 lines) and a parallel `page.new.js` (1,724 lines) coexist in the same route directory. `page.new.js` is dead code (Next will only resolve `page.js`) but keeps drifting in parallel and contains its own copies of `setInterval`, modal state, and OAuth flows.
- Files: `src/app/(dashboard)/dashboard/providers/[id]/page.js`, `src/app/(dashboard)/dashboard/providers/[id]/page.new.js`
- Impact: Bug fixes applied to one file silently miss the other; bundle and review noise; future contributors will not know which is canonical.
- Fix approach: Decide which version is current, port any unique logic to `page.js`, then delete `page.new.js`. Extract shared pieces (`ConnectionRow`, `ModelRow`, OAuth-modal wiring) into hooks the way the surrounding `components/` directory already does.

**Cloud SSE logger ships at DEBUG with `warn` silenced:**
- Issue: `src/sse/utils/logger.js` hard-codes `LEVEL = LOG_LEVELS.DEBUG`, prints emoji + ANSI color via `console.log` for every request, and the `warn` body is commented out so warnings are dropped on the floor.
- Files: `src/sse/utils/logger.js`
- Impact: Production logs are flooded (every chat/embedding/STT request logs request, response, and stream events with full payload metadata) and real warnings (e.g. "Missing API key", "Invalid API key" from `src/sse/handlers/*.js`) never appear in any sink.
- Fix approach: Make `LEVEL` env-driven (`process.env.LOG_LEVEL`), restore `console.warn` inside `warn()`, and route through `src/lib/consoleLogBuffer.js` so the dashboard console-log viewer sees them.

**Massive client components blocking incremental work:**
- Issue: Several React route files exceed 1,000 lines and mix data fetching, OAuth, modal state, and rendering in one default export.
  - `src/app/(dashboard)/dashboard/providers/[id]/page.js` — 1,570 lines
  - `src/app/(dashboard)/dashboard/profile/page.js` — ~40 KB
  - `src/app/(dashboard)/dashboard/endpoint/EndpointPageClient.js` — ~40 KB, with raw `setTimeout(r, 1000/3000)` polling
  - `src/app/(dashboard)/dashboard/basic-chat/BasicChatPageClient.js` — ~40 KB
  - `src/app/(dashboard)/dashboard/cli-tools/components/CoworkToolCard.js` — ~33 KB
- Impact: Slow editor performance, tangled state, hard-to-test logic, and high merge-conflict risk on the dashboard surface.
- Fix approach: Pull data layer into `useProviderConnections`/`useEndpointStatus` style hooks under `src/shared/hooks`, and split modals + sub-cards into siblings under each route's `components/` folder (the providers route already has the right scaffolding).

**Module-scoped `global._*` singletons:**
- Issue: `src/lib/db/repos/usageRepo.js` stores 6 globals (`_pendingRequests`, `_lastErrorProvider`, `_statsEmitter`, `_pendingTimers`, `_recentRing`, `_connectionMapCache`); `src/lib/consoleLogBuffer.js`, `src/lib/db/driver.js` (`global._dbAdapter`), and `src/shared/services/initializeApp.js` (`global.__appSingleton`) follow the same pattern to survive Next.js dev hot-reload.
- Files: `src/lib/db/repos/usageRepo.js`, `src/lib/consoleLogBuffer.js`, `src/lib/db/driver.js`, `src/shared/services/bootstrap.js`, `src/shared/services/initializeApp.js`
- Impact: Hidden cross-module coupling, untestable units (every test sees the same shared state), and silent leaks if a module ever gets imported twice under different paths.
- Fix approach: Wrap each global in a single `getXxxState()` accessor under `src/lib/state/` and have tests reset via an exposed `__resetForTests()` hook.

**Heavy reliance on `child_process` for process management:**
- Issue: `appUpdater.js`, `mitm/manager.js`, `mitm/server.js`, `mitm/winElevated.js`, `lib/updater/updater.js`, and `lib/mcp/stdioSseBridge.js` shell out to `taskkill`, `powershell`, `sudo`, `kill`, `lsof`, `ipconfig`, `tasklist`, `ps aux`, etc. PIDs flow into shell strings via interpolation.
- Files: `src/lib/appUpdater.js`, `src/mitm/manager.js`, `src/mitm/server.js`, `src/mitm/winElevated.js`, `src/lib/updater/updater.js`, `src/lib/mcp/stdioSseBridge.js`
- Impact: Cross-platform fragility, and although PIDs are parsed from `parseInt`/regex (so injection is unlikely today), the pattern invites future bugs the moment a non-numeric value is passed in.
- Fix approach: Centralize a `safeKillPid(pid)` helper that validates `Number.isInteger(pid) && pid > 0` and uses argv-array `spawnSync` instead of string commands. Already partly true; finish the migration.

## Known Bugs

**`warn()` is a silent no-op in cloud SSE logger:**
- Symptoms: API-key-related warnings logged from `src/sse/handlers/{embeddings,fetch,search,imageGeneration,stt,tts}.js` never reach stdout.
- Files: `src/sse/utils/logger.js` (line 43, body commented out)
- Trigger: Any request hitting an SSE endpoint with `requireApiKey=true` and a missing or invalid key.
- Workaround: Temporarily uncomment line 43 or call `error()` instead.

**Kiro debug log path resolves under `__dirname` of the bundled handler:**
- Symptoms: When Next bundles `src/mitm/handlers/kiro.js`, `path.join(__dirname, "../../../data/logs/mitm/kiro-debug.log")` may land outside the project's `data/` directory in standalone builds, and writes silently swallow via `try { … } catch {}` (line 13).
- Files: `src/mitm/handlers/kiro.js`
- Trigger: Running the Bun standalone build with `IS_DEV=true`.
- Workaround: Resolve the path off `DATA_DIR` from `src/lib/dataDir.js` instead of `__dirname`.

## Security Considerations

**MITM TLS uses `rejectUnauthorized: false` for upstream:**
- Risk: The MITM proxy disables certificate validation when forwarding to origin servers (ALPN probe + HTTP/2 + HTTPS passthrough).
- Files: `src/mitm/server.js` (lines 195, 228, 290), `src/mitm/manager.js` (line 349 — health check on localhost is fine)
- Current mitigation: Traffic is locally intercepted on `127.0.0.1:443` and only forwarded to known CLI-tool hosts (`TOOL_HOSTS` in `src/mitm/dns/dnsConfig.js`).
- Recommendations: Pin/validate certs for the small set of upstream hosts the MITM serves, or surface a setting to toggle strict TLS for advanced users.

**Inline `<script>` via `dangerouslySetInnerHTML` and unsanitized markdown:**
- Risk: `src/app/layout.js:35` injects an inline bootstrap script (theme/locale priming), and `src/shared/components/ChangelogModal.js:84` renders `marked`-produced HTML with `dangerouslySetInnerHTML` from `CHANGELOG.md`.
- Files: `src/app/layout.js`, `src/shared/components/ChangelogModal.js`
- Current mitigation: The changelog source is bundled at build time, so it is not user-controlled today.
- Recommendations: Add a strict CSP and move the inline-script payload behind a nonce; if the changelog ever loads from network, run it through DOMPurify.

**MD5 used for Qoder request signing:**
- Risk: `src/lib/qoder/cosy.js` computes `crypto.createHash("md5")` for both signature and body hash.
- Files: `src/lib/qoder/cosy.js` (lines 73, 148, 151)
- Current mitigation: This is dictated by the Qoder upstream protocol, not our choice.
- Recommendations: Document the upstream constraint inline; switch to SHA-256 the moment the provider supports it.

**SHA-1 cert fingerprint:**
- Risk: `src/mitm/cert/install.js:36` derives the root CA fingerprint via SHA-1.
- Current mitigation: Used only to compare a locally generated cert against the OS trust store, not to authenticate remote peers.
- Recommendations: Add SHA-256 alongside for forward compatibility.

**Dynamic SQL via template strings:**
- Risk: `connectionsRepo.js`, `nodesRepo.js`, `proxyPoolsRepo.js` all build `WHERE` clauses by joining caller-controlled keys (`${where.join(" AND ")}`).
- Files: `src/lib/db/repos/connectionsRepo.js:65`, `src/lib/db/repos/nodesRepo.js:46`, `src/lib/db/repos/proxyPoolsRepo.js:48`
- Current mitigation: Values are bound as parameters; only column names are interpolated, and they come from a fixed allow-list of keys inside the same function.
- Recommendations: Introduce a `safeColumn()` helper that validates against a literal whitelist so future contributors cannot accidentally widen the surface.

**`SAVEPOINT`/`RELEASE` use interpolated identifiers:**
- Risk: `src/lib/db/adapters/{nodeSqlite,sqljs}Adapter.js` build savepoint statements with template strings.
- Current mitigation: Identifiers come from internal counters (`sp_${id}`), never user input.
- Recommendations: None urgent; document the invariant in the file header.

## Performance Bottlenecks

**SSE logger formats and stringifies on every event regardless of level:**
- Problem: `formatData()` runs `JSON.stringify` on every `debug`/`info`/`stream` call before the level check is even reached.
- Files: `src/sse/utils/logger.js`
- Cause: The level guard is inside each function, after `formatData(data)` is invoked.
- Improvement: Skip serialization when `LEVEL > requested level`; better, expose `if (logger.isDebug)` short-circuits.

**Dashboard polling via `setInterval(updateRemaining, 1000)`:**
- Problem: Multiple cards (`ConnectionRow`, `CooldownTimer`, `ConnectionsCard`, `UsageStats`, login retry counter) tick every 1s via independent intervals.
- Files: `src/app/(dashboard)/dashboard/providers/[id]/ConnectionRow.js:99`, `…/CooldownTimer.js:27`, `…/providers/components/ConnectionsCard.js:21,73`, `src/shared/components/UsageStats.js:33`
- Cause: Each component owns its own clock.
- Improvement: One global "now" store in `src/store/` ticking once a second; components subscribe via Zustand selectors.

**Provider models / availability fetched independently per row:**
- Problem: `ModelAvailabilityBadge` polls `setInterval(fetchStatus, 30000)` per row.
- Files: `src/app/(dashboard)/dashboard/providers/components/ModelAvailabilityBadge.js:45`
- Cause: No shared cache.
- Improvement: Hoist into `providerStore` with a single 30s tick that fans out to subscribers.

**OAuth flows hard-block 3–5 seconds:**
- Problem: `await new Promise(r => setTimeout(r, 5000))` blocks the OAuth callback in several providers.
- Files: `src/lib/oauth/providers.js:498`, `src/lib/oauth/services/antigravity.js:178`, `src/lib/oauth/services/qwen.js:75`
- Cause: Wait-for-token-availability heuristic.
- Improvement: Replace fixed sleeps with bounded polling (`while now < deadline: ping; sleep 200ms`).

## Fragile Areas

**MITM lifecycle (start/stop/restart/elevation):**
- Files: `src/mitm/manager.js` (851 lines), `src/mitm/server.js`, `src/mitm/winElevated.js`
- Why fragile: Multiple PID files, restart counters, OS-specific `taskkill`/`sudo`/`lsof` paths, port-443 ownership checks, and DNS rewrites all live in one module. Any failure mode (admin denied, port held by another process, stale PID file) needs to walk through all branches.
- Safe modification: Add a contract test for each platform path against a fake `child_process` before changing logic.
- Test coverage: `tests/unit/antigravity-mitm.test.js` covers handler routing only; manager start/stop behavior is uncovered.

**DB driver chain with 4 fallbacks:**
- Files: `src/lib/db/driver.js`, `src/lib/db/adapters/{betterSqlite,nodeSqlite,bunSqlite,sqljs}Adapter.js`
- Why fragile: Chain order (`bun:sqlite → better-sqlite3 → node:sqlite → sql.js`) plus migrations in `src/lib/db/migrate.js` that run `ALTER TABLE` with interpolated `safeDef` strings; sql.js path is async-flushed and depends on a `setTimeout` debounce.
- Safe modification: Run `tests/unit/db-driver-chain.test.js` and `db-migration-chain.test.js` after any change to driver selection.
- Test coverage: Good (`db-benchmark`, `db-concurrent`, `db-driver-chain`, `db-migration-chain`, `db-sqlite-vs-lowdb`).

**Tunnel manager (Cloudflare + Tailscale):**
- Files: `src/lib/tunnel/cloudflare/manager.js`, `src/lib/tunnel/tailscale/tailscale.js` (~29 KB), `src/lib/tunnel/tailscale/manager.js`
- Why fragile: Heavy `console.log` (15+ each), spawned child processes, sudo prompts, virtual-interface filtering recently patched (`293cf40 fix(tunnel): skip virtual interfaces to prevent false netchange watchdog`).
- Safe modification: Smoke test on each OS after touching; flagged in recent commits as netchange-sensitive.
- Test coverage: None directly — relies on manual verification.

**Codex/Anthropic streaming + token refresh:**
- Files: `src/lib/oauth/services/codex.js`, `src/sse/services/tokenRefresh.js`, `src/sse/handlers/chat.js`
- Why fragile: Recent commit `9caea88 fix(codex): harden streaming timeouts + Responses terminal events` shows this surface is still being shaken out.
- Safe modification: Run `tests/unit/codex-refresh-token.test.js`, `openai-responses-terminal-event.test.js`, `responses-abort-terminal.test.js`.
- Test coverage: Decent for Codex; still gaps around mid-stream disconnect.

## Scaling Limits

**SSE-handler `console.log` throughput:**
- Current capacity: One `console.log` per request line + one per response + one per stream event.
- Limit: Stdout buffer becomes the bottleneck under sustained load; node's `process.stdout` is synchronous on Windows.
- Scaling path: Level-gate the logger (see above) and batch via `consoleLogBuffer`.

**Usage in-memory state (`global._recentRing`, `global._connectionMapCache`):**
- Current capacity: 50-entry ring (`RING_CAP = 50` in `usageRepo.js:7`) and 30-second connection cache (`CONN_CACHE_TTL_MS = 30 * 1000`).
- Limit: A single-process Next worker; multi-instance deploys would diverge.
- Scaling path: Persist hot stats to SQLite or Redis if the dashboard is ever fronted by multiple workers.

## Dependencies at Risk

**`better-sqlite3` listed as `optionalDependencies`:**
- Risk: When the optional install fails (no build tools), the app silently falls back to `sql.js`, which is dramatically slower.
- Files: `package.json` (lines 46–49), `src/lib/db/driver.js`
- Impact: Performance regression invisible to users.
- Migration plan: Surface adapter selection in the dashboard "About" panel so users know which engine they got.

**`fs` listed as a runtime dependency:**
- Risk: `package.json:24` declares `"fs": "^0.0.1-security"` — this is the squatter package, not Node's built-in.
- Files: `package.json`
- Impact: Pure noise but flags as suspicious to dependency scanners.
- Migration plan: Remove the line; `require("fs")` already resolves to the Node built-in.

**`node-machine-id` + `bcryptjs` + `node-forge`:**
- Risk: `bcryptjs` is pure-JS (slow hashing) and `node-forge` is mostly used here for cert generation; both have native alternatives.
- Files: `src/lib/auth/*`, `src/mitm/cert/generate.js`
- Impact: Login flow latency on slow machines.
- Migration plan: Optional — switch to `bcrypt` (native) once the project drops sql.js fallback.

## Missing Critical Features

**No structured/centralized logger:**
- Problem: Logging is split across `src/sse/utils/logger.js` (emoji + ANSI), `src/mitm/logger.js`, `src/lib/consoleLogBuffer.js`, and bare `console.log`/`console.warn` in 30+ files.
- Blocks: Log-level config, JSON-line output for shipping, redaction of API keys in messages.

**No automated end-to-end smoke for the dashboard:**
- Problem: 50+ unit tests under `tests/unit/`, but no Playwright/Cypress run that boots Next and clicks through the providers/tunnel flows.
- Blocks: Catching regressions in the 1,500-line route components before users do.

## Test Coverage Gaps

**MITM manager start/stop/restart logic:**
- What's not tested: Port-443 takeover, PID file recovery, `MITM_RESTART_DELAYS_MS` backoff, sudo/admin elevation prompts.
- Files: `src/mitm/manager.js`
- Risk: Silent breakage on Windows updates / macOS permission changes.
- Priority: High.

**Tunnel managers:**
- What's not tested: `cloudflared` and `tailscale` lifecycle, virtual-interface skipping (recent fix in `293cf40`).
- Files: `src/lib/tunnel/cloudflare/manager.js`, `src/lib/tunnel/tailscale/manager.js`, `src/lib/tunnel/tailscale/tailscale.js`
- Risk: Network-change watchdog regressions.
- Priority: High.

**Dashboard route components:**
- What's not tested: `providers/[id]/page.js`, `endpoint/EndpointPageClient.js`, `basic-chat/BasicChatPageClient.js`, `combos/page.js`.
- Files: `src/app/(dashboard)/dashboard/**`
- Risk: Largest and most-changed surface area has no React-level tests.
- Priority: Medium-High.

**App updater (kill + relaunch on Windows/macOS/Linux):**
- What's not tested: PID collection, MITM PID file handling, cloudflared/tray binary teardown.
- Files: `src/lib/appUpdater.js`, `src/lib/updater/updater.js`
- Risk: Failed updates leave zombie processes holding port 443 or the install dir.
- Priority: Medium.

**OAuth providers' fixed-sleep token waits:**
- What's not tested: 3–5s sleeps in `src/lib/oauth/providers.js`, `…/services/antigravity.js`, `…/services/qwen.js`.
- Files: see above.
- Risk: Provider-side timing changes cause silent first-time login failures.
- Priority: Medium.

---

*Concerns audit: 2026-06-07*

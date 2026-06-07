# Quick Task 260607-r9f: Verify Kiro profileArn fix + add API-key auth

**Date:** 2026-06-07
**Branch:** feat/kiro-claude-direct-translator
**Status:** complete

## Goal

Cross-check our `worktree-kiro-profilearn-fix` profileArn work against the
reference fork `huydepzai121/Kiro-Go`, fix discrepancies, and add API-key-based
auth for the kiro provider (the fork supports both OAuth and API key; we only
had OAuth).

## Verification findings

1. **Branch topology gap.** The profileArn `postExchange` fix lived only on
   `worktree-kiro-profilearn-fix`, which does NOT contain the direct-translator
   + outbound executor work (`open-sse/executors/kiro.js`, commit 36cf8e9).
   The active branch `feat/kiro-claude-direct-translator` had the executor but
   the OLD kiro `mapTokens` (no profileArn fetch). The fix had to be ported here
   to be effective, since this is the branch whose executor actually consumes
   `providerSpecificData.profileArn`.

2. **profileArn fetch mechanism — confirmed correct.** Our fix calls
   `codewhisperer.{region}.amazonaws.com` with header
   `x-amz-target: AmazonCodeWhispererService.ListAvailableProfiles`. This matches
   our own existing `KiroService.listAvailableModels` (JSON-1.0 + x-amz-target),
   so the approach is internally consistent and valid. The Kiro-Go fork instead
   uses path-based routing (`POST /ListAvailableProfiles`) — a different but
   equivalent surface of the same service.

3. **One real discrepancy fixed — response field name.** The fork reads
   `profiles[].arn`; our fix only read `profiles[].profileArn`. If the live API
   returns `arn`, our code yielded `null`. Hardened to accept BOTH (`arn` first,
   then `profileArn`).

## Changes

- `src/lib/oauth/providers.js` — ported kiro `postExchange` (ListAvailableProfiles
  fetch) + `mapTokens(tokens, extra)`; accepts `arn` or `profileArn`; region-preferred
  selection.
- `open-sse/executors/kiro.js` — `buildHeaders` now sends `Authorization: Bearer <key>`
  + `tokentype: API_KEY` when `authMethod === "api_key"` (mirrors Kiro IDE headless
  auth); OAuth path unchanged.
- `src/lib/oauth/services/kiro.js` — added `listAvailableProfiles()` and
  `validateApiKey()` (validates a key by listing profiles, returns a credential
  shaped for persistence; API keys are long-lived, no refresh token).
- `src/app/api/oauth/kiro/api-key/route.js` — new `POST /api/oauth/kiro/api-key`
  import route; stores `authType: "api_key"`, `refreshToken: null`,
  `providerSpecificData.authMethod = "api_key"`.
- `tests/unit/kiro-profile-arn.test.js` — profileArn resolution (incl. `arn` field,
  region preference, skip-when-present, failure-is-non-fatal) + API-key validation tests.
- `tests/vitest.config.js` — exclude `.claude/**` worktrees from collection (their
  duplicate test copies lack node_modules and broke collection).

## API-key design notes

- API keys are stored as `accessToken` and sent as a bearer token plus a
  `tokentype: API_KEY` header — the single difference from OAuth at request time
  (per the fork's `applyKiroBaseHeaders`).
- No refresh: `refreshKiroToken` only handles OIDC (clientId/secret) and social;
  an api_key account has neither clientId/secret nor refreshToken, so the
  executor's `refreshCredentials` returns null early (`!credentials.refreshToken`)
  and the proactive refresh path is skipped. Keys are treated as long-lived.
- profileArn for api_key accounts is resolved at import time via the same
  ListAvailableProfiles call and persisted.

## Tests

- `tests/unit/kiro-profile-arn.test.js` — 8 pass
- `tests/translator/claude-kiro-direct.test.js` — 8 pass (no regression)
- Run: `npx vitest run --config tests/vitest.config.js tests/unit/kiro-profile-arn.test.js tests/translator/claude-kiro-direct.test.js`

Pre-existing failures in unrelated suites (rtk, db-*, oauth-cursor,
translator-request-normalization, etc.) were confirmed present on the bare branch
HEAD with all changes stashed — not introduced by this task.

## Follow-ups (not done)

- No dashboard UI for entering a Kiro API key yet (only the API route + service).
  A modal/form wired to `POST /api/oauth/kiro/api-key` would complete the UX.
- `worktree-kiro-profilearn-fix` branch is now superseded by the ported (and
  hardened) fix on this branch; consider retiring it.

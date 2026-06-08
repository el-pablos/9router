/**
 * Unit tests for the provider connection test path for Codex access_token connections.
 *
 * An imported ChatGPT access token is stored as authType "access_token". The Codex
 * provider test config points at the real backend probe, which rejects web-session
 * tokens with 401. Imported access_token connections MUST skip the backend probe and
 * be treated as token-exists (valid) — never trigger an OAuth refresh.
 *
 * Uses ONLY synthetic tokens.
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

const originalDataDir = process.env.DATA_DIR;
const originalFetch = global.fetch;

async function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-codex-probe-skip-"));
  process.env.DATA_DIR = dir;
  vi.resetModules();
  const models = await import("@/models/index.js");
  const testUtils = await import("@/app/api/providers/[id]/test/testUtils.js");
  return {
    createProviderConnection: models.createProviderConnection,
    getProviderConnectionById: models.getProviderConnectionById,
    testSingleConnection: testUtils.testSingleConnection,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

describe("Codex access_token provider test (probe-skip)", () => {
  let ctx;

  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    global.fetch = originalFetch;
    if (ctx?.cleanup) ctx.cleanup();
    if (originalDataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = originalDataDir;
    ctx = null;
  });

  it("returns valid without hitting the Codex backend for an access_token connection", async () => {
    ctx = await setup();
    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    const conn = await ctx.createProviderConnection({
      provider: "codex",
      authType: "access_token",
      accessToken: "synthetic-access-token",
      email: "probe-skip@example.com",
      providerSpecificData: { authMethod: "access_token", chatgptAccountId: "acct_probe", workspaceId: "acct_probe" },
      testStatus: "active",
    });

    const result = await ctx.testSingleConnection(conn.id);

    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    const updated = await ctx.getProviderConnectionById(conn.id);
    expect(updated.testStatus).toBe("active");
  });

  it("still probes the Codex backend for oauth connections (regression)", async () => {
    ctx = await setup();
    // 400 from the codex probe == auth succeeded (acceptStatuses includes 400)
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "bad request",
    });
    global.fetch = fetchMock;

    const future = new Date(Date.now() + 3600 * 1000).toISOString();
    const conn = await ctx.createProviderConnection({
      provider: "codex",
      authType: "oauth",
      accessToken: "synthetic-oauth-access",
      refreshToken: "synthetic-refresh",
      expiresAt: future,
      email: "oauth-probe@example.com",
      providerSpecificData: { chatgptAccountId: "acct_oauth", workspaceId: "acct_oauth" },
      testStatus: "active",
    });

    const result = await ctx.testSingleConnection(conn.id);

    expect(result.valid).toBe(true);
    expect(fetchMock).toHaveBeenCalled();
    const calledUrl = fetchMock.mock.calls[0][0];
    expect(String(calledUrl)).toContain("chatgpt.com/backend-api/codex/responses");
  });
});

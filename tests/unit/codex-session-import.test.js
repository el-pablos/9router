/**
 * Unit tests for Codex session-JSON import via /api/oauth/codex/import-token
 *
 * Verifies that a pasted `https://chatgpt.com/api/auth/session` JSON is imported
 * as a codex `access_token` connection (NO refresh token), and that the workspace
 * id is persisted so the Codex executor can send the `chatgpt-account-id` header.
 *
 * Uses ONLY synthetic JWTs — never real credentials.
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

const originalDataDir = process.env.DATA_DIR;

function makeJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

async function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-codex-session-import-"));
  process.env.DATA_DIR = dir;
  vi.resetModules();
  vi.doMock("next/server", () => ({
    NextResponse: {
      json: (body, init) => ({ status: init?.status || 200, body, json: async () => body }),
    },
  }));
  const route = await import("@/app/api/oauth/codex/import-token/route.js");
  const models = await import("@/models/index.js");
  return {
    POST: route.POST,
    getProviderConnections: models.getProviderConnections,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

function makeRequest(body) {
  return { json: async () => body };
}

describe("Codex session JSON import (access_token, no refresh)", () => {
  let ctx;

  afterEach(() => {
    vi.unmock("next/server");
    vi.resetModules();
    vi.clearAllMocks();
    if (ctx?.cleanup) ctx.cleanup();
    if (originalDataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = originalDataDir;
    ctx = null;
  });

  it("imports a pasted ChatGPT session JSON as a codex access_token connection with workspaceId", async () => {
    ctx = await setup();
    const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
    const accessToken = makeJwt({
      "https://api.openai.com/auth": {
        chatgpt_account_id: "acct_session_1",
        chatgpt_plan_type: "plus",
      },
      "https://api.openai.com/profile": { email: "session-user@example.com" },
      exp,
    });
    const sessionJson = {
      user: { id: "user-1", name: "Turis Jawa", email: "session-user@example.com" },
      expires: "2026-08-27T06:45:48.457Z",
      account: { id: "acct_session_1", planType: "plus" },
      accessToken,
      authProvider: "openai",
      sessionToken: "sess-jwe-should-not-be-stored",
    };

    const res = await ctx.POST(makeRequest(sessionJson));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const conns = await ctx.getProviderConnections({ provider: "codex" });
    const c = conns.find((x) => x.accessToken === accessToken);
    expect(c).toBeTruthy();
    expect(c.authType).toBe("access_token");
    expect(c.accessToken).toBe(accessToken);
    expect(c.refreshToken).toBeUndefined();
    expect(c.email).toBe("session-user@example.com");
    expect(c.providerSpecificData.chatgptAccountId).toBe("acct_session_1");
    expect(c.providerSpecificData.chatgptPlanType).toBe("plus");
    // The Codex executor reads providerSpecificData.workspaceId for the
    // chatgpt-account-id header. Session import MUST persist it.
    expect(c.providerSpecificData.workspaceId).toBe("acct_session_1");
  });

  it("never persists the sessionToken (JWE) anywhere on the connection", async () => {
    ctx = await setup();
    const accessToken = makeJwt({
      "https://api.openai.com/auth": { chatgpt_account_id: "acct_session_2", chatgpt_plan_type: "plus" },
      "https://api.openai.com/profile": { email: "leak-check@example.com" },
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const sessionJson = {
      account: { id: "acct_session_2", planType: "plus" },
      accessToken,
      sessionToken: "sess-secret-jwe-MUST-NOT-LEAK",
    };

    const res = await ctx.POST(makeRequest(sessionJson));
    expect(res.status).toBe(200);

    const conns = await ctx.getProviderConnections({ provider: "codex" });
    const c = conns.find((x) => x.accessToken === accessToken);
    expect(c).toBeTruthy();
    expect(JSON.stringify(c)).not.toContain("sess-secret-jwe-MUST-NOT-LEAK");
  });

  it("still supports the legacy { accessToken, name } shape", async () => {
    ctx = await setup();
    const accessToken = makeJwt({
      "https://api.openai.com/auth": { chatgpt_account_id: "acct_legacy", chatgpt_plan_type: "pro" },
      "https://api.openai.com/profile": { email: "legacy@example.com" },
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    const res = await ctx.POST(makeRequest({ accessToken, name: "My Codex" }));
    expect(res.status).toBe(200);

    const conns = await ctx.getProviderConnections({ provider: "codex" });
    const c = conns.find((x) => x.accessToken === accessToken);
    expect(c).toBeTruthy();
    expect(c.authType).toBe("access_token");
    expect(c.providerSpecificData.workspaceId).toBe("acct_legacy");
  });
});

/**
 * Unit tests for Kiro refresh-token import via /api/oauth/kiro/import
 *
 * Covers BOTH:
 *  - single-token import (backward-compatible shape: { refreshToken })
 *  - bulk import (new shape: { refreshTokens: [...] }) — fault-isolated,
 *    de-duplicated, blank-stripped, with masked tokens in the response.
 *
 * Uses ONLY synthetic tokens — never real credentials.
 */

import { describe, it, expect, afterEach, vi } from "vitest";

const VALID = "aorAAAAAGexampletoken1234567890";
const VALID2 = "aorAAAAAGexampletoken0987654321";
const BAD = "invalidtoken-no-prefix";

function makeRequest(body) {
  return { json: async () => body };
}

async function setup() {
  vi.resetModules();

  vi.doMock("next/server", () => ({
    NextResponse: {
      json: (body, init) => ({ status: init?.status || 200, body, json: async () => body }),
    },
  }));

  const createdConnections = [];
  vi.doMock("@/models", () => ({
    createProviderConnection: vi.fn(async (data) => {
      const conn = { id: `conn-${createdConnections.length + 1}`, ...data };
      createdConnections.push(conn);
      return conn;
    }),
  }));

  // Validator mirrors the real KiroService contract: reject anything that
  // does not start with the aorAAAAAG prefix; otherwise return token data.
  vi.doMock("@/lib/oauth/services/kiro", () => ({
    KiroService: class {
      async validateImportToken(token) {
        if (!token.startsWith("aorAAAAAG")) {
          throw new Error("Invalid token format. Token should start with aorAAAAAG...");
        }
        return {
          accessToken: "fake-access-" + token.slice(-4),
          refreshToken: token,
          expiresIn: 3600,
          profileArn: "arn:aws:codewhisperer:profile/EXAMPLE",
        };
      }
      extractEmailFromJWT(accessToken) {
        return `user-${accessToken.slice(-4)}@example.com`;
      }
    },
  }));

  const route = await import("@/app/api/oauth/kiro/import/route.js");
  return { POST: route.POST, createdConnections };
}

describe("Kiro token import", () => {
  afterEach(() => {
    vi.unmock("next/server");
    vi.unmock("@/models");
    vi.unmock("@/lib/oauth/services/kiro");
    vi.resetModules();
  });

  it("single token: returns backward-compatible { success, connection } shape", async () => {
    const { POST, createdConnections } = await setup();
    const res = await POST(makeRequest({ refreshToken: VALID }));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.connection).toBeDefined();
    expect(res.body.connection.id).toBeTruthy();
    expect(res.body.connection.provider).toBe("kiro");
    // single path must NOT use the bulk summary/results shape
    expect(res.body.results).toBeUndefined();
    expect(res.body.summary).toBeUndefined();
    expect(createdConnections.length).toBe(1);
  });

  it("bulk: imports every valid token and reports a summary", async () => {
    const { POST, createdConnections } = await setup();
    const res = await POST(makeRequest({ refreshTokens: [VALID, VALID2] }));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.summary).toEqual({ total: 2, succeeded: 2, failed: 0 });
    expect(res.body.results).toHaveLength(2);
    expect(res.body.results.every((r) => r.ok === true)).toBe(true);
    expect(createdConnections.length).toBe(2);
  });

  it("bulk: one bad token does NOT abort the batch (fault-isolated)", async () => {
    const { POST, createdConnections } = await setup();
    const res = await POST(makeRequest({ refreshTokens: [VALID, BAD, VALID2] }));
    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({ total: 3, succeeded: 2, failed: 1 });
    expect(res.body.success).toBe(false); // any failure => success:false
    const bad = res.body.results.find((r) => r.ok === false);
    expect(bad).toBeDefined();
    expect(bad.error).toMatch(/aorAAAAAG/);
    // the two valid tokens were still persisted
    expect(createdConnections.length).toBe(2);
  });

  it("bulk: trims blanks and de-duplicates tokens", async () => {
    const { POST, createdConnections } = await setup();
    const res = await POST(
      makeRequest({ refreshTokens: ["", "   ", VALID, VALID, `  ${VALID}  `] })
    );
    expect(res.status).toBe(200);
    // 5 raw entries collapse to 1 unique non-blank token
    expect(res.body.summary).toEqual({ total: 1, succeeded: 1, failed: 0 });
    expect(createdConnections.length).toBe(1);
  });

  it("bulk: response masks tokens (never echoes the full secret)", async () => {
    const { POST } = await setup();
    const res = await POST(makeRequest({ refreshTokens: [VALID] }));
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain(VALID); // full token must not leak
    expect(res.body.results[0].token).toBeTruthy();
    expect(res.body.results[0].token.length).toBeLessThan(VALID.length);
  });

  it("rejects empty / missing input with 400", async () => {
    const { POST } = await setup();
    const res1 = await POST(makeRequest({}));
    expect(res1.status).toBe(400);

    const res2 = await POST(makeRequest({ refreshTokens: ["", "   "] }));
    expect(res2.status).toBe(400);
  });
});

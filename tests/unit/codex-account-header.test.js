/**
 * Unit tests for Codex executor account-header resolution.
 *
 * The Codex executor sends the `chatgpt-account-id` header so the upstream scopes
 * the request to the right ChatGPT account. New imports store providerSpecificData
 * .workspaceId, but older imported rows may only carry .chatgptAccountId. The
 * executor MUST fall back to chatgptAccountId so the header still fires.
 */

import { describe, it, expect } from "vitest";
import { CodexExecutor } from "../../open-sse/executors/codex.js";

describe("CodexExecutor account-id header", () => {
  it("sends chatgpt-account-id from workspaceId when present", () => {
    const executor = new CodexExecutor();
    const headers = executor.buildHeaders({
      accessToken: "synthetic-access",
      providerSpecificData: { workspaceId: "acct_ws" },
    });
    expect(headers["chatgpt-account-id"]).toBe("acct_ws");
  });

  it("falls back to chatgptAccountId when workspaceId is absent", () => {
    const executor = new CodexExecutor();
    const headers = executor.buildHeaders({
      accessToken: "synthetic-access",
      providerSpecificData: { chatgptAccountId: "acct_fallback" },
    });
    expect(headers["chatgpt-account-id"]).toBe("acct_fallback");
  });

  it("prefers workspaceId over chatgptAccountId when both present", () => {
    const executor = new CodexExecutor();
    const headers = executor.buildHeaders({
      accessToken: "synthetic-access",
      providerSpecificData: { workspaceId: "acct_ws", chatgptAccountId: "acct_fallback" },
    });
    expect(headers["chatgpt-account-id"]).toBe("acct_ws");
  });
});

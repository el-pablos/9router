import { NextResponse } from "next/server";
import { KiroService } from "@/lib/oauth/services/kiro";
import { createProviderConnection } from "@/models";

/**
 * POST /api/oauth/kiro/import
 * Import and validate refresh token(s) from Kiro IDE.
 *
 * Accepts EITHER:
 *   - { refreshToken: "<token>" }              single import (backward-compatible)
 *   - { refreshTokens: ["<t1>", "<t2>", ...] } bulk import (one token per entry)
 *
 * Bulk import is fault-isolated: a single invalid token does NOT abort the
 * batch; each token's outcome is reported individually. Tokens are de-duplicated
 * and blank entries are dropped. The response masks every token (never echoes
 * the full secret).
 */

function maskToken(token) {
  if (typeof token !== "string" || token.length <= 12) return "****";
  return `${token.slice(0, 8)}...${token.slice(-4)}`;
}

async function importOne(kiroService, refreshToken) {
  // Validate and refresh token
  const tokenData = await kiroService.validateImportToken(refreshToken);

  // Extract email from JWT if available
  const email = kiroService.extractEmailFromJWT(tokenData.accessToken);

  // Save to database
  const connection = await createProviderConnection({
    provider: "kiro",
    authType: "oauth",
    accessToken: tokenData.accessToken,
    refreshToken: tokenData.refreshToken,
    expiresAt: new Date(Date.now() + tokenData.expiresIn * 1000).toISOString(),
    email: email || null,
    providerSpecificData: {
      profileArn: tokenData.profileArn,
      authMethod: "imported",
      provider: "Imported",
    },
    testStatus: "active",
  });

  return { id: connection.id, provider: connection.provider, email: connection.email };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const isBulk = Array.isArray(body.refreshTokens);

    // Normalize to a clean token list: trim, drop blanks, de-duplicate.
    const rawTokens = isBulk
      ? body.refreshTokens
      : typeof body.refreshToken === "string"
        ? [body.refreshToken]
        : [];
    const tokens = [
      ...new Set(
        rawTokens
          .filter((t) => typeof t === "string")
          .map((t) => t.trim())
          .filter(Boolean)
      ),
    ];

    if (tokens.length === 0) {
      return NextResponse.json(
        { error: isBulk ? "At least one refresh token is required" : "Refresh token is required" },
        { status: 400 }
      );
    }

    const kiroService = new KiroService();

    // Single-token path: preserve the original response shape exactly.
    if (!isBulk) {
      const connection = await importOne(kiroService, tokens[0]);
      return NextResponse.json({ success: true, connection });
    }

    // Bulk path: import each token independently, never aborting the batch.
    const results = [];
    for (const token of tokens) {
      try {
        const connection = await importOne(kiroService, token);
        results.push({ token: maskToken(token), ok: true, connection });
      } catch (err) {
        results.push({ token: maskToken(token), ok: false, error: err.message });
      }
    }

    const succeeded = results.filter((r) => r.ok).length;
    const failed = results.length - succeeded;

    return NextResponse.json({
      success: failed === 0,
      summary: { total: results.length, succeeded, failed },
      results,
    });
  } catch (error) {
    console.log("Kiro import token error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

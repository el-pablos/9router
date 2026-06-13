import { describe, it, expect, beforeEach } from "vitest";

// Setiap test pakai cache-buster query agar modul re-evaluasi dengan env yang sudah dibersihkan.
describe("runtimeConfig defaults", () => {
  beforeEach(() => {
    delete process.env.STREAM_STALL_TIMEOUT_MS;
    delete process.env.FETCH_CONNECT_TIMEOUT_MS;
    delete process.env.STREAM_FIRST_CHUNK_TIMEOUT_MS;
    delete process.env.REASONING_CONNECT_TIMEOUT_MS;
  });

  it("STREAM_STALL_TIMEOUT_MS default is 600s", async () => {
    const { STREAM_STALL_TIMEOUT_MS } = await import("../../open-sse/config/runtimeConfig.js?t=" + Date.now() + "_a");
    expect(STREAM_STALL_TIMEOUT_MS).toBe(600_000);
  });

  it("FETCH_CONNECT_TIMEOUT_MS default is 120s", async () => {
    const { FETCH_CONNECT_TIMEOUT_MS } = await import("../../open-sse/config/runtimeConfig.js?t=" + Date.now() + "_b");
    expect(FETCH_CONNECT_TIMEOUT_MS).toBe(120_000);
  });

  it("STREAM_FIRST_CHUNK_TIMEOUT_MS default is 600s", async () => {
    const { STREAM_FIRST_CHUNK_TIMEOUT_MS } = await import("../../open-sse/config/runtimeConfig.js?t=" + Date.now() + "_c");
    expect(STREAM_FIRST_CHUNK_TIMEOUT_MS).toBe(600_000);
  });

  it("REASONING_CONNECT_TIMEOUT_MS default is 600s", async () => {
    const { REASONING_CONNECT_TIMEOUT_MS } = await import("../../open-sse/config/runtimeConfig.js?t=" + Date.now() + "_d");
    expect(REASONING_CONNECT_TIMEOUT_MS).toBe(600_000);
  });

  it("STREAM_FIRST_CHUNK_TIMEOUT_MS env override still works", async () => {
    process.env.STREAM_FIRST_CHUNK_TIMEOUT_MS = "999999";
    const { STREAM_FIRST_CHUNK_TIMEOUT_MS } = await import("../../open-sse/config/runtimeConfig.js?t=" + Date.now() + "_e");
    expect(STREAM_FIRST_CHUNK_TIMEOUT_MS).toBe(999999);
  });
});

import { describe, it, expect } from "vitest";
import {
  isSocksProxyUrl,
  parseSocksProxyUrl,
  createSocksDispatcher,
} from "../../open-sse/utils/socksDispatcher.js";

describe("socksDispatcher — isSocksProxyUrl", () => {
  it("detects socks schemes", () => {
    expect(isSocksProxyUrl("socks://h:1")).toBe(true);
    expect(isSocksProxyUrl("socks4://h:1")).toBe(true);
    expect(isSocksProxyUrl("socks4a://h:1")).toBe(true);
    expect(isSocksProxyUrl("socks5://h:1")).toBe(true);
    expect(isSocksProxyUrl("socks5h://h:1")).toBe(true);
  });

  it("rejects http(s) and garbage", () => {
    expect(isSocksProxyUrl("http://127.0.0.1:7897")).toBe(false);
    expect(isSocksProxyUrl("https://127.0.0.1:7897")).toBe(false);
    expect(isSocksProxyUrl("127.0.0.1:1080")).toBe(false);
    expect(isSocksProxyUrl("")).toBe(false);
    expect(isSocksProxyUrl(null)).toBe(false);
    expect(isSocksProxyUrl(undefined)).toBe(false);
  });
});

describe("socksDispatcher — parseSocksProxyUrl", () => {
  it("maps socks5 to type 5 with default port", () => {
    expect(parseSocksProxyUrl("socks5://example.com")).toEqual({
      host: "example.com",
      port: 1080,
      type: 5,
    });
  });

  it("maps socks4/socks4a to type 4", () => {
    expect(parseSocksProxyUrl("socks4://h:9050").type).toBe(4);
    expect(parseSocksProxyUrl("socks4a://h:9050").type).toBe(4);
  });

  it("maps socks/socks5h to type 5", () => {
    expect(parseSocksProxyUrl("socks://h:9050").type).toBe(5);
    expect(parseSocksProxyUrl("socks5h://h:9050").type).toBe(5);
  });

  it("parses host, port and url-decoded credentials", () => {
    const p = parseSocksProxyUrl("socks5://us%40er:p%3Ass@10.0.0.1:1081");
    expect(p).toEqual({
      host: "10.0.0.1",
      port: 1081,
      type: 5,
      userId: "us@er",
      password: "p:ss",
    });
  });

  it("omits credentials when absent (no-auth proxy)", () => {
    const p = parseSocksProxyUrl("socks5://10.0.0.1:1081");
    expect(p.userId).toBeUndefined();
    expect(p.password).toBeUndefined();
  });
});

describe("socksDispatcher — createSocksDispatcher", () => {
  it("returns an undici Agent with a dispatch method", () => {
    const dispatcher = createSocksDispatcher("socks5://127.0.0.1:1080");
    expect(typeof dispatcher.dispatch).toBe("function");
    expect(typeof dispatcher.close).toBe("function");
  });

  it("surfaces a connection error when the SOCKS proxy is unreachable", async () => {
    const { fetch: undiciFetch } = await import("undici");
    // Port 1 is reserved and refuses — exercises the .catch(callback) path.
    const dispatcher = createSocksDispatcher("socks5://127.0.0.1:1");
    await expect(
      undiciFetch("https://example.com/", { dispatcher })
    ).rejects.toThrow();
    await dispatcher.close();
  });
});

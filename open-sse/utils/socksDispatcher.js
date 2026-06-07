import { Agent, buildConnector } from "undici";

// SOCKS proxy support for the undici-based outbound proxy mechanism.
//
// undici's built-in ProxyAgent only speaks HTTP CONNECT tunnelling, so SOCKS
// proxies (socks5://, socks4://, …) need a custom dispatcher: we open the
// tunnel with the `socks` client, then hand the raw socket to undici. For
// https targets the socket is passed as `httpSocket` so undici performs the
// TLS upgrade over it; for plaintext http the socket is returned directly.

const SOCKS_SCHEMES = new Set([
  "socks:",
  "socks4:",
  "socks4a:",
  "socks5:",
  "socks5h:",
]);

/**
 * True when proxyUrl uses a SOCKS scheme (socks/socks4/socks4a/socks5/socks5h).
 */
export function isSocksProxyUrl(proxyUrl) {
  if (!proxyUrl) return false;
  try {
    return SOCKS_SCHEMES.has(new URL(String(proxyUrl)).protocol.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Parse a SOCKS proxy URL into the shape expected by `socks`.
 * socks4/socks4a → type 4, socks/socks5/socks5h → type 5 (default).
 */
export function parseSocksProxyUrl(proxyUrl) {
  const url = new URL(String(proxyUrl));
  const protocol = url.protocol.toLowerCase();
  const type = protocol === "socks4:" || protocol === "socks4a:" ? 4 : 5;

  const proxy = {
    host: url.hostname,
    port: Number(url.port) || 1080,
    type,
  };

  // socks treats userId/password as optional; only set when present so
  // no-auth proxies are not forced into username/password negotiation.
  if (url.username) proxy.userId = decodeURIComponent(url.username);
  if (url.password) proxy.password = decodeURIComponent(url.password);

  return proxy;
}

/**
 * Build an undici Agent that tunnels every connection through a SOCKS proxy.
 *
 * @param {string} proxyUrl  socks5://[user:pass@]host:port (or socks4://…)
 * @param {object} agentOptions  passed through to the undici Agent constructor
 * @returns {import("undici").Agent}
 */
export function createSocksDispatcher(proxyUrl, agentOptions = {}) {
  const proxy = parseSocksProxyUrl(proxyUrl);
  const tlsConnector = buildConnector(agentOptions.connect || {});

  const connect = (options, callback) => {
    const { hostname, protocol } = options;
    const destPort = Number(options.port) || (protocol === "https:" ? 443 : 80);

    // SocksClient is loaded lazily so importing this module stays cheap and the
    // `socks` dependency is only pulled when a SOCKS proxy is actually used.
    import("socks")
      .then(({ SocksClient }) =>
        SocksClient.createConnection({
          proxy,
          command: "connect",
          destination: { host: hostname, port: destPort },
        })
      )
      .then(({ socket }) => {
        if (protocol === "https:") {
          // Let undici perform the TLS handshake over the SOCKS socket.
          tlsConnector({ ...options, httpSocket: socket }, callback);
          return;
        }
        socket.setNoDelay(true);
        callback(null, socket);
      })
      .catch((err) => callback(err, null));
  };

  return new Agent({ ...agentOptions, connect });
}

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/65.0.3325.162 Safari/537.36",
  "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/45.0.2454.85 Safari/537.36",
  "Mozilla/5.0 (Linux; Android 7.0; Moto C Build/NRD90M.059) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Mobile Safari/537.36",
  "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36",
  "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.102 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.75 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36",
  "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.87 Safari/537.36",
  "Mozilla/5.0 (X11; Linux i686) AppleWebKit/534.30 (KHTML, like Gecko) Chrome/12.0.742.100 Safari/534.30",
] as const;

type ProxyRecord = Record<string, unknown>;
type NameCounter = Record<string, number>;
type SchemeParser = (line: string, body: string, scheme: string, names: NameCounter) => ProxyRecord | null;

function pickUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function getString(value: string | null | undefined): string {
  return value == null ? "" : String(value);
}

function uniqueName(names: NameCounter, name: string): string {
  const trimmed = name.trim();
  if (!(trimmed in names)) {
    names[trimmed] = 0;
    return trimmed;
  }
  names[trimmed]++;
  return `${trimmed} ${names[trimmed]}`;
}

function decodeBase64(input: string): string {
  const padded = input + "=".repeat((4 - (input.length % 4)) % 4);
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

function toStandardBase64(input: string): string {
  return input.replace(/-/g, "+").replace(/_/g, "/");
}

function decodeUrlSafeBase64(input: string): string {
  return decodeBase64(toStandardBase64(input));
}

function toBoolean(input: string | null | undefined): boolean {
  if (!input) return false;
  return ["1", "true", "yes", "on"].includes(input.toLowerCase());
}

function parseUrlOrNull(input: string): URL | null {
  try {
    return new URL(input);
  } catch {
    return null;
  }
}

function decodeOrNull(input: string, decoder: (value: string) => string): string | null {
  try {
    return decoder(input);
  } catch {
    return null;
  }
}

function getRemark(query: URLSearchParams, fallback: string): string {
  const remark = getString(query.get("remark"));
  if (remark !== "") return remark;
  const remarks = getString(query.get("remarks"));
  return remarks !== "" ? remarks : fallback;
}

function setVShareCoreFields(
  names: NameCounter,
  url: URL,
  scheme: string,
  proxy: ProxyRecord
): void {
  const query = new URLSearchParams(url.search);
  proxy["name"] = uniqueName(names, decodeURIComponent(url.hash.slice(1)));
  if (!url.hostname) throw new Error("missing hostname");
  if (!url.port) throw new Error("missing port");
  proxy["type"] = scheme;
  proxy["server"] = url.hostname;
  proxy["port"] = Number(url.port);
  proxy["uuid"] = url.username;
  proxy["udp"] = true;

  const security = getString(query.get("security")).toLowerCase();
  if (security.endsWith("tls") || security === "reality") {
    proxy["tls"] = true;
    const fingerprint = getString(query.get("fp"));
    proxy["client-fingerprint"] = fingerprint !== "" ? fingerprint : "chrome";
    const alpn = getString(query.get("alpn"));
    if (alpn !== "") proxy["alpn"] = alpn.split(",");
  }

  const sni = getString(query.get("sni"));
  if (sni !== "") proxy["servername"] = sni;

  const realityPublicKey = getString(query.get("pbk"));
  if (realityPublicKey !== "") {
    proxy["reality-opts"] = {
      "public-key": realityPublicKey,
      "short-id": getString(query.get("sid")),
    };
  }

  const packetEncoding = getString(query.get("packetEncoding"));
  if (packetEncoding === "packet") {
    proxy["packet-addr"] = true;
  } else if (packetEncoding !== "none" && packetEncoding !== "") {
    proxy["xudp"] = true;
  }

  let network = getString(query.get("type")).toLowerCase();
  if (network === "") network = "tcp";
  const headerType = getString(query.get("headerType")).toLowerCase();
  if (headerType === "http") {
    network = "http";
  } else if (network === "http") {
    network = "h2";
  }
  proxy["network"] = network;

  if (network === "tcp") {
    if (headerType !== "none" && headerType !== "") {
      const httpOpts: Record<string, unknown> = { path: "/" };
      const headers: Record<string, unknown> = {};
      const host = getString(query.get("host"));
      if (host !== "") headers["Host"] = host;
      const method = getString(query.get("method"));
      if (method !== "") httpOpts["method"] = method;
      const path = getString(query.get("path"));
      if (path !== "") httpOpts["path"] = path;
      httpOpts["headers"] = headers;
      proxy["http-opts"] = httpOpts;
    }
  } else if (network === "http") {
    const h2Opts: Record<string, unknown> = { path: "/" };
    const path = getString(query.get("path"));
    if (path !== "") h2Opts["path"] = path;
    const host = getString(query.get("host"));
    if (host !== "") h2Opts["host"] = [host];
    proxy["h2-opts"] = h2Opts;
  } else if (network === "ws") {
    const wsOpts: Record<string, unknown> = {};
    const headers: Record<string, unknown> = {
      "User-Agent": pickUserAgent(),
      Host: getString(query.get("host")),
    };
    wsOpts["path"] = getString(query.get("path"));
    wsOpts["headers"] = headers;
    const earlyData = getString(query.get("ed"));
    if (earlyData !== "") {
      const value = parseInt(earlyData, 10);
      if (isNaN(value)) throw new Error("invalid early-data");
      wsOpts["max-early-data"] = value;
    }
    const earlyDataHeader = getString(query.get("edh"));
    if (earlyDataHeader !== "") wsOpts["early-data-header-name"] = earlyDataHeader;
    proxy["ws-opts"] = wsOpts;
  } else if (network === "grpc") {
    proxy["grpc-opts"] = {
      "grpc-service-name": getString(query.get("serviceName")),
    };
  }
}

function parseHysteria(line: string, _body: string, scheme: string, names: NameCounter): ProxyRecord | null {
  const parsedUrl = parseUrlOrNull(line);
  if (!parsedUrl) return null;

  const query = new URLSearchParams(parsedUrl.search);
  const name = uniqueName(names, decodeURIComponent(parsedUrl.hash.slice(1)));
  const proxy: ProxyRecord = {
    name,
    type: scheme,
    server: parsedUrl.hostname,
    port: Number(parsedUrl.port),
    sni: getString(query.get("peer")) || undefined,
    obfs: getString(query.get("obfs")) || undefined,
    auth_str: getString(query.get("auth")) || undefined,
    protocol: getString(query.get("protocol")) || undefined,
    "skip-cert-verify": toBoolean(query.get("insecure")),
  };
  const alpn = getString(query.get("alpn"));
  if (alpn !== "") proxy["alpn"] = alpn.split(",");
  let up = getString(query.get("up"));
  let down = getString(query.get("down"));
  if (up === "") up = getString(query.get("upmbps"));
  if (down === "") down = getString(query.get("downmbps"));
  proxy["up"] = up;
  proxy["down"] = down;
  return proxy;
}

function parseHysteria2(line: string, _body: string, scheme: string, names: NameCounter): ProxyRecord | null {
  const parsedUrl = parseUrlOrNull(line);
  if (!parsedUrl) return null;

  const query = new URLSearchParams(parsedUrl.search);
  const name = uniqueName(names, decodeURIComponent(parsedUrl.hash.slice(1)));
  const proxy: ProxyRecord = {
    name,
    type: scheme,
    server: parsedUrl.hostname,
    port: parsedUrl.port !== "" ? Number(parsedUrl.port) : 443,
    "skip-cert-verify": toBoolean(query.get("insecure")),
  };
  const obfs = getString(query.get("obfs"));
  if (obfs !== "" && obfs !== "none" && obfs !== "None") {
    proxy["obfs"] = obfs;
    proxy["obfs-password"] = getString(query.get("obfs-password"));
  }
  let sni = getString(query.get("sni"));
  if (sni === "") sni = getString(query.get("peer"));
  if (sni !== "") proxy["sni"] = sni;
  const alpn = getString(query.get("alpn"));
  if (alpn !== "") proxy["alpn"] = alpn.split(",");
  const auth = getString(parsedUrl.username);
  if (auth !== "") proxy["password"] = auth;
  proxy["fingerprint"] = getString(query.get("pinSHA256"));
  proxy["down"] = getString(query.get("down"));
  proxy["up"] = getString(query.get("up"));
  return proxy;
}

function parseTuic(line: string, _body: string, scheme: string, names: NameCounter): ProxyRecord | null {
  const parsedUrl = parseUrlOrNull(line);
  if (!parsedUrl) return null;

  const query = new URLSearchParams(parsedUrl.search);
  const proxy: ProxyRecord = {
    name: uniqueName(names, decodeURIComponent(parsedUrl.hash.slice(1))),
    type: scheme,
    server: parsedUrl.hostname,
    port: Number(parsedUrl.port),
    udp: true,
  };
  if (parsedUrl.password) {
    proxy["uuid"] = parsedUrl.username;
    proxy["password"] = parsedUrl.password;
  } else {
    proxy["token"] = parsedUrl.username;
  }
  const congestionControl = getString(query.get("congestion_control"));
  if (congestionControl !== "") proxy["congestion-control"] = congestionControl;
  const alpn = getString(query.get("alpn"));
  if (alpn !== "") proxy["alpn"] = alpn.split(",");
  const sni = getString(query.get("sni"));
  if (sni !== "") proxy["sni"] = sni;
  if (query.get("disable_sni") === "1") proxy["disable-sni"] = true;
  const udpRelayMode = getString(query.get("udp_relay_mode"));
  if (udpRelayMode !== "") proxy["udp-relay-mode"] = udpRelayMode;
  return proxy;
}

function parseTrojan(line: string, _body: string, scheme: string, names: NameCounter): ProxyRecord | null {
  const parsedUrl = parseUrlOrNull(line);
  if (!parsedUrl) return null;

  const query = new URLSearchParams(parsedUrl.search);
  const proxy: ProxyRecord = {
    name: uniqueName(names, decodeURIComponent(parsedUrl.hash.slice(1))),
    type: scheme,
    server: parsedUrl.hostname,
    port: Number(parsedUrl.port),
    password: parsedUrl.username,
    udp: true,
    "skip-cert-verify": toBoolean(query.get("allowInsecure")),
  };
  const sni = getString(query.get("sni"));
  if (sni !== "") proxy["sni"] = sni;
  const alpn = getString(query.get("alpn"));
  if (alpn !== "") proxy["alpn"] = alpn.split(",");
  const network = getString(query.get("type")).toLowerCase();
  if (network !== "") {
    proxy["network"] = network;
    if (network === "ws") {
      proxy["ws-opts"] = {
        path: query.get("path"),
        headers: { "User-Agent": pickUserAgent() },
      };
    } else if (network === "grpc") {
      proxy["grpc-opts"] = { serviceName: query.get("serviceName") };
    }
  }
  const fingerprint = getString(query.get("fp"));
  proxy["client-fingerprint"] = fingerprint !== "" ? fingerprint : "chrome";
  return proxy;
}

function parseVless(line: string, _body: string, scheme: string, names: NameCounter): ProxyRecord | null {
  const parsedUrl = parseUrlOrNull(line);
  if (!parsedUrl) return null;

  const query = new URLSearchParams(parsedUrl.search);
  const proxy: ProxyRecord = {};
  try {
    setVShareCoreFields(names, parsedUrl, scheme, proxy);
  } catch {
    return null;
  }
  const flow = getString(query.get("flow")).toLowerCase();
  if (flow !== "") proxy["flow"] = flow;
  return proxy;
}

function parseVmessShareLink(line: string, scheme: string, names: NameCounter): ProxyRecord | null {
  const parsedUrl = parseUrlOrNull(line);
  if (!parsedUrl) return null;

  const query = new URLSearchParams(parsedUrl.search);
  const proxy: ProxyRecord = {};
  try {
    setVShareCoreFields(names, parsedUrl, scheme, proxy);
  } catch {
    return null;
  }
  proxy["alterId"] = 0;
  proxy["cipher"] = "auto";
  const encryption = getString(query.get("encryption"));
  if (encryption !== "") proxy["cipher"] = encryption;
  return proxy;
}

function parseLegacyVmess(body: string, scheme: string, names: NameCounter): ProxyRecord | null {
  const decodedVmess = decodeOrNull(body, decodeBase64);
  if (decodedVmess === null) return null;

  let values: Record<string, unknown>;
  try {
    values = JSON.parse(decodedVmess) as Record<string, unknown>;
  } catch {
    return null;
  }

  const tempName = values["ps"] as string | undefined;
  if (!tempName) return null;

  const proxy: ProxyRecord = {
    name: uniqueName(names, tempName),
    type: scheme,
    server: values["add"],
    port: values["port"],
    uuid: values["id"],
    alterId: values["aid"] != null ? values["aid"] : 0,
    udp: true,
    xudp: true,
    tls: false,
    "skip-cert-verify": false,
    cipher: "auto",
  };
  const cipher = getString(values["scy"] as string | undefined);
  if (cipher !== "") proxy["cipher"] = cipher;
  const sni = getString(values["sni"] as string | undefined);
  if (sni !== "") proxy["servername"] = sni;

  let network = getString(values["net"] as string | undefined).toLowerCase();
  if (values["type"] === "http") {
    network = "http";
  } else if (network === "http") {
    network = "h2";
  }
  proxy["network"] = network;

  const tlsValue = values["tls"];
  if (tlsValue != null) {
    const tlsString = String(tlsValue).toLowerCase();
    if (tlsString.endsWith("tls")) proxy["tls"] = true;
    const alpn = values["alpn"] as string | undefined;
    if (alpn != null && alpn !== "") proxy["alpn"] = alpn.split(",");
  }

  if (network === "http") {
    const httpOpts: Record<string, unknown> = { path: "/" };
    const headers: Record<string, unknown> = {};
    const host = getString(values["host"] as string | undefined);
    if (host !== "") headers["Host"] = host;
    const path = getString(values["path"] as string | undefined);
    if (path !== "") httpOpts["path"] = path;
    httpOpts["headers"] = headers;
    proxy["http-opts"] = httpOpts;
  } else if (network === "h2") {
    const h2Opts: Record<string, unknown> = {};
    const host = getString(values["host"] as string | undefined);
    if (host !== "") h2Opts["host"] = [host];
    h2Opts["path"] = getString(values["path"] as string | undefined);
    proxy["h2-opts"] = h2Opts;
  } else if (network === "ws") {
    const wsOpts: Record<string, unknown> = { path: "/" };
    const headers: Record<string, unknown> = {};
    const host = getString(values["host"] as string | undefined);
    if (host !== "") headers["Host"] = host;
    const path = getString(values["path"] as string | undefined);
    if (path !== "") wsOpts["path"] = path;
    wsOpts["headers"] = headers;
    proxy["ws-opts"] = wsOpts;
  } else if (network === "grpc") {
    proxy["grpc-opts"] = {
      "grpc-service-name": getString(values["path"] as string | undefined),
    };
  }

  return proxy;
}

function parseVmess(line: string, body: string, scheme: string, names: NameCounter): ProxyRecord | null {
  return parseLegacyVmess(body, scheme, names) ?? parseVmessShareLink(line, scheme, names);
}

function parseShadowsocks(line: string, _body: string, scheme: string, names: NameCounter): ProxyRecord | null {
  let parsedUrl = parseUrlOrNull(line);
  if (!parsedUrl) return null;

  const name = uniqueName(names, decodeURIComponent(parsedUrl.hash.slice(1)));
  let port: number | string = parsedUrl.port;
  if (port === "") {
    const decoded = decodeOrNull(parsedUrl.hostname, decodeBase64);
    if (decoded === null) return null;
    parsedUrl = parseUrlOrNull(`ss://${decoded}`);
    if (!parsedUrl) return null;
    port = parsedUrl.port;
  }

  let cipher = parsedUrl.username;
  let password = parsedUrl.password;
  if (!password) {
    const decoded = decodeOrNull(cipher, decodeBase64) ?? decodeOrNull(cipher, decodeUrlSafeBase64);
    if (decoded === null) return null;
    const colonIndex = decoded.indexOf(":");
    if (colonIndex === -1) return null;
    cipher = decoded.slice(0, colonIndex);
    password = decoded.slice(colonIndex + 1);
  }

  const query = new URLSearchParams(parsedUrl.search);
  const proxy: ProxyRecord = {
    name,
    type: scheme,
    server: parsedUrl.hostname,
    port: Number(port),
    cipher,
    password,
    udp: true,
  };
  const plugin = getString(query.get("plugin"));
  if (plugin.includes("obfs")) {
    const pluginOpts = getString(query.get("plugin-opts")).split(";");
    proxy["plugin"] = "obfs";
    proxy["plugin-opts"] = {
      host: pluginOpts[2]?.slice(10) ?? "",
      mode: pluginOpts[1]?.slice(5) ?? "",
    };
  }
  return proxy;
}

function parseShadowsocksr(_line: string, body: string, scheme: string, names: NameCounter): ProxyRecord | null {
  const decoded = decodeOrNull(body, decodeBase64);
  if (decoded === null) return null;

  const queryIndex = decoded.indexOf("/?");
  if (queryIndex === -1) return null;
  const before = decoded.slice(0, queryIndex);
  const after = decoded.slice(queryIndex + 2);
  const parts = before.split(":");
  if (parts.length < 6) return null;

  const [host, port, protocol, method] = parts;
  const password = decodeOrNull(parts[5], decodeUrlSafeBase64);
  if (password === null) return null;

  let query: URLSearchParams;
  try {
    query = new URLSearchParams(toStandardBase64(after));
  } catch {
    return null;
  }

  const remarksRaw = getString(query.get("remarks"));
  const remarks = decodeOrNull(remarksRaw, decodeUrlSafeBase64);
  if (remarks === null) return null;

  const proxy: ProxyRecord = {
    name: uniqueName(names, remarks),
    type: scheme,
    server: host,
    port,
    cipher: method,
    password,
    protocol,
    udp: true,
  };
  const obfsParam = getString(query.get("obfsparam"));
  if (obfsParam !== "") proxy["obfs-param"] = obfsParam;
  const protocolParam = getString(query.get("protoparam"));
  if (protocolParam !== "") proxy["protocol-param"] = protocolParam;
  return proxy;
}

function parseTelegram(line: string, _body: string, _scheme: string, names: NameCounter): ProxyRecord | null {
  const parsedUrl = parseUrlOrNull(line);
  if (!parsedUrl) return null;

  const query = new URLSearchParams(parsedUrl.search);
  const proxy: ProxyRecord = {
    name: uniqueName(names, getRemark(query, parsedUrl.hostname)),
    type: parsedUrl.hostname,
    server: getString(query.get("server")),
    port: String(getString(query.get("port"))),
  };
  const user = getString(query.get("user"));
  if (user !== "") proxy["username"] = user;
  const password = getString(query.get("pass"));
  if (password !== "") proxy["password"] = password;
  return proxy;
}

function parseTelegramHttps(line: string, _body: string, _scheme: string, names: NameCounter): ProxyRecord | null {
  const parsedUrl = parseUrlOrNull(line);
  if (!parsedUrl || !parsedUrl.hostname.startsWith("t.me")) return null;

  const query = new URLSearchParams(parsedUrl.search);
  const proxyType = parsedUrl.pathname.replace(/^\//, "");
  const proxy: ProxyRecord = {
    name: uniqueName(names, getRemark(query, proxyType)),
    type: proxyType,
    server: getString(query.get("server")),
    port: String(getString(query.get("port"))),
  };
  const user = getString(query.get("user"));
  if (user !== "") proxy["username"] = user;
  const password = getString(query.get("pass"));
  if (password !== "") proxy["password"] = password;
  return proxy;
}

const SCHEME_PARSERS: Partial<Record<string, SchemeParser>> = {
  hysteria: parseHysteria,
  hysteria2: parseHysteria2,
  hy2: parseHysteria2,
  tuic: parseTuic,
  trojan: parseTrojan,
  vless: parseVless,
  vmess: parseVmess,
  ss: parseShadowsocks,
  ssr: parseShadowsocksr,
  tg: parseTelegram,
  https: parseTelegramHttps,
};

export function parseProxyLinks(input: string): ProxyRecord[] {
  let data: string;
  try {
    data = decodeBase64(input);
  } catch {
    data = input;
  }

  const lines = data.split(/\r?\n/);
  const proxies: ProxyRecord[] = [];
  const names: NameCounter = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === "" || !line.includes("://")) continue;

    const separatorIndex = line.indexOf("://");
    const scheme = line.slice(0, separatorIndex).toLowerCase();
    const body = line.slice(separatorIndex + 3);

    const parser = SCHEME_PARSERS[scheme];
    if (!parser) continue;

    const proxy = parser(line, body, scheme, names);
    if (proxy) proxies.push(proxy);
  }

  if (proxies.length === 0) {
    throw new Error("No valid proxies found");
  }
  return proxies;
}

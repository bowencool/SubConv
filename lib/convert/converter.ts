import {
  base64RawStdDecode,
  base64RawURLDecode,
  get,
  randUserAgent,
  uniqueName,
  urlSafe,
} from "./util";
import { handleVShareLink } from "./v";

type ProxyRecord = Record<string, unknown>;

function strtobool(s: string | null | undefined): boolean {
  if (!s) return false;
  return ["1", "true", "yes", "on"].includes(s.toLowerCase());
}

export async function convertsV2Ray(buf: string): Promise<ProxyRecord[]> {
  let data: string;
  try {
    data = base64RawStdDecode(buf);
  } catch {
    data = buf;
  }

  const arr = data.split(/\r?\n/);
  const proxies: ProxyRecord[] = [];
  const names: Record<string, number> = {};

  for (const rawLine of arr) {
    const line = rawLine.trim();
    if (line === "") continue;
    if (!line.includes("://")) continue;

    const sepIdx = line.indexOf("://");
    const scheme = line.slice(0, sepIdx).toLowerCase();
    const body = line.slice(sepIdx + 3);

    if (scheme === "hysteria") {
      let urlHysteria: URL;
      try {
        urlHysteria = new URL(line);
      } catch {
        continue;
      }
      const query = new URLSearchParams(urlHysteria.search);
      const name = uniqueName(names, decodeURIComponent(urlHysteria.hash.slice(1)));
      const hysteria: ProxyRecord = {
        name,
        type: scheme,
        server: urlHysteria.hostname,
        port: Number(urlHysteria.port),
        sni: get(query.get("peer")) || undefined,
        obfs: get(query.get("obfs")) || undefined,
        auth_str: get(query.get("auth")) || undefined,
        protocol: get(query.get("protocol")) || undefined,
        "skip-cert-verify": strtobool(query.get("insecure")),
      };
      const alpn = get(query.get("alpn"));
      if (alpn !== "") hysteria["alpn"] = alpn.split(",");
      let up = get(query.get("up"));
      let down = get(query.get("down"));
      if (up === "") up = get(query.get("upmbps"));
      if (down === "") down = get(query.get("downmbps"));
      hysteria["up"] = up;
      hysteria["down"] = down;
      proxies.push(hysteria);

    } else if (scheme === "hysteria2" || scheme === "hy2") {
      let urlHy2: URL;
      try {
        urlHy2 = new URL(line);
      } catch {
        continue;
      }
      const query = new URLSearchParams(urlHy2.search);
      const name = uniqueName(names, decodeURIComponent(urlHy2.hash.slice(1)));
      const hysteria2: ProxyRecord = {
        name,
        type: scheme,
        server: urlHy2.hostname,
        port: urlHy2.port !== "" ? Number(urlHy2.port) : 443,
        "skip-cert-verify": strtobool(query.get("insecure")),
      };
      const obfs = get(query.get("obfs"));
      if (obfs !== "" && obfs !== "none" && obfs !== "None") {
        hysteria2["obfs"] = obfs;
        hysteria2["obfs-password"] = get(query.get("obfs-password"));
      }
      let sni = get(query.get("sni"));
      if (sni === "") sni = get(query.get("peer"));
      if (sni !== "") hysteria2["sni"] = sni;
      const alpn = get(query.get("alpn"));
      if (alpn !== "") hysteria2["alpn"] = alpn.split(",");
      const auth = get(urlHy2.username);
      if (auth !== "") hysteria2["password"] = auth;
      hysteria2["fingerprint"] = get(query.get("pinSHA256"));
      hysteria2["down"] = get(query.get("down"));
      hysteria2["up"] = get(query.get("up"));
      proxies.push(hysteria2);

    } else if (scheme === "tuic") {
      let urlTUIC: URL;
      try {
        urlTUIC = new URL(line);
      } catch {
        continue;
      }
      const query = new URLSearchParams(urlTUIC.search);
      const tuic: ProxyRecord = {
        name: uniqueName(names, decodeURIComponent(urlTUIC.hash.slice(1))),
        type: scheme,
        server: urlTUIC.hostname,
        port: Number(urlTUIC.port),
        udp: true,
      };
      if (urlTUIC.password) {
        tuic["uuid"] = urlTUIC.username;
        tuic["password"] = urlTUIC.password;
      } else {
        tuic["token"] = urlTUIC.username;
      }
      const cc = get(query.get("congestion_control"));
      if (cc !== "") tuic["congestion-control"] = cc;
      const alpn = get(query.get("alpn"));
      if (alpn !== "") tuic["alpn"] = alpn.split(",");
      const sni = get(query.get("sni"));
      if (sni !== "") tuic["sni"] = sni;
      if (query.get("disable_sni") === "1") tuic["disable-sni"] = true;
      const udpRelayMode = get(query.get("udp_relay_mode"));
      if (udpRelayMode !== "") tuic["udp-relay-mode"] = udpRelayMode;
      proxies.push(tuic);

    } else if (scheme === "trojan") {
      let urlTrojan: URL;
      try {
        urlTrojan = new URL(line);
      } catch {
        continue;
      }
      const query = new URLSearchParams(urlTrojan.search);
      const name = uniqueName(names, decodeURIComponent(urlTrojan.hash.slice(1)));
      const trojan: ProxyRecord = {
        name,
        type: scheme,
        server: urlTrojan.hostname,
        port: Number(urlTrojan.port),
        password: urlTrojan.username,
        udp: true,
        "skip-cert-verify": strtobool(query.get("allowInsecure")),
      };
      const sni = get(query.get("sni"));
      if (sni !== "") trojan["sni"] = sni;
      const alpn = get(query.get("alpn"));
      if (alpn !== "") trojan["alpn"] = alpn.split(",");
      const network = get(query.get("type")).toLowerCase();
      if (network !== "") {
        trojan["network"] = network;
        if (network === "ws") {
          trojan["ws-opts"] = {
            path: query.get("path"),
            headers: { "User-Agent": randUserAgent() },
          };
        } else if (network === "grpc") {
          trojan["grpc-opts"] = { serviceName: query.get("serviceName") };
        }
      }
      const fp = get(query.get("fp"));
      trojan["client-fingerprint"] = fp !== "" ? fp : "chrome";
      proxies.push(trojan);

    } else if (scheme === "vless") {
      let urlVless: URL;
      try {
        urlVless = new URL(line);
      } catch {
        continue;
      }
      const query = new URLSearchParams(urlVless.search);
      const vless: ProxyRecord = {};
      try {
        handleVShareLink(names, urlVless, scheme, vless);
      } catch {
        continue;
      }
      const flow = get(query.get("flow")).toLowerCase();
      if (flow !== "") vless["flow"] = flow;
      proxies.push(vless);

    } else if (scheme === "vmess") {
      // Try legacy VMess base64 format first
      let dcBuf: string | null = null;
      try {
        dcBuf = base64RawStdDecode(body);
      } catch {
        // Xray VMessAEAD share link
      }

      if (dcBuf === null) {
        let urlVMess: URL;
        try {
          urlVMess = new URL(line);
        } catch {
          continue;
        }
        const query = new URLSearchParams(urlVMess.search);
        const vmess: ProxyRecord = {};
        try {
          handleVShareLink(names, urlVMess, scheme, vmess);
        } catch {
          continue;
        }
        vmess["alterId"] = 0;
        vmess["cipher"] = "auto";
        const encryption = get(query.get("encryption"));
        if (encryption !== "") vmess["cipher"] = encryption;
        proxies.push(vmess);
        continue;
      }

      let values: Record<string, unknown>;
      try {
        values = JSON.parse(dcBuf) as Record<string, unknown>;
      } catch {
        continue;
      }

      const tempName = values["ps"] as string | undefined;
      if (!tempName) continue;
      const name = uniqueName(names, tempName);

      const vmess: ProxyRecord = {
        name,
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
      const cipher = get(values["scy"] as string | undefined);
      if (cipher !== "") vmess["cipher"] = cipher;
      const sni = get(values["sni"] as string | undefined);
      if (sni !== "") vmess["servername"] = sni;

      let network = get(values["net"] as string | undefined).toLowerCase();
      if (values["type"] === "http") {
        network = "http";
      } else if (network === "http") {
        network = "h2";
      }
      vmess["network"] = network;

      const tlsVal = values["tls"];
      if (tlsVal != null) {
        const tlsStr = String(tlsVal).toLowerCase();
        if (tlsStr.endsWith("tls")) vmess["tls"] = true;
        const alpn = values["alpn"] as string | undefined;
        if (alpn != null && alpn !== "") vmess["alpn"] = alpn.split(",");
      }

      if (network === "http") {
        const httpOpts: Record<string, unknown> = { path: "/" };
        const headers: Record<string, unknown> = {};
        const host = get(values["host"] as string | undefined);
        if (host !== "") headers["Host"] = host;
        const path = get(values["path"] as string | undefined);
        if (path !== "") httpOpts["path"] = path;
        httpOpts["headers"] = headers;
        vmess["http-opts"] = httpOpts;
      } else if (network === "h2") {
        const h2Opts: Record<string, unknown> = {};
        const host = get(values["host"] as string | undefined);
        if (host !== "") h2Opts["host"] = [host];
        h2Opts["path"] = get(values["path"] as string | undefined);
        vmess["h2-opts"] = h2Opts;
      } else if (network === "ws") {
        const wsOpts: Record<string, unknown> = { path: "/" };
        const headers: Record<string, unknown> = {};
        const host = get(values["host"] as string | undefined);
        if (host !== "") headers["Host"] = host;
        const path = get(values["path"] as string | undefined);
        if (path !== "") wsOpts["path"] = path;
        wsOpts["headers"] = headers;
        vmess["ws-opts"] = wsOpts;
      } else if (network === "grpc") {
        vmess["grpc-opts"] = {
          "grpc-service-name": get(values["path"] as string | undefined),
        };
      }
      proxies.push(vmess);

    } else if (scheme === "ss") {
      let urlSS: URL;
      try {
        urlSS = new URL(line);
      } catch {
        continue;
      }
      const name = uniqueName(names, decodeURIComponent(urlSS.hash.slice(1)));
      let port: number | string = urlSS.port;

      if (port === "") {
        try {
          const decoded = base64RawStdDecode(urlSS.hostname);
          urlSS = new URL("ss://" + decoded);
          port = urlSS.port;
        } catch {
          continue;
        }
      }

      let cipherRaw = urlSS.username;
      let cipher = cipherRaw;
      let password = urlSS.password;

      if (!password) {
        let dcBuf: string;
        try {
          dcBuf = base64RawStdDecode(cipherRaw);
        } catch {
          try {
            dcBuf = base64RawURLDecode(cipherRaw);
          } catch {
            continue;
          }
        }
        const colonIdx = dcBuf.indexOf(":");
        if (colonIdx === -1) continue;
        cipher = dcBuf.slice(0, colonIdx);
        password = dcBuf.slice(colonIdx + 1);
      }

      const query = new URLSearchParams(urlSS.search);
      const ss: ProxyRecord = {
        name,
        type: scheme,
        server: urlSS.hostname,
        port: Number(port),
        cipher,
        password,
        udp: true,
      };
      const plugin = get(query.get("plugin"));
      if (plugin.includes("obfs")) {
        const pluginOpts = get(query.get("plugin-opts")).split(";");
        ss["plugin"] = "obfs";
        ss["plugin-opts"] = {
          host: pluginOpts[2]?.slice(10) ?? "",
          mode: pluginOpts[1]?.slice(5) ?? "",
        };
      }
      proxies.push(ss);

    } else if (scheme === "ssr") {
      let dcBuf: string;
      try {
        dcBuf = base64RawStdDecode(body);
      } catch {
        continue;
      }

      const qIdx = dcBuf.indexOf("/?");
      if (qIdx === -1) continue;
      const before = dcBuf.slice(0, qIdx);
      const after = dcBuf.slice(qIdx + 2);
      const beforeArr = before.split(":");
      if (beforeArr.length < 6) continue;

      const [host, portStr, protocol, method, obfs] = beforeArr;
      let password: string;
      try {
        password = base64RawURLDecode(urlSafe(beforeArr[5]));
      } catch {
        continue;
      }

      let query: URLSearchParams;
      try {
        query = new URLSearchParams(urlSafe(after));
      } catch {
        continue;
      }

      const remarks = base64RawURLDecode(get(query.get("remarks")));
      const name = uniqueName(names, remarks);
      const obfsParam = get(query.get("obfsparam"));
      const protocolParam = get(query.get("protoparam"));

      const ssr: ProxyRecord = {
        name,
        type: scheme,
        server: host,
        port: portStr,
        cipher: method,
        password,
        protocol,
        udp: true,
      };
      if (obfsParam !== "") ssr["obfs-param"] = obfsParam;
      if (protocolParam !== "") ssr["protocol-param"] = protocolParam;
      proxies.push(ssr);

    } else if (scheme === "tg") {
      let urlTG: URL;
      try {
        urlTG = new URL(line);
      } catch {
        continue;
      }
      const query = new URLSearchParams(urlTG.search);
      let remark = get(query.get("remark"));
      if (remark === "") remark = get(query.get("remarks"));
      if (remark === "") remark = urlTG.hostname;
      const tg: ProxyRecord = {
        name: uniqueName(names, remark),
        type: urlTG.hostname,
        server: get(query.get("server")),
        port: String(get(query.get("port"))),
      };
      const user = get(query.get("user"));
      if (user !== "") tg["username"] = user;
      const pass = get(query.get("pass"));
      if (pass !== "") tg["password"] = pass;
      proxies.push(tg);

    } else if (scheme === "https") {
      let urlHTTPS: URL;
      try {
        urlHTTPS = new URL(line);
      } catch {
        continue;
      }
      if (!urlHTTPS.hostname.startsWith("t.me")) continue;
      const query = new URLSearchParams(urlHTTPS.search);
      let remark = get(query.get("remark"));
      if (remark === "") remark = get(query.get("remarks"));
      if (remark === "") remark = urlHTTPS.pathname.replace(/^\//, "");
      const tg: ProxyRecord = {
        name: uniqueName(names, remark),
        type: urlHTTPS.pathname.replace(/^\//, ""),
        server: get(query.get("server")),
        port: String(get(query.get("port"))),
      };
      const user = get(query.get("user"));
      if (user !== "") tg["username"] = user;
      const pass = get(query.get("pass"));
      if (pass !== "") tg["password"] = pass;
      proxies.push(tg);
    }
  }

  if (proxies.length === 0) {
    throw new Error("No valid proxies found");
  }
  return proxies;
}

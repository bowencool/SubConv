import { get, randUserAgent, uniqueName } from "./util.js";

type ProxyRecord = Record<string, unknown>;

export function handleVShareLink(
  names: Record<string, number>,
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

  const tls = get(query.get("security")).toLowerCase();
  if (tls.endsWith("tls") || tls === "reality") {
    proxy["tls"] = true;
    const fingerprint = get(query.get("fp"));
    proxy["client-fingerprint"] = fingerprint !== "" ? fingerprint : "chrome";
    const alpn = get(query.get("alpn"));
    if (alpn !== "") proxy["alpn"] = alpn.split(",");
  }

  const sni = get(query.get("sni"));
  if (sni !== "") proxy["servername"] = sni;

  const realityPublicKey = get(query.get("pbk"));
  if (realityPublicKey !== "") {
    proxy["reality-opts"] = {
      "public-key": realityPublicKey,
      "short-id": get(query.get("sid")),
    };
  }

  const packetEncoding = get(query.get("packetEncoding"));
  if (packetEncoding === "packet") {
    proxy["packet-addr"] = true;
  } else if (packetEncoding !== "none" && packetEncoding !== "") {
    proxy["xudp"] = true;
  }

  let network = get(query.get("type")).toLowerCase();
  if (network === "") network = "tcp";
  const fakeType = get(query.get("headerType")).toLowerCase();
  if (fakeType === "http") {
    network = "http";
  } else if (network === "http") {
    network = "h2";
  }
  proxy["network"] = network;

  if (network === "tcp") {
    if (fakeType !== "none" && fakeType !== "") {
      const httpOpts: Record<string, unknown> = { path: "/" };
      const headers: Record<string, unknown> = {};
      const host = get(query.get("host"));
      if (host !== "") headers["Host"] = host;
      const method = get(query.get("method"));
      if (method !== "") httpOpts["method"] = method;
      const path = get(query.get("path"));
      if (path !== "") httpOpts["path"] = path;
      httpOpts["headers"] = headers;
      proxy["http-opts"] = httpOpts;
    }
  } else if (network === "http") {
    const h2Opts: Record<string, unknown> = { path: "/" };
    const path = get(query.get("path"));
    if (path !== "") h2Opts["path"] = path;
    const host = get(query.get("host"));
    if (host !== "") h2Opts["host"] = [host];
    proxy["h2-opts"] = h2Opts;
  } else if (network === "ws") {
    const wsOpts: Record<string, unknown> = {};
    const headers: Record<string, unknown> = {
      "User-Agent": randUserAgent(),
      Host: get(query.get("host")),
    };
    wsOpts["path"] = get(query.get("path"));
    wsOpts["headers"] = headers;
    const earlyData = get(query.get("ed"));
    if (earlyData !== "") {
      const med = parseInt(earlyData, 10);
      if (isNaN(med)) throw new Error("invalid early-data");
      wsOpts["max-early-data"] = med;
    }
    const earlyDataHeader = get(query.get("edh"));
    if (earlyDataHeader !== "") wsOpts["early-data-header-name"] = earlyDataHeader;
    proxy["ws-opts"] = wsOpts;
  } else if (network === "grpc") {
    proxy["grpc-opts"] = {
      "grpc-service-name": get(query.get("serviceName")),
    };
  }
}

import { describe, expect, test } from "bun:test";
import yaml from "js-yaml";
import { parseProxyLinks } from "./convert";
import { parseSubs } from "./parse";

describe("IPv6 proxy server normalization", () => {
  test("removes brackets from legacy VMess JSON addresses", () => {
    const payload = Buffer.from(
      JSON.stringify({
        v: "2",
        ps: "IPv6 VMess",
        add: "[2001:db8::1]",
        port: "443",
        id: "00000000-0000-0000-0000-000000000000",
        aid: "0",
        scy: "auto",
        net: "ws",
        type: "none",
        host: "",
        path: "/",
        tls: "",
      }),
    ).toString("base64");

    expect(parseProxyLinks(`vmess://${payload}`)[0]?.server).toBe("2001:db8::1");
  });

  test("removes URI brackets from Hysteria2 IPv6 addresses", () => {
    const [proxy] = parseProxyLinks(
      "hysteria2://password@[2001:db8::2]:443/?insecure=1#IPv6%20HY2",
    );

    expect(proxy?.server).toBe("2001:db8::2");
  });

  test("normalizes bracketed servers in Clash YAML subscriptions", () => {
    const output = parseSubs(`
proxies:
  - name: IPv6 SS
    type: ss
    server: "[2001:db8::3]"
    port: 443
    cipher: aes-128-gcm
    password: test
`);
    const parsed = yaml.load(output) as { proxies: Array<Record<string, unknown>> };

    expect(parsed.proxies[0]?.server).toBe("2001:db8::3");
  });

  test("leaves domain names unchanged", () => {
    const [proxy] = parseProxyLinks("trojan://password@example.com:443#domain");

    expect(proxy?.server).toBe("example.com");
  });
});

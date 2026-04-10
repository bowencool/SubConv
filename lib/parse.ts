import yaml from "js-yaml";
import { parseProxyLinks } from "./convert";

type ProxyRecord = Record<string, unknown>;

const EXCLUDE_NAME_RE = /到期|官网|剩余|流量|套餐|重置|http/i;

function filterProxies(proxies: ProxyRecord[]): ProxyRecord[] {
  return proxies.filter((p) => !EXCLUDE_NAME_RE.test(String(p["name"] ?? "")));
}

export function parseSubs(content: string): string {
  try {
    const parsed = yaml.load(content);
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      const proxies = (parsed as Record<string, unknown>)["proxies"] as ProxyRecord[] | undefined;
      if (Array.isArray(proxies) && proxies.length > 0) {
        return yaml.dump({ proxies: filterProxies(proxies) }, { noCompatMode: true, sortKeys: false });
      }
    }
  } catch {
    // not valid yaml, fall through
  }
  const proxies = parseProxyLinks(content);
  return yaml.dump({ proxies: filterProxies(proxies) }, { noCompatMode: true, sortKeys: false });
}

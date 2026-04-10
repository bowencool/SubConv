import yaml from "js-yaml";
import { parseProxyLinks } from "./convert";

type ProxyRecord = Record<string, unknown>;

export function parseSubs(content: string): string {
  try {
    const parsed = yaml.load(content);
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      const proxies = (parsed as Record<string, unknown>)["proxies"] as ProxyRecord[] | undefined;
      if (Array.isArray(proxies) && proxies.length > 0) {
        return yaml.dump({ proxies }, { noCompatMode: true, sortKeys: false });
      }
    }
    const proxies = parseProxyLinks(content);
    return yaml.dump({ proxies }, { noCompatMode: true, sortKeys: false });
  } catch {
    const proxies = parseProxyLinks(content);
    return yaml.dump({ proxies }, { noCompatMode: true, sortKeys: false });
  }
}

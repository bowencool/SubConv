import yaml from "js-yaml";
import { parseProxyLinks } from "./convert";

type ProxyRecord = Record<string, unknown>;

export function parseSubs(content: string): string {
  try {
    const parsed = yaml.load(content) as Record<string, unknown>;
    const proxies = parsed["proxies"] as ProxyRecord[] | undefined;
    return yaml.dump({ proxies }, { noCompatMode: true, sortKeys: false });
  } catch {
    const proxies = parseProxyLinks(content);
    return yaml.dump({ proxies }, { noCompatMode: true, sortKeys: false });
  }
}

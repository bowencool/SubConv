import yaml from "js-yaml";
import { convertsV2Ray } from "./convert/converter";

type ProxyRecord = Record<string, unknown>;

export async function parseSubs(content: string): Promise<string> {
  try {
    const parsed = yaml.load(content) as Record<string, unknown>;
    const proxies = parsed["proxies"] as ProxyRecord[] | undefined;
    return yaml.dump({ proxies }, { noCompatMode: true, sortKeys: false });
  } catch {
    const proxies = await convertsV2Ray(content);
    return yaml.dump({ proxies }, { noCompatMode: true, sortKeys: false });
  }
}

export async function mkListProxyNames(content: string[]): Promise<string[]> {
  const names: string[] = [];
  for (const chunk of content) {
    const matches = chunk.match(/- name: (.+)/g) ?? [];
    for (const m of matches) {
      names.push(m.slice("- name: ".length).trim());
    }
  }
  return names;
}

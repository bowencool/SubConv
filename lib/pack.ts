import yaml from "js-yaml";
import { mkListProxyNames } from "./parse";
import { configInstance } from "./config";

type ProxyRecord = Record<string, unknown>;

function randomInt(max: number): number {
  return Math.floor(Math.random() * max);
}

function urlFilename(url: string): string {
  return new URL(url).pathname.split("/").pop()!.split(".")[0];
}

export interface PackParams {
  url: string[] | null;
  urlstandalone: ProxyRecord[] | null;
  urlstandby: string[] | null;
  urlstandbystandalone: ProxyRecord[] | null;
  content: string[];
  interval: string;
  domain: string;
  short: string | null | undefined;
  notproxyrule: string | null | undefined;
  base_url: string;
}

export async function pack(params: PackParams): Promise<string> {
  const {
    url,
    urlstandalone,
    urlstandby,
    urlstandbystandalone,
    content,
    interval,
    domain,
    short,
    notproxyrule,
    base_url,
  } = params;

  const providerProxyNames = await mkListProxyNames(content);
  const result: Record<string, unknown> = {};

  if (!short) {
    Object.assign(result, configInstance.HEAD);
  }

  // proxies (standalone)
  const proxiesList: ProxyRecord[] = [];
  const proxiesName: string[] = [];
  const proxiesStandbyName: string[] = [];

  if (urlstandalone) {
    for (const p of urlstandalone) {
      proxiesList.push(p);
      proxiesName.push(p["name"] as string);
      proxiesStandbyName.push(p["name"] as string);
    }
  }
  if (urlstandbystandalone) {
    for (const p of urlstandbystandalone) {
      proxiesList.push(p);
      proxiesStandbyName.push(p["name"] as string);
    }
  }
  if (proxiesList.length > 0) result["proxies"] = proxiesList;

  // proxy-providers
  const proxyProviders: Record<string, unknown> = {};
  if (url) {
    url.forEach((u, i) => {
      const providerUrl =
        notproxyrule == null
          ? `${base_url}proxy?${new URLSearchParams({ url: u }).toString()}`
          : u;
      proxyProviders[`subscription${i}`] = {
        type: "http",
        url: providerUrl,
        interval: parseInt(interval),
        path: `./sub/subscription${i}.yaml`,
        "health-check": {
          enable: true,
          interval: 60,
          url: configInstance.TEST_URL,
        },
      };
    });
  }
  if (urlstandby) {
    urlstandby.forEach((u, i) => {
      const providerUrl =
        notproxyrule == null
          ? `${base_url}proxy?${new URLSearchParams({ url: u }).toString()}`
          : u;
      proxyProviders[`subscriptionsub${i}`] = {
        type: "http",
        url: providerUrl,
        interval: parseInt(interval),
        path: `./sub/subscriptionsub${i}.yaml`,
        "health-check": {
          enable: true,
          interval: 60,
          url: configInstance.TEST_URL,
        },
      };
    });
  }
  if (Object.keys(proxyProviders).length > 0) {
    result["proxy-providers"] = proxyProviders;
  }

  // subscriptions list for use in groups
  const subscriptions: string[] = url ? url.map((_, i) => `subscription${i}`) : [];
  const standby: string[] = [...subscriptions];
  if (urlstandby) {
    urlstandby.forEach((_, i) => standby.push(`subscriptionsub${i}`));
  }

  // proxy-groups
  const proxyGroupsList: Record<string, unknown>[] = [];

  // First group: 🚀 节点选择
  const proxySelect: Record<string, unknown> = {
    name: "🚀 节点选择",
    type: "select",
    proxies: [
      ...configInstance.CUSTOM_PROXY_GROUP
        .filter((g) => g.rule === false)
        .map((g) => g.name),
      "DIRECT",
    ],
  };
  if (configInstance.CUSTOM_PROXY_GROUP.length > 0) {
    proxyGroupsList.push(proxySelect);
  }

  for (const group of configInstance.CUSTOM_PROXY_GROUP) {
    const { type, regex, rule, manual, prior, name } = group;

    if (type === "select" && rule !== false) {
      // rule-based select group
      const nonRuleGroups = configInstance.CUSTOM_PROXY_GROUP
        .filter((g) => g.rule === false)
        .map((g) => g.name);

      let proxies: string[];
      if (prior === "DIRECT") {
        proxies = ["DIRECT", "REJECT", "🚀 节点选择", ...nonRuleGroups];
      } else if (prior === "REJECT") {
        proxies = ["REJECT", "DIRECT", "🚀 节点选择", ...nonRuleGroups];
      } else {
        proxies = ["🚀 节点选择", ...nonRuleGroups, "DIRECT", "REJECT"];
      }
      proxyGroupsList.push({ name, type: "select", proxies });
      continue;
    }

    if (
      type === "load-balance" ||
      type === "select" ||
      type === "fallback" ||
      type === "url-test"
    ) {
      let proxyGroup: Record<string, unknown> | null = { name, type };
      const providerProxies: string[] = [];
      const proxyGroupProxies: string[] = [];

      if (regex != null) {
        proxyGroup["filter"] = regex;
        const re = new RegExp(regex, "i");

        if (manual) {
          if (standby.length > 0) {
            for (const p of standby) {
              if (re.test(p)) {
                providerProxies.push(p);
                break;
              }
            }
            if (providerProxies.length > 0) proxyGroup["use"] = standby;
          }
          if (proxiesStandbyName.length > 0) {
            for (const p of proxiesStandbyName) {
              if (re.test(p)) proxyGroupProxies.push(p);
            }
            if (proxyGroupProxies.length > 0) proxyGroup["proxies"] = proxyGroupProxies;
          }
        } else {
          if (subscriptions.length > 0) {
            for (const p of providerProxyNames) {
              if (re.test(p)) {
                providerProxies.push(p);
                break;
              }
            }
            if (providerProxies.length > 0) proxyGroup["use"] = subscriptions;
          }
          if (proxiesName.length > 0) {
            for (const p of proxiesName) {
              if (re.test(p)) proxyGroupProxies.push(p);
            }
            if (proxyGroupProxies.length > 0) proxyGroup["proxies"] = proxyGroupProxies;
          }
        }

        if (providerProxies.length + proxyGroupProxies.length === 0) {
          // remove from 节点选择
          const selProxies = proxyGroupsList[0]["proxies"] as string[];
          const idx = selProxies.indexOf(name);
          if (idx !== -1) selProxies.splice(idx, 1);
          proxyGroup = null;
        }
      } else {
        if (manual) {
          if (standby.length > 0) proxyGroup["use"] = standby;
          if (proxiesStandbyName.length > 0) proxyGroup["proxies"] = proxiesStandbyName;
        } else {
          if (subscriptions.length > 0) proxyGroup["use"] = subscriptions;
          if (proxiesName.length > 0) proxyGroup["proxies"] = proxiesName;
        }
      }

      if (proxyGroup !== null) {
        if (type === "load-balance") {
          proxyGroup["strategy"] = "consistent-hashing";
          proxyGroup["url"] = configInstance.TEST_URL;
          proxyGroup["interval"] = 60;
          proxyGroup["tolerance"] = 50;
        } else if (type === "fallback" || type === "url-test") {
          proxyGroup["url"] = configInstance.TEST_URL;
          proxyGroup["interval"] = 60;
          proxyGroup["tolerance"] = 50;
        }
        proxyGroupsList.push(proxyGroup);
      }
    }
  }

  // remove proxies that don't exist in any group
  const allGroupAndProxyNames = new Set<string>(["DIRECT", "REJECT"]);
  for (const g of proxyGroupsList) allGroupAndProxyNames.add(g["name"] as string);
  for (const n of proxiesStandbyName) allGroupAndProxyNames.add(n);

  for (const pg of proxyGroupsList) {
    if ("proxies" in pg) {
      pg["proxies"] = (pg["proxies"] as string[]).filter((p) => allGroupAndProxyNames.has(p));
    }
  }

  result["proxy-groups"] = proxyGroupsList;

  // rule-providers
  const ruleProviders: Record<string, unknown> = {};
  const ruleMap: [string, string][] = []; // [name, group]
  const usedNames = new Set<string>();

  for (const [group, ruleUrl] of configInstance.RULESET) {
    let name: string;
    if (ruleUrl.startsWith("[]")) {
      name = ruleUrl;
    } else {
      name = urlFilename(ruleUrl);
      while (usedNames.has(name)) {
        name += String(randomInt(10));
      }
      usedNames.add(name);
      let providerUrl = ruleUrl;
      if (notproxyrule == null) {
        providerUrl = `${base_url}proxy?${new URLSearchParams({ url: ruleUrl }).toString()}`;
      }
      ruleProviders[name] = {
        type: "http",
        behavior: "classical",
        format: "text",
        interval: 86400 * 7,
        path: `./rule/${name}.txt`,
        url: providerUrl,
      };
    }
    ruleMap.push([name, group]);
  }
  result["rule-providers"] = ruleProviders;

  // rules
  const rules: string[] = [`DOMAIN,${domain},DIRECT`];
  for (const [k, v] of ruleMap) {
    if (!k.startsWith("[]")) {
      rules.push(`RULE-SET,${k},${v}`);
    } else if (k.slice(2) !== "FINAL" && k.slice(2) !== "MATCH") {
      rules.push(`${k.slice(2)},${v}`);
    } else {
      rules.push(`MATCH,${v}`);
    }
  }
  result["rules"] = rules;

  return yaml.dump(result, { noCompatMode: true, sortKeys: false });
}

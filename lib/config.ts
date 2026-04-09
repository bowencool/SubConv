import yaml from "js-yaml";
import configRaw from "../config.yaml?raw";

export interface GroupDef {
  name: string;
  type: string;
  rule?: boolean;
  manual?: boolean;
  prior?: string;
  regex?: string;
}

export interface Config {
  HEAD: Record<string, unknown>;
  TEST_URL: string;
  RULESET: [string, string][];
  CUSTOM_PROXY_GROUP: GroupDef[];
}

function parseYaml(raw: string): Config {
  if (raw.trim() === "") throw new Error("config is empty");
  const parsed = yaml.load(raw) as Config;
  if (!parsed.HEAD || !parsed.RULESET) throw new Error("Missing required fields HEAD or RULESET");
  if (!parsed.TEST_URL) parsed.TEST_URL = "http://www.gstatic.com/generate_204";
  if (!parsed.CUSTOM_PROXY_GROUP) parsed.CUSTOM_PROXY_GROUP = [];
  return parsed;
}

async function loadConfig(): Promise<Config> {
  // 1. Bundled config.yaml (works on all platforms including CF Workers)
  if (configRaw) {
    return parseYaml(configRaw);
  }

  // 2. Remote URL via CONFIG_URL env var
  const configUrl = process.env.CONFIG_URL;
  if (configUrl) {
    console.log(`Loading config from ${configUrl}`);
    const resp = await fetch(configUrl);
    if (!resp.ok) throw new Error(`Failed to fetch config (${resp.status}): ${configUrl}`);
    return parseYaml(await resp.text());
  }

  throw new Error("No config available. Bundle config.yaml or set CONFIG_URL.");
}

export const configInstance: Config = await loadConfig();

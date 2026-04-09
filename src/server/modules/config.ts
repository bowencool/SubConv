import { readFileSync, existsSync } from "fs";
import yaml from "js-yaml";

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
  // 1. Local file takes priority (Docker / Node.js deployments)
  const configPath = "config.yaml";
  if (existsSync(configPath)) {
    return parseYaml(readFileSync(configPath, "utf-8"));
  }

  // 2. Remote URL — explicit CONFIG_URL or auto-derived from Vercel Git env vars
  const owner = process.env["VERCEL_GIT_REPO_OWNER"];
  const repo = process.env["VERCEL_GIT_REPO_SLUG"];
  const branch = process.env["VERCEL_GIT_COMMIT_REF"] ?? "main";
  const defaultUrl =
    owner && repo
      ? `https://raw.githubusercontent.com/${owner}/${repo}/refs/heads/${branch}/config.yaml`
      : null;
  const configUrl = process.env["CONFIG_URL"] ?? defaultUrl;

  if (configUrl) {
    console.log(`Loading config from ${configUrl}`);
    const resp = await fetch(configUrl);
    if (!resp.ok) throw new Error(`Failed to fetch config (${resp.status}): ${configUrl}`);
    return parseYaml(await resp.text());
  }

  console.error("No config.yaml found and no CONFIG_URL set. Provide a config.yaml file or set CONFIG_URL.");
  process.exit(1);
}

export const configInstance: Config = await loadConfig();

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
  // 1. Filesystem config.yaml (supports Docker volume mounts)
  //    Skipped silently on platforms without fs (CF Workers, Vercel Edge, etc.)
  try {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(process.cwd(), "config.yaml");
    const raw = fs.readFileSync(filePath, "utf-8");
    if (raw.trim()) {
      console.log(`Loading config from filesystem: ${filePath}`);
      return parseYaml(raw);
    }
  } catch {
    // fs not available or file not found — fall through
  }

  // 2. Bundled config.yaml (works on all platforms including CF Workers / Vercel)
  if (configRaw) {
    return parseYaml(configRaw);
  }

  throw new Error("No config available. Bundle config.yaml or bundle a config.");
}

export const configInstance: Config = await loadConfig();

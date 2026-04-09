import { readFileSync, existsSync } from "fs";
import yaml from "js-yaml";
import type { GroupDef } from "../config_template.js";

export interface Config {
  HEAD: Record<string, unknown>;
  TEST_URL: string;
  RULESET: [string, string][];
  CUSTOM_PROXY_GROUP: GroupDef[];
}

function loadConfig(): Config {
  const configPath = "config.yaml";
  if (!existsSync(configPath)) {
    console.error(
      "config.yaml not found or empty, please copy config.yaml.example and edit it, or run with --generate-config"
    );
    process.exit(1);
  }
  const raw = readFileSync(configPath, "utf-8");
  if (raw.trim() === "") {
    console.error("config.yaml is empty");
    process.exit(1);
  }
  try {
    const parsed = yaml.load(raw) as Config;
    if (!parsed.HEAD || !parsed.RULESET) {
      throw new Error("Missing required fields HEAD or RULESET");
    }
    if (!parsed.TEST_URL) parsed.TEST_URL = "http://www.gstatic.com/generate_204";
    if (!parsed.CUSTOM_PROXY_GROUP) parsed.CUSTOM_PROXY_GROUP = [];
    return parsed;
  } catch (e) {
    console.error("Error parsing config.yaml:", e);
    process.exit(1);
  }
}

export const configInstance: Config = loadConfig();

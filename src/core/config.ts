import fs from "node:fs";
import path from "node:path";
import type { GiverConfig } from "./types.js";

const CONFIG_PATH = path.join(
  process.cwd(),
  "data",
  "config",
  "giver.config.json"
);

const DEFAULT_CONFIG: GiverConfig = {
  allowedPaths: [process.cwd()],
  blockedCommands: [
    "sudo",
    "rm -rf /",
    "mkfs",
    "dd if=",
    ":(){ :|:& };:",
    "chmod -R 777 /",
    "shutdown",
    "reboot",
    "halt",
    "poweroff",
  ],
  maxTokens: 8192,
  maxToolRounds: 20,
  provider: {
    type: "ollama",
    model: "qwen3-coder:30b",
    ollamaBaseUrl: "http://localhost:11434",
  },
  telegram: {
    allowedUsers: [],
  },
};

let cachedConfig: GiverConfig | null = null;

export function isFirstRun(): boolean {
  const config = loadConfig();
  return !config.setupComplete;
}

export function loadConfig(): GiverConfig {
  if (cachedConfig) return cachedConfig;

  if (fs.existsSync(CONFIG_PATH)) {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    cachedConfig = { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } else {
    cachedConfig = { ...DEFAULT_CONFIG };
    saveConfig(cachedConfig);
  }

  return cachedConfig!;
}

export function saveConfig(config: GiverConfig): void {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
  cachedConfig = config;
}

export function getConfig(): GiverConfig {
  return loadConfig();
}

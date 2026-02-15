import fs from "node:fs";
import path from "node:path";
import type { UserPreferences } from "../core/types.js";

const DATA_DIR = path.join(process.cwd(), "data", "memory");
const PREFS_FILE = path.join(DATA_DIR, "preferences.json");

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadPreferences(): UserPreferences {
  ensureDir();
  if (!fs.existsSync(PREFS_FILE)) return {};
  const raw = fs.readFileSync(PREFS_FILE, "utf-8");
  return JSON.parse(raw) as UserPreferences;
}

export function savePreferences(prefs: UserPreferences): void {
  ensureDir();
  fs.writeFileSync(PREFS_FILE, JSON.stringify(prefs, null, 2), "utf-8");
}

export function getPreference(key: string): string | undefined {
  return loadPreferences()[key];
}

export function setPreference(key: string, value: string): void {
  const prefs = loadPreferences();
  prefs[key] = value;
  savePreferences(prefs);
}

export function getPreferenceSummary(): string {
  const prefs = loadPreferences();
  const entries = Object.entries(prefs).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return "(no preferences set)";
  return entries.map(([k, v]) => `- ${k}: ${v}`).join("\n");
}

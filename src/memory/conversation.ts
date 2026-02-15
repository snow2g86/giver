import fs from "node:fs";
import path from "node:path";
import { v4 as uuid } from "uuid";
import type { ConversationEntry } from "../core/types.js";

const DATA_DIR = path.join(process.cwd(), "data", "memory");
const CONVERSATION_FILE = path.join(DATA_DIR, "conversations.json");
const MAX_ENTRIES = 200;

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadConversations(): ConversationEntry[] {
  ensureDir();
  if (!fs.existsSync(CONVERSATION_FILE)) return [];
  const raw = fs.readFileSync(CONVERSATION_FILE, "utf-8");
  return JSON.parse(raw) as ConversationEntry[];
}

export function saveConversationEntry(
  role: "user" | "assistant",
  content: string
): void {
  ensureDir();
  const entries = loadConversations();
  entries.push({
    id: uuid(),
    timestamp: new Date().toISOString(),
    role,
    content,
  });

  // Keep only last MAX_ENTRIES
  const trimmed = entries.slice(-MAX_ENTRIES);
  fs.writeFileSync(CONVERSATION_FILE, JSON.stringify(trimmed, null, 2), "utf-8");
}

export function getRecentConversations(count = 10): ConversationEntry[] {
  return loadConversations().slice(-count);
}

export function clearConversations(): void {
  ensureDir();
  fs.writeFileSync(CONVERSATION_FILE, "[]", "utf-8");
}

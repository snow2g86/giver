import fs from "node:fs";
import path from "node:path";
import type { MemoryEntry } from "../core/types.js";
import type { Tool } from "../tools/base.js";

const DATA_DIR = path.join(process.cwd(), "data", "memory");
const MEMORY_FILE = path.join(DATA_DIR, "long-term.json");

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadMemories(): Map<string, MemoryEntry> {
  ensureDir();
  if (!fs.existsSync(MEMORY_FILE)) return new Map();
  const raw = fs.readFileSync(MEMORY_FILE, "utf-8");
  const entries = JSON.parse(raw) as MemoryEntry[];
  return new Map(entries.map((e) => [e.key, e]));
}

function saveMemories(memories: Map<string, MemoryEntry>): void {
  ensureDir();
  const entries = Array.from(memories.values());
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(entries, null, 2), "utf-8");
}

export function getMemory(key: string): MemoryEntry | undefined {
  return loadMemories().get(key);
}

export function setMemory(key: string, value: string): void {
  const memories = loadMemories();
  const now = new Date().toISOString();
  const existing = memories.get(key);
  memories.set(key, {
    key,
    value,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
  saveMemories(memories);
}

export function deleteMemory(key: string): boolean {
  const memories = loadMemories();
  const deleted = memories.delete(key);
  if (deleted) saveMemories(memories);
  return deleted;
}

export function listMemories(): MemoryEntry[] {
  return Array.from(loadMemories().values());
}

export function getMemorySummary(): string {
  const memories = listMemories();
  if (memories.length === 0) return "(no memories stored)";
  return memories.map((m) => `- ${m.key}: ${m.value}`).join("\n");
}

// Tool definitions for agent
export const saveMemoryTool: Tool = {
  name: "save_memory",
  description:
    "Save a piece of information to long-term memory. Use this to remember important facts, preferences, or context about the user.",
  inputSchema: {
    type: "object" as const,
    properties: {
      key: {
        type: "string",
        description: "A descriptive key for this memory (e.g., 'user_name', 'project_tech_stack')",
      },
      value: {
        type: "string",
        description: "The information to remember",
      },
    },
    required: ["key", "value"],
  },
  async execute(input) {
    setMemory(input.key as string, input.value as string);
    return `Memory saved: ${input.key}`;
  },
};

export const recallMemoryTool: Tool = {
  name: "recall_memory",
  description:
    "Recall a specific piece of information from long-term memory by key, or list all stored memories.",
  inputSchema: {
    type: "object" as const,
    properties: {
      key: {
        type: "string",
        description:
          "The key to recall. If omitted, returns all stored memories.",
      },
    },
    required: [],
  },
  async execute(input) {
    if (input.key) {
      const entry = getMemory(input.key as string);
      if (!entry) return `No memory found for key: ${input.key}`;
      return `${entry.key}: ${entry.value} (updated: ${entry.updatedAt})`;
    }
    return getMemorySummary();
  },
};

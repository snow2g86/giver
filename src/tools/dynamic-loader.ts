import { readdirSync, existsSync } from "fs";
import { resolve } from "path";
import { pathToFileURL } from "url";
import type { Tool } from "./base.js";
import type { ToolRegistry } from "./registry.js";

const DATA_DIR = resolve(process.cwd(), "data/tools");

export async function loadCustomTools(registry: ToolRegistry): Promise<number> {
  if (!existsSync(DATA_DIR)) {
    return 0;
  }

  const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".ts"));
  let loaded = 0;

  for (const file of files) {
    const filePath = resolve(DATA_DIR, file);
    try {
      const fileUrl = pathToFileURL(filePath).href + `?t=${Date.now()}`;
      const mod = await import(fileUrl);
      const tool: Tool = mod.default;

      if (tool && tool.name && typeof tool.execute === "function") {
        registry.register(tool);
        loaded++;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`Warning: Failed to load custom tool from ${file}: ${msg}`);
    }
  }

  return loaded;
}

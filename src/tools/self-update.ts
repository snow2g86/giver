import { writeFileSync, unlinkSync, existsSync, mkdirSync } from "fs";
import { resolve } from "path";
import { pathToFileURL } from "url";
import type { Tool } from "./base.js";
import type { ToolRegistry } from "./registry.js";

const DATA_DIR = resolve(process.cwd(), "data/tools");
const BUILTIN_TOOLS = new Set([
  "read_file",
  "write_file",
  "list_directory",
  "execute_command",
  "web_search",
  "browse_url",
  "browser_action",
  "save_memory",
  "recall_memory",
  "create_tool",
  "list_tools",
  "remove_tool",
]);

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function createSelfUpdateTools(registry: ToolRegistry): Tool[] {
  const createTool: Tool = {
    name: "create_tool",
    description:
      "Create a new custom tool at runtime. The tool becomes immediately available. " +
      "Use this when no existing tool can handle the user's request. " +
      "The 'code' parameter should be a function body that receives 'input' (Record<string, unknown>) and returns a Promise<string>.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Tool name in snake_case (e.g. fetch_weather)",
        },
        description: {
          type: "string",
          description: "What this tool does",
        },
        parameters: {
          type: "object",
          description:
            "JSON Schema for tool parameters. Must have type:'object', properties, and optionally required.",
        },
        code: {
          type: "string",
          description:
            "The async function body. Receives 'input' as argument. Must return a string. " +
            "Can use Node.js built-ins. Example: 'const res = await fetch(input.url); return await res.text();'",
        },
        imports: {
          type: "string",
          description:
            "Optional import statements at the top of the file (e.g. 'import fs from \"fs\";')",
        },
      },
      required: ["name", "description", "parameters", "code"],
    },
    execute: async (input) => {
      const name = input.name as string;
      const description = input.description as string;
      const parameters = input.parameters as Record<string, unknown>;
      const code = input.code as string;
      const imports = (input.imports as string) || "";

      if (BUILTIN_TOOLS.has(name)) {
        return `Error: Cannot overwrite built-in tool '${name}'.`;
      }

      if (!/^[a-z][a-z0-9_]*$/.test(name)) {
        return `Error: Tool name must be snake_case (lowercase letters, numbers, underscores).`;
      }

      ensureDataDir();
      const filePath = resolve(DATA_DIR, `${name}.ts`);

      const fileContent = `${imports ? imports + "\n\n" : ""}const tool = {
  name: "${name}",
  description: ${JSON.stringify(description)},
  inputSchema: ${JSON.stringify(parameters, null, 2)},
  execute: async (input: Record<string, unknown>): Promise<string> => {
    ${code}
  },
};

export default tool;
`;

      try {
        writeFileSync(filePath, fileContent, "utf-8");

        const fileUrl =
          pathToFileURL(filePath).href + `?t=${Date.now()}`;
        const mod = await import(fileUrl);
        const tool: Tool = mod.default;

        if (!tool.name || !tool.execute) {
          unlinkSync(filePath);
          return `Error: Generated tool module is invalid (missing name or execute).`;
        }

        registry.register(tool);
        return `Tool '${name}' created and registered successfully. You can now use it.`;
      } catch (err: unknown) {
        if (existsSync(filePath)) {
          unlinkSync(filePath);
        }
        const msg = err instanceof Error ? err.message : String(err);
        return `Error creating tool '${name}': ${msg}`;
      }
    },
  };

  const listTools: Tool = {
    name: "list_tools",
    description: "List all currently registered tools with their type (built-in or custom).",
    inputSchema: {
      type: "object",
      properties: {},
    },
    execute: async () => {
      const tools = registry.getAll();
      const lines = tools.map((t) => {
        const tag = BUILTIN_TOOLS.has(t.name) ? "[built-in]" : "[custom]";
        return `${tag} ${t.name}: ${t.description.slice(0, 80)}`;
      });
      return lines.join("\n");
    },
  };

  const removeTool: Tool = {
    name: "remove_tool",
    description: "Remove a custom tool. Built-in tools cannot be removed.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name of the custom tool to remove",
        },
      },
      required: ["name"],
    },
    execute: async (input) => {
      const name = input.name as string;

      if (BUILTIN_TOOLS.has(name)) {
        return `Error: Cannot remove built-in tool '${name}'.`;
      }

      const filePath = resolve(DATA_DIR, `${name}.ts`);
      const unregistered = registry.unregister(name);

      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }

      if (unregistered) {
        return `Tool '${name}' removed successfully.`;
      } else {
        return `Tool '${name}' was not found in the registry.`;
      }
    },
  };

  return [createTool, listTools, removeTool];
}

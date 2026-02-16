import fs from "node:fs";
import path from "node:path";
import type { Tool } from "./base.js";
import { PathGuard } from "../sandbox/path-guard.js";

const pathGuard = PathGuard.getInstance();

export const readFileTool: Tool = {
  name: "read_file",
  description:
    "Read the contents of a file. Returns the file content as text.",
  inputSchema: {
    type: "object" as const,
    properties: {
      path: {
        type: "string",
        description: "The file path to read",
      },
    },
    required: ["path"],
  },
  async execute(input) {
    const filePath = await pathGuard.validate(input.path as string);
    const content = await fs.promises.readFile(filePath, "utf-8");
    return content;
  },
};

export const writeFileTool: Tool = {
  name: "write_file",
  description:
    "Write content to a file. Creates the file if it doesn't exist, overwrites if it does.",
  inputSchema: {
    type: "object" as const,
    properties: {
      path: {
        type: "string",
        description: "The file path to write to",
      },
      content: {
        type: "string",
        description: "The content to write",
      },
    },
    required: ["path", "content"],
  },
  async execute(input) {
    const filePath = await pathGuard.validate(input.path as string);
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(filePath, input.content as string, "utf-8");
    return `File written: ${filePath}`;
  },
};

export const listDirectoryTool: Tool = {
  name: "list_directory",
  description:
    "List files and directories at the given path. Returns names with [DIR] or [FILE] prefix.",
  inputSchema: {
    type: "object" as const,
    properties: {
      path: {
        type: "string",
        description: "The directory path to list",
      },
    },
    required: ["path"],
  },
  async execute(input) {
    const dirPath = await pathGuard.validate(input.path as string);
    const entries = await fs.promises.readdir(dirPath, {
      withFileTypes: true,
    });
    const lines = entries.map((e) =>
      e.isDirectory() ? `[DIR]  ${e.name}` : `[FILE] ${e.name}`
    );
    return lines.join("\n") || "(empty directory)";
  },
};

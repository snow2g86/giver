import { exec } from "node:child_process";
import path from "node:path";
import type { Tool } from "./base.js";
import { PathGuard } from "../sandbox/path-guard.js";
import { Permissions } from "../sandbox/permissions.js";

const pathGuard = new PathGuard();
const permissions = new Permissions();

export const shellTool: Tool = {
  name: "execute_command",
  description:
    "Execute a shell command. The command runs in a sandboxed environment with restricted paths and blocked dangerous commands.",
  inputSchema: {
    type: "object" as const,
    properties: {
      command: {
        type: "string",
        description: "The shell command to execute",
      },
      cwd: {
        type: "string",
        description:
          "Working directory for the command (must be within allowed paths). Defaults to the first allowed path.",
      },
    },
    required: ["command"],
  },
  async execute(input) {
    const command = input.command as string;
    permissions.validateCommand(command);

    const allowedPaths = permissions.getAllowedPaths();
    const cwd = input.cwd
      ? await pathGuard.validate(input.cwd as string)
      : path.resolve(allowedPaths[0]);

    return new Promise<string>((resolve) => {
      exec(
        command,
        {
          cwd,
          timeout: 30_000,
          maxBuffer: 1024 * 1024,
          env: { ...process.env, PATH: process.env.PATH },
        },
        (error, stdout, stderr) => {
          if (error) {
            resolve(
              `Error (exit ${error.code ?? "?"}): ${stderr || error.message}`
            );
            return;
          }
          const output = [stdout, stderr].filter(Boolean).join("\n");
          resolve(output || "(no output)");
        }
      );
    });
  },
};

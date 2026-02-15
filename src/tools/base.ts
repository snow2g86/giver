import type { ToolDefinition } from "../core/types.js";

export interface Tool {
  name: string;
  description: string;
  inputSchema: ToolDefinition["input_schema"];
  execute(input: Record<string, unknown>): Promise<string>;
}

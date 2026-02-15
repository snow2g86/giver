import type {
  ToolDefinition,
  MessageParam,
  GenerateResponse,
} from "../core/types.js";

export interface AiProvider {
  name: string;
  generate(params: {
    model: string;
    maxTokens: number;
    system: string;
    tools: ToolDefinition[];
    messages: MessageParam[];
  }): Promise<GenerateResponse>;
}

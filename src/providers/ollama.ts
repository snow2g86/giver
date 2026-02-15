import { v4 as uuid } from "uuid";
import type { AiProvider } from "./provider.js";
import type {
  ToolDefinition,
  MessageParam,
  GenerateResponse,
  ContentBlock,
  TextContent,
  ToolUseContent,
  ToolResultContent,
} from "../core/types.js";

interface OllamaMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: OllamaToolCall[];
}

interface OllamaToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

interface OllamaTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

interface OllamaChatResponse {
  message: {
    role: string;
    content: string;
    tool_calls?: OllamaToolCall[];
  };
  done: boolean;
}

export class OllamaProvider implements AiProvider {
  name = "ollama";
  private baseUrl: string;

  constructor(baseUrl = "http://localhost:11434") {
    this.baseUrl = baseUrl;
  }

  async generate(params: {
    model: string;
    maxTokens: number;
    system: string;
    tools: ToolDefinition[];
    messages: MessageParam[];
  }): Promise<GenerateResponse> {
    const ollamaMessages = this.convertMessages(params.system, params.messages);
    const ollamaTools = this.convertTools(params.tools);

    const body: Record<string, unknown> = {
      model: params.model,
      messages: ollamaMessages,
      stream: false,
      options: {
        num_predict: params.maxTokens,
      },
    };

    if (ollamaTools.length > 0) {
      body.tools = ollamaTools;
    }

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama API error (${res.status}): ${text}`);
    }

    const data = (await res.json()) as OllamaChatResponse;
    return this.convertResponse(data);
  }

  private convertMessages(
    system: string,
    messages: MessageParam[]
  ): OllamaMessage[] {
    const result: OllamaMessage[] = [{ role: "system", content: system }];

    for (const msg of messages) {
      if (typeof msg.content === "string") {
        result.push({ role: msg.role, content: msg.content });
      } else if (Array.isArray(msg.content)) {
        // tool_result 배열인 경우
        if (msg.content.length > 0 && "tool_use_id" in msg.content[0]) {
          for (const block of msg.content as ToolResultContent[]) {
            result.push({
              role: "tool",
              content: block.content,
            });
          }
        } else {
          // ContentBlock 배열 (assistant 응답)
          const blocks = msg.content as ContentBlock[];
          const textParts: string[] = [];
          const toolCalls: OllamaToolCall[] = [];

          for (const block of blocks) {
            if (block.type === "text") {
              textParts.push(block.text);
            } else if (block.type === "tool_use") {
              toolCalls.push({
                function: {
                  name: block.name,
                  arguments: block.input,
                },
              });
            }
          }

          const ollamaMsg: OllamaMessage = {
            role: "assistant",
            content: textParts.join("\n"),
          };
          if (toolCalls.length > 0) {
            ollamaMsg.tool_calls = toolCalls;
          }
          result.push(ollamaMsg);
        }
      }
    }

    return result;
  }

  private convertTools(tools: ToolDefinition[]): OllamaTool[] {
    return tools.map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: {
          type: t.input_schema.type,
          properties: t.input_schema.properties,
          required: t.input_schema.required,
        },
      },
    }));
  }

  private convertResponse(data: OllamaChatResponse): GenerateResponse {
    const content: ContentBlock[] = [];

    // tool_call 텍스트 폴백 파싱 시도
    const toolCalls = data.message.tool_calls;
    const hasNativeToolCalls = toolCalls && toolCalls.length > 0;

    if (data.message.content) {
      // 네이티브 tool call이 없으면 텍스트에서 <tool_call> 파싱 시도
      if (!hasNativeToolCalls) {
        const parsed = this.parseToolCallsFromText(data.message.content);
        if (parsed.toolUses.length > 0) {
          if (parsed.remainingText.trim()) {
            content.push({ type: "text", text: parsed.remainingText.trim() });
          }
          content.push(...parsed.toolUses);
          return { content, stopReason: "tool_use" };
        }
      }
      content.push({ type: "text", text: data.message.content });
    }

    if (hasNativeToolCalls) {
      for (const tc of toolCalls!) {
        content.push({
          type: "tool_use",
          id: uuid(),
          name: tc.function.name,
          input: tc.function.arguments,
        });
      }
      return { content, stopReason: "tool_use" };
    }

    return { content, stopReason: "end_turn" };
  }

  private parseToolCallsFromText(text: string): {
    toolUses: ToolUseContent[];
    remainingText: string;
  } {
    const toolUses: ToolUseContent[] = [];
    const regex =
      /<tool_call>\s*\{?\s*"name"\s*:\s*"([^"]+)"\s*,\s*"arguments"\s*:\s*(\{[^}]*\})\s*\}?\s*<\/tool_call>/g;
    const remainingText = text.replace(regex, "");

    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      try {
        const args = JSON.parse(match[2]);
        toolUses.push({
          type: "tool_use",
          id: uuid(),
          name: match[1],
          input: args,
        });
      } catch {
        // JSON 파싱 실패 시 무시
      }
    }

    return { toolUses, remainingText };
  }
}

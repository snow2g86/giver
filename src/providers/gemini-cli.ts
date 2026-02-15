import { spawn } from "node:child_process";
import { v4 as uuid } from "uuid";
import type { AiProvider } from "./provider.js";
import type {
  ToolDefinition,
  MessageParam,
  GenerateResponse,
  ContentBlock,
  ToolUseContent,
  ToolResultContent,
} from "../core/types.js";

export class GeminiCliProvider implements AiProvider {
  name = "gemini-cli";

  async generate(params: {
    model: string;
    maxTokens: number;
    system: string;
    tools: ToolDefinition[];
    messages: MessageParam[];
  }): Promise<GenerateResponse> {
    const prompt = this.buildPrompt(params);
    const raw = await this.runGemini(prompt, params.model);
    return this.parseResponse(raw);
  }

  private buildPrompt(params: {
    system: string;
    tools: ToolDefinition[];
    messages: MessageParam[];
  }): string {
    const parts: string[] = [];

    // 시스템 프롬프트 + 도구 프로토콜
    parts.push(params.system);
    parts.push("");

    if (params.tools.length > 0) {
      parts.push("## Available Tools");
      parts.push(
        "To use a tool, respond with a <tool_call> block in this exact format:"
      );
      parts.push(
        '<tool_call>{"name": "tool_name", "arguments": {"arg": "value"}}</tool_call>'
      );
      parts.push("You can use multiple tool calls in one response.");
      parts.push("");

      for (const tool of params.tools) {
        parts.push(`### ${tool.name}`);
        parts.push(tool.description);
        parts.push(`Parameters: ${JSON.stringify(tool.input_schema)}`);
        parts.push("");
      }
    }

    // 대화 이력을 직렬화
    parts.push("## Conversation");
    for (const msg of params.messages) {
      if (typeof msg.content === "string") {
        parts.push(`[${msg.role}]: ${msg.content}`);
      } else if (Array.isArray(msg.content)) {
        if (msg.content.length > 0 && "tool_use_id" in msg.content[0]) {
          for (const block of msg.content as ToolResultContent[]) {
            const prefix = block.is_error ? "[tool_error]" : "[tool_result]";
            parts.push(`${prefix}: ${block.content}`);
          }
        } else {
          for (const block of msg.content as ContentBlock[]) {
            if (block.type === "text") {
              parts.push(`[assistant]: ${block.text}`);
            } else if (block.type === "tool_use") {
              parts.push(
                `[assistant used tool]: ${block.name}(${JSON.stringify(block.input)})`
              );
            }
          }
        }
      }
    }

    return parts.join("\n");
  }

  private runGemini(prompt: string, model: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = ["-p", "-"];

      if (model) {
        args.push("--model", model);
      }

      const child = spawn("gemini", args, {
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on("error", (err) => {
        reject(new Error(`Failed to spawn gemini CLI: ${err.message}`));
      });

      child.on("close", (code) => {
        if (code !== 0 && !stdout.trim()) {
          reject(
            new Error(
              `gemini CLI exited with code ${code}: ${stderr || "(no output)"}`
            )
          );
        } else {
          resolve(stdout);
        }
      });

      child.stdin.write(prompt);
      child.stdin.end();
    });
  }

  private parseResponse(raw: string): GenerateResponse {
    const content: ContentBlock[] = [];
    const toolUses = this.parseToolCalls(raw);

    if (toolUses.length > 0) {
      const cleaned = raw
        .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "")
        .trim();

      if (cleaned) {
        content.push({ type: "text", text: cleaned });
      }
      content.push(...toolUses);
      return { content, stopReason: "tool_use" };
    }

    content.push({ type: "text", text: raw.trim() });
    return { content, stopReason: "end_turn" };
  }

  private parseToolCalls(text: string): ToolUseContent[] {
    const results: ToolUseContent[] = [];
    const regex = /<tool_call>([\s\S]*?)<\/tool_call>/g;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      try {
        const inner = match[1].trim();
        const parsed = JSON.parse(inner);
        results.push({
          type: "tool_use",
          id: uuid(),
          name: parsed.name,
          input: parsed.arguments || {},
        });
      } catch {
        // JSON 파싱 실패 시 무시
      }
    }

    return results;
  }
}

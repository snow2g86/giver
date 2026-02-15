import chalk from "chalk";
import { getConfig } from "./config.js";
import type {
  MessageParam,
  TextContent,
  ToolUseContent,
  ToolResultContent,
} from "./types.js";
import type { AiProvider } from "../providers/provider.js";
import { ToolRegistry } from "../tools/registry.js";

export class Agent {
  private provider: AiProvider;
  private registry: ToolRegistry;
  private conversationHistory: MessageParam[] = [];
  private systemPrompt: string;

  constructor(provider: AiProvider, registry: ToolRegistry, systemPrompt?: string) {
    this.provider = provider;
    this.registry = registry;
    this.systemPrompt =
      systemPrompt ||
      `You are Giver, a helpful personal AI assistant. You run locally on the user's machine and can use tools to help with tasks.

You have access to the local file system (within allowed paths), can execute shell commands, and help with various tasks.

Guidelines:
- Be concise and helpful
- Use tools when needed to accomplish tasks
- If a tool fails, explain the error and suggest alternatives
- For file operations, always use absolute paths when possible
- Respect the sandbox boundaries - don't try to access files outside allowed paths`;
  }

  setProvider(provider: AiProvider): void {
    this.provider = provider;
  }

  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
  }

  getHistory(): MessageParam[] {
    return this.conversationHistory;
  }

  clearHistory(): void {
    this.conversationHistory = [];
  }

  loadHistory(history: MessageParam[]): void {
    this.conversationHistory = history;
  }

  async chat(userMessage: string): Promise<string> {
    const config = getConfig();

    this.conversationHistory.push({
      role: "user",
      content: userMessage,
    });

    let rounds = 0;
    const maxRounds = config.maxToolRounds;

    while (rounds < maxRounds) {
      rounds++;

      const response = await this.provider.generate({
        model: config.provider.model,
        maxTokens: config.maxTokens,
        system: this.systemPrompt,
        tools: this.registry.toToolDefinitions(),
        messages: this.conversationHistory,
      });

      const assistantContent = response.content;

      this.conversationHistory.push({
        role: "assistant",
        content: assistantContent,
      });

      // tool_use가 아니면 텍스트 반환
      if (response.stopReason !== "tool_use") {
        const textBlocks = assistantContent.filter(
          (b): b is TextContent => b.type === "text"
        );
        return textBlocks.map((b) => b.text).join("\n");
      }

      // 도구 호출 처리
      const toolUseBlocks = assistantContent.filter(
        (b): b is ToolUseContent => b.type === "tool_use"
      );

      const toolResults: ToolResultContent[] = [];

      for (const toolUse of toolUseBlocks) {
        console.log(
          chalk.dim(`  ⚙ ${toolUse.name}(${JSON.stringify(toolUse.input).slice(0, 80)}...)`)
        );

        try {
          const result = await this.registry.execute(
            toolUse.name,
            toolUse.input
          );
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: result.slice(0, 50_000),
          });
        } catch (err) {
          const errorMsg =
            err instanceof Error ? err.message : String(err);
          console.log(chalk.red(`  ✗ ${toolUse.name}: ${errorMsg}`));
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: `Error: ${errorMsg}`,
            is_error: true,
          });
        }
      }

      this.conversationHistory.push({
        role: "user",
        content: toolResults,
      });
    }

    return "(Maximum tool rounds reached. Please try again with a simpler request.)";
  }
}

import "dotenv/config";
import chalk from "chalk";
import { Agent } from "./core/agent.js";
import { loadConfig, isFirstRun, saveConfig } from "./core/config.js";
import { runSetupWizard, runModelSwitch } from "./core/setup.js";
import { ToolRegistry } from "./tools/registry.js";
import { readFileTool, writeFileTool, listDirectoryTool } from "./tools/file.js";
import { shellTool } from "./tools/shell.js";
import { webSearchTool } from "./tools/web-search.js";
import { browseUrlTool, browserActionTool, closeBrowser } from "./tools/browser.js";
import { saveMemoryTool, recallMemoryTool } from "./memory/store.js";
import { getMemorySummary } from "./memory/store.js";
import { createSelfUpdateTools } from "./tools/self-update.js";
import { loadCustomTools } from "./tools/dynamic-loader.js";
import { getPreferenceSummary } from "./memory/preferences.js";
import { getRecentConversations, saveConversationEntry } from "./memory/conversation.js";
import { CliChannel, createCliPrompter } from "./channels/cli.js";
import { TelegramChannel, createTelegramPrompter } from "./channels/telegram.js";
import { PathGuard } from "./sandbox/path-guard.js";
import type { AiProvider } from "./providers/provider.js";
import { OllamaProvider } from "./providers/ollama.js";
import { ClaudeCliProvider } from "./providers/claude-cli.js";
import { GeminiCliProvider } from "./providers/gemini-cli.js";
import type { ProviderConfig } from "./core/types.js";
import { initLocale, t } from "./core/i18n.js";

function createProvider(config: ProviderConfig): AiProvider {
  switch (config.type) {
    case "ollama":
      return new OllamaProvider(config.ollamaBaseUrl);
    case "claude-cli":
      return new ClaudeCliProvider();
    case "gemini-cli":
      return new GeminiCliProvider();
    default:
      throw new Error(`Unknown provider type: ${config.type}`);
  }
}

function buildSystemPrompt(): string {
  const memorySummary = getMemorySummary();
  const prefsSummary = getPreferenceSummary();
  const recentConvos = getRecentConversations(5);

  const recentContext =
    recentConvos.length > 0
      ? recentConvos
          .map((c) => `[${c.role}] ${c.content.slice(0, 200)}`)
          .join("\n")
      : "(no recent conversations)";

  return `You are Giver, a helpful personal AI assistant running locally on the user's machine.

## Capabilities
- File operations (read, write, list) within allowed paths
- Shell command execution (sandboxed)
- Web search (SearXNG — local meta search engine)
- Web browsing with headless Chromium (browse URLs, click, type, evaluate JS)
- Long-term memory (save and recall facts across sessions)

## Guidelines
- Be concise and helpful
- Use tools when needed — don't just describe what you would do, actually do it
- For file operations, use absolute paths
- Respect sandbox boundaries
- Save important information to memory for future reference
- Respond in the same language the user uses

## Self-Update
- If no existing tool can handle the user's request, use create_tool to make a new one and then use it immediately
- Custom tools persist across sessions and are auto-loaded on startup
- Use list_tools to see all available tools, and remove_tool to delete custom tools you no longer need

## Skill Learning
- When given a skill document URL (e.g. skill.md, API docs), browse it, understand the API, and use create_tool to build the necessary tools
- Save the learned skill reference to memory so you don't have to fetch it every session
- For API keys: if registration is needed, handle it via the API, then append the key to the .env file and inform the user of any verification steps
- SECURITY: Only send API keys/tokens to their respective service domains — never to any other domain
- Known skills:
  - Moltbook (AI agent social network): https://moltbook.com/skill.md — env key: MOLTBOOK_API_KEY

## User Context
### Long-term Memory
${memorySummary}

### User Preferences
${prefsSummary}

### Recent Conversations
${recentContext}`;
}

class AgentWithMemory extends Agent {
  async chat(userMessage: string): Promise<string> {
    saveConversationEntry("user", userMessage);
    const response = await super.chat(userMessage);
    saveConversationEntry("assistant", response);
    return response;
  }
}

async function main() {
  // Initialize locale from system environment
  initLocale();

  // First run → interactive setup wizard
  if (isFirstRun()) {
    const providerConfig = await runSetupWizard();
    const config = loadConfig();
    config.provider = providerConfig;
    config.setupComplete = true;
    saveConfig(config);
  }

  // Load configuration
  const config = loadConfig();

  // Create provider
  const provider = createProvider(config.provider);
  console.log(chalk.dim(`Provider: ${provider.name} (${config.provider.model})`));

  // Setup tool registry
  const registry = new ToolRegistry();
  registry.register(readFileTool);
  registry.register(writeFileTool);
  registry.register(listDirectoryTool);
  registry.register(shellTool);
  registry.register(webSearchTool);
  registry.register(browseUrlTool);
  registry.register(browserActionTool);
  registry.register(saveMemoryTool);
  registry.register(recallMemoryTool);

  // Self-update meta tools
  const selfUpdateTools = createSelfUpdateTools(registry);
  selfUpdateTools.forEach((tool) => registry.register(tool));

  // Load persisted custom tools from data/tools/
  const customCount = await loadCustomTools(registry);
  if (customCount > 0) {
    console.log(chalk.dim(t("index.customToolsLoaded", String(customCount))));
  }

  // Single agent shared across CLI and Telegram (personal assistant = one user)
  const agent = new AgentWithMemory(provider, registry, buildSystemPrompt());

  // /model command handler — switches provider at runtime
  const handleModelSwitch = async (rl: import("node:readline").Interface) => {
    const newProviderConfig = await runModelSwitch(rl);
    if (!newProviderConfig) return;

    const newProvider = createProvider(newProviderConfig);
    agent.setProvider(newProvider);

    const cfg = loadConfig();
    cfg.provider = newProviderConfig;
    saveConfig(cfg);

    console.log(chalk.dim(`Provider: ${newProvider.name} (${newProviderConfig.model})`));
  };

  // Parse CLI args
  const args = process.argv.slice(2);
  const useTelegram = args.includes("--telegram");

  // Graceful shutdown
  const cleanup = async () => {
    console.log(chalk.dim("\n" + t("index.shuttingDown")));
    await closeBrowser();
    process.exit(0);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  const cliOptions = { onModelSwitch: handleModelSwitch };

  const pathGuard = PathGuard.getInstance();

  if (useTelegram) {
    // CLI and Telegram share the same agent (continuous conversation)
    const telegram = new TelegramChannel(agent);
    const cli = new CliChannel(agent, cliOptions);

    // Telegram 프롬프터 설정
    const telegramPrompter = createTelegramPrompter(
      telegram.getBot(),
      () => telegram.getLastChatId()
    );
    pathGuard.setPrompter(telegramPrompter);

    // Start telegram in background
    telegram.start().catch((err) => {
      console.error(chalk.red("Telegram error:"), err.message);
    });

    // CLI as main loop
    await cli.start();
  } else {
    // CLI only — CLI 프롬프터 설정
    pathGuard.setPrompter(createCliPrompter());

    const cli = new CliChannel(agent, cliOptions);
    await cli.start();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

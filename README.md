🌐 [English](README.md) | [한국어](docs/README.ko.md) | [日本語](docs/README.ja.md) | [中文](docs/README.zh.md) | [Español](docs/README.es.md) | [Français](docs/README.fr.md) | [Deutsch](docs/README.de.md) | [Italiano](docs/README.it.md)

# Giver — Personal AI Assistant

A personal AI assistant that runs locally. Supports multiple providers (Ollama, Claude CLI, Gemini CLI) with an agent loop for file management, shell commands, and web search/automation.

## Quick Start

```bash
# Install dependencies
npm install

# Run CLI (interactive setup wizard launches on first run)
npm run dev

# Run with Telegram bot
npm run telegram
```

On first run, the setup wizard guides you through AI provider selection, model download, and SearXNG search engine configuration.

## Providers

| Provider | Description | Notes |
|----------|-------------|-------|
| **Ollama** | Local LLM (qwen3, llama3.1, etc.) | Default, no API key needed |
| **Claude CLI** | Anthropic Claude (via `claude` CLI) | `npm i -g @anthropic-ai/claude-code` |
| **Gemini CLI** | Google Gemini (via `gemini` CLI) | Free 1,000 requests/day |

Switch providers at runtime with the `/model` command.

## Features

| Feature | Tools | Description |
|---------|-------|-------------|
| File Management | `read_file`, `write_file`, `list_directory` | Read/write/list files within sandbox |
| Shell Commands | `execute_command` | Dangerous commands blocked, path restricted |
| Web Search | `web_search` | SearXNG-based local meta search (Docker) |
| Web Automation | `browse_url`, `browser_action` | Playwright headless browser |
| Long-term Memory | `save_memory`, `recall_memory` | Persist information across sessions |
| Custom Tools | `create_tool`, `list_tools`, `remove_tool` | Create/manage new tools at runtime |

## Self-Update

When no existing tool can handle a request, the AI creates a new tool using `create_tool` and uses it immediately. Custom tools are saved to `data/tools/` and auto-loaded in subsequent sessions.

## Security

- **Whitelist-based access**: Only folders listed in `allowedPaths` of `data/config/giver.config.json` are accessible
- **Path traversal prevention**: Symlinks resolved before validation, `..` escape blocked
- **Dangerous command blocking**: `sudo`, `rm -rf /`, `mkfs`, `shutdown`, etc. blocked

## Configuration

`data/config/giver.config.json`:

```json
{
  "allowedPaths": ["/Users/you/workspace/giver"],
  "blockedCommands": ["sudo", "rm -rf /", "mkfs", "shutdown", "..."],
  "maxTokens": 8192,
  "maxToolRounds": 20,
  "provider": {
    "type": "ollama",
    "model": "qwen3:8b",
    "ollamaBaseUrl": "http://localhost:11434"
  },
  "telegram": {
    "allowedUsers": []
  }
}
```

`provider.type` accepts `"ollama"`, `"claude-cli"`, or `"gemini-cli"`.

## Web Search (SearXNG)

Web search uses a locally-running SearXNG meta search engine.

```bash
# Start SearXNG (requires Docker)
docker compose up -d

# Or auto-configured during first-run setup wizard
```

SearXNG runs at `http://localhost:8080` and aggregates results from multiple search engines.

## Telegram Bot

1. Get a bot token from [@BotFather](https://t.me/BotFather)
2. Add `TELEGRAM_BOT_TOKEN=your-token` to `.env`
3. Add user IDs to `telegram.allowedUsers` in `giver.config.json`
4. Run with `npm run telegram`

## i18n

Automatically detects system locale (`LANG`) and displays UI in 8 languages: English, Korean, Japanese, Chinese, Spanish, French, German, and Italian.

## Architecture

```
[User] → [Channel(CLI/Telegram)] → [Agent Loop] → [Provider(Ollama/Claude/Gemini)]
                                        ↓                     ↓
                                  [ToolRegistry]        [generate response]
                                   ↓        ↓
                          [Built-in]  [Custom Tools]
                          ↓    ↓    ↓       (data/tools/)
                     File Shell Browser
                     WebSearch Memory
                          ↓
                    [PathGuard] ← sandbox
                          ↓
                    [tool_result → Provider → final response]
```

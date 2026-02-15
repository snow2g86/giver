🌐 [English](../README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [中文](README.zh.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Italiano](README.it.md)

# Giver — 个人AI助手

在本地运行的个人AI助手。支持多种提供商（Ollama、Claude CLI、Gemini CLI），通过代理循环执行文件管理、Shell命令、网络搜索和自动化操作。

## 快速开始

```bash
# 安装依赖
npm install

# 运行CLI（首次运行时将自动启动交互式设置向导）
npm run dev

# 与Telegram机器人一起运行
npm run telegram
```

首次运行时，设置向导将引导您完成AI提供商选择、模型下载和SearXNG搜索引擎配置。

## 提供商

| 提供商 | 描述 | 备注 |
|--------|------|------|
| **Ollama** | 本地LLM（qwen3、llama3.1等） | 默认，无需API密钥 |
| **Claude CLI** | Anthropic Claude（使用 `claude` CLI） | `npm i -g @anthropic-ai/claude-code` |
| **Gemini CLI** | Google Gemini（使用 `gemini` CLI） | 免费 1,000次/天 |

运行时可通过 `/model` 命令切换提供商。

## 功能

| 功能 | 工具 | 描述 |
|------|------|------|
| 文件管理 | `read_file`, `write_file`, `list_directory` | 在沙盒内读写/列出文件 |
| Shell命令 | `execute_command` | 阻止危险命令，路径限制 |
| 网络搜索 | `web_search` | 基于SearXNG的本地元搜索（Docker） |
| 网络自动化 | `browse_url`, `browser_action` | Playwright无头浏览器 |
| 长期记忆 | `save_memory`, `recall_memory` | 跨会话保持信息 |
| 自定义工具 | `create_tool`, `list_tools`, `remove_tool` | 在运行时创建/管理新工具 |

## 自我更新

当现有工具无法处理请求时，AI会使用 `create_tool` 创建新工具并立即使用。创建的自定义工具保存在 `data/tools/` 中，在后续会话中自动加载。

## 安全

- **白名单访问控制**：仅可访问 `data/config/giver.config.json` 中 `allowedPaths` 指定的文件夹
- **路径遍历防护**：解析符号链接后验证，阻止 `..` 逃逸
- **危险命令拦截**：拦截 `sudo`、`rm -rf /`、`mkfs`、`shutdown` 等命令

## 配置

`data/config/giver.config.json`：

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

`provider.type` 可选 `"ollama"`、`"claude-cli"` 或 `"gemini-cli"`。

## 网络搜索（SearXNG）

网络搜索使用本地运行的SearXNG元搜索引擎。

```bash
# 启动SearXNG（需要Docker）
docker compose up -d

# 或在首次运行设置向导中自动配置
```

SearXNG在 `http://localhost:8080` 运行，聚合多个搜索引擎的结果。

## Telegram机器人

1. 从 [@BotFather](https://t.me/BotFather) 获取机器人令牌
2. 在 `.env` 中添加 `TELEGRAM_BOT_TOKEN=your-token`
3. 在 `giver.config.json` 的 `telegram.allowedUsers` 中添加用户ID
4. 使用 `npm run telegram` 运行

## 国际化

自动检测系统语言环境（`LANG`），支持8种语言显示UI：英语、韩语、日语、中文、西班牙语、法语、德语和意大利语。

## 架构

```
[用户] → [通道(CLI/Telegram)] → [代理循环] → [提供商(Ollama/Claude/Gemini)]
                                     ↓                    ↓
                               [工具注册表]           [生成响应]
                                ↓        ↓
                          [内置工具]  [自定义工具]
                          ↓    ↓    ↓    (data/tools/)
                       文件 Shell 浏览器
                       网络搜索 记忆
                          ↓
                    [PathGuard] ← 沙盒
                          ↓
                    [工具结果 → 提供商 → 最终响应]
```

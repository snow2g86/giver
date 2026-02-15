🌐 [English](../README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [中文](README.zh.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Italiano](README.it.md)

# Giver — パーソナルAIアシスタント

ローカルで動作するパーソナルAIアシスタント。マルチプロバイダー（Ollama、Claude CLI、Gemini CLI）をサポートし、エージェントループでファイル管理、シェルコマンド、Web検索/自動化を行います。

## クイックスタート

```bash
# 依存関係のインストール
npm install

# CLI実行（初回起動時に対話式セットアップウィザードが自動起動します）
npm run dev

# Telegramボットと一緒に実行
npm run telegram
```

初回起動時、セットアップウィザードがAIプロバイダーの選択、モデルのダウンロード、SearXNG検索エンジンの設定を案内します。

## プロバイダー

| プロバイダー | 説明 | 備考 |
|------------|------|------|
| **Ollama** | ローカルLLM（qwen3、llama3.1など） | デフォルト、APIキー不要 |
| **Claude CLI** | Anthropic Claude（`claude` CLI使用） | `npm i -g @anthropic-ai/claude-code` |
| **Gemini CLI** | Google Gemini（`gemini` CLI使用） | 無料 1,000回/日 |

実行中に `/model` コマンドでプロバイダーを切り替えられます。

## 機能

| 機能 | ツール | 説明 |
|------|--------|------|
| ファイル管理 | `read_file`, `write_file`, `list_directory` | サンドボックス内のファイル読み書き/一覧 |
| シェルコマンド | `execute_command` | 危険なコマンドをブロック、パス制限 |
| Web検索 | `web_search` | SearXNGベースのローカルメタ検索（Docker） |
| Web自動化 | `browse_url`, `browser_action` | Playwrightヘッドレスブラウザ |
| 長期メモリ | `save_memory`, `recall_memory` | セッション間で情報を保持 |
| カスタムツール | `create_tool`, `list_tools`, `remove_tool` | ランタイムで新しいツールを作成/管理 |

## セルフアップデート

既存のツールで処理できないリクエストを受けると、AIが `create_tool` で新しいツールを作成してすぐに使用します。作成されたカスタムツールは `data/tools/` に保存され、次のセッションでも自動ロードされます。

## セキュリティ

- **ホワイトリストベースのアクセス**: `data/config/giver.config.json` の `allowedPaths` に指定されたフォルダのみアクセス可能
- **パストラバーサル防止**: シンボリックリンク解決後に検証、`..` エスケープ不可
- **危険なコマンドのブロック**: `sudo`、`rm -rf /`、`mkfs`、`shutdown` などをブロック

## 設定

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

`provider.type` は `"ollama"`、`"claude-cli"`、`"gemini-cli"` から選択できます。

## Web検索（SearXNG）

Web検索はローカルで動作するSearXNGメタ検索エンジンを使用します。

```bash
# SearXNG起動（Docker必要）
docker compose up -d

# または初回セットアップウィザードで自動構成
```

SearXNGは `http://localhost:8080` で実行され、複数の検索エンジンの結果を集約します。

## Telegramボット

1. [@BotFather](https://t.me/BotFather)でボットトークンを取得
2. `.env` に `TELEGRAM_BOT_TOKEN=your-token` を追加
3. `giver.config.json` の `telegram.allowedUsers` にユーザーIDを追加
4. `npm run telegram` で実行

## 多言語対応

システムロケール（`LANG`）を自動検出し、8言語（英語、韓国語、日本語、中国語、スペイン語、フランス語、ドイツ語、イタリア語）でUIを表示します。

## アーキテクチャ

```
[ユーザー] → [チャネル(CLI/Telegram)] → [エージェントループ] → [プロバイダー(Ollama/Claude/Gemini)]
                                              ↓                         ↓
                                        [ツールレジストリ]          [レスポンス生成]
                                         ↓        ↓
                                [組み込み]  [カスタムツール]
                                ↓    ↓    ↓     (data/tools/)
                           ファイル シェル ブラウザ
                           Web検索 メモリ
                                ↓
                          [PathGuard] ← サンドボックス
                                ↓
                          [ツール結果 → プロバイダー → 最終レスポンス]
```

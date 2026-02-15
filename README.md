# Giver — Personal AI Assistant

로컬에서 실행되는 개인 AI 어시스턴트. Claude API tool use를 활용한 에이전트 루프로 파일 관리, 셸 명령, 웹 검색/자동화를 수행합니다.

## Quick Start

```bash
# 의존성 설치
npm install

# .env 파일에 API 키 설정
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env

# CLI 실행
npm run dev

# Telegram 봇과 함께 실행
npm run telegram
```

## Features

| 기능 | 도구 | 설명 |
|------|------|------|
| 파일 관리 | `read_file`, `write_file`, `list_directory` | 샌드박스 내 파일 읽기/쓰기/목록 |
| 셸 명령 | `execute_command` | 위험 명령 차단, 경로 제한 |
| 웹 검색 | `web_search` | DuckDuckGo 기반 검색 |
| 웹 자동화 | `browse_url`, `browser_action` | Playwright 헤드리스 브라우저 |
| 장기 메모리 | `save_memory`, `recall_memory` | 세션 간 정보 유지 |

## Security

- **화이트리스트 기반 접근**: `data/config/giver.config.json`의 `allowedPaths`에 명시된 폴더만 접근 가능
- **경로 탈출 차단**: 심볼릭 링크 해결 후 검증, `..` 탈출 불가
- **위험 명령 차단**: `sudo`, `rm -rf /` 등 차단

## Configuration

`data/config/giver.config.json`:

```json
{
  "allowedPaths": ["/Users/you/workspace/giver"],
  "blockedCommands": ["sudo", "rm -rf /"],
  "model": "claude-sonnet-4-20250514",
  "maxTokens": 8192,
  "maxToolRounds": 20,
  "telegram": {
    "allowedUsers": []
  }
}
```

## Telegram Bot

1. [@BotFather](https://t.me/BotFather)에서 봇 토큰 발급
2. `.env`에 `TELEGRAM_BOT_TOKEN=your-token` 추가
3. `giver.config.json`의 `telegram.allowedUsers`에 사용자 ID 추가
4. `npm run telegram`으로 실행

## Architecture

```
[User] → [Channel(CLI/Telegram)] → [Agent Loop] → [Claude API]
                                        ↓              ↓
                                  [ToolRegistry]  [tool_use response]
                                        ↓
                            [File|Shell|Browser|WebSearch|Memory]
                                        ↓
                                  [PathGuard] ← sandbox
                                        ↓
                                  [tool_result → Claude → final response]
```

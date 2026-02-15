🌐 [English](../README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [中文](README.zh.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Italiano](README.it.md)

# Giver — 개인 AI 어시스턴트

로컬에서 실행되는 개인 AI 어시스턴트. 멀티 프로바이더(Ollama, Claude CLI, Gemini CLI)를 지원하며, 에이전트 루프로 파일 관리, 셸 명령, 웹 검색/자동화를 수행합니다.

## 빠른 시작

```bash
# 의존성 설치
npm install

# CLI 실행 (첫 실행 시 대화형 설정 위자드가 자동 시작됩니다)
npm run dev

# Telegram 봇과 함께 실행
npm run telegram
```

첫 실행 시 설정 위자드가 AI 프로바이더 선택, 모델 다운로드, SearXNG 검색 엔진 설정을 안내합니다.

## 프로바이더

| 프로바이더 | 설명 | 비고 |
|-----------|------|------|
| **Ollama** | 로컬 LLM (qwen3, llama3.1 등) | 기본값, API 키 불필요 |
| **Claude CLI** | Anthropic Claude (`claude` CLI 사용) | `npm i -g @anthropic-ai/claude-code` |
| **Gemini CLI** | Google Gemini (`gemini` CLI 사용) | 무료 1,000회/일 |

실행 중 `/model` 명령으로 프로바이더를 전환할 수 있습니다.

## 기능

| 기능 | 도구 | 설명 |
|------|------|------|
| 파일 관리 | `read_file`, `write_file`, `list_directory` | 샌드박스 내 파일 읽기/쓰기/목록 |
| 셸 명령 | `execute_command` | 위험 명령 차단, 경로 제한 |
| 웹 검색 | `web_search` | SearXNG 기반 로컬 메타 검색 (Docker) |
| 웹 자동화 | `browse_url`, `browser_action` | Playwright 헤드리스 브라우저 |
| 장기 메모리 | `save_memory`, `recall_memory` | 세션 간 정보 유지 |
| 커스텀 도구 | `create_tool`, `list_tools`, `remove_tool` | 런타임에 새 도구 생성/관리 |

## 자체 업데이트

기존 도구로 처리할 수 없는 요청을 받으면 AI가 `create_tool`로 새 도구를 직접 만들어 사용합니다. 생성된 커스텀 도구는 `data/tools/`에 저장되어 다음 세션에서도 자동 로드됩니다.

## 보안

- **화이트리스트 기반 접근**: `data/config/giver.config.json`의 `allowedPaths`에 명시된 폴더만 접근 가능
- **경로 탈출 차단**: 심볼릭 링크 해결 후 검증, `..` 탈출 불가
- **위험 명령 차단**: `sudo`, `rm -rf /`, `mkfs`, `shutdown` 등 차단

## 설정

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

`provider.type`에 따라 `"ollama"`, `"claude-cli"`, `"gemini-cli"` 중 선택됩니다.

## 웹 검색 (SearXNG)

웹 검색은 로컬에서 실행되는 SearXNG 메타 검색 엔진을 사용합니다.

```bash
# SearXNG 시작 (Docker 필요)
docker compose up -d

# 또는 첫 실행 설정 위자드에서 자동 구성
```

SearXNG는 `http://localhost:8080`에서 실행되며, 여러 검색 엔진의 결과를 집계합니다.

## Telegram 봇

1. [@BotFather](https://t.me/BotFather)에서 봇 토큰 발급
2. `.env`에 `TELEGRAM_BOT_TOKEN=your-token` 추가
3. `giver.config.json`의 `telegram.allowedUsers`에 사용자 ID 추가
4. `npm run telegram`으로 실행

## 다국어 지원

시스템 로케일(`LANG`)을 자동 감지하여 8개 언어(영어, 한국어, 일본어, 중국어, 스페인어, 프랑스어, 독일어, 이탈리아어)로 UI를 표시합니다.

## 아키텍처

```
[사용자] → [채널(CLI/Telegram)] → [에이전트 루프] → [프로바이더(Ollama/Claude/Gemini)]
                                        ↓                       ↓
                                  [도구 레지스트리]         [응답 생성]
                                   ↓        ↓
                          [내장 도구]  [커스텀 도구]
                          ↓    ↓    ↓     (data/tools/)
                     파일 셸 브라우저
                     웹검색 메모리
                          ↓
                    [PathGuard] ← 샌드박스
                          ↓
                    [도구 결과 → 프로바이더 → 최종 응답]
```

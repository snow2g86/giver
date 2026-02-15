🌐 [English](../README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [中文](README.zh.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Italiano](README.it.md)

# Giver — Persoenlicher KI-Assistent

Ein persoenlicher KI-Assistent, der lokal ausgefuehrt wird. Unterstuetzt mehrere Anbieter (Ollama, Claude CLI, Gemini CLI) mit einer Agentenschleife fuer Dateiverwaltung, Shell-Befehle und Websuche/Automatisierung.

## Schnellstart

```bash
# Abhaengigkeiten installieren
npm install

# CLI starten (beim ersten Start wird der Einrichtungsassistent automatisch gestartet)
npm run dev

# Mit Telegram-Bot starten
npm run telegram
```

Beim ersten Start fuehrt der Einrichtungsassistent durch die Auswahl des KI-Anbieters, den Modell-Download und die SearXNG-Suchmaschinen-Konfiguration.

## Anbieter

| Anbieter | Beschreibung | Hinweise |
|----------|-------------|----------|
| **Ollama** | Lokales LLM (qwen3, llama3.1, etc.) | Standard, kein API-Schluessel noetig |
| **Claude CLI** | Anthropic Claude (ueber `claude` CLI) | `npm i -g @anthropic-ai/claude-code` |
| **Gemini CLI** | Google Gemini (ueber `gemini` CLI) | Kostenlos 1.000 Anfragen/Tag |

Wechseln Sie den Anbieter zur Laufzeit mit dem `/model`-Befehl.

## Funktionen

| Funktion | Werkzeuge | Beschreibung |
|----------|-----------|-------------|
| Dateiverwaltung | `read_file`, `write_file`, `list_directory` | Dateien in der Sandbox lesen/schreiben/auflisten |
| Shell-Befehle | `execute_command` | Gefaehrliche Befehle blockiert, Pfad eingeschraenkt |
| Websuche | `web_search` | SearXNG-basierte lokale Metasuche (Docker) |
| Web-Automatisierung | `browse_url`, `browser_action` | Playwright Headless-Browser |
| Langzeitgedaechtnis | `save_memory`, `recall_memory` | Informationen sitzungsuebergreifend speichern |
| Benutzerdefinierte Werkzeuge | `create_tool`, `list_tools`, `remove_tool` | Neue Werkzeuge zur Laufzeit erstellen/verwalten |

## Selbstaktualisierung

Wenn kein vorhandenes Werkzeug eine Anfrage bearbeiten kann, erstellt die KI mit `create_tool` ein neues Werkzeug und verwendet es sofort. Benutzerdefinierte Werkzeuge werden in `data/tools/` gespeichert und in nachfolgenden Sitzungen automatisch geladen.

## Sicherheit

- **Whitelist-basierter Zugriff**: Nur in `allowedPaths` von `data/config/giver.config.json` aufgefuehrte Ordner sind zugaenglich
- **Pfad-Traversal-Verhinderung**: Symbolische Links werden vor der Validierung aufgeloest, `..`-Escape blockiert
- **Blockierung gefaehrlicher Befehle**: `sudo`, `rm -rf /`, `mkfs`, `shutdown` usw. blockiert

## Konfiguration

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

`provider.type` akzeptiert `"ollama"`, `"claude-cli"` oder `"gemini-cli"`.

## Websuche (SearXNG)

Die Websuche verwendet die lokal ausgefuehrte SearXNG-Metasuchmaschine.

```bash
# SearXNG starten (Docker erforderlich)
docker compose up -d

# Oder automatische Konfiguration waehrend des Ersteinrichtungsassistenten
```

SearXNG laeuft unter `http://localhost:8080` und aggregiert Ergebnisse mehrerer Suchmaschinen.

## Telegram-Bot

1. Bot-Token von [@BotFather](https://t.me/BotFather) erhalten
2. `TELEGRAM_BOT_TOKEN=your-token` zu `.env` hinzufuegen
3. Benutzer-IDs zu `telegram.allowedUsers` in `giver.config.json` hinzufuegen
4. Mit `npm run telegram` starten

## Internationalisierung

Erkennt automatisch die Systemsprache (`LANG`) und zeigt die Oberflaeche in 8 Sprachen an: Englisch, Koreanisch, Japanisch, Chinesisch, Spanisch, Franzoesisch, Deutsch und Italienisch.

## Architektur

```
[Benutzer] → [Kanal(CLI/Telegram)] → [Agentenschleife] → [Anbieter(Ollama/Claude/Gemini)]
                                           ↓                        ↓
                                     [Werkzeugregister]       [Antwort generieren]
                                      ↓        ↓
                             [Eingebaut]  [Benutzerdefiniert]
                             ↓    ↓    ↓      (data/tools/)
                        Datei Shell Browser
                        Websuche Speicher
                             ↓
                       [PathGuard] ← Sandbox
                             ↓
                       [Ergebnis → Anbieter → endgueltige Antwort]
```

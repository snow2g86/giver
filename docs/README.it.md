🌐 [English](../README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [中文](README.zh.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Italiano](README.it.md)

# Giver — Assistente IA Personale

Un assistente IA personale che funziona localmente. Supporta piu provider (Ollama, Claude CLI, Gemini CLI) con un ciclo agente per la gestione file, comandi shell e ricerca/automazione web.

## Avvio Rapido

```bash
# Installare le dipendenze
npm install

# Avviare il CLI (la procedura guidata si avvia al primo utilizzo)
npm run dev

# Avviare con il bot Telegram
npm run telegram
```

Al primo avvio, la procedura guidata vi accompagna nella scelta del provider IA, nel download del modello e nella configurazione del motore di ricerca SearXNG.

## Provider

| Provider | Descrizione | Note |
|----------|-------------|------|
| **Ollama** | LLM locale (qwen3, llama3.1, ecc.) | Predefinito, nessuna chiave API necessaria |
| **Claude CLI** | Anthropic Claude (tramite `claude` CLI) | `npm i -g @anthropic-ai/claude-code` |
| **Gemini CLI** | Google Gemini (tramite `gemini` CLI) | Gratuito 1.000 richieste/giorno |

Cambiate provider durante l'esecuzione con il comando `/model`.

## Funzionalita

| Funzione | Strumenti | Descrizione |
|----------|-----------|-------------|
| Gestione file | `read_file`, `write_file`, `list_directory` | Leggere/scrivere/elencare file nella sandbox |
| Comandi shell | `execute_command` | Blocco comandi pericolosi, restrizione percorsi |
| Ricerca web | `web_search` | Meta-ricerca locale basata su SearXNG (Docker) |
| Automazione web | `browse_url`, `browser_action` | Browser headless Playwright |
| Memoria a lungo termine | `save_memory`, `recall_memory` | Mantenere informazioni tra le sessioni |
| Strumenti personalizzati | `create_tool`, `list_tools`, `remove_tool` | Creare/gestire nuovi strumenti a runtime |

## Auto-aggiornamento

Quando nessuno strumento esistente puo gestire una richiesta, l'IA crea un nuovo strumento usando `create_tool` e lo utilizza immediatamente. Gli strumenti personalizzati vengono salvati in `data/tools/` e caricati automaticamente nelle sessioni successive.

## Sicurezza

- **Accesso basato su whitelist**: Solo le cartelle elencate in `allowedPaths` di `data/config/giver.config.json` sono accessibili
- **Prevenzione path traversal**: I link simbolici vengono risolti prima della validazione, escape con `..` bloccato
- **Blocco comandi pericolosi**: `sudo`, `rm -rf /`, `mkfs`, `shutdown`, ecc. bloccati

## Configurazione

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

`provider.type` accetta `"ollama"`, `"claude-cli"` o `"gemini-cli"`.

## Ricerca Web (SearXNG)

La ricerca web utilizza il motore di meta-ricerca SearXNG eseguito localmente.

```bash
# Avviare SearXNG (richiede Docker)
docker compose up -d

# Oppure configurazione automatica durante la procedura guidata iniziale
```

SearXNG funziona su `http://localhost:8080` e aggrega risultati da piu motori di ricerca.

## Bot Telegram

1. Ottenere un token bot da [@BotFather](https://t.me/BotFather)
2. Aggiungere `TELEGRAM_BOT_TOKEN=your-token` a `.env`
3. Aggiungere gli ID utente a `telegram.allowedUsers` in `giver.config.json`
4. Avviare con `npm run telegram`

## Internazionalizzazione

Rileva automaticamente la lingua del sistema (`LANG`) e visualizza l'interfaccia in 8 lingue: inglese, coreano, giapponese, cinese, spagnolo, francese, tedesco e italiano.

## Architettura

```
[Utente] → [Canale(CLI/Telegram)] → [Ciclo Agente] → [Provider(Ollama/Claude/Gemini)]
                                          ↓                       ↓
                                    [Registro Strumenti]    [Genera risposta]
                                     ↓        ↓
                            [Integrati]  [Personalizzati]
                            ↓    ↓    ↓     (data/tools/)
                       File Shell Browser
                       Ricerca Memoria
                            ↓
                      [PathGuard] ← sandbox
                            ↓
                      [risultato → Provider → risposta finale]
```

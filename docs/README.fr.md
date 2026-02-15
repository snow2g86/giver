🌐 [English](../README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [中文](README.zh.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Italiano](README.it.md)

# Giver — Assistant IA Personnel

Un assistant IA personnel qui s'execute localement. Supporte plusieurs fournisseurs (Ollama, Claude CLI, Gemini CLI) avec une boucle d'agent pour la gestion de fichiers, les commandes shell et la recherche/automatisation web.

## Demarrage Rapide

```bash
# Installer les dependances
npm install

# Lancer le CLI (l'assistant de configuration demarre au premier lancement)
npm run dev

# Lancer avec le bot Telegram
npm run telegram
```

Au premier lancement, l'assistant de configuration vous guide dans le choix du fournisseur IA, le telechargement du modele et la configuration du moteur de recherche SearXNG.

## Fournisseurs

| Fournisseur | Description | Notes |
|-------------|-------------|-------|
| **Ollama** | LLM local (qwen3, llama3.1, etc.) | Par defaut, pas de cle API requise |
| **Claude CLI** | Anthropic Claude (via `claude` CLI) | `npm i -g @anthropic-ai/claude-code` |
| **Gemini CLI** | Google Gemini (via `gemini` CLI) | Gratuit 1 000 requetes/jour |

Changez de fournisseur en cours d'execution avec la commande `/model`.

## Fonctionnalites

| Fonction | Outils | Description |
|----------|--------|-------------|
| Gestion de fichiers | `read_file`, `write_file`, `list_directory` | Lire/ecrire/lister les fichiers dans le sandbox |
| Commandes shell | `execute_command` | Blocage des commandes dangereuses, restriction de chemin |
| Recherche web | `web_search` | Meta-recherche locale basee sur SearXNG (Docker) |
| Automatisation web | `browse_url`, `browser_action` | Navigateur headless Playwright |
| Memoire a long terme | `save_memory`, `recall_memory` | Conserver les informations entre les sessions |
| Outils personnalises | `create_tool`, `list_tools`, `remove_tool` | Creer/gerer de nouveaux outils en cours d'execution |

## Auto-mise a jour

Lorsqu'aucun outil existant ne peut traiter une requete, l'IA cree un nouvel outil avec `create_tool` et l'utilise immediatement. Les outils personnalises sont sauvegardes dans `data/tools/` et charges automatiquement lors des sessions suivantes.

## Securite

- **Acces base sur liste blanche** : Seuls les dossiers listes dans `allowedPaths` de `data/config/giver.config.json` sont accessibles
- **Prevention de traversee de chemin** : Liens symboliques resolus avant validation, echappement `..` bloque
- **Blocage de commandes dangereuses** : `sudo`, `rm -rf /`, `mkfs`, `shutdown`, etc. bloques

## Configuration

`data/config/giver.config.json` :

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

`provider.type` accepte `"ollama"`, `"claude-cli"` ou `"gemini-cli"`.

## Recherche Web (SearXNG)

La recherche web utilise le moteur de meta-recherche SearXNG execute localement.

```bash
# Demarrer SearXNG (Docker requis)
docker compose up -d

# Ou configuration automatique lors de l'assistant de premier lancement
```

SearXNG s'execute sur `http://localhost:8080` et agrege les resultats de plusieurs moteurs de recherche.

## Bot Telegram

1. Obtenez un jeton de bot aupres de [@BotFather](https://t.me/BotFather)
2. Ajoutez `TELEGRAM_BOT_TOKEN=your-token` a `.env`
3. Ajoutez les IDs utilisateur a `telegram.allowedUsers` dans `giver.config.json`
4. Lancez avec `npm run telegram`

## Internationalisation

Detecte automatiquement la locale du systeme (`LANG`) et affiche l'interface en 8 langues : anglais, coreen, japonais, chinois, espagnol, francais, allemand et italien.

## Architecture

```
[Utilisateur] → [Canal(CLI/Telegram)] → [Boucle d'Agent] → [Fournisseur(Ollama/Claude/Gemini)]
                                              ↓                         ↓
                                       [Registre d'Outils]      [Generer reponse]
                                        ↓        ↓
                               [Integres]  [Personnalises]
                               ↓    ↓    ↓     (data/tools/)
                          Fichier Shell Navigateur
                          Recherche Memoire
                               ↓
                         [PathGuard] ← sandbox
                               ↓
                         [resultat → Fournisseur → reponse finale]
```

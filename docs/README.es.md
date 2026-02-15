🌐 [English](../README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [中文](README.zh.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Italiano](README.it.md)

# Giver — Asistente IA Personal

Un asistente IA personal que se ejecuta localmente. Soporta multiples proveedores (Ollama, Claude CLI, Gemini CLI) con un bucle de agente para gestion de archivos, comandos shell y busqueda/automatizacion web.

## Inicio Rapido

```bash
# Instalar dependencias
npm install

# Ejecutar CLI (el asistente de configuracion se inicia en la primera ejecucion)
npm run dev

# Ejecutar con bot de Telegram
npm run telegram
```

En la primera ejecucion, el asistente de configuracion le guia en la seleccion del proveedor IA, descarga del modelo y configuracion del motor de busqueda SearXNG.

## Proveedores

| Proveedor | Descripcion | Notas |
|-----------|-------------|-------|
| **Ollama** | LLM local (qwen3, llama3.1, etc.) | Predeterminado, sin clave API |
| **Claude CLI** | Anthropic Claude (via `claude` CLI) | `npm i -g @anthropic-ai/claude-code` |
| **Gemini CLI** | Google Gemini (via `gemini` CLI) | Gratis 1,000 solicitudes/dia |

Cambie de proveedor en tiempo de ejecucion con el comando `/model`.

## Funcionalidades

| Funcion | Herramientas | Descripcion |
|---------|-------------|-------------|
| Gestion de archivos | `read_file`, `write_file`, `list_directory` | Leer/escribir/listar archivos en el sandbox |
| Comandos shell | `execute_command` | Bloqueo de comandos peligrosos, restriccion de rutas |
| Busqueda web | `web_search` | Meta busqueda local basada en SearXNG (Docker) |
| Automatizacion web | `browse_url`, `browser_action` | Navegador headless Playwright |
| Memoria a largo plazo | `save_memory`, `recall_memory` | Persistir informacion entre sesiones |
| Herramientas personalizadas | `create_tool`, `list_tools`, `remove_tool` | Crear/gestionar nuevas herramientas en tiempo de ejecucion |

## Auto-actualizacion

Cuando ninguna herramienta existente puede manejar una solicitud, la IA crea una nueva herramienta usando `create_tool` y la utiliza inmediatamente. Las herramientas personalizadas se guardan en `data/tools/` y se cargan automaticamente en sesiones posteriores.

## Seguridad

- **Acceso basado en lista blanca**: Solo las carpetas listadas en `allowedPaths` de `data/config/giver.config.json` son accesibles
- **Prevencion de travesia de rutas**: Enlaces simbolicos resueltos antes de la validacion, escape con `..` bloqueado
- **Bloqueo de comandos peligrosos**: `sudo`, `rm -rf /`, `mkfs`, `shutdown`, etc. bloqueados

## Configuracion

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

`provider.type` acepta `"ollama"`, `"claude-cli"` o `"gemini-cli"`.

## Busqueda Web (SearXNG)

La busqueda web utiliza el motor de meta busqueda SearXNG ejecutandose localmente.

```bash
# Iniciar SearXNG (requiere Docker)
docker compose up -d

# O configuracion automatica durante el asistente de primera ejecucion
```

SearXNG se ejecuta en `http://localhost:8080` y agrega resultados de multiples motores de busqueda.

## Bot de Telegram

1. Obtenga un token de bot de [@BotFather](https://t.me/BotFather)
2. Agregue `TELEGRAM_BOT_TOKEN=your-token` a `.env`
3. Agregue IDs de usuario a `telegram.allowedUsers` en `giver.config.json`
4. Ejecute con `npm run telegram`

## Internacionalizacion

Detecta automaticamente la configuracion regional del sistema (`LANG`) y muestra la interfaz en 8 idiomas: ingles, coreano, japones, chino, espanol, frances, aleman e italiano.

## Arquitectura

```
[Usuario] → [Canal(CLI/Telegram)] → [Bucle de Agente] → [Proveedor(Ollama/Claude/Gemini)]
                                          ↓                        ↓
                                    [Registro de Herramientas] [Generar respuesta]
                                     ↓        ↓
                            [Integradas]  [Personalizadas]
                            ↓    ↓    ↓      (data/tools/)
                       Archivo Shell Navegador
                       Busqueda Memoria
                            ↓
                      [PathGuard] ← sandbox
                            ↓
                      [resultado → Proveedor → respuesta final]
```

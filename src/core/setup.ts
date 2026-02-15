import readline from "node:readline";
import { execSync, exec, spawn } from "node:child_process";
import chalk from "chalk";
import type { ProviderConfig } from "./types.js";
import { t } from "./i18n.js";
import { setupSearxng } from "./docker.js";

// ── helpers ──────────────────────────────────────────────

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

function commandExists(cmd: string): boolean {
  try {
    execSync(`command -v ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function run(cmd: string): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    exec(cmd, { timeout: 120_000 }, (err, stdout, stderr) => {
      if (err) resolve({ ok: false, output: stderr || err.message });
      else resolve({ ok: true, output: stdout });
    });
  });
}

// ── provider detection ───────────────────────────────────

interface DetectedProvider {
  type: "ollama" | "claude-cli" | "gemini-cli";
  installed: boolean;
  running?: boolean;
  models?: string[];
  baseUrl?: string;
}

async function detectOllama(baseUrl = "http://localhost:11434"): Promise<DetectedProvider> {
  const installed = commandExists("ollama");
  if (!installed) return { type: "ollama", installed: false, baseUrl };

  let running = false;
  let models: string[] = [];
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      running = true;
      const data = (await res.json()) as { models?: { name: string }[] };
      models = (data.models ?? []).map((m) => m.name);
    }
  } catch {
    // not running
  }

  return { type: "ollama", installed, running, models, baseUrl };
}

function detectClaudeCli(): DetectedProvider {
  return { type: "claude-cli", installed: commandExists("claude") };
}

function detectGeminiCli(): DetectedProvider {
  return { type: "gemini-cli", installed: commandExists("gemini") };
}

// ── installation ─────────────────────────────────────────

async function installOllama(rl: readline.Interface): Promise<boolean> {
  const hasBrew = commandExists("brew");
  if (!hasBrew) {
    console.log(chalk.yellow("\n  " + t("install.noHomebrew")));
    return false;
  }

  console.log(chalk.dim("\n  " + t("install.running", "brew install ollama")));
  const result = await run("brew install ollama");
  if (!result.ok) {
    console.log(chalk.red("  " + t("install.failed", result.output)));
    return false;
  }
  console.log(chalk.green("  " + t("install.success", "Ollama")));
  return true;
}

async function startOllama(rl: readline.Interface): Promise<boolean> {
  const answer = await ask(rl, chalk.yellow("\n  " + t("ollama.startServer")));
  if (answer.trim().toLowerCase() !== "y") return false;

  console.log(chalk.dim("  " + t("ollama.starting")));
  const child = spawn("ollama", ["serve"], { detached: true, stdio: "ignore" });
  child.unref();
  await new Promise((r) => setTimeout(r, 2000));

  try {
    const res = await fetch("http://localhost:11434/api/tags", {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      console.log(chalk.green("  " + t("ollama.started")));
      return true;
    }
  } catch { /* ignore */ }

  console.log(chalk.yellow("  " + t("ollama.waitingStart")));
  return false;
}

async function pullOllamaModel(rl: readline.Interface): Promise<string | null> {
  console.log(chalk.dim("\n  " + t("ollama.recommendedModels")));
  console.log(chalk.dim(`    1. qwen3:8b        — ${t("ollama.modelLight")}`));
  console.log(chalk.dim(`    2. qwen3-coder:30b — ${t("ollama.modelCoder")}`));
  console.log(chalk.dim(`    3. llama3.1:8b     — ${t("ollama.modelGeneral")}`));
  console.log(chalk.dim(`    4. ${t("ollama.customInput")}`));

  const choice = await ask(rl, chalk.cyan("\n  " + t("ollama.selectModel")));
  let model: string;
  switch (choice.trim()) {
    case "1": model = "qwen3:8b"; break;
    case "2": model = "qwen3-coder:30b"; break;
    case "3": model = "llama3.1:8b"; break;
    case "4": {
      const custom = await ask(rl, chalk.cyan("  " + t("ollama.modelNameInput")));
      model = custom.trim();
      if (!model) return null;
      break;
    }
    default: model = "qwen3:8b";
  }

  console.log(chalk.dim("\n  " + t("ollama.pulling", model)));
  const result = await run(`ollama pull ${model}`);
  if (!result.ok) {
    console.log(chalk.red("  " + t("ollama.pullFailed", result.output)));
    return null;
  }
  console.log(chalk.green("  " + t("ollama.pullSuccess", model)));
  return model;
}

async function installClaudeCli(): Promise<boolean> {
  const hasNpm = commandExists("npm");
  if (!hasNpm) {
    console.log(chalk.yellow("\n  " + t("install.noNpm")));
    return false;
  }

  console.log(chalk.dim("\n  " + t("install.running", "npm install -g @anthropic-ai/claude-code")));
  const result = await run("npm install -g @anthropic-ai/claude-code");
  if (!result.ok) {
    console.log(chalk.red("  " + t("install.failed", result.output)));
    return false;
  }
  console.log(chalk.green("  " + t("install.success", "Claude CLI")));
  return true;
}

async function installGeminiCli(): Promise<boolean> {
  const hasNpm = commandExists("npm");
  if (!hasNpm) {
    console.log(chalk.yellow("\n  " + t("install.noNpm")));
    return false;
  }

  console.log(chalk.dim("\n  " + t("install.running", "npm install -g @google/gemini-cli")));
  const result = await run("npm install -g @google/gemini-cli");
  if (!result.ok) {
    console.log(chalk.red("  " + t("install.failed", result.output)));
    return false;
  }
  console.log(chalk.green("  " + t("install.success", "Gemini CLI")));
  console.log(chalk.dim("  " + t("gemini.loginHint")));
  return true;
}

// ── shared provider selection (used by wizard & /model) ──

function displayProviderStatus(provider: DetectedProvider): void {
  const nameMap: Record<string, string> = {
    ollama: "Ollama",
    "claude-cli": "Claude CLI",
    "gemini-cli": `Gemini CLI (${t("common.free")})`,
  };
  const name = nameMap[provider.type] ?? provider.type;

  if (!provider.installed) {
    console.log(chalk.red(`  ✗ ${name} — ${t("status.notInstalled")}`));
    return;
  }

  if (provider.type === "ollama") {
    if (provider.running) {
      const modelList = provider.models?.length
        ? provider.models.join(", ")
        : t("status.noModels");
      console.log(chalk.green(`  ✓ ${name} — ${t("status.running")} (${modelList})`));
    } else {
      console.log(chalk.yellow(`  △ ${name} — ${t("status.serverStopped")}`));
    }
  } else {
    console.log(chalk.green(`  ✓ ${name} — ${t("status.installed")}`));
  }
}

async function selectProvider(rl: readline.Interface): Promise<ProviderConfig | null> {
  console.log(chalk.dim("\n" + t("setup.detecting") + "\n"));

  const ollama = await detectOllama();
  const claudeCli = detectClaudeCli();
  const geminiCli = detectGeminiCli();

  displayProviderStatus(ollama);
  displayProviderStatus(claudeCli);
  displayProviderStatus(geminiCli);

  // Build menu options
  const options: { label: string; action: () => Promise<ProviderConfig> }[] = [];

  if (ollama.installed && ollama.running && ollama.models && ollama.models.length > 0) {
    for (const model of ollama.models) {
      options.push({
        label: `Ollama — ${model}`,
        action: async () => ({
          type: "ollama",
          model,
          ollamaBaseUrl: ollama.baseUrl,
        }),
      });
    }
    options.push({
      label: `Ollama — ${t("ollama.newModelDownload")}`,
      action: async () => {
        const model = await pullOllamaModel(rl);
        return {
          type: "ollama",
          model: model ?? "qwen3:8b",
          ollamaBaseUrl: ollama.baseUrl,
        };
      },
    });
  } else if (ollama.installed && !ollama.running) {
    options.push({
      label: t("ollama.serverNotRunning"),
      action: async () => {
        await startOllama(rl);
        const refreshed = await detectOllama();
        let model: string;
        if (refreshed.models && refreshed.models.length > 0) {
          console.log(chalk.dim("\n  " + t("ollama.installedModels", refreshed.models.join(", "))));
          const pick = await ask(rl, chalk.cyan("  " + t("ollama.selectInstalled", refreshed.models[0])));
          model = pick.trim() || refreshed.models[0];
        } else {
          const pulled = await pullOllamaModel(rl);
          model = pulled ?? "qwen3:8b";
        }
        return { type: "ollama", model, ollamaBaseUrl: ollama.baseUrl };
      },
    });
  } else if (!ollama.installed) {
    options.push({
      label: `Ollama \x1B[90m(${t("status.notInstalled")})\x1B[0m`,
      action: async () => {
        const answer = await ask(rl, chalk.yellow("\n  " + t("install.askInstall", "Ollama")));
        if (answer.trim().toLowerCase() !== "y") throw new Error("__cancel__");
        const ok = await installOllama(rl);
        if (!ok) throw new Error(t("install.failedProvider", "Ollama"));
        await startOllama(rl);
        const model = await pullOllamaModel(rl);
        return { type: "ollama", model: model ?? "qwen3:8b", ollamaBaseUrl: "http://localhost:11434" };
      },
    });
  }

  // Claude CLI
  options.push({
    label: claudeCli.installed ? "Claude CLI" : `Claude CLI \x1B[90m(${t("status.notInstalled")})\x1B[0m`,
    action: async () => {
      if (!claudeCli.installed) {
        const answer = await ask(rl, chalk.yellow("\n  " + t("install.askInstall", "Claude CLI")));
        if (answer.trim().toLowerCase() !== "y") throw new Error("__cancel__");
        const ok = await installClaudeCli();
        if (!ok) throw new Error(t("install.failedProvider", "Claude CLI"));
      }
      const model = await ask(rl, chalk.cyan("  " + t("claude.selectModel")));
      return { type: "claude-cli" as const, model: model.trim() || "sonnet" };
    },
  });

  // Gemini CLI
  const geminiLabel = `Gemini CLI (${t("common.free")} 1,000/day)`;
  options.push({
    label: geminiCli.installed ? geminiLabel : `${geminiLabel} \x1B[90m(${t("status.notInstalled")})\x1B[0m`,
    action: async () => {
      if (!geminiCli.installed) {
        const answer = await ask(rl, chalk.yellow("\n  " + t("install.askInstall", "Gemini CLI")));
        if (answer.trim().toLowerCase() !== "y") throw new Error("__cancel__");
        const ok = await installGeminiCli();
        if (!ok) throw new Error(t("install.failedProvider", "Gemini CLI"));
      }
      return { type: "gemini-cli" as const, model: "gemini-2.5-pro" };
    },
  });

  // Cancel option
  options.push({
    label: t("common.cancel"),
    action: async () => { throw new Error("__cancel__"); },
  });

  console.log(chalk.bold("\n" + t("setup.selectAi") + "\n"));
  options.forEach((opt, i) => {
    console.log(chalk.cyan(`  ${i + 1}. ${opt.label}`));
  });

  const choice = await ask(rl, chalk.green(`\n${t("setup.choose")} (1-${options.length}): `));
  const idx = parseInt(choice.trim(), 10) - 1;

  if (isNaN(idx) || idx < 0 || idx >= options.length) {
    console.log(chalk.yellow(t("setup.invalidChoice") + "\n"));
    return null;
  }

  try {
    return await options[idx].action();
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "__cancel__") return null;
    throw err;
  }
}

// ── public API ───────────────────────────────────────────

/** Initial setup wizard (creates its own readline) */
export async function runSetupWizard(): Promise<ProviderConfig> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log(chalk.bold.cyan("\n🔧 " + t("setup.title") + "\n"));

    const config = await selectProvider(rl);
    if (!config) {
      console.log(chalk.yellow(t("setup.defaultFallback") + "\n"));
      return { type: "ollama", model: "qwen3-coder:30b", ollamaBaseUrl: "http://localhost:11434" };
    }

    console.log(chalk.green(`\n✅ ${config.type} (${config.model}) ${t("setup.saved")}\n`));

    // SearXNG search engine setup
    await setupSearxng(rl);

    return config;
  } finally {
    rl.close();
  }
}

/** Model switch using an existing readline (for /model command) */
export async function runModelSwitch(rl: readline.Interface): Promise<ProviderConfig | null> {
  console.log(chalk.bold.cyan("\n🔄 " + t("switch.title") + "\n"));

  const config = await selectProvider(rl);
  if (!config) {
    console.log(chalk.dim("  " + t("switch.cancelled") + "\n"));
    return null;
  }

  console.log(chalk.green("\n✅ " + t("switch.changed", config.type, config.model) + "\n"));
  return config;
}

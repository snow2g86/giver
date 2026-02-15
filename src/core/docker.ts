import readline from "node:readline";
import fs from "node:fs";
import path from "node:path";
import { execSync, spawn } from "node:child_process";
import chalk from "chalk";
import { t } from "./i18n.js";

const SEARXNG_DIR = path.join(process.cwd(), "data", "searxng");

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

function runInteractive(cmd: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn("sh", ["-c", cmd], { stdio: "inherit" });
    child.on("close", (code) => resolve(code === 0));
    child.on("error", () => resolve(false));
  });
}

// ── OS detection ─────────────────────────────────────────

interface OSInfo {
  platform: string;
  distro?: string;
}

function detectOS(): OSInfo {
  const platform = process.platform;
  if (platform === "linux") {
    try {
      const osRelease = fs.readFileSync("/etc/os-release", "utf-8");
      const match = osRelease.match(/^ID=["']?(\w+)["']?/m);
      return { platform, distro: match?.[1] || "unknown" };
    } catch {
      return { platform, distro: "unknown" };
    }
  }
  return { platform };
}

// ── Docker detection ─────────────────────────────────────

function isDockerInstalled(): boolean {
  return commandExists("docker");
}

function isDockerRunning(): boolean {
  try {
    execSync("docker info", { stdio: "ignore", timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

// ── Docker installation ──────────────────────────────────

async function installDocker(rl: readline.Interface): Promise<boolean> {
  const os = detectOS();
  console.log(chalk.dim("\n  " + t("docker.detecting")));

  // ── macOS ──
  if (os.platform === "darwin") {
    if (commandExists("brew")) {
      const answer = await ask(rl, chalk.yellow("  " + t("docker.askInstall")));
      if (answer.trim().toLowerCase() !== "y") return false;

      console.log(chalk.dim("  " + t("install.running", "brew install --cask docker")));
      const ok = await runInteractive("brew install --cask docker");
      if (!ok) {
        console.log(chalk.red("  " + t("install.failed", "Docker")));
        return false;
      }
      console.log(chalk.green("  " + t("install.success", "Docker")));
      console.log(chalk.yellow("  " + t("docker.openApp")));
      await ask(rl, chalk.dim("  " + t("docker.pressEnter")));
      return true;
    }
    console.log(chalk.yellow("  " + t("docker.downloadUrl", "https://docker.com/products/docker-desktop")));
    await ask(rl, chalk.dim("  " + t("docker.pressEnter")));
    return isDockerInstalled();
  }

  // ── Linux ──
  if (os.platform === "linux") {
    const distro = os.distro || "unknown";
    let cmd: string | null = null;

    switch (distro) {
      case "ubuntu":
      case "debian":
      case "pop":
      case "mint":
      case "elementary":
        cmd = "sudo apt update && sudo apt install -y docker.io docker-compose-plugin && sudo systemctl enable --now docker && sudo usermod -aG docker $USER";
        break;
      case "fedora":
        cmd = "sudo dnf install -y docker docker-compose-plugin && sudo systemctl enable --now docker && sudo usermod -aG docker $USER";
        break;
      case "rhel":
      case "centos":
      case "rocky":
      case "alma":
        cmd = "sudo yum install -y docker docker-compose-plugin && sudo systemctl enable --now docker && sudo usermod -aG docker $USER";
        break;
      case "arch":
      case "manjaro":
      case "endeavouros":
        cmd = "sudo pacman -S --noconfirm docker docker-compose && sudo systemctl enable --now docker && sudo usermod -aG docker $USER";
        break;
      case "opensuse":
      case "suse":
        cmd = "sudo zypper install -y docker docker-compose && sudo systemctl enable --now docker && sudo usermod -aG docker $USER";
        break;
    }

    if (!cmd) {
      console.log(chalk.yellow("  " + t("docker.unknownDistro", distro)));
      console.log(chalk.dim("  https://docs.docker.com/engine/install/"));
      await ask(rl, chalk.dim("  " + t("docker.pressEnter")));
      return isDockerInstalled();
    }

    console.log(chalk.dim("  " + t("docker.linuxCmd")));
    const parts = cmd.split(" && ").map((s) => s.trim());
    for (const part of parts) {
      console.log(chalk.dim(`    $ ${part}`));
    }

    const answer = await ask(rl, chalk.yellow("\n  " + t("docker.askInstall")));
    if (answer.trim().toLowerCase() !== "y") return false;

    console.log(chalk.yellow("  " + t("docker.sudoHint")));
    const ok = await runInteractive(cmd);
    if (!ok) {
      console.log(chalk.red("  " + t("install.failed", "Docker")));
      return false;
    }
    console.log(chalk.green("  " + t("install.success", "Docker")));
    return true;
  }

  // ── Windows ──
  if (os.platform === "win32") {
    console.log(chalk.yellow("  " + t("docker.downloadUrl", "https://docker.com/products/docker-desktop")));
    console.log(chalk.dim("  " + t("docker.windowsHint")));
    await ask(rl, chalk.dim("  " + t("docker.pressEnter")));
    return isDockerInstalled();
  }

  return false;
}

// ── SearXNG files ────────────────────────────────────────

function ensureSearxngFiles(): void {
  const configDir = path.join(SEARXNG_DIR, "config");
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const composePath = path.join(SEARXNG_DIR, "docker-compose.yml");
  if (!fs.existsSync(composePath)) {
    fs.writeFileSync(
      composePath,
      `services:
  searxng:
    image: searxng/searxng:latest
    container_name: giver-searxng
    ports:
      - "8080:8080"
    volumes:
      - ./config:/etc/searxng:rw
    restart: unless-stopped
`,
      "utf-8",
    );
  }

  const settingsPath = path.join(configDir, "settings.yml");
  if (!fs.existsSync(settingsPath)) {
    fs.writeFileSync(
      settingsPath,
      `use_default_settings: true

server:
  secret_key: "giver-searxng-local"
  limiter: false

search:
  formats:
    - html
    - json
`,
      "utf-8",
    );
  }
}

// ── SearXNG start ────────────────────────────────────────

async function isSearxngRunning(): Promise<boolean> {
  try {
    const res = await fetch("http://localhost:8080/search?q=test&format=json", {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function startSearxngContainer(): Promise<boolean> {
  // Try starting existing stopped container first
  try {
    const status = execSync(
      'docker ps -a --filter name=giver-searxng --format "{{.Status}}"',
      { encoding: "utf-8", timeout: 5000 },
    ).trim();

    if (status.startsWith("Up")) return true;

    if (status) {
      execSync("docker start giver-searxng", { stdio: "ignore", timeout: 10000 });
      await new Promise((r) => setTimeout(r, 3000));
      if (await isSearxngRunning()) return true;
    }
  } catch {
    // container doesn't exist, create with compose
  }

  // Create via docker compose
  ensureSearxngFiles();

  return new Promise((resolve) => {
    const child = spawn("docker", ["compose", "up", "-d"], {
      cwd: SEARXNG_DIR,
      stdio: "pipe",
    });

    child.on("close", async (code) => {
      if (code !== 0) {
        resolve(false);
        return;
      }
      // Wait for SearXNG to become ready
      for (let i = 0; i < 15; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        if (await isSearxngRunning()) {
          resolve(true);
          return;
        }
      }
      resolve(false);
    });

    child.on("error", () => resolve(false));
  });
}

// ── Public API ───────────────────────────────────────────

export async function setupSearxng(rl: readline.Interface): Promise<boolean> {
  console.log(chalk.bold.cyan("\n🔍 " + t("docker.searxngTitle") + "\n"));

  // Already running? Skip everything.
  if (await isSearxngRunning()) {
    console.log(chalk.green("  " + t("docker.searxngAlready")));
    return true;
  }

  // 1. Check Docker installed
  if (!isDockerInstalled()) {
    console.log(chalk.yellow("  " + t("docker.notInstalled")));
    const installed = await installDocker(rl);
    if (!installed || !isDockerInstalled()) {
      console.log(chalk.dim("  " + t("docker.skipSearxng")));
      return false;
    }
  }

  // 2. Check Docker daemon running
  if (!isDockerRunning()) {
    console.log(chalk.yellow("  " + t("docker.notRunning")));
    const os = detectOS();
    if (os.platform === "darwin" || os.platform === "win32") {
      console.log(chalk.yellow("  " + t("docker.openApp")));
      await ask(rl, chalk.dim("  " + t("docker.pressEnter")));
    } else {
      console.log(chalk.dim("  " + t("docker.startingDaemon")));
      await runInteractive("sudo systemctl start docker");
    }
    if (!isDockerRunning()) {
      console.log(chalk.red("  " + t("docker.daemonFailed")));
      return false;
    }
  }

  console.log(chalk.green("  " + t("docker.dockerReady")));

  // 3. Start SearXNG
  console.log(chalk.dim("  " + t("docker.startingSearxng")));
  const ok = await startSearxngContainer();
  if (ok) {
    console.log(chalk.green("  " + t("docker.searxngStarted")));
    return true;
  }

  console.log(chalk.red("  " + t("docker.searxngFailed")));
  return false;
}

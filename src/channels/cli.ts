import readline from "node:readline";
import chalk from "chalk";
import type { Channel } from "./channel.js";
import type { Agent } from "../core/agent.js";
import { t } from "../core/i18n.js";

function getCommands(): { name: string; desc: string }[] {
  return [
    { name: "/model", desc: t("cmd.model") },
    { name: "/clear", desc: t("cmd.clear") },
    { name: "/quit",  desc: t("cmd.quit") },
    { name: "/exit",  desc: t("cmd.quit") },
  ];
}

function commandCompleter(line: string): [string[], string] {
  if (!line.startsWith("/")) return [[], line];
  const names = getCommands().map((c) => c.name);
  const hits = names.filter((n) => n.startsWith(line));
  return [hits.length ? hits : names, line];
}

export interface CliOptions {
  onModelSwitch?: (rl: readline.Interface) => Promise<void>;
}

export class CliChannel implements Channel {
  name = "cli";
  private agent: Agent;
  private rl: readline.Interface | null = null;
  private onModelSwitch?: (rl: readline.Interface) => Promise<void>;
  private hintActive = false;
  private keypressHandler: (() => void) | null = null;

  constructor(agent: Agent, options?: CliOptions) {
    this.agent = agent;
    this.onModelSwitch = options?.onModelSwitch;
  }

  /** Save cursor → clear everything below → restore cursor */
  private clearHints(): void {
    if (!this.hintActive) return;
    process.stdout.write("\x1B7\x1B[J\x1B8");
    this.hintActive = false;
  }

  /** Save cursor → write hint lines below → restore cursor */
  private showHints(matches: { name: string; desc: string }[]): void {
    this.clearHints();
    if (matches.length === 0) return;
    process.stdout.write("\x1B7"); // save cursor
    for (const m of matches) {
      process.stdout.write(
        `\n\x1B[2K  \x1B[36m${m.name}\x1B[0m \x1B[90m${m.desc}\x1B[0m`
      );
    }
    process.stdout.write("\x1B8"); // restore cursor
    this.hintActive = true;
  }

  async start(): Promise<void> {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      completer: commandCompleter,
    });

    // Real-time command hints on every keypress
    this.keypressHandler = () => {
      setImmediate(() => {
        if (!this.rl) return;
        const line: string = (this.rl as any).line ?? "";
        const commands = getCommands();

        if (line.startsWith("/")) {
          const matches = commands.filter((c) => c.name.startsWith(line));
          // Show hints while user is still typing (not exact match)
          const isExactMatch =
            matches.length === 1 && matches[0].name === line;
          if (matches.length > 0 && !isExactMatch) {
            this.showHints(matches);
          } else {
            this.clearHints();
          }
        } else {
          this.clearHints();
        }
      });
    };
    process.stdin.on("keypress", this.keypressHandler);

    console.log(chalk.bold.cyan("\n🤖 " + t("cli.title")));
    console.log(chalk.dim(t("cli.hint") + "\n"));

    const prompt = () => {
      this.rl!.question(chalk.green("You: "), async (input) => {
        // Clear leftover hints after Enter
        if (this.hintActive) {
          process.stdout.write("\x1B[J");
          this.hintActive = false;
        }

        const trimmed = input.trim();
        if (!trimmed) {
          prompt();
          return;
        }

        if (trimmed === "/quit" || trimmed === "/exit") {
          console.log(chalk.dim("\n" + t("cli.goodbye") + " 👋\n"));
          await this.stop();
          process.exit(0);
        }

        if (trimmed === "/clear") {
          this.agent.clearHistory();
          console.log(chalk.dim(t("cli.cleared") + "\n"));
          prompt();
          return;
        }

        if (trimmed === "/model") {
          if (this.onModelSwitch) {
            try {
              await this.onModelSwitch(this.rl!);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              console.error(chalk.red(`\nError: ${msg}\n`));
            }
          } else {
            console.log(chalk.yellow(t("cli.noModelSwitch") + "\n"));
          }
          prompt();
          return;
        }

        try {
          console.log(chalk.dim("  " + t("cli.thinking")));
          const response = await this.agent.chat(trimmed);
          console.log(chalk.cyan("\nGiver: ") + response + "\n");
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(chalk.red(`\nError: ${msg}\n`));
        }

        prompt();
      });
    };

    prompt();

    await new Promise<void>((resolve) => {
      this.rl!.on("close", resolve);
    });
  }

  async stop(): Promise<void> {
    if (this.keypressHandler) {
      process.stdin.removeListener("keypress", this.keypressHandler);
      this.keypressHandler = null;
    }
    this.rl?.close();
  }
}

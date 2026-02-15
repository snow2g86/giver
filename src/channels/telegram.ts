import { Bot } from "grammy";
import chalk from "chalk";
import type { Channel } from "./channel.js";
import type { Agent } from "../core/agent.js";
import { getConfig } from "../core/config.js";

export class TelegramChannel implements Channel {
  name = "telegram";
  private bot: Bot;
  private agent: Agent;
  private allowedUsers: number[];

  constructor(agent: Agent) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      throw new Error("TELEGRAM_BOT_TOKEN is not set in .env");
    }

    this.bot = new Bot(token);
    this.agent = agent;
    this.allowedUsers = getConfig().telegram.allowedUsers;

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Auth middleware
    this.bot.use(async (ctx, next) => {
      const userId = ctx.from?.id;
      if (!userId) return;

      // If allowedUsers is empty, allow everyone (for initial setup)
      if (
        this.allowedUsers.length > 0 &&
        !this.allowedUsers.includes(userId)
      ) {
        await ctx.reply(
          "⛔ Access denied. Your user ID is not in the allowed list.\n" +
            `Your ID: ${userId}`
        );
        console.log(chalk.yellow(`[Telegram] Denied access for user ${userId}`));
        return;
      }

      await next();
    });

    // /start command
    this.bot.command("start", async (ctx) => {
      await ctx.reply(
        "🤖 Giver AI Assistant\n\n" +
          "Send me any message and I'll help you with tasks!\n\n" +
          "Commands:\n" +
          "/clear - Clear conversation history\n" +
          "/id - Show your Telegram user ID"
      );
    });

    // /clear command
    this.bot.command("clear", async (ctx) => {
      this.agent.clearHistory();
      await ctx.reply("🗑 Conversation history cleared.");
    });

    // /id command
    this.bot.command("id", async (ctx) => {
      await ctx.reply(`Your Telegram user ID: ${ctx.from?.id}`);
    });

    // Message handler
    this.bot.on("message:text", async (ctx) => {
      const text = ctx.message.text;
      const userId = ctx.from?.id;

      console.log(chalk.dim(`[Telegram] ${userId}: ${text.slice(0, 50)}...`));

      try {
        await ctx.replyWithChatAction("typing");
        const response = await this.agent.chat(text);

        // Telegram messages have 4096 char limit
        if (response.length > 4000) {
          const chunks = response.match(/.{1,4000}/gs) || [];
          for (const chunk of chunks) {
            await ctx.reply(chunk);
          }
        } else {
          await ctx.reply(response);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`[Telegram] Error: ${msg}`));
        await ctx.reply(`❌ Error: ${msg}`);
      }
    });
  }

  async start(): Promise<void> {
    console.log(chalk.bold.magenta("📱 Telegram bot starting..."));
    await this.bot.start({
      onStart: (info) => {
        console.log(
          chalk.magenta(`📱 Telegram bot @${info.username} is running`)
        );
      },
    });
  }

  async stop(): Promise<void> {
    this.bot.stop();
  }
}

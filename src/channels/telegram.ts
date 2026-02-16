import { Bot, InlineKeyboard } from "grammy";
import chalk from "chalk";
import type { Channel } from "./channel.js";
import type { Agent } from "../core/agent.js";
import { getConfig } from "../core/config.js";
import { t } from "../core/i18n.js";
import type { PermissionPrompter, PermissionGrant } from "../core/types.js";

export function createTelegramPrompter(bot: Bot, getChatId: () => number | null): PermissionPrompter {
  return {
    async requestApproval(path: string): Promise<PermissionGrant> {
      const chatId = getChatId();
      if (!chatId) {
        return { granted: false, persistent: false };
      }

      const keyboard = new InlineKeyboard()
        .text(t("perm.allowSession"), `perm:session:${Date.now()}`)
        .text(t("perm.allowPermanent"), `perm:permanent:${Date.now()}`)
        .row()
        .text(t("perm.deny"), `perm:deny:${Date.now()}`);

      await bot.api.sendMessage(
        chatId,
        `⚠️ ${t("perm.requestAccess", path)}`,
        { reply_markup: keyboard }
      );

      return new Promise<PermissionGrant>((resolve) => {
        const timeout = setTimeout(() => {
          resolve({ granted: false, persistent: false });
        }, 60_000);

        const handler = bot.callbackQuery(/^perm:(session|permanent|deny):/, async (ctx) => {
          clearTimeout(timeout);
          const action = ctx.callbackQuery.data.split(":")[1];
          await ctx.answerCallbackQuery();

          if (action === "deny") {
            await ctx.editMessageText(`❌ ${t("perm.denied")}`);
            resolve({ granted: false, persistent: false });
          } else {
            const persistent = action === "permanent";
            const msg = persistent ? t("perm.grantedPermanent") : t("perm.grantedSession");
            await ctx.editMessageText(`✅ ${msg}`);
            resolve({ granted: true, persistent });
          }
        });

        // grammy의 callbackQuery는 미들웨어로 등록됨 — 일회성 처리를 위해 composer 사용
        // 위의 handler는 이미 bot에 등록된 상태이므로 별도 해제 불필요
        void handler;
      });
    },
  };
}

export class TelegramChannel implements Channel {
  name = "telegram";
  private bot: Bot;
  private agent: Agent;
  private allowedUsers: number[];
  private lastChatId: number | null = null;

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

  getBot(): Bot {
    return this.bot;
  }

  getLastChatId(): number | null {
    return this.lastChatId;
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
      this.lastChatId = ctx.chat.id;

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

import { Bot, type BotConfig, type Context } from "grammy";
import { he } from "../messages/he";

/**
 * Builds the bot and registers its handlers. Kept free of Worker details so tests can
 * create a bot with a fake `botInfo` and inspect outgoing API calls.
 */
export function createBot(token: string, config?: BotConfig<Context>): Bot {
  const bot = new Bot(token, config);

  bot.command("start", async (ctx) => {
    await ctx.reply(he.start.hello);
  });

  return bot;
}

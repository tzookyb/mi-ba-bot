import { type Bot, webhookCallback } from "grammy";
import { createBot } from "./bot";

/**
 * One bot per Worker isolate. Cloudflare reuses an isolate for many requests, so we only
 * call `bot.init()` (which asks Telegram for the bot's own info via getMe) once per isolate,
 * not once per update.
 */
let cached: { token: string; bot: Bot } | undefined;

async function getBot(token: string): Promise<Bot> {
  if (cached?.token !== token) {
    const bot = createBot(token);
    await bot.init();
    cached = { token, bot };
  }
  return cached.bot;
}

/**
 * Handles POST /webhook from Telegram. Telegram sends our secret in the
 * `X-Telegram-Bot-Api-Secret-Token` header (we set it with setWebhook); anything without it
 * is rejected before we touch the bot, so strangers can't feed us fake updates.
 */
export async function handleWebhook(request: Request, env: Env): Promise<Response> {
  const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (!env.WEBHOOK_SECRET || secret !== env.WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const bot = await getBot(env.BOT_TOKEN);
  return webhookCallback(bot, "cloudflare-mod")(request);
}

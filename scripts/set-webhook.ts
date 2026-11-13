/**
 * Points a bot's webhook at a Worker URL.
 *
 *   npm run set-webhook -- https://mibabot-dev.<subdomain>.workers.dev
 *
 * Reads BOT_TOKEN and WEBHOOK_SECRET from .dev.vars (via node --env-file), so it always
 * targets the DEV bot. Node runs this TypeScript file directly (type stripping).
 */
export {};

const baseUrl = process.argv[2];
const token = process.env.BOT_TOKEN;
const secret = process.env.WEBHOOK_SECRET;

if (!baseUrl || !token || !secret) {
  console.error("Usage: npm run set-webhook -- <worker base URL>");
  console.error("BOT_TOKEN and WEBHOOK_SECRET must be set in .dev.vars");
  process.exit(1);
}

const webhookUrl = `${baseUrl.replace(/\/+$/, "")}/webhook`;

const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    url: webhookUrl,
    secret_token: secret,
    // Only the update types the bot handles. Extended as features are added.
    allowed_updates: ["message", "callback_query", "my_chat_member", "chat_member"],
    drop_pending_updates: true,
  }),
});

const result = (await response.json()) as { ok: boolean; description?: string };
console.log(result.ok ? `Webhook set to ${webhookUrl}` : `Failed: ${result.description}`);
process.exit(result.ok ? 0 : 1);

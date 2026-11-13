# Development setup

How to run Mi Ba Bot against a **test bot in a test group**, so development never touches a real group.

## 1. Create the test bot (once)

1. In Telegram, open **@BotFather** and send `/newbot`.
2. Name it e.g. `Mi Ba Bot (dev)` and pick a username ending in `bot`.
3. BotFather replies with a token. Treat it like a password: don't paste it in chats, issues or commits.
4. Leave **privacy mode** on (the default): in groups the bot only sees commands, mentions, replies to it and button taps.

## 2. Create a test group (once)

Create a Telegram group (e.g. "Mi Ba Test") and add the dev bot. To test multi-user flows, add a second account.

## 3. Local secrets

```bash
cp .dev.vars.example .dev.vars
openssl rand -hex 32        # paste the output as WEBHOOK_SECRET in .dev.vars
```

Open `.dev.vars` and paste the BotFather token as `BOT_TOKEN`. The file is gitignored.

## 4. Secrets on Cloudflare (dev Worker)

Use the same values as `.dev.vars`. Each command asks you to paste the value:

```bash
npx wrangler secret put BOT_TOKEN --env dev
npx wrangler secret put WEBHOOK_SECRET --env dev
```

## 5. Deploy and connect Telegram

```bash
npm run deploy:dev                                         # prints the Worker URL
npm run set-webhook -- https://mibabot-dev.<subdomain>.workers.dev
```

Now send `/start` to the dev bot in a private chat. It should answer in Hebrew.

## Running locally instead of deploying

Telegram needs a public HTTPS URL, so a local Worker needs a tunnel:

```bash
npm run dev                                            # http://localhost:8787
npx cloudflared tunnel --url http://localhost:8787     # prints https://<random>.trycloudflare.com
npm run set-webhook -- https://<random>.trycloudflare.com
```

When you're done, point the webhook back at the deployed dev Worker (step 5), since the tunnel URL changes every time.

## Webhook vs. long polling

Telegram can deliver updates two ways. **Long polling**: our process keeps asking Telegram "anything new?". That needs an always-running server. **Webhook**: Telegram sends each update to our URL as an HTTPS POST. That fits Workers, which only run when called. The `secret_token` we pass to `setWebhook` comes back in the `X-Telegram-Bot-Api-Secret-Token` header, and the Worker rejects requests without it.

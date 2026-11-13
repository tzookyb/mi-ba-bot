import type { Update, UserFromGetMe } from "grammy/types";
import { describe, expect, it } from "vitest";
import { he } from "../messages/he";
import { createBot } from "./bot";

const botInfo: UserFromGetMe = {
  id: 1,
  is_bot: true,
  first_name: "Mi Ba Bot (test)",
  username: "mibabot_test_bot",
  can_join_groups: true,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
  can_connect_to_business: false,
  has_main_web_app: false,
  has_topics_enabled: false,
  allows_users_to_create_topics: false,
  can_manage_bots: false,
  supports_join_request_queries: false,
};

/** A bot whose Telegram API calls are recorded instead of sent. */
function testBot() {
  const bot = createBot("test-token", { botInfo });
  const calls: { method: string; payload: unknown }[] = [];
  bot.api.config.use(async (_prev, method, payload) => {
    calls.push({ method, payload });
    // biome-ignore lint/suspicious/noExplicitAny: fake API result for tests
    return { ok: true, result: true } as any;
  });
  return { bot, calls };
}

function privateText(text: string): Update {
  return {
    update_id: 1,
    message: {
      message_id: 1,
      date: 0,
      chat: { id: 42, type: "private", first_name: "Test" },
      from: { id: 42, is_bot: false, first_name: "Test" },
      text,
      entities: text.startsWith("/")
        ? [{ type: "bot_command", offset: 0, length: text.split(" ")[0]?.length ?? 0 }]
        : [],
    },
  };
}

describe("/start", () => {
  it("replies with the Hebrew hello", async () => {
    const { bot, calls } = testBot();
    await bot.handleUpdate(privateText("/start"));
    expect(calls).toEqual([
      { method: "sendMessage", payload: { chat_id: 42, text: he.start.hello } },
    ]);
  });

  it("ignores plain text for now", async () => {
    const { bot, calls } = testBot();
    await bot.handleUpdate(privateText("hello"));
    expect(calls).toEqual([]);
  });
});

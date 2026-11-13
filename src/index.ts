import { handleWebhook } from "./bot/webhook";

/**
 * Worker entry point. Cloudflare calls `fetch` for every HTTP request to the Worker.
 * A later step adds a `scheduled` handler for timers.
 */
export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return new Response("ok");
    }

    if (request.method === "POST" && url.pathname === "/webhook") {
      return handleWebhook(request, env);
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

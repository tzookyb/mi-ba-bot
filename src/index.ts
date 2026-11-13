/**
 * Worker entry point. Cloudflare calls `fetch` for every HTTP request to the Worker.
 * Later steps add the Telegram webhook route here and a `scheduled` handler for timers.
 */
export default {
  async fetch(request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return new Response("ok");
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

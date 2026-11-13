import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

// These tests run inside the real Workers runtime (workerd) via @cloudflare/vitest-plugin,
// and call the Worker exactly as Cloudflare would.
describe("worker fetch", () => {
  it("answers GET /health with ok", async () => {
    const response = await exports.default.fetch("https://example.com/health");
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok");
  });

  it("returns 404 for unknown paths", async () => {
    const response = await exports.default.fetch("https://example.com/nope");
    expect(response.status).toBe(404);
  });

  it("returns 404 for POST /health", async () => {
    const response = await exports.default.fetch("https://example.com/health", { method: "POST" });
    expect(response.status).toBe(404);
  });
});

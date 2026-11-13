import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// Every test runs inside the Workers runtime, using the bindings from wrangler.toml.
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.toml" },
      // Fake secrets for tests. Real ones live in .dev.vars and Cloudflare secrets.
      miniflare: { bindings: { BOT_TOKEN: "test-token", WEBHOOK_SECRET: "test-secret" } },
    }),
  ],
  test: {
    include: ["src/**/*.test.ts"],
  },
});

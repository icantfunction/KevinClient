import { defineConfig } from "@playwright/test";

const baseURL = "http://127.0.0.1:3407";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: "list",
  timeout: 30_000,
  use: {
    baseURL,
    browserName: "chromium",
    headless: true,
    screenshot: "only-on-failure",
    trace: "off",
    video: "off",
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command: "pnpm run build && pnpm exec next start --hostname 127.0.0.1 --port 3407",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 240_000,
  },
});

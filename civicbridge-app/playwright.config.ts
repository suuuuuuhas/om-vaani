import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  // One worker: both projects share a single Next dev server.
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  expect: {
    // Dev-server cold compiles can exceed Playwright's 5s default.
    timeout: 15_000
  },
  use: {
    baseURL: "http://127.0.0.1:3311",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "npm run dev -- --port 3311",
    url: "http://127.0.0.1:3311",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // E2E must prove deterministic no-key behavior regardless of local secrets.
    env: { ...process.env, OPENAI_API_KEY: "" }
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } }
  ]
});

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 2,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: [
    ["list"],
    ["html", { outputFolder: "output/browser-report", open: "never" }],
  ],
  outputDir: "output/browser-results",
  use: {
    baseURL: "http://127.0.0.1:4175",
    browserName: "chromium",
    actionTimeout: 8_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1366, height: 768 } } },
    {
      name: "mobile",
      use: {
        viewport: { width: 390, height: 640 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "compact",
      use: {
        viewport: { width: 320, height: 568 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: "npm run preview -- --port 4175",
    url: "http://127.0.0.1:4175",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});

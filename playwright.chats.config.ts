import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./chat-tests",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:8015",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    },
  },
  webServer: {
    command: ".venv/bin/python backend/tests/chat_fixture.py",
    url: "http://127.0.0.1:8015/api/health",
    reuseExistingServer: false,
  },
  reporter: "list",
});

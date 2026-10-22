import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./integration",
  use: {
    baseURL: "http://127.0.0.1:8001",
    headless: true,
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    },
  },
  webServer: {
    command:
      ".venv/bin/python -m uvicorn klinekraft.main:app --host 127.0.0.1 --port 8001",
    url: "http://127.0.0.1:8001/api/health",
    reuseExistingServer: false,
  },
  reporter: "list",
});

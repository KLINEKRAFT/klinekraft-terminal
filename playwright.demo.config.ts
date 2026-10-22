import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testDir: "./demo-tests",
  webServer: {
    command: "npm run preview -- --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
  },
});

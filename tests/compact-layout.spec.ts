import { test, expect } from "@playwright/test";
import { navigate } from "./navigation";
for (const height of [600, 560])
  test(`all workspaces fit 1024x${height}`, async ({ page }) => {
    await page.setViewportSize({ width: 1024, height });
    await page.route("**/api/**", (r) =>
      r.request().method() === "GET" ? r.continue() : r.abort(),
    );
    await page.goto("/");
    for (const name of [
      "Home",
      "Shackleton",
      "GPS / Maps",
      "Library",
      "Notes",
      "Paint",
      "Games",
      "Calendar",
      "Calculator",
      "Files",
      "Network",
      "System",
      "Settings",
      "Emergency",
    ]) {
      await navigate(page, name);
      await expect(
        page.getByRole("button", { name: "Go Home", exact: true }),
      ).toBeInViewport();
      expect(
        await page
          .locator("main")
          .evaluate((e) => e.getBoundingClientRect().width),
      ).toBeGreaterThan(950);
      expect(
        await page.evaluate(() => ({
          w: document.documentElement.scrollWidth,
          h: document.documentElement.scrollHeight,
        })),
      ).toEqual({ w: 1024, h: height });
    }
    await navigate(page, "Paint");
    await expect(page.locator(".paint-footer")).toBeInViewport();
    await expect(page.locator(".paint-canvas-wrap")).toBeInViewport({
      ratio: 1,
    });
    await page
      .getByRole("button", { name: "Expand Paint workspace", exact: true })
      .click();
    await expect(page.locator(".paint-canvas-wrap")).toBeInViewport({
      ratio: 1,
    });
    await page
      .getByRole("button", { name: "Exit expanded Paint", exact: true })
      .click();
    await navigate(page, "Shackleton");
    await expect(page.getByPlaceholder("Message Shackleton…")).toBeInViewport();
  });

import { test, expect } from "@playwright/test";
import sharp from "sharp";
import { navigate } from "./navigation";
test("radar displays loaded frame time and keeps it when another frame fails", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 560 });
  const png = await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 0, g: 80, b: 255, alpha: 0.1 },
    },
  })
    .png()
    .toBuffer();
  const now = Math.floor(Date.now() / 1000),
    old = now - 600;
  await page.route("**/api/briefing", (r) =>
    r.fulfill({
      json: {
        settings: {
          enabled: true,
          ticker: false,
          location: "Tulsa, Oklahoma",
          latitude: 36.154,
          longitude: -95.993,
          radiusMiles: 300,
          magnitude: 2.5,
          globalMagnitude: 6,
        },
        events: [],
        acknowledged: [],
        feeds: {
          forecast: { stale: false, data: { timezone: "America/Chicago" } },
        },
      },
    }),
  );
  await page.route("**/api/briefing/radar", (r) =>
    r.fulfill({
      json: {
        stale: false,
        data: {
          host: "https://tilecache.rainviewer.com",
          frames: [
            { time: old, path: "/v2/radar/oldframe" },
            { time: now, path: "/v2/radar/currentframe" },
          ],
        },
      },
    }),
  );
  await page.route("https://tilecache.rainviewer.com/**", (r) =>
    r.request().url().includes("oldframe")
      ? r.abort()
      : r.fulfill({
          contentType: "image/png",
          body: png,
        }),
  );
  await page.goto("/");
  await navigate(page, "Field Briefing");
  await page.getByRole("button", { name: "Radar", exact: true }).click();
  await expect(page.locator(".radar-stamp strong")).toContainText(
    "Past radar",
    { timeout: 20000 },
  );
  expect(
    (await page.locator(".radar-canvas").boundingBox())!.height,
  ).toBeGreaterThan(200);
  await expect(
    page.getByLabel("Radar history", { exact: true }),
  ).toBeInViewport();
  const stamp = await page.locator(".radar-stamp strong").innerText();
  await page.getByLabel("Radar history", { exact: true }).fill("0");
  await expect(page.locator(".radar-error")).toContainText(
    "Some radar tiles could not load",
    { timeout: 20000 },
  );
  await expect(page.locator(".radar-stamp strong")).toHaveText(stamp);
  await expect(
    page.getByRole("button", { name: "Play radar animation", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Weather", exact: true }).click();
  await expect(page.locator(".radar-canvas")).toHaveCount(0);
});

test("unavailable radar is never presented as clear weather", async ({
  page,
}) => {
  await page.route("**/api/briefing/radar", (r) =>
    r.fulfill({ json: { stale: true, error: "unavailable" } }),
  );
  await page.goto("/");
  await navigate(page, "Field Briefing");
  await page.getByRole("button", { name: "Radar", exact: true }).click();
  await expect(page.locator(".radar-error")).toContainText(
    "No radar displayed",
  );
  await expect(
    page.getByRole("button", { name: "Play radar animation", exact: true }),
  ).toBeDisabled();
});

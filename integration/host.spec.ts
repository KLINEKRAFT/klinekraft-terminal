import { test, expect } from "@playwright/test";

test("built UI reads the real running service over its own origin", async ({
  page,
  request,
}) => {
  const response = await request.get("/api/system");
  expect(response.ok()).toBeTruthy();
  const snapshot = await response.json();
  expect(snapshot.source).toBe("host");
  expect(snapshot.memoryTotal).toBeGreaterThan(0);
  expect(snapshot.storageTotal).toBeGreaterThan(0);
  expect(snapshot.stale).toBe(false);
  expect(response.headers()["cache-control"]).toBe("no-store");
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.goto("/");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "09 Settings" })
    .click();
  await page.getByLabel("Dashboard data").selectOption("host");
  await expect(page.locator(".preview-badge")).toHaveText("LIVE COMPUTER");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "01 Home" })
    .click();
  await expect(page.locator(".device-label")).toContainText(
    snapshot.system.toUpperCase(),
  );
  await expect(page.locator(".metric-detail").nth(1)).toContainText(
    snapshot.memoryTotal.toFixed(1),
  );
  expect(
    await page
      .getByRole("meter", { name: "CPU LOAD" })
      .getAttribute("aria-valuenow"),
  ).not.toBeNull();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    1024,
  );
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(
    600,
  );
  await page.screenshot({ path: "test-results/real-host-dashboard.png" });
});

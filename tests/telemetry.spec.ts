import { test, expect } from "@playwright/test";

const snapshot = {
  source: "host",
  sampledAt: new Date().toISOString(),
  stale: false,
  system: "macOS",
  architecture: "arm64",
  cpu: 25,
  cpuCores: 8,
  memoryUsed: 4,
  memoryTotal: 16,
  storageUsed: 64,
  storageTotal: 512,
  temperature: null,
  interfaces: [{ name: "en0", isUp: true }],
};

async function selectHost(page: import("@playwright/test").Page) {
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "09 Settings" })
    .click();
  await page.getByLabel("Dashboard data").selectOption("host");
}

test("live mode shows host readings and marks failed samples stale, then recovers", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 600 });
  let fail = false;
  await page.route("**/api/system", (route) =>
    fail
      ? route.fulfill({ status: 503, body: "Unavailable" })
      : route.fulfill({ json: snapshot }),
  );
  await page.goto("/");
  await selectHost(page);
  await expect(page.locator(".preview-badge")).toHaveText("LIVE COMPUTER");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "01 Home" })
    .click();
  await expect(page.locator(".device-label")).toContainText("MACOS");
  await expect(page.getByRole("meter", { name: "MEMORY" })).toHaveAttribute(
    "aria-valuenow",
    "25",
  );
  await expect(page.getByRole("meter", { name: "STORAGE" })).toHaveAttribute(
    "aria-valuenow",
    "12.5",
  );
  await expect(page.locator(".connections")).toContainText("No sensor reading");
  await expect(page.locator(".connections")).not.toContainText("41.8781");
  await page.screenshot({ path: "docs/screenshots/home-live-1024x600.png" });
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(
    600,
  );
  fail = true;
  await expect(page.locator(".preview-badge")).toHaveText("STALE READINGS", {
    timeout: 10000,
  });
  await expect(page.getByRole("meter", { name: "CPU LOAD" })).toHaveAttribute(
    "aria-valuenow",
    "25",
  );
  fail = false;
  await expect(page.locator(".preview-badge")).toHaveText("LIVE COMPUTER", {
    timeout: 10000,
  });
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "07 Network" })
    .click();
  await expect(page.locator(".network-list")).toContainText("en0");
  await expect(page.locator(".network-list")).toContainText("Link up");
});

test("missing or invalid backend never substitutes simulated data", async ({
  page,
}) => {
  await page.route("**/api/system", (route) =>
    route.fulfill({ json: { ...snapshot, cpu: "invalid" } }),
  );
  await page.goto("/");
  await selectHost(page);
  await expect(page.locator(".preview-badge")).toHaveText("SERVICE OFFLINE");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "01 Home" })
    .click();
  await expect(page.locator(".metric-value").first()).toHaveText("—%");
  await expect(page.locator(".connections")).not.toContainText("43.2");
});

test("switching back to preview discards an in-flight live response", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested!: () => void;
  const started = new Promise<void>((resolve) => {
    requested = resolve;
  });
  await page.route("**/api/system", async (route) => {
    requested();
    await gate;
    await route.fulfill({ json: snapshot }).catch(() => {});
  });
  await page.goto("/");
  await selectHost(page);
  await started;
  await page.getByLabel("Dashboard data").selectOption("preview");
  release();
  await expect(page.locator(".preview-badge")).toHaveText("SIMULATED DATA");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "01 Home" })
    .click();
  await expect(page.locator(".device-label")).toContainText("RASPBERRY PI 5");
});

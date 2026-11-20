import { navigate } from "./navigation";
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

const dataStatus = (page: import("@playwright/test").Page, name: string) =>
  page.getByRole("img", { name, exact: true });

async function selectHost(page: import("@playwright/test").Page) {
  await navigate(page, 'Settings');
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
  await expect(dataStatus(page, "Live computer")).toBeVisible();
  // Live data is a lone dot; no status word.
  await expect(dataStatus(page, "Live computer")).toHaveText("");
  await navigate(page, 'Home');
  await expect(page.locator(".device-label")).toContainText("macOS");
  await expect(page.getByRole("meter", { name: "Memory" })).toHaveAttribute(
    "aria-valuenow",
    "25",
  );
  await expect(page.getByRole("meter", { name: "Storage" })).toHaveAttribute(
    "aria-valuenow",
    "12.5",
  );
  const status = page.getByRole("region", { name: "Device status" });
  await expect(status).toContainText("No sensor reading");
  await expect(status).not.toContainText("41.8781");
  await expect(
    page.getByRole("region", { name: "Resources" }),
  ).toContainText("25%");
  await page.screenshot({ path: "test-results/home-live-1024x600.png" });
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(
    600,
  );
  fail = true;
  await expect(dataStatus(page, "Stale readings")).toBeVisible({
    timeout: 10000,
  });
  // A touchscreen has no tooltip, so the stale state says so in words.
  await expect(dataStatus(page, "Stale readings")).toHaveText("Stale");
  await expect(
    dataStatus(page, "Stale readings").locator(".k-status-dot"),
  ).toHaveAttribute("data-state", "warn");
  // The last CPU reading stays on screen while stale.
  await expect(
    page
      .getByRole("region", { name: "Resources" })
      .locator(".deck-resource")
      .first(),
  ).toContainText("25%");
  fail = false;
  await expect(dataStatus(page, "Live computer")).toBeVisible({
    timeout: 10000,
  });
  await navigate(page, 'Network');
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
  await expect(dataStatus(page, "Service offline")).toBeVisible();
  await navigate(page, 'Home');
  await expect(
    page.getByRole("region", { name: "Resources" }).locator("strong").first(),
  ).toHaveText("—");
  await expect(
    page.getByRole("region", { name: "Device status" }),
  ).not.toContainText("°F");
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
  await expect(dataStatus(page, "Simulated data")).toBeVisible();
  // Simulated looks different from stale: its own word and dot colour.
  await expect(dataStatus(page, "Simulated data")).toHaveText("Simulated");
  await expect(
    dataStatus(page, "Simulated data").locator(".k-status-dot"),
  ).toHaveAttribute("data-state", "sim");
  await navigate(page, 'Home');
  await expect(page.locator(".device-label")).toContainText("Raspberry Pi 5");
});

import { test, expect } from "@playwright/test";
test("live graphs accumulate unique samples and System shows read-only processes", async ({
  page,
}) => {
  let sample = 0;
  await page.route("**/api/system", (route) =>
    route.fulfill({
      json: {
        source: "host",
        sampledAt: new Date(Date.now() + sample++).toISOString(),
        stale: false,
        system: "Linux",
        architecture: "aarch64",
        cpu: 15 + sample,
        cpuCores: 4,
        memoryUsed: 2,
        memoryTotal: 8,
        storageUsed: 14,
        storageTotal: 125,
        temperature: 45,
        interfaces: [{ name: "wlan0", isUp: true }],
        networkDownload: 2500,
        networkUpload: 1200,
      },
    }),
  );
  await page.route("**/api/processes", (route) =>
    route.fulfill({
      json: {
        sampledAt: new Date().toISOString(),
        stale: false,
        processes: [
          { pid: 42, name: "chromium", cpu: 5.2, memoryBytes: 125000000 },
        ],
      },
    }),
  );
  await page.goto("/");
  await expect(page.getByText("↓ 2.5 kB/s")).toBeVisible();
  await expect
    .poll(() => page.locator(".metric .graph-line").first().getAttribute("d"), {
      timeout: 8000,
    })
    .toContain("L");
  await page.getByRole("button", { name: "08 System", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Resource history" }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "chromium", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "125.0 MB", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Processes" })).toContainText(
    "READ ONLY",
  );
  await page.getByRole("button", { name: "01 Home", exact: true }).click();
  await expect(page.locator(".metric .graph-line").first()).not.toHaveAttribute(
    "d",
    "",
  );
});

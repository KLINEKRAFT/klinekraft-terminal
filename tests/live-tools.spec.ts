import { test, expect } from "@playwright/test";
const snapshot = {
  source: "host",
  sampledAt: new Date().toISOString(),
  stale: false,
  system: "Linux",
  architecture: "aarch64",
  cpu: 7,
  cpuCores: 4,
  memoryUsed: 2,
  memoryTotal: 8,
  storageUsed: 14,
  storageTotal: 125,
  temperature: 45,
  interfaces: [],
  batteryPercent: 5,
  batteryVoltage: 3.6,
  batteryStatus: "Estimated charge",
};
test("local mode defaults live, persists choices and never falls back to simulated on failure", async ({
  page,
}) => {
  await page.route("**/api/system", (route) =>
    route.fulfill({ json: snapshot }),
  );
  await page.goto("/");
  await expect(page.getByText("LIVE COMPUTER", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "09 Settings", exact: true }).click();
  await page.getByLabel("Dashboard data").selectOption("preview");
  await page.reload();
  await expect(page.getByText("SIMULATED DATA", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "09 Settings", exact: true }).click();
  await page.getByLabel("Dashboard data").selectOption("host");
  await page.unroute("**/api/system");
  await page.route("**/api/system", (route) =>
    route.fulfill({ status: 503, json: { detail: "offline" } }),
  );
  await page.reload();
  await expect(
    page.getByText("SERVICE OFFLINE", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("SIMULATED DATA", { exact: true })).toHaveCount(
    0,
  );
});
test("Tools launches an installed allowlisted utility and disables missing utilities", async ({
  page,
}) => {
  await page.route("**/api/tools", (route) =>
    route.fulfill({
      json: {
        tools: [
          {
            id: "files",
            title: "Files · nnn",
            description: "Browse local files.",
            unavailable: null,
          },
          {
            id: "music",
            title: "Music · cmus",
            description: "Local music.",
            unavailable: "Utility is not installed.",
          },
        ],
      },
    }),
  );
  let launches = 0;
  await page.route("**/api/tools/launch", (route) => {
    launches++;
    expect(route.request().postDataJSON()).toEqual({ tool_id: "files" });
    expect(route.request().headers()["x-klinekraft-client"]).toBe("local-ui");
    return route.fulfill({ json: { requested: true } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Tools", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Open Music · cmus" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Open Files · nnn" }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "terminal window",
  );
  expect(launches).toBe(1);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

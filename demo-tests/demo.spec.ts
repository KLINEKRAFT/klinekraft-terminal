import { test, expect } from "@playwright/test";

test("hosted demo keeps navigation working without a local service", async ({
  page,
}) => {
  const apiRequests: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/"))
      apiRequests.push(request.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.addInitScript(() =>
    localStorage.setItem("klinekraft.dataMode.v1", "host"),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Tools", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "web demo cannot open desktop utilities",
  );
  await page.getByRole("button", { name: "Close Tools" }).click();
  await expect(page.getByText("SIMULATED DATA", { exact: true })).toBeVisible();
  for (const name of [
    "Games",
    "AI assistant",
    "GPS / Maps",
    "Library",
    "Files",
    "Network",
    "System",
    "Settings",
  ]) {
    await page
      .getByRole("navigation")
      .getByRole("button", { name: new RegExp(name) })
      .click();
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  }
  await expect(page.getByLabel("Dashboard data")).toBeDisabled();
  await expect(page.locator('option[value="host"]')).toHaveCount(0);
  await expect(
    page.getByText("Web demo · simulated data.", { exact: false }),
  ).toBeVisible();
  await page.waitForTimeout(3500); // Observe beyond the telemetry polling interval.
  expect(apiRequests).toEqual([]);
  expect(errors).toEqual([]);
});

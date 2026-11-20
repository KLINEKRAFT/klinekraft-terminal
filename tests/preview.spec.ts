import { navigate } from "./navigation";
import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("klinekraft.dataMode.v1", "preview"),
  );
});
for (const [width, height] of [
  [1024, 600],
  [1280, 720],
  [1920, 1080],
]) {
  test(`dashboard fits ${width} × ${height} and works without external requests`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/*", (route) =>
      route.request().url().startsWith("http://127.0.0.1:4173")
        ? route.continue()
        : route.abort(),
    );
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await expect(
      page.getByRole("heading", {
        name: "Home",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText("SIMULATED DATA", { exact: true }),
    ).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
    }));
    await page.screenshot({
      path: `test-results/home-${width}x${height}.png`,
      animations: "disabled",
      fullPage: true,
    });
    expect(dimensions.width).toBe(width);
    expect(dimensions.height).toBe(height);
    expect(errors).toEqual([]);
  });
}
test("navigation, commands and settings remain honest", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.goto("/");
  await page.route("**/api/games", (route) =>
    route.fulfill({
      json: { games: [], systems: {}, running: null, lastExitCode: null },
    }),
  );
  await navigate(page, "Games");
  await expect(
    page.getByRole("heading", { name: "No games yet", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("bash scripts/setup-games.sh", { exact: false }),
  ).toBeVisible();
  await navigate(page, "Home");
  await page
    .getByLabel("Workspace command", { exact: true })
    .fill("play paperboy; touch /tmp/unwanted");
  await page.getByRole("button", { name: "Run workspace command" }).click();
  await expect(
    page.getByRole("status", { name: "Command result" }),
  ).toContainText("Typed commands never launch an emulator");
  await navigate(page, "Home");
  await page
    .getByLabel("Workspace command", { exact: true })
    .fill("system status");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "System", exact: true }),
  ).toBeVisible();
  await navigate(page, "Settings");
  const toggle = page.getByRole("switch", { name: "Automatic updates" });
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  await page.keyboard.press("Control+k");
  await expect(
    page.getByRole("searchbox", { name: "Search Terminal", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Return to desktop" }).click();
  await expect(page.getByRole("dialog")).toContainText("Alt + F4");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("all navigation sections render and unknown commands stay bounded", async ({
  page,
}) => {
  await page.goto("/");
  for (const name of [
    "Games",
    "Shackleton",
    "GPS / Maps",
    "Library",
    "Files",
    "Network",
    "System",
    "Settings",
  ]) {
    await navigate(page, name);
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  }
  await navigate(page, "Home");
  await page
    .getByLabel("Workspace command", { exact: true })
    .fill("constructor");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("status", { name: "Command result" }),
  ).toContainText("This is not a shell");
});

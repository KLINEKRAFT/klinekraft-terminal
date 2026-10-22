import { test, expect } from "@playwright/test";
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
        name: /Good (morning|afternoon|evening), Colin/,
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
  await page.getByRole("button", { name: "Play something" }).click();
  await expect(
    page.getByText("No games have been imported.", { exact: false }),
  ).toBeVisible();
  await page
    .getByLabel("Workspace command", { exact: true })
    .fill("play paperboy; touch /tmp/unwanted");
  await page.getByRole("button", { name: "Run workspace command" }).click();
  await expect(
    page.getByRole("status", { name: "Command result" }),
  ).toContainText("No emulator or ROM was opened");
  await page
    .getByLabel("Workspace command", { exact: true })
    .fill("system status");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "System", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "09 Settings" }).click();
  const toggle = page.getByRole("checkbox");
  await toggle.uncheck();
  await expect(toggle).not.toBeChecked();
  await page.keyboard.press("Control+k");
  await expect(
    page.getByLabel("Workspace command", { exact: true }),
  ).toBeFocused();
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
      .getByRole("button", { name: new RegExp(name.replace("/", "\\/")) })
      .click();
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  }
  await page
    .getByLabel("Workspace command", { exact: true })
    .fill("constructor");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("status", { name: "Command result" }),
  ).toContainText("This is not a shell");
});

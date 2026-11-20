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
      new URL(route.request().url()).hostname === "127.0.0.1"
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
      page.getByRole("img", { name: "Simulated data", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Device status", exact: true }),
    ).toBeInViewport();
    await expect(page.getByLabel("Quick notes")).toBeInViewport();
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
test("navigation, search shortcuts and settings remain honest", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.goto("/");
  await page.route("**/api/games", (route) =>
    route.fulfill({
      json: { games: [], systems: {}, running: null, lastExitCode: null },
    }),
  );
  await navigate(page, "Games");
  await expect(
    page.getByText("Your library is ready for its first games.", {
      exact: false,
    }),
  ).toBeVisible();
  await navigate(page, "Home");
  // The old command bar is gone; search is the single way to jump by name.
  await expect(page.getByLabel("Workspace command")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Go Home", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("/");
  const search = page.getByRole("searchbox", {
    name: "Search Terminal",
    exact: true,
  });
  await expect(search).toBeFocused();
  await search.fill("processes");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "System", exact: true }),
  ).toBeVisible();
  await navigate(page, "Settings");
  const toggle = page.getByRole("checkbox", { name: /Automatic updates/ });
  await toggle.uncheck();
  await expect(toggle).not.toBeChecked();
  const dark = page.getByRole("switch", { name: "Dark mode", exact: true });
  await expect(dark).toHaveAttribute("aria-checked", "false");
  await dark.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("button", { name: "Dark mode", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  // Typing "/" in a field types a slash; it never steals focus for search.
  const url = page.getByLabel("Default launch URL");
  await url.fill("a/b");
  await expect(url).toHaveValue("a/b");
  await expect(page.getByRole("dialog")).toHaveCount(0);
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

test("all navigation sections render with one consistent header", async ({
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
  await expect(
    page.getByRole("button", { name: "Search Terminal", exact: true }),
  ).toBeVisible();
});

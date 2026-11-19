import { test, expect } from "@playwright/test";
import { navigate } from "./navigation";
test("map panels collapse after selecting a place, explicit address search and route endpoints", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 600 });
  let searches = 0;
  await page.route("**/api/maps/search", (r) => {
    searches++;
    return r.fulfill({
      json: {
        results: [
          { name: "Test matched address", latitude: 36.15, longitude: -95.99 },
        ],
        cached: false,
      },
    });
  });
  await page.route("**/api/maps/gps", (r) =>
    r.fulfill({
      json: {
        available: false,
        message: "No fresh GPS fix · check receiver and gpsd",
      },
    }),
  );
  await page.goto("/");
  await navigate(page, "GPS / Maps");
  await expect(
    page.getByRole("button", { name: "Tulsa", exact: true }),
  ).toBeEnabled({ timeout: 20000 });
  await page.getByRole("button", { name: "Places", exact: true }).click();
  await page.getByLabel("Search map collection").fill("Yellowstone");
  await page.getByRole("button", { name: /Yellowstone National Park/ }).click();
  await expect(
    page.getByLabel("Map tools panel", { exact: true }),
  ).not.toBeVisible();
  await expect(page.locator(".atlas-pinbar")).toContainText(
    "Yellowstone National Park",
  );
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.locator(".route-endpoint").first()).toContainText(
    "Yellowstone National Park",
  );
  await page.getByRole("button", { name: "Find", exact: true }).click();
  await page.getByLabel("US address", { exact: true }).fill("Test address");
  expect(searches).toBe(0);
  await page.getByRole("button", { name: "Find address", exact: true }).click();
  await page.getByRole("button", { name: /Test matched address/ }).click();
  expect(searches).toBe(1);
  await page.getByRole("button", { name: "Destination", exact: true }).click();
  await expect(page.locator(".route-endpoint").last()).toContainText(
    "Test matched address",
  );
  await expect(
    page.getByRole("button", { name: "Plan offline route", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "⇅ Swap endpoints", exact: true })
    .click();
  await expect(page.locator(".route-endpoint").first()).toContainText(
    "Test matched address",
  );
  await page.getByRole("button", { name: "Layers", exact: true }).click();
  await page
    .getByRole("button", { name: "Satellite Online", exact: true })
    .click();
  await expect(page.locator(".atlas-mode")).toContainText("SATELLITE · ONLINE");
  await page
    .getByRole("button", { name: "Street Offline", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "GPS", exact: true })).toBeDisabled();
  await expect(page.locator(".atlas-gps-status")).toContainText(
    "No fresh GPS fix",
  );
  await page
    .getByRole("button", { name: "Enter fullscreen", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Layers", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      document.fullscreenElement?.classList.contains("atlas-workspace"),
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Exit fullscreen", exact: true })
    .click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    1024,
  );
});

test("offline collection search works without remote services and pin names reset on map clicks", async ({
  page,
}) => {
  await page.route("https://**", (r) => r.abort());
  await page.goto("/");
  await navigate(page, "GPS / Maps");
  await page.getByLabel("US address").fill("Yellowstone");
  await page.getByRole("button", { name: /Yellowstone National Park/ }).click();
  await expect(page.locator(".atlas-pinbar")).toContainText(
    "Yellowstone National Park",
  );
  await page
    .locator(".offline-map-canvas")
    .click({ position: { x: 460, y: 180 } });
  await expect(page.locator(".atlas-pinbar strong")).not.toHaveText(
    "Yellowstone National Park",
  );
});

test.describe("small-screen map resources", () => {
  test.use({ deviceScaleFactor: 2 });
  test("map resizes on a dense display and releases its canvas when leaving", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 600 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await navigate(page, "GPS / Maps");
    await expect(
      page.getByRole("button", { name: "Tulsa", exact: true }),
    ).toBeEnabled({ timeout: 20000 });
    const canvas = page.locator(".offline-map-canvas canvas.maplibregl-canvas");
    await expect(canvas).toHaveCount(1);
    await expect
      .poll(() =>
        canvas.evaluate(
          (element: HTMLCanvasElement) =>
            element.width === element.clientWidth &&
            element.height === element.clientHeight,
        ),
      )
      .toBe(true);
    await page.setViewportSize({ width: 900, height: 600 });
    await expect
      .poll(() =>
        canvas.evaluate(
          (element: HTMLCanvasElement) =>
            element.width === element.clientWidth && element.width <= 900,
        ),
      )
      .toBe(true);
    await navigate(page, "Home");
    await expect(page.locator("canvas.maplibregl-canvas")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

import { test, expect } from "@playwright/test";
import sharp from "sharp";
import { navigate } from "./navigation";
// Hermetic: no street region is installed, so the built-in US outline is the
// basemap. Every map feature below must still work on it.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/maps", (r) =>
    r.fulfill({ json: { available: false } }),
  );
  await page.route("https://basemap.nationalmap.gov/**", (r) => r.abort());
});
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
    .getByRole("button", { name: "Outline Offline", exact: true })
    .click();
  await expect(page.locator(".atlas-mode")).toContainText(
    "US OUTLINE · OFFLINE",
  );
  await expect(
    page.getByRole("button", { name: "GPS", exact: true }),
  ).toBeDisabled();
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

test("without a street region the map is never blank and explains how to install one", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 560 });
  await page.route("**/api/maps/gps", (r) =>
    r.fulfill({
      json: {
        available: false,
        connected: false,
        message: "GPS receiver not connected",
      },
    }),
  );
  // A view saved from a street or satellite session, deep past anything the
  // outline can show.
  await page.addInitScript(() =>
    localStorage.setItem(
      "klinekraft.map-view.v1",
      JSON.stringify({ center: [-95.99, 36.15], zoom: 14 }),
    ),
  );
  const outline = page.waitForResponse("**/maps/us-states.geojson");
  await page.goto("/");
  await navigate(page, "GPS / Maps");
  expect((await outline).ok()).toBe(true);
  // The bundled outline renders and the map becomes interactive.
  await expect(
    page.getByRole("button", { name: "Tulsa", exact: true }),
  ).toBeEnabled({ timeout: 20000 });
  await expect(page.locator(".atlas-mode")).toHaveText("US OUTLINE · OFFLINE");
  // The saved zoom 14 is clamped to the outline's limit (zoom 7), where
  // borders are still on screen: Zoom in is disabled at the cap.
  const zoomIn = page.getByRole("button", { name: "Zoom in", exact: true });
  await expect(zoomIn).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Zoom out", exact: true }),
  ).toBeEnabled();
  // A permanent, non-dismissible note says what is missing in one row...
  const card = page.getByRole("region", { name: "Install street maps" });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Street maps not installed");
  await expect(card.locator("code")).toBeHidden();
  const collapsed = await card.boundingBox();
  expect(collapsed!.height).toBeLessThan(56);
  expect(collapsed!.width).toBeLessThanOrEqual(320);
  await expect(
    card.getByRole("button", { name: "Copy install command", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Dismiss map status")).toHaveCount(0);
  // ...and opens on demand to the exact install command.
  await card.getByText("How to install", { exact: true }).click();
  await expect(card.locator("code")).toBeVisible();
  await expect(card.locator("code")).toHaveText(
    "python3 scripts/setup-maps.py \\\n  --pmtiles /path/to/pmtiles \\\n  --source https://build.protomaps.com/20261113.pmtiles",
  );
  // Open or closed, it never covers the map controls.
  const zoom = await zoomIn.boundingBox();
  const cardBox = await card.boundingBox();
  expect(cardBox!.y).toBeGreaterThan(zoom!.y + zoom!.height);
  await card.getByText("How to install", { exact: true }).click();
  await expect(card.locator("code")).toBeHidden();
  // GPS stays present and reads as temporarily disconnected, not unsupported.
  await expect(page.locator(".atlas-gps-status")).toContainText(
    "GPS disconnected",
  );
  await expect(
    page.getByRole("button", { name: "GPS", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Follow", exact: true }),
  ).toBeVisible();
  // Camera moves work on the outline.
  await page.getByRole("button", { name: "Tulsa", exact: true }).click();
  await expect(page.locator(".atlas-pinbar")).toContainText("Tulsa, Oklahoma");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const view = JSON.parse(
          localStorage.getItem("klinekraft.map-view.v1") || "null",
        );
        return !!view && Math.round(view.center[0]) === -96 && view.zoom >= 5;
      }),
    )
    .toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    1024,
  );
});

test("map points and pins recolor when the theme changes", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.goto("/");
  await navigate(page, "GPS / Maps");
  await expect(
    page.getByRole("button", { name: "Tulsa", exact: true }),
  ).toBeEnabled({ timeout: 20000 });
  await page
    .getByRole("button", { name: "Close map panel", exact: true })
    .click();
  // Only the WebGL layers count: hide DOM chrome and markers over the map.
  await page.addStyleTag({
    content:
      ".atlas-notices,.atlas-gps-status,.atlas-mode,.maplibregl-control-container,.maplibregl-marker{visibility:hidden!important}",
  });
  // Counts map pixels painted in one accent color (the collection points).
  const accentPixels = async (rgb: [number, number, number]) => {
    const { data, info } = await sharp(
      await page.locator(".offline-map-canvas canvas").screenshot(),
    )
      .raw()
      .toBuffer({ resolveWithObject: true });
    let count = 0;
    for (let i = 0; i < data.length; i += info.channels)
      if (rgb.every((v, c) => Math.abs(data[i + c] - v) <= 10)) count++;
    return count;
  };
  const logoBlue: [number, number, number] = [0x02, 0x27, 0xff];
  const darkAccent: [number, number, number] = [0x8e, 0xa2, 0xff];
  await expect
    .poll(() => accentPixels(logoBlue), { timeout: 10000 })
    .toBeGreaterThan(20);
  await page.getByRole("button", { name: "Tulsa", exact: true }).click();
  const pinFill = page.locator(
    ".k-map-pin--selection svg > g > g:nth-child(2)",
  );
  await expect(pinFill).toHaveCSS("fill", "rgb(255, 106, 0)");
  await page.getByTitle("Switch to dark mode").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  // Overlays follow --accent-fg: light blue on the dark outline, and none of
  // the low-contrast logo blue is left behind.
  await expect
    .poll(() => accentPixels(darkAccent), { timeout: 10000 })
    .toBeGreaterThan(20);
  expect(await accentPixels(logoBlue)).toBe(0);
  await expect(pinFill).toHaveCSS("fill", "rgb(255, 106, 0)");
  // The radar's location pin is token-styled, so it switches with the theme.
  await navigate(page, "Field Briefing");
  await page.getByRole("button", { name: "Radar", exact: true }).click();
  const radarPin = page.locator(".k-map-pin--accent svg > g > g:nth-child(2)");
  await expect(radarPin).toHaveCSS("fill", "rgb(142, 162, 255)", {
    timeout: 20000,
  });
  await page.getByTitle("Switch to light mode").click();
  await expect(radarPin).toHaveCSS("fill", "rgb(2, 39, 255)");
});

test("an installed street region shows street mode and region warnings", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.route("**/api/maps", (r) =>
    r.fulfill({
      json: {
        available: true,
        title: "Test region",
        bounds: [-125, 24, -66, 50],
        center: [-96, 36],
        maxzoom: 14,
        bytes: 2 * 1024 ** 3,
        views: [{ name: "Test valley", center: [-110, 44], zoom: 9 }],
      },
    }),
  );
  // A valid PMTiles v3 archive holding no tiles: the real street style and
  // pmtiles protocol load, and every tile reads back empty without errors.
  const archive = Buffer.alloc(130);
  archive.write("PMTiles", 0, "latin1");
  archive.writeUInt8(3, 7); // spec version
  archive.writeBigUInt64LE(127n, 8); // root directory: one byte, 0 entries
  archive.writeBigUInt64LE(1n, 16);
  archive.writeBigUInt64LE(128n, 24); // metadata: "{}"
  archive.writeBigUInt64LE(2n, 32);
  archive.writeBigUInt64LE(130n, 40); // no leaf directories or tile data
  archive.writeBigUInt64LE(130n, 56);
  archive.writeUInt8(1, 97); // internal compression: none
  archive.writeUInt8(1, 98); // tile compression: none
  archive.writeUInt8(1, 99); // tile type: MVT
  archive.writeUInt8(14, 101); // max zoom
  archive.writeInt32LE(-125e7, 102);
  archive.writeInt32LE(24e7, 106);
  archive.writeInt32LE(-66e7, 110);
  archive.writeInt32LE(50e7, 114);
  archive.write("{}", 128, "latin1");
  await page.route("**/api/maps/region.pmtiles", (r) =>
    r.fulfill({ body: archive, contentType: "application/octet-stream" }),
  );
  await page.route("**/api/maps/fonts/**", (r) =>
    r.fulfill({ status: 404, body: "" }),
  );
  await page.goto("/");
  await navigate(page, "GPS / Maps");
  await expect(
    page.getByRole("button", { name: "Tulsa", exact: true }),
  ).toBeEnabled({ timeout: 20000 });
  await expect(page.locator(".atlas-mode")).toHaveText("STREET · OFFLINE");
  await expect(
    page.getByRole("region", { name: "Install street maps" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Layers", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Street Offline", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".atlas-layers")).toContainText("2.0 GB saved");
  await expect(
    page.getByRole("button", { name: "Test valley", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Go to coordinates", { exact: true }).fill("60, 10");
  await page.getByRole("button", { name: "Go", exact: true }).click();
  await expect(page.locator(".atlas-status")).toContainText(
    "Those coordinates are outside the downloaded region.",
  );
  // Street detail goes deeper than the outline's zoom 7 cap.
  await expect(
    page.getByRole("button", { name: "Zoom in", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Tulsa", exact: true }).click();
  await expect(page.locator(".atlas-status")).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("klinekraft.map-view.v1") || "null")
            ?.zoom,
      ),
    )
    .toBe(14);
});

import { test, expect } from "@playwright/test";
import { navigate } from "./navigation";

test("GPS home compass, saved spots, route start and lost fix", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 600 });
  let available = true;
  let course: number | null = null;
  let saved: any;
  await page.route("**/api/maps/gps", r => r.fulfill({json:{
    available, connected:true, message:available ? "GPS fix · 3D" : "GPS connected · waiting for a fresh satellite fix",
    latitude:36.15, longitude:-96, fixAt:new Date().toISOString(), mode:3,
    satellitesUsed:11, satellitesVisible:15, courseDegrees:course,
  }}));
  await page.route("**/api/maps/places", async r => {
    if (r.request().method() === "POST") {
      saved = r.request().postDataJSON();
      await r.fulfill({json:saved});
    } else await r.fulfill({json:[]});
  });
  await page.goto("/");
  await navigate(page, "Home");
  await page.getByLabel("GPS and compass information").click();
  await expect(page.locator(".gps-details")).toContainText("11/15 satellites");
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Travel direction unavailable")).toBeVisible();
  course = 90;
  await expect(page.getByLabel("Travel direction E 90 degrees true")).toBeVisible({timeout:10000});
  await page.screenshot({path:"test-results/gps-home.png"});
  expect(await page.locator("main").evaluate(e => e.scrollHeight <= e.clientHeight)).toBe(true);
  const tools = await page.locator(".home-tools").boundingBox();
  expect(tools!.y + tools!.height).toBeLessThanOrEqual(600);

  await page.getByRole("button", {name:/GPS · 3D fix/}).click();
  await expect(page.locator(".gps-position-dot")).toBeVisible({timeout:20000});
  await page.getByRole("button", {name:"Follow", exact:true}).click();
  await expect(page.getByRole("button", {name:"Follow", exact:true})).toHaveAttribute("aria-pressed","true");
  await page.getByRole("button", {name:"Save this spot", exact:true}).click();
  await page.getByLabel("Spot name").fill("Test campsite");
  await page.getByRole("button", {name:"Save spot", exact:true}).click();
  await expect.poll(() => saved?.name).toBe("Test campsite");
  expect(saved.latitude).toBe(36.15);
  expect(saved.longitude).toBe(-96);
  await page.getByRole("button", {name:"Route", exact:true}).click();
  await page.getByRole("button", {name:"Use GPS as start", exact:true}).click();
  await expect(page.locator(".route-endpoint").first()).toContainText("GPS position");
  await page.screenshot({path:"test-results/gps-maps.png"});
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1024);
  available = false;
  await expect(page.getByRole("button", {name:"GPS", exact:true})).toBeDisabled({timeout:10000});
  await expect(page.locator(".gps-position-dot")).toHaveCount(0);
  await expect(page.getByRole("button", {name:"Follow", exact:true})).toHaveAttribute("aria-pressed","false");
});

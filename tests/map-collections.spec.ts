import { test, expect } from "@playwright/test";
import { navigate } from "./navigation";
test("map collections search locally, addresses require submit, and basemaps switch", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 600 });
  let requests = 0;
  await page.route("**/api/maps/search", (r) => {
    requests++;
    return r.fulfill({
      json: {
        results: [
          { name: "Test matched address", latitude: 36.15, longitude: -95.99 },
        ],
        cached: false,
      },
    });
  });
  await page.goto("/");
  await navigate(page, "GPS / Maps");
  await expect(
    page.getByRole("button", { name: "Street · offline", exact: true }),
  ).toBeEnabled({ timeout: 20000 });
  await page.getByLabel("Search map collection").fill("Yellowstone");
  await expect(
    page.getByLabel("Choose map location").locator("option"),
  ).toHaveCount(2);
  await page.getByLabel("Choose map location").selectOption("nps-yell");
  await expect(page.locator(".map-location-detail")).toContainText(
    "Yellowstone National Park",
  );
  await page
    .getByRole("button", { name: "Street · offline", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Satellite · online", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Satellite · online", exact: true })
    .click();
  await page.getByLabel("US address", { exact: true }).fill("Test address");
  expect(requests).toBe(0);
  await page.getByRole("button", { name: "Find address", exact: true }).click();
  await page
    .getByRole("button", { name: "Test matched address", exact: true })
    .click();
  await expect(page.getByLabel("Place name", { exact: true })).toHaveValue(
    "Test matched address",
  );
  expect(requests).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    1024,
  );
});

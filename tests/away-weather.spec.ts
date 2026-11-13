import { test, expect } from "@playwright/test";

test("Away choices, palette, ticker, persistence and escape", async ({
  page,
}) => {
  await page.route("https://api.open-meteo.com/**", (route) =>
    route.fulfill({
      json: {
        current: { temperature_2m: 72.3, time: Math.floor(Date.now() / 1000) },
        current_units: { temperature_2m: "°F" },
      },
    }),
  );
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.goto("/");
  await expect(page.getByLabel("Tulsa outdoor temperature")).toContainText(
    "72°F",
  );
  await page.getByRole("button", { name: "Away", exact: false }).click();
  const dialog = page.getByRole("dialog", { name: "Away screen" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByLabel("Background", { exact: true }).locator("option"),
  ).toHaveCount(3);
  await dialog.getByLabel("Message", { exact: true }).fill("Back at 3 PM.");
  await dialog.getByLabel("Background", { exact: true }).selectOption("chrome");
  await dialog
    .getByLabel("Background color 1", { exact: true })
    .fill("#123456");
  await dialog.getByLabel("Ticker message").check();
  await dialog.getByLabel("Typeface").selectOption("mono");
  await dialog.getByRole("button", { name: "Start Away" }).click();
  await expect(dialog.locator(".away-ticker")).toBeVisible();
  await expect(dialog.locator(".away-settings")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "Away", exact: false }).click();
  await expect(dialog.getByLabel("Message", { exact: true })).toHaveValue(
    "Back at 3 PM.",
  );
  await expect(dialog.getByLabel("Background", { exact: true })).toHaveValue(
    "chrome",
  );
  await expect(
    dialog.getByLabel("Background color 1", { exact: true }),
  ).toHaveValue("#123456");
  await expect(dialog.getByLabel("Ticker message")).toBeChecked();
  await expect(dialog.getByLabel("Typeface")).toHaveValue("mono");
  await expect(dialog.locator(".away-render-note")).toHaveCount(0);
  await dialog
    .getByLabel("Background", { exact: true })
    .selectOption("contour");
  await page.waitForTimeout(250);
  await expect(dialog.locator(".away-render-note")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Close Away" }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("offline weather is labeled last known; corrupt preferences recover", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "klinekraft.weather.tulsa.v1",
      JSON.stringify({ temperature: 68, time: Date.now() - 3600000 }),
    );
    localStorage.setItem("klinekraft.away.v1", "{invalid");
  });
  await page.route("https://api.open-meteo.com/**", (route) => route.abort());
  await page.goto("/");
  await expect(page.getByLabel("Tulsa outdoor temperature")).toContainText(
    "Last known",
  );
  await page.getByRole("button", { name: "Away", exact: false }).click();
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue(
    "Be right back.",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByLabel("Ticker message").check();
  await expect(page.locator(".away-ticker-track")).toHaveCSS(
    "animation-name",
    "none",
  );
});

test("Away enters and exits browser fullscreen", async ({ page }) => {
  await page.route("https://api.open-meteo.com/**", (route) => route.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "Away", exact: false }).click();
  await page
    .getByRole("button", { name: "Enter fullscreen", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => !!document.fullscreenElement))
    .toBeTruthy();
  await page
    .getByRole("button", { name: "Exit fullscreen", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => !!document.fullscreenElement))
    .toBeFalsy();
  await page.getByRole("button", { name: "Close Away" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

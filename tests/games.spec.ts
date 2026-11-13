import { test, expect } from "@playwright/test";
const games = [
  { id: "a".repeat(64), title: "NES sample", system: "nes" },
  { id: "b".repeat(64), title: "Genesis sample", system: "megadrive" },
];
test("library filters, favorites and explicit launch", async ({ page }) => {
  let running: string | null = null;
  let launches = 0;
  await page.route("**/api/games", (route) =>
    route.fulfill({
      json: {
        games,
        systems: { nes: null, megadrive: null },
        running,
        lastExitCode: null,
      },
    }),
  );
  await page.route("**/api/games/launch", (route) => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().headers()["x-klinekraft-client"]).toBe("local-ui");
    expect(route.request().postDataJSON()).toEqual({ game_id: games[1].id });
    running = games[1].id;
    launches++;
    return route.fulfill({ json: { started: true } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "02 Games", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Play NES sample", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("Search games").fill("Genesis");
  await expect(
    page.getByRole("button", { name: "Play NES sample", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Favorite Genesis sample", exact: true })
    .click();
  await page.reload();
  await page.getByRole("button", { name: "02 Games", exact: true }).click();
  await page.getByRole("button", { name: "Favorites", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Unfavorite Genesis sample",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Play NES sample", exact: true }),
  ).toHaveCount(0);
  expect(launches).toBe(0);
  await page
    .getByRole("button", { name: "Play Genesis sample", exact: true })
    .click();
  await expect(
    page.getByText("A game is running on the Pi.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Play Genesis sample", exact: true }),
  ).toBeDisabled();
  expect(launches).toBe(1);
});
test("missing emulator cannot launch and failed library is explicit", async ({
  page,
}) => {
  await page.route("**/api/games", (route) =>
    route.fulfill({
      json: {
        games,
        systems: {
          nes: "RetroArch is not installed.",
          megadrive: "Core missing",
        },
        running: null,
        lastExitCode: null,
      },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "02 Games", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Play NES sample", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Game system").selectOption("nes");
  await expect(
    page.getByRole("button", { name: "Play Genesis sample", exact: true }),
  ).toHaveCount(0);
  await page.route("**/api/games", (route) =>
    route.fulfill({ status: 503, json: { detail: "offline" } }),
  );
  await page
    .getByRole("button", { name: "Refresh games", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "game library is unavailable",
  );
  await expect(
    page.getByRole("button", { name: "Play NES sample", exact: true }),
  ).toHaveCount(0);
});

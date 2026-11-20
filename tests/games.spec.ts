import { navigate } from "./navigation";
import { test, expect } from "@playwright/test";
const games = [
  { id: "a".repeat(64), title: "NES sample", system: "nes" },
  { id: "b".repeat(64), title: "Genesis sample", system: "megadrive" },
];
test("library filters, favorites and explicit launch", async ({ page }) => {
  const favorites = new Set<string>();
  await page.route("**/api/games/favorites", (route) =>
    route.fulfill({ json: [...favorites] }),
  );
  await page.route("**/api/games/favorites/*", (route) => {
    const id = route.request().url().split("/").pop()!;
    if (route.request().postDataJSON().selected) favorites.add(id);
    else favorites.delete(id);
    return route.fulfill({ json: [...favorites] });
  });
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
  await navigate(page, "Games");
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
  await navigate(page, "Games");
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
  let state: "missing" | "ready" | "offline" = "missing";
  let launches = 0;
  await page.route("**/api/games", (route) =>
    state === "offline"
      ? route.fulfill({ status: 503, json: { detail: "offline" } })
      : route.fulfill({
          json: {
            games,
            systems:
              state === "missing"
                ? {
                    nes: "RetroArch is not installed.",
                    megadrive: "Core missing",
                  }
                : { nes: null, megadrive: null },
            running: null,
            lastExitCode: null,
          },
        }),
  );
  await page.route("**/api/games/launch", (route) => {
    launches++;
    return route.fulfill({ json: { started: true } });
  });
  await page.goto("/");
  await navigate(page, "Games");
  const play = page.getByRole("button", {
    name: "Play NES sample",
    exact: true,
  });
  await expect(play).toBeDisabled();
  await page.getByLabel("Game system").selectOption("nes");
  await expect(
    page.getByRole("button", { name: "Play Genesis sample", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Game system").selectOption("all");
  const refresh = page.getByRole("button", {
    name: "Refresh games",
    exact: true,
  });
  state = "ready";
  await refresh.click();
  await expect(play).toBeEnabled();
  const status = page
    .getByRole("status")
    .filter({ hasText: "Library offline · reconnecting…" });
  await expect(status).toHaveCount(0);
  // The library becomes unreachable: the last good list stays on screen,
  // every Play is disabled and the outage is stated plainly.
  state = "offline";
  await refresh.click();
  await expect(status).toBeVisible();
  await expect(page.locator(".game-list > li")).toHaveCount(2);
  await expect(play).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Play Genesis sample", exact: true }),
  ).toBeDisabled();
  // The automatic 5-second retry finds the service; Play comes back.
  state = "ready";
  await expect(status).toHaveCount(0, { timeout: 10000 });
  await expect(play).toBeEnabled();
  expect(launches).toBe(0);
  await play.click();
  await expect(page.getByText("NES sample opened on the Pi.")).toBeVisible();
  expect(launches).toBe(1);
});

test("a library that never loaded says so explicitly", async ({ page }) => {
  await page.route("**/api/games", (route) =>
    route.fulfill({ status: 503, json: { detail: "offline" } }),
  );
  await page.goto("/");
  await navigate(page, "Games");
  await expect(page.getByRole("alert")).toContainText(
    "game library is unavailable",
  );
  await expect(page.locator(".game-list")).toHaveCount(0);
});

test('Random shows a unique set, respects filters, and never launches games', async ({page}) => {
  const catalog = Array.from({length: 30}, (_, i) => ({id: i.toString(16).padStart(64, '0'), title: `Sample ${i}`, system: i < 20 ? 'nes' : 'snes'}));
  let launches = 0;
  await page.route('**/api/games', r => r.fulfill({json: {games: catalog, systems: {nes: null, snes: null}, running: null, lastExitCode: null}}));
  await page.route('**/api/games/favorites', r => r.fulfill({json: []}));
  await page.route('**/api/games/launch', r => { launches++; return r.fulfill({json: {started: true}}); });
  await page.goto('/');
  await navigate(page, 'Games');
  await page.getByRole('button', {name: 'Random', exact: true}).click();
  const cards = page.locator('.game-list > li');
  await expect(cards).toHaveCount(12);
  const first = await cards.locator('.game-title strong').allTextContents();
  expect(new Set(first).size).toBe(12);
  await page.getByRole('button', {name: 'Random', exact: true}).click();
  expect(await cards.locator('.game-title strong').allTextContents()).not.toEqual(first);
  await page.getByRole('button', {name: 'Show all', exact: true}).click();
  await expect(cards).toHaveCount(30);
  await page.getByLabel('Game system').selectOption('snes');
  await page.getByRole('button', {name: 'Random', exact: true}).click();
  await expect(cards).toHaveCount(10);
  for (const label of await cards.locator('.game-title span').allTextContents()) expect(label).toBe('Super Nintendo');
  await page.getByLabel('Search games').fill('no matching game');
  await expect(cards).toHaveCount(0);
  await expect(page.getByRole('button', {name: 'Random', exact: true})).toBeDisabled();
  expect(launches).toBe(0);
});

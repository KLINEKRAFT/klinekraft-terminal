import { test, expect } from "@playwright/test";
import { navigate } from "./navigation";
const settings = {
  enabled: true,
  ticker: true,
  location: "Tulsa",
  latitude: 36,
  longitude: -96,
  radiusMiles: 300,
  magnitude: 2.5,
  globalMagnitude: 6,
};
const fresh = {
  id: "official-1",
  title: "Test weather advisory",
  kind: "Weather",
  severity: "Moderate",
  text: "Test only",
  issued: Date.now() / 1000,
  stale: false,
  url: "https://weather.gov/",
  source: "NWS",
};
test("ticker hides stale events, acknowledges persist, and settings save explicitly", async ({
  page,
}) => {
  let acknowledged: string[] = [];
  await page.route("**/api/briefing", (r) =>
    r.fulfill({
      json: {
        settings,
        events: [
          fresh,
          { ...fresh, id: "old", title: "Old earthquake", stale: true },
        ],
        acknowledged,
        feeds: { weather: { stale: false, updated: Date.now() / 1000 } },
      },
    }),
  );
  await page.route("**/api/briefing/acknowledge", (r) => {
    acknowledged.push(r.request().postDataJSON().id);
    return r.fulfill({ json: { saved: true } });
  });
  await page.goto("/");
  await expect(page.locator(".event-ticker")).toContainText(fresh.title);
  await expect(page.locator(".event-ticker")).not.toContainText(
    "Old earthquake",
  );
  await page.getByRole("button", { name: "Acknowledge ticker event" }).click();
  await expect(page.locator(".event-ticker")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".event-ticker")).toHaveCount(0);
  await page.getByRole("button", { name: /Events and science/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("LAST KNOWN");
  await page.getByRole("button", { name: "Close events" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
test("scientific search saves a reference through the local endpoint", async ({
  page,
}) => {
  await page.route("**/api/briefing/research?*", (r) =>
    r.fulfill({
      json: {
        results: [
          {
            id: "W1",
            title: "Water research",
            provider: "OpenAlex",
            year: "2024",
            url: "https://openalex.org/W1",
            abstract: "A research abstract.",
            openAccess: true,
          },
        ],
        sources: [],
      },
    }),
  );
  let saved = false;
  await page.route("**/api/briefing/research/save", (r) => {
    expect(r.request().postDataJSON()).toMatchObject({
      id: "W1",
      query: "water",
    });
    saved = true;
    return r.fulfill({ json: { saved: true, id: 1 } });
  });
  await page.goto("/");
  await navigate(page, "Library");
  await page.getByRole("button", { name: "Research", exact: true }).click();
  await page.getByLabel("Search scientific research").fill("water");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText("A research abstract.")).toBeVisible();
  await page
    .getByRole("button", { name: "Save reference", exact: true })
    .click();
  await expect.poll(() => saved).toBe(true);
});
test("Shackleton renders readable Markdown safely and preserves external citations", async ({
  page,
}) => {
  await page.route("**/api/conversations**", (r) =>
    r.fulfill({
      json:
        r.request().method() === "PUT"
          ? { revision: 1, updated: new Date().toISOString() }
          : { chats: [] },
    }),
  );
  await page.route("**/api/ai/status", (r) =>
    r.fulfill({ json: { configured: true, local: { configured: true } } }),
  );
  await page.route("**/api/ai/ask", (r) =>
    r.fulfill({
      json: {
        answer:
          "## Field notes\n\n**Water** matters.\n\n- First item\n- Second item\n\n| Item | Value |\n| --- | --- |\n| Water | 2 |\n\n<script>alert(1)</script>\n\n[Unsafe](javascript:alert(1))",
        sources: [
          {
            id: 1,
            path: "",
            title: "Research paper",
            url: "https://openalex.org/W1",
          },
        ],
        images: [],
        notice: "",
      },
    }),
  );
  await page.goto("/");
  await navigate(page, "Shackleton");
  await page.getByLabel("Your question").fill("Show field notes");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.locator(".ai-answer h2")).toHaveText("Field notes");
  await expect(page.locator(".ai-answer li")).toHaveCount(2);
  await expect(page.locator(".ai-answer table")).toBeVisible();
  await expect(page.locator(".ai-answer script")).toHaveCount(0);
  await expect(page.locator('.ai-answer a[href^="javascript:"]')).toHaveCount(
    0,
  );
  await page.getByText("1 source", { exact: true }).click();
  await expect(
    page.getByRole("link", { name: "[1] Research paper", exact: true }),
  ).toHaveAttribute("href", "https://openalex.org/W1");
});

async function routeBriefing(
  page: import("@playwright/test").Page,
  events: object[],
  state: { offline: boolean },
) {
  await page.route("**/api/briefing", (r) =>
    state.offline
      ? r.fulfill({ status: 503, json: { detail: "offline" } })
      : r.fulfill({
          json: {
            settings,
            events,
            acknowledged: [],
            feeds: { weather: { stale: false, updated: Date.now() / 1000 } },
          },
        }),
  );
}
const severe = {
  ...fresh,
  id: "severe",
  title: "Severe test warning",
  severity: "Severe",
};

test("severe reports take priority and stay visible, marked stale, after a failed poll", async ({
  page,
}) => {
  const state = { offline: false };
  await page.clock.install();
  const now = Date.now() / 1000;
  await routeBriefing(
    page,
    [
      { ...fresh, expires: now + 3600 },
      { ...severe, expires: now + 3600 },
    ],
    state,
  );
  await page.goto("/");
  const ticker = page.locator(".event-ticker");
  await expect(ticker).toContainText("Severe test warning");
  await expect(ticker).not.toHaveAttribute("data-stale");
  await expect(ticker).not.toContainText("Last checked");
  // Severe outranks the moderate advisory through a rotation.
  await page.clock.fastForward(11000);
  await expect(ticker).toContainText("Severe test warning");
  state.offline = true;
  await page.clock.fastForward(30000);
  // One failed poll keeps the last good alert, visibly marked as not live.
  await expect(ticker).toContainText("Severe test warning");
  await expect(ticker).toHaveAttribute("data-stale", "true");
  await expect(ticker.locator(".event-ticker-stamp")).toHaveText(
    "Last checked under 1 min ago",
  );
  await expect(
    page.getByRole("button", { name: /Events and science: 2 unread/ }),
  ).toBeVisible();
  await page.clock.fastForward(90000);
  await expect(ticker.locator(".event-ticker-stamp")).toHaveText(
    /^Last checked 2 min ago$/,
  );
  // Contact returns: the stamp goes away.
  state.offline = false;
  await page.clock.fastForward(30000);
  await expect(ticker).not.toHaveAttribute("data-stale");
  await expect(ticker.locator(".event-ticker-stamp")).toHaveCount(0);
});

test("the ticker is withdrawn after more than 5 minutes without contact", async ({
  page,
}) => {
  const state = { offline: false };
  await page.clock.install();
  const now = Date.now() / 1000;
  await routeBriefing(page, [{ ...severe, expires: now + 7200 }], state);
  await page.goto("/");
  const ticker = page.locator(".event-ticker");
  await expect(ticker).toContainText("Severe test warning");
  state.offline = true;
  // Four and a half minutes of failed polls: still shown, stale.
  await page.clock.fastForward(270000);
  await expect(ticker).toContainText("Severe test warning");
  await expect(ticker.locator(".event-ticker-stamp")).toHaveText(
    "Last checked 4 min ago",
  );
  // Past five minutes: no live ticker and no unread count.
  await page.clock.fastForward(60000);
  await expect(ticker).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Events and science", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".alert-bell small")).toHaveText("!");
});

test("an alert past its expires time disappears even while the service is down", async ({
  page,
}) => {
  const state = { offline: false };
  await page.clock.install();
  const now = Date.now() / 1000;
  await routeBriefing(
    page,
    [
      { ...fresh, title: "Long advisory", expires: now + 3600 },
      { ...severe, expires: now + 90 },
    ],
    state,
  );
  await page.goto("/");
  const ticker = page.locator(".event-ticker");
  await expect(ticker).toContainText("Severe test warning");
  state.offline = true;
  await page.clock.fastForward(31000);
  await expect(ticker).toContainText("Severe test warning");
  await expect(ticker).toHaveAttribute("data-stale", "true");
  // The severe warning's own expiry passes while polls still fail.
  await page.clock.fastForward(75000);
  await expect(ticker).not.toContainText("Severe test warning");
  await expect(ticker).toContainText("Long advisory");
  await expect(ticker).toHaveAttribute("data-stale", "true");
  await expect(
    page.getByRole("button", { name: /Events and science: 1 unread/ }),
  ).toBeVisible();
});

test("Field Briefing defaults to Tulsa weather and separates events from science", async ({
  page,
}) => {
  const day = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Chicago",
  });
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.route("**/api/briefing", (r) =>
    r.fulfill({
      json: {
        settings: { ...settings, location: "Tulsa, Oklahoma" },
        events: [{ ...fresh, severity: "Severe" }],
        acknowledged: [fresh.id],
        feeds: {
          weather: { stale: false },
          earthquakes: { stale: false },
          space: { stale: false },
          forecast: {
            stale: false,
            updated: Date.now() / 1000,
            data: {
              timezone: "America/Chicago",
              current: {
                temperature_2m: 65,
                apparent_temperature: 64,
                weather_code: 0,
                wind_speed_10m: 7,
                relative_humidity_2m: 50,
                time: day + "T09:00",
              },
              daily: {
                time: [day],
                temperature_2m_min: [40],
                temperature_2m_max: [65],
                precipitation_probability_max: [10],
                weather_code: [0],
              },
            },
          },
        },
      },
    }),
  );
  await page.goto("/");
  await navigate(page, "Field Briefing");
  await expect(page.locator(".weather-topline")).toContainText(
    "Tulsa, Oklahoma",
  );
  await expect(page.locator(".weather-temperature")).toContainText("65");
  await expect(page.locator(".weather-week")).toBeVisible();
  await expect(page.locator(".weather-alert")).toContainText(fresh.title);
  await page
    .locator(".briefing-page")
    .getByRole("button", { name: /^Events/ })
    .click();
  await expect(page.locator(".briefing-page .event-report")).toContainText(
    fresh.title,
  );
  await page
    .locator(".briefing-page")
    .getByRole("button", { name: "Quakes", exact: true })
    .click();
  await expect(page.locator(".briefing-page .event-report")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Briefing settings", exact: true })
    .click();
  await page.getByRole("button", { name: "Use Tulsa", exact: true }).click();
  await expect(page.getByLabel("Location name", { exact: true })).toHaveValue(
    "Tulsa, Oklahoma",
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    1024,
  );
});

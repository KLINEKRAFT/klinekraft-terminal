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

test("severe reports take priority and a lost service hides the live ticker", async ({
  page,
}) => {
  let offline = false;
  await page.route("**/api/briefing", (r) =>
    offline
      ? r.fulfill({ status: 503, json: { detail: "offline" } })
      : r.fulfill({
          json: {
            settings,
            events: [
              fresh,
              {
                ...fresh,
                id: "severe",
                title: "Severe test warning",
                severity: "Severe",
              },
            ],
            acknowledged: [],
            feeds: { weather: { stale: false, updated: Date.now() / 1000 } },
          },
        }),
  );
  await page.clock.install();
  await page.goto("/");
  await expect(page.locator(".event-ticker")).toContainText(
    "Severe test warning",
  );
  await page.clock.fastForward(11000);
  await expect(page.locator(".event-ticker")).toContainText(
    "Severe test warning",
  );
  offline = true;
  await page.clock.fastForward(30000);
  await expect(page.locator(".event-ticker")).toHaveCount(0);
});

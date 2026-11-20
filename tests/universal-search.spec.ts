import { test, expect } from "@playwright/test";
import { navigate } from "./navigation";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.route("**/api/organizer?kind=note", (r) =>
    r.fulfill({
      json: [
        {
          id: "search-note",
          kind: "note",
          title: "Field checklist",
          body: "Pack a compass",
          revision: 1,
          archived: false,
          day: null,
          time: "",
        },
        {
          id: "archived-note",
          kind: "note",
          title: "Field deleted",
          body: "",
          revision: 1,
          archived: true,
        },
      ],
    }),
  );
  await page.route("**/api/research?*", (r) =>
    r.fulfill({
      json: {
        files: [
          {
            id: 42,
            name: "Field manual",
            mime: "text/plain",
            snippet: "Field shelter",
          },
        ],
        collections: [],
        limited: false,
      },
    }),
  );
  await page.route("**/api/research/42", (r) =>
    r.fulfill({ contentType: "text/plain", body: "Field shelter reference" }),
  );
  await page.route("**/api/maps/places", (r) =>
    r.fulfill({
      json: [{ id: "field", name: "Field camp", longitude: -96, latitude: 36 }],
    }),
  );
  await page.route("**/api/maps/catalog", (r) =>
    r.fulfill({ json: { places: [], groups: [] } }),
  );
  await page.route("**/api/wiki/search?*", (r) =>
    r.fulfill({ json: { results: [], unavailable: [] } }),
  );
  await page.goto("/");
});

test("local search finds notes, documents and places and opens the selected content", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Search Terminal", exact: true })
    .click();
  const search = page.getByRole("searchbox", { name: "Search Terminal" });
  await expect(search).toBeFocused();
  await search.fill("field");
  await expect(
    page.getByRole("button", { name: /Notes Field checklist/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Saved places Field camp/ }),
  ).toBeVisible();
  await expect(page.getByText("Field deleted")).toHaveCount(0);
  await page.getByRole("button", { name: /Library Field manual/ }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Field shelter reference",
  );
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+k");
  await page.getByRole("searchbox", { name: "Search Terminal" }).fill("field");
  await page.getByRole("button", { name: /Notes Field checklist/ }).click();
  await expect(page.locator('main[data-page="Notes"]')).toBeVisible();
  await expect(page.locator('input[value="Field checklist"]')).toBeVisible();
});

test("partial outages preserve available results; Escape restores focus", async ({
  page,
}) => {
  await page.route("**/api/research?*", (r) =>
    r.fulfill({ status: 503, json: { detail: "Unavailable" } }),
  );
  const trigger = page.getByRole("button", {
    name: "Search Terminal",
    exact: true,
  });
  await trigger.click();
  await page.getByRole("searchbox", { name: "Search Terminal" }).fill("field");
  await expect(
    page.getByRole("button", { name: /Notes Field checklist/ }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("Unavailable: Library");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("secondary panels start closed and share one-open behavior", async ({
  page,
}) => {
  await navigate(page, "Network");
  const panel = (title: RegExp) =>
    page
      .locator("details.details-panel")
      .filter({ has: page.locator("summary", { hasText: title }) });
  const hotspot = panel(/^Phone hotspot/);
  const radio = panel(/^Off-grid messages/);
  await expect(hotspot).not.toHaveAttribute("open", "");
  await expect(radio).not.toHaveAttribute("open", "");
  await hotspot.locator("summary").click();
  await expect(hotspot).toHaveAttribute("open", "");
  await radio.locator("summary").click();
  await expect(hotspot).not.toHaveAttribute("open", "");
  await expect(radio).toHaveAttribute("open", "");
});

test("Kiwix articles open with local illustrations and source context", async ({
  page,
}) => {
  await page.route("**/api/wiki/search?*", (r) =>
    r.fulfill({
      json: {
        results: [
          {
            title: "Ernest Shackleton",
            path: "/content/wikipedia_en_top_maxi/Shackleton",
            snippet: "Antarctic explorer",
            bookTitle: "Wikipedia illustrated",
          },
        ],
        unavailable: [],
      },
    }),
  );
  await page.route("**/api/wiki/article?*", (r) =>
    r.fulfill({
      json: {
        title: "Ernest Shackleton",
        path: "/content/wikipedia_en_top_maxi/Shackleton",
        original: null,
        blocks: [{ kind: "p", text: "An Antarctic expedition." }],
        images: [
          {
            path: "/content/wikipedia_en_top_maxi/portrait.png",
            caption: "Expedition portrait",
          },
        ],
        links: [],
        truncated: false,
      },
    }),
  );
  await page.route("**/api/wiki/image?*", (r) =>
    r.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jctQAAAAASUVORK5CYII=",
        "base64",
      ),
    }),
  );
  await page.keyboard.press("Control+k");
  await page
    .getByRole("searchbox", { name: "Search Terminal" })
    .fill("shackleton");
  await page
    .getByRole("button", {
      name: /Kiwix · Wikipedia illustrated Ernest Shackleton/,
    })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "An Antarctic expedition.",
  );
  await expect(
    page.getByRole("img", { name: "Expedition portrait" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Ask Shackleton/ }).click();
  await expect(page.locator('main[data-page="AI assistant"]')).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("slow Kiwix does not block notes and late searches cannot replace a new query", async ({
  page,
}) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/wiki/search?*", async (r) => {
    if (new URL(r.request().url()).searchParams.get("q") === "field") {
      await held;
      await r
        .fulfill({
          json: {
            results: [
              {
                title: "Stale wiki result",
                path: "/content/old/Stale",
                snippet: "",
                bookTitle: "Old",
              },
            ],
            unavailable: [],
          },
        })
        .catch(() => {});
    } else await r.fulfill({ json: { results: [], unavailable: [] } });
  });
  await page.keyboard.press("Control+k");
  const input = page.getByRole("searchbox", { name: "Search Terminal" });
  await input.fill("field");
  await expect(
    page.getByRole("button", { name: /Notes Field checklist/ }),
  ).toBeVisible();
  await expect(page.locator(".universal-results")).toHaveAttribute(
    "aria-busy",
    "true",
  );
  await input.fill("calculator");
  release();
  await expect(page.locator(".universal-results")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(
    page.getByRole("button", { name: /Apps Calculator/ }),
  ).toBeVisible();
  await expect(page.getByText("Stale wiki result")).toHaveCount(0);
});

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
  await navigate(page, "Library");
  const library = page.getByRole("region", { name: "Research library" });
  const filters = library
    .locator("details")
    .filter({ has: page.locator("summary", { hasText: /^Filters$/ }) });
  const importing = library
    .locator("details")
    .filter({
      has: page.locator("summary", { hasText: /^Import documents$/ }),
    });
  await expect(filters).not.toHaveAttribute("open", "");
  await filters.locator("summary").click();
  await expect(library.getByLabel("Document format")).toBeVisible();
  await importing.locator("summary").click();
  await expect(filters).not.toHaveAttribute("open", "");
  await expect(importing).toHaveAttribute("open", "");
});

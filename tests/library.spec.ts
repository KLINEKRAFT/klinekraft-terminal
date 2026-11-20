import { navigate } from "./navigation";
import { test, expect, type Page } from "@playwright/test";

const files = [
  { id: 1, name: "Guide.pdf", mime: "application/pdf", collection: "Field" },
  { id: 2, name: "Water notes.txt", mime: "text/plain", collection: "Field" },
];

async function openLibrary(page: Page, view: string) {
  await page.goto("/");
  await navigate(page, "Library");
  await page
    .getByRole("navigation", { name: "Library sections" })
    .getByRole("button", { name: view, exact: true })
    .click();
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 600 });
});

test("an empty library explains itself and opens the importer", async ({
  page,
}) => {
  await page.route("**/api/research?*", (r) =>
    r.fulfill({
      json: { files: [], collections: [], limited: false, total: 0 },
    }),
  );
  await openLibrary(page, "Documents");
  const library = page.getByRole("region", { name: "Research library" });
  await expect(
    library.getByRole("heading", { name: "Your documents live here" }),
  ).toBeVisible();
  // Nothing to search or arrange yet, so those controls stay out of the way.
  await expect(library.getByRole("searchbox")).toHaveCount(0);
  await expect(library.getByRole("group", { name: "Layout" })).toHaveCount(0);
  await library.getByRole("button", { name: "Import a folder" }).click();
  await expect(
    library.getByRole("heading", { name: "Import a folder" }),
  ).toBeVisible();
  await expect(library.getByLabel("Folder inside location")).toBeVisible();
  // The form takes focus, and closing it hands focus back to the opener.
  await expect(library.getByLabel("Collection")).toBeFocused();
  await library.getByRole("button", { name: "Cancel" }).click();
  await expect(
    library.getByRole("heading", { name: "Your documents live here" }),
  ).toBeVisible();
  await expect(
    library.getByRole("button", { name: "Import a folder" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(library.getByLabel("Collection")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    library.getByRole("heading", { name: "Import a folder" }),
  ).toHaveCount(0);
  await expect(
    library.getByRole("button", { name: "Import a folder" }),
  ).toBeFocused();
});

test("documents toolbar filters in place and tells no-match from empty", async ({
  page,
}) => {
  await page.route("**/api/research?*", (r) => {
    const query = new URL(r.request().url()).searchParams.get("q");
    return r.fulfill({
      json: {
        files: query === "zzz" ? [] : files,
        collections: ["Field"],
        limited: false,
        total: 2,
      },
    });
  });
  await openLibrary(page, "Documents");
  const library = page.getByRole("region", { name: "Research library" });
  await expect(library.getByLabel("Document format")).toBeVisible();
  const layout = library.getByRole("group", { name: "Layout" });
  await expect(layout.getByRole("button", { name: "Shelf" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await layout.getByRole("button", { name: "List" }).click();
  await expect(layout.getByRole("button", { name: "List" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(library.locator(".document-gallery.list")).toBeVisible();
  await library.getByRole("searchbox", { name: "Search files" }).fill("zzz");
  await expect(
    library.getByRole("heading", { name: "No documents match “zzz”" }),
  ).toBeVisible();
  await library.getByRole("button", { name: "Clear search" }).click();
  await expect(
    library.getByRole("button", { name: "Guide", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    1024,
  );
});

test("research starts with what it searches and separates no results", async ({
  page,
}) => {
  await page.route("**/api/briefing/research?*", (r) =>
    r.fulfill({ json: { sources: [], results: [] } }),
  );
  await openLibrary(page, "Research");
  await expect(
    page.getByRole("heading", { name: "Search published research" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Try / }).click();
  await expect(
    page.getByRole("heading", {
      name: "No papers found for “water purification”",
    }),
  ).toBeVisible();
});

test("Wikipedia without archives shows the setup command, not a raw error", async ({
  page,
}) => {
  await page.route("**/api/wiki/books", (r) =>
    r.fulfill({
      status: 503,
      json: {
        detail: "Wikipedia reader is unavailable. Check klinekraft-wiki.service.",
      },
    }),
  );
  await page.route("**/api/wiki", (r) =>
    r.fulfill({ json: { ready: false, archives: [], url: null } }),
  );
  await openLibrary(page, "Wikipedia");
  const wiki = page.getByRole("region", { name: "Offline Wikipedia" });
  await expect(
    wiki.getByRole("heading", { name: "Wikipedia, offline" }),
  ).toBeVisible();
  await expect(wiki.getByText("bash scripts/setup-local-content.sh")).toBeVisible();
  await expect(wiki.getByRole("alert")).toHaveCount(0);
  await expect(wiki.getByRole("button", { name: "Check again" })).toBeVisible();
});

test("Wikipedia with saved archives says the reader is not responding", async ({
  page,
}) => {
  await page.route("**/api/wiki/books", (r) =>
    r.fulfill({ status: 503, json: { detail: "Reader timed out." } }),
  );
  // The API can still report ready while the reader itself times out.
  await page.route("**/api/wiki", (r) =>
    r.fulfill({ json: { ready: true, archives: ["wikipedia_en_top"], url: null } }),
  );
  await openLibrary(page, "Wikipedia");
  const wiki = page.getByRole("region", { name: "Offline Wikipedia" });
  await expect(
    wiki.getByRole("heading", {
      name: "Your archive is saved. The reader is not responding.",
    }),
  ).toBeVisible();
  await expect(
    wiki.getByText("systemctl --user restart klinekraft-wiki.service"),
  ).toBeVisible();
  await expect(wiki.getByText("bash scripts/setup-local-content.sh")).toHaveCount(0);
});

test("clearing a Wikipedia search with no hits returns to the archives", async ({
  page,
}) => {
  await page.route("**/api/wiki/books", (r) =>
    r.fulfill({
      json: {
        books: [
          {
            name: "wikipedia_en_top",
            title: "Wikipedia top articles",
            path: "/content/wikipedia_en_top/",
          },
        ],
      },
    }),
  );
  await page.route("**/api/wiki/search?*", (r) =>
    r.fulfill({ json: { results: [], unavailable: [] } }),
  );
  await openLibrary(page, "Wikipedia");
  const wiki = page.getByRole("region", { name: "Offline Wikipedia" });
  const archives = wiki.getByRole("list", { name: "Installed archives" });
  await expect(archives).toBeVisible();
  await wiki.getByRole("searchbox", { name: "Search Wikipedia" }).fill("qwxyz");
  await wiki.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    wiki.getByRole("heading", { name: "No articles match “qwxyz”" }),
  ).toBeVisible();
  // One archive: there is nothing else to "search all".
  await expect(wiki.getByText("Try a shorter or different topic.")).toBeVisible();
  await expect(archives).toHaveCount(0);
  await wiki.getByRole("searchbox", { name: "Search Wikipedia" }).fill("");
  await expect(archives).toBeVisible();
  await expect(
    wiki.getByRole("heading", { name: /No articles match/ }),
  ).toHaveCount(0);
});

test("notebook and bookmarks empty states each offer one way forward", async ({
  page,
}) => {
  await page.route("**/api/notebook?*", (r) => r.fulfill({ json: [] }));
  await openLibrary(page, "Notebook");
  await expect(
    page.getByRole("heading", { name: "Keep the answers worth keeping" }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Library sections" })
    .getByRole("button", { name: "Bookmarks", exact: true })
    .click();
  const bookmarks = page.getByRole("region", { name: "Browser bookmarks" });
  await expect(
    bookmarks.getByRole("heading", { name: "Keep your regular stops close" }),
  ).toBeVisible();
  await expect(bookmarks.getByRole("button", { name: "Add bookmark" })).toHaveCount(1);
  await bookmarks.getByRole("button", { name: "Add bookmark" }).click();
  await expect(bookmarks.getByLabel("Name")).toBeFocused();
  await bookmarks.getByRole("button", { name: "Cancel" }).click();
  await expect(
    bookmarks.getByRole("button", { name: "Add bookmark" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await expect(bookmarks.getByLabel("Name")).toHaveCount(0);
  await expect(
    bookmarks.getByRole("button", { name: "Add bookmark" }),
  ).toBeFocused();
  // The empty notebook's one action opens Shackleton, titled in the header.
  await page
    .getByRole("navigation", { name: "Library sections" })
    .getByRole("button", { name: "Notebook", exact: true })
    .click();
  await page.getByRole("button", { name: "Ask Shackleton", exact: true }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Shackleton" }),
  ).toBeVisible();
});

test("Files explains a missing folder and an empty one", async ({ page }) => {
  await page.route("**/api/files?*", (r) => {
    const root = new URL(r.request().url()).searchParams.get("root");
    return root === "documents"
      ? r.fulfill({ status: 404, json: { detail: "Folder or file not found." } })
      : r.fulfill({ json: { entries: [], truncated: false } });
  });
  await page.goto("/");
  await navigate(page, "Files");
  await expect(
    page.getByRole("heading", { name: "No Documents folder on this Pi yet" }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page
    .getByRole("group", { name: "Folder" })
    .getByRole("button", { name: "Downloads" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Downloads is empty" }),
  ).toBeVisible();
});

for (const dark of [false, true])
  test(`the active library tab stays filled on hover (${dark ? "dark" : "light"})`, async ({
    page,
  }) => {
    await page.addInitScript(
      (value) => localStorage.setItem("klinekraft.darkMode", String(value)),
      dark,
    );
    await openLibrary(page, "Research");
    const active = page
      .getByRole("navigation", { name: "Library sections" })
      .getByRole("button", { name: "Research", exact: true });
    await expect(active).toHaveAttribute("aria-pressed", "true");
    await active.hover();
    // Filled logo blue behind white text, hovered or not.
    await expect
      .poll(() => active.evaluate((e) => getComputedStyle(e).backgroundColor))
      .toBe("rgb(2, 39, 255)");
    await expect(active).toHaveCSS("color", "rgb(255, 255, 255)");
  });

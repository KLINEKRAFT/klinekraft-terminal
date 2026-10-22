import { test, expect } from "@playwright/test";

test("existing bookmarks can be pinned, edited, and unpinned across reloads", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem(
      "klinekraft.browser.v1",
      JSON.stringify({
        version: 1,
        launchUrl: "https://example.com/",
        bookmarks: [
          {
            id: "existing",
            title: "Reference",
            url: "https://example.com/reference",
          },
        ],
      }),
    ),
  );
  await page.reload();
  await page.getByRole("button", { name: "05 Library" }).click();
  await page
    .getByRole("button", { name: "Pin Reference", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Edit Reference", exact: true })
    .click();
  await page.getByLabel("Name", { exact: true }).fill("My reference");
  await page.getByRole("button", { name: "Save bookmark" }).click();
  await page.reload();
  const pin = page.getByRole("link", { name: "My reference", exact: true });
  await expect(pin).toHaveAttribute("href", "https://example.com/reference");
  await expect(pin).toHaveAttribute("rel", "noopener noreferrer");
  await page.getByRole("button", { name: "Manage", exact: true }).click();
  await page
    .getByRole("button", { name: "Unpin My reference", exact: true })
    .click();
  await page.reload();
  await expect(pin).toHaveCount(0);
  await page.getByRole("button", { name: "05 Library" }).click();
  await expect(
    page.getByRole("link", { name: "Open My reference in a new tab" }),
  ).toBeVisible();
});

test("quick notes survive navigation and reload, including an emptied note", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.goto("/");
  await page
    .getByLabel("Quick notes", { exact: true })
    .fill("Next mission: finish the Pi.\nPack the charger.");
  await page.getByRole("button", { name: "05 Library" }).click();
  await page.getByRole("button", { name: "01 Home" }).click();
  await expect(page.getByLabel("Quick notes", { exact: true })).toHaveValue(
    "Next mission: finish the Pi.\nPack the charger.",
  );
  await page.reload();
  await expect(page.getByLabel("Quick notes", { exact: true })).toHaveValue(
    "Next mission: finish the Pi.\nPack the charger.",
  );
  await page.screenshot({
    path: "test-results/personal-home.png",
    animations: "disabled",
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(
    600,
  );
  await page.getByLabel("Quick notes", { exact: true }).fill("");
  await page.reload();
  await expect(page.getByLabel("Quick notes", { exact: true })).toHaveValue("");
});

test("failed note storage is explicit and the draft survives navigation", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("Unavailable");
    };
  });
  await page.goto("/");
  await page.getByLabel("Quick notes", { exact: true }).fill("Keep this draft");
  await expect(page.getByRole("alert")).toContainText("Not saved");
  await page.getByRole("button", { name: "05 Library" }).click();
  await page.getByRole("button", { name: "01 Home" }).click();
  await expect(page.getByLabel("Quick notes", { exact: true })).toHaveValue(
    "Keep this draft",
  );
});

test("playful greeting stays stable during a session and changes with time", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Math.random = () => 0.3;
  });
  await page.clock.install({ time: new Date(2026, 9, 22, 11, 59, 59) });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Morning, Colin. Systems ready." }),
  ).toBeVisible();
  await page.clock.runFor(2000);
  await expect(
    page.getByRole("heading", { name: "Afternoon, Colin. Make something." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "05 Library" }).click();
  await page.getByRole("button", { name: "01 Home" }).click();
  await expect(
    page.getByRole("heading", { name: "Afternoon, Colin. Make something." }),
  ).toBeVisible();
});

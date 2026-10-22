import { test, expect } from "@playwright/test";

test("bookmarks persist, edit, launch safely, and remove", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 1024, height: 600 });
  await context.route("https://example.com/**", (route) =>
    route.fulfill({ body: "Bookmark destination" }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "05 Library" }).click();
  await page.getByRole("button", { name: "Add bookmark" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Reference");
  await page.getByLabel("Web address").fill("https://example.com/reference");
  await page.getByRole("button", { name: "Save bookmark" }).click();
  await page.reload();
  await page.getByRole("button", { name: "05 Library" }).click();
  const link = page.getByRole("link", { name: "Open Reference in a new tab" });
  await expect(link).toHaveAttribute("href", "https://example.com/reference");
  const popupPromise = context.waitForEvent("page");
  await link.click();
  const popup = await popupPromise;
  await popup.waitForLoadState();
  await expect(popup).toHaveURL("https://example.com/reference");
  expect(await popup.evaluate(() => window.opener)).toBeNull();
  await popup.close();
  await page
    .getByRole("button", { name: "Edit Reference", exact: true })
    .click();
  await page.getByLabel("Name", { exact: true }).fill("Manual");
  await page.getByLabel("Web address").fill("http://localhost:8080/manual");
  await page.getByRole("button", { name: "Save bookmark" }).click();
  await expect(
    page.getByRole("link", { name: "Open Manual in a new tab" }),
  ).toHaveAttribute("href", "http://localhost:8080/manual");
  await page.screenshot({
    path: "test-results/bookmarks-1024.png",
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    1024,
  );
  await page.getByRole("button", { name: "Remove Manual" }).click();
  await page.reload();
  await page.getByRole("button", { name: "05 Library" }).click();
  await expect(page.getByText("A place for your regular stops.")).toBeVisible();
});

test("launch URL persists, rejects unsafe schemes, and clears", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "09 Settings" }).click();
  for (const url of [
    "javascript:alert(1)",
    "file:///etc/passwd",
    "https://user:pass@example.com",
    "not a URL",
  ]) {
    await page.getByLabel("Default launch URL").fill(url);
    await page.getByRole("button", { name: "Save launch URL" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
  }
  await page.getByLabel("Default launch URL").fill("https://example.com");
  await page.getByRole("button", { name: "Save launch URL" }).click();
  await page.reload();
  await page.getByRole("button", { name: "05 Library" }).click();
  await expect(
    page.getByRole("link", { name: "Open launch page" }),
  ).toHaveAttribute("href", "https://example.com/");
  await page.getByRole("button", { name: "09 Settings" }).click();
  await page.getByRole("button", { name: "Clear launch URL" }).click();
  await page.reload();
  await page.getByRole("button", { name: "05 Library" }).click();
  await expect(
    page.getByRole("button", { name: "Set launch URL" }),
  ).toBeVisible();
});

test("untrusted saved data and unavailable storage do not crash the app", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "klinekraft.browser.v1",
      JSON.stringify({
        version: 1,
        launchUrl: "javascript:alert(1)",
        bookmarks: [],
      }),
    );
    Storage.prototype.setItem = () => {
      throw new Error("Storage unavailable");
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "05 Library" }).click();
  await expect(page.getByRole("alert")).toContainText("could not be loaded");
  await expect(
    page.getByRole("link", { name: "Open launch page" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Add bookmark" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Example");
  await page.getByLabel("Web address").fill("data:text/html,hello");
  await page.getByRole("button", { name: "Save bookmark" }).click();
  await expect(
    page.getByText("Use an http:// or https:// address", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("Web address").fill("https://example.com");
  await page.getByRole("button", { name: "Save bookmark" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "only last until this page is reloaded",
  );
  await expect(
    page.getByRole("link", { name: "Open Example in a new tab" }),
  ).toBeVisible();
});

for (const [hour, greeting] of [
  [9, "morning"],
  [14, "afternoon"],
  [20, "evening"],
] as const) {
  test(`personal greeting in the ${greeting}, without footer slogans`, async ({
    page,
  }) => {
    await page.clock.install({ time: new Date(2026, 9, 22, hour) });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: `Good ${greeting}, Colin.` }),
    ).toBeVisible();
    await expect(page.getByText("DESIGNED TO GO WITH YOU.")).toHaveCount(0);
    await expect(
      page.getByText("FOUNDATION PREVIEW", { exact: false }),
    ).toHaveCount(0);
    expect(
      await page
        .locator(".page-header")
        .evaluate((el) => getComputedStyle(el).animationName),
    ).toBe("none");
  });
}

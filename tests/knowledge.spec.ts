import { test, expect } from "@playwright/test";
test("local article flows into cloud answer with verified source and image", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 600 });
  const source = { title: "Moon", path: "/content/wikipedia_en/Moon" };
  await page.route("**/api/wiki/books", (r) =>
    r.fulfill({
      json: {
        books: [
          {
            name: "wikipedia_en",
            title: "Wikipedia",
            path: "/content/wikipedia_en",
          },
        ],
      },
    }),
  );
  await page.route("**/api/wiki/search?*", (r) =>
    r.fulfill({
      json: { results: [{ ...source, snippet: "Earth’s natural satellite." }] },
    }),
  );
  await page.route("**/api/wiki/article?*", (r) =>
    r.fulfill({
      json: {
        ...source,
        original: null,
        blocks: [{ kind: "p", text: "The Moon orbits Earth." }],
        images: [
          { path: "/content/wikipedia_en/moon.png", caption: "The Moon" },
        ],
        links: [],
        truncated: false,
      },
    }),
  );
  await page.route("**/api/wiki/image?*", (r) => {
    expect(r.request().headers()["x-klinekraft-client"]).toBe("local-ui");
    return r.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  });
  await page.route("**/api/ai/status", (r) =>
    r.fulfill({ json: { configured: true, model: "gpt-4.1-mini" } }),
  );
  await page.route("**/api/ai/ask", (r) => {
    expect(r.request().postDataJSON().article_path).toBe(source.path);
    return r.fulfill({
      json: {
        answer: "The Moon orbits Earth [1].",
        notice: "",
        sources: [{ ...source, id: 1 }],
        images: [
          {
            path: "/content/wikipedia_en/moon.png",
            caption: "The Moon",
            articlePath: source.path,
            title: source.title,
            sourceId: 1,
          },
        ],
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /^05 Library/ }).click();
  await page.getByLabel("Search Wikipedia", { exact: true }).fill("Moon");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.locator(".wiki-results button").click();
  await expect(
    page.getByText("The Moon orbits Earth.", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "/tmp/wiki-reader.png" });
  await page.getByRole("button", { name: "Ask AI about this" }).click();
  await expect(page.getByText("Article: Moon")).toBeVisible();
  await page.getByLabel("Your question").fill("Explain the Moon");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByText("The Moon orbits Earth [1].", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "/tmp/wiki-ai.png" });
  await page.getByText("1 source", { exact: true }).click();
  await page.getByRole("button", { name: "[1] Moon", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Wikipedia article" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close article" }).click();
  await page.getByTitle("Switch to dark mode").click();
  await page.getByRole("button", { name: "[1] Moon", exact: true }).click();
  await page.getByRole("button", { name: "Fullscreen article" }).click();
  await expect
    .poll(() => page.evaluate(() => !!document.fullscreenElement))
    .toBe(true);
  await page.screenshot({ path: "/tmp/wiki-dark.png" });
});

test("minimal chat keyboard flow, settings and new chat work on a small screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.route("**/api/ai/status", (r) =>
    r.fulfill({ json: { configured: true, model: "gpt-4.1-mini" } }),
  );
  let sent = 0;
  await page.route("**/api/ai/ask", async (r) => {
    sent++;
    expect(r.request().postDataJSON().question).toBe("First line\nSecond line");
    await r.fulfill({
      json: {
        answer: "A helpful answer. ".repeat(120),
        notice: "",
        sources: [],
        images: [],
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /03 AI assistant/ }).click();
  const input = page.getByLabel("Your question");
  await input.fill("First line");
  await input.press("Shift+Enter");
  await expect(input).toHaveValue("First line\n");
  await input.fill("First line\nSecond line");
  expect(sent).toBe(0);
  await expect(page.getByLabel("Workspace command")).toHaveCount(0);
  await input.press("Enter");
  await expect(page.locator(".ai-answer")).toBeVisible();
  await expect(input).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "Send message" }),
  ).toBeInViewport();
  await page.getByLabel("Chat settings").click();
  await expect(page.getByText(/Questions, recent messages/)).toBeVisible();
  await page.getByLabel("Chat settings").click();
  await page.getByRole("button", { name: "New chat" }).click();
  await expect(page.locator(".ai-answer")).toHaveCount(0);
  await expect(input).toHaveValue("");
  await page.screenshot({ path: "/tmp/ai-minimal-mobile.png" });
});

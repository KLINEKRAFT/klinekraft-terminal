import { test, expect } from "@playwright/test";
test("chat persists across reload and browser profiles, renames, exports and deletes", async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.goto("/");
  await page.getByRole("button", { name: /03 AI assistant/ }).click();
  await page.getByRole("button", { name: "Wikipedia on" }).click();
  await page.getByLabel("Your question").fill("A persistent astronomy chat");
  await page.getByLabel("Your question").press("Enter");
  await expect(page.getByText("Saved on Pi", { exact: false })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /03 AI assistant/ }).click();
  await expect(page.locator(".ai-answer")).toContainText("Saved answer");
  await page.getByRole("button", { name: "History", exact: true }).click();
  await page.getByLabel("Conversation title").fill("Astronomy notebook");
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  await expect(page.locator(".ai-history-list")).toContainText(
    "Astronomy notebook",
  );
  await page.screenshot({ path: "/tmp/klinekraft-history.png" });
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export all chats" }).click();
  expect((await downloaded).suggestedFilename()).toBe("klinekraft-chats.json");
  const second = await browser.newContext({
    viewport: { width: 390, height: 700 },
  });
  const other = await second.newPage();
  await other.goto("http://127.0.0.1:8015/");
  await other.getByRole("button", { name: /03 AI assistant/ }).click();
  await other.getByRole("button", { name: "History", exact: true }).click();
  await other.getByLabel("Search conversations").fill("astronomy");
  await other.getByRole("button", { name: /Astronomy notebook/ }).click();
  await expect(other.locator(".ai-answer")).toContainText("Saved answer");
  await other.getByTitle("Switch to dark mode").click();
  await other.getByRole("button", { name: "History", exact: true }).click();
  await other.screenshot({ path: "/tmp/klinekraft-history-mobile.png" });
  other.on("dialog", (d) => d.accept());
  await other.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(other.locator(".ai-history-list")).not.toContainText(
    "Astronomy notebook",
  );
  await second.close();
});
test("failed save keeps answer and retry does not ask cloud AI again", async ({
  page,
}) => {
  let asks = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/api/ai/ask")) asks++;
  });
  await page.route("**/api/conversations/*", (r) =>
    r.request().method() === "PUT"
      ? r.fulfill({ status: 503, json: { detail: "Storage unavailable" } })
      : r.continue(),
  );
  await page.goto("/");
  await page.getByRole("button", { name: /03 AI assistant/ }).click();
  await page.getByRole("button", { name: "Wikipedia on" }).click();
  await page.getByLabel("Your question").fill("Keep this answer");
  await page.getByLabel("Your question").press("Enter");
  await expect(page.getByText("Storage unavailable")).toBeVisible();
  await expect(page.locator(".ai-answer")).toContainText("Saved answer");
  await page.getByRole("button", { name: /01 Home/ }).click();
  await page.getByRole("button", { name: /03 AI assistant/ }).click();
  await expect(page.locator(".ai-answer")).toContainText("Saved answer");
  await page.unroute("**/api/conversations/*");
  await page.getByRole("button", { name: "Retry save" }).click();
  await expect(page.getByText("Saved on Pi", { exact: false })).toBeVisible();
  expect(asks).toBe(1);
});

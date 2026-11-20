import { test, expect } from "@playwright/test";
import { navigate } from "./navigation";

test("undo survives autosave; saved history survives reload; trash restores a note", async ({
  page,
}) => {
  let note = {
    id: "a",
    kind: "note",
    title: "Expedition",
    body: "Keep the whole long note safely.",
    day: null,
    time: "",
    revision: 1,
    archived: false,
  };
  const history: { revision: number; saved_at: string; item: typeof note }[] =
    [];
  await page.route("**/api/organizer**", async (route) => {
    if (route.request().url().endsWith("/history"))
      return route.fulfill({ json: [...history].reverse() });
    if (route.request().method() === "GET")
      return route.fulfill({ json: [note] });
    history.push({
      revision: note.revision,
      saved_at: new Date().toISOString(),
      item: { ...note },
    });
    note = { ...route.request().postDataJSON(), revision: note.revision + 1 };
    return route.fulfill({ json: note });
  });
  await page.goto("/");
  await navigate(page, "Notes");
  await page
    .getByRole("button", {
      name: "Expedition Keep the whole long note safely.",
      exact: true,
    })
    .click();
  const editor = page.getByRole("textbox", { name: "Note", exact: true });
  await editor.click();
  await editor.press("Control+a");
  await editor.press("Backspace");
  await expect.poll(() => note.revision).toBe(2);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(editor).toHaveText("Keep the whole long note safely.");
  await expect.poll(() => note.revision).toBe(3);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(editor).toBeEmpty();
  await expect.poll(() => note.revision).toBe(4);
  await page.reload();
  await navigate(page, "Notes");
  await page
    .getByRole("button", { name: "Expedition Empty note", exact: true })
    .click();
  await page.getByRole("button", { name: "History", exact: true }).click();
  const version = page
    .locator(".note-history details")
    .filter({ hasText: "Version 1 ·" });
  await version.locator("summary").click();
  await version.getByRole("button", { name: "Restore this version" }).click();
  await expect(editor).toHaveText("Keep the whole long note safely.");
  await expect.poll(() => note.revision).toBe(5);
  await page
    .getByRole("button", { name: "Trash Expedition", exact: true })
    .click();
  await expect.poll(() => note.archived).toBe(true);
  await expect(
    page.getByRole("button", { name: "Trash Expedition", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Trash", exact: true }).click();
  await page
    .getByRole("button", { name: "Restore Expedition", exact: true })
    .click();
  await expect.poll(() => note.archived).toBe(false);
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Expedition Keep the whole long note safely.",
      exact: true,
    }),
  ).toBeVisible();
});

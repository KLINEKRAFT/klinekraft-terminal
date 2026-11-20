import { test, expect } from "@playwright/test";
import { navigate } from "./navigation";

test("notes have one New action, honest empty states and labelled tools", async ({
  page,
}) => {
  let notes: any[] = [];
  await page.route("**/api/organizer**", (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: notes });
    const item = route.request().postDataJSON();
    item.revision++;
    notes = [item, ...notes.filter((n) => n.id !== item.id)];
    return route.fulfill({ json: item });
  });
  await page.goto("/");
  await navigate(page, "Notes");
  const workspace = page.getByRole("region", { name: "Notes workspace" });
  await expect(workspace.getByRole("button", { name: /new/i })).toHaveCount(1);
  await expect(
    workspace.getByRole("button", { name: "New note", exact: true }),
  ).toBeVisible();
  await expect(
    workspace.getByRole("button", { name: "Save on Pi" }),
  ).toHaveCount(0);
  await expect(
    workspace.getByRole("heading", { name: "No notes yet" }),
  ).toBeVisible();
  const toolbar = page.getByRole("toolbar", { name: "Note formatting" });
  for (const name of [
    "Undo",
    "Redo",
    "Bold",
    "Italic",
    "Underline",
    "Heading",
    "Bullets",
    "Numbered list",
    "Checklist",
    "Plain text",
  ])
    await expect(toolbar.getByRole("button", { name, exact: true })).toHaveCount(
      1,
    );
  const all = workspace.getByRole("button", { name: "All", exact: true });
  const trash = workspace.getByRole("button", { name: "Trash", exact: true });
  await expect(all).toHaveAttribute("aria-pressed", "true");
  await trash.click();
  await expect(trash).toHaveAttribute("aria-pressed", "true");
  await expect(
    workspace.getByRole("heading", { name: "Trash is empty" }),
  ).toBeVisible();
  await all.click();

  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Camp");
  await expect(page.getByRole("status")).toContainText("Saved on Pi");
  await expect(
    workspace.getByRole("button", { name: /^Camp/ }).first(),
  ).toBeVisible();
  await page.getByRole("searchbox", { name: "Search notes" }).fill("zzz");
  await expect(
    workspace.getByRole("heading", { name: "No matches" }),
  ).toBeVisible();
});

test("a save conflict offers both ways out beside the save state", async ({
  page,
}) => {
  const pi = {
    id: "a",
    kind: "note",
    title: "Alpha",
    body: "Pi copy",
    day: null,
    time: "",
    revision: 4,
    archived: false,
  };
  const puts: any[] = [];
  await page.route("**/api/organizer**", (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: [pi] });
    const item = route.request().postDataJSON();
    puts.push(item);
    if (item.id === "a")
      return route.fulfill({
        status: 409,
        json: { detail: "Revision conflict. Reload before saving." },
      });
    return route.fulfill({ json: { ...item, revision: 1 } });
  });
  await page.goto("/");
  await navigate(page, "Notes");
  await page.getByRole("button", { name: "Alpha Pi copy", exact: true }).click();
  const note = page.getByRole("textbox", { name: "Note", exact: true });
  await note.fill("My edit");
  await expect(page.getByRole("status")).toContainText("Not saved");
  const keep = page.getByRole("button", { name: "Keep mine as a copy" });
  const load = page.getByRole("button", { name: "Load Pi version" });
  await expect(keep).toBeInViewport();
  await expect(load).toBeInViewport();
  await load.click();
  await expect(note).toHaveText("Pi copy");
  await expect(load).toHaveCount(0);

  await note.fill("Second edit");
  await expect(keep).toBeVisible();
  await keep.click();
  await expect
    .poll(() => puts.at(-1)?.title)
    .toBe("Alpha (my copy)");
  expect(puts.at(-1).id).not.toBe("a");
  await expect(page.getByRole("status")).toContainText("Saved on Pi");
});

test("calendar agenda names the day and event editor uses labelled fields", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-20T12:00:00"));
  await page.route("**/api/organizer**", (route) =>
    route.fulfill({
      json: [
        {
          id: "e1",
          kind: "event",
          title: "Truck service",
          body: "",
          day: "2026-11-20",
          time: "09:30",
          revision: 1,
          archived: false,
        },
      ],
    }),
  );
  await page.goto("/");
  await navigate(page, "Calendar");
  const workspace = page.getByRole("region", { name: "Calendar workspace" });
  await expect(
    workspace.getByRole("heading", { name: "Friday, November 20" }),
  ).toBeVisible();
  await expect(
    workspace.getByRole("button", {
      name: "Truck service 9:30 AM",
      exact: true,
    }),
  ).toBeVisible();
  await workspace
    .getByRole("button", { name: "2026-11-21", exact: true })
    .click();
  await expect(workspace.getByText("Nothing scheduled.")).toBeVisible();
  await expect(workspace.getByLabel("Date", { exact: true })).toHaveValue(
    "2026-11-20",
  );
  await expect(workspace.getByLabel("Time (optional)")).toBeVisible();
  await expect(
    workspace.getByRole("textbox", { name: "Details", exact: true }),
  ).toBeVisible();
  await expect(
    workspace.getByRole("button", { name: "New event", exact: true }),
  ).toBeVisible();
});

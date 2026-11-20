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
  const list = workspace.locator(".organizer-items");
  await expect(
    workspace.getByRole("heading", { name: "No notes yet" }),
  ).toBeVisible();
  await expect(list).toContainText(
    "Start typing on the right. Notes save to the Pi as you write.",
  );
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
    await expect(
      toolbar.getByRole("button", { name, exact: true }),
    ).toHaveCount(1);
  const all = workspace.getByRole("button", { name: "All", exact: true });
  const trash = workspace.getByRole("button", { name: "Trash", exact: true });
  await expect(all).toHaveAttribute("aria-pressed", "true");
  await trash.click();
  await expect(trash).toHaveAttribute("aria-pressed", "true");
  await expect(
    workspace.getByRole("heading", { name: "Trash is empty" }),
  ).toBeVisible();
  await expect(list).toContainText(
    "Removed notes wait here until you restore them.",
  );
  await expect(list).not.toContainText("No notes yet");
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
  await expect(list).toContainText("Nothing in your notes mentions “zzz”.");
});

test("a long save message never squeezes the note title off its row", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 600 });
  const long = {
    id: "a",
    kind: "note",
    title: "Expedition packing list for the long weekend in the backcountry",
    body: "Tent",
    day: null,
    time: "",
    revision: 3,
    archived: false,
  };
  let fail = false;
  await page.route("**/api/organizer**", (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: [long] });
    if (fail)
      return route.fulfill({
        status: 409,
        json: { detail: "Revision conflict. Reload before saving." },
      });
    return route.fulfill({ json: route.request().postDataJSON() });
  });
  await page.goto("/");
  await navigate(page, "Notes");
  await page.getByRole("button", { name: /^Expedition packing/ }).click();
  const title = page.getByRole("textbox", { name: "Title", exact: true });
  const status = page.getByRole("status");
  const head = page.locator(".organizer-head");
  const editorWidth = await page
    .locator(".organizer-editor form")
    .evaluate((e) => e.getBoundingClientRect().width);
  const check = async () => {
    const titleBox = (await title.boundingBox())!;
    const statusBox = (await status.boundingBox())!;
    // One row: the status sits beside the title, never wrapped under it.
    expect(
      Math.abs(
        statusBox.y + statusBox.height / 2 - (titleBox.y + titleBox.height / 2),
      ),
    ).toBeLessThan(8);
    expect(titleBox.width).toBeGreaterThanOrEqual(editorWidth / 2 - 1);
    expect(await title.evaluate((e) => getComputedStyle(e).textOverflow)).toBe(
      "ellipsis",
    );
    expect((await head.boundingBox())!.height).toBeLessThanOrEqual(48);
  };
  await check();
  fail = true;
  await page.getByRole("textbox", { name: "Note", exact: true }).fill("Mine");
  await expect(status).toHaveText("Not saved");
  await expect(page.getByRole("alert")).toContainText(
    "Changed on the Pi from another tab or device.",
  );
  await check();
  fail = false;
  await page.getByRole("button", { name: "Load Pi version" }).click();
  // The long message lives in the tooltip; the visible state stays short.
  await expect(status).toHaveText("Saved on Pi");
  await expect(status).toHaveAttribute(
    "title",
    "Loaded the version saved on the Pi.",
  );
  await expect(page.getByRole("alert")).toHaveCount(0);
  await check();
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
  await page
    .getByRole("button", { name: "Alpha Pi copy", exact: true })
    .click();
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
  await expect.poll(() => puts.at(-1)?.title).toBe("Alpha (my copy)");
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
  const list = workspace.locator(".organizer-items");
  await expect(list).toHaveText("Nothing scheduled tomorrow.");
  await workspace
    .getByRole("button", { name: "2026-11-24", exact: true })
    .click();
  await expect(list).toHaveText("Nothing scheduled on Tue, Nov 24.");
  // Trash lists every removed event, so an empty Trash says so, not "Nothing
  // scheduled".
  await workspace.getByRole("button", { name: "Trash", exact: true }).click();
  await expect(
    workspace.getByRole("heading", { name: "Trash is empty" }),
  ).toBeVisible();
  await expect(list).toContainText(
    "Removed events wait here until you restore them.",
  );
  await expect(list).not.toContainText("Nothing scheduled");
  await workspace.getByRole("button", { name: "All", exact: true }).click();
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

for (const height of [600, 560])
  test(`calendar event editor keeps one head row and fits 1024x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height });
    await page.clock.setFixedTime(new Date("2026-11-20T12:00:00"));
    await page.route("**/api/organizer**", (route) =>
      route.fulfill({
        json: [
          {
            id: "e1",
            kind: "event",
            title: "Truck service at the dealership on Main Street",
            body: "Bring the warranty folder",
            day: "2026-11-20",
            time: "09:30",
            revision: 2,
            archived: false,
          },
          {
            id: "e2",
            kind: "event",
            title: "Ham club",
            body: "",
            day: "2026-11-20",
            time: "19:00",
            revision: 1,
            archived: false,
          },
        ],
      }),
    );
    await page.goto("/");
    await navigate(page, "Calendar");
    const workspace = page.getByRole("region", { name: "Calendar workspace" });
    await workspace.getByRole("button", { name: /^Truck service/ }).click();
    const history = workspace.getByRole("button", {
      name: "History",
      exact: true,
    });
    await expect(history).toBeVisible();
    const title = (await workspace
      .getByRole("textbox", { name: "Title", exact: true })
      .boundingBox())!;
    const historyBox = (await history.boundingBox())!;
    expect(
      Math.abs(
        historyBox.y + historyBox.height / 2 - (title.y + title.height / 2),
      ),
    ).toBeLessThan(8);
    expect(historyBox.height).toBeGreaterThanOrEqual(36);
    const editor = await page
      .locator(".organizer-editor")
      .evaluate((e) => [e.scrollHeight, e.clientHeight]);
    expect(editor[0]).toBeLessThanOrEqual(editor[1]);
    await expect(
      workspace.getByRole("textbox", { name: "Details", exact: true }),
    ).toBeInViewport({ ratio: 1 });
  });

import { test, expect } from "@playwright/test";
import { navigate } from "./navigation";
async function go(page: any, name: string) {
  await page.goto("/");
  await navigate(page, name);
}
for (const kind of ["note", "event"])
  test(`${kind}: typing stays focused during save and latest edits persist`, async ({
    page,
  }) => {
    let records: any[] = [];
    let start!: () => void;
    const began = new Promise<void>((r) => (start = r));
    let release!: () => void;
    const hold = new Promise<void>((r) => (release = r));
    let count = 0;
    await page.route("**/api/organizer**", async (r) => {
      if (r.request().method() === "GET") return r.fulfill({ json: records });
      const item = r.request().postDataJSON();
      count++;
      if (count === 1) {
        start();
        await hold;
      }
      item.revision++;
      records = [item];
      return r.fulfill({ json: item });
    });
    await go(page, kind === "note" ? "Notes" : "Calendar");
    const title = page.getByRole("textbox", { name: "Title", exact: true });
    await title.fill("Typing test");
    const body = page.getByRole("textbox", {
      name: kind === "note" ? "Note" : "Details",
      exact: true,
    });
    await body.fill("First");
    await began;
    await expect(body).toBeEnabled();
    await body.press("End");
    await body.pressSequentially(" plus more");
    await expect(body).toBeFocused();
    release();
    await expect.poll(() => records[0]?.body).toContain("plus more");
    await expect(body).toBeFocused();
    expect(records[0].revision).toBe(2);
    if (kind === "note") await expect(body).toHaveText("First plus more");
    else await expect(body).toHaveValue("First plus more");
  });
test("blank note can save from body and formatting survives a reload", async ({
  page,
}) => {
  let notes: any[] = [];
  await page.route("**/api/organizer**", (r) => {
    if (r.request().method() === "GET") return r.fulfill({ json: notes });
    const item = r.request().postDataJSON();
    item.revision++;
    notes = [item];
    return r.fulfill({ json: item });
  });
  await go(page, "Notes");
  const body = page.getByRole("textbox", { name: "Note", exact: true });
  await body.fill("Bold field note");
  await body.press("Control+a");
  await page.getByRole("button", { name: "Bold", exact: true }).click();
  await expect.poll(() => notes[0]?.body || "").toMatch(/<(b|strong)>/);
  await page.reload();
  await navigate(page, "Notes");
  await page.locator(".organizer-item").first().click();
  await expect(page.locator(".note-paper b,.note-paper strong")).toHaveText(
    "Bold field note",
  );
});
test("drawer gives every workspace full width and Field is a compact switch", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 560 });
  await page.route("**/api/**", (r) =>
    r.request().method() === "GET" ? r.continue() : r.abort(),
  );
  for (const name of [
    "Notes",
    "Paint",
    "Library",
    "Games",
    "Calendar",
    "Calculator",
    "Shackleton",
    "Emergency",
  ]) {
    await go(page, name);
    expect(
      await page
        .locator("main")
        .evaluate((e) => e.getBoundingClientRect().width),
    ).toBeGreaterThan(950);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(1024);
    await expect(
      page.getByRole("button", { name: "Go Home", exact: true }),
    ).toBeInViewport();
  }
  await expect(
    page.getByRole("switch", { name: "Field mode", exact: true }),
  ).toBeVisible();
});
test("Calendar includes federal observed dates", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-07-02T12:00:00"));
  await page.route("**/api/organizer**", (r) => r.fulfill({ json: [] }));
  await go(page, "Calendar");
  await expect(
    page.getByRole("button", { name: "2026-07-03", exact: true }),
  ).toContainText("Independence Day (observed)");
  await expect(
    page.getByRole("button", { name: "2026-07-04", exact: true }),
  ).toContainText("Independence Day");
});
test("Paint mirrors strokes and offers context actions", async ({ page }) => {
  await page.route("**/api/organizer**", (r) =>
    r.fulfill({
      json:
        r.request().method() === "GET"
          ? []
          : { ...r.request().postDataJSON(), revision: 1 },
    }),
  );
  await go(page, "Paint");
  await page.getByLabel("Mirror drawing").selectOption("vertical");
  const canvas = page.locator(".paint-canvas-wrap canvas");
  await expect(canvas).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Brush tool", exact: true }),
  ).toBeEnabled();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.45);
  await page.mouse.up();
  const pixels = await canvas.evaluate((c: HTMLCanvasElement) => {
    const x = Math.floor(c.width * 0.2),
      y = Math.floor(c.height * 0.4),
      ctx = c.getContext("2d")!;
    return [
      Array.from(ctx.getImageData(x, y, 1, 1).data),
      Array.from(ctx.getImageData(c.width - 1 - x, y, 1, 1).data),
    ];
  });
  expect(pixels[0]).toEqual(pixels[1]);
  expect(pixels[0][0]).toBeLessThan(200);
  await canvas.click({ button: "right" });
  await expect(page.getByRole("menu")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  // Right-drag paints with the background color instead of opening the menu.
  await page.getByLabel("Mirror drawing").selectOption("off");
  await page.getByLabel("Width").selectOption("20");
  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.7);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.7, {
    steps: 6,
  });
  await page.mouse.up();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.6);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.8, {
    steps: 6,
  });
  await page.mouse.up({ button: "right" });
  await expect(page.getByRole("menu")).toHaveCount(0);
  const erased = await canvas.evaluate((c: HTMLCanvasElement) =>
    Array.from(
      c
        .getContext("2d")!
        .getImageData(Math.floor(c.width * 0.3), Math.floor(c.height * 0.7), 1, 1)
        .data,
    ),
  );
  expect(erased).toEqual([255, 255, 255, 255]);
  await page.getByRole('button', {name: 'Color wheel; hold for recent colors'}).click({button: 'right'});
  const swatches = page.locator('.recent-colors button').last();
  await expect(swatches).toBeInViewport();
  await swatches.click();
  await expect(page.locator('.recent-colors')).toHaveCount(0);
});
test("Shackleton drawer deletes only selected chats", async ({ page }) => {
  const a = "11111111-1111-4111-8111-111111111111",
    b = "22222222-2222-4222-8222-222222222222";
  let chats = [
    { id: a, title: "Alpha", revision: 1, updated: new Date().toISOString() },
    { id: b, title: "Beta", revision: 2, updated: new Date().toISOString() },
  ];
  const deleted: string[] = [];
  await page.route("**/api/conversations**", (r) => {
    if (r.request().method() === "DELETE") {
      const id = new URL(r.request().url()).pathname.split("/").at(-1)!;
      deleted.push(id);
      chats = chats.filter((c) => c.id !== id);
      return r.fulfill({ json: { deleted: true } });
    }
    return r.fulfill({ json: { chats } });
  });
  await go(page, "Shackleton");
  await page.getByRole("button", { name: "History", exact: true }).click();
  await page.getByLabel("Select Alpha", { exact: true }).check();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Delete selected (1)", exact: true })
    .click();
  await expect.poll(() => deleted).toEqual([a]);
  await expect(page.getByLabel("Select Beta")).toBeVisible();
  await expect(page.getByLabel("Select Alpha")).toHaveCount(0);
});

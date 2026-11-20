import { test, expect } from "@playwright/test";
import { navigate } from "./navigation";

// Regression checks for layout bugs found in review: legacy rules once
// shrank primitives below the 36px touch minimum, and a Paint menu once
// covered the trigger beneath it.
test.use({ viewport: { width: 1024, height: 600 } });

test("Home bookmark actions meet the 36px touch target", async ({ page }) => {
  await page.goto("/");
  for (const name of [/^Manage/, /^Pin a bookmark from Library/]) {
    const box = await page.getByRole("button", { name }).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(36);
  }
});

test("an open Paint File menu never covers the Canvas trigger", async ({
  page,
}) => {
  await page.goto("/");
  await navigate(page, "Paint");
  const file = page.getByRole("button", { name: /^File/ });
  const canvas = page.getByRole("button", { name: /^Canvas/ });
  await file.click();
  const panel = await page
    .getByRole("group", { name: "File menu" })
    .boundingBox();
  const trigger = await canvas.boundingBox();
  expect(panel && trigger).toBeTruthy();
  const overlaps =
    panel!.x < trigger!.x + trigger!.width &&
    trigger!.x < panel!.x + panel!.width &&
    panel!.y < trigger!.y + trigger!.height &&
    trigger!.y < panel!.y + panel!.height;
  expect(overlaps).toBe(false);
  // One tap on Canvas opens Canvas and closes File.
  await canvas.click();
  await expect(page.getByRole("group", { name: "Canvas menu" })).toBeVisible();
  await expect(page.getByRole("group", { name: "File menu" })).toBeHidden();
});

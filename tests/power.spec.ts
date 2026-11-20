import { navigate } from "./navigation";
import { test, expect, type Page } from "@playwright/test";
const powerButton = (page: Page) =>
  page.getByRole("button", { name: /^Power · / });
async function openPower(page: Page) {
  if ((await powerButton(page).getAttribute("aria-expanded")) !== "true")
    await powerButton(page).click();
  return page.getByRole("dialog", { name: "Power", exact: true });
}
for (const height of [600, 560])
  test(`power controls and warnings fit 1024x${height}`, async ({ page }) => {
    await page.setViewportSize({ width: 1024, height });
    let field = false,
      dim = false;
    await page.route("**/api/power**", async (r) => {
      if (r.request().method() === "POST") {
        if (r.request().url().endsWith("/dim"))
          dim = r.request().postDataJSON().enabled;
        else field = r.request().postDataJSON().enabled;
      }
      await r.fulfill({
        json: {
          field,
          dim,
          percent: 14,
          voltage: 3.65,
          warning: "critical",
          reserveMinutes: 0,
          guard: { valid: true, shutdownSeconds: null },
        },
      });
    });
    await page.goto("/");
    await expect(
      page.getByRole("alert").filter({ hasText: "Very low battery" }),
    ).toBeVisible();
    // One header button carries the battery level and opens the controls.
    await expect(powerButton(page)).toHaveAccessibleName(
      "Power · 14% battery",
    );
    await expect(powerButton(page)).toContainText("14%");
    let panel = await openPower(page);
    await expect(panel).toContainText("14% battery");
    await expect(panel).toBeInViewport({ ratio: 1 });
    await panel
      .getByRole("switch", { name: "Field mode", exact: true })
      .click();
    await expect(
      panel.getByRole("switch", { name: "Field mode", exact: true }),
    ).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("html")).not.toHaveClass(/field-mode/);
    await panel
      .getByRole("switch", { name: "Dim screen", exact: true })
      .click();
    await expect(page.locator("html")).toHaveClass(/field-mode/);
    // Escape closes the popover and returns focus to the button.
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(powerButton(page)).toBeFocused();
    await page.reload();
    panel = await openPower(page);
    await expect(
      panel.getByRole("switch", { name: "Dim screen", exact: true }),
    ).toHaveAttribute("aria-checked", "true");
    // "/" does not open Search over the open popover.
    await page.keyboard.press("/");
    await expect(page.locator(".universal-search")).toHaveCount(0);
    // Tabbing out of the popover closes it.
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Internet radio",{exact:true})).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Computer volume",{exact:true})).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Dark mode" })).toBeFocused();
    await expect(panel).toHaveCount(0);
    for (const section of ["Home", "Shackleton", "Paint", "System"]) {
      await navigate(page, section);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      await expect(powerButton(page)).toBeVisible();
    }
  });

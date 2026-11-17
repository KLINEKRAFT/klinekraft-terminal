import type { Page } from "@playwright/test";
export async function navigate(page: Page, label: string) {
  const drawer = page.getByRole("navigation", {
    name: "Main navigation",
    exact: true,
  });
  if (!(await drawer.isVisible()))
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
  await drawer
    .getByRole("button", {
      name: new RegExp(
        `^\\d+ ${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
      ),
    })
    .click();
  if (await drawer.isVisible())
    await page
      .getByRole("button", { name: "Collapse sidebar", exact: true })
      .click();
}

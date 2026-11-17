import type { Page } from "@playwright/test";
export async function navigate(page: Page, label: string) {
  if (["Files", "Network", "System"].includes(label)) {
    await navigate(page, "Home");
    await page
      .getByRole("navigation", { name: "Device tools", exact: true })
      .getByRole("button", { name: label, exact: true })
      .click();
    return;
  }
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

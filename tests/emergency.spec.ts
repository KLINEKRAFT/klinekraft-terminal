import { navigate } from "./navigation";
import { test, expect } from "@playwright/test";

test("Emergency distinguishes untested resources and displays verification dates", async ({
  page,
}) => {
  await page.route("**/api/emergency/status", (route) =>
    route.fulfill({
      json: {
        checkedAt: new Date().toISOString(),
        library: { documents: 40, searchable: 35, historical: 12 },
        checks: [
          {
            name: "Offline Shackleton",
            state: "Not tested",
            checkedAt: null,
            detail: "Model installed; no generation test.",
          },
          {
            name: "Encrypted backup",
            state: "Ready",
            checkedAt: "2026-11-16T16:16:57Z",
            detail: "Last successful backup.",
          },
          {
            name: "Offline maps",
            state: "Needs retest",
            checkedAt: "2026-10-01T12:00:00Z",
            detail: "Local map archive.",
          },
        ],
      },
    }),
  );
  await page.route("**/api/**", (route) =>
    route.request().method() === "GET" ? route.fallback() : route.abort(),
  );
  await page.setViewportSize({ width: 1024, height: 560 });
  await page.goto("/");
  await navigate(page, "Emergency");
  await page
    .getByText("Deck readiness & backup checks", { exact: true })
    .click();
  await expect(
    page.locator(".readiness-card").filter({ hasText: "Offline Shackleton" }),
  ).toContainText("Not tested");
  await expect(
    page.locator(".readiness-card").filter({ hasText: "Encrypted backup" }),
  ).toContainText("Nov 16");
  await page
    .getByRole("button", { name: "Cold War archive", exact: true })
    .click();
  await expect(
    page.getByText("Cold War documents are historical records", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("searchbox", { name: "Search files" }),
  ).toHaveValue("HISTORICAL");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    1024,
  );
});

test("Quick references remain readable when all APIs are unavailable", async ({
  page,
}) => {
  await page.route("**/api/**", (route) => route.abort());
  await page.setViewportSize({ width: 1024, height: 560 });
  await page.goto("/");
  await navigate(page, "Emergency");
  await expect(
    page.getByRole("article", { name: "Power outage — first actions" }),
  ).toContainText("20 feet");
  await page
    .getByRole("button", { name: "Water & sanitation", exact: true })
    .click();
  await expect(
    page.getByRole("article", { name: "Drinking water — first actions" }),
  ).toContainText("6,500 feet");
  await expect(page.getByRole("article")).toContainText("radioactive material");
  await page.getByRole("button", { name: "First aid", exact: true }).click();
  await expect(page.getByRole("article")).toContainText("911");
});

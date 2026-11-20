import { test, expect } from "@playwright/test";
import { navigate } from "./navigation";

test("calculator keeps desk behavior and converts units both ways", async ({
  page,
}) => {
  await page.goto("/");
  await navigate(page, "Calculator");
  const calculator = page.getByRole("region", { name: "Calculator" });
  const key = (name: string) =>
    calculator.getByRole("button", { name, exact: true });
  for (const name of ["2", "+", "3", "="]) await key(name).click();
  await expect(calculator.locator("output")).toHaveText("5");
  // An operator after "=" continues from the answer.
  for (const name of ["×", "4", "="]) await key(name).click();
  await expect(calculator.locator("output")).toHaveText("20");
  await expect(
    calculator.getByRole("button", { name: /^5×4\s*=\s*20$/ }),
  ).toBeVisible();
  await page.getByLabel("Expression").fill("999999999999+2");
  await page.getByLabel("Expression").press("Enter");
  await expect(calculator.locator("output")).toHaveText("1000000000001");

  const quantity = page.getByRole("combobox", { name: "Quantity" });
  await expect(quantity).toHaveValue("temperature");
  // No placeholder pretends that 0 °F equals 0 °C.
  for (const name of ["Fahrenheit", "Celsius"])
    expect(
      await page.getByRole("textbox", { name }).getAttribute("placeholder"),
    ).toBeNull();
  await page.getByRole("textbox", { name: "Fahrenheit" }).fill("212");
  await expect(page.getByRole("textbox", { name: "Celsius" })).toHaveValue(
    "100",
  );
  await page.getByRole("textbox", { name: "Celsius" }).fill("-40");
  await expect(page.getByRole("textbox", { name: "Fahrenheit" })).toHaveValue(
    "-40",
  );
  await quantity.selectOption("distance");
  await page.getByRole("textbox", { name: "Miles" }).fill("26.2");
  await expect(page.getByRole("textbox", { name: "Kilometers" })).toHaveValue(
    "42.1648128",
  );
  await page.getByRole("textbox", { name: "Kilometers" }).fill("-");
  await expect(page.getByRole("textbox", { name: "Miles" })).toHaveValue("");
  // Changing quantity keeps the number typed on the metric side, not the
  // derived U.S. value.
  await quantity.selectOption("temperature");
  await page.getByRole("textbox", { name: "Celsius" }).fill("100");
  await expect(page.getByRole("textbox", { name: "Fahrenheit" })).toHaveValue(
    "212",
  );
  await quantity.selectOption("distance");
  await expect(page.getByRole("textbox", { name: "Kilometers" })).toHaveValue(
    "100",
  );
  await expect(page.getByRole("textbox", { name: "Miles" })).toHaveValue(
    "62.13711922",
  );
  await quantity.selectOption("small-weight");
  await page.getByRole("textbox", { name: "Ounces" }).fill("16");
  await expect(page.getByRole("textbox", { name: "Grams" })).toHaveValue(
    "453.59237",
  );
});

for (const height of [600, 560])
  test(`calculator and converter fit 1024x${height} without scrolling`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height });
    await page.goto("/");
    await navigate(page, "Calculator");
    const content = await page
      .locator(".page-content")
      .evaluate((e) => [
        e.scrollHeight,
        e.clientHeight,
        e.scrollWidth,
        e.clientWidth,
      ]);
    expect(content[0]).toBeLessThanOrEqual(content[1]);
    expect(content[2]).toBeLessThanOrEqual(content[3]);
    for (const name of ["=", "Clear", "0"]) {
      const button = page.getByRole("button", { name, exact: true });
      await expect(button).toBeInViewport({ ratio: 1 });
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(36);
    }
    await expect(
      page.getByRole("combobox", { name: "Quantity" }),
    ).toBeInViewport({ ratio: 1 });
    // The Info (i) button keeps the 36px touch size too.
    const help = (await page
      .locator('summary[aria-label="Calculator help"]')
      .boundingBox())!;
    expect(help.width).toBeGreaterThanOrEqual(36);
    expect(help.height).toBeGreaterThanOrEqual(36);
  });

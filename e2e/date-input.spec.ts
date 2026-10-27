import { expect, test } from "@playwright/test";

test.use({ locale: "ja-JP" });

test("English calendar supports historical dates, leap days, keyboard closing and clearing", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add flight", exact: true }).click();
  const input = page.getByLabel("Departure date", { exact: false });
  const toggle = page.getByRole("button", { name: "Choose from calendar" });
  await toggle.click();
  const calendar = page.getByRole("group", { name: "Departure calendar" });
  await expect(calendar).toBeVisible();
  await page.getByLabel("Year", { exact: true }).selectOption("2024");
  await page.getByLabel("Month", { exact: true }).selectOption("1");
  const bounds = await calendar.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  await page.screenshot({ path: test.info().outputPath("calendar.png") });
  await page
    .getByRole("button", { name: "February 29, 2024", exact: true })
    .click();
  await expect(input).toHaveValue("2024-02-29");
  await expect(calendar).toBeHidden();
  await expect(toggle).toBeFocused();
  await toggle.click();
  await page.getByRole("button", { name: "Next month" }).click();
  await page.getByRole("button", { name: "Previous month" }).click();
  await expect(
    page.getByRole("button", { name: "February 29, 2024", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(calendar).toBeHidden();
  await expect(page.getByRole("dialog")).toBeVisible();
  await toggle.click();
  await page.getByRole("button", { name: "Clear date", exact: true }).click();
  await expect(input).toHaveValue("");
});

test("unpadded typed dates normalize and invalid calendar dates cannot be saved", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add flight", exact: true }).click();
  const date = page.getByLabel("Departure date", { exact: false });
  await date.fill("2024/2/9");
  await date.press("Tab");
  await expect(date).toHaveValue("2024-02-09");
  await page.getByRole("combobox", { name: "Departure airport" }).fill("PRG");
  await page.getByRole("option").filter({ hasText: "PRG" }).first().click();
  await page.getByRole("combobox", { name: "Arrival airport" }).fill("LHR");
  await page.getByRole("option").filter({ hasText: "LHR" }).first().click();
  await date.fill("2023-02-29");
  await page.getByRole("button", { name: "Save flight", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("valid calendar date");
  await date.fill("2024-2-29");
  await page.getByRole("button", { name: "Save flight", exact: true }).click();
  await expect(page.getByText("Feb 29, 2024")).toBeVisible();
  await expect(page.getByRole("dialog")).toBeHidden();
});

import { expect, test } from "@playwright/test";

test("map startup failures preserve journal and backup access", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args: Parameters<typeof getContext>
    ) {
      if (String(args[0]).startsWith("webgl")) return null;
      return getContext.apply(this, args);
    } as typeof getContext;
  });
  await page.goto("/");
  await expect(page.locator(".map-error")).toContainText(
    "The map could not start",
  );
  await expect(
    page.getByRole("button", { name: "Add flight", exact: true }),
  ).toBeEnabled();
  await expect(page.getByRole("button", { name: "Retry map" })).toBeEnabled();
  await page.getByRole("button", { name: "Backup & restore" }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download backup" }).click();
  expect((await downloaded).suggestedFilename()).toMatch(/^tabibito-.*\.json$/);
});

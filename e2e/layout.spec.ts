import { test, expect } from "@playwright/test";
import { backupFor, restore } from "./helpers";
import { input } from "../tests/fixtures";

test.beforeEach(async ({ page }) => {
  await page.route("https://tiles.openfreemap.org/**", route => route.request().url().includes("/styles/")
    ? route.fulfill({ json: { version: 8, sources: {}, layers: [{ id: "background", type: "background", paint: { "background-color": "#edf0f1" } }] } })
    : route.fulfill({ contentType: "application/x-protobuf", body: Buffer.alloc(0) }));
  await page.goto("/");
});

test("fills the viewport and keeps floating controls and history usable", async ({ page }) => {
  await restore(page, backupFor(Array.from({ length: 30 }, (_, i) => ({ ...input, flightNumber: `BA${i}` }))));
  await expect(page.getByRole("button", { name: "Export map", exact: true })).toBeEnabled();
  for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(size);
    await expect(page.locator(".stats")).toBeInViewport();
    expect(await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }))).toEqual(size);
    if (size.width < 900) await page.getByRole("button", { name: "History", exact: true }).click();
    await expect(page.getByLabel("Search flight history")).toBeVisible();
    expect(await page.locator(".history-list").evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
    if (size.width < 900) {
      await page.keyboard.press("Escape");
      await expect(page.getByRole("button", { name: "History", exact: true })).toBeFocused();
    }
    const before = await page.locator(".map-canvas").boundingBox();
    await page.getByRole("button", { name: "Timeline", exact: true }).click();
    const controls = page.getByRole("group", { name: "Timeline", exact: true });
    await expect(controls).toBeInViewport();
    expect(await page.locator(".map-canvas").boundingBox()).toEqual(before);
    await controls.getByRole("button", { name: "Choose from calendar" }).first().click();
    await controls.getByLabel("Year", { exact: true }).selectOption("2024");
    await controls.getByLabel("Month", { exact: true }).selectOption("6");
    await controls.getByRole("button", { name: "July 9, 2024", exact: true }).click();
    await controls.getByRole("button", { name: "Play", exact: true }).click();
    await controls.getByRole("button", { name: "Pause", exact: true }).click();
    await page.screenshot({ path: test.info().outputPath(`workspace-${size.width}.png`) });
    await page.getByRole("button", { name: "Timeline", exact: true }).click();
    await page.screenshot({ path: test.info().outputPath(`workspace-${size.width}-map.png`) });
  }
});

test("drawer selection closes it, filters survive reopening, and desktop restores the sidebar", async ({ page }) => {
  await restore(page, backupFor([input]));
  await page.setViewportSize({ width: 390, height: 844 });
  const toggle = page.getByRole("button", { name: "History", exact: true });
  await toggle.click();
  await page.getByLabel("Search flight history").focus();
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    // Native dialogs may cycle focus through browser chrome (reported as body),
    // but must never focus a background application control.
    expect(await page.evaluate(() => document.activeElement === document.body ||
      Boolean(document.activeElement?.closest(".history-drawer")))).toBe(true);
  }
  await page.getByLabel("Search flight history").fill("PRG");
  await page.getByRole("button", { name: "Show PRG to LHR on map" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await toggle.click();
  await expect(page.getByLabel("Search flight history")).toHaveValue("PRG");
  await page.setViewportSize({ width: 1200, height: 800 });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Search flight history")).toBeVisible();
});

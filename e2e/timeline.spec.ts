import { test, expect } from "@playwright/test";
import { backupFor, restore } from "./helpers";
import { input, hnd, sfo } from "../tests/fixtures";

test.beforeEach(async ({ page }) => {
  await page.route("https://tiles.openfreemap.org/**", route => route.request().url().includes("/styles/")
    ? route.fulfill({ json: { version: 8, sources: {}, layers: [{ id: "background", type: "background", paint: { "background-color": "#e8eeea" } }] } })
    : route.fulfill({ contentType: "application/x-protobuf", body: Buffer.alloc(0) }));
  await page.goto("/");
  await restore(page, backupFor([
    input,
    { ...input, origin: hnd, destination: sfo },
    { ...input, date: "2025-02-01", stops: [hnd], destination: sfo },
    { ...input, date: null },
  ]));
  await expect(page.getByRole("button", { name: "Export map", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Timeline", exact: true }).click();
});

test("plays grouped dates, pauses, seeks, replays, and restores the normal map", async ({ page }) => {
  const controls = page.getByRole("group", { name: "Timeline", exact: true });
  await expect(controls.getByLabel("Start date", { exact: true })).toHaveValue("2024-07-09");
  await expect(controls.getByLabel("End date", { exact: true })).toHaveValue("2025-02-01");
  await expect(controls).toContainText("Undated flights excluded: 1.");
  await expect(page.locator(".map-legend")).toContainText("0 flights");
  await expect(page.locator(".flight-card")).toHaveCount(4);
  await controls.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.locator(".map-legend")).toContainText("2 flights");
  await expect(page.getByRole("button", { name: "Export map", exact: true })).toBeDisabled();
  await controls.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByRole("button", { name: "Export map", exact: true })).toBeEnabled();
  await controls.getByRole("slider").fill("1");
  await expect(controls.locator("output")).toHaveText("Jul 9, 2024");
  await expect(page.locator(".map-legend")).toContainText("2 flights");
  await page.getByRole("button", { name: "Globe", exact: true }).click();
  await controls.getByRole("slider").fill("2");
  await expect(page.locator(".map-legend")).toContainText("3 flights");
  await expect(controls.getByRole("button", { name: "Replay", exact: true })).toBeVisible();
  await controls.getByRole("button", { name: "Restart", exact: true }).click();
  await expect(page.locator(".map-legend")).toContainText("0 flights");
  await controls.getByLabel("Speed").selectOption("2");
  await controls.getByRole("button", { name: "Play", exact: true }).click();
  await expect(controls.getByRole("button", { name: "Replay", exact: true })).toBeVisible({ timeout: 6000 });
  await expect(page.locator(".map-legend")).toContainText("3 flights");
  await page.screenshot({ path: test.info().outputPath("timeline.png"), fullPage: true });
  await page.getByRole("button", { name: "Timeline", exact: true }).click();
  await expect(page.locator(".map-legend")).toContainText("4 flights");
});

test("validates ranges, resets on filters, and does not reset on an unchanged focus refresh", async ({ page }) => {
  const controls = page.getByRole("group", { name: "Timeline", exact: true });
  await controls.getByRole("slider").fill("1");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(controls.getByRole("slider")).toHaveValue("1");
  await controls.getByLabel("Start date", { exact: true }).fill("2026-01-01");
  await expect(controls.locator("p[role=status]")).toContainText("Enter valid");
  await expect(controls.getByRole("button", { name: "Play", exact: true })).toBeDisabled();
  await page.getByLabel("Filter by year").selectOption("2024");
  await expect(controls.getByLabel("Start date", { exact: true })).toHaveValue("2024-07-09");
  await expect(controls.getByLabel("End date", { exact: true })).toHaveValue("2024-07-09");
  await controls.getByRole("slider").fill("1");
  await expect(page.locator(".map-legend")).toContainText("2 flights");
  await page.getByLabel("Filter by year").selectOption("undated");
  await expect(controls.getByRole("button", { name: "Play", exact: true })).toBeDisabled();
  await expect(page.locator(".flight-card")).toHaveCount(1);
});

test("supports reduced motion and localized controls", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const controls = page.getByRole("group", { name: "Timeline", exact: true });
  await controls.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.locator(".map-legend")).toContainText("0 flights");
  await expect(page.locator(".map-legend")).toContainText("2 flights", { timeout: 4000 });
  await controls.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByLabel("Language", { exact: true }).selectOption("zh-Hans");
  await expect(page.getByRole("button", { name: "播放", exact: true })).toBeVisible();
  await expect(page.getByLabel("开始日期", { exact: true })).toHaveValue("2024-07-09");
});

test("exports a paused frame and resets when flight history changes", async ({ page }) => {
  const controls = page.getByRole("group", { name: "Timeline", exact: true });
  await controls.getByRole("slider").focus();
  await page.keyboard.press("ArrowRight");
  await expect(controls.getByRole("slider")).toHaveValue("1");
  // Hold PNG encoding until the disabled controls have been checked.
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, ...args) {
      HTMLCanvasElement.prototype.toBlob = original;
      original.call(this, blob => {
        window.addEventListener("finish-test-export", () => callback(blob), { once: true });
        document.documentElement.dataset.exportEncoded = "true";
      }, ...args);
    };
  });
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export map", exact: true }).click();
  await expect(controls.getByRole("slider")).toBeDisabled();
  await expect(page.locator("html")).toHaveAttribute("data-export-encoded", "true");
  await page.evaluate(() => window.dispatchEvent(new Event("finish-test-export")));
  const download = await downloaded;
  expect(download.suggestedFilename()).toMatch(/^tabibito-map-.*\.png$/);
  await expect(controls.getByRole("slider")).toBeEnabled();
  await restore(page, backupFor([{ ...input, date: "2024-08-01" }]));
  await expect(controls.getByRole("slider")).toHaveValue("0");
  await expect(controls.getByLabel("Start date", { exact: true })).toHaveValue("2024-07-09");
  await controls.getByRole("button", { name: "Play", exact: true }).click();
  await expect(controls.locator("output")).toHaveText("Aug 1, 2024");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(controls.getByRole("button", { name: "Play", exact: true })).toBeVisible();
});

test("pauses on map failure and preserves playback progress through retry", async ({ page }) => {
  const controls = page.getByRole("group", { name: "Timeline", exact: true });
  await controls.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.locator(".map-legend")).toContainText("2 flights");
  const styleUrl = "https://tiles.openfreemap.org/styles/positron";
  await page.route(styleUrl, route => route.abort());
  await page.getByLabel("Language", { exact: true }).selectOption("zh-Hans");
  await expect(page.locator(".map-error")).toBeVisible();
  await expect(page.getByRole("button", { name: "播放", exact: true })).toBeDisabled();
  await expect(page.locator(".flight-card")).toHaveCount(4);
  await page.unroute(styleUrl);
  await page.locator(".map-error button").click();
  await expect(page.getByRole("button", { name: "播放", exact: true })).toBeEnabled();
  await expect(page.locator(".map-legend")).toContainText("2 次飞行");
  await expect(page.getByRole("button", { name: "暂停", exact: true })).toHaveCount(0);
});

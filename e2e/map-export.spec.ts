import { backupFor, restore } from "./helpers";
import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { input, lhr, sfo } from "../tests/fixtures";

test.beforeEach(async ({ page }) => {
  await page.route("https://tiles.openfreemap.org/**", (route) => {
    if (route.request().url().includes("/styles/"))
      return route.fulfill({
        json: {
          version: 8,
          glyphs:
            "https://tiles.openfreemap.org/test-glyphs/{fontstack}/{range}.pbf",
          sources: {},
          layers: [
            {
              id: "background",
              type: "background",
              paint: { "background-color": "#e8eeea" },
            },
          ],
        },
      });
    return route.fulfill({
      contentType: "application/x-protobuf",
      body: Buffer.alloc(0),
    });
  });
  await page.goto("/");
  await restore(page, backupFor([{ ...input, origin: lhr, destination: sfo }]));
  await expect(
    page.getByRole("button", { name: "Export map", exact: true }),
  ).toBeEnabled();
});

test("downloads rendered map and globe PNGs with routes and a credit footer", async ({
  page,
}, testInfo) => {
  await page.getByRole("button", { name: "Show LHR to SFO on map" }).click();
  await page.getByRole("button", { name: "Show all", exact: true }).click();
  for (const projection of ["Map", "Globe"]) {
    await page.getByRole("button", { name: projection, exact: true }).click();
    // Allow the on-screen projection transition to finish before capturing it.
    await page.waitForTimeout(1500);
    const downloaded = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export map", exact: true }).click();
    const download = await downloaded;
    expect(download.suggestedFilename()).toMatch(
      /^tabibito-map-\d{4}-\d{2}-\d{2}\.png$/,
    );
    const path = testInfo.outputPath(`${projection.toLowerCase()}.png`);
    await download.saveAs(path);
    const buffer = await readFile(path);
    expect(buffer.subarray(1, 4).toString()).toBe("PNG");
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    expect(Math.max(width, height - 112)).toBeGreaterThanOrEqual(2399);
    expect(Math.max(width, height - 112)).toBeLessThanOrEqual(2401);
    const pixels = await page.evaluate(async (base64) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      const map = context.getImageData(
        0,
        0,
        image.width,
        image.height - 112,
      ).data;
      let routePixels = 0;
      for (let i = 0; i < map.length; i += 4) {
        // Selected route is orange, distinct from the fixture basemap.
        if (
          map[i] > 150 &&
          map[i + 1] > 60 &&
          map[i + 1] < 150 &&
          map[i + 2] < 100 &&
          map[i + 3] === 255
        )
          routePixels++;
      }
      const footer = context.getImageData(
        0,
        image.height - 112,
        image.width,
        112,
      ).data;
      let textPixels = 0;
      for (let i = 0; i < footer.length; i += 4)
        if (footer[i] < 120 && footer[i + 1] < 140) textPixels++;
      return { routePixels, textPixels };
    }, buffer.toString("base64"));
    expect(pixels.routePixels).toBeGreaterThan(100);
    expect(pixels.textPixels).toBeGreaterThan(100);
    await expect(
      page.getByRole("button", { name: "Export map", exact: true }),
    ).toBeEnabled();
    expect(await page.locator('body > div[aria-hidden="true"]').count()).toBe(
      0,
    );
  }
});

test("export failure is recoverable and leaves flight history available", async ({
  page,
}) => {
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback) {
      HTMLCanvasElement.prototype.toBlob = original;
      callback(null);
    };
  });
  await page.getByRole("button", { name: "Export map", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("could not encode");
  await expect(
    page.getByRole("button", { name: "Show LHR to SFO on map" }),
  ).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export map", exact: true }).click();
  await downloaded;
  await expect(page.getByRole("alert")).toHaveCount(0);
});

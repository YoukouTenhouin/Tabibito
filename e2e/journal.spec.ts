import { backupFor, backupFile, restore } from "./helpers";
import { expect, test } from "@playwright/test";
import { input, prg, lhr, hnd, sfo } from "../tests/fixtures";

test("map and globe render transatlantic and date-line routes", async ({
  page,
}) => {
  // Keep browser QA independent of the public tile service. MapLibre still renders
  // the real route sources and projections using its WebGL renderer.
  await page.route("https://tiles.openfreemap.org/**", (route) => {
    if (route.request().url().includes("/styles/")) {
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
    }
    return route.fulfill({
      contentType: "application/x-protobuf",
      body: Buffer.alloc(0),
    });
  });
  await page.goto("/");
  await restore(
    page,
    backupFor([
      { ...input, origin: lhr, destination: sfo },
      { ...input, origin: hnd, destination: sfo, flightNumber: "NH108" },
    ]),
  );
  await expect(
    page.getByRole("button", { name: "Globe", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Show HND to SFO on map" }).click();
  await page.getByRole("button", { name: "Globe", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Globe", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await expect(page.locator(".map-canvas")).toBeVisible();
  expect(
    (await page.locator(".map-canvas").boundingBox())!.height,
  ).toBeGreaterThan(200);
  await page.getByRole("button", { name: "Map", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Map", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Show all", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Show LHR to SFO on map" }),
  ).toBeVisible();
});

test("manual journey, history filters, editing and deletion", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add flight", exact: true }).click();
  await page.getByLabel("Departure date").fill("2024-07-09");
  await page.getByLabel("Flight number", { exact: false }).fill("BA853");
  await page.getByRole("combobox", { name: "Departure airport" }).fill("PRG");
  await page.getByRole("option").filter({ hasText: "PRG" }).first().click();
  await page.getByRole("combobox", { name: "Arrival airport" }).fill("LHR");
  await page.getByRole("option").filter({ hasText: "LHR" }).first().click();
  await page.getByRole("button", { name: "Save flight", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Show PRG to LHR on map" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText("BA853", { exact: true })).toBeVisible();
  await page.getByLabel("Search flight history").fill("Tokyo");
  await expect(page.getByText("No matching journeys")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByRole("button", { name: "Edit flight BA853" }).click();
  await page.getByLabel("Departure date").fill("2023-10-15");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Oct 15, 2023")).toBeVisible();
  await page.getByRole("button", { name: "Delete flight BA853" }).click();
  await page
    .getByRole("button", { name: "Delete flight", exact: true })
    .click();
  await expect(page.getByText("Your story starts here")).toBeVisible();
});

test("backup export and restore preview, cancel and confirm", async ({
  page,
}) => {
  const backup = backupFor([input]);
  await page.goto("/");
  await restore(page, backup);
  await page.getByRole("button", { name: "Backup & restore" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download backup" }).click();
  expect((await downloadPromise).suggestedFilename()).toMatch(
    /^tabibito-.*\.json$/,
  );
  const file = {
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  };
  await page.getByLabel("Choose backup", { exact: true }).setInputFiles(file);
  await expect(page.getByText("1 flights in this backup")).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator(".flight-card")).toHaveCount(1);
  await restore(page, backupFor([input, { ...input, date: null }]));
  await page.getByRole("button", { name: "Backup & restore" }).click();
  await page.getByLabel("Choose backup", { exact: true }).setInputFiles(file);
  await page.getByLabel("Replace my current history with this backup").check();
  await page.getByRole("button", { name: "Replace history" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".flight-card")).toHaveCount(1);
});

test("manual entry stays available without maps or flight APIs", async ({
  page,
}) => {
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/"))
      apiRequests.push(request.url());
  });
  await page.route("https://tiles.openfreemap.org/**", (route) =>
    route.abort(),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Add flight", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Find by flight number" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "Departure airport" }),
  ).toBeVisible();
  expect(apiRequests).toEqual([]);
});

test("browser contexts are isolated and imports reject stale previews across tabs", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  const backup = backupFor([input]);
  await restore(page, backup);
  const separate = await browser.newContext();
  try {
    const isolatedPage = await separate.newPage();
    await isolatedPage.goto("http://localhost:3100/");
    await expect(
      isolatedPage.getByText("Your story starts here"),
    ).toBeVisible();
  } finally {
    await separate.close();
  }
  await page.getByRole("button", { name: "Backup & restore" }).click();
  await page
    .getByLabel("Choose backup", { exact: true })
    .setInputFiles(backupFile(backup));
  await expect(page.getByText("1 flights in this backup")).toBeVisible();
  const second = await page.context().newPage();
  await second.goto("/");
  await restore(second, backupFor([input, { ...input, date: null }]));
  await page.bringToFront();
  await page.getByLabel("Replace my current history with this backup").check();
  await page
    .getByRole("button", { name: "Replace history", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "History changed since the preview",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.reload();
  await expect(page.locator(".flight-card")).toHaveCount(2);
});

test("invalid imports preserve history and downloaded backups contain the saved records", async ({
  page,
}) => {
  await page.goto("/");
  const backup = backupFor([input]);
  await restore(page, backup);
  await page.getByRole("button", { name: "Backup & restore" }).click();
  await page
    .getByLabel("Choose backup", { exact: true })
    .setInputFiles({
      name: "broken.json",
      mimeType: "application/json",
      buffer: Buffer.from("not JSON"),
    });
  await expect(page.getByRole("alert")).toContainText("not valid JSON");
  await expect(
    page.getByRole("button", { name: "Replace history", exact: true }),
  ).toBeDisabled();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download backup" }).click();
  const download = await downloading;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const exported = JSON.parse(Buffer.concat(chunks).toString());
  expect(exported.app).toBe("tabibito");
  expect(exported.version).toBe(1);
  expect(exported.flights).toEqual(backup.flights);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator(".flight-card")).toHaveCount(1);
});

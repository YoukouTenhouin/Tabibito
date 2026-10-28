import { openHistory, closeHistory } from "./helpers";
import { backupFor, restore } from "./helpers";
import { expect, test } from "@playwright/test";
import { input, prg, lhr } from "../tests/fixtures";

test("distance totals count every flight, survive filters and update after deletion", async ({
  page,
}) => {
  await page.goto("/");
  const summary = page.getByRole("group", {
    name: "Estimated total flight distance",
  });
  await expect(summary).toContainText("0 km");
  await expect(summary).toContainText("0 miles");
  const journey = {
    ...input,
    origin: { ...prg, latitude: 0, longitude: 0 },
    destination: { ...lhr, latitude: 0, longitude: 1 },
  };
  await restore(page, backupFor([journey, { ...journey, date: null }]));
  await page.reload();
  await expect(summary).toContainText("222 km");
  await expect(summary).toContainText("138 miles");
  await openHistory(page);
  await page.getByLabel("Search flight history").fill("nonexistent airport");
  await expect(page.getByText("No matching journeys")).toBeVisible();
  await expect(summary).toContainText("222 km");
  await closeHistory(page);
  await restore(page, backupFor([journey]));
  await page.reload();
  await expect(summary).toContainText("111 km");
  await expect(summary).toContainText("69 miles");
  const box = await summary.boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
});

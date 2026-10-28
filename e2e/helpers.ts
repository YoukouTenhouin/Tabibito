import { expect, type Page } from "@playwright/test";
import type { FlightInput, Backup } from "../src/shared";
export function backupFor(inputs: FlightInput[]): Backup {
  return {
    app: "tabibito",
    version: 2,
    exportedAt: new Date().toISOString(),
    flights: inputs.map((input) => ({
      ...input,
      stops: input.stops ?? [],
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
  };
}
export const backupFile = (backup: Backup) => ({
  name: "backup.json",
  mimeType: "application/json",
  buffer: Buffer.from(JSON.stringify(backup)),
});
export async function restore(page: Page, backup: Backup) {
  await page.getByRole("button", { name: "Backup & restore" }).click();
  await page
    .getByLabel("Choose backup", { exact: true })
    .setInputFiles(backupFile(backup));
  await page.getByLabel("Replace my current history with this backup").check();
  await page
    .getByRole("button", { name: "Replace history", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

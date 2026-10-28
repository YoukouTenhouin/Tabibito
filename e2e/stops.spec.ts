import { openHistory } from "./helpers";
import { test, expect } from '@playwright/test';
import { backupFor, restore } from './helpers';
import { input, hnd, sfo } from '../tests/fixtures';

test('stops persist and can be reordered and removed', async ({ page }) => {
 await page.goto('/');
 await restore(page, backupFor([{...input, stops:[hnd,sfo]}]));
 await expect(page.locator('.flight-card')).toContainText('Via HND → SFO');
  await openHistory(page);
 await page.getByRole('button', {name:'Edit flight BA853'}).click();
 await page.getByRole('button', {name:'Move down'}).first().click();
 await page.getByRole('button', {name:'Save changes'}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.reload();
 await expect(page.locator('.flight-card')).toContainText('Via SFO → HND');
  await openHistory(page);
 await page.getByRole('button', {name:'Edit flight BA853'}).click();
 await page.getByRole('button', {name:'Remove stop'}).first().click();
 await page.getByRole('button', {name:'Save changes'}).click();
 await expect(page.locator('.flight-card')).toContainText('Via HND');
  await openHistory(page);
 await page.getByLabel('Search flight history').fill('Tokyo');
 await expect(page.locator('.flight-card')).toHaveCount(1);
});

import { expect, test } from "@playwright/test";

test('system preference, saved overrides, and dark forms', async ({ page }) => {
  await page.route('https://tiles.openfreemap.org/**', route => route.fulfill({ json: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#edf0f1' } }] } }));
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Theme', exact: true }).click();
  await page.getByRole('radio', { name: 'Light', exact: true }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Theme', exact: true }).click();
  await page.getByRole('radio', { name: 'System', exact: true }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('radio', { name: 'Dark', exact: true }).check();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Add flight', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCSS('background-color', 'rgb(27, 38, 33)');
});

test('theme remains usable when preference storage is blocked', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('Blocked'); };
    Storage.prototype.setItem = () => { throw new Error('Blocked'); };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Theme', exact: true }).click();
  await page.getByRole('radio', { name: 'Dark', exact: true }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.keyboard.press('Escape');
  await page.screenshot({ path: test.info().outputPath('dark-workspace.png') });
});


test('both themes request Positron and dark exports use its recolored canvas', async ({ page }) => {
  const requests: string[] = [];
  await page.route('https://tiles.openfreemap.org/**', route => {
    requests.push(route.request().url());
    return route.fulfill({ json: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#edf0f1' } }] } });
  });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const exportButton = page.getByRole('button', { name: 'Export map', exact: true });
  await expect(exportButton).toBeEnabled();
  await page.getByRole('button', { name: 'Theme', exact: true }).click();
  await page.getByRole('radio', { name: 'Dark', exact: true }).check();
  await page.keyboard.press('Escape');
  await expect.poll(() => requests.length).toBeGreaterThanOrEqual(2);
  await expect(exportButton).toBeEnabled();
  const download = page.waitForEvent('download');
  await exportButton.click();
  const stream = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const pixel = await page.evaluate(async base64 => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    return Array.from(context.getImageData(10, 10, 1, 1).data);
  }, Buffer.concat(chunks).toString('base64'));
  expect(pixel).toEqual([27, 38, 33, 255]);
  expect(requests.every(url => url.endsWith('/styles/positron'))).toBe(true);
});

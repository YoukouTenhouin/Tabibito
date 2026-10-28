import { openHistory, closeHistory } from "./helpers";
import { expect, test, type Page } from "@playwright/test";
import { backupFile, backupFor } from "./helpers";
import { input } from "../tests/fixtures";

test.use({ locale: "zh-CN" });

async function mockMap(page: Page) {
  await page.route("https://tiles.openfreemap.org/**", (route) => {
    if (route.request().url().includes("/styles/"))
      return route.fulfill({
        json: {
          version: 8,
          glyphs:
            "https://tiles.openfreemap.org/test-glyphs/{fontstack}/{range}.pbf",
          sources: {
            places: {
              type: "geojson",
              data: {
                type: "FeatureCollection",
                features: [
                  {
                    type: "Feature",
                    geometry: { type: "Point", coordinates: [12, 25] },
                    properties: {
                      name: "Test City",
                      "name:zh-Hans": "测试城市",
                    },
                  },
                ],
              },
            },
          },
          layers: [
            {
              id: "background",
              type: "background",
              paint: { "background-color": "#e8eeea" },
            },
            {
              id: "city-name",
              type: "symbol",
              source: "places",
              layout: {
                "text-field": ["get", "name"],
                "text-font": ["Noto Sans Regular"],
                "text-size": 18,
              },
            },
          ],
        },
      });
    return route.fulfill({
      contentType: "application/x-protobuf",
      body: Buffer.alloc(0),
    });
  });
}

test("detects Chinese, remembers a manual choice and fits the viewport", async ({
  page,
}) => {
  await mockMap(page);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hans");
  await expect(page).toHaveTitle("Tabibito — 记录你的旅途");
  await expect(
    page.getByRole("button", { name: "添加飞行", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("语言", { exact: true })).toHaveValue("zh-Hans");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await closeHistory(page);
  await page.getByLabel("语言", { exact: true }).selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("button", { name: "Add flight", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Language", { exact: true })).toHaveValue("en");
  await closeHistory(page);
  await page.getByLabel("Language", { exact: true }).selectOption("zh-Hans");
  await page.reload();
  await expect(page.getByLabel("语言", { exact: true })).toHaveValue("zh-Hans");
});

test("Chinese airport search, calendar, validation, editing and deletion", async ({
  page,
}, testInfo) => {
  await mockMap(page);
  await page.goto("/");
  await page.getByRole("button", { name: "添加飞行", exact: true }).click();
  await page.getByRole("button", { name: "从日历选择" }).click();
  await page.getByLabel("年份", { exact: true }).selectOption("2024");
  await page.getByLabel("月份", { exact: true }).selectOption("1");
  await expect(page.getByRole("group", { name: "出发日期日历" })).toContainText(
    "周一",
  );
  await page
    .getByRole("button", { name: "2024年2月29日", exact: true })
    .click();
  await expect(
    page.getByLabel("出发日期", { exact: false }).first(),
  ).toHaveValue("2024-02-29");
  await page.getByRole("combobox", { name: "出发机场" }).fill("布拉格");
  await page.getByRole("option").filter({ hasText: "PRG" }).first().click();
  await page.getByRole("combobox", { name: "到达机场" }).fill("希思罗");
  await page.getByRole("option").filter({ hasText: "LHR" }).first().click();
  await page.getByLabel("航班号", { exact: false }).fill("BA853");
  await page
    .getByLabel("出发日期", { exact: false })
    .first()
    .fill("2023-02-29");
  await page.getByRole("button", { name: "保存飞行记录", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("请输入有效的日期。");
  await page.getByLabel("出发日期", { exact: false }).first().fill("2024/2/29");
  await page.getByRole("button", { name: "保存飞行记录", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await openHistory(page);
  await expect(page.getByText("2024年2月29日", { exact: true })).toBeVisible();
  await expect(page.locator(".flight-card")).toContainText("伦敦");
  await openHistory(page);
  await page.getByLabel("搜索飞行记录").fill("伦敦");
  await expect(page.locator(".flight-card")).toHaveCount(1);
  await closeHistory(page);
  await page.getByLabel("语言", { exact: true }).selectOption("en");
  await openHistory(page);
  await expect(page.getByLabel("Search flight history")).toHaveValue("伦敦");
  await expect(page.locator(".flight-card")).toContainText("London");
  await closeHistory(page);
  await page.getByLabel("Language", { exact: true }).selectOption("zh-Hans");
  await openHistory(page);
  await page.getByRole("button", { name: "编辑航班 BA853" }).click();
  await page
    .getByLabel("出发日期", { exact: false })
    .first()
    .fill("2025-01-02");
  await page.getByRole("button", { name: "保存修改" }).click();
  await openHistory(page);
  await expect(page.getByText("2025年1月2日", { exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("chinese-journal.png"),
    fullPage: true,
  });
  await openHistory(page);
  await page.getByRole("button", { name: "删除航班 BA853" }).click();
  await page.getByRole("button", { name: "删除记录", exact: true }).click();
  await openHistory(page);
  await expect(page.getByText("暂无航班")).toBeVisible();
});

test("Chinese backups retain canonical version-2 records and report invalid files", async ({
  page,
}) => {
  await mockMap(page);
  await page.goto("/");
  const backup = backupFor([input]);
  await page.getByRole("button", { name: "备份与恢复" }).click();
  await page
    .getByLabel("选择备份", { exact: true })
    .setInputFiles(backupFile(backup));
  await expect(page.getByText("此备份包含 1 次飞行")).toBeVisible();
  await page.getByLabel("使用此备份替换现有飞行记录").check();
  await page.getByRole("button", { name: "替换记录", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "备份与恢复" }).click();
  await page.getByLabel("选择备份", { exact: true }).setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("broken"),
  });
  await expect(page.getByRole("alert")).toHaveText(
    "此文件不是有效的 JSON。数据未发生更改。",
  );
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载备份", exact: true }).click();
  const download = await downloading;
  const chunks: Buffer[] = [];
  for await (const chunk of (await download.createReadStream())!)
    chunks.push(Buffer.from(chunk));
  const exported = JSON.parse(Buffer.concat(chunks).toString());
  expect(exported.version).toBe(2);
  expect(exported.flights).toEqual(backup.flights);
});

test("switches map controls and preserves globe selection; exports a Chinese caption", async ({
  page,
}) => {
  await mockMap(page);
  await page.addInitScript(() => {
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (
      ...args: Parameters<typeof original>
    ) {
      if (args[0].startsWith("Tabibito ·"))
        this.canvas.dataset.exportCaption = args[0];
      return original.apply(this, args);
    };
    const blob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (
      ...args: Parameters<typeof blob>
    ) {
      document.documentElement.dataset.exportCaption =
        this.dataset.exportCaption;
      return blob.apply(this, args);
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "备份与恢复" }).click();
  await page
    .getByLabel("选择备份", { exact: true })
    .setInputFiles(backupFile(backupFor([input])));
  await page.getByLabel("使用此备份替换现有飞行记录").check();
  await page.getByRole("button", { name: "替换记录", exact: true }).click();
  await openHistory(page);
  await page.getByRole("button", { name: "在地图上显示 PRG 至 LHR" }).click();
  await expect(
    page.getByRole("button", { name: "地球", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "地球", exact: true }).click();
  await closeHistory(page);
  await page.getByLabel("语言", { exact: true }).selectOption("en");
  await expect(
    page.getByRole("button", { name: "Globe", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await openHistory(page);
  await expect(
    page.getByRole("button", { name: "Show PRG to LHR on map" }),
  ).toHaveAttribute("aria-pressed", "true");
  await closeHistory(page);
  await expect(
    page.getByRole("button", { name: "Zoom in", exact: true }),
  ).toBeVisible();
  await closeHistory(page);
  await page.getByLabel("Language", { exact: true }).selectOption("zh-Hans");
  await expect(
    page.getByRole("button", { name: "放大", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "地球", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出地图", exact: true }).click();
  expect((await downloading).suggestedFilename()).toMatch(
    /^tabibito-map-.*\.png$/,
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-export-caption",
    "Tabibito · 筛选结果共 1 次飞行",
  );
});

test("storage preferences and map failures do not prevent the Chinese journal", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException("blocked", "SecurityError");
    };
    Storage.prototype.setItem = () => {
      throw new DOMException("blocked", "SecurityError");
    };
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args: Parameters<typeof original>
    ) {
      if (String(args[0]).startsWith("webgl")) return null;
      return original.apply(this, args);
    } as typeof original;
  });
  await page.goto("/");
  await expect(page.locator(".map-error")).toContainText("此设备无法启动地图");
  await closeHistory(page);
  await page.getByLabel("语言", { exact: true }).selectOption("en");
  await expect(page.locator(".map-error")).toContainText(
    "The map could not start",
  );
  await expect(
    page.getByRole("button", { name: "Add flight", exact: true }),
  ).toBeEnabled();
});

test("missing place translations preserve airport code searches and original names", async ({
  page,
}) => {
  await mockMap(page);
  await page.route(/\/airports-zh-Hans-[^/]+\.json$/, (route) => route.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "添加飞行", exact: true }).click();
  await page.getByRole("combobox", { name: "出发机场" }).fill("LHR");
  await expect(
    page.getByRole("option").filter({ hasText: "London Heathrow Airport" }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

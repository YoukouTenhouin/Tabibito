import { afterEach, describe, expect, it, vi } from "vitest";
import {
  calendarNames,
  changeLocale,
  detectLocale,
  formatDate,
  i18n,
  initialLocale,
} from "../src/i18n";
import { en } from "../src/locales/en";
import { zhHans } from "../src/locales/zh-Hans";
import { AppError, errorCode } from "../src/errors";
import { flightInputSchema } from "../src/shared";
import { input } from "./fixtures";

afterEach(() => {
  vi.unstubAllGlobals();
  void i18n.changeLanguage("en");
});

describe("language selection", () => {
  it("honors an explicit preference ahead of browser languages", () => {
    expect(detectLocale("en", ["zh-CN"])).toBe("en");
    expect(detectLocale("zh-Hans", ["en-US"])).toBe("zh-Hans");
    expect(detectLocale("invalid", ["fr-FR", "zh-SG"])).toBe("zh-Hans");
    expect(detectLocale(null, ["en-GB", "zh-CN"])).toBe("en");
  });
  it("matches Simplified variants without treating Traditional Chinese as Simplified", () => {
    for (const locale of ["zh", "zh-CN", "zh-SG", "zh-Hans", "zh-Hans-HK"])
      expect(detectLocale(null, [locale])).toBe("zh-Hans");
    for (const locale of ["zh-TW", "zh-HK", "zh-Hant", "ja-JP", "not_a_locale"])
      expect(detectLocale(null, [locale])).toBe("en");
    expect(detectLocale(null, ["zh-Hant", "zh-Hans"])).toBe("zh-Hans");
  });
  it("detects and switches language when browser storage is blocked", () => {
    vi.stubGlobal("navigator", { languages: ["zh-CN"] });
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
      setItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
    });
    expect(initialLocale()).toBe("zh-Hans");
    changeLocale("zh-Hans");
    expect(i18n.language).toBe("zh-Hans");
  });
});

describe("translated messages and formatting", () => {
  it("has complete catalogs with matching interpolation variables", () => {
    expect(Object.keys(zhHans).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(zhHans[key].trim()).not.toBe("");
      expect(zhHans[key].match(/\{\{[^}]+\}\}/g)?.sort()).toEqual(
        en[key].match(/\{\{[^}]+\}\}/g)?.sort(),
      );
    }
  });
  it("formats counts as whole messages in both languages", () => {
    const english = i18n.getFixedT("en"),
      chinese = i18n.getFixedT("zh-Hans");
    expect(english("map.count", { count: 1 })).toBe("1 flight on the map");
    expect(english("map.count", { count: 0 })).toBe("0 flights on the map");
    expect(english("backup.count", { count: 2 })).toBe(
      "2 flights in this backup",
    );
    for (const count of [0, 1, 2])
      expect(chinese("map.count", { count })).toBe(`地图上有 ${count} 次飞行`);
    expect(
      chinese("history.showRoute", { origin: "PEK", destination: "LHR" }),
    ).toBe("在地图上显示 PEK 至 LHR");
  });
  it("keeps date-only values timezone-independent and calendars Monday-first", () => {
    expect(formatDate("2024-02-29", "en")).toBe("Feb 29, 2024");
    expect(formatDate("2024-02-29", "zh-Hans")).toBe("2024年2月29日");
    expect(calendarNames("en").weekdays[0]).toBe("Mon");
    expect(calendarNames("zh-Hans").months[1]).toBe("二月");
    expect(calendarNames("zh-Hans").weekdays[0]).toBe("周一");
  });
  it("translates validation and storage failures without showing raw technical errors", () => {
    const result = flightInputSchema.safeParse({
      ...input,
      date: "2023-02-29",
    });
    if (result.success) throw new Error("Expected invalid date");
    expect(errorCode(result.error)).toBe("errors.dateInvalid");
    expect(errorCode(new AppError("errors.historyChanged"))).toBe(
      "errors.historyChanged",
    );
    expect(errorCode(new DOMException("full", "QuotaExceededError"))).toBe(
      "errors.storageFull",
    );
    expect(errorCode(new DOMException("blocked", "SecurityError"))).toBe(
      "errors.storagePermission",
    );
    expect(errorCode(new Error("implementation details"))).toBe(
      "errors.generic",
    );
    expect(i18n.getFixedT("zh-Hans")(errorCode(result.error))).toBe(
      "请输入有效的日期。",
    );
  });
});

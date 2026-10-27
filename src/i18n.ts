import i18next from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";
import { en } from "./locales/en";
import { zhHans } from "./locales/zh-Hans";

export type Locale = "en" | "zh-Hans";
export const localeStorageKey = "tabibito.language";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: { translation: typeof en };
    keySeparator: false;
  }
}

export function detectLocale(
  saved: string | null,
  languages: readonly string[],
): Locale {
  if (saved === "en" || saved === "zh-Hans") return saved;
  for (const language of languages) {
    try {
      const locale = new Intl.Locale(language).maximize();
      if (locale.language === "en") return "en";
      if (locale.language === "zh" && locale.script === "Hans")
        return "zh-Hans";
    } catch {
      /* Ignore malformed browser preferences. */
    }
  }
  return "en";
}

export function initialLocale(): Locale {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(localeStorageKey);
  } catch {
    /* Storage is optional. */
  }
  return detectLocale(
    saved,
    typeof navigator === "undefined" ? [] : navigator.languages,
  );
}

export const i18n = i18next.createInstance();
void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, "zh-Hans": { translation: zhHans } },
  lng: initialLocale(),
  supportedLngs: ["en", "zh-Hans"],
  fallbackLng: "en",
  keySeparator: false,
  initAsync: false,
  interpolation: { escapeValue: false },
});

function updateDocument() {
  if (typeof document === "undefined") return;
  document.documentElement.lang = i18n.language;
  document.title = i18n.t("app.title");
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute("content", i18n.t("app.description"));
}
i18n.on("languageChanged", updateDocument);
updateDocument();

export function changeLocale(locale: Locale) {
  try {
    localStorage.setItem(localeStorageKey, locale);
  } catch {
    /* Keep the in-memory choice. */
  }
  void i18n.changeLanguage(locale);
}

export function useI18n() {
  const { t, i18n: instance } = useTranslation();
  const locale: Locale = instance.language === "zh-Hans" ? "zh-Hans" : "en";
  return { t, locale };
}

export function formatDate(
  date: string,
  locale: Locale,
  month: "short" | "long" = "short",
) {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month,
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

export function calendarNames(locale: Locale) {
  const month = new Intl.DateTimeFormat(locale, {
    month: "long",
    timeZone: "UTC",
  });
  const weekday = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    timeZone: "UTC",
  });
  return {
    months: Array.from({ length: 12 }, (_, i) =>
      month.format(new Date(Date.UTC(2024, i, 1))),
    ),
    weekdays: Array.from({ length: 7 }, (_, i) =>
      weekday.format(new Date(Date.UTC(2024, 0, i + 1))),
    ),
  };
}

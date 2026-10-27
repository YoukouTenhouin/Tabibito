import { changeLocale, useI18n } from "./i18n";

export function LanguageSwitcher() {
  const { t, locale } = useI18n();
  return (
    <label className="language-switcher">
      <span>{t("language.label")}</span>
      <select
        aria-label={t("language.label")}
        value={locale}
        onChange={(event) => {
          const value = event.target.value;
          if (value === "en" || value === "zh-Hans") changeLocale(value);
        }}
      >
        <option value="en" lang="en">
          English
        </option>
        <option value="zh-Hans" lang="zh-Hans">
          简体中文
        </option>
      </select>
    </label>
  );
}

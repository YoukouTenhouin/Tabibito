import { useTheme, type ThemePreference } from "./theme";
import { useI18n } from "./i18n";
export function ThemeSwitcher() {
  const { preference, setPreference } = useTheme();
  const { t } = useI18n();
  return <div className="theme-switcher">
    <button className="button subtle" popoverTarget="theme-options" aria-label={t("theme.label")} title={t("theme.label")}><span aria-hidden="true">◐</span></button>
    <div id="theme-options" popover="auto" className="theme-options">
      <fieldset><legend>{t("theme.label")}</legend>{(["system", "light", "dark"] as ThemePreference[]).map(value => <label key={value}><input type="radio" name="theme" value={value} checked={preference === value} onChange={() => setPreference(value)} />{t(`theme.${value}`)}</label>)}</fieldset>
    </div>
  </div>;
}

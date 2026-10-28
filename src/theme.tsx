import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
export type Theme = "light" | "dark";
export type ThemePreference = Theme | "system";
export function resolveTheme(preference: string | null, dark: boolean): Theme {
  return preference === "dark" || (preference !== "light" && dark) ? "dark" : "light";
}
function initialPreference(): ThemePreference {
  try { const value = localStorage.getItem("tabibito.theme"); return value === "light" || value === "dark" ? value : "system"; }
  catch { return "system"; }
}
const ThemeContext = createContext<{ theme: Theme; preference: ThemePreference; setPreference: (value: ThemePreference) => void }>({ theme: "light", preference: "system", setPreference: () => {} });
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setValue] = useState(initialPreference);
  const [dark, setDark] = useState(() => matchMedia("(prefers-color-scheme: dark)").matches);
  const theme = resolveTheme(preference, dark);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const update = () => setDark(media.matches);
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#121a17" : "#f5f6f7");
  }, [theme]);
  function setPreference(value: ThemePreference) {
    setValue(value);
    try { localStorage.setItem("tabibito.theme", value); } catch { /* Session preference remains usable. */ }
  }
  return <ThemeContext.Provider value={{ theme, preference, setPreference }}>{children}</ThemeContext.Provider>;
}
export const useTheme = () => useContext(ThemeContext);

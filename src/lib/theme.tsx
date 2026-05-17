"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemeMode = "light" | "dark";
export type AccentKey = "emerald" | "slate" | "indigo" | "amber" | "mono";
export type DensityKey = "compact" | "standard" | "comfortable";

type ThemeCtx = {
  theme: ThemeMode;
  accent: AccentKey;
  density: DensityKey;
  setTheme: (t: ThemeMode) => void;
  toggleTheme: () => void;
  setAccent: (a: AccentKey) => void;
  setDensity: (d: DensityKey) => void;
};

const Ctx = createContext<ThemeCtx | null>(null);

const LS_THEME = "forenix-theme";
const LS_ACCENT = "forenix-accent";
const LS_DENSITY = "forenix-density";

function apply(theme: ThemeMode, accent: AccentKey, density: DensityKey) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  html.setAttribute("data-theme", theme);
  html.setAttribute("data-accent", accent);
  html.setAttribute("data-density", density);
  html.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("dark");
  const [accent, setAccentState] = useState<AccentKey>("emerald");
  const [density, setDensityState] = useState<DensityKey>("standard");

  useEffect(() => {
    const t = (window.localStorage.getItem(LS_THEME) as ThemeMode | null) ?? "dark";
    const a = (window.localStorage.getItem(LS_ACCENT) as AccentKey | null) ?? "emerald";
    const d = (window.localStorage.getItem(LS_DENSITY) as DensityKey | null) ?? "standard";
    setThemeState(t);
    setAccentState(a);
    setDensityState(d);
    apply(t, a, d);
  }, []);

  const setTheme = useCallback(
    (t: ThemeMode) => {
      setThemeState(t);
      window.localStorage.setItem(LS_THEME, t);
      apply(t, accent, density);
    },
    [accent, density],
  );
  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  const setAccent = useCallback(
    (a: AccentKey) => {
      setAccentState(a);
      window.localStorage.setItem(LS_ACCENT, a);
      apply(theme, a, density);
    },
    [theme, density],
  );

  const setDensity = useCallback(
    (d: DensityKey) => {
      setDensityState(d);
      window.localStorage.setItem(LS_DENSITY, d);
      apply(theme, accent, d);
    },
    [theme, accent],
  );

  const value = useMemo<ThemeCtx>(
    () => ({ theme, accent, density, setTheme, toggleTheme, setAccent, setDensity }),
    [theme, accent, density, setTheme, toggleTheme, setAccent, setDensity],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTheme() outside ThemeProvider");
  return v;
}

/**
 * Inlined into <head> before paint so the page never flashes the wrong theme.
 * Runs before React hydrates.
 */
export const THEME_PRE_SCRIPT = `
(function(){
  try {
    var t = window.localStorage.getItem("forenix-theme") || "dark";
    var a = window.localStorage.getItem("forenix-accent") || "emerald";
    var d = window.localStorage.getItem("forenix-density") || "standard";
    var h = document.documentElement;
    h.setAttribute("data-theme", t);
    h.setAttribute("data-accent", a);
    h.setAttribute("data-density", d);
    h.style.colorScheme = t;
  } catch(e){}
})();
`;

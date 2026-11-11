import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemePreference = "system" | "paper" | "vault";
export type Density = "comfortable" | "compact";
const THEME_KEY = "lt:theme";
const DENSITY_KEY = "lt:density";

interface ThemeContextValue {
  preference: ThemePreference;
  /** What is actually showing. */
  resolved: "paper" | "vault";
  setPreference: (value: ThemePreference) => void;
  density: Density;
  setDensity: (value: Density) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function read<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw && (allowed as readonly string[]).includes(raw)) return raw as T;
  } catch { /* storage blocked */ }
  return fallback;
}

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Mirrors /theme-init.js (which paints the first frame); this keeps it in sync afterwards. Fixes BUG-1. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => read(THEME_KEY, ["system", "paper", "vault"], "system"));
  const [density, setDensityState] = useState<Density>(() => read(DENSITY_KEY, ["comfortable", "compact"], "comfortable"));
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const resolved: "paper" | "vault" = preference === "vault" || (preference === "system" && systemDark) ? "vault" : "paper";

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolved === "vault");
    root.setAttribute("data-theme", resolved);
    if (density === "compact") root.setAttribute("data-density", "compact");
    else root.removeAttribute("data-density");
  }, [resolved, density]);

  const setPreference = useCallback((value: ThemePreference) => {
    setPreferenceState(value);
    try { localStorage.setItem(THEME_KEY, value); } catch { /* storage blocked */ }
  }, []);
  const setDensity = useCallback((value: Density) => {
    setDensityState(value);
    try { localStorage.setItem(DENSITY_KEY, value); } catch { /* storage blocked */ }
  }, []);

  const value = useMemo(() => ({ preference, resolved, setPreference, density, setDensity }), [preference, resolved, setPreference, density, setDensity]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}

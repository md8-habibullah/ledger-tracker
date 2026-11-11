import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutDashboard, ListOrdered, Settings, Tag, Target, type LucideIcon } from "lucide-react";
import { type SidebarSummary, buildSidebarSummary } from "@/lib/sidebarSummary";
import { useLedger } from "@/vault/useLedger";

/* ------------------------------------------------------------------ navigation model */

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end: boolean;
  /** The letter after "g" that jumps here. */
  go: string;
}

export const NAV: readonly NavItem[] = [
  { to: "/app", label: "Overview", icon: LayoutDashboard, end: true, go: "o" },
  { to: "/app/entries", label: "Entries", icon: ListOrdered, end: false, go: "e" },
  { to: "/app/budgets", label: "Budgets", icon: Target, end: false, go: "b" },
  { to: "/app/categories", label: "Categories", icon: Tag, end: false, go: "c" },
  { to: "/app/settings", label: "Settings", icon: Settings, end: false, go: "s" },
];

const GO_ROUTES: Readonly<Record<string, string>> = Object.fromEntries(NAV.map((n) => [n.go, n.to]));

export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

/**
 * "g" then a letter jumps to a page (g o Overview, g e Entries, g b Budgets, g c Categories, g s Settings),
 * the way many keyboard-first tools do. Returns true while the chord is armed so the sidebar can show the hints.
 * Ignored while typing, with a modifier held, or while a dialog is open; any other key cancels it.
 */
export function useGoShortcuts(): boolean {
  const navigate = useNavigate();
  const [armed, setArmed] = useState(false);
  const armedRef = useRef(false);
  // The router hands out a new navigate function after every route change. Reading it through a ref keeps the
  // listener (and the chord's timer) alive across navigations instead of being torn down mid-chord.
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    let timer = 0;
    const setState = (value: boolean) => {
      armedRef.current = value;
      setArmed(value);
      window.clearTimeout(timer);
      if (value) timer = window.setTimeout(() => setState(false), 1500);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || isTypingTarget(e.target)) return;
      if (document.querySelector('[role="dialog"]')) {
        if (armedRef.current) setState(false);
        return;
      }
      const key = e.key.toLowerCase();
      if (!armedRef.current) {
        if (key === "g") setState(true);
        return;
      }
      setState(false);
      const to = GO_ROUTES[key];
      if (to) {
        e.preventDefault();
        navigateRef.current(to);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(timer);
    };
  }, []);

  return armed;
}

/* ------------------------------------------------------------------ layout preferences */

const COLLAPSE_KEY = "lt:sidebar";

/** Whether the sidebar is the narrow icon rail. A per-device preference like the theme and density (nothing sensitive). */
export function useSidebarCollapsed(): [boolean, (value: boolean) => void] {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "rail";
    } catch {
      return false;
    }
  });
  const set = useCallback((value: boolean) => {
    setCollapsed(value);
    try {
      localStorage.setItem(COLLAPSE_KEY, value ? "rail" : "full");
    } catch { /* storage blocked */ }
  }, []);
  return [collapsed, set];
}

const DESKTOP_QUERY = "(min-width: 768px)";

/** True from md up. The sidebar is only mounted there, so phones don't build a hidden one. */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia(DESKTOP_QUERY);
      query.addEventListener("change", notify);
      return () => query.removeEventListener("change", notify);
    },
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  );
}

/* ------------------------------------------------------------------ live summary */

export type { SidebarSummary, WatchedBudget } from "@/lib/sidebarSummary";

/** Everything the sidebar shows beyond the links, worked out from the open vault on this device. */
export function useSidebarSummary(): SidebarSummary | null {
  const ledger = useLedger();
  return useMemo(() => (ledger ? buildSidebarSummary(ledger) : null), [ledger]);
}

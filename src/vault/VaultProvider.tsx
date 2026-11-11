import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { LegacyUser } from "./legacy";
import type { VaultMeta, VaultService, VaultSnapshot } from "./service";

export type AutoLockMinutes = 1 | 5 | 10 | 15 | 30 | 60 | "never";
export const AUTO_LOCK_OPTIONS: readonly AutoLockMinutes[] = [1, 5, 10, 15, 30, 60, "never"];
const AUTO_LOCK_KEY = "lt:autolock";
const LOCK_REASON_KEY = "lt:lock-reason";
export type LockReason = "manual" | "idle";

function readAutoLock(): AutoLockMinutes {
  try {
    const raw = localStorage.getItem(AUTO_LOCK_KEY);
    if (raw === "never") return "never";
    const n = Number(raw);
    if ((AUTO_LOCK_OPTIONS as readonly unknown[]).includes(n)) return n as AutoLockMinutes;
  } catch { /* storage blocked */ }
  return 5;
}

const LAST_VAULT_KEY = "lt:last-vault";

/** The vault opened most recently on this device (its random id, which is visible without the password anyway). */
export function readLastVaultId(): string | null {
  try { return localStorage.getItem(LAST_VAULT_KEY); } catch { return null; }
}

/** Read-once: why the previous session ended (set just before the lock-time page reload). */
export function takeLockReason(): LockReason | null {
  try {
    const value = sessionStorage.getItem(LOCK_REASON_KEY);
    sessionStorage.removeItem(LOCK_REASON_KEY);
    return value === "idle" || value === "manual" ? value : null;
  } catch {
    return null;
  }
}

interface VaultContextValue {
  phase: "booting" | "ready" | "error";
  error: string | null;
  service: VaultService | null;
  snapshot: VaultSnapshot;
  vaults: VaultMeta[];
  legacyUsers: LegacyUser[] | null;
  refresh: () => Promise<void>;
  /** Starts loading the vault engine (SQLite and storage). Pages that need a vault call this via useStartVault(). */
  start: () => void;
  /** Locks, then reloads the page so the decrypted data cannot linger in this tab's memory. */
  lock: (reason?: LockReason) => Promise<void>;
  autoLockMinutes: AutoLockMinutes;
  setAutoLockMinutes: (value: AutoLockMinutes) => void;
  /** Mutable activity clock (read by the shell countdown without re-rendering the tree). */
  activity: { last: number };
}

const INITIAL: VaultSnapshot = { status: "locked", meta: null, ephemeral: false, dataVersion: 0 };
const VaultContext = createContext<VaultContextValue | null>(null);

export function VaultProvider({ children }: { children: ReactNode }) {
  const [service, setService] = useState<VaultService | null>(null);
  // Marketing pages never open a vault, so the engine (and its 660 KB WebAssembly file) loads only once a page asks for it.
  const [wanted, setWanted] = useState(false);
  const start = useCallback(() => setWanted(true), []);
  const [phase, setPhase] = useState<VaultContextValue["phase"]>("booting");
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<VaultSnapshot>(INITIAL);
  const [vaults, setVaults] = useState<VaultMeta[]>([]);
  const [legacyUsers, setLegacyUsers] = useState<LegacyUser[] | null>(null);
  const [autoLockMinutes, setAutoLockState] = useState<AutoLockMinutes>(readAutoLock);
  const activity = useRef({ last: Date.now() }).current;

  const refreshFrom = useCallback(async (svc: VaultService) => {
    const [list, legacy] = await Promise.all([svc.list(), svc.detectLegacy()]);
    setVaults(list);
    setLegacyUsers(legacy);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    if (!wanted) return;
    import("./runtime")
      .then((m) => m.getVaultService())
      .then(async (svc) => {
        if (cancelled) return;
        await refreshFrom(svc);
        setService(svc);
        setSnapshot(svc.getSnapshot());
        unsubscribe = svc.subscribe(() => setSnapshot(svc.getSnapshot()));
        setPhase("ready");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setPhase("error");
      });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [wanted, refreshFrom]);

  const refresh = useCallback(async () => {
    if (service) await refreshFrom(service);
  }, [service, refreshFrom]);

  const lock = useCallback(
    async (reason: LockReason = "manual") => {
      if (!service) return;
      const ephemeral = service.getSnapshot().ephemeral;
      await service.lock();
      try {
        if (!ephemeral) sessionStorage.setItem(LOCK_REASON_KEY, reason);
      } catch { /* storage blocked */ }
      // A full navigation discards the JS heap and the sql.js WASM memory that held the plaintext.
      window.location.assign(ephemeral ? "/" : "/unlock");
    },
    [service],
  );

  const setAutoLockMinutes = useCallback((value: AutoLockMinutes) => {
    setAutoLockState(value);
    try {
      localStorage.setItem(AUTO_LOCK_KEY, String(value));
    } catch { /* storage blocked */ }
  }, []);

  // Idle auto-lock. Uses wall-clock time so a throttled/suspended background tab still locks on return.
  const unlockedReal = snapshot.status === "unlocked" && !snapshot.ephemeral;
  const openVaultId = unlockedReal ? snapshot.meta?.id : undefined;
  useEffect(() => {
    if (!openVaultId) return;
    try { localStorage.setItem(LAST_VAULT_KEY, openVaultId); } catch { /* storage blocked */ }
  }, [openVaultId]);
  useEffect(() => {
    if (!unlockedReal || autoLockMinutes === "never") return;
    activity.last = Date.now();
    const limit = autoLockMinutes * 60_000;
    const touch = () => { activity.last = Date.now(); };
    const check = () => {
      if (Date.now() - activity.last >= limit) void lock("idle");
    };
    const events: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, touch, { passive: true, capture: true }));
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(check, 1000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch, { capture: true }));
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [unlockedReal, autoLockMinutes, lock, activity]);

  const value = useMemo<VaultContextValue>(
    () => ({ phase, error, service, snapshot, vaults, legacyUsers, refresh, start, lock, autoLockMinutes, setAutoLockMinutes, activity }),
    [phase, error, service, snapshot, vaults, legacyUsers, refresh, start, lock, autoLockMinutes, setAutoLockMinutes, activity],
  );
  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

/** Call from any page that needs a vault: makes sure the engine is loading. */
export function useStartVault(): void {
  const { start } = useVault();
  useEffect(() => start(), [start]);
}

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error("useVault must be used within a VaultProvider");
  return ctx;
}

/** Seconds until auto-lock, or null when it is off. Re-renders once per second - use only where displayed. */
export function useAutoLockCountdown(): number | null {
  const { autoLockMinutes, activity, snapshot } = useVault();
  const [now, setNow] = useState(Date.now());
  const active = snapshot.status === "unlocked" && !snapshot.ephemeral && autoLockMinutes !== "never";
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [active]);
  if (!active || typeof autoLockMinutes !== "number") return null;
  return Math.max(0, Math.ceil((activity.last + autoLockMinutes * 60_000 - now) / 1000));
}

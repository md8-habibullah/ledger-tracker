/**
 * Where encrypted vaults live. Everything written here is ciphertext or non-secret
 * metadata (vault id/name/created). Implementations: IndexedDB (browser) and memory (tests).
 */
export interface VaultStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/** The pre-encryption app stored the whole SQLite file, unencrypted, under one key. */
export interface LegacyStore {
  read(): Promise<Uint8Array | null>;
  remove(): Promise<void>;
}

export function memoryStorage(): VaultStorage & { dump(): Record<string, string> } {
  const map = new Map<string, string>();
  return {
    async get(key) { return map.get(key) ?? null; },
    async set(key, value) { map.set(key, value); },
    async remove(key) { map.delete(key); },
    dump: () => Object.fromEntries(map),
  };
}

export function memoryLegacyStore(initial: Uint8Array | null = null): LegacyStore {
  let data = initial;
  return {
    async read() { return data; },
    async remove() { data = null; },
  };
}

/** IndexedDB via localforage, in its own database so it never collides with the legacy key. */
export async function localforageStorage(): Promise<VaultStorage> {
  const { default: localforage } = await import("localforage");
  const store = localforage.createInstance({ name: "ledger-tracker", storeName: "vaults" });
  return {
    async get(key) {
      const value = await store.getItem<string>(key);
      return typeof value === "string" ? value : null;
    },
    async set(key, value) { await store.setItem(key, value); },
    async remove(key) { await store.removeItem(key); },
  };
}

export async function localforageLegacyStore(): Promise<LegacyStore> {
  const { default: localforage } = await import("localforage");
  const KEY = "ledger_tracker.db";
  return {
    async read() {
      const value = await localforage.getItem<Uint8Array>(KEY);
      return value instanceof Uint8Array ? value : null;
    },
    async remove() { await localforage.removeItem(KEY); },
  };
}

/** Per-vault single-writer lock. Returns a release function, or null when another tab holds it. */
export type LockProvider = (vaultId: string) => Promise<(() => void) | null>;

export function webLockProvider(): LockProvider | undefined {
  if (typeof navigator === "undefined" || !("locks" in navigator)) return undefined;
  return (vaultId) =>
    new Promise((resolve) => {
      navigator.locks.request(`ledger-tracker:${vaultId}`, { ifAvailable: true }, (lock) => {
        if (!lock) {
          resolve(null);
          return undefined;
        }
        // Holding this promise open holds the lock; resolving it (via release) frees it.
        return new Promise<void>((release) => resolve(() => release()));
      });
    });
}

import initSqlJs from "sql.js";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { VaultService } from "./service";
import { localforageLegacyStore, localforageStorage, webLockProvider } from "./storage";

let instance: Promise<VaultService> | null = null;

/** The one VaultService for this tab. sql.js is loaded from our own bundle (no CDN). */
export function getVaultService(): Promise<VaultService> {
  instance ??= (async () => {
    const [sql, storage, legacy] = await Promise.all([
      initSqlJs({ locateFile: () => sqlWasmUrl }),
      localforageStorage(),
      localforageLegacyStore(),
    ]);
    return new VaultService({ sql, storage, legacy, lock: webLockProvider() });
  })();
  return instance;
}

import {
  CorruptVaultError,
  DEFAULT_PBKDF2_ITERATIONS,
  InvalidBackupError,
  WrongCredentialsError,
  type VaultEnvelope,
  changePassword as rewrapPassword,
  createVaultEnvelope,
  parseBackup,
  parseEnvelope,
  resetPasswordWithRecoveryKey,
  rotateRecoveryKey as rotateRecovery,
  sealEnvelope,
  serializeEnvelope,
  unlockWithPassword,
  unlockWithRecoveryKey,
} from "@/crypto/envelope";
import type { Bytes } from "@/crypto/bytes";
import { readImportSource } from "@/db/importer";
import { getMeta, setMeta } from "@/db/repo";
import { enableForeignKeys, migrate } from "@/db/schema";
import { type Database, type SqlJsStatic, query, withTransaction } from "@/db/sql";
import { todayLocal } from "@/lib/dates";
import type { ImportSource } from "@/lib/importPlan";
import { DEFAULT_CURRENCY } from "@/lib/money";
import { estimateStrength } from "@/lib/password";
import { type LegacyReport, type LegacyUser, importLegacyUser, isSqliteFile, listLegacyUsers } from "./legacy";
import type { LegacyStore, LockProvider, VaultStorage } from "./storage";

export interface VaultMeta {
  id: string;
  name: string;
  createdAt: string;
}

export interface VaultInspection {
  vaultId: string;
  cipher: string;
  kdf: string;
  hasRecoveryKey: boolean;
  revision: number;
  updatedAt: string;
  storedCharacters: number;
  ciphertextBytes: number;
  /** First 16 bytes of the stored ciphertext (a plaintext SQLite file would start 53 51 4C 69 74 65 20 66 …). */
  firstBytes: number[];
}

export type VaultStatus = "locked" | "unlocked";
export interface VaultSnapshot {
  status: VaultStatus;
  meta: VaultMeta | null;
  /** Demo vaults live in memory only and are never written to disk. */
  ephemeral: boolean;
  /** Bumped after every successful save so subscribers can refresh their reads. */
  dataVersion: number;
}

export class VaultBusyError extends Error {
  constructor() {
    super("This vault is open in another tab. Close that tab (or lock it) and try again.");
    this.name = "VaultBusyError";
  }
}
export class VaultNotFoundError extends Error {
  constructor() {
    super("That vault was not found on this device");
    this.name = "VaultNotFoundError";
  }
}
export class VaultLockedError extends Error {
  constructor() {
    super("The vault is locked");
    this.name = "VaultLockedError";
  }
}
export class VaultExistsError extends Error {
  constructor(public readonly existing: VaultMeta) {
    super(`A vault named “${existing.name}” with the same identity is already on this device`);
    this.name = "VaultExistsError";
  }
}
export class WeakPasswordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WeakPasswordError";
  }
}
export class MigrationVerificationError extends Error {
  constructor() {
    super("The encrypted copy did not match the original, so nothing was changed. Your old data is untouched.");
    this.name = "MigrationVerificationError";
  }
}

export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 256;

export function checkPassword(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) throw new WeakPasswordError(`Use at least ${MIN_PASSWORD_LENGTH} characters. A few random words works well.`);
  if (password.length > MAX_PASSWORD_LENGTH) throw new WeakPasswordError(`Use at most ${MAX_PASSWORD_LENGTH} characters.`);
  if (/^(.)\1+$/.test(password)) throw new WeakPasswordError("That password repeats one character. Pick something harder to guess.");
  // The stored file can be guessed at offline, so refuse what the strength meter itself rates weak (common words, short digit runs).
  if (estimateStrength(password).score <= 1) throw new WeakPasswordError("That password is too easy to guess. Try three or four unrelated words.");
}

function checkName(raw: string): string {
  const name = raw.trim();
  if (name.length < 1 || name.length > 60) throw new WeakPasswordError("Give the vault a name up to 60 characters.");
  return name;
}

export interface VaultServiceDeps {
  sql: SqlJsStatic;
  storage: VaultStorage;
  legacy?: LegacyStore;
  lock?: LockProvider;
  /** Tests only; production uses the default 600,000. */
  iterations?: number;
  now?: () => Date;
  newId?: () => string;
}

interface Session {
  meta: VaultMeta;
  db: Database;
  envelope: VaultEnvelope | null; // null for ephemeral demo sessions
  dek: CryptoKey | null;
  release: (() => void) | null;
}

const INDEX_KEY = "index";
const vaultKey = (id: string) => `vault:${id}`;

export class VaultService {
  private session: Session | null = null;
  private listeners = new Set<() => void>();
  private chain: Promise<unknown> = Promise.resolve();
  private pendingSave: Promise<void> | null = null;
  private snapshot: VaultSnapshot = { status: "locked", meta: null, ephemeral: false, dataVersion: 0 };

  constructor(private readonly deps: VaultServiceDeps) {}

  // ---------------------------------------------------------------- reactive state

  getSnapshot = (): VaultSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private publish(patch: Partial<VaultSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const l of this.listeners) l();
  }

  private now = () => this.deps.now?.() ?? new Date();
  private iterations = () => this.deps.iterations ?? DEFAULT_PBKDF2_ITERATIONS;
  private newId = () => this.deps.newId?.() ?? crypto.randomUUID();

  /** Serialise anything that rewrites the stored envelope so wraps and data never race. */
  private exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn);
    this.chain = run.then(() => undefined, () => undefined);
    return run;
  }

  /** The open database. Throws when locked, so code can never read a vault it has not unlocked. */
  database(): Database {
    if (!this.session) throw new VaultLockedError();
    return this.session.db;
  }

  // ---------------------------------------------------------------- index

  async list(): Promise<VaultMeta[]> {
    const raw = await this.deps.storage.get(INDEX_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as { vaults?: VaultMeta[] };
      return Array.isArray(parsed.vaults) ? parsed.vaults.filter((v) => v && typeof v.id === "string") : [];
    } catch {
      return [];
    }
  }

  private async writeIndex(vaults: VaultMeta[]): Promise<void> {
    await this.deps.storage.set(INDEX_KEY, JSON.stringify({ v: 1, vaults }));
  }

  private async loadEnvelope(id: string): Promise<VaultEnvelope> {
    const raw = await this.deps.storage.get(vaultKey(id));
    if (!raw) throw new VaultNotFoundError();
    try {
      return parseEnvelope(raw);
    } catch (error) {
      if (error instanceof InvalidBackupError) throw new CorruptVaultError();
      throw error;
    }
  }

  private async acquire(id: string): Promise<(() => void) | null> {
    if (!this.deps.lock) return () => undefined;
    const release = await this.deps.lock(id);
    if (!release) throw new VaultBusyError();
    return release;
  }

  // ---------------------------------------------------------------- open / create

  private open(meta: VaultMeta, db: Database, envelope: VaultEnvelope | null, dek: CryptoKey | null, release: (() => void) | null): void {
    this.session = { meta, db, envelope, dek, release };
    this.publish({ status: "unlocked", meta, ephemeral: envelope === null, dataVersion: this.snapshot.dataVersion + 1 });
  }

  private async createFromDb(
    db: Database,
    input: { name: string; password: string },
  ): Promise<{ meta: VaultMeta; recoveryKey: string }> {
    const id = this.newId();
    const meta: VaultMeta = { id, name: input.name, createdAt: this.now().toISOString() };
    let release: (() => void) | null = null;
    try {
      release = await this.acquire(id);
      enableForeignKeys(db);
      const plaintext = db.export();
      enableForeignKeys(db); // export() reopens the connection and resets PRAGMAs
      const { envelope, dek, recoveryKey } = await createVaultEnvelope({
        vaultId: id,
        password: input.password,
        plaintext: plaintext as Bytes,
        iterations: this.iterations(),
      });
      plaintext.fill(0);
      await this.deps.storage.set(vaultKey(id), serializeEnvelope(envelope, meta.name));
      await this.writeIndex([...(await this.list()), meta]);
      this.open(meta, db, envelope, dek, release);
      return { meta, recoveryKey };
    } catch (error) {
      release?.();
      db.close();
      await this.deps.storage.remove(vaultKey(id)).catch(() => undefined);
      throw error;
    }
  }

  /** Create a brand-new encrypted vault and leave it unlocked. The recovery key is returned once and never stored. */
  async create(input: { name: string; password: string; currency?: string }): Promise<{ meta: VaultMeta; recoveryKey: string }> {
    const name = checkName(input.name);
    checkPassword(input.password);
    await this.lock();
    const db = new this.deps.sql.Database();
    migrate(db);
    setMeta(db, "name", name);
    setMeta(db, "currency", input.currency ?? DEFAULT_CURRENCY);
    return this.createFromDb(db, { name, password: input.password });
  }

  async unlock(id: string, password: string): Promise<VaultMeta> {
    await this.lock();
    const meta = (await this.list()).find((v) => v.id === id);
    if (!meta) throw new VaultNotFoundError();
    const release = await this.acquire(id);
    try {
      const envelope = await this.loadEnvelope(id);
      const { dek, plaintext } = await unlockWithPassword(envelope, password);
      return await this.openFromPlaintext(meta, envelope, dek, plaintext, release);
    } catch (error) {
      release?.();
      throw error;
    }
  }

  private async openFromPlaintext(
    meta: VaultMeta,
    envelope: VaultEnvelope,
    dek: CryptoKey,
    plaintext: Bytes,
    release: (() => void) | null,
  ): Promise<VaultMeta> {
    let db: Database;
    try {
      db = new this.deps.sql.Database(plaintext);
    } catch {
      throw new CorruptVaultError();
    } finally {
      plaintext.fill(0); // sql.js has copied it into its own heap
    }
    try {
      const { from, to } = migrate(db);
      this.open(meta, db, envelope, dek, release);
      if (from !== to) await this.save(); // persist schema upgrades immediately
      return meta;
    } catch (error) {
      if (this.session?.db === db) this.session = null;
      db.close();
      throw error;
    }
  }

  /** Forgot the password: prove possession of the recovery key, choose a new password, and unlock. */
  async unlockWithRecovery(id: string, recoveryKey: string, newPassword: string): Promise<VaultMeta> {
    checkPassword(newPassword);
    await this.lock();
    const meta = (await this.list()).find((v) => v.id === id);
    if (!meta) throw new VaultNotFoundError();
    const release = await this.acquire(id);
    try {
      const envelope = await this.loadEnvelope(id);
      const reset = await resetPasswordWithRecoveryKey(envelope, recoveryKey, newPassword, this.iterations());
      const { dek, plaintext } = await unlockWithPassword(reset, newPassword);
      await this.deps.storage.set(vaultKey(id), serializeEnvelope(reset, meta.name));
      return await this.openFromPlaintext(meta, reset, dek, plaintext, release);
    } catch (error) {
      release?.();
      throw error;
    }
  }

  /** In-memory vault with sample data; nothing is stored and no key exists. */
  async openDemo(seed: (db: Database) => void): Promise<void> {
    await this.lock();
    const db = new this.deps.sql.Database();
    migrate(db);
    seed(db);
    this.open({ id: "demo", name: "Demo vault", createdAt: this.now().toISOString() }, db, null, null, null);
  }

  // ---------------------------------------------------------------- persistence

  /** Persist the open database (encrypted). Concurrent callers share one write. Resolves when it is on disk. */
  save(): Promise<void> {
    if (!this.session) return Promise.reject(new VaultLockedError());
    if (this.pendingSave) return this.pendingSave;
    const run = this.exclusive(async () => {
      this.pendingSave = null;
      await this.persist();
    });
    this.pendingSave = run;
    return run;
  }

  private async persist(): Promise<void> {
    const s = this.session;
    if (!s) return; // locked meanwhile
    if (!s.envelope || !s.dek) {
      // Ephemeral demo vault: nothing is written anywhere, but readers still need to refresh.
      this.publish({ dataVersion: this.snapshot.dataVersion + 1 });
      return;
    }
    const plaintext = s.db.export();
    enableForeignKeys(s.db); // export() reopens the connection and resets PRAGMAs
    try {
      const next = await sealEnvelope(s.envelope, s.dek, plaintext as Bytes);
      await this.deps.storage.set(vaultKey(s.meta.id), serializeEnvelope(next, s.meta.name));
      s.envelope = next;
    } finally {
      plaintext.fill(0);
    }
    this.publish({ dataVersion: this.snapshot.dataVersion + 1 });
  }

  /** Flush pending writes, close the database, drop every key and reference. */
  async lock(): Promise<void> {
    const s = this.session;
    if (!s) return;
    await this.chain;
    this.session = null;
    try {
      s.db.close();
    } catch {
      /* already closed */
    }
    s.release?.();
    this.publish({ status: "locked", meta: null, ephemeral: false, dataVersion: this.snapshot.dataVersion + 1 });
  }

  // ---------------------------------------------------------------- credentials (require an unlocked, stored vault)

  private requireStored(): Session & { envelope: VaultEnvelope } {
    const s = this.session;
    if (!s) throw new VaultLockedError();
    if (!s.envelope) throw new VaultLockedError();
    return s as Session & { envelope: VaultEnvelope };
  }

  async changePassword(current: string, next: string): Promise<void> {
    checkPassword(next);
    this.requireStored();
    await this.exclusive(async () => {
      const s = this.requireStored();
      const updated = await rewrapPassword(s.envelope, current, next, this.iterations());
      await this.deps.storage.set(vaultKey(s.meta.id), serializeEnvelope(updated, s.meta.name));
      s.envelope = updated;
    });
  }

  /** Issue a replacement recovery key (the old one stops working). Needs the current password. */
  async rotateRecoveryKey(password: string): Promise<string> {
    this.requireStored();
    return this.exclusive(async () => {
      const s = this.requireStored();
      const { envelope, recoveryKey } = await rotateRecovery(s.envelope, password);
      await this.deps.storage.set(vaultKey(s.meta.id), serializeEnvelope(envelope, s.meta.name));
      s.envelope = envelope;
      return recoveryKey;
    });
  }

  async rename(id: string, rawName: string): Promise<void> {
    const name = checkName(rawName);
    const vaults = await this.list();
    if (!vaults.some((v) => v.id === id)) throw new VaultNotFoundError();
    await this.writeIndex(vaults.map((v) => (v.id === id ? { ...v, name } : v)));
    if (this.session?.meta.id === id) {
      this.session.meta = { ...this.session.meta, name };
      setMeta(this.session.db, "name", name);
      this.publish({ meta: this.session.meta });
      await this.save();
    }
  }

  // ---------------------------------------------------------------- backup / restore / delete

  /** The backup is the stored ciphertext: as safe as the vault itself, openable with the same password or recovery key. */
  async exportBackup(id: string): Promise<{ filename: string; json: string }> {
    const meta = (await this.list()).find((v) => v.id === id);
    if (!meta) throw new VaultNotFoundError();
    if (this.session?.meta.id === id) await this.save();
    const envelope = await this.loadEnvelope(id);
    const slug = meta.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "vault";
    return { filename: `ledger-tracker-${slug}-${todayLocal(this.now())}.ltvault.json`, json: serializeEnvelope(envelope, meta.name) };
  }

  async importBackup(json: string, options: { overwrite?: boolean } = {}): Promise<VaultMeta> {
    const { envelope, name } = parseBackup(json);
    const vaults = await this.list();
    const existing = vaults.find((v) => v.id === envelope.vaultId);
    if (existing && !options.overwrite) throw new VaultExistsError(existing);
    if (existing) {
      if (this.session?.meta.id === existing.id) await this.lock();
      const release = await this.acquire(existing.id);
      try {
        await this.deps.storage.set(vaultKey(existing.id), serializeEnvelope(envelope, name ?? existing.name));
      } finally {
        release?.();
      }
      return existing;
    }
    const meta: VaultMeta = { id: envelope.vaultId, name: (name ?? "Imported vault").slice(0, 60), createdAt: this.now().toISOString() };
    await this.deps.storage.set(vaultKey(meta.id), serializeEnvelope(envelope, meta.name));
    await this.writeIndex([...vaults, meta]);
    return meta;
  }

  /**
   * Open a backup file in memory and return what is inside, so its entries can be added to the open vault.
   * Needs the backup's own password or recovery key. Nothing is stored and the open vault is not touched;
   * the temporary database is closed and its decrypted bytes are wiped before this returns.
   */
  async readBackup(json: string, credential: { password: string } | { recoveryKey: string }): Promise<ImportSource & { name: string | null }> {
    const { envelope, name } = parseBackup(json);
    const { plaintext } = "password" in credential
      ? await unlockWithPassword(envelope, credential.password)
      : await unlockWithRecoveryKey(envelope, credential.recoveryKey);
    let db: Database;
    try {
      db = new this.deps.sql.Database(plaintext);
    } catch {
      throw new CorruptVaultError();
    } finally {
      plaintext.fill(0);
    }
    try {
      migrate(db); // upgrades the temporary copy only; throws FutureSchemaError for a backup from a newer app
      return { ...readImportSource(db), name: name ?? null };
    } finally {
      db.close();
    }
  }

  /** Remove one vault. Requires proof of the password so the lock screen cannot be used to destroy data. */
  async deleteVault(id: string, password: string): Promise<void> {
    const vaults = await this.list();
    if (!vaults.some((v) => v.id === id)) throw new VaultNotFoundError();
    await this.lock();
    const release = await this.acquire(id);
    try {
      await unlockWithPassword(await this.loadEnvelope(id), password); // throws WrongCredentialsError
      await this.writeIndex(vaults.filter((v) => v.id !== id));
      await this.deps.storage.remove(vaultKey(id));
    } finally {
      release?.();
    }
  }

  /** “Erase everything on this device.” For the forgotten-password-and-recovery-key case; the UI demands typed confirmation. */
  async eraseAll(): Promise<void> {
    await this.lock();
    for (const v of await this.list()) await this.deps.storage.remove(vaultKey(v.id));
    await this.deps.storage.remove(INDEX_KEY);
    await this.deps.legacy?.remove();
  }

  // ---------------------------------------------------------------- legacy (plaintext) data

  /** Users found in the old unencrypted store, or null when there is none. */
  async detectLegacy(): Promise<LegacyUser[] | null> {
    const bytes = await this.deps.legacy?.read();
    if (!bytes || !isSqliteFile(bytes)) return null;
    try {
      const users = listLegacyUsers(this.deps.sql, bytes);
      return users.length > 0 ? users : null;
    } catch {
      return null;
    }
  }

  /**
   * Encrypt one legacy account into its own vault, then prove the copy by decrypting it from storage
   * and comparing counts and totals. The original is left untouched; deletion is a separate, explicit step.
   */
  async migrateLegacyUser(input: { userId: number; name: string; password: string }): Promise<{ meta: VaultMeta; recoveryKey: string; report: LegacyReport }> {
    const name = checkName(input.name);
    checkPassword(input.password);
    const bytes = await this.deps.legacy?.read();
    if (!bytes || !isSqliteFile(bytes)) throw new VaultNotFoundError();
    await this.lock();

    const db = new this.deps.sql.Database();
    migrate(db);
    setMeta(db, "name", name);
    setMeta(db, "currency", DEFAULT_CURRENCY);
    const report = withTransaction(db, () => importLegacyUser(this.deps.sql, bytes, input.userId, db, this.now()));
    const created = await this.createFromDb(db, { name, password: input.password });

    // Round trip: read the ciphertext back from storage, decrypt with the password, compare.
    try {
      const envelope = await this.loadEnvelope(created.meta.id);
      const { plaintext } = await unlockWithPassword(envelope, input.password);
      const check = new this.deps.sql.Database(plaintext);
      plaintext.fill(0);
      try {
        const sum = (kind: string) => Number(query<{ s: number | null }>(check, "SELECT SUM(amount_minor) AS s FROM transactions WHERE kind = ?", [kind])[0].s ?? 0);
        const count = (table: "transactions" | "budgets") =>
          Number(query<{ n: number }>(check, table === "transactions" ? "SELECT COUNT(*) AS n FROM transactions" : "SELECT COUNT(*) AS n FROM budgets")[0].n);
        const ok =
          count("transactions") === report.transactions &&
          count("budgets") === report.budgets &&
          sum("income") === report.importedMinor.income &&
          sum("expense") === report.importedMinor.expense;
        if (!ok) throw new MigrationVerificationError();
      } finally {
        check.close();
      }
    } catch (error) {
      await this.lock();
      const vaults = (await this.list()).filter((v) => v.id !== created.meta.id);
      await this.writeIndex(vaults);
      await this.deps.storage.remove(vaultKey(created.meta.id));
      if (error instanceof WrongCredentialsError || error instanceof CorruptVaultError) throw new MigrationVerificationError();
      throw error;
    }
    return { ...created, report };
  }

  /** Delete the old unencrypted copy (this also removes the plaintext passwords stored in it). */
  async deleteLegacy(): Promise<void> {
    await this.deps.legacy?.remove();
  }

  /**
   * What is physically stored for a vault, read WITHOUT decrypting anything. Powers the “what is on this device”
   * panels so people can see ciphertext instead of trusting a claim.
   */
  async inspect(id: string): Promise<VaultInspection> {
    const raw = await this.deps.storage.get(vaultKey(id));
    if (!raw) throw new VaultNotFoundError();
    const envelope = parseEnvelope(raw);
    const password = envelope.wraps.find((w) => w.type === "password");
    return {
      vaultId: envelope.vaultId,
      cipher: "AES-256-GCM",
      kdf: password?.kdf.alg === "PBKDF2-SHA256" ? `PBKDF2-SHA256, ${password.kdf.iterations.toLocaleString("en-US")} iterations` : "unknown",
      hasRecoveryKey: envelope.wraps.some((w) => w.type === "recovery"),
      revision: envelope.rev,
      updatedAt: envelope.updatedAt,
      storedCharacters: raw.length,
      ciphertextBytes: envelope.data.ct.length,
      firstBytes: Array.from(envelope.data.ct.subarray(0, 16)),
    };
  }

  /** Current settings stored inside the open vault. */
  settings(): { name: string; currency: string } {
    const db = this.database();
    return { name: getMeta(db, "name") ?? this.session!.meta.name, currency: getMeta(db, "currency") ?? DEFAULT_CURRENCY };
  }
}

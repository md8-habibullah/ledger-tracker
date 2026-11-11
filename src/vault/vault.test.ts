import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";
import { InvalidBackupError, WrongCredentialsError, InvalidRecoveryKeyError } from "@/crypto/envelope";
import { fromBase64 } from "@/crypto/bytes";
import { addTransaction, listBudgets, listCategories, listTransactions } from "@/db/repo";
import { FutureSchemaError, LATEST_SCHEMA_VERSION } from "@/db/schema";
import { type SqlJsStatic, query } from "@/db/sql";
import { buildDemoData } from "./demo";
import {
  VaultBusyError, VaultExistsError, VaultLockedError, VaultService, WeakPasswordError,
  type VaultServiceDeps,
} from "./service";
import { type LockProvider, memoryLegacyStore, memoryStorage } from "./storage";

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await initSqlJs();
});

const PW = "correct horse battery staple";

function makeService(overrides: Partial<VaultServiceDeps> = {}) {
  const storage = memoryStorage();
  const held = new Set<string>();
  const lock: LockProvider = async (id) => {
    if (held.has(id)) return null;
    held.add(id);
    return () => held.delete(id);
  };
  let n = 0;
  const service = new VaultService({ sql: SQL, storage, lock, iterations: 1000, newId: () => `vault-${++n}`, ...overrides });
  return { service, storage, held };
}

const food = (s: VaultService) => listCategories(s.database()).find((c) => c.name === "Food & Dining")!;

describe("create / lock / unlock", () => {
  it("round-trips data through lock and unlock", async () => {
    const { service } = makeService();
    const { meta, recoveryKey } = await service.create({ name: "Home", password: PW });
    expect(recoveryKey).toMatch(/^([0-9A-Z]{4}-){8}[0-9A-Z]{4}$/);
    addTransaction(service.database(), { kind: "expense", amountMinor: 12345, categoryId: food(service).id, note: "groceries", occurredOn: "2026-11-01" });
    await service.save();
    await service.lock();
    expect(service.getSnapshot().status).toBe("locked");
    expect(() => service.database()).toThrow(VaultLockedError);

    await service.unlock(meta.id, PW);
    expect(listTransactions(service.database())).toHaveLength(1);
    expect(listTransactions(service.database())[0].note).toBe("groceries");
  });

  it("rejects a wrong password and stays locked", async () => {
    const { service } = makeService();
    const { meta } = await service.create({ name: "Home", password: PW });
    await service.lock();
    await expect(service.unlock(meta.id, "not the password")).rejects.toBeInstanceOf(WrongCredentialsError);
    expect(service.getSnapshot().status).toBe("locked");
    expect(() => service.database()).toThrow(VaultLockedError);
  });

  it("enforces password rules", async () => {
    const { service } = makeService();
    await expect(service.create({ name: "x", password: "short" })).rejects.toBeInstanceOf(WeakPasswordError);
    await expect(service.create({ name: "x", password: "aaaaaaaaaaaa" })).rejects.toBeInstanceOf(WeakPasswordError);
    await expect(service.create({ name: "x", password: "password123" })).rejects.toBeInstanceOf(WeakPasswordError);
    await expect(service.create({ name: "x", password: "1234567890" })).rejects.toBeInstanceOf(WeakPasswordError);
    await expect(service.create({ name: "  ", password: PW })).rejects.toBeInstanceOf(WeakPasswordError);
  });

  it("never writes plaintext, the password, or category names to storage", async () => {
    const { service, storage } = makeService();
    await service.create({ name: "Home", password: PW });
    addTransaction(service.database(), { kind: "expense", amountMinor: 999, categoryId: food(service).id, note: "TOPSECRETNOTE", occurredOn: "2026-11-01" });
    await service.save();
    const stored = JSON.stringify(storage.dump());
    for (const needle of ["TOPSECRETNOTE", "Food & Dining", "SQLite format", "horse", "battery"]) {
      expect(stored).not.toContain(needle);
    }
    // Also not hidden inside the base64 ciphertext.
    const envelope = JSON.parse(storage.dump()["vault:vault-1"]);
    const raw = Buffer.from(fromBase64(envelope.data.ct)).toString("latin1");
    expect(raw).not.toContain("TOPSECRETNOTE");
    expect(raw).not.toContain("SQLite format");
  });

  it("keeps foreign keys enforced after every save (sql.js export() resets PRAGMAs)", async () => {
    const { service } = makeService();
    await service.create({ name: "Home", password: PW });
    await service.save();
    await service.save();
    expect(() =>
      service.database().run("INSERT INTO transactions (kind, amount_minor, category_id, occurred_on, created_at) VALUES ('expense', 5, 9999, '2026-01-01', 'x')"),
    ).toThrow(/FOREIGN KEY/i);
    await service.lock();
    await service.unlock("vault-1", PW);
    expect(query<{ foreign_keys: number }>(service.database(), "PRAGMA foreign_keys")[0].foreign_keys).toBe(1);
  });

  it("lock() flushes a write that is still in flight", async () => {
    const { service } = makeService();
    const { meta } = await service.create({ name: "Home", password: PW });
    addTransaction(service.database(), { kind: "expense", amountMinor: 700, categoryId: food(service).id, occurredOn: "2026-11-02" });
    void service.save(); // deliberately not awaited
    await service.lock();
    await service.unlock(meta.id, PW);
    expect(listTransactions(service.database())).toHaveLength(1);
  });

  it("coalesces concurrent saves and uses a fresh IV for each stored version", async () => {
    const { service, storage } = makeService();
    await service.create({ name: "Home", password: PW });
    const before = JSON.parse(storage.dump()["vault:vault-1"]);
    await Promise.all([service.save(), service.save(), service.save(), service.save()]);
    const after = JSON.parse(storage.dump()["vault:vault-1"]);
    expect(after.rev).toBeGreaterThan(before.rev);
    expect(after.rev - before.rev).toBeLessThanOrEqual(2);
    expect(after.data.iv).not.toBe(before.data.iv);
  });

  it("refuses a vault written by a newer schema", async () => {
    const { service } = makeService();
    const { meta } = await service.create({ name: "Home", password: PW });
    service.database().run(`PRAGMA user_version = ${LATEST_SCHEMA_VERSION + 1}`);
    await service.save();
    await service.lock();
    await expect(service.unlock(meta.id, PW)).rejects.toBeInstanceOf(FutureSchemaError);
    expect(service.getSnapshot().status).toBe("locked");
  });
});

describe("multiple tabs", () => {
  it("a second opener is refused until the first locks", async () => {
    const shared = new Set<string>();
    const lock: LockProvider = async (id) => (shared.has(id) ? null : (shared.add(id), () => shared.delete(id)));
    const storage = memoryStorage();
    const tabA = new VaultService({ sql: SQL, storage, lock, iterations: 1000, newId: () => "v1" });
    const tabB = new VaultService({ sql: SQL, storage, lock, iterations: 1000 });
    await tabA.create({ name: "Home", password: PW });
    await expect(tabB.unlock("v1", PW)).rejects.toBeInstanceOf(VaultBusyError);
    await tabA.lock();
    await expect(tabB.unlock("v1", PW)).resolves.toBeDefined();
    await expect(tabA.unlock("v1", PW)).rejects.toBeInstanceOf(VaultBusyError);
  });

  it("releases the lock when unlock fails", async () => {
    const { service, held } = makeService();
    const { meta } = await service.create({ name: "Home", password: PW });
    await service.lock();
    await expect(service.unlock(meta.id, "wrong wrong wrong")).rejects.toBeInstanceOf(WrongCredentialsError);
    expect(held.size).toBe(0);
  });
});

describe("recovery and credentials", () => {
  it("resets a forgotten password with the recovery key", async () => {
    const { service } = makeService();
    const { meta, recoveryKey } = await service.create({ name: "Home", password: PW });
    addTransaction(service.database(), { kind: "expense", amountMinor: 500, categoryId: food(service).id, occurredOn: "2026-11-02" });
    await service.save();
    await service.lock();

    await expect(service.unlockWithRecovery(meta.id, "ABCD-EFGH", "a brand new password")).rejects.toBeInstanceOf(InvalidRecoveryKeyError);
    await service.unlockWithRecovery(meta.id, recoveryKey, "a brand new password");
    expect(listTransactions(service.database())).toHaveLength(1);
    await service.lock();
    await expect(service.unlock(meta.id, PW)).rejects.toBeInstanceOf(WrongCredentialsError);
    await expect(service.unlock(meta.id, "a brand new password")).resolves.toBeDefined();
  });

  it("changes the password only with the current one, and saves keep the new wrap", async () => {
    const { service } = makeService();
    const { meta } = await service.create({ name: "Home", password: PW });
    await expect(service.changePassword("wrong wrong wrong", "another long password")).rejects.toBeInstanceOf(WrongCredentialsError);
    await service.changePassword(PW, "another long password");
    addTransaction(service.database(), { kind: "expense", amountMinor: 500, categoryId: food(service).id, occurredOn: "2026-11-02" });
    await service.save(); // a later save must not resurrect the old password wrap
    await service.lock();
    await expect(service.unlock(meta.id, PW)).rejects.toBeInstanceOf(WrongCredentialsError);
    await service.unlock(meta.id, "another long password");
    expect(listTransactions(service.database())).toHaveLength(1);
  });

  it("rotates the recovery key", async () => {
    const { service } = makeService();
    const { meta, recoveryKey: oldKey } = await service.create({ name: "Home", password: PW });
    const newKey = await service.rotateRecoveryKey(PW);
    expect(newKey).not.toBe(oldKey);
    await service.lock();
    await expect(service.unlockWithRecovery(meta.id, oldKey, "yet another password")).rejects.toBeInstanceOf(WrongCredentialsError);
    await expect(service.unlockWithRecovery(meta.id, newKey, "yet another password")).resolves.toBeDefined();
  });
});

describe("backup, restore, delete", () => {
  it("exports ciphertext, survives erasing the device, and restores", async () => {
    const { service, storage } = makeService();
    const { meta } = await service.create({ name: "My Home Vault", password: PW });
    addTransaction(service.database(), { kind: "expense", amountMinor: 4200, categoryId: food(service).id, note: "dinner", occurredOn: "2026-11-02" });
    await service.save();
    const { filename, json } = await service.exportBackup(meta.id);
    expect(filename).toMatch(/^ledger-tracker-my-home-vault-\d{4}-\d{2}-\d{2}\.ltvault\.json$/);
    expect(json).not.toContain("dinner");

    await service.eraseAll();
    expect(await service.list()).toEqual([]);
    expect(storage.dump()).toEqual({});

    const restored = await service.importBackup(json);
    expect(restored).toMatchObject({ id: meta.id, name: "My Home Vault" });
    await service.unlock(restored.id, PW);
    expect(listTransactions(service.database())[0].note).toBe("dinner");
  });

  it("refuses to import over an existing vault unless told to, and rejects junk", async () => {
    const { service } = makeService();
    const { meta } = await service.create({ name: "Home", password: PW });
    const { json } = await service.exportBackup(meta.id);
    await expect(service.importBackup(json)).rejects.toBeInstanceOf(VaultExistsError);
    await expect(service.importBackup(json, { overwrite: true })).resolves.toMatchObject({ id: meta.id });
    await expect(service.importBackup("not json")).rejects.toBeInstanceOf(InvalidBackupError);
  });

  it("deleting a vault needs its password", async () => {
    const { service } = makeService();
    const { meta } = await service.create({ name: "Home", password: PW });
    await expect(service.deleteVault(meta.id, "nope nope nope nope")).rejects.toBeInstanceOf(WrongCredentialsError);
    expect(await service.list()).toHaveLength(1);
    await service.deleteVault(meta.id, PW);
    expect(await service.list()).toHaveLength(0);
  });

  it("supports several vaults side by side", async () => {
    const { service } = makeService();
    const a = await service.create({ name: "Personal", password: PW });
    const b = await service.create({ name: "Business", password: "a different long password" });
    expect((await service.list()).map((v) => v.name)).toEqual(["Personal", "Business"]);
    await service.lock();
    await expect(service.unlock(a.meta.id, "a different long password")).rejects.toBeInstanceOf(WrongCredentialsError);
    await expect(service.unlock(b.meta.id, "a different long password")).resolves.toBeDefined();
  });
});

describe("demo vault", () => {
  it("is in-memory only: nothing is written, saving is a no-op", async () => {
    const { service, storage } = makeService();
    await service.openDemo((db) => buildDemoData(db, "2026-11-11"));
    expect(service.getSnapshot()).toMatchObject({ status: "unlocked", ephemeral: true });
    expect(listTransactions(service.database()).length).toBeGreaterThan(100);
    await service.save();
    expect(storage.dump()).toEqual({});
    await service.lock();
    expect(() => service.database()).toThrow(VaultLockedError);
  });

  it("generates realistic, internally consistent data", async () => {
    const { service } = makeService();
    await service.openDemo((db) => buildDemoData(db, "2026-11-11"));
    const db = service.database();
    const txns = listTransactions(db);
    expect(txns.every((t) => t.occurredOn <= "2026-11-11")).toBe(true);
    expect(txns.some((t) => t.kind === "income")).toBe(true);
    expect(listBudgets(db).length).toBeGreaterThan(2);
    // Deterministic: same input date gives identical data.
    const again = makeService();
    await again.service.openDemo((d) => buildDemoData(d, "2026-11-11"));
    expect(listTransactions(again.service.database()).map((t) => [t.amountMinor, t.occurredOn])).toEqual(txns.map((t) => [t.amountMinor, t.occurredOn]));
  });
});

describe("legacy migration", () => {
  function buildLegacy(): Uint8Array {
    const db = new SQL.Database();
    db.run(`
      CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL);
      CREATE TABLE categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, icon TEXT NOT NULL, color TEXT NOT NULL, type TEXT NOT NULL);
      CREATE TABLE transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, amount REAL NOT NULL, type TEXT NOT NULL, category TEXT NOT NULL, description TEXT, date TEXT NOT NULL, createdAt TEXT NOT NULL);
      CREATE TABLE budgets (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, category TEXT NOT NULL, amount REAL NOT NULL, period TEXT NOT NULL, createdAt TEXT NOT NULL);
      INSERT INTO users (username, password) VALUES ('alice', 'plaintextsecretpw'), ('bob', 'bobspw');
      INSERT INTO categories (name, icon, color, type) VALUES ('Pets', 'Dog', '#123456', 'expense'), ('Salary', 'Banknote', '#10b981', 'income');
    `);
    const tx = db.prepare("INSERT INTO transactions (user_id, amount, type, category, description, date, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)");
    tx.run([1, 5000, "income", "Salary", "November pay", "2026-11-01", "2026-11-01T08:00:00.000Z"]);
    tx.run([1, 12.35, "expense", "Food & Dining", "tea", "2026-11-02T10:00:00.000Z", "2026-11-02T10:00:00.000Z"]);
    tx.run([1, 80.1, "expense", "Pets", "kibble", "2026-11-03", "2026-11-03T08:00:00.000Z"]); // custom category
    tx.run([1, 7, "expense", "Totally Unknown", null, "2026-11-04", "2026-11-04T08:00:00.000Z"]); // unknown category → created
    tx.run([1, -5, "expense", "Shopping", "negative", "2026-11-05", "2026-11-05T08:00:00.000Z"]); // skipped
    tx.run([1, 5, "transfer", "Shopping", "weird", "2026-11-05", "2026-11-05T08:00:00.000Z"]); // skipped
    tx.run([2, 999, "expense", "Shopping", "bob only", "2026-11-05", "2026-11-05T08:00:00.000Z"]); // other user
    tx.free();
    db.run("INSERT INTO budgets (user_id, category, amount, period, createdAt) VALUES (1, 'Food & Dining', 3000, 'monthly', 'x'), (1, 'Food & Dining', 3500, 'monthly', 'x'), (2, 'Shopping', 1, 'weekly', 'x')");
    const bytes = db.export();
    db.close();
    return bytes;
  }

  it("detects users, encrypts one account into its own vault, verifies, and keeps the original", async () => {
    const legacy = memoryLegacyStore(buildLegacy());
    const { service } = makeService({ legacy });
    const users = await service.detectLegacy();
    expect(users).toEqual([
      { id: 1, username: "alice", transactionCount: 6, budgetCount: 2 },
      { id: 2, username: "bob", transactionCount: 1, budgetCount: 1 },
    ]);

    const { meta, report, recoveryKey } = await service.migrateLegacyUser({ userId: 1, name: "Alice", password: PW });
    expect(recoveryKey).toBeTruthy();
    expect(report.transactions).toBe(4);
    expect(report.budgets).toBe(1);
    expect(report.skipped.map((s) => s.reason).sort()).toEqual(["invalid amount", "older duplicate budget replaced", "unknown type"]);
    expect(report.importedMinor).toEqual({ income: 500000, expense: 1235 + 8010 + 700 });

    const db = service.database();
    const txns = listTransactions(db);
    expect(txns).toHaveLength(4);
    expect(txns.find((t) => t.note === "tea")).toMatchObject({ amountMinor: 1235, occurredOn: expectLocalDate("2026-11-02T10:00:00.000Z") });
    expect(txns.find((t) => t.note === "kibble")!.amountMinor).toBe(8010); // 80.1 → exactly 8010, no float drift
    expect(listCategories(db).some((c) => c.name === "Pets" && c.color === "#123456")).toBe(true);
    expect(listCategories(db).some((c) => c.name === "Totally Unknown")).toBe(true);
    expect(listBudgets(db)).toHaveLength(1);
    expect(listBudgets(db)[0].amountMinor).toBe(350000); // later duplicate wins

    // Plaintext password never reaches the new vault.
    const exported = db.export();
    expect(Buffer.from(exported).toString("latin1")).not.toContain("plaintextsecretpw");

    // Original is untouched until explicitly deleted.
    expect(await service.detectLegacy()).not.toBeNull();
    await service.lock();
    await service.unlock(meta.id, PW);
    expect(listTransactions(service.database())).toHaveLength(4);
    await service.deleteLegacy();
    expect(await service.detectLegacy()).toBeNull();
  });

  it("returns null when there is nothing to migrate, and ignores non-SQLite data", async () => {
    expect(await makeService({ legacy: memoryLegacyStore(null) }).service.detectLegacy()).toBeNull();
    expect(await makeService({ legacy: memoryLegacyStore(new Uint8Array(100)) }).service.detectLegacy()).toBeNull();
  });
});

function expectLocalDate(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

import type { BindParams, Database, SqlJsStatic } from "sql.js";

export type { Database, SqlJsStatic };
export type Param = number | string | null | Uint8Array;

/** Run a SELECT and return rows as plain objects. Always bind values; never interpolate. */
export function query<T = Record<string, unknown>>(db: Database, sql: string, params: Param[] = []): T[] {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params as BindParams);
    const rows: T[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject() as T);
    return rows;
  } finally {
    stmt.free();
  }
}

export function queryOne<T = Record<string, unknown>>(db: Database, sql: string, params: Param[] = []): T | undefined {
  return query<T>(db, sql, params)[0];
}

export function run(db: Database, sql: string, params: Param[] = []): number {
  db.run(sql, params as BindParams);
  return db.getRowsModified();
}

export function lastInsertId(db: Database): number {
  return Number(queryOne<{ id: number }>(db, "SELECT last_insert_rowid() AS id")!.id);
}

/**
 * Atomic unit of work. sql.js is synchronous, so this cannot interleave with another
 * statement from this tab; if `fn` throws, every change inside it is rolled back.
 */
export function withTransaction<T>(db: Database, fn: () => T): T {
  const depth = txDepth.get(db) ?? 0;
  // Nested calls become savepoints, so a repo function that opens its own transaction
  // still composes inside a caller's larger unit of work.
  const savepoint = `sp_${depth}`;
  db.run(depth === 0 ? "BEGIN" : `SAVEPOINT ${savepoint}`);
  txDepth.set(db, depth + 1);
  try {
    const result = fn();
    db.run(depth === 0 ? "COMMIT" : `RELEASE ${savepoint}`);
    return result;
  } catch (error) {
    try {
      db.run(depth === 0 ? "ROLLBACK" : `ROLLBACK TO ${savepoint}; RELEASE ${savepoint}`);
    } catch {
      /* the transaction may already be gone after a failed COMMIT */
    }
    throw error;
  } finally {
    txDepth.set(db, depth);
  }
}

const txDepth = new WeakMap<Database, number>();

/** Escape LIKE wildcards in user-supplied search text (use with ESCAPE '\\'). */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

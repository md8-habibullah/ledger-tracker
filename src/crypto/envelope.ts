import { z } from "zod";
import { type Bytes, fromBase64, randomBytes, toBase64, toBytes, utf8 } from "./bytes";
import { generateRecoveryKey, parseRecoveryKey } from "./recovery";

/**
 * Envelope encryption for a vault database.
 *
 *   random 256-bit vault key (DEK) ──AES-256-GCM──► encrypts the SQLite file
 *   DEK is *wrapped* (AES-256-GCM) separately by:
 *     • a KEK derived from the master password  (PBKDF2-HMAC-SHA256, random salt)
 *     • a KEK derived from the recovery key     (HKDF-SHA256 over 160 random bits)
 *
 * Changing the password re-wraps the DEK; the database is not re-encrypted.
 * Every encryption uses a fresh random 96-bit IV. Headers (vault id, wrap type, KDF
 * parameters) are bound as AAD, so tampering with them or swapping ciphertexts
 * between vaults makes decryption fail. Nothing derived from the password is stored
 * except the wrapped key: a wrong password is detected only by the GCM tag failing.
 */

export const ENVELOPE_VERSION = 1 as const;
/** OWASP Password Storage Cheat Sheet (2023): PBKDF2-HMAC-SHA256 ≥ 600,000 iterations. */
export const DEFAULT_PBKDF2_ITERATIONS = 600_000;
/** Upper bound accepted from an imported (untrusted) file, so a crafted value cannot freeze the tab. */
export const MAX_PBKDF2_ITERATIONS = 10_000_000;

const SALT_BYTES = 16;
const IV_BYTES = 12;

export type Kdf = { alg: "PBKDF2-SHA256"; iterations: number } | { alg: "HKDF-SHA256" };

export interface Wrap {
  type: "password" | "recovery";
  kdf: Kdf;
  salt: Bytes;
  iv: Bytes;
  ct: Bytes;
}

export interface VaultEnvelope {
  v: typeof ENVELOPE_VERSION;
  vaultId: string;
  wraps: Wrap[];
  data: { iv: Bytes; ct: Bytes };
  /** Incremented on every write; used to detect another tab/device having written. */
  rev: number;
  updatedAt: string;
}

export class WrongCredentialsError extends Error {
  constructor() {
    super("Wrong password or recovery key");
    this.name = "WrongCredentialsError";
  }
}
export class InvalidRecoveryKeyError extends Error {
  constructor() {
    super("That recovery key looks mistyped");
    this.name = "InvalidRecoveryKeyError";
  }
}
export class CorruptVaultError extends Error {
  constructor() {
    super("Vault data failed its integrity check");
    this.name = "CorruptVaultError";
  }
}
export class InvalidBackupError extends Error {
  constructor(message = "This is not a valid Ledger Tracker backup") {
    super(message);
    this.name = "InvalidBackupError";
  }
}

// ---------------------------------------------------------------- internals

function kdfLabel(kdf: Kdf): string {
  return kdf.alg === "PBKDF2-SHA256" ? `${kdf.alg}:${kdf.iterations}` : kdf.alg;
}
function wrapAad(vaultId: string, type: Wrap["type"], kdf: Kdf): Bytes {
  return utf8(`ledger-tracker/v1/wrap|${vaultId}|${type}|${kdfLabel(kdf)}`);
}
function dataAad(vaultId: string): Bytes {
  return utf8(`ledger-tracker/v1/data|${vaultId}`);
}

async function passwordKek(password: string, salt: Bytes, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    utf8(password.normalize("NFKC")),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["wrapKey", "unwrapKey"],
  );
}

async function recoveryKek(secret: Bytes, salt: Bytes): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", secret, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info: utf8("ledger-tracker/recovery/v1") },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["wrapKey", "unwrapKey"],
  );
}

async function wrapDek(dek: CryptoKey, kek: CryptoKey, aad: Bytes): Promise<{ iv: Bytes; ct: Bytes }> {
  const iv = randomBytes(IV_BYTES);
  const ct = toBytes(await crypto.subtle.wrapKey("raw", dek, kek, { name: "AES-GCM", iv, additionalData: aad }));
  return { iv, ct };
}

async function unwrapDek(wrap: Wrap, kek: CryptoKey, vaultId: string, extractable: boolean): Promise<CryptoKey> {
  try {
    return await crypto.subtle.unwrapKey(
      "raw",
      wrap.ct,
      kek,
      { name: "AES-GCM", iv: wrap.iv, additionalData: wrapAad(vaultId, wrap.type, wrap.kdf) },
      { name: "AES-GCM", length: 256 },
      extractable,
      ["encrypt", "decrypt"],
    );
  } catch {
    // Any failure here (bad tag, bad AAD, bad salt) is indistinguishable by design.
    throw new WrongCredentialsError();
  }
}

async function buildPasswordWrap(
  dek: CryptoKey,
  vaultId: string,
  password: string,
  iterations: number,
): Promise<{ wrap: Wrap; kek: CryptoKey }> {
  const kdf: Kdf = { alg: "PBKDF2-SHA256", iterations };
  const salt = randomBytes(SALT_BYTES);
  const kek = await passwordKek(password, salt, iterations);
  const sealed = await wrapDek(dek, kek, wrapAad(vaultId, "password", kdf));
  return { wrap: { type: "password", kdf, salt, ...sealed }, kek };
}

async function buildRecoveryWrap(dek: CryptoKey, vaultId: string): Promise<{ wrap: Wrap; recoveryKey: string }> {
  const { secret, text } = generateRecoveryKey();
  const kdf: Kdf = { alg: "HKDF-SHA256" };
  const salt = randomBytes(SALT_BYTES);
  const kek = await recoveryKek(secret, salt);
  const sealed = await wrapDek(dek, kek, wrapAad(vaultId, "recovery", kdf));
  return { wrap: { type: "recovery", kdf, salt, ...sealed }, recoveryKey: text };
}

async function encryptData(dek: CryptoKey, vaultId: string, plaintext: Bytes): Promise<{ iv: Bytes; ct: Bytes }> {
  const iv = randomBytes(IV_BYTES);
  const ct = toBytes(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: dataAad(vaultId) }, dek, plaintext));
  return { iv, ct };
}

async function decryptData(envelope: VaultEnvelope, dek: CryptoKey): Promise<Bytes> {
  try {
    return toBytes(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: envelope.data.iv, additionalData: dataAad(envelope.vaultId) },
        dek,
        envelope.data.ct,
      ),
    );
  } catch {
    throw new CorruptVaultError();
  }
}

function findWrap(envelope: VaultEnvelope, type: Wrap["type"]): Wrap {
  const wrap = envelope.wraps.find((w) => w.type === type);
  if (!wrap) throw new CorruptVaultError();
  return wrap;
}

async function dekFromPassword(envelope: VaultEnvelope, password: string, extractable: boolean): Promise<CryptoKey> {
  const wrap = findWrap(envelope, "password");
  if (wrap.kdf.alg !== "PBKDF2-SHA256") throw new CorruptVaultError();
  const kek = await passwordKek(password, wrap.salt, wrap.kdf.iterations);
  return unwrapDek(wrap, kek, envelope.vaultId, extractable);
}

async function dekFromRecovery(envelope: VaultEnvelope, recoveryKeyText: string, extractable: boolean): Promise<CryptoKey> {
  const secret = parseRecoveryKey(recoveryKeyText);
  if (!secret) throw new InvalidRecoveryKeyError();
  const wrap = findWrap(envelope, "recovery");
  const kek = await recoveryKek(secret, wrap.salt);
  return unwrapDek(wrap, kek, envelope.vaultId, extractable);
}

function bump(envelope: VaultEnvelope, patch: Partial<VaultEnvelope>): VaultEnvelope {
  return { ...envelope, ...patch, rev: envelope.rev + 1, updatedAt: new Date().toISOString() };
}

// ---------------------------------------------------------------- public API

export interface CreateVaultInput {
  vaultId: string;
  password: string;
  plaintext: Bytes;
  /** Tests only. Production callers use the default. */
  iterations?: number;
}

/**
 * Create a new encrypted vault. Returns the envelope to persist, a non-extractable
 * DEK for the open session, and the recovery key text (shown to the user once).
 */
export async function createVaultEnvelope(
  input: CreateVaultInput,
): Promise<{ envelope: VaultEnvelope; dek: CryptoKey; recoveryKey: string }> {
  const iterations = input.iterations ?? DEFAULT_PBKDF2_ITERATIONS;
  const rawDek = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);

  const { wrap: passwordWrap, kek } = await buildPasswordWrap(rawDek, input.vaultId, input.password, iterations);
  const { wrap: recoveryWrap, recoveryKey } = await buildRecoveryWrap(rawDek, input.vaultId);
  const data = await encryptData(rawDek, input.vaultId, input.plaintext);

  const envelope: VaultEnvelope = {
    v: ENVELOPE_VERSION,
    vaultId: input.vaultId,
    wraps: [passwordWrap, recoveryWrap],
    data,
    rev: 1,
    updatedAt: new Date().toISOString(),
  };

  // The session key is the *unwrapped, non-extractable* one: this also proves the wrap round-trips.
  const dek = await unwrapDek(passwordWrap, kek, input.vaultId, false);
  return { envelope, dek, recoveryKey };
}

export async function unlockWithPassword(
  envelope: VaultEnvelope,
  password: string,
): Promise<{ dek: CryptoKey; plaintext: Bytes }> {
  const dek = await dekFromPassword(envelope, password, false);
  return { dek, plaintext: await decryptData(envelope, dek) };
}

export async function unlockWithRecoveryKey(
  envelope: VaultEnvelope,
  recoveryKeyText: string,
): Promise<{ dek: CryptoKey; plaintext: Bytes }> {
  const dek = await dekFromRecovery(envelope, recoveryKeyText, false);
  return { dek, plaintext: await decryptData(envelope, dek) };
}

/** Re-encrypt new plaintext under the session key. Fresh IV, rev + 1. */
export async function sealEnvelope(envelope: VaultEnvelope, dek: CryptoKey, plaintext: Bytes): Promise<VaultEnvelope> {
  return bump(envelope, { data: await encryptData(dek, envelope.vaultId, plaintext) });
}

/** Requires the current password (re-authentication). The recovery key stays valid. */
export async function changePassword(
  envelope: VaultEnvelope,
  currentPassword: string,
  newPassword: string,
  iterations = DEFAULT_PBKDF2_ITERATIONS,
): Promise<VaultEnvelope> {
  const dek = await dekFromPassword(envelope, currentPassword, true);
  const { wrap } = await buildPasswordWrap(dek, envelope.vaultId, newPassword, iterations);
  return bump(envelope, { wraps: envelope.wraps.map((w) => (w.type === "password" ? wrap : w)) });
}

/** Forgot the password but still have the recovery key: set a new password. */
export async function resetPasswordWithRecoveryKey(
  envelope: VaultEnvelope,
  recoveryKeyText: string,
  newPassword: string,
  iterations = DEFAULT_PBKDF2_ITERATIONS,
): Promise<VaultEnvelope> {
  const dek = await dekFromRecovery(envelope, recoveryKeyText, true);
  const { wrap } = await buildPasswordWrap(dek, envelope.vaultId, newPassword, iterations);
  return bump(envelope, { wraps: envelope.wraps.map((w) => (w.type === "password" ? wrap : w)) });
}

/** Issue a new recovery key (old one stops working). Requires the current password. */
export async function rotateRecoveryKey(
  envelope: VaultEnvelope,
  password: string,
): Promise<{ envelope: VaultEnvelope; recoveryKey: string }> {
  const dek = await dekFromPassword(envelope, password, true);
  const { wrap, recoveryKey } = await buildRecoveryWrap(dek, envelope.vaultId);
  return {
    envelope: bump(envelope, { wraps: envelope.wraps.map((w) => (w.type === "recovery" ? wrap : w)) }),
    recoveryKey,
  };
}

// ---------------------------------------------------------------- backup file format

const BACKUP_FORMAT = "ledger-tracker-vault";

const kdfSchema = z.discriminatedUnion("alg", [
  z.object({ alg: z.literal("PBKDF2-SHA256"), iterations: z.number().int().min(1).max(MAX_PBKDF2_ITERATIONS) }),
  z.object({ alg: z.literal("HKDF-SHA256") }),
]);
const wrapSchema = z.object({
  type: z.enum(["password", "recovery"]),
  kdf: kdfSchema,
  salt: z.string().min(1),
  iv: z.string().min(1),
  ct: z.string().min(1),
});
const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  v: z.literal(ENVELOPE_VERSION),
  vaultId: z.string().min(1).max(100),
  wraps: z.array(wrapSchema).min(1).max(4),
  data: z.object({ iv: z.string().min(1), ct: z.string().min(1) }),
  rev: z.number().int().min(0),
  updatedAt: z.string(),
  /** Display name only - not secret, not authenticated. */
  name: z.string().max(80).optional(),
});

/** The backup file *is* the encrypted envelope (base64), so it is exactly as safe as the vault. */
export function serializeEnvelope(envelope: VaultEnvelope, name?: string): string {
  return JSON.stringify(
    {
      format: BACKUP_FORMAT,
      ...(name ? { name } : {}),
      v: envelope.v,
      vaultId: envelope.vaultId,
      wraps: envelope.wraps.map((w) => ({
        type: w.type,
        kdf: w.kdf,
        salt: toBase64(w.salt),
        iv: toBase64(w.iv),
        ct: toBase64(w.ct),
      })),
      data: { iv: toBase64(envelope.data.iv), ct: toBase64(envelope.data.ct) },
      rev: envelope.rev,
      updatedAt: envelope.updatedAt,
    },
    null,
    2,
  );
}

export function parseEnvelope(json: string): VaultEnvelope {
  return parseBackup(json).envelope;
}

/** Parse a backup/stored file into an envelope plus its (unauthenticated) display name. */
export function parseBackup(json: string): { envelope: VaultEnvelope; name?: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new InvalidBackupError();
  }
  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) throw new InvalidBackupError();
  try {
    const b = parsed.data;
    const envelope: VaultEnvelope = {
      v: b.v,
      vaultId: b.vaultId,
      wraps: b.wraps.map((w) => ({
        type: w.type,
        // The schema guarantees the shape; the cast keeps this valid when strictNullChecks is off.
        kdf: (w.kdf.alg === "PBKDF2-SHA256"
          ? { alg: "PBKDF2-SHA256" as const, iterations: w.kdf.iterations }
          : { alg: "HKDF-SHA256" as const }) as Kdf,
        salt: fromBase64(w.salt),
        iv: fromBase64(w.iv),
        ct: fromBase64(w.ct),
      })),
      data: { iv: fromBase64(b.data.iv), ct: fromBase64(b.data.ct) },
      rev: b.rev,
      updatedAt: b.updatedAt,
    };
    const lengthsOk =
      envelope.data.iv.length === IV_BYTES &&
      envelope.wraps.every((w) => w.iv.length === IV_BYTES && w.salt.length === SALT_BYTES && w.ct.length > 16) &&
      envelope.wraps.some((w) => w.type === "password") &&
      envelope.data.ct.length > 16;
    if (!lengthsOk) throw new InvalidBackupError();
    return { envelope, name: b.name };
  } catch (error) {
    if (error instanceof InvalidBackupError) throw error;
    throw new InvalidBackupError();
  }
}

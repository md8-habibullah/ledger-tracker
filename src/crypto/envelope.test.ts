import { describe, expect, it } from "vitest";
import { equalBytes, utf8 } from "./bytes";
import {
  CorruptVaultError,
  InvalidBackupError,
  InvalidRecoveryKeyError,
  WrongCredentialsError,
  changePassword,
  createVaultEnvelope,
  parseEnvelope,
  resetPasswordWithRecoveryKey,
  rotateRecoveryKey,
  sealEnvelope,
  serializeEnvelope,
  unlockWithPassword,
  unlockWithRecoveryKey,
} from "./envelope";
import { formatRecoveryKey, generateRecoveryKey, parseRecoveryKey } from "./recovery";

const ITER = 1_000; // tests only — production default is 600,000
const SECRET_DB = utf8("SQLite format 3\0 pretend this is the whole database");

async function fresh(password = "correct horse battery staple") {
  return createVaultEnvelope({ vaultId: "vault-1", password, plaintext: SECRET_DB, iterations: ITER });
}

describe("recovery key", () => {
  it("round-trips and tolerates case, spaces and look-alike characters", () => {
    const { secret, text } = generateRecoveryKey();
    expect(text).toMatch(/^([0-9A-Z]{4}-){8}[0-9A-Z]{4}$/);
    expect(equalBytes(parseRecoveryKey(text)!, secret)).toBe(true);
    expect(equalBytes(parseRecoveryKey(text.toLowerCase().replace(/-/g, " "))!, secret)).toBe(true);
  });

  it("rejects a mistyped key via the check characters", () => {
    const { text } = generateRecoveryKey();
    const swapped = (text[0] === "7" ? "8" : "7") + text.slice(1);
    expect(parseRecoveryKey(swapped)).toBeNull();
    expect(parseRecoveryKey("not a key")).toBeNull();
    expect(parseRecoveryKey("")).toBeNull();
  });

  it("formats deterministically", () => {
    const secret = new Uint8Array(20);
    expect(formatRecoveryKey(secret)).toBe(formatRecoveryKey(secret));
  });
});

describe("vault envelope", () => {
  it("unlocks with the right password and returns the exact plaintext", async () => {
    const { envelope } = await fresh();
    const { plaintext } = await unlockWithPassword(envelope, "correct horse battery staple");
    expect(equalBytes(plaintext, SECRET_DB)).toBe(true);
  });

  it("rejects a wrong password with WrongCredentialsError", async () => {
    const { envelope } = await fresh();
    await expect(unlockWithPassword(envelope, "wrong")).rejects.toBeInstanceOf(WrongCredentialsError);
  });

  it("never stores the plaintext or the password", async () => {
    const { envelope } = await fresh("hunter2-hunter2");
    const stored = serializeEnvelope(envelope);
    expect(stored).not.toContain("hunter2");
    expect(stored).not.toContain("SQLite format");
    // Ciphertext must not start with the SQLite header either.
    expect(envelope.data.ct[0]).not.toBe(0x53);
  });

  it("uses a fresh IV and different ciphertext on every save", async () => {
    const { envelope, dek } = await fresh();
    const a = await sealEnvelope(envelope, dek, SECRET_DB);
    const b = await sealEnvelope(a, dek, SECRET_DB);
    expect(equalBytes(a.data.iv, b.data.iv)).toBe(false);
    expect(equalBytes(a.data.ct, b.data.ct)).toBe(false);
    expect(b.rev).toBe(envelope.rev + 2);
  });

  it("session key from unlock can seal and the result re-opens", async () => {
    const { envelope } = await fresh();
    const { dek } = await unlockWithPassword(envelope, "correct horse battery staple");
    const updated = await sealEnvelope(envelope, dek, utf8("new contents"));
    const reopened = await unlockWithPassword(updated, "correct horse battery staple");
    expect(new TextDecoder().decode(reopened.plaintext)).toBe("new contents");
  });

  it("session keys are non-extractable", async () => {
    const { dek } = await fresh();
    expect(dek.extractable).toBe(false);
    await expect(crypto.subtle.exportKey("raw", dek)).rejects.toThrow();
  });

  it("detects a flipped bit in the ciphertext", async () => {
    const { envelope } = await fresh();
    const tampered = structuredClone(envelope);
    tampered.data.ct[5] ^= 1;
    await expect(unlockWithPassword(tampered, "correct horse battery staple")).rejects.toBeInstanceOf(CorruptVaultError);
  });

  it("binds ciphertext to its vault id (no swapping between vaults)", async () => {
    const { envelope } = await fresh();
    const moved = { ...envelope, vaultId: "vault-2" };
    await expect(unlockWithPassword(moved, "correct horse battery staple")).rejects.toBeInstanceOf(WrongCredentialsError);
  });

  it("binds KDF parameters: lowering iterations in the header breaks unlock", async () => {
    const { envelope } = await fresh();
    const downgraded = structuredClone(envelope);
    const pw = downgraded.wraps.find((w) => w.type === "password")!;
    pw.kdf = { alg: "PBKDF2-SHA256", iterations: 1 };
    await expect(unlockWithPassword(downgraded, "correct horse battery staple")).rejects.toBeInstanceOf(WrongCredentialsError);
  });
});

describe("recovery key flows", () => {
  it("unlocks with the recovery key", async () => {
    const { envelope, recoveryKey } = await fresh();
    const { plaintext } = await unlockWithRecoveryKey(envelope, recoveryKey);
    expect(equalBytes(plaintext, SECRET_DB)).toBe(true);
  });

  it("reports a typo separately from a wrong-but-well-formed key", async () => {
    const { envelope, recoveryKey } = await fresh();
    await expect(unlockWithRecoveryKey(envelope, "ABCD-EFGH")).rejects.toBeInstanceOf(InvalidRecoveryKeyError);
    const other = generateRecoveryKey().text;
    expect(other).not.toBe(recoveryKey);
    await expect(unlockWithRecoveryKey(envelope, other)).rejects.toBeInstanceOf(WrongCredentialsError);
  });

  it("resets a forgotten password and invalidates the old one", async () => {
    const { envelope, recoveryKey } = await fresh("old password 123");
    const reset = await resetPasswordWithRecoveryKey(envelope, recoveryKey, "new password 456", ITER);
    await expect(unlockWithPassword(reset, "old password 123")).rejects.toBeInstanceOf(WrongCredentialsError);
    const { plaintext } = await unlockWithPassword(reset, "new password 456");
    expect(equalBytes(plaintext, SECRET_DB)).toBe(true);
    // Recovery key remains valid after a reset.
    await expect(unlockWithRecoveryKey(reset, recoveryKey)).resolves.toBeDefined();
  });

  it("rotating the recovery key invalidates the old one", async () => {
    const { envelope, recoveryKey: oldKey } = await fresh("pw-for-rotation-1");
    const { envelope: rotated, recoveryKey: newKey } = await rotateRecoveryKey(envelope, "pw-for-rotation-1");
    await expect(unlockWithRecoveryKey(rotated, oldKey)).rejects.toBeInstanceOf(WrongCredentialsError);
    await expect(unlockWithRecoveryKey(rotated, newKey)).resolves.toBeDefined();
    await expect(rotateRecoveryKey(envelope, "wrong password")).rejects.toBeInstanceOf(WrongCredentialsError);
  });
});

describe("change password", () => {
  it("requires the current password and does not re-encrypt the data", async () => {
    const { envelope } = await fresh("first password!!");
    await expect(changePassword(envelope, "not it", "second password!!", ITER)).rejects.toBeInstanceOf(WrongCredentialsError);
    const changed = await changePassword(envelope, "first password!!", "second password!!", ITER);
    expect(equalBytes(changed.data.ct, envelope.data.ct)).toBe(true); // DEK unchanged
    await expect(unlockWithPassword(changed, "first password!!")).rejects.toBeInstanceOf(WrongCredentialsError);
    await expect(unlockWithPassword(changed, "second password!!")).resolves.toBeDefined();
  });
});

describe("backup file format", () => {
  it("round-trips through serialize/parse and still unlocks", async () => {
    const { envelope, recoveryKey } = await fresh();
    const parsed = parseEnvelope(serializeEnvelope(envelope));
    await expect(unlockWithPassword(parsed, "correct horse battery staple")).resolves.toBeDefined();
    await expect(unlockWithRecoveryKey(parsed, recoveryKey)).resolves.toBeDefined();
  });

  it("rejects malformed input without throwing anything but InvalidBackupError", () => {
    for (const bad of ["", "{", "[]", "null", '{"format":"nope"}', '{"format":"ledger-tracker-vault","v":1}']) {
      expect(() => parseEnvelope(bad)).toThrow(InvalidBackupError);
    }
  });

  it("rejects an envelope whose binary fields have the wrong length", async () => {
    const { envelope } = await fresh();
    const json = JSON.parse(serializeEnvelope(envelope));
    json.wraps[0].salt = "AAAA";
    expect(() => parseEnvelope(JSON.stringify(json))).toThrow(InvalidBackupError);
  });
});

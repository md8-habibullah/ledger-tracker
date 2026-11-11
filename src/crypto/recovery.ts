import { type Bytes, randomBytes } from "./bytes";

/**
 * Recovery key = 160 random bits shown as Crockford Base32 (32 chars) followed by a
 * 20-bit CRC (4 chars), grouped in fours: XXXX-XXXX-…-XXXX (9 groups).
 * The CRC lets the UI say "check for typos" instead of a generic wrong-key error.
 * The CRC is NOT a security feature — the 160 random bits are the secret.
 */
export const RECOVERY_SECRET_BYTES = 20;
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford: no I, L, O, U

function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(text: string, byteLength: number): Bytes | null {
  let bits = 0;
  let value = 0;
  const out = new Uint8Array(byteLength);
  let index = 0;
  for (const ch of text) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) return null;
    value = (value << 5) | v;
    bits += 5;
    if (bits >= 8) {
      if (index >= byteLength) return null;
      out[index++] = (value >>> (bits - 8)) & 255;
      bits -= 8;
    }
  }
  return index === byteLength ? out : null;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function checkChars(secret: Uint8Array): string {
  const crc20 = crc32(secret) & 0xfffff;
  let out = "";
  for (let shift = 15; shift >= 0; shift -= 5) out += ALPHABET[(crc20 >>> shift) & 31];
  return out;
}

export function formatRecoveryKey(secret: Uint8Array): string {
  const raw = base32Encode(secret) + checkChars(secret);
  return raw.match(/.{1,4}/g)!.join("-");
}

export function generateRecoveryKey(): { secret: Bytes; text: string } {
  const secret = randomBytes(RECOVERY_SECRET_BYTES);
  return { secret, text: formatRecoveryKey(secret) };
}

/** Returns the secret bytes, or null when the text is malformed or fails the check characters. */
export function parseRecoveryKey(input: string): Bytes | null {
  const cleaned = input
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  if (cleaned.length !== 36) return null;
  const secret = base32Decode(cleaned.slice(0, 32), RECOVERY_SECRET_BYTES);
  if (!secret) return null;
  return checkChars(secret) === cleaned.slice(32) ? secret : null;
}

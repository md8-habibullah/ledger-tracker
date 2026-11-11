/**
 * Small byte/encoding helpers shared by the crypto module and the vault layer.
 *
 * `Bytes` is an ArrayBuffer-backed Uint8Array: TypeScript 5.7+ distinguishes
 * `Uint8Array<ArrayBuffer>` from `Uint8Array<ArrayBufferLike>`, and WebCrypto only
 * accepts the former as a `BufferSource`.
 */
export type Bytes = Uint8Array<ArrayBuffer>;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function utf8(text: string): Bytes {
  return encoder.encode(text) as Bytes;
}

export function fromUtf8(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}

export function randomBytes(length: number): Bytes {
  const out = new Uint8Array(length);
  crypto.getRandomValues(out);
  return out;
}

/** Copy any view/buffer into a fresh ArrayBuffer-backed array. */
export function toBytes(source: ArrayBuffer | ArrayBufferView): Bytes {
  const view =
    source instanceof ArrayBuffer
      ? new Uint8Array(source)
      : new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  const out = new Uint8Array(view.byteLength);
  out.set(view);
  return out;
}

export function concat(...parts: Uint8Array[]): Bytes {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

export function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function fromBase64(text: string): Bytes {
  const binary = atob(text);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** Uppercase hex, space separated - used by the "what is stored on this device" viewer. */
export function toHex(bytes: Uint8Array, max = bytes.length): string {
  const slice = bytes.subarray(0, max);
  return Array.from(slice, (b) => b.toString(16).padStart(2, "0").toUpperCase()).join(" ");
}

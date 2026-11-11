/**
 * A small, honest strength estimate for the create-vault form. It is guidance, not a guarantee:
 * the real protection is PBKDF2 with 600,000 iterations plus whatever the person chooses.
 */
export interface Strength {
  /** 0 very weak … 4 strong */
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  hint: string;
  bits: number;
}

const COMMON = [
  "password", "passw0rd", "qwerty", "letmein", "welcome", "admin", "iloveyou", "monkey", "dragon", "football",
  "123456", "12345678", "123456789", "111111", "000000", "abc123", "ledger", "taka", "bangladesh", "dhaka",
];

export function estimateStrength(password: string): Strength {
  if (password.length === 0) return { score: 0, label: "", hint: "", bits: 0 };
  let pool = 0;
  if (/[a-z]/.test(password)) pool += 26;
  if (/[A-Z]/.test(password)) pool += 26;
  if (/\d/.test(password)) pool += 10;
  if (/[^A-Za-z0-9\s]/.test(password)) pool += 32;
  if (/\s/.test(password)) pool += 1;
  if (/[^\p{ASCII}]/u.test(password)) pool += 100;
  let bits = password.length * Math.log2(Math.max(pool, 2));

  // A common word is one cheap guess, not len × log2(pool) bits: price it at ~10 bits and score only what is left over.
  // (Capping the whole password would call a long passphrase weak just because it contains "password".)
  let rest = password.toLowerCase();
  let commonHits = 0;
  for (const c of COMMON) {
    const parts = rest.split(c);
    if (parts.length > 1) { commonHits += parts.length - 1; rest = parts.join(""); }
  }
  if (commonHits > 0) bits = Math.min(bits, rest.length * Math.log2(Math.max(pool, 2)) + commonHits * 10);
  const unique = new Set(password).size;
  if (unique <= Math.ceil(password.length / 3)) bits = Math.min(bits, 24); // heavy repetition
  if (/(0123|1234|2345|3456|4567|5678|6789|abcd|bcde|qwer|asdf|zxcv)/i.test(password)) bits -= 12;
  // A long run of lowercase words behaves like a passphrase; do not over-penalise length.
  bits = Math.max(0, bits);

  if (password.length < 10) return { score: password.length < 6 ? 0 : 1, label: "Too short", hint: "Use at least 10 characters. A few random words works well.", bits };
  if (bits < 40) return { score: 1, label: "Weak", hint: "Easy to guess. Add more words or characters.", bits };
  if (bits < 60) return { score: 2, label: "Fair", hint: "Okay. A longer phrase would be stronger.", bits };
  if (bits < 80) return { score: 3, label: "Good", hint: "Good. Make sure you can remember it.", bits };
  return { score: 4, label: "Strong", hint: "Strong. Keep it somewhere you trust.", bits };
}

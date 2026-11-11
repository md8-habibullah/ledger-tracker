import type { Category, Kind } from "@/db/repo";
import { type DateString, addDays, isDateString, parseDate, toDateString } from "./dates";
import { DEFAULT_CURRENCY, parseMinor } from "./money";

/**
 * Natural-language quick entry, parsed entirely on this device:
 *   "tea 40"            → expense, ৳40, note "tea", today
 *   "rickshaw 60 yesterday"
 *   "+85000 salary 1 nov"  → income
 *   "lunch ৳250 food 3 days ago"
 */
export interface QuickEntryResult {
  kind: Kind;
  amountMinor: number | null;
  categoryId: number | null;
  occurredOn: DateString;
  note: string;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const INCOME_WORDS = new Set(["income", "earned", "received", "salary", "bonus", "refund"]);
const AMOUNT = /^(?:৳|tk\.?|bdt)?\s*([+-]?)([\d,]+(?:\.\d{1,2})?)\s*(?:৳|tk\.?|taka|bdt)?$/i;

function parseAmountToken(token: string, currency: string): { minor: number; sign: string } | null {
  const m = AMOUNT.exec(token);
  if (!m) return null;
  const minor = parseMinor(m[2], currency);
  return minor === null ? null : { minor, sign: m[1] };
}

function monthIndex(word: string): number {
  const w = word.toLowerCase().slice(0, 3);
  return word.length >= 3 && MONTHS.includes(w) ? MONTHS.indexOf(w) : -1;
}

export function parseQuickEntry(
  text: string,
  categories: readonly Category[],
  today: DateString,
  currency: string = DEFAULT_CURRENCY,
): QuickEntryResult {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  const used = new Set<number>();
  const now = parseDate(today);

  let amountMinor: number | null = null;
  let explicitIncome = false;
  let occurredOn: DateString = today;

  // Dates first: they contain numbers that must not be mistaken for the amount.
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i].toLowerCase();
    const next = tokens[i + 1];
    if (t === "today") { used.add(i); }
    else if (t === "yesterday" || t === "y'day") { occurredOn = toDateString(addDays(now, -1)); used.add(i); }
    else if (isDateString(tokens[i])) { occurredOn = tokens[i]; used.add(i); }
    else if (/^\d+$/.test(t) && next && /^days?$/i.test(next) && tokens[i + 2]?.toLowerCase() === "ago") {
      occurredOn = toDateString(addDays(now, -Number(t))); used.add(i).add(i + 1).add(i + 2); i += 2;
    } else if (monthIndex(t) >= 0) {
      // Anchor on the month word. "nov 3" (month first) wins when a day follows, so that in
      // "tea 40 nov 3" the 40 stays the amount; otherwise accept "3 nov" (day first).
      const dayAfter = next && isDay(next) ? i + 1 : -1;
      const dayBefore = i > 0 && !used.has(i - 1) && isDay(tokens[i - 1]) ? i - 1 : -1;
      const dayAt = dayAfter >= 0 ? dayAfter : dayBefore;
      if (dayAt >= 0) {
        occurredOn = resolveMonthDay(now, monthIndex(t), Number(tokens[dayAt]));
        used.add(i).add(dayAt);
        if (dayAt === i + 1) i += 1;
      }
    }
  }

  for (let i = 0; i < tokens.length; i++) {
    if (used.has(i) || amountMinor !== null) continue;
    const parsed = parseAmountToken(tokens[i], currency);
    if (parsed) {
      amountMinor = parsed.minor;
      if (parsed.sign === "+") explicitIncome = true;
      used.add(i);
    }
  }

  // Category: a token that equals or starts a category word (≥3 letters), longest match wins.
  let categoryId: number | null = null;
  let best = 0;
  let bestIndex = -1;
  tokens.forEach((token, i) => {
    if (used.has(i)) return;
    const t = token.toLowerCase().replace(/[^a-z&]/g, "");
    if (t.length < 3) return;
    for (const c of categories) {
      for (const word of c.name.toLowerCase().split(/[\s&]+/).filter((w) => w.length >= 3)) {
        const hit = word === t || word.startsWith(t) || t.startsWith(word);
        const score = hit ? Math.min(word.length, t.length) + (word === t ? 5 : 0) : 0;
        if (score > best) { best = score; categoryId = c.id; bestIndex = i; }
      }
    }
  });
  if (bestIndex >= 0) used.add(bestIndex);

  const chosen = categories.find((c) => c.id === categoryId);
  const incomeWord = tokens.some((t, i) => !used.has(i) && INCOME_WORDS.has(t.toLowerCase()));
  const kind: Kind = explicitIncome || chosen?.kind === "income" || incomeWord ? "income" : "expense";

  // If the category we matched doesn't fit the kind the words imply, drop it rather than guess.
  const categoryFits = chosen && chosen.kind === kind;
  const note = tokens
    .filter((t, i) => !used.has(i) && !(INCOME_WORDS.has(t.toLowerCase()) && kind === "income" && !chosen))
    .join(" ")
    .trim();

  return {
    kind,
    amountMinor,
    categoryId: categoryFits ? categoryId : null,
    occurredOn,
    // Keep the category word in the note when it wasn't used for a category, so nothing the person typed is lost.
    note: !categoryFits && bestIndex >= 0 ? [tokens[bestIndex], note].filter(Boolean).join(" ") : note,
  };
}

function isDay(token: string): boolean {
  return /^\d{1,2}$/.test(token) && Number(token) >= 1 && Number(token) <= 31;
}

function resolveMonthDay(now: Date, month: number, day: number): DateString {
  let candidate = new Date(now.getFullYear(), month, day);
  if (candidate.getMonth() !== month) return toDateString(now); // e.g. 31 Feb → ignore
  if (candidate > now) candidate = new Date(now.getFullYear() - 1, month, day); // "3 dec" in November means last year
  return toDateString(candidate);
}

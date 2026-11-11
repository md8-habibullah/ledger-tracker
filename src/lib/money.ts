/**
 * Money is stored and computed as INTEGER MINOR UNITS (paisa, cents) - never floats.
 * All display and parsing goes through this file; no `$`/`USD` literals anywhere else.
 */

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  /** Digits after the decimal point (minor-unit exponent). */
  digits: number;
}

export const CURRENCIES: readonly CurrencyInfo[] = [
  { code: "BDT", name: "Bangladeshi Taka", symbol: "৳", digits: 2 },
  { code: "USD", name: "US Dollar", symbol: "$", digits: 2 },
  { code: "EUR", name: "Euro", symbol: "€", digits: 2 },
  { code: "GBP", name: "British Pound", symbol: "£", digits: 2 },
  { code: "INR", name: "Indian Rupee", symbol: "₹", digits: 2 },
  { code: "PKR", name: "Pakistani Rupee", symbol: "₨", digits: 2 },
  { code: "AED", name: "UAE Dirham", symbol: "AED", digits: 2 },
  { code: "SAR", name: "Saudi Riyal", symbol: "SAR", digits: 2 },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM", digits: 2 },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", digits: 2 },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$", digits: 2 },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", digits: 2 },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", digits: 0 },
] as const;

export const DEFAULT_CURRENCY = "BDT";

export function currencyInfo(code: string): CurrencyInfo {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}

/** Largest amount we accept: keeps sums of many entries well inside Number.MAX_SAFE_INTEGER. */
export const MAX_MINOR = 10 ** 13;

/**
 * Parse what a person typed ("1,250.50", "1250", "৳ 80") into minor units.
 * Returns null for anything ambiguous, negative, zero, or with too many decimals.
 * Accepts Bengali digits.
 */
export function parseMinor(input: string, code: string = DEFAULT_CURRENCY): number | null {
  const { digits } = currencyInfo(code);
  const ascii = input
    .replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)))
    .replace(/[\s,_]/g, "")
    // Drop a leading currency symbol/letters, but keep "-" so negatives are rejected below.
    .replace(/^[^\d.-]+/, "");
  if (!/^\d*\.?\d*$/.test(ascii) || ascii === "" || ascii === ".") return null;
  const [whole, frac = ""] = ascii.split(".");
  if (frac.length > digits) return null;
  const minor = Number(whole || "0") * 10 ** digits + Number(frac.padEnd(digits, "0") || "0");
  if (!Number.isSafeInteger(minor) || minor <= 0 || minor > MAX_MINOR) return null;
  return minor;
}

/** Decimal string for an input field ("1250.50"), no grouping. */
export function minorToInputString(minor: number, code: string = DEFAULT_CURRENCY): string {
  const { digits } = currencyInfo(code);
  if (digits === 0) return String(minor);
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  const whole = Math.trunc(abs / 10 ** digits);
  const frac = String(abs % 10 ** digits).padStart(digits, "0");
  return `${sign}${whole}.${frac}`;
}

export interface FormatOptions {
  code?: string;
  /** BCP-47 locale used for digits/grouping. BDT uses lakh/crore grouping by default. */
  locale?: string;
  /** Hide ".00" when the amount is whole. */
  compactWhole?: boolean;
  /** Always prefix + or − (for signed deltas). */
  signed?: boolean;
}

function groupingLocale(code: string, locale?: string): string {
  if (locale) return locale;
  return code === "BDT" || code === "INR" || code === "PKR" ? "en-IN" : "en-US";
}

/** Format minor units for display, e.g. 123456789 BDT → "৳12,34,567.89". */
export function formatMoney(minor: number, options: FormatOptions = {}): string {
  const code = options.code ?? DEFAULT_CURRENCY;
  const info = currencyInfo(code);
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const whole = abs % 10 ** info.digits === 0;
  const fractionDigits = options.compactWhole && whole ? 0 : info.digits;
  const value = abs / 10 ** info.digits;
  const body = new Intl.NumberFormat(groupingLocale(code, options.locale), {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
  const symbol = info.symbol.length > 1 && /^[A-Z]+$/.test(info.symbol) ? `${info.symbol} ` : info.symbol;
  const sign = negative ? "−" : options.signed && minor > 0 ? "+" : "";
  return `${sign}${symbol}${body}`;
}

/** Compact form for chart axes: 1.2L, 3.4Cr for lakh-crore currencies; 1.2K / 3.4M otherwise. */
export function formatMoneyCompact(minor: number, code: string = DEFAULT_CURRENCY): string {
  const info = currencyInfo(code);
  const value = Math.abs(minor) / 10 ** info.digits;
  const sign = minor < 0 ? "−" : "";
  const trim = (n: number) => String(Math.round(n * 10) / 10);
  if (code === "BDT" || code === "INR" || code === "PKR") {
    if (value >= 1e7) return `${sign}${info.symbol}${trim(value / 1e7)}Cr`;
    if (value >= 1e5) return `${sign}${info.symbol}${trim(value / 1e5)}L`;
    if (value >= 1e3) return `${sign}${info.symbol}${trim(value / 1e3)}K`;
    return `${sign}${info.symbol}${trim(value)}`;
  }
  if (value >= 1e9) return `${sign}${info.symbol}${trim(value / 1e9)}B`;
  if (value >= 1e6) return `${sign}${info.symbol}${trim(value / 1e6)}M`;
  if (value >= 1e3) return `${sign}${info.symbol}${trim(value / 1e3)}K`;
  return `${sign}${info.symbol}${trim(value)}`;
}

/** Percentage as an integer-safe ratio: share of part in whole, 0 when whole is 0. */
export function percentOf(part: number, whole: number): number {
  return whole > 0 ? (part / whole) * 100 : 0;
}

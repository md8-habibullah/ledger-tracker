/**
 * Calendar dates are plain "YYYY-MM-DD" strings in the user's LOCAL time zone.
 * Never derive "today" from toISOString() - that is UTC and is wrong after
 * 18:00 in Dhaka (UTC+6). ISO date strings sort lexicographically, so comparisons
 * and SQL range queries use plain string comparison.
 */

export type DateString = string;

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

export function toDateString(date: Date): DateString {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayLocal(now: Date = new Date()): DateString {
  return toDateString(now);
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDateString(value: string): boolean {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d;
}

/** Parse a date string as local midnight. Throws on invalid input. */
export function parseDate(value: DateString): Date {
  const m = DATE_RE.exec(value);
  if (!m || !isDateString(value)) throw new RangeError(`Invalid date: ${value}`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export interface DateRange {
  /** Inclusive. */
  from: DateString;
  /** Inclusive. */
  to: DateString;
}

export function monthRange(date: Date | DateString): DateRange {
  const d = typeof date === "string" ? parseDate(date) : date;
  return {
    from: toDateString(new Date(d.getFullYear(), d.getMonth(), 1)),
    to: toDateString(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
  };
}

/** Weeks start on Saturday in Bangladesh; pass 0 for Sunday-start or 1 for Monday-start. */
export function weekRange(date: Date | DateString, weekStartsOn: 0 | 1 | 6 = 6): DateRange {
  const d = typeof date === "string" ? parseDate(date) : date;
  const offset = (d.getDay() - weekStartsOn + 7) % 7;
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  return { from: toDateString(start), to: toDateString(end) };
}

export function yearRange(date: Date | DateString): DateRange {
  const d = typeof date === "string" ? parseDate(date) : date;
  return { from: `${pad(d.getFullYear(), 4)}-01-01`, to: `${pad(d.getFullYear(), 4)}-12-31` };
}

/** Month shifted by `delta` whole months, clamped so Jan 31 + 1 month is still in February. */
export function addMonths(date: Date, delta: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + delta, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(date.getDate(), lastDay));
  return target;
}

export function addDays(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + delta);
}

export function inRange(value: DateString, range: DateRange): boolean {
  return value >= range.from && value <= range.to;
}

/** Normalise legacy values ("2025-03-04", "2025-03-04T10:00:00.000Z", Date strings) to a local date. */
export function normaliseLegacyDate(value: unknown, fallback: DateString): DateString {
  if (typeof value !== "string" || value === "") return fallback;
  if (isDateString(value)) return value;
  const prefix = value.slice(0, 10);
  if (isDateString(prefix) && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    // Datetime with an explicit zone: convert to the local calendar day it represents.
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return toDateString(parsed);
    return prefix;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : toDateString(parsed);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function shortMonth(date: Date): string {
  return MONTHS[date.getMonth()];
}

const LONG_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "November", independent of the browser's locale (like the rest of the date helpers). */
export function longMonth(date: Date): string {
  return LONG_MONTHS[date.getMonth()];
}

/** "11 Nov 2026, 22:35" in the device's local time, independent of the browser's locale. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown time";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "Tue 11 Nov" style label for list group headers. */
export function formatDayLabel(value: DateString, today: DateString = todayLocal()): string {
  if (value === today) return "Today";
  const d = parseDate(value);
  const y = parseDate(today);
  y.setDate(y.getDate() - 1);
  if (toDateString(y) === value) return "Yesterday";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
  const yearPart = d.getFullYear() === parseDate(today).getFullYear() ? "" : ` ${d.getFullYear()}`;
  return `${weekday} ${d.getDate()} ${MONTHS[d.getMonth()]}${yearPart}`;
}

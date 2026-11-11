import { describe, expect, it } from "vitest";
import { addMonths, formatDateTime, formatDayLabel, inRange, isDateString, monthRange, normaliseLegacyDate, todayLocal, toDateString, weekRange } from "./dates";
import { formatMoney, formatMoneyCompact, minorToInputString, parseMinor } from "./money";

describe("parseMinor", () => {
  it("parses plain and grouped input exactly (no float error)", () => {
    expect(parseMinor("1250")).toBe(125000);
    expect(parseMinor("1,250.50")).toBe(125050);
    expect(parseMinor("0.1")).toBe(10);
    expect(parseMinor("0.07")).toBe(7);
    expect(parseMinor("19.99")).toBe(1999);
    expect(parseMinor("৳ 80")).toBe(8000);
    expect(parseMinor("১২৩.৫")).toBe(12350);
  });
  it("rejects zero, negatives, junk, and extra decimals", () => {
    for (const bad of ["", "0", "0.00", "-5", "৳-5", "5-", "abc", "1.234", "1..2", ".", "1e3", "NaN"]) {
      expect(parseMinor(bad), bad).toBeNull();
    }
  });
  it("respects zero-decimal currencies", () => {
    expect(parseMinor("500", "JPY")).toBe(500);
    expect(parseMinor("5.5", "JPY")).toBeNull();
  });
  it("rejects values too large to sum safely", () => {
    expect(parseMinor("999999999999999999")).toBeNull();
  });
});

describe("formatMoney", () => {
  it("uses lakh/crore grouping for BDT and the ৳ symbol", () => {
    expect(formatMoney(123456789)).toBe("৳12,34,567.89");
    expect(formatMoney(5000, { compactWhole: true })).toBe("৳50");
    expect(formatMoney(-2550)).toBe("−৳25.50");
    expect(formatMoney(100, { signed: true })).toBe("+৳1.00");
  });
  it("formats other currencies with their own symbol and grouping", () => {
    expect(formatMoney(123456789, { code: "USD" })).toBe("$1,234,567.89");
    expect(formatMoney(500, { code: "JPY" })).toBe("¥500");
    expect(formatMoney(1000, { code: "AED" })).toBe("AED 10.00");
  });
  it("compacts for chart axes", () => {
    expect(formatMoneyCompact(15000000)).toBe("৳1.5L");
    expect(formatMoneyCompact(3000000000)).toBe("৳3Cr");
    expect(formatMoneyCompact(120000, "USD")).toBe("$1.2K");
  });
  it("round-trips through the input string", () => {
    for (const minor of [1, 7, 100, 125050, 99999999]) {
      expect(parseMinor(minorToInputString(minor))).toBe(minor);
    }
  });
});

describe("dates", () => {
  it("todayLocal uses local calendar parts, not UTC", () => {
    // 23:30 local on 11 Nov must stay 11 Nov even when UTC has already rolled over.
    const late = new Date(2026, 10, 11, 23, 30);
    expect(todayLocal(late)).toBe("2026-11-11");
    expect(toDateString(new Date(2026, 0, 1, 0, 5))).toBe("2026-01-01");
  });
  it("validates real calendar dates", () => {
    expect(isDateString("2024-02-29")).toBe(true);
    expect(isDateString("2025-02-29")).toBe(false);
    expect(isDateString("2025-13-01")).toBe(false);
    expect(isDateString("2025-1-1")).toBe(false);
  });
  it("computes month, week (Saturday start) and clamped month arithmetic", () => {
    expect(monthRange("2026-02-10")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(weekRange("2026-11-11")).toEqual({ from: "2026-11-07", to: "2026-11-13" }); // Wed → Sat..Fri
    expect(weekRange("2026-11-07")).toEqual({ from: "2026-11-07", to: "2026-11-13" });
    expect(toDateString(addMonths(new Date(2026, 0, 31), 1))).toBe("2026-02-28");
    expect(inRange("2026-11-30", monthRange("2026-11-01"))).toBe(true);
    expect(inRange("2026-12-01", monthRange("2026-11-01"))).toBe(false);
  });
  it("normalises legacy values", () => {
    expect(normaliseLegacyDate("2025-03-04", "2000-01-01")).toBe("2025-03-04");
    expect(normaliseLegacyDate("", "2000-01-01")).toBe("2000-01-01");
    expect(normaliseLegacyDate("garbage", "2000-01-01")).toBe("2000-01-01");
    expect(normaliseLegacyDate(undefined, "2000-01-01")).toBe("2000-01-01");
  });
  it("labels days", () => {
    expect(formatDayLabel("2026-11-11", "2026-11-11")).toBe("Today");
    expect(formatDayLabel("2026-11-10", "2026-11-11")).toBe("Yesterday");
    expect(formatDayLabel("2026-11-04", "2026-11-11")).toBe("Wed 4 Nov");
    expect(formatDayLabel("2025-11-04", "2026-11-11")).toBe("Tue 4 Nov 2025");
  });
  it("formats a stored timestamp in local time without depending on the browser locale", () => {
    const local = new Date(2026, 10, 11, 22, 5).toISOString(); // built from local parts, so it holds in any timezone
    expect(formatDateTime(local)).toBe("11 Nov 2026, 22:05");
    expect(formatDateTime("not a date")).toBe("unknown time");
  });
});

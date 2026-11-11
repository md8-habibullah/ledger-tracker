import type { Category, Transaction } from "@/db/repo";
import { minorToInputString } from "./money";

/**
 * CSV for spreadsheets. Free-text cells that start with = + - @ (or tab/CR) get a leading single quote so
 * Excel/Sheets show them as text instead of executing a note like `=HYPERLINK(...)` (CSV injection).
 */
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: string | number): string {
  let text = String(value);
  // Numbers we generate (amounts) are plain; only guard free text.
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: (string | number)[][]): string {
  // UTF-8 BOM so Excel opens Bengali text correctly; CRLF per RFC 4180.
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export function transactionsToCsv(transactions: readonly Transaction[], categoryById: Map<number, Category>, currency: string): string {
  const header = ["Date", "Type", "Category", "Note", `Amount (${currency})`];
  const rows = transactions.map((t) => [
    t.occurredOn,
    t.kind === "income" ? "Income" : "Expense",
    categoryById.get(t.categoryId)?.name ?? "Unknown",
    t.note,
    // Plain decimal, no grouping or symbol, so spreadsheets parse it as a number.
    minorToInputString(t.amountMinor, currency),
  ]);
  return toCsv([header, ...rows]);
}

/** Trigger a browser download. Used only for files the user explicitly asked for. */
export function downloadText(filename: string, content: string, mime = "text/csv;charset=utf-8"): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

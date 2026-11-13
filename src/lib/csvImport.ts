import { unguardCell } from "./csv";
import { isDateString } from "./dates";
import type { ImportEntry, ImportSource } from "./importPlan";
import { currencyInfo, parseMinor } from "./money";

/**
 * Reads the CSV file this app writes ("Export CSV" on Entries, "Export all entries" in Settings):
 *
 *   Date,Type,Category,Note,Amount (BDT)
 *   2026-11-01,Expense,Food & Dining,lunch,250.00
 *
 * Column order is free, the note column is optional, and a spreadsheet's own `;` or tab delimiter is
 * understood, so a file that was opened and saved again in Excel or Sheets still imports. Nothing here
 * trusts the file: every row is checked and a bad row is reported, never guessed at.
 */

export class ImportFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportFileError";
  }
}

export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 100_000;
const MAX_NAME = 60;
const MAX_NOTE = 500;

export interface ImportProblem {
  /** Spreadsheet row number (the header is row 1). */
  row: number;
  message: string;
}

export interface ParsedCsv {
  source: ImportSource;
  problems: ImportProblem[];
  /** Currency named in the amount column's header, e.g. "Amount (USD)". */
  fileCurrency: string | null;
  /** Data rows read (blank lines excluded). */
  rowCount: number;
}

/** RFC 4180 reader: quoted cells may hold delimiters, doubled quotes and line breaks; CRLF, LF and CR all end a row. */
export function parseCsv(text: string, delimiter = ","): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let fresh = true; // nothing yet in this cell, so a quote here opens a quoted cell
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch !== '"') cell += ch;
      else if (text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = false;
    } else if (ch === '"' && fresh) {
      quoted = true;
      fresh = false;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = "";
      fresh = true;
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      fresh = true;
    } else {
      cell += ch;
      fresh = false;
    }
  }
  if (quoted) throw new ImportFileError("The file ends in the middle of a quoted cell, so it looks damaged or cut short.");
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** Comma, semicolon or tab: whichever the header line uses most (outside quotes). */
function sniffDelimiter(text: string): string {
  const counts = new Map([[",", 0], [";", 0], ["\t", 0]]);
  let quoted = false;
  for (const ch of text) {
    if (ch === '"') quoted = !quoted;
    else if (quoted) continue;
    else if (ch === "\n" || ch === "\r") {
      if ([...counts.values()].some((n) => n > 0)) break; // the header line is done
    } else if (counts.has(ch)) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  }
  const [best, uses] = [...counts].sort((a, b) => b[1] - a[1])[0];
  return uses > 0 ? best : ",";
}

/**
 * Amount cell → minor units, or null. Stricter than the amount box in the entry form, because a file cannot
 * be asked what it meant: "1,250.50" and "12,34,567.89" are fine, but "1250,50" (a decimal comma) is
 * rejected instead of being read as 125,050, and any sign or bracket (a negative) is rejected.
 */
export function parseImportAmount(raw: string, code: string): number | null {
  const ascii = raw.trim().replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)));
  if (/[-−–()]/.test(ascii)) return null;
  const body = ascii.replace(/^[^\d.]+/, ""); // a leading symbol or code: ৳ 80, $12, BDT 80
  const plain = /^(?:\d+(?:\.\d+)?|\.\d+)$/.test(body);
  const western = /^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(body);
  const lakh = /^\d{1,2}(?:,\d{2})*,\d{3}(?:\.\d+)?$/.test(body);
  if (!plain && !western && !lakh) return null;
  return parseMinor(body.replace(/,/g, ""), code);
}

function parseType(raw: string): "income" | "expense" | null {
  const v = raw.trim().toLowerCase();
  if (v === "income" || v === "money in") return "income";
  if (v === "expense" || v === "money out") return "expense";
  return null;
}

const COLUMN_NAMES = {
  date: ["date"],
  type: ["type"],
  category: ["category"],
  note: ["note", "notes"],
} as const;
const AMOUNT_HEADER = /^amount\s*(?:\(\s*([a-z]{3})\s*\))?$/i;

export function parseLedgerCsv(raw: string, vaultCurrency: string): ParsedCsv {
  const text = raw.replace(/^\uFEFF/, "");
  if (text.trim() === "") throw new ImportFileError("The file is empty.");
  const records = parseCsv(text, sniffDelimiter(text));

  const headerAt = records.findIndex((r) => r.some((c) => c.trim() !== ""));
  if (headerAt === -1) throw new ImportFileError("The file is empty.");
  const header = records[headerAt].map((c) => c.trim().toLowerCase());
  const find = (names: readonly string[]) => header.findIndex((h) => names.includes(h));
  const col = {
    date: find(COLUMN_NAMES.date),
    type: find(COLUMN_NAMES.type),
    category: find(COLUMN_NAMES.category),
    note: find(COLUMN_NAMES.note),
    amount: header.findIndex((h) => AMOUNT_HEADER.test(h)),
  };
  const missing = (["date", "type", "category", "amount"] as const).filter((k) => col[k] === -1);
  if (missing.length > 0) {
    const names = missing.map((k) => k[0].toUpperCase() + k.slice(1)).join(", ");
    throw new ImportFileError(
      `This does not look like a Ledger Tracker CSV. The first row must name the columns, and ${names} ${missing.length === 1 ? "is" : "are"} missing. ` +
        `An exported file starts with: Date, Type, Category, Note, Amount (${vaultCurrency}).`,
    );
  }
  const fileCurrency = AMOUNT_HEADER.exec(header[col.amount])?.[1]?.toUpperCase() ?? null;
  const { digits } = currencyInfo(vaultCurrency);

  const dataRows = records.length - headerAt - 1;
  if (dataRows > MAX_IMPORT_ROWS) throw new ImportFileError(`The file has more than ${MAX_IMPORT_ROWS.toLocaleString("en-US")} rows. Split it into smaller files.`);

  const entries: ImportEntry[] = [];
  const problems: ImportProblem[] = [];
  let rowCount = 0;
  for (let i = headerAt + 1; i < records.length; i++) {
    const cells = records[i];
    if (cells.every((c) => c.trim() === "")) continue;
    rowCount++;
    const row = i + 1;
    const cell = (index: number) => (index === -1 ? "" : unguardCell((cells[index] ?? "").trim()));
    const fail = (message: string) => problems.push({ row, message });

    // More cells than the header names means a cell was split by a delimiter inside it (an unquoted "1250,50"),
    // so no cell can be trusted. Trailing empty cells are fine: some tools pad every row.
    let used = cells.length;
    while (used > header.length && cells[used - 1].trim() === "") used--;
    if (used > header.length) {
      fail(`The row has ${used} cells but the header has ${header.length}. A cell that contains a comma has to be wrapped in quotes.`);
      continue;
    }

    const date = cell(col.date);
    if (!isDateString(date)) { fail(date === "" ? "The date is empty." : `“${clip(date)}” is not a date. Use YYYY-MM-DD, like 2026-11-01.`); continue; }
    const kind = parseType(cell(col.type));
    if (!kind) { fail(`The type “${clip(cell(col.type))}” is not Income or Expense.`); continue; }
    const categoryName = cell(col.category);
    if (categoryName === "") { fail("The category is empty."); continue; }
    if (categoryName.length > MAX_NAME) { fail(`The category name is longer than ${MAX_NAME} characters.`); continue; }
    const note = cell(col.note);
    if (note.length > MAX_NOTE) { fail(`The note is longer than ${MAX_NOTE} characters.`); continue; }
    const amountText = (cells[col.amount] ?? "").trim();
    const amountMinor = parseImportAmount(amountText, vaultCurrency);
    if (amountMinor === null) {
      fail(
        amountText === ""
          ? "The amount is empty."
          : `“${clip(amountText)}” is not a usable amount. Use a positive number with at most ${digits} decimal ${digits === 1 ? "place" : "places"} and a dot for decimals, like 1250.50.`,
      );
      continue;
    }
    entries.push({ row, kind, categoryName, amountMinor, note, occurredOn: date });
  }

  return { source: { currency: fileCurrency, categories: [], entries, budgets: [] }, problems, fileCurrency, rowCount };
}

function clip(text: string): string {
  return text.length > 30 ? `${text.slice(0, 30)}…` : text;
}

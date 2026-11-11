import { addTransaction, listCategories, setMeta, upsertBudget } from "@/db/repo";
import { type Database, withTransaction } from "@/db/sql";
import { type DateString, addDays, addMonths, monthRange, parseDate, toDateString } from "@/lib/dates";

/** Small seeded PRNG so the demo looks the same for everyone on a given day (and tests are stable). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash = (text: string) => [...text].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

/**
 * Six months of plausible Dhaka-household activity ending on `today`.
 * Amounts are in paisa. Nothing here is real data.
 */
export function buildDemoData(db: Database, today: DateString): void {
  const rand = mulberry32(hash(today));
  const between = (lo: number, hi: number) => Math.round(lo + rand() * (hi - lo));
  const pick = <T,>(items: readonly T[]) => items[Math.floor(rand() * items.length)];
  const taka = (n: number) => n * 100;

  const categories = listCategories(db);
  const id = (name: string, kind: "income" | "expense") => categories.find((c) => c.name === name && c.kind === kind)!.id;

  const now = parseDate(today);
  const entries: { kind: "income" | "expense"; amountMinor: number; categoryId: number; note: string; occurredOn: string }[] = [];
  const add = (day: Date, kind: "income" | "expense", category: string, amountMinor: number, note: string) => {
    const occurredOn = toDateString(day);
    if (occurredOn <= today) entries.push({ kind, amountMinor, categoryId: id(category, kind), note, occurredOn });
  };

  for (let m = 5; m >= 0; m--) {
    const month = addMonths(now, -m);
    const first = parseDate(monthRange(month).from);
    const dayOf = (n: number) => new Date(first.getFullYear(), first.getMonth(), n);
    const last = parseDate(monthRange(month).to).getDate();

    add(dayOf(1), "income", "Salary", taka(85_000), "Monthly salary");
    if (m % 2 === 0) add(dayOf(14), "income", "Freelance", taka(between(12_000, 26_000)), "Website project payment");
    add(dayOf(5), "expense", "Home", taka(22_000), "House rent");
    add(dayOf(8), "expense", "Bills & Utilities", taka(between(1_800, 2_700)), "Electricity bill");
    add(dayOf(10), "expense", "Bills & Utilities", taka(1_200), "Internet");
    add(dayOf(12), "expense", "Bills & Utilities", taka(950), "Gas bill");
    add(dayOf(15), "expense", "Subscriptions", taka(450), "Streaming");
    add(dayOf(20), "expense", "Subscriptions", taka(299), "Music");
    add(dayOf(3), "expense", "Education", taka(3_000), "Tuition fee");
    add(dayOf(Math.min(last, 7)), "expense", "Charity", taka(between(500, 1_000)), "Friday donation");
    if (rand() < 0.55) add(dayOf(between(9, 24)), "expense", "Healthcare", taka(between(400, 3_500)), pick(["Pharmacy", "Doctor visit", "Lab test"]));
    if (rand() < 0.5) add(dayOf(between(10, 26)), "expense", "Family", taka(between(2_000, 6_000)), pick(["Sent home", "Gift for parents", "Family dinner"]));
    if (rand() < 0.25) add(dayOf(between(4, 26)), "expense", "Travel", taka(between(1_500, 9_000)), pick(["Bus to hometown", "Weekend trip"]));

    for (let d = 1; d <= last; d++) {
      const day = dayOf(d);
      if (rand() < 0.72) add(day, "expense", "Food & Dining", taka(between(120, 650)), pick(["Lunch", "Tea & snacks", "Dinner", "Biryani", "Breakfast", "Groceries"]));
      if (rand() < 0.6) add(day, "expense", "Transportation", taka(between(40, 350)), pick(["Rickshaw", "Ride share", "Bus fare", "CNG"]));
      if (day.getDay() === 5 && rand() < 0.7) add(day, "expense", "Entertainment", taka(between(300, 1_500)), pick(["Cinema", "Cafe", "Games"]));
      if (day.getDay() === 6 && rand() < 0.65) add(day, "expense", "Shopping", taka(between(500, 4_000)), pick(["Clothes", "Household items", "Online order"]));
    }
  }

  withTransaction(db, () => {
    setMeta(db, "name", "Demo vault");
    setMeta(db, "currency", "BDT");
    for (const e of entries) addTransaction(db, e, addDays(now, 0));
    upsertBudget(db, { categoryId: id("Food & Dining", "expense"), amountMinor: taka(12_000), period: "monthly" });
    upsertBudget(db, { categoryId: id("Food & Dining", "expense"), amountMinor: taka(3_500), period: "weekly" });
    upsertBudget(db, { categoryId: id("Transportation", "expense"), amountMinor: taka(5_000), period: "monthly" });
    upsertBudget(db, { categoryId: id("Shopping", "expense"), amountMinor: taka(6_000), period: "monthly" });
    upsertBudget(db, { categoryId: id("Entertainment", "expense"), amountMinor: taka(3_000), period: "monthly" });
    upsertBudget(db, { categoryId: id("Subscriptions", "expense"), amountMinor: taka(1_000), period: "monthly" });
  });
}

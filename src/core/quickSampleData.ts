import { captureCommand } from "../ledgerSync/capture.ts";
import { postEntry } from "./commands.ts";
import { monthKeyFromDateKey, parseDateKey, shiftMonthKey } from "./calendar.ts";
import { createDemoRandom } from "./demoRandom.ts";
import { JOINT, ValidationError, type Household, type CommitResult } from "./types.ts";

export type QuickSampleInput = {
  today: string;
  months: number;
  seed: number;
  memberId: string;
  accountId: string;
  visibility: "household" | "personal";
};

export function quickSampleAccounts(h: Household, memberId: string, visibility: QuickSampleInput["visibility"]) {
  return h.accounts.filter(a => a.active && a.currency === "CAD" && ["chequing", "savings", "other"].includes(a.kind)
    && (visibility === "personal" ? a.scope === "personal" && a.ownerMemberId === memberId : a.scope !== "personal"));
}

/** Small pure preview: no journal compilation, simulations, cloning or writes. */
export function previewQuickSampleData(h: Household, input: QuickSampleInput) {
  if (h.environment !== "development") throw new ValidationError("Sample data is Development-only.");
  if (!Number.isInteger(input.months) || input.months < 3 || input.months > 6) throw new ValidationError("Choose 3–6 months.");
  if (!Number.isInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new ValidationError("Invalid sample seed.");
  if (!["household", "personal"].includes(input.visibility)) throw new ValidationError("Choose Shared or Personal.");
  if (!h.members.some(m => m.id === input.memberId && m.active)) throw new ValidationError("Choose an active member.");
  if (!quickSampleAccounts(h, input.memberId, input.visibility).some(a => a.id === input.accountId)) throw new ValidationError("Choose a cash account in this ledger.");
  // Repeated clicks cannot gradually turn the lightweight fixture into a stress fixture.
  const marker = `quick-sample-v1:${input.memberId}:${input.visibility}`;
  const reversed = new Set(h.transactions.map(t => t.reversalOfId).filter(Boolean));
  if (h.transactions.some(t => t.sourceId === marker && !reversed.has(t.id) && !t.reversalOfId)) throw new ValidationError("This ledger already has quick sample data from you. Undo that addition before adding another set.");
  if (h.transactions.length > 2000) throw new ValidationError("This ledger already has plenty of history. Use a smaller Development ledger for quick samples.");
  const today = input.today.trim();
  parseDateKey(today);
  const currentMonth = monthKeyFromDateKey(today);
  const firstMonth = shiftMonthKey(currentMonth, 1 - input.months);
  if (h.kitchen.books.closedMonths.some(p => p.monthKey >= firstMonth && p.monthKey <= currentMonth)) throw new ValidationError("The sample period includes closed books. Choose another Development ledger with open months.");
  const categories = h.categories.filter(c => c.active && c.recordType === "category");
  const income = categories.find(c => c.transactionType === "income" && /salary|pay|wages/i.test(c.name)) ?? categories.find(c => c.transactionType === "income");
  const expenses = categories.filter(c => c.transactionType === "expense");
  if (!income || !expenses.length) throw new ValidationError("Add an income category and an expense category first.");
  const random = createDemoRandom(input.seed, "quick-sample-v1");
  const rows: Parameters<typeof postEntry>[1][] = [];
  const patterns = [
    { match: /rent|housing/i, note: "Rent", amount: 145000, days: [1], spread: 0 },
    { match: /electric|utilities|phone/i, note: "Utilities", amount: 11500, days: [5], spread: .12 },
    { match: /grocer/i, note: "Groceries", amount: 9200, days: [3, 10, 17, 24], spread: .25 },
    { match: /coffee|lunch/i, note: "Coffee & lunch", amount: 1600, days: [4, 11, 18, 25], spread: .35 },
    { match: /transit|fuel|transport/i, note: "Transport", amount: 4800, days: [8, 22], spread: .2 },
    { match: /fun|dining|entertain/i, note: "A night out", amount: 6500, days: [12, 26], spread: .3 },
  ];
  for (let index = 0; index < input.months; index++) {
    const month = shiftMonthKey(firstMonth, index);
    const lastDay = month === currentMonth ? Number(today.slice(8)) : 28;
    const add = (day: number, amountCents: number, type: "income" | "expense", subcategoryId: string, note: string) => rows.push({
      date: `${month}-${String(Math.min(day, lastDay)).padStart(2, "0")}`, type, amount: (amountCents / 100).toFixed(2),
      accountId: input.accountId, subcategoryId, note: `Fictional sample · ${note}`, source: "manual", sourceId: marker,
      createdBy: input.memberId, visibility: input.visibility === "personal" ? "personal" : "household", confirmDuplicate: true,
      splits: [{ party: input.visibility === "personal" ? input.memberId : JOINT, amountCents }],
    });
    for (const day of [1, 15]) add(day, 180000 + Math.round(random() * 15000), "income", income.id, "Paycheque");
    patterns.forEach((p, i) => {
      const category = expenses.find(c => p.match.test(c.name)) ?? expenses[i % expenses.length]!;
      for (const day of p.days) add(day, Math.round(p.amount * (1 + (random() * 2 - 1) * p.spread)), "expense", category.id, p.note);
    });
  }
  return { rows, firstDate: `${firstMonth}-01`, lastDate: today,
    incomeCents: rows.filter(r => r.type === "income").reduce((s, r) => s + Math.round(Number(r.amount) * 100), 0),
    expenseCents: rows.filter(r => r.type === "expense").reduce((s, r) => s + Math.round(Number(r.amount) * 100), 0) };
}

export const addQuickSampleData = captureCommand("addQuickSampleData", function(h: Household, input: QuickSampleInput): CommitResult {
  const preview = previewQuickSampleData(h, input);
  let next = h;
  const postedIds: string[] = [];
  for (const row of preview.rows) {
    const result = postEntry(next, row);
    next = result.household;
    postedIds.push(...result.postedIds);
  }
  return { household: next, postedIds, warnings: [], undo: { id: crypto.randomUUID(), label: `Add ${input.months} months of fictional sample data`, snapshot: h, postedIds, actorMemberId: input.memberId, commandKind: "addQuickSampleData" } };
});

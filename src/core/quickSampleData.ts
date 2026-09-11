import { captureCommand } from "../ledgerSync/capture.ts";
import { addPotentialExpense, postEntry } from "./commands.ts";
import { monthKeyFromDateKey, parseDateKey, shiftMonthKey } from "./calendar.ts";
import { createDemoRandom } from "./demoRandom.ts";
import { JOINT, ValidationError, type Household, type CommitResult } from "./types.ts";

export type QuickSampleInput = {
  /** Omitted means the original replay contract. New reviews explicitly select v1. */
  storyVersion?: 1;
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


const futureSamplePrefix = "Fictional sample plan · ";

/** V2 is a separate command: pending V1 confirmations must replay unchanged. */
export function previewQuickSampleScenario(h: Household, input: QuickSampleInput) {
  if (input.storyVersion !== undefined && input.storyVersion !== 1) throw new ValidationError("Unsupported sample story version.");
  const today = input.today.trim();
  parseDateKey(today);
  const currentMonth = monthKeyFromDateKey(today);
  const marker = `quick-sample-v1:${input.memberId}:${input.visibility}`;
  const reversed = new Set(h.transactions.map(t => t.reversalOfId).filter(Boolean));
  const existing = h.transactions.some(t => t.sourceId === marker && !t.reversalOfId && !reversed.has(t.id));
  if (h.transactions.length > 2000 || (h.potentialExpenses ?? []).length > 500) throw new ValidationError("This ledger already has plenty of history or plans. Use a smaller Development ledger for quick samples.");
  if ((h.potentialExpenses ?? []).some(p => p.status !== "removed" && p.createdBy === input.memberId && p.visibility === input.visibility && p.title.startsWith(futureSamplePrefix))) throw new ValidationError("This ledger already has your fictional future plans. Remove the unposted set in Calendar before replacing it; posted plans cannot be regenerated.");
  // Generate full-month templates, then partition by actual occurrence date.
  // The legacy pure generator validates the actor, catalog, scope and bounds.
  const templateHousehold = { ...h, transactions: [], kitchen: { ...h.kitchen, books: { ...h.kitchen.books, closedMonths: existing ? [] : h.kitchen.books.closedMonths } } };
  const history = previewQuickSampleData(templateHousehold, { ...input, today: `${currentMonth}-28` });
  let rows = existing ? [] : history.rows.filter(r => r.date <= today);
  const endMonth = shiftMonthKey(currentMonth, input.months);
  const [year, month] = endMonth.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year!, month!, 0)).getUTCDate();
  const futureEnd = `${endMonth}-${String(Math.min(Number(today.slice(8)), lastDay)).padStart(2, "0")}`;
  const futureTemplates = previewQuickSampleData({ ...templateHousehold, kitchen: { ...templateHousehold.kitchen, books: { ...templateHousehold.kitchen.books, closedMonths: [] } } }, { ...input, today: `${endMonth}-28` });
  const story = input.storyVersion === 1 && !existing ? quickSampleStory(h, input, history.firstDate, futureEnd) : null;
  if (story) rows = existing ? [] : story.rows.filter(r => r.date <= today);
  const plans: Parameters<typeof addPotentialExpense>[1][] = (story?.rows ?? [...history.rows, ...futureTemplates.rows])
    .filter(r => r.type === "expense" && r.date > today && r.date <= futureEnd)
    .map(r => ({ date: r.date, title: (r.note ?? "Fictional sample · Expense").replace("Fictional sample · ", futureSamplePrefix), amount: r.amount,
      accountId: input.accountId, subcategoryId: r.subcategoryId, splits: r.splits, createdBy: input.memberId, visibility: input.visibility }));
  return { rows, plans, existing, storySummary: story?.summary ?? null, firstDate: history.firstDate, lastDate: today, futureEnd,
    incomeCents: rows.filter(r => r.type === "income").reduce((s, r) => s + Math.round(Number(r.amount) * 100), 0),
    expenseCents: rows.filter(r => r.type === "expense").reduce((s, r) => s + Math.round(Number(r.amount) * 100), 0),
    plannedCents: plans.reduce((s, p) => s + Math.round(Number(p.amount) * 100), 0) };
}

export const addQuickSampleScenario = captureCommand("addQuickSampleScenario", function(h: Household, input: QuickSampleInput): CommitResult {
  const preview = previewQuickSampleScenario(h, input);
  let next = h;
  const postedIds: string[] = [];
  for (const row of preview.rows) {
    const result = postEntry(next, row);
    next = result.household;
    postedIds.push(...result.postedIds);
  }
  for (const plan of preview.plans) {
    const result = addPotentialExpense(next, plan);
    next = result.household;
    postedIds.push(...result.postedIds);
  }
  return { household: next, postedIds, warnings: [], undo: { id: crypto.randomUUID(), label: `Add ${input.months} months of fictional history and future plans`, snapshot: h, postedIds, actorMemberId: input.memberId, commandKind: "addQuickSampleScenario" } };
});


/** A bounded household arc. Randomness belongs to a dated occurrence, never to
 * iteration order: within a reviewed story month, the same bill is identical
 * on either side of today's cut. The input today anchors that story for replay. */
function quickSampleStory(h: Household, input: QuickSampleInput, firstDate: string, futureEnd: string) {
  const categories = h.categories.filter(c => c.active && c.recordType === "category");
  const incomes = categories.filter(c => c.transactionType === "income");
  const income = incomes.find(c => c.incomeStability === "fixed") ?? incomes[0]!;
  const expenses = categories.filter(c => c.transactionType === "expense");
  const currentMonth = monthKeyFromDateKey(input.today.trim());
  const setbackMonth = shiftMonthKey(currentMonth, -1);
  const rows: Parameters<typeof postEntry>[1][] = [];
  const missing: string[] = [];
  const patterns = [
    { match: /rent|housing/i, label: "Rent", base: 185000, days: [1], variation: 0 },
    { match: /electric|utilities/i, label: "Electric bill", base: 10500, days: [5], variation: .06 },
    { match: /grocer/i, label: "Weekly groceries", base: 12500, days: [3, 10, 17, 24], variation: .06 },
    { match: /coffee|lunch/i, label: "Coffee & lunches", base: 3200, days: [4, 11, 18, 25], variation: .08 },
    { match: /transit|fuel|transport/i, label: "Transport", base: 6500, days: [8, 22], variation: .05 },
    { match: /fun|dining|entertain/i, label: "Evening out", base: 12500, days: [12, 26], variation: .08 },
    { match: /phone/i, label: "Phone bill", base: 8500, days: [20], variation: 0 },
  ].map(p => {
    const category = expenses.find(c => p.match.test(c.name));
    if (!category) missing.push(p.label);
    return { ...p, category };
  });
  const dental = expenses.find(c => /dental/i.test(c.name));
  if (!dental) missing.push("Dental visit and follow-up");
  const jitter = (key: string) => createDemoRandom(input.seed, `quick-story-v1:${key}`)();
  const pay = 205000 + Math.round(jitter("pay") * 150) * 100;
  const add = (month: string, day: number, cents: number, type: "income" | "expense", categoryId: string, note: string) => {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    if (date < firstDate || date > futureEnd) return;
    rows.push({ date, type, amount: (cents / 100).toFixed(2), accountId: input.accountId,
      subcategoryId: categoryId, note: `Fictional sample · ${note}`, source: "manual",
      sourceId: `quick-sample-v1:${input.memberId}:${input.visibility}`, createdBy: input.memberId,
      visibility: input.visibility, confirmDuplicate: true,
      splits: [{ party: input.visibility === "personal" ? input.memberId : JOINT, amountCents: cents }],
    });
  };
  for (let month = firstDate.slice(0, 7); month <= futureEnd.slice(0, 7); month = shiftMonthKey(month, 1)) {
    // Two equal take-home pays; no invented second member, employer or shift.
    for (const day of [1, 15]) add(month, day, pay, "income", income.id, "Regular take-home pay");
    const recovering = month >= currentMonth;
    for (const p of patterns) {
      if (!p.category) continue;
      const groceries = p.label === "Weekly groceries";
      const discretionary = p.label === "Coffee & lunches" || p.label === "Evening out";
      const factor = groceries ? (month === setbackMonth ? 1.16 : recovering ? .88 : 1)
        : discretionary && recovering ? .55 : 1;
      const season = p.label === "Electric bill" && ["12", "01", "02", "07", "08"].includes(month.slice(5)) ? 1.18 : 1;
      for (const day of p.days) {
        const cents = Math.round(p.base * factor * season * (1 + (jitter(`${month}:${day}:${p.label}`) * 2 - 1) * p.variation));
        const note = groceries && recovering ? "Weekly groceries — meal plan" : discretionary && recovering ? `${p.label} — smaller budget` : p.label;
        add(month, day, cents, "expense", p.category.id, note);
      }
    }
    if (dental && month === setbackMonth) add(month, 19, 145000, "expense", dental.id, "Unexpected dental treatment");
    if (dental && month === shiftMonthKey(currentMonth, 1)) add(month, 19, 18000, "expense", dental.id, "Dental follow-up — planned after treatment");
  }
  rows.sort((a, b) => a.date.localeCompare(b.date) || (a.type === b.type ? 0 : a.type === "income" ? -1 : 1));
  const has = (label: string) => patterns.some(p => p.label === label && p.category);
  const recovery = [has("Weekly groceries") ? "meal planning" : "", has("Coffee & lunches") || has("Evening out") ? "smaller outings" : ""].filter(Boolean);
  const bills = patterns.filter(p => p.category && ["Rent", "Electric bill", "Phone bill"].includes(p.label)).map(p => p.label.toLowerCase());
  const summary = `Steady twice-monthly take-home pay.${bills.length ? ` Regular ${bills.join(", ")}.` : ""} ${dental ? `An unexpected dental bill in ${setbackMonth}, followed by a planned check in ${shiftMonthKey(currentMonth, 1)}. ` : ""}${recovery.length ? `From ${currentMonth}, ${recovery.join(" and ")} reduce spending. ` : ""}Future expenses are estimates; future pay is not posted or promised.${missing.length ? ` Skipped because matching categories are missing: ${missing.join(", ")}.` : ""}${input.visibility === "household" ? " Fund contributions and card funding stay unchanged; an account surplus is not Fund cash." : " This story stays in your Personal ledger."}`;
  return { rows, summary };
}

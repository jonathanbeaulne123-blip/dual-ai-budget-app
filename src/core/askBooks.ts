import { addDays, monthKeyFromDateKey, type DateKey } from "./calendar.ts";
import { monthSummary, weekSummary } from "./budget.ts";
import { runHealthCheck } from "./health.ts";
import { formatCad } from "./money.ts";
import { accountRegister, compileHousehold } from "./journal.ts";
import { categoryName } from "./ledgerView.ts";
import type { Household } from "./types.ts";

export type BooksAskRow = { label: string; value: string };

export type BooksAsk = {
  kind: "answer" | "help";
  sentence: string;
  rows: BooksAskRow[];
  sql?: string;
  suggestions?: string[];
};

export const ASK_SUGGESTIONS = [
  "Groceries this month",
  "Bills due",
  "Who spent more this week",
  "This week vs last week",
  "How much is in chequing",
  "Are we alright",
  "Goals",
  "Coffee this week",
];

function normalize(question: string): string {
  return question
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeWeek(question: string): boolean {
  return /\bweek\b/.test(question);
}

function categorySpend(household: Household, subcategoryId: string, start: DateKey, end: DateKey): number {
  return household.transactions.reduce((sum, tx) => {
    if (tx.subcategoryId !== subcategoryId) return sum;
    if (tx.date < start || tx.date > end) return sum;
    if (tx.isDuplicate) return sum;
    if (tx.type === "expense") return sum + tx.amountCents;
    if (tx.type === "refund") return sum - tx.amountCents;
    return sum;
  }, 0);
}

function accountBalance(household: Household, accountId: string): number {
  const books = compileHousehold(household);
  const rows = accountRegister(books, accountId, { recognizedOnly: true });
  return rows[rows.length - 1]?.runningCents ?? 0;
}

function help(extra?: string): BooksAsk {
  return {
    kind: "help",
    sentence: extra || "Ask in plain language. The books will answer. SQL is optional.",
    rows: [],
    suggestions: ASK_SUGGESTIONS,
  };
}

export function askBooks(household: Household, question: string, today: DateKey): BooksAsk {
  const raw = question.trim();
  if (!raw) return help();
  const q = normalize(raw);
  const monthKey = monthKeyFromDateKey(today);
  const month = monthSummary(household, monthKey);
  const week = weekSummary(household, today);
  const weekStart = week.start;
  const monthStart = `${monthKey}-01`;
  const rangeStart = looksLikeWeek(q) ? weekStart : monthStart;
  const rangeLabel = looksLikeWeek(q) ? "this week" : "this month";

  if (/\b(help|what can i ask|examples)\b/.test(q)) return help();

  if (/\b(health|alright|all right|okay|ok\b|in balance|trial)\b/.test(q) || q === "are we alright") {
    const findings = runHealthCheck(household);
    const gap = month.householdCoverageGapCents;
    const rows: BooksAskRow[] = findings.length
      ? findings.slice(0, 8).map((finding) => ({ label: finding.section, value: finding.message }))
      : [
        { label: "Health", value: "Clean" },
        { label: "Net this month", value: formatCad(month.netActualCents) },
        { label: "Safety gap", value: formatCad(gap) },
      ];
    return {
      kind: "answer",
      sentence: findings.length
        ? `Health has ${findings.length} finding${findings.length === 1 ? "" : "s"}. Nothing posts itself.`
        : gap >= 0
          ? `The books are clean. Essentials are covered, with ${formatCad(gap)} of fixed income still free.`
          : `The books are clean, but fixed income is ${formatCad(-gap)} short of essentials this month.`,
      rows,
      sql: "SELECT * FROM v_unbalanced_entries LIMIT 20",
    };
  }

  if (/\b(bill|due|upcoming|rent|hydro|phone)\b/.test(q) && !/\b(spent|spend|grocer)\b/.test(q)) {
    const horizon = addDays(today, 14);
    const due = household.recurrences
      .filter((item) => item.active && item.nextDate <= horizon)
      .sort((left, right) => left.nextDate.localeCompare(right.nextDate));
    if (!due.length) {
      return { kind: "answer", sentence: "Nothing repeating is due in the next two weeks.", rows: [] };
    }
    return {
      kind: "answer",
      sentence: `${due.length} repeating ${due.length === 1 ? "item is" : "items are"} due by ${horizon}. Calendar still does not post money.`,
      rows: due.map((item) => ({
        label: `${item.nextDate} · ${item.note || "Recurring"}`,
        value: formatCad(item.amountCents),
      })),
    };
  }

  if (/\b(goal|saving|emergency|trip fund)\b/.test(q)) {
    if (!household.goals.length) return { kind: "answer", sentence: "No goals yet. Add one from Plan.", rows: [] };
    return {
      kind: "answer",
      sentence: household.goals.map((goal) => {
        const pct = goal.targetCents ? Math.round((goal.savedCents / goal.targetCents) * 100) : 0;
        return `${goal.name} is ${pct}% (${formatCad(goal.savedCents)} of ${formatCad(goal.targetCents)}).`;
      }).join(" "),
      rows: household.goals.map((goal) => ({
        label: goal.name,
        value: `${formatCad(goal.savedCents)} / ${formatCad(goal.targetCents)}`,
      })),
    };
  }

  if (/\b(who spent|who paid|split this week|bianca vs|jonathan vs)\b/.test(q) || (/\bwho\b/.test(q) && /\bspent\b/.test(q))) {
    const parties = week.byParty.filter((party) => party.amountCents);
    if (!parties.length) return { kind: "answer", sentence: "Nobody has spend posted this week yet.", rows: [] };
    const top = [...parties].sort((left, right) => right.amountCents - left.amountCents)[0]!;
    return {
      kind: "answer",
      sentence: `${top.name} has the most posted spend this week at ${formatCad(top.amountCents)}.`,
      rows: parties.map((party) => ({ label: party.name, value: formatCad(party.amountCents) })),
    };
  }

  if (/\b(this week vs|versus last|vs last|compared to last)\b/.test(q) || (/\bthis week\b/.test(q) && /\blast week\b/.test(q))) {
    const delta = week.expenseCents - week.lastWeekExpenseCents;
    const sentence = delta === 0
      ? `This week matches last week at ${formatCad(week.expenseCents)}.`
      : delta > 0
        ? `This week is ${formatCad(delta)} hotter than last week (${formatCad(week.expenseCents)} vs ${formatCad(week.lastWeekExpenseCents)}).`
        : `This week is ${formatCad(-delta)} quieter than last week (${formatCad(week.expenseCents)} vs ${formatCad(week.lastWeekExpenseCents)}).`;
    return {
      kind: "answer",
      sentence,
      rows: [
        { label: "This week", value: formatCad(week.expenseCents) },
        { label: "Last week", value: formatCad(week.lastWeekExpenseCents) },
      ],
    };
  }

  if (/\b(chequing|checking|visa|cash|balance|how much (do we|is) (in|left)|envelope|net worth)\b/.test(q)) {
    const wantVisa = /\bvisa|card\b/.test(q);
    const wantCash = /\bcash|tips\b/.test(q);
    const accounts = household.accounts.filter((account) => {
      if (wantVisa) return account.kind === "credit";
      if (wantCash) return account.kind === "cash";
      if (/\bchequ|check/.test(q)) return account.kind === "chequing";
      return true;
    });
    const targets = wantVisa || wantCash || /\bchequ|check/.test(q)
      ? accounts
      : household.accounts.filter((account) => account.active);
    const rows = targets.map((account) => ({
      label: account.name,
      value: formatCad(accountBalance(household, account.id)),
    }));
    return {
      kind: "answer",
      sentence: rows.length === 1
        ? `${rows[0]!.label} is ${rows[0]!.value} on the books.`
        : "Here are the household accounts on the books. Credit is what you still owe.",
      rows,
      sql: "SELECT code, name, account_type, debit_cents, credit_cents FROM v_trial_balance ORDER BY code",
    };
  }

  if (/\b(net|this month|how did we do|income|spent this month)\b/.test(q) && !/\b(grocer|coffee|rent)\b/.test(q)) {
    return {
      kind: "answer",
      sentence: `${monthKey}: ${formatCad(month.incomeActualCents)} in, ${formatCad(month.expenseActualCents)} out, net ${formatCad(month.netActualCents)}.`,
      rows: [
        { label: "Income", value: formatCad(month.incomeActualCents) },
        { label: "Spend", value: formatCad(month.expenseActualCents) },
        { label: "Net", value: formatCad(month.netActualCents) },
      ],
      sql: "SELECT * FROM v_income_statement LIMIT 20",
    };
  }

  const categories = household.categories.filter((category) => category.recordType === "category" && category.active);
  const named = categories.find((category) => q.includes(category.name.toLowerCase()));
  if (named || /\b(grocer|coffee|spend on|how much .* (on|for))\b/.test(q)) {
    const category = named
      || categories.find((item) => item.id === "SUB-FOOD-GROCERIES" && /\bgrocer/.test(q))
      || categories.find((item) => /coffee/i.test(item.name) && /\bcoffee/.test(q));
    if (category) {
      const cents = categorySpend(household, category.id, rangeStart, today);
      const plan = month.categories.find((row) => row.subcategoryId === category.id);
      const rows: BooksAskRow[] = [{ label: `${category.name} ${rangeLabel}`, value: formatCad(cents) }];
      if (plan && !looksLikeWeek(q) && plan.budgetedCents) {
        rows.push({ label: "Plan this month", value: formatCad(plan.budgetedCents) });
        rows.push({
          label: plan.actualCents > plan.budgetedCents ? "Over" : "Left",
          value: formatCad(Math.abs(plan.budgetedCents - plan.actualCents)),
        });
      }
      return {
        kind: "answer",
        sentence: `${category.name} is ${formatCad(cents)} ${rangeLabel}.`,
        rows,
      };
    }
  }

  const placeHit = household.transactions.find((tx) => tx.place && q.includes(tx.place.toLowerCase()));
  if (placeHit?.place) {
    const cents = household.transactions.reduce((sum, tx) => {
      if (tx.place.toLowerCase() !== placeHit.place.toLowerCase()) return sum;
      if (tx.date < rangeStart || tx.date > today || tx.isDuplicate) return sum;
      if (tx.type === "expense") return sum + tx.amountCents;
      if (tx.type === "refund") return sum - tx.amountCents;
      return sum;
    }, 0);
    return {
      kind: "answer",
      sentence: `${placeHit.place} is ${formatCad(cents)} ${rangeLabel}.`,
      rows: [{ label: placeHit.place, value: formatCad(cents) }],
    };
  }

  const noteHit = household.transactions.find((tx) => tx.note && q.includes(tx.note.toLowerCase()) && tx.note.length > 3);
  if (noteHit) {
    return {
      kind: "answer",
      sentence: `Latest “${noteHit.note}” is ${formatCad(noteHit.amountCents)} on ${noteHit.date} (${categoryName(household, noteHit.subcategoryId)}).`,
      rows: [{ label: noteHit.date, value: formatCad(noteHit.amountCents) }],
    };
  }

  return help("I did not catch that. Try a category, an account, bills, or “are we alright”.");
}

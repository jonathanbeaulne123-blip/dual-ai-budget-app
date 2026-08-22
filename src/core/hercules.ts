import { addDays, hourInToronto, monthKeyFromDateKey, weekBounds, weekdaySunday0, type DateKey } from "./calendar.ts";
import { monthSummary, weekSummary } from "./budget.ts";
import { askBooks, type BooksAsk } from "./askBooks.ts";
import { companionMood, describeCompanion } from "./companion.ts";
import { formatCad } from "./money.ts";
import { auditOpinion, agedPayables, balanceSheet, cashFlowStatement, comparativeIncome, incomeStatement, liquidityWatch, notesToFinancialStatements, statementOfChangesInEquity, subsequentEvents } from "./statements.ts";
import { booksEquation, compileHousehold, trialBalance } from "./journal.ts";
import type { Household } from "./types.ts";

export const DEFAULT_COMPANION_NAME = "Hercules";
export const SHIFT_FORECAST_WEEKS = 8;

export type HearthTab = "home" | "plan" | "calendar" | "ledger" | "more" | "add";

export type KettlePhase = "morning" | "after-shift" | "sunday" | "evening";

export function kettlePhase(today: DateKey, hour: number): KettlePhase {
  if (weekdaySunday0(today) === 0 && hour >= 9 && hour < 18) return "sunday";
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 14 && hour < 19) return "after-shift";
  return "evening";
}

export function groceryHighFive(household: Household, today: DateKey): { yes: boolean; names: string[] } {
  const posters = new Set<string>();
  for (const tx of household.transactions) {
    if (tx.isDuplicate) continue;
    if (tx.date !== today) continue;
    if (tx.type !== "expense") continue;
    if (tx.subcategoryId !== "SUB-FOOD-GROCERIES") continue;
    posters.add(tx.createdBy);
  }
  const names = household.members
    .filter((member) => member.active && posters.has(member.id))
    .map((member) => member.name);
  return { yes: names.length >= 2, names };
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

export type CookOffScore = {
  groceryCents: number;
  coffeeCents: number;
  winner: "kitchen" | "takeout" | "tie";
  sentence: string;
};

/** Household groceries vs coffee & lunches. Never names a person. */
export function cookOffScore(household: Household, today: DateKey): CookOffScore {
  const week = weekBounds(today);
  const groceryCents = categorySpend(household, "SUB-FOOD-GROCERIES", week.start, week.end);
  const coffeeCents = categorySpend(household, "SUB-FOOD-COFFEE", week.start, week.end);
  const winner = groceryCents === coffeeCents ? "tie" : groceryCents > coffeeCents ? "kitchen" : "takeout";
  const sentence = winner === "kitchen"
    ? `Groceries ${formatCad(groceryCents)} beat coffee & lunches ${formatCad(coffeeCents)}. The kitchen is winning. Not a scoreboard of people.`
    : winner === "takeout"
      ? `Coffee & lunches ${formatCad(coffeeCents)} are ahead of groceries ${formatCad(groceryCents)}. Cook something loud. Still not a shame board.`
      : `Groceries and coffee & lunches are tied at ${formatCad(groceryCents)}. Hercules shrugs.`;
  return { groceryCents, coffeeCents, winner, sentence };
}

export type SitDownPostcard = {
  ready: boolean;
  text: string;
  sentence: string;
  sourceMonth: string;
  targetMonth: string;
};

export function sitDownPostcard(household: Household): SitDownPostcard {
  const row = [...household.activity].reverse().find((item) => item.action === "Monthly Sit-Down");
  if (!row) {
    return {
      ready: false,
      text: "",
      sentence: "No sit-down yet. Plan → Apply next month’s plan is the close. The postcard is not money.",
      sourceMonth: "",
      targetMonth: "",
    };
  }
  const match = /Planned (\d{4}-\d{2}) from (\d{4}-\d{2})/.exec(row.summary);
  const targetMonth = match?.[1] ?? "";
  const sourceMonth = match?.[2] ?? "";
  const text = sourceMonth && targetMonth
    ? `We closed ${sourceMonth} → ${targetMonth}.`
    : "We closed the sit-down.";
  return {
    ready: true,
    text: text.slice(0, 80),
    sentence: `${row.summary}. Pin this to the chalkboard if both phones should see it. Not a ledger write.`,
    sourceMonth,
    targetMonth,
  };
}

export type WeekRecap = {
  isSunday: boolean;
  sentence: string;
  rows: { label: string; value: string }[];
};

export function weekRecap(household: Household, today: DateKey): WeekRecap {
  const isSunday = weekdaySunday0(today) === 0;
  const week = weekSummary(household, today);
  const five = groceryHighFive(household, today);
  const name = household.kitchen.companion.name || DEFAULT_COMPANION_NAME;
  const delta = week.expenseCents - week.lastWeekExpenseCents;
  const hotter = delta > 0 ? `${formatCad(delta)} hotter than last week` : `${formatCad(-delta)} cooler than last week`;
  const rows = [
    { label: "This week out", value: formatCad(week.expenseCents) },
    { label: "vs last week", value: hotter },
    { label: "In", value: formatCad(week.incomeCents) },
  ];
  if (five.yes) rows.push({ label: "High-five", value: five.names.join(" + ") });
  const cook = cookOffScore(household, today);
  rows.push({ label: "Cook-off", value: cook.winner === "kitchen" ? "kitchen" : cook.winner === "takeout" ? "coffee & lunches" : "tie" });
  return {
    isSunday,
    sentence: isSunday
      ? `${name}’s Sunday envelope. Screenshot this, then go live your life. Twenty seconds is enough.`
      : `${name} can still print this week’s envelope. Sunday is when it auto-opens.`,
    rows,
  };
}

export function postedShiftWeekStarts(household: Household): DateKey[] {
  const weeks = new Set<string>();
  for (const shift of household.shifts) {
    weeks.add(weekBounds(shift.date).start);
  }
  return [...weeks].sort();
}

export type ShiftForecast = {
  unlocked: boolean;
  weeksPosted: number;
  needed: number;
  avgTipsCents: number;
  avgWagesCents: number;
  lowCents: number;
  highCents: number;
  sentence: string;
};

/** Trailing average of posted-shift weeks. Display only — never a journal row. */
export function shiftForecastDisplay(household: Household): ShiftForecast {
  const weeks = postedShiftWeekStarts(household);
  const needed = SHIFT_FORECAST_WEEKS;
  if (weeks.length < needed) {
    return {
      unlocked: false,
      weeksPosted: weeks.length,
      needed,
      avgTipsCents: 0,
      avgWagesCents: 0,
      lowCents: 0,
      highCents: 0,
      sentence: `${weeks.length} of ${needed} posted-shift weeks. Hercules will not invent a tip number until the journal is thick enough.`,
    };
  }
  const last = weeks.slice(-needed);
  const totals = last.map((start) => {
    const end = addDays(start, 6);
    let tips = 0;
    let wages = 0;
    for (const shift of household.shifts) {
      if (shift.date < start || shift.date > end) continue;
      tips += shift.netTipsCents;
      wages += shift.wagesCents;
    }
    return { tips, wages, all: tips + wages };
  });
  const avgTipsCents = Math.round(totals.reduce((sum, row) => sum + row.tips, 0) / totals.length);
  const avgWagesCents = Math.round(totals.reduce((sum, row) => sum + row.wages, 0) / totals.length);
  const lowCents = Math.min(...totals.map((row) => row.all));
  const highCents = Math.max(...totals.map((row) => row.all));
  return {
    unlocked: true,
    weeksPosted: weeks.length,
    needed,
    avgTipsCents,
    avgWagesCents,
    lowCents,
    highCents,
    sentence: `Last ${needed} posted-shift weeks averaged ${formatCad(avgTipsCents)} tips and ${formatCad(avgWagesCents)} wages. Range ${formatCad(lowCents)}–${formatCad(highCents)}. Display only. He will not post this.`,
  };
}

function normalize(question: string): string {
  return question
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function voice(name: string, ask: BooksAsk): BooksAsk {
  if (ask.kind === "help") {
    return {
      ...ask,
      sentence: `${name} reads. He doesn't write. Ask a number.`,
    };
  }
  return ask;
}

function identityAnswer(household: Household, today: DateKey): BooksAsk {
  const view = describeCompanion(household, today);
  const opinion = auditOpinion(household);
  return {
    kind: "answer",
    sentence: `I'm ${view.name}. Auditor on the counter. I read the books. I don't write them.`,
    rows: [
      { label: "Mood", value: view.mood },
      { label: "Opinion", value: opinion.kind },
      { label: "Role", value: "auditor on the counter" },
    ],
  };
}

function coachAnswer(household: Household, today: DateKey, name: string): BooksAsk {
  const { mood, reason } = companionMood(household, today, name);
  if (mood === "hiding") {
    return {
      kind: "answer",
      sentence: `Health first. ${reason}`,
      rows: [{ label: "Next", value: "Health" }],
    };
  }
  if (mood === "restless") {
    return {
      kind: "answer",
      sentence: `${reason} Mark paid, then confirm.`,
      rows: [{ label: "Next", value: "Calendar" }],
    };
  }
  return {
    kind: "answer",
    sentence: `Milk. Ordinary. That's the whole sport. ${reason}`,
    rows: [{ label: "Next", value: "Post milk" }],
  };
}

function skipAnswer(household: Household, today: DateKey): BooksAsk {
  const month = monthSummary(household, monthKeyFromDateKey(today));
  const rows = month.categories
    .filter((row) => row.type === "expense" && !row.essential && row.budgetedCents > row.actualCents)
    .map((row) => ({
      label: row.name,
      leftover: row.budgetedCents - row.actualCents,
    }))
    .sort((left, right) => right.leftover - left.leftover)
    .slice(0, 4)
    .map((row) => ({ label: row.label, value: `${formatCad(row.leftover)} still in plan` }));
  if (!rows.length) {
    return {
      kind: "answer",
      sentence: "Nothing discretionary is obviously under plan. That is not a dare to spend. It is a shrug.",
      rows: [],
    };
  }
  return {
    kind: "answer",
    sentence: `${rows[0]!.label} still has room. Not a dare. Just a shrug.`,
    rows,
  };
}

function shiftAnswer(household: Household, today: DateKey): BooksAsk {
  const week = weekSummary(household, today);
  const shifts = household.shifts.filter((shift) => shift.date >= week.start && shift.date <= week.end);
  if (!shifts.length) {
    return { kind: "answer", sentence: "No shifts posted this week yet.", rows: [] };
  }
  const tips = shifts.reduce((sum, shift) => sum + shift.netTipsCents, 0);
  const wages = shifts.reduce((sum, shift) => sum + shift.wagesCents, 0);
  const hours = shifts.reduce((sum, shift) => sum + shift.hours, 0);
  return {
    kind: "answer",
    sentence: `${shifts.length} shift${shifts.length === 1 ? "" : "s"} this week: ${formatCad(wages)} wages, ${formatCad(tips)} net tips, ${hours} hours.`,
    rows: shifts.map((shift) => {
      const who = household.members.find((member) => member.id === shift.memberId)?.name ?? shift.memberId;
      return { label: `${shift.date} · ${who}`, value: formatCad(shift.netTipsCents + shift.wagesCents) };
    }),
  };
}

export function herculesPageBrief(
  household: Household,
  tab: HearthTab,
  today: DateKey,
  now = new Date(),
): string {
  const name = household.kitchen.companion.name || DEFAULT_COMPANION_NAME;
  const phase = kettlePhase(today, hourInToronto(now));
  const highFive = groceryHighFive(household, today);
  if (highFive.yes) return `${highFive.names.join(" and ")} both bought food. High-five.`;
  if (tab === "add") return `${name} will loaf. You confirm.`;
  if (tab === "calendar") return "Dates remind. Mark paid writes.";
  if (tab === "plan") return "Sit-down copies last month. In dollars.";
  if (tab === "ledger") return "Fieldwork. I walk the journal. I don't write it.";
  if (tab === "more") return "Health is the adult screen. I hide when it's dirty.";
  if (phase === "morning") return `${name} stretched. Milk whenever.`;
  if (phase === "after-shift") return `${name} wants tip math, not vibes.`;
  if (phase === "sunday") return `${name} wants a sit-down, not a lecture.`;
  return describeCompanion(household, today).reason;
}

export const HERCULES_CHIPS = [
  "We good?",
  "Opinion?",
  "Working capital?",
  "What's on the Visa?",
  "What now?",
];

export function askHercules(household: Household, question: string, today: DateKey): BooksAsk {
  const name = household.kitchen.companion.name || DEFAULT_COMPANION_NAME;
  const q = normalize(question);
  if (!q) {
    return voice(name, {
      kind: "help",
      sentence: "Ask in plain language. I will answer from the journal.",
      rows: [],
      suggestions: HERCULES_CHIPS,
    });
  }
  if (/\b(who are you|what are you|your name|maine coon|you a cat|hercules|ember)\b/.test(q) && !/\b(spent|bill|goal)\b/.test(q)) {
    return identityAnswer(household, today);
  }
  if (/\b(we good|you good|hey cat)\b/.test(q)) {
    return askHercules(household, "are we alright", today);
  }
  if (/\b(opinion|unmodified|qualified|adverse|audit|are the books clean|trial balance|in balance)\b/.test(q) && !/\b(spent|grocery)\b/.test(q)) {
    const opinion = auditOpinion(household);
    const books = compileHousehold(household);
    const trial = trialBalance(books, { recognizedOnly: true });
    const equation = booksEquation(books);
    return {
      kind: "answer",
      sentence: opinion.hercules,
      rows: [
        { label: "Opinion", value: opinion.kind },
        { label: "Trial", value: trial.inBalance ? `${formatCad(trial.totalDebitCents)} dr = cr` : "off" },
        { label: "Equation", value: equation.holds ? "A = L + E" : "off" },
        { label: "Health", value: opinion.healthFindings ? `${opinion.healthFindings} findings` : "clean" },
      ],
    };
  }
  if (/\b(balance sheet|statement of financial|assets? =|net worth)\b/.test(q)) {
    const sheet = balanceSheet(household);
    return {
      kind: "answer",
      sentence: sheet.holds
        ? `Assets ${formatCad(sheet.assetCents)} equal liabilities ${formatCad(sheet.liabilityCents)} plus equity ${formatCad(sheet.equityCents)}. That's a balance sheet, not a vibe.`
        : `The balance sheet does not hold. Assets ${formatCad(sheet.assetCents)} vs L+E ${formatCad(sheet.liabilityCents + sheet.equityCents)}. Health.`,
      rows: [
        { label: "Assets", value: formatCad(sheet.assetCents) },
        { label: "Liabilities", value: formatCad(sheet.liabilityCents) },
        { label: "Equity", value: formatCad(sheet.equityCents) },
      ],
    };
  }
  if (/\b(working capital|current ratio|liquidity|going concern|are we solvent)\b/.test(q)) {
    const liq = liquidityWatch(household, today);
    const wc = liq.workingCapital;
    return {
      kind: "answer",
      sentence: `${liq.hercules} Working capital ${formatCad(wc.workingCapitalCents)}.`,
      rows: [
        { label: "Working capital", value: formatCad(wc.workingCapitalCents) },
        { label: "Current ratio", value: wc.currentRatio == null ? "n/a" : wc.currentRatio.toFixed(2) },
        { label: "Cash-like", value: formatCad(liq.cashCents) },
        { label: "Bills · 30d", value: formatCad(liq.billsNext30Cents) },
        { label: "Watch", value: liq.goingConcern },
      ],
    };
  }
  if (/\b(changes in equity|retained earnings|opening balance|equity roll)\b/.test(q)) {
    const equity = statementOfChangesInEquity(household, monthKeyFromDateKey(today));
    return {
      kind: "answer",
      sentence: equity.rolls
        ? `Opening ${formatCad(equity.openingCents)} plus net ${formatCad(equity.netIncomeCents)} equals closing ${formatCad(equity.closingCents)}. That's an equity roll, not a vibe.`
        : `The equity roll does not land. Opening ${formatCad(equity.openingCents)} + net ${formatCad(equity.netIncomeCents)} vs closing ${formatCad(equity.closingCents)}. Health.`,
      rows: [
        { label: "Opening", value: formatCad(equity.openingCents) },
        { label: "Net income", value: formatCad(equity.netIncomeCents) },
        { label: "Closing", value: formatCad(equity.closingCents) },
      ],
    };
  }
  if (/\b(compar(e|ative)|last month vs|this vs last|month over month|prior period)\b/.test(q) && !/\bweek\b/.test(q)) {
    const comparative = comparativeIncome(household, monthKeyFromDateKey(today));
    return {
      kind: "answer",
      sentence: `${comparative.monthKey} vs ${comparative.priorKey}: net Δ ${formatCad(comparative.netDeltaCents)}. Comparative, not a roast.`,
      rows: [
        { label: `${comparative.monthKey} net`, value: formatCad(comparative.current.netCents) },
        { label: `${comparative.priorKey} net`, value: formatCad(comparative.prior.netCents) },
        { label: "Income Δ", value: formatCad(comparative.incomeDeltaCents) },
        { label: "Expense Δ", value: formatCad(comparative.expenseDeltaCents) },
      ],
    };
  }
  if (/\b(subsequent events?|after the close|post.?balance sheet)\b/.test(q)) {
    const events = subsequentEvents(household, monthKeyFromDateKey(today), today);
    return {
      kind: "answer",
      sentence: events.hercules,
      rows: [
        { label: "Rows after period", value: String(events.count) },
        { label: "Income after", value: formatCad(events.incomeCents) },
        { label: "Expenses after", value: formatCad(events.expenseCents) },
      ],
    };
  }
  if (/\b(accounting policies|notes to the|basis of presentation|control environment)\b/.test(q)) {
    const notes = notesToFinancialStatements(household, monthKeyFromDateKey(today), today);
    const first = notes[0]!;
    return {
      kind: "answer",
      sentence: `${first.title}: ${first.body}`,
      rows: notes.slice(0, 4).map((note) => ({ label: note.title, value: note.body.slice(0, 80) })),
    };
  }
  if (/\b(p&l|pnl|income statement|profit and loss)\b/.test(q)) {
    const monthKey = monthKeyFromDateKey(today);
    const income = incomeStatement(household, monthKey);
    return {
      kind: "answer",
      sentence: `${monthKey} P&L: in ${formatCad(income.incomeCents)}, out ${formatCad(income.expenseCents)}, net ${formatCad(income.netCents)}. I don't write it.`,
      rows: [
        { label: "Income", value: formatCad(income.incomeCents) },
        { label: "Expenses", value: formatCad(income.expenseCents) },
        { label: "Net", value: formatCad(income.netCents) },
      ],
    };
  }
  if (/\b(cash flow|statement of cash)\b/.test(q)) {
    const cash = cashFlowStatement(household, monthKeyFromDateKey(today));
    return {
      kind: "answer",
      sentence: `Cash in ${formatCad(cash.operatingInCents)}, cash out ${formatCad(cash.operatingOutCents)}, card spend ${formatCad(cash.cardSpendCents)} (not cash until you pay the card). Investing out ${formatCad(cash.investingOutCents)}.`,
      rows: [
        { label: "Operating in", value: formatCad(cash.operatingInCents) },
        { label: "Operating out", value: formatCad(cash.operatingOutCents) },
        { label: "Card spend", value: formatCad(cash.cardSpendCents) },
        { label: "Paydown", value: formatCad(cash.debtPaydownCents) },
        { label: "Investing out", value: formatCad(cash.investingOutCents) },
        { label: "Net cash", value: formatCad(cash.netCashCents) },
      ],
    };
  }
  if (/\b(reconcil|bank rec|tied the books|statement balance)\b/.test(q)) {
    const latest = household.kitchen.books?.reconciliations?.at(-1);
    return {
      kind: "answer",
      sentence: latest
        ? latest.status === "tied"
          ? `Last rec tied on ${latest.statementDate}. Spectacles earned. Still not a bank feed.`
          : `Last rec is open by ${formatCad(Math.abs(latest.differenceCents))}. Find the missing row, then rec again.`
        : "No rec yet. Books → Reconcile. Type the statement. I compare. I don't import the bank.",
      rows: latest
        ? [
          { label: "Statement", value: formatCad(latest.statementCents) },
          { label: "Books", value: formatCad(latest.bookCents) },
          { label: "Δ", value: formatCad(latest.differenceCents) },
        ]
        : [],
    };
  }
  if (/\b(aged|aging|overdue bills|ap aging)\b/.test(q)) {
    const aging = agedPayables(household, today).filter((item) => item.daysOverdue > 0);
    if (!aging.length) {
      return { kind: "answer", sentence: "No overdue bills on the aging. Dates remind. Mark paid writes.", rows: [] };
    }
    return {
      kind: "answer",
      sentence: `${aging.length} overdue ${aging.length === 1 ? "bill sits" : "bills sit"} on the aging. I will not fake a fee.`,
      rows: aging.slice(0, 5).map((item) => ({
        label: `${item.note} · ${item.bucket}`,
        value: formatCad(item.amountCents),
      })),
    };
  }
  if (/\b(close pack|close package|audit pack)\b/.test(q)) {
    const opinion = auditOpinion(household);
    return {
      kind: "answer",
      sentence: `Close pack is on Books. Opinion: ${opinion.kind}. Download it. I don't email a CPA.`,
      rows: [{ label: "Opinion", value: opinion.kind }],
    };
  }
  if (/\b(what.?s on the visa|pay the card|utilization|cashback|rewards|savings account|tfsa)\b/.test(q)) {
    return voice(name, askBooks(household, question, today));
  }
  if (/\b(what should i do|coach|advise|next move|what now)\b/.test(q)) {
    return coachAnswer(household, today, name);
  }
  if (/\b(safe to skip|skip today|under plan|left in dining|smug)\b/.test(q)) {
    return skipAnswer(household, today);
  }
  if (/\b(cook.?off|kitchen vs|grocer(?:y|ies) vs)\b/.test(q)) {
    const cook = cookOffScore(household, today);
    return { kind: "answer", sentence: cook.sentence, rows: [
      { label: "Groceries", value: formatCad(cook.groceryCents) },
      { label: "Coffee & lunches", value: formatCad(cook.coffeeCents) },
    ] };
  }
  if (/\b(sunday recap|sunday envelope|this week.s envelope|screenshot recap)\b/.test(q)) {
    const recap = weekRecap(household, today);
    return { kind: "answer", sentence: recap.sentence, rows: recap.rows };
  }
  if (/\b(postcard|sit-?down close|we closed)\b/.test(q)) {
    const card = sitDownPostcard(household);
    return { kind: "answer", sentence: card.sentence, rows: card.ready
      ? [{ label: "Chalk line", value: card.text }]
      : [] };
  }
  if (/\b(forecast|next month.?s tips|tip forecast|shift pulse)\b/.test(q)) {
    const forecast = shiftForecastDisplay(household);
    return {
      kind: "answer",
      sentence: forecast.sentence,
      rows: forecast.unlocked
        ? [
          { label: "Avg tips / week", value: formatCad(forecast.avgTipsCents) },
          { label: "Avg wages / week", value: formatCad(forecast.avgWagesCents) },
          { label: "Range", value: `${formatCad(forecast.lowCents)}–${formatCad(forecast.highCents)}` },
        ]
        : [{ label: "Weeks posted", value: `${forecast.weeksPosted} / ${forecast.needed}` }],
    };
  }
  if (/\b(shift|tips?|tip-out|wages|hours this week)\b/.test(q) && !/\b(grocer|bill|forecast)\b/.test(q)) {
    return shiftAnswer(household, today);
  }
  return voice(name, askBooks(household, question, today));
}

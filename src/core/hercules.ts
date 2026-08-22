import { addDays, hourInToronto, kitchenSeason, monthKeyFromDateKey, weekBounds, weekdaySunday0, type DateKey } from "./calendar.ts";
import { monthSummary, weekSummary } from "./budget.ts";
import { askBooks, type BooksAsk } from "./askBooks.ts";
import { companionMood, describeCompanion } from "./companion.ts";
import { formatCad } from "./money.ts";
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
      sentence: `${name} only reads the journal. ${ask.sentence} He never posts money.`,
    };
  }
  return ask;
}

function identityAnswer(household: Household, today: DateKey): BooksAsk {
  const view = describeCompanion(household, today);
  const season = kitchenSeason(today);
  return {
    kind: "answer",
    sentence: `I am ${view.name}, a Maine Coon on this kitchen table. I read the books. I do not write them. Ask groceries, bills, tips, or “are we alright.”`,
    rows: [
      { label: "Mood", value: view.mood },
      { label: "Species", value: "Maine Coon" },
      { label: "Season", value: season === "none" ? "shoulder" : season },
    ],
  };
}

function coachAnswer(household: Household, today: DateKey, name: string): BooksAsk {
  const { mood, reason } = companionMood(household, today, name);
  if (mood === "hiding") {
    return {
      kind: "answer",
      sentence: `Open More → Health first. ${reason}`,
      rows: [{ label: "Next", value: "Health" }],
    };
  }
  if (mood === "restless") {
    return {
      kind: "answer",
      sentence: `${reason} Calendar still does not post. Mark paid, then confirm.`,
      rows: [{ label: "Next", value: "Calendar or Add" }],
    };
  }
  return {
    kind: "answer",
    sentence: `The ordinary grocery is the winning move. ${reason}`,
    rows: [{ label: "Next", value: "Tap + and post milk" }],
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
    sentence: `${rows[0]!.label} still has room versus the sit-down plan. ${household.kitchen.companion.name} looks smug. This is a projection, not permission.`,
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
  const greet = phase === "morning"
    ? `${name} stretched. Toronto morning.`
    : phase === "after-shift"
      ? `${name} is waiting for tip-out math, not vibes.`
      : phase === "sunday"
        ? `${name} wants a sit-down, not a lecture.`
        : `${name} is still on the counter.`;
  if (highFive.yes) {
    return `${highFive.names.join(" and ")} both posted groceries today. ${name} offers a high-five. Not a leaderboard.`;
  }
  if (tab === "add") return `${name} will wait. Confirm still posts. He will not.`;
  if (tab === "calendar") return `${greet} Dates are reminders. Mark paid is the write.`;
  if (tab === "plan") return `${greet} Sit-down copies last month in CAD.`;
  if (tab === "ledger") return `${greet} Ask me in English. Power SQL stays read-only.`;
  if (tab === "more") return `${greet} Health is the adult screen. I hide when it is dirty.`;
  return `${greet} ${describeCompanion(household, today).reason}`;
}

export const HERCULES_CHIPS = [
  "Are we alright",
  "What should I do",
  "Safe to skip",
  "Groceries this month",
  "Bills due",
  "Tips this week",
  "Cook-off",
  "Sunday recap",
  "Forecast",
  "This week vs last week",
  "Who are you",
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

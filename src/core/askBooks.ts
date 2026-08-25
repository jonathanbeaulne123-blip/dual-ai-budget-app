import { addDays, monthKeyFromDateKey, type DateKey } from "./calendar.ts";
import { monthSummary, weekSummary } from "./budget.ts";
import { runHealthCheck } from "./health.ts";
import { formatCad } from "./money.ts";
import { accountRegister, compileHousehold } from "./journal.ts";
import { categoryName } from "./ledgerView.ts";
import { creditCardView, householdWallet } from "./accounts.ts";
import { claimPublicLabel, claimsTraySentence, craMedicalLog, outstandingClaims, upcomingVisitProposals } from "./appointments.ts";
import { describeGoalContributors } from "./goals.ts";
import { leftoverProjection } from "./sitDown.ts";
import type { HerculesNumberSource } from "./herculesProvenance.ts";
import type { Household, LedgerView } from "./types.ts";

export type HerculesAskContext = { memberId: string; view: LedgerView };

export type BooksAskRow = { label: string; value: string; source?: HerculesNumberSource; basis?: "journal" | "projection" };

export type BooksAsk = {
  kind: "answer" | "help";
  sentence: string;
  rows: BooksAskRow[];
  sql?: string;
  suggestions?: string[];
  source?: HerculesNumberSource;
};

export const ASK_SUGGESTIONS = [
  "Are we alright",
  "Opinion",
  "Balance sheet",
  "Working capital",
  "What's on the Visa",
  "Utilization",
  "Accounting policies",
  "Groceries this month",
  "Bills due",
  "What's owed",
  "Medical log",
  "How much is in chequing",
  "This week vs last week",
  "Goals",
  "Coffee this week",
  "Tips this week",
  "What should I do",
  "Sit-down leftover",
  "Safe to skip",
];

function normalize(question: string): string {
  return question
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\bsit\s+down\b/g, "sitdown")
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

function source(
  context: HerculesAskContext,
  route: HerculesNumberSource["route"],
  label: string,
  detail: Omit<Partial<HerculesNumberSource>, "route" | "view" | "label"> = {},
): HerculesNumberSource {
  return { route, view: context.view, label, ...detail };
}

function memberNamedIn(household: Household, q: string) {
  return household.members.find((member) => member.name.toLowerCase().split(/\s+/).some((token) => {
    if (token.length < 2) return false;
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`).test(q);
  }));
}

export function askBooks(
  household: Household,
  question: string,
  today: DateKey,
  context: HerculesAskContext = { memberId: household.members[0]?.id ?? "", view: "household" },
): BooksAsk {
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

  if (/\b(will i|can i|able to|afford).*(eat|food|grocer)|\b(eat|food|grocer).*(this week|until payday)\b/.test(q)) {
    const grocery = month.categories.find((row) => row.subcategoryId === "SUB-FOOD-GROCERIES")
      ?? month.categories.find((row) => /grocer/i.test(row.name));
    const planLeft = grocery ? Math.max(0, grocery.budgetedCents - grocery.actualCents) : 0;
    const leftover = leftoverProjection(household, today);
    const enough = leftover.cashLikeCents > 0 && (planLeft > 0 || (grocery?.actualCents ?? 0) > 0);
    const foodSource = source(context, "plan", "Open the groceries plan", {
      surface: "blotter",
      categoryId: grocery?.subcategoryId,
      from: monthStart,
      to: today,
    });
    return {
      kind: "answer",
      sentence: enough
        ? `The books say yes, cautiously: ${formatCad(planLeft)} remains in the groceries plan and cash-like is ${formatCad(leftover.cashLikeCents)}. That's a plan, not a promise.`
        : `The books cannot give me an easy yes. Groceries plan left is ${formatCad(planLeft)} and cash-like is ${formatCad(leftover.cashLikeCents)}. Open Plan before treats, kitten.`,
      rows: [
        { label: "Groceries plan left", value: formatCad(planLeft), source: foodSource, basis: "projection" },
        { label: "Cash-like", value: formatCad(leftover.cashLikeCents), source: source(context, "plan", "Open the sit-down cash calculation", { surface: "postcard" }), basis: "projection" },
      ],
      source: foodSource,
    };
  }

  const namedMember = memberNamedIn(household, q);
  if ((/\b(overspend|overspent|over spent|spending habit|spent this week|spend this week)\b/.test(q) || (/\bdid\b/.test(q) && /\bspend/.test(q))) && namedMember) {
    const currentRows = household.transactions.filter((tx) => (
      tx.createdBy === namedMember.id
      && tx.date >= week.start && tx.date <= week.end
      && !tx.isDuplicate
      && (tx.type === "expense" || tx.type === "refund")
    ));
    const current = currentRows.reduce((sum, tx) => sum + (tx.type === "expense" ? tx.amountCents : -tx.amountCents), 0);
    const priorStart = addDays(week.start, -28);
    const prior = household.transactions.filter((tx) => (
      tx.createdBy === namedMember.id
      && tx.date >= priorStart && tx.date < week.start
      && !tx.isDuplicate
      && (tx.type === "expense" || tx.type === "refund")
    )).reduce((sum, tx) => sum + (tx.type === "expense" ? tx.amountCents : -tx.amountCents), 0);
    const average = Math.round(prior / 4);
    const delta = current - average;
    const spendSource = source(context, "ledger", `Open ${namedMember.name}'s shared posts`, {
      memberId: namedMember.id,
      from: week.start,
      to: week.end,
    });
    return {
      kind: "answer",
      sentence: average <= 0
        ? `${namedMember.name} has ${formatCad(current)} of shared spend this week. I need earlier shared weeks before I call that higher or lower.`
        : delta > 0
          ? `${namedMember.name}'s shared posts are ${formatCad(delta)} above their four-week weekly average (${formatCad(current)} vs ${formatCad(average)}). That's a pattern, not a scolding.`
          : `${namedMember.name}'s shared posts are ${formatCad(-delta)} below their four-week weekly average (${formatCad(current)} vs ${formatCad(average)}).`,
      rows: [
        { label: `${namedMember.name} · this week`, value: formatCad(current), source: spendSource, basis: "journal" },
        { label: "Prior four-week average", value: formatCad(average), source: source(context, "ledger", "Open the comparison rows", { memberId: namedMember.id, from: priorStart, to: addDays(week.start, -1) }), basis: "projection" },
      ],
      source: spendSource,
    };
  }

  if (/\b(shift|hours worked|wages|tips|income|earned|make this week)\b/.test(q) && /\b(this week|week)\b/.test(q)) {
    const target = namedMember?.id ?? (context.view === "personal" ? context.memberId : null);
    const shifts = household.shifts.filter((shift) => (
      shift.date >= week.start && shift.date <= week.end && (!target || shift.memberId === target)
    ));
    const shiftIncome = shifts.reduce((sum, shift) => sum + shift.wagesCents + shift.netTipsCents + (shift.paidBreakIncomeCents ?? 0), 0);
    const postedIncome = household.transactions.filter((tx) => (
      tx.type === "income" && tx.date >= week.start && tx.date <= week.end && (!target || tx.createdBy === target)
    )).reduce((sum, tx) => sum + tx.amountCents, 0);
    const hours = shifts.reduce((sum, shift) => sum + shift.hours, 0);
    const shiftSource = source(context, "home", "Open the timesheet", {
      surface: "timesheet",
      memberId: target ?? undefined,
      from: week.start,
      to: week.end,
    });
    return {
      kind: "answer",
      sentence: `${target ? household.members.find((member) => member.id === target)?.name ?? "This member" : "The household"} has ${shifts.length} posted shift${shifts.length === 1 ? "" : "s"}, ${hours.toFixed(1)} hours, and ${formatCad(shiftIncome || postedIncome)} of posted shift income this week.`,
      rows: [
        { label: "Posted shift income", value: formatCad(shiftIncome || postedIncome), source: shiftSource, basis: "journal" },
        { label: "Hours", value: hours.toFixed(1), source: shiftSource, basis: "journal" },
        { label: "Shifts", value: String(shifts.length), source: shiftSource, basis: "journal" },
      ],
      source: shiftSource,
    };
  }

  if (/\b(leftover|sitdown|sit-?down|safe to assign|what can we move)\b/.test(q)) {
    const leftover = leftoverProjection(household, today);
    return {
      kind: "answer",
      sentence: leftover.leftoverCents
        ? `Sit-down leftover is ${formatCad(leftover.leftoverCents)}. ${leftover.formula} Month net is not leftover. Confirm parks jar cash in the Goals vault. Hercules never does.`
        : leftover.shortfallCents
          ? `Nothing to move. ${leftover.formula} Sit-down still runs. It does not invent CAD.`
          : leftover.formula,
      rows: [
        { label: "Cash-like", value: formatCad(leftover.cashLikeCents) },
        { label: "Bills next 30 days", value: formatCad(leftover.billsNext30Cents) },
        { label: "Card minimums", value: formatCad(leftover.minPaymentsCents) },
        { label: "Leftover", value: formatCad(leftover.leftoverCents) },
        { label: "Parks in", value: "Goals vault" },
      ],
    };
  }

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

  if (/\b(bill|due|upcoming|rent|hydro|phone)\b/.test(q) && !/\b(spent|spend|grocer|owed|claim)\b/.test(q)) {
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
        source: source(context, "calendar", "Open this repeating item", { surface: "calendar", recurrenceId: item.id, from: item.nextDate, to: item.nextDate }),
      })),
    };
  }

  if (/\b(owed|owing|claim|receivable|co-?pay|insurance landed|what.?s owed)\b/.test(q)) {
    const owing = outstandingClaims(household);
    if (!owing.length) {
      return { kind: "answer", sentence: "Nothing is outstanding. The tray is empty.", rows: [] };
    }
    return {
      kind: "answer",
      sentence: `${claimsTraySentence(household, today)} Settlement is a transfer, never income.`,
      rows: owing.map((claim) => ({
        label: claimPublicLabel(household, claim, "hercules"),
        value: formatCad(claim.expectedCents - claim.receivedCents - claim.writtenOffCents),
        source: source(context, "calendar", "Open this claim", { surface: "claims", claimId: claim.id }),
      })),
    };
  }

  if (/\b(medical|metc|cra|tax credit|dentist|therapy|vet)\b/.test(q) && !/\b(spent this)\b/.test(q)) {
    const log = craMedicalLog(household, today);
    const saveFor = upcomingVisitProposals(household, today)[0];
    return {
      kind: "answer",
      sentence: log.hercules,
      rows: [
        { label: `${log.year} eligible`, value: formatCad(log.eligibleCents) },
        { label: "Reimbursed", value: formatCad(log.reimbursedCents) },
        { label: "Still owing", value: formatCad(log.outstandingCents) },
        { label: "CRA cap", value: formatCad(log.capCents) },
        ...(saveFor ? [{ label: "Next jar", value: `${saveFor.title} · ${formatCad(saveFor.weeklyCents)}/wk` }] : []),
      ],
    };
  }

  if (/\b(goal|saving|emergency|trip fund)\b/.test(q)) {
    if (!household.goals.length) return { kind: "answer", sentence: "No goals yet. Add one from Plan.", rows: [] };
    return {
      kind: "answer",
      sentence: household.goals.map((goal) => {
        const pct = goal.targetCents ? Math.round((goal.savedCents / goal.targetCents) * 100) : 0;
        const who = describeGoalContributors(household, goal.id);
        const progress = `${goal.name} is ${pct}% (${formatCad(goal.savedCents)} of ${formatCad(goal.targetCents)})`;
        return who ? `${progress}. ${who}.` : `${progress}.`;
      }).join(" "),
      rows: household.goals.map((goal) => ({
        label: goal.name,
        value: `${formatCad(goal.savedCents)} / ${formatCad(goal.targetCents)}`,
        source: source(context, "plan", "Open this jar", { surface: "jars", goalId: goal.id }),
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
      rows: parties.map((party) => ({ label: party.name, value: formatCad(party.amountCents), source: source(context, "ledger", `Open ${party.name}'s shared rows`, { memberId: party.party, from: week.start, to: week.end }) })),
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

  if (/\b(utilization|utili[sz]ation|how maxed|credit limit)\b/.test(q)) {
    const wallet = householdWallet(household, today);
    const cards = wallet.tiles.filter((tile) => tile.credit);
    if (!cards.length) return { kind: "answer", sentence: "No credit cards on the books yet.", rows: [] };
    return {
      kind: "answer",
      sentence: wallet.hottestCard?.utilization != null
        ? `${wallet.hottestCard.account.name} is at ${Math.round(wallet.hottestCard.utilization * 100)}% utilization. Paydown is a transfer. I don't levy a fee.`
        : "Credit cards are on the books. Set a limit to see utilization.",
      rows: cards.map((tile) => ({
        label: tile.account.name,
        value: tile.credit?.utilization == null ? "no limit" : `${Math.round(tile.credit.utilization * 100)}% · owed ${formatCad(tile.credit.owedCents)}`,
      })),
    };
  }

  if (/\b(cashback|rewards|points this cycle)\b/.test(q)) {
    const wallet = householdWallet(household, today);
    const cards = wallet.tiles.filter((tile) => tile.credit);
    if (!cards.length) return { kind: "answer", sentence: "No cards to accrue rewards on.", rows: [] };
    return {
      kind: "answer",
      sentence: "Cashback this cycle is a look. Post it from the card room when the statement credit or deposit actually lands.",
      rows: cards.map((tile) => ({
        label: `${tile.account.name} · ${tile.credit?.rewardsName ?? "rewards"}`,
        value: formatCad(tile.credit?.cashbackCycleCents ?? 0),
      })),
    };
  }

  if (/\b(what.?s on the visa|what.?s on the mastercard|what.?s on the master card|what.?s on the card|pay the (visa|card)|visa balance)\b/.test(q)) {
    const wantVisa = /\bvisa\b/.test(q);
    const wantMc = /\bmastercard|master card\b/.test(q);
    const hottest = householdWallet(household, today).hottestCard?.account;
    const card = household.accounts.find((account) => {
      if (!account.active || account.kind !== "credit") return false;
      if (wantVisa) return account.id === "ACC-VISA" || /visa/i.test(account.name);
      if (wantMc) return account.id === "ACC-MC" || /master/i.test(account.name);
      return hottest ? account.id === hottest.id : true;
    });
    if (!card) return { kind: "answer", sentence: "No card on the books.", rows: [] };
    const view = creditCardView(household, card, today);
    const trayCents = accountBalance(household, card.id);
    const tray = formatCad(trayCents);
    const owed = formatCad(view.owedCents);
    const sentence = trayCents === view.owedCents
      ? view.hercules
      : `${card.name} on the tray is ${tray}. Statement owed ${owed}. Paydown is a transfer.`;
    return {
      kind: "answer",
      sentence,
      rows: [
        { label: "Tray", value: tray, source: source(context, "ledger", `Open ${card.name}`, { accountId: card.id, surface: "wallet" }) },
        { label: "Statement owed", value: owed, source: source(context, "ledger", `Open ${card.name}`, { accountId: card.id, surface: "wallet" }) },
        { label: "Available", value: view.limitCents ? formatCad(view.availableCents) : "no limit", source: source(context, "ledger", `Open ${card.name}`, { accountId: card.id, surface: "wallet" }), basis: "projection" },
        { label: "Due", value: view.dueDate, source: source(context, "ledger", `Open ${card.name}`, { accountId: card.id, surface: "wallet" }) },
        { label: "Min pay", value: formatCad(view.minPaymentCents), source: source(context, "ledger", `Open ${card.name}`, { accountId: card.id, surface: "wallet" }) },
      ],
    };
  }

  if (/\b(chequing|checking|visa|mastercard|cash|tips|savings|tfsa|rrsp|fhsa|investment|balance|how much (do we|is) (in|left)|envelope|net worth)\b/.test(q)) {
    const wantVisa = /\bvisa\b/.test(q);
    const wantMc = /\bmastercard|master card\b/.test(q);
    const wantCash = /\bcash|tips|jar\b/.test(q);
    const wantSavings = /\bsavings|hisa\b/.test(q);
    const wantInvest = /\btfsa|rrsp|fhsa|investment|brokerage|crypto\b/.test(q);
    const wantChequing = /\bchequ|check/.test(q);
    const wantCard = /\bcard\b/.test(q) && !wantVisa && !wantMc;
    const accounts = household.accounts.filter((account) => {
      if (wantVisa) return /visa/i.test(account.name) || account.id === "ACC-VISA";
      if (wantMc) return /master/i.test(account.name) || account.id === "ACC-MC";
      if (wantCard) return account.kind === "credit";
      if (wantCash) return account.kind === "other";
      if (wantSavings) return account.kind === "savings";
      if (wantInvest) return account.kind === "investment";
      if (wantChequing) return account.kind === "chequing";
      return true;
    });
    const targets = wantVisa || wantMc || wantCard || wantCash || wantSavings || wantInvest || wantChequing
      ? accounts
      : household.accounts.filter((account) => account.active);
    const rows = targets.map((account) => ({
      label: account.name,
      value: formatCad(accountBalance(household, account.id)),
      source: source(context, "ledger", `Open ${account.name}`, { accountId: account.id, surface: "accounts" }),
    }));
    return {
      kind: "answer",
      sentence: rows.length === 1
        ? `${rows[0]!.label} is ${rows[0]!.value} on the books.`
        : "Here are the household accounts on the books. Credit is what you still owe. Investments show cost basis until you mark a value.",
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
      const categorySource = source(context, "ledger", `Open ${category.name} rows`, { categoryId: category.id, from: rangeStart, to: today });
      const rows: BooksAskRow[] = [{ label: `${category.name} ${rangeLabel}`, value: formatCad(cents), source: categorySource }];
      if (plan && !looksLikeWeek(q) && plan.budgetedCents) {
        rows.push({ label: "Plan this month", value: formatCad(plan.budgetedCents), source: source(context, "plan", `Open ${category.name} plan`, { categoryId: category.id, surface: "blotter", from: monthStart, to: today }), basis: "projection" });
        rows.push({
          label: plan.actualCents > plan.budgetedCents ? "Over" : "Left",
          value: formatCad(Math.abs(plan.budgetedCents - plan.actualCents)),
          source: source(context, "plan", `Open ${category.name} plan`, { categoryId: category.id, surface: "blotter", from: monthStart, to: today }),
          basis: "projection",
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

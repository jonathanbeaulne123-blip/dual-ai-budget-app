import { addDays, monthKeyFromDateKey, shiftMonthKey, type DateKey } from "./calendar.ts";
import {
  acknowledgeHouseholdPlan,
  addCategory,
  addGoal,
  addPotentialExpense,
  addRecurrence,
  allocateHouseholdFundSurplus,
  appendPlanSitdownTurn,
  closeBooksMonth,
  configureHouseholdFund,
  confirmHouseholdFundContribution,
  confirmHouseholdFundSettlement,
  foundHouseholdCharter,
  fundGoal,
  pauseRecurrence,
  postEntry,
  postTransfer,
  proposeHouseholdFundContribution,
  proposeHouseholdPlan,
  purchaseGoal,
  recordHouseholdFundReconciliation,
  recordReconciliation,
  releaseHouseholdFundKitty,
  savePlanBridgeDraft,
  savePlanDraft,
  setHouseholdFundMonthPlan,
  sharePlanBridgeDraft,
  signHouseholdCharter,
} from "./commands.ts";
import { closeChapter, completeMove, keepWinAsMemory, movesForChapter, offerMove, openChapter, openChapterFor, recordRitualHeld, recordWin, respondToMove } from "./chapters.ts";
import { createDemoRandom } from "./demoRandom.ts";
import { fundContributionReviewDigest } from "./fundContributionSources.ts";
import { projectHouseholdFund } from "./householdFund.ts";
import { saveNativeEvent } from "./nativeEvents.ts";
import { crossPathEra, currentPathEra, proposePathEra, proposePathEraPlan } from "./pathEras.ts";
import { agreePathProposal, pendingPathProposals, proposePathName, proposePathRecipe, setPathCategorySignal, shapePathWorld, type PathEraPlan, type PathEraRow, type PathEraSpec } from "./pathWorld.ts";
import { currentPlanVersion, type PlanLine } from "./planSystem.ts";
import { bookBalanceAsOf } from "./statements.ts";
import { atSyntheticClock } from "./syntheticRuntime.ts";
import { defaultKittySculpt } from "./kittyStudio.ts";
import type { GoalEnvelope, KittyStampV1 } from "./types.ts";
import { completeTask, saveTask, type Task } from "./tasks.ts";
import type { CommitResult, Household } from "./types.ts";

/**
 * "Our Story" (D-268 sample household, 2026-09-16): a third Hercules habitat that
 * sells the Journey of Life. Two fictional years behind Jonathan and Bianca —
 * moved in, survived the first year (a vet storm and all), crossed into
 * *Make it ours*, bought the sofa, went to Tofino — and two eras planned ahead:
 * the first house and retirement.
 *
 * Built exactly like `shapeHabitat`: the synthetic Demo Suite's books
 * (`seedStressHousehold`, here 25 months with tip seasons and without the seed's
 * own bills and sample goals) with a story laid over them through the ordinary
 * commands, nothing else. Every date is relative to the generation `today`
 * (M = today's month; move-in is M−24). Rows a command stamps with the clock are
 * written under the fixture clock set to the story's day (`atSyntheticClock`),
 * so the story replays byte-for-byte from its seed.
 *
 * Three planner/calendar commands (`saveTask`, `completeTask`, `saveNativeEvent`)
 * stamp the wall clock rather than the fixture clock; their created/updated
 * stamps are set back to the story's moment right after the command returns
 * (`restamp`) so replay holds. Nothing else is touched outside a command.
 *
 * Nothing here is real. Every figure is fictional Development data.
 */

export const STORY_NAME = "Our Story · the journey of life";
export const STORY_WORDS = {
  title: "Our story",
  line: "Two years into the journey of life: moved in, crossed into Make it ours, a house and retirement planned ahead.",
} as const;

const M1 = "MEM-001"; // Bianca, the Fund's custodian
const M2 = "MEM-002"; // Jonathan
const CHQ = "ACC-CHEQUING", SAV = "ACC-SAVINGS", VISA = "ACC-VISA";

type Step = { date: DateKey; order: number; run: (h: Household) => Household };

/** Seasonal hydro and gas (Jan … Dec), fictional. */
const HYDRO = [140, 135, 120, 95, 80, 85, 110, 115, 90, 85, 105, 130];
const GAS = [130, 125, 105, 80, 55, 45, 45, 45, 50, 70, 95, 120];

type StoryContext = {
  today: DateKey;
  M: string;
  seed: number;
  random: () => number;
  /** Category ids by story name. */
  cat: Record<string, string>;
  /** Goal ids by story name. */
  goal: Record<string, string>;
  /** Recurrence ids by note. */
  rec: Record<string, string>;
};

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (date: DateKey, hour = 12, minute = 0) => `${date}T${pad(hour)}:${pad(minute)}:00.000Z`;
const monthOf = (c: StoryContext, k: number) => shiftMonthKey(c.M, k);
const dayIn = (c: StoryContext, k: number, day: number): DateKey => `${monthOf(c, k)}-${pad(Math.min(28, Math.max(1, day)))}` as DateKey;
const calMonth = (c: StoryContext, k: number) => Number(monthOf(c, k).slice(5, 7));
const lean = (c: StoryContext, k: number) => calMonth(c, k) <= 2;
const round2 = (n: number) => Math.round(n * 100) / 100;
const vary = (c: StoryContext, base: number, spread: number) => round2(base + (c.random() - 0.5) * 2 * spread);

/** Run a command at a story moment: the fixture clock reads that moment. */
function at(h: Household, when: string, command: (h: Household) => CommitResult): Household {
  return atSyntheticClock(when, () => command(h)).household;
}

/** Planner and calendar rows stamp the wall clock; set them back to the story's moment so replay holds. */
function restamp<K extends "tasks" | "nativeEvents">(h: Household, key: K, id: string, when: string): Household {
  const rows = (h[key] ?? []) as Array<{ id: string; createdAt: string; updatedAt: string; completedAt?: string | null }>;
  return {
    ...h,
    [key]: rows.map((row) => row.id !== id ? row : {
      ...row,
      createdAt: row.createdAt > when ? when : row.createdAt,
      updatedAt: when,
    }),
  };
}

// ---------------------------------------------------------------------------
// Setup: categories, the Fund, the Charter, bills

function categories(h: Household, c: StoryContext): Household {
  let next = h;
  const when = iso(dayIn(c, -24, 1), 9);
  const add = (name: string, input: Parameters<typeof addCategory>[1]) => {
    next = at(next, when, (x) => addCategory(x, input));
    const row = next.categories.find((cat) => cat.name === name && cat.recordType === "category");
    if (row) c.cat[name] = row.id;
  };
  const group = (name: string) => next.categories.find((row) => row.name === name && row.recordType === "group")?.id;
  // Home and the garden
  add("Furniture", { name: "Furniture", type: "expense", parentId: "__new__", newGroupName: "Our home" });
  add("Plants & garden", { name: "Plants & garden", type: "expense", parentId: group("Our home")! });
  // Hercules
  add("Pet food", { name: "Pet food", type: "expense", parentId: "__new__", newGroupName: "Hercules", essential: true });
  add("Pet insurance", { name: "Pet insurance", type: "expense", parentId: group("Hercules")!, essential: true });
  // Good times
  add("Travel", { name: "Travel", type: "expense", parentId: "__new__", newGroupName: "Good times" });
  add("Gifts", { name: "Gifts", type: "expense", parentId: group("Good times")! });
  add("Birthdays & parties", { name: "Birthdays & parties", type: "expense", parentId: group("Good times")! });
  add("Pottery", { name: "Pottery", type: "expense", parentId: group("Good times")! });
  add("Gym & running", { name: "Gym & running", type: "expense", parentId: group("Good times")! });
  // Essentials the catalog does not carry
  add("Tenant insurance", { name: "Tenant insurance", type: "expense", parentId: "CAT-HOUSING", essential: true });
  add("Internet", { name: "Internet", type: "expense", parentId: "CAT-HOUSING", essential: true });
  add("Car-share", { name: "Car-share", type: "expense", parentId: "CAT-TRANSPORT", essential: true });
  add("Car insurance & repairs", { name: "Car insurance & repairs", type: "expense", parentId: "CAT-TRANSPORT", essential: true });
  return next;
}

/** The coffee-bean club is new this month, in a group of its own: the island has no word for it yet ("Something new"). */
function roasterCategory(h: Household, c: StoryContext): Household {
  let next = at(h, iso(dayIn(c, -1, 8), 9), (x) => addCategory(x, { name: "Roaster club", type: "expense", parentId: "__new__", newGroupName: "Pantry" }));
  const row = next.categories.find((cat) => cat.name === "Roaster club" && cat.recordType === "category");
  if (row) c.cat["Roaster club"] = row.id;
  return next;
}

type Bill = {
  note: string;
  amount: number;
  day: number;
  account: string;
  category: (c: StoryContext) => string;
  kind: "bill" | "subscription" | "other";
  fund: boolean;
  from: number;
  until?: number;
  place: string;
  by: string;
  seasonal?: number[];
};

const BILLS: Bill[] = [
  { note: "Rent", amount: 2150, day: 1, account: CHQ, category: () => "SUB-HOUSING-RENT", kind: "bill", fund: true, from: -24, place: "Property manager", by: M1 },
  { note: "Transit passes", amount: 286, day: 1, account: VISA, category: () => "SUB-TRANSPORT-TRANSIT", kind: "other", fund: true, from: -24, place: "TTC", by: M1 },
  { note: "Tenant insurance", amount: 24, day: 3, account: VISA, category: (c) => c.cat["Tenant insurance"]!, kind: "bill", fund: true, from: -24, place: "Fictional Mutual", by: M1 },
  { note: "Music", amount: 12.99, day: 5, account: VISA, category: () => "SUB-LIFE-FUN", kind: "subscription", fund: false, from: -24, place: "Spotify", by: M2 },
  { note: "Streaming", amount: 18.99, day: 6, account: VISA, category: () => "SUB-LIFE-FUN", kind: "subscription", fund: false, from: -24, place: "Streaming service", by: M2 },
  { note: "Toronto Hydro", amount: 105, day: 8, account: CHQ, category: () => "SUB-HOUSING-ELECTRIC", kind: "bill", fund: true, from: -24, place: "Toronto Hydro", by: M1, seasonal: HYDRO },
  { note: "Gym", amount: 44, day: 10, account: VISA, category: (c) => c.cat["Gym & running"]!, kind: "subscription", fund: false, from: -24, place: "Community gym", by: M2 },
  { note: "Enbridge Gas", amount: 80, day: 11, account: CHQ, category: () => "SUB-HOUSING-GAS", kind: "bill", fund: true, from: -24, place: "Enbridge Gas", by: M1, seasonal: GAS },
  { note: "Internet", amount: 75, day: 12, account: VISA, category: (c) => c.cat["Internet"]!, kind: "bill", fund: true, from: -24, place: "Fictional Fibre", by: M1 },
  { note: "Mobile phones", amount: 96.42, day: 14, account: VISA, category: () => "SUB-LIFE-PHONE", kind: "bill", fund: true, from: -24, place: "Freedom Mobile", by: M1 },
  { note: "Cloud storage", amount: 3.99, day: 16, account: VISA, category: () => "SUB-LIFE-FUN", kind: "subscription", fund: false, from: -24, place: "Cloud storage", by: M2 },
  { note: "Hercules's food delivery", amount: 58, day: 18, account: VISA, category: (c) => c.cat["Pet food"]!, kind: "subscription", fund: false, from: -24, place: "Pet food delivery", by: M1 },
  { note: "Car-share", amount: 9, day: 20, account: VISA, category: (c) => c.cat["Car-share"]!, kind: "subscription", fund: false, from: -24, place: "Car-share", by: M2 },
  { note: "Meal kit", amount: 89, day: 21, account: VISA, category: () => "SUB-FOOD-GROCERIES", kind: "subscription", fund: false, from: -24, until: -18, place: "Meal kit", by: M1 },
  { note: "Pet insurance", amount: 41, day: 22, account: VISA, category: (c) => c.cat["Pet insurance"]!, kind: "bill", fund: false, from: -24, place: "Fictional pet insurer", by: M1 },
  { note: "Pottery studio", amount: 65, day: 25, account: VISA, category: (c) => c.cat["Pottery"]!, kind: "subscription", fund: false, from: -10, place: "Clay studio", by: M1 },
  { note: "Coffee beans", amount: 32, day: 9, account: VISA, category: (c) => c.cat["Roaster club"]!, kind: "subscription", fund: false, from: -1, place: "Roaster club", by: M2 },
];

const billAmount = (c: StoryContext, bill: Bill, k: number) => bill.seasonal ? bill.seasonal[calMonth(c, k) - 1]! : bill.amount;

/** The next occurrence of a bill still ahead of today (the recurrence's `nextDate`). */
function nextBillDate(c: StoryContext, bill: Bill): DateKey {
  const thisMonth = dayIn(c, 0, bill.day);
  return thisMonth >= c.today ? thisMonth : dayIn(c, 1, bill.day);
}

function addBill(h: Household, c: StoryContext, bill: Bill): Household {
  const fundId = h.householdFund?.id;
  const nextDate = bill.until !== undefined ? dayIn(c, bill.until + 1, bill.day) : nextBillDate(c, bill);
  const next = at(h, iso(dayIn(c, bill.from, 1), 10), (x) => addRecurrence(x, {
    cadence: "monthly", nextDate, type: "expense", amount: bill.amount, accountId: bill.account, subcategoryId: bill.category(c), note: bill.note, kind: bill.kind,
    ...(bill.fund && fundId ? { fundingDefault: { fundId, fundedCents: "full" as const, destinationAccountId: bill.account } } : {}),
  }));
  const row = next.recurrences.find((r) => r.note === bill.note);
  if (row) c.rec[bill.note] = row.id;
  return next;
}

/** One bill paid on its day, the way the cellar's hammer posts it (Fund-paid bills carry their Fund funding). */
function billStep(c: StoryContext, bill: Bill, k: number): Step | null {
  const date = dayIn(c, k, bill.day);
  if (k < bill.from || (bill.until !== undefined && k > bill.until) || date >= c.today) return null;
  return {
    date, order: 20, run: (h) => {
      const amount = billAmount(c, bill, k);
      const fundId = h.householdFund?.id;
      return postEntry(h, {
        type: "expense", date, amount, accountId: bill.account, subcategoryId: bill.category(c), note: bill.note, place: bill.place,
        createdBy: bill.by, visibility: "household", source: "recurring", sourceId: c.rec[bill.note], confirmDuplicate: true,
        ...(bill.fund && fundId ? { funding: { fundId, fundedCents: Math.round(amount * 100), destinationAccountId: bill.account } } : {}),
      }).household;
    },
  };
}

// ---------------------------------------------------------------------------
// The Fund

function contribute(h: Household, by: string, amount: number, date: DateKey): Household {
  const offer = proposeHouseholdFundContribution(h, { memberId: by, contributorMemberId: by, date, amount, source: { version: 1, kind: "external-received", explanation: "Fictional: e-transfer into the shared savings" } });
  return confirmHouseholdFundContribution(offer.household, { memberId: M1, proposalEventId: offer.postedIds[0]!, received: true, expectedProposalDigest: fundContributionReviewDigest(offer.household, offer.postedIds[0]!) }).household;
}

function reconcileTied(h: Household, date: DateKey, note: string): Household {
  const projection = projectHouseholdFund(h, date);
  const held = (projection.operatingBalanceCents + projection.kittyCents) / 100;
  return recordHouseholdFundReconciliation(h, { memberId: M1, date, bankTotal: held.toFixed(2), personalRemainder: "0.00", note }).household;
}

/** Settle what the Fund owes the chequing account and the card for the bills it paid, as far as the Fund can. */
function settle(h: Household, date: DateKey): Household {
  let next = h;
  for (const destination of [CHQ, VISA]) {
    const projection = projectHouseholdFund(next, date);
    const due = projection.destinationPositions.find((row) => row.destinationAccountId === destination)?.dueCents ?? 0;
    const cents = Math.min(due, projection.operatingBalanceCents);
    if (cents <= 0) continue;
    next = confirmHouseholdFundSettlement(next, { memberId: M1, amount: cents / 100, destinationAccountId: destination, date, note: "Fictional: the Fund paid the month's bills" }).household;
  }
  return next;
}

/** Roll a month-end surplus into the Moving-in cushion until it is full. */
function refillCushion(h: Household, c: StoryContext, date: DateKey, want: number): Household {
  const cushion = h.goals.find((g) => g.id === c.goal["Moving-in cushion"]);
  if (!cushion || want <= 0) return h;
  const projection = projectHouseholdFund(h, date);
  const cents = Math.min(Math.round(want * 100), projection.safeRolloverCents);
  if (cents < 100) return h;
  return allocateHouseholdFundSurplus(h, { memberId: M1, date, allocations: [{ goalId: cushion.id, amount: cents / 100 }], note: "Fictional: month-end surplus into the Moving-in cushion" }).household;
}

function cushionReserved(h: Household, c: StoryContext): number {
  const id = c.goal["Moving-in cushion"];
  const allocated = (h.fundKittyAllocations ?? []).filter((row) => row.goalId === id).reduce((sum, row) => sum + row.amountCents, 0);
  const released = (h.fundEvents ?? []).filter((row) => row.kind === "kitty-released" && row.goalId === id).reduce((sum, row) => sum + row.amountCents, 0);
  return allocated - released;
}

// ---------------------------------------------------------------------------
// Plans: every month agreed by both, with the Fund line; decisions fork the path

function monthPlan(h: Household, c: StoryContext, k: number, decisions: boolean): Household {
  const month = monthOf(c, k);
  const date = dayIn(c, k, 1);
  const by = k % 2 === 0 ? M2 : M1;
  const other = by === M1 ? M2 : M1;
  const fundId = h.householdFund!.id;
  const target = lean(c, k) ? 3150 : 3600;
  const monthEnd = addDays(dayIn(c, k + 1, 1), -1);
  const common = { cadence: "monthly" as const, createdBy: by, responsibility: { kind: "joint" as const, memberId: by }, assumptionIds: [] };
  const goalLine = (id: string, name: string, amount: number, nextStep: string, member: string | null): PlanLine => ({
    ...common, id: `story-goal-${id}`, lens: "build", kind: "goal-contribution", labelSnapshot: name, amountCents: Math.round(amount * 100), dueDate: addDays(date, 14),
    sourceReference: { type: "goal", id },
    ...(member ? { responsibility: { kind: "member" as const, memberId: member } } : {}),
    decision: { funding: "available", nextStep },
  });
  const lines: PlanLine[] = [
    { ...common, id: "story-fund", lens: "prepare", kind: "household-fund", labelSnapshot: h.householdFund!.name || "Household Fund", amountCents: target * 100, dueDate: monthEnd, sourceReference: { type: "fund", id: fundId } },
    { ...common, id: "story-everyday", lens: "everyday", kind: "everyday-pool", labelSnapshot: "Groceries and ordinary pleasures", amountCents: 70_000, dueDate: monthEnd, sourceReference: { type: "category", id: "SUB-FOOD-GROCERIES" } },
  ];
  if (decisions) {
    const g = (name: string) => c.goal[name];
    const picks: [string, number, string, string | null][] = [
      ["The sofa", 350, "Measure the living room before we pick a colour.", M1],
      ["Tofino trip", 320, "Book the ferry the week pay lands.", M2],
      ["Emergency buffer", 150, "Move it on the payday after rent clears.", null],
      ["Bed & mattress", 130, "Try three mattresses on one Saturday.", M2],
      ["Dining table & chairs", 60, "Look at second-hand tables first.", M1],
    ];
    for (const [name, amount, nextStep, member] of picks) {
      const id = g(name);
      const goal = id ? h.goals.find((row) => row.id === id) : undefined;
      if (goal && !goal.purchaseId) lines.push(goalLine(id!, name, amount, nextStep, member));
    }
  }
  const draftId = `PLAN-STORY-${month}`;
  const when = iso(date, 8);
  let next = at(h, when, (x) => savePlanDraft(x, { id: draftId, memberId: by, scope: "household", targetMonth: month, lines, assumptions: [], note: "Fictional: our month, written together", createdBy: by }));
  next = at(next, iso(date, 8, 10), (x) => proposeHouseholdPlan(x, { memberId: by, draftId, reason: "Fictional: our month", createdBy: by }));
  const version = currentPlanVersion(next, "household", month, by);
  if (version && version.state === "proposed") {
    next = at(next, iso(date, 8, 20), (x) => acknowledgeHouseholdPlan(x, { planVersionId: version.id, expectedDigest: version.digest, memberId: by, createdBy: by }));
    next = at(next, iso(date, 20, 30), (x) => acknowledgeHouseholdPlan(x, { planVersionId: version.id, expectedDigest: version.digest, memberId: other, createdBy: other }));
  }
  next = at(next, iso(date, 21), (x) => setHouseholdFundMonthPlan(x, { memberId: M1, monthKey: month, target, buffer: 200 }));
  return next;
}

/** The Shared Sitdown for a month, closed once both acknowledged the exact Plan. */
function sitdown(h: Household, c: StoryContext, k: number, date: DateKey): Household {
  const month = monthOf(c, k);
  const version = (h.planVersions ?? []).filter((row) => row.scope === "household" && row.monthKey === month && row.state === "active").sort((a, b) => b.sequence - a.sequence)[0];
  if (!version) return h;
  const sitId = `SIT-STORY-${month}`;
  let next = at(h, iso(date, 19), (x) => appendPlanSitdownTurn(x, { sitDownSessionId: sitId, monthKey: month, planDraftId: version.id, memberId: M1, text: "Fictional: what went well, what was hard, what we want next." }));
  const session = (next.planHerculesSessions ?? []).find((row) => row.sitDownSessionId === sitId && row.state === "active");
  if (!session) return next;
  next = at(next, iso(date, 19, 30), (x) => appendPlanSitdownTurn(x, {
    sessionId: session.id, sitDownSessionId: sitId, monthKey: month, planDraftId: version.id, memberId: M2, text: "Fictional: agreed — same plan, one small change.",
    expectedUpdatedAt: session.updatedAt, checkpoint: { stage: 7, decision: "Keep the plan we both acknowledged.", rhythm: "Sunday coffee, ten minutes, once a month.", close: true, planVersionId: version.id },
  }));
  return next;
}

// ---------------------------------------------------------------------------
// Kitty Banks

type Bank = { name: string; target: number; share: number; from: number; to: number; created: number; createdDay?: number; buy?: number; buyCategory?: string; buyNote?: string };

const BANKS: Bank[] = [
  { name: "Housewarming", target: 250, share: 1, from: -24, to: -24, created: -24, buy: -23, buyCategory: "Birthdays & parties", buyNote: "Housewarming party" },
  { name: "Emergency buffer", target: 4000, share: 0.6, from: -18, to: -1, created: -18, createdDay: 3 },
  { name: "The sofa", target: 2400, share: 1, from: -12, to: -4, created: -13, buy: -3, buyCategory: "Furniture", buyNote: "The sofa" },
  { name: "Bed & mattress", target: 1800, share: 0.72, from: -11, to: -1, created: -13 },
  { name: "Dining table & chairs", target: 1200, share: 0.45, from: -10, to: -1, created: -13 },
  { name: "Desk & bookshelf", target: 1100, share: 0.25, from: -6, to: -1, created: -13 },
  { name: "Kitchen things", target: 700, share: 0.6, from: -12, to: -1, created: -13 },
  { name: "Rug & lamps", target: 600, share: 0.3, from: -9, to: -1, created: -13 },
  { name: "Art & frames", target: 300, share: 0.1, from: -2, to: -2, created: -13 },
  { name: "Plant corner", target: 90, share: 1, from: -7, to: -5, created: -13 },
  { name: "Tofino trip", target: 3200, share: 1, from: -12, to: -3, created: -13, buy: -2, buyCategory: "Travel", buyNote: "Tofino: flights and the cabin" },
  { name: "House down payment", target: 70000, share: 1500 / 70000, from: -1, to: -1, created: -13 },
  { name: "Closing costs", target: 9000, share: 0, from: 0, to: -1, created: -13 },
  { name: "Retirement nest", target: 600000, share: 0, from: 0, to: -1, created: -13 },
];

/** How much a bank takes in month k: its fill spread over its non-lean months, the last one taking the remainder. */
function bankPlan(c: StoryContext, bank: Bank): Map<number, number> {
  const out = new Map<number, number>();
  const total = Math.round(bank.target * bank.share * 100);
  if (total <= 0) return out;
  const months: number[] = [];
  for (let k = bank.from; k <= bank.to; k += 1) if (!lean(c, k)) months.push(k);
  if (!months.length) return out;
  const each = Math.floor(total / months.length / 500) * 500 || Math.floor(total / months.length);
  let left = total;
  months.forEach((k, index) => {
    const cents = index === months.length - 1 ? left : Math.min(left, each);
    if (cents > 0) out.set(k, cents);
    left -= cents;
  });
  return out;
}

/**
 * Each bank's studio piece, dressed for what it is for (the Kitty Bank studio grammar): a purpose, a glaze, a body,
 * a face and one or two baked-on add-ons. Fired the day the bank was made, so the loft and the island stand real
 * pieces. Kind decides the nest shelf: the furnishing, trip, house and retirement banks are Build (the loft's ledge);
 * the cushion and the buffer are Protect.
 */
type BankLook = { kind: GoalEnvelope["kind"]; purpose: string; glaze: GoalEnvelope["glaze"]; base: string; body: "round" | "pear" | "loaf" | "tall" | "bean"; eyes: "open" | "happy" | "wide" | "sleepy" | "sparkle" | "wink" | "closed"; mouth: "smile" | "w" | "tongue" | "grin" | "serene" | "oh"; ears?: "pointed" | "round" | "folded" | "tufted" | "none"; addons: [KittyStampV1["kind"], KittyStampV1["anchor"], string][] };
const LOOKS: Record<string, BankLook> = {
  "Moving-in cushion": { kind: "protect", purpose: "A soft landing for the first year", glaze: "sea-glass", base: "#8da99b", body: "loaf", eyes: "sleepy", mouth: "serene", addons: [["key", "chest", "#c9a227"]] },
  Housewarming: { kind: "build", purpose: "Friends over for the first time", glaze: "rose", base: "#e4a9b4", body: "round", eyes: "happy", mouth: "grin", addons: [["party-hat", "forehead", "#e05a7a"], ["balloon", "back", "#f2c14e"]] },
  "Emergency buffer": { kind: "protect", purpose: "Breathing room for the surprises", glaze: "midnight", base: "#41546b", body: "loaf", eyes: "open", mouth: "serene", ears: "folded", addons: [["scarf", "chest", "#d9a441"]] },
  "The sofa": { kind: "build", purpose: "Somewhere soft for movie nights", glaze: "terracotta", base: "#b66c50", body: "loaf", eyes: "closed", mouth: "w", addons: [["bowtie", "chest", "#3f6c8f"]] },
  "Bed & mattress": { kind: "build", purpose: "Proper sleep, finally", glaze: "cream", base: "#dfe6f2", body: "bean", eyes: "sleepy", mouth: "serene", ears: "round", addons: [["beanie", "forehead", "#7d8fc4"], ["moon", "back", "#f2d16b"]] },
  "Dining table & chairs": { kind: "build", purpose: "Dinner at a real table", glaze: "terracotta", base: "#c98a5b", body: "round", eyes: "happy", mouth: "tongue", addons: [["cupcake", "belly", "#f08fb1"]] },
  "Desk & bookshelf": { kind: "build", purpose: "A corner to work and read", glaze: "midnight", base: "#5b6f8a", body: "tall", eyes: "wide", mouth: "oh", addons: [["glasses", "forehead", "#2b2b2b"]] },
  "Kitchen things": { kind: "build", purpose: "Pots, knives and a good pan", glaze: "sea-glass", base: "#a8c3b1", body: "pear", eyes: "open", mouth: "smile", addons: [["star", "belly", "#e9b949"]] },
  "Rug & lamps": { kind: "build", purpose: "Warm light and a soft floor", glaze: "rose", base: "#d9a07a", body: "round", eyes: "sparkle", mouth: "smile", ears: "tufted", addons: [["sun", "back", "#f2b441"]] },
  "Art & frames": { kind: "build", purpose: "Our walls, our pictures", glaze: "cream", base: "#f3e6cc", body: "pear", eyes: "wink", mouth: "grin", addons: [["flower", "leftCheek", "#c9677f"], ["heart", "rightFlank", "#a63968"]] },
  "Plant corner": { kind: "build", purpose: "A little jungle by the window", glaze: "sea-glass", base: "#7fae7a", body: "bean", eyes: "happy", mouth: "w", addons: [["leaf", "forehead", "#4f8a4b"]] },
  "Tofino trip": { kind: "build", purpose: "Waves, cabin, no phones", glaze: "sea-glass", base: "#6fb2c7", body: "round", eyes: "sparkle", mouth: "grin", addons: [["sun-hat", "forehead", "#e9c46a"], ["sunglasses", "forehead", "#2b2b2b"], ["suitcase", "rightFlank", "#b5653e"]] },
  "House down payment": { kind: "build", purpose: "The keys to our first house", glaze: "cream", base: "#efe3c8", body: "tall", eyes: "open", mouth: "smile", addons: [["key", "chest", "#c9a227"], ["crown", "forehead", "#e9b949"]] },
  "Closing costs": { kind: "build", purpose: "Lawyers, inspections and the movers", glaze: "midnight", base: "#6b7a8f", body: "loaf", eyes: "sleepy", mouth: "oh", addons: [["ticket", "chest", "#d9a441"]] },
  "Retirement nest": { kind: "build", purpose: "A garden and a porch, one day", glaze: "rose", base: "#cda1a0", body: "pear", eyes: "closed", mouth: "serene", ears: "round", addons: [["sun-hat", "forehead", "#9c7a55"], ["palm", "back", "#5f8a62"]] },
};
function bankEnvelope(name: string, firedAt: string, by: string): GoalEnvelope | undefined {
  const look = LOOKS[name];
  if (!look) return undefined;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);
  const stamps: KittyStampV1[] = look.addons.map(([kind, anchor, color], i) => ({ id: `stamp-${slug}-${i}`, anchor, kind, color, size: 0.3, rotation: 0 }));
  const piece = {
    id: `piece-${slug}`,
    createdAt: firedAt,
    firedAt,
    firedBy: by,
    sculpt: { ...defaultKittySculpt(), body: look.body, eyes: look.eyes, mouth: look.mouth, ...(look.ears ? { ears: look.ears } : {}) },
    paint: { base: look.base, parts: {}, strokes: [], stamps },
  };
  return { version: 1, kind: look.kind, purpose: look.purpose, refill: "target", glaze: look.glaze, archivedAt: null, studio: { version: 1, draft: null, fired: [piece], displayId: piece.id } };
}

const bankDay = (bank: Bank) => bank.createdDay ?? (bank.created === -24 ? 2 : 24);

function createBank(h: Household, c: StoryContext, bank: Bank): Household {
  const owner = bank.name === "Tofino trip" || bank.name === "House down payment" ? M2 : M1;
  const when = iso(dayIn(c, bank.created, bankDay(bank)), 18);
  const envelope = bankEnvelope(bank.name, when, owner);
  const next = at(h, when, (x) => addGoal(x, { name: bank.name, target: bank.target, shared: true, ownerMemberId: owner, ...(envelope ? { envelope } : {}) }));
  const row = next.goals.find((g) => g.name === bank.name && g.shared);
  if (row) c.goal[bank.name] = row.id;
  return next;
}

function fundBank(h: Household, c: StoryContext, bank: Bank, cents: number, date: DateKey, by: string): Household {
  const id = c.goal[bank.name];
  if (!id) return h;
  const savings = bookBalanceAsOf(h, SAV, date);
  const from = savings - cents >= 500_000 ? SAV : CHQ;
  return fundGoal(h, { goalId: id, amount: cents / 100, fromAccountId: from, date, createdBy: by, visibility: "household" }).household;
}

// ---------------------------------------------------------------------------
// Everyday life the island reads

type Spend = { k: number; day: number; amount: number; category: string; note: string; place: string; by?: string; account?: string; personal?: boolean };

function everyday(c: StoryContext): Spend[] {
  const out: Spend[] = [];
  const home = c.cat["Furniture"]!, garden = c.cat["Plants & garden"]!, pets = c.cat["Pet food"]!, travel = c.cat["Travel"]!;
  const gifts = c.cat["Gifts"]!, party = c.cat["Birthdays & parties"]!, pottery = c.cat["Pottery"]!, gym = c.cat["Gym & running"]!;
  const car = c.cat["Car insurance & repairs"]!;
  // Moving in
  out.push({ k: -24, day: 4, amount: 468.4, category: home, note: "Flat-pack basics for the new place", place: "Furniture store", by: M1, account: CHQ });
  out.push({ k: -24, day: 6, amount: 86.2, category: home, note: "Hooks, shelves and a drill bit", place: "Hardware store", by: M2 });
  out.push({ k: -22, day: 13, amount: 38.5, category: garden, note: "A pothos and a fern", place: "Garden centre", by: M1 });
  for (const k of [-15, -9]) out.push({ k, day: 17, amount: vary(c, 95, 25), category: home, note: "Something for the flat", place: "Home goods", by: k === -15 ? M1 : M2 });
  for (let k = -24; k <= 0; k += 1) {
    const month = calMonth(c, k);
    // Hercules: litter and the odd toy
    out.push({ k, day: 15, amount: vary(c, 26, 6), category: pets, note: "Litter and a toy for Hercules", place: "Pet shop", by: k % 2 ? M1 : M2 });
    // Plants in the spring
    if (month >= 4 && month <= 6) out.push({ k, day: 19, amount: vary(c, 55, 15), category: garden, note: "Balcony plants", place: "Garden centre", by: M1 });
    // Running shoes each spring
    if (month === 4) out.push({ k, day: 21, amount: vary(c, 140, 10), category: gym, note: "Running shoes", place: "Running shop", by: M2 });
    // Gifts in December
    if (month === 12) {
      out.push({ k, day: 12, amount: vary(c, 185, 30), category: gifts, note: "Holiday gifts for family", place: "Bookshop", by: M1 });
      out.push({ k, day: 18, amount: vary(c, 120, 20), category: gifts, note: "Gifts for friends", place: "Market", by: M2 });
    }
    // Birthdays: Bianca in October, Jonathan in April
    if (month === 10) out.push({ k, day: 17, amount: vary(c, 120, 15), category: party, note: "Bianca's birthday dinner party", place: "Home", by: M2 });
    if (month === 4) out.push({ k, day: 9, amount: vary(c, 95, 10), category: party, note: "Jonathan's birthday picnic", place: "Trinity Bellwoods", by: M1 });
    // Pottery supplies once the studio started
    if (k >= -10) out.push({ k, day: 26, amount: vary(c, 32, 8), category: pottery, note: "Clay and glaze", place: "Clay studio", by: M1 });
    // Lean winters: the year's heavy essential lands in January or February
    if (month === 1 && k < -12) out.push({ k, day: 16, amount: 2150, category: car, note: "Car insurance, the year up front", place: "Fictional insurer", by: M2, account: CHQ });
    if (month === 1 && k >= -12) out.push({ k, day: 16, amount: 3250, category: car, note: "Winter tires, brakes and a battery", place: "Neighbourhood garage", by: M2, account: CHQ });
    if (month === 2) out.push({ k, day: 17, amount: 2050, category: "SUB-HEALTH-DENTAL", note: "Dental crown and a root canal (after benefits)", place: "Queen West Dental", by: M1, account: CHQ });
    if (month <= 2) out.push({ k, day: 23, amount: vary(c, 160, 20), category: "SUB-FOOD-GROCERIES", note: "Stock-up for the cold weeks", place: "No Frills", by: M1 });
    // A few Personal rows that never reach the island
    if (k % 3 === 0) out.push({ k, day: 11, amount: 38, category: "SUB-HEALTH-CARE", note: "Haircut", place: "Barber", by: M2, personal: true });
    if (k === -16 || k === -4) out.push({ k, day: 24, amount: vary(c, 120, 20), category: gym, note: "Jonathan's running gear", place: "Running shop", by: M2, personal: true });
  }
  // Friends and small joys, when the month has room
  for (let k = -24; k <= 0; k += 1) {
    if (lean(c, k)) continue;
    out.push({ k, day: 13, amount: vary(c, 140, 30), category: "SUB-FOOD-COFFEE", note: "Dinner with friends", place: "Neighbourhood bistro", by: k % 2 ? M2 : M1 });
    if (((k % 3) + 3) % 3 === 1) out.push({ k, day: 20, amount: vary(c, 110, 20), category: "SUB-LIFE-FUN", note: "Concert tickets", place: "Massey Hall", by: M2 });
  }
  // Trips
  out.push({ k: -14, day: 12, amount: 265, category: travel, note: "Cottage weekend: groceries and gas", place: "Muskoka", by: M2 });
  out.push({ k: -11, day: 8, amount: 212, category: travel, note: "Train to Montréal", place: "VIA Rail", by: M1 });
  out.push({ k: -11, day: 9, amount: 384, category: travel, note: "Montréal hotel, two nights", place: "Montréal", by: M1 });
  out.push({ k: -2, day: 15, amount: 180, category: travel, note: "Tofino: ferry and tacos", place: "Tofino", by: M2 });
  return out;
}

function spendStep(c: StoryContext, spend: Spend): Step | null {
  const date = dayIn(c, spend.k, spend.day);
  if (date >= c.today) return null;
  return {
    date, order: 30, run: (h) => postEntry(h, {
      type: "expense", date, amount: spend.amount, accountId: spend.account ?? VISA, subcategoryId: spend.category, note: spend.note, place: spend.place,
      createdBy: spend.by ?? M1, visibility: spend.personal ? "personal" : "household", confirmDuplicate: true,
      ...(spend.personal ? { splits: [{ party: spend.by ?? M1, amountCents: Math.round(spend.amount * 100) }] } : {}),
    }).household,
  };
}

// ---------------------------------------------------------------------------
// The money story, month by month

function moneyStory(h: Household, c: StoryContext): Household {
  let next = h;
  const bankPlans = new Map(BANKS.map((bank) => [bank.name, bankPlan(c, bank)]));
  const spends = [...everyday(c), ...yearlyMemberships(c)];
  for (let k = -24; k <= 0; k += 1) {
    const steps: Step[] = [];
    // Banks are created before their first money arrives.
    for (const bank of BANKS) if (bank.created === k) steps.push({ date: dayIn(c, k, bankDay(bank)), order: 1, run: (x) => createBank(x, c, bank) });
    if (k === -10) steps.push({ date: dayIn(c, k, 1), order: 2, run: (x) => addBill(x, c, BILLS.find((b) => b.note === "Pottery studio")!) });
    if (k === -1) {
      steps.push({ date: dayIn(c, k, 8), order: 2, run: (x) => roasterCategory(x, c) });
      steps.push({ date: dayIn(c, k, 8), order: 3, run: (x) => addBill(x, c, BILLS.find((b) => b.note === "Coffee beans")!) });
    }
    // The month's plan, agreed by both on the 1st (decisions fork the path while we built breathing room, and this month).
    steps.push({ date: dayIn(c, k, 1), order: 5, run: (x) => monthPlan(x, c, k, (k >= -12 && k <= -6) || k === 0) });
    // Both of us pay into the Fund on the 2nd; Jonathan's is smaller in the slow winter months.
    const contribDate = dayIn(c, k, 2);
    if (contribDate <= c.today) {
      steps.push({ date: contribDate, order: 10, run: (x) => contribute(x, M1, 2450, contribDate) });
      steps.push({ date: contribDate, order: 11, run: (x) => contribute(x, M2, lean(c, k) ? 700 : 1150, contribDate) });
    }
    for (const bill of BILLS) {
      const step = billStep(c, bill, k);
      if (step) steps.push(step);
    }
    // The meal kit went at the end of the first winter.
    if (k === -17) steps.push({ date: dayIn(c, k, 2), order: 4, run: (x) => pauseRecurrence(x, c.rec["Meal kit"]!).household });
    for (const spend of spends.filter((row) => row.k === k)) {
      const step = spendStep(c, spend);
      if (step) steps.push(step);
    }
    // The storm: an emergency vet visit, covered from the Moving-in cushion through the Fund.
    if (k === -19) {
      const date = dayIn(c, k, 9);
      steps.push({
        date, order: 40, run: (x) => {
          const posted = postEntry(x, { type: "expense", date, amount: 600, accountId: CHQ, subcategoryId: "SUB-HEALTH-VET", note: "Emergency vet — Hercules", place: "Annex Cat Clinic", createdBy: M1, visibility: "household", confirmDuplicate: true, funding: { fundId: x.householdFund!.id, fundedCents: 60_000, destinationAccountId: CHQ } }).household;
          return releaseHouseholdFundKitty(posted, { memberId: M1, amount: 600, date, goalId: c.goal["Moving-in cushion"], note: "Fictional: Hercules's emergency, from the Moving-in cushion" }).household;
        },
      });
    }
    // Kitty Bank money, after payday (the 22nd), never in the lean winter months.
    for (const bank of BANKS) {
      const cents = bankPlans.get(bank.name)?.get(k);
      const date = dayIn(c, k, 22);
      if (cents && date < c.today) steps.push({ date, order: 50, run: (x) => fundBank(x, c, bank, cents, date, k % 2 ? M1 : M2) });
      if (bank.buy === k) {
        const buyDate = dayIn(c, k, bank.name === "Housewarming" ? 20 : 12);
        if (buyDate < c.today) steps.push({ date: buyDate, order: 60, run: (x) => purchaseGoal(x, { goalId: c.goal[bank.name]!, amount: bank.target, date: buyDate, subcategoryId: c.cat[bank.buyCategory!], lines: [{ note: bank.buyNote!, amount: bank.target }], createdBy: bank.name === "Tofino trip" ? M2 : M1 }).household });
      }
    }
    // Pay ourselves first, the day after Bianca's payday.
    const saveDate = dayIn(c, k, 8);
    if (saveDate < c.today) {
      steps.push({
        date: saveDate, order: 35, run: (x) => {
          // Whatever chequing can spare above a working float of $4,000, up to the month's amount.
          const spare = Math.floor((bookBalanceAsOf(x, CHQ, saveDate) - 400_000) / 10_000) * 100;
          const amount = Math.min(lean(c, k) ? 500 : 2500, spare);
          if (amount < 100) return x;
          return postTransfer(x, { date: saveDate, amount, fromAccountId: CHQ, toAccountId: SAV, note: "Pay ourselves first", confirmDuplicate: true, createdBy: M1, visibility: "household" }).household;
        },
      });
    }
    // Month end: the Fund pays the chequing account back, rolls surplus into the cushion, and ties to the bank.
    const end = dayIn(c, k, 28);
    if (end < c.today) {
      steps.push({ date: end, order: 80, run: (x) => settle(x, end) });
      steps.push({ date: end, order: 81, run: (x) => refillCushion(x, c, end, (2000_00 - cushionReserved(x, c)) / 100 >= 1 ? Math.min(k === -18 ? 600 : 500, (2000_00 - cushionReserved(x, c)) / 100) : 0) });
      steps.push({ date: end, order: 82, run: (x) => reconcileTied(x, end, "Fictional month-end reconciliation") });
      if (k >= -23) steps.push({ date: end, order: 83, run: (x) => sitdown(x, c, k, end) });
    } else if (k === 0) {
      const mid = addDays(c.today, -1);
      steps.push({ date: mid, order: 80, run: (x) => settle(x, mid) });
      steps.push({ date: mid, order: 82, run: (x) => reconcileTied(x, mid, "Fictional weekly reconciliation") });
      steps.push({ date: mid, order: 83, run: (x) => sitdown(x, c, k, mid) });
    }
    steps.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
    for (const step of steps) next = atSyntheticClock(iso(step.date, 12), () => step.run(next));
  }
  return next;
}

// ---------------------------------------------------------------------------
// Chapters, wins and memories

function chapters(h: Household, c: StoryContext): Household {
  let next = h;
  const chapter = () => openChapterFor(next)!;
  const ritualOf = (id: string) => (next.rituals ?? []).find((row) => row.chapterId === id)!;
  const hold = (k: number, day: number, by: string) => {
    const date = dayIn(c, k, day);
    if (date > c.today) return;
    next = recordRitualHeld(next, { memberId: by, ritualId: ritualOf(chapter().id).id, onDate: date, at: iso(date, 20) }).household;
  };
  const doFirstMove = (k: number, day: number, by: string, evidenceRef?: string) => {
    const move = movesForChapter(next, chapter().id).find((row) => row.state === "offered");
    if (!move) return;
    next = respondToMove(next, { memberId: by === M1 ? M2 : M1, moveId: move.id, response: "accept", at: iso(dayIn(c, k, day), 19) }).household;
    next = completeMove(next, { memberId: by, moveId: move.id, ...(evidenceRef ? { evidenceRef } : {}), at: iso(dayIn(c, k, day + 1), 19) }).household;
  };
  const close = (k: number, day: number, by: string, outcome: "established" | "still-forming", carry: string) => {
    next = closeChapter(next, { memberId: by, chapterId: chapter().id, outcome, carryForward: carry, at: iso(dayIn(c, k, day), 21) }).household;
  };

  // 1 · See our shared life (M−24 → M−19)
  next = openChapter(next, { memberId: M1, foundationId: "see-our-shared-life", at: iso(dayIn(c, -24, 3), 19) }).household;
  for (let k = -24; k <= -19; k += 1) hold(k, 14, k % 2 ? M1 : M2);
  hold(-19, 10, M1); // the evening after the vet
  doFirstMove(-24, 10, M2);
  // Closed at the first Sitdown after the storm, which opened the next Chapter (the storm month keeps its creek).
  close(-18, 1, M2, "established", "Fictional: we both know where the truth comes from.");

  // 2 · Handle a surprise together (after the storm → M−16)
  next = openChapter(next, { memberId: M1, foundationId: "handle-a-surprise-together", at: iso(dayIn(c, -18, 1), 22) }).household;
  hold(-18, 2, M1); hold(-18, 16, M2); hold(-17, 6, M1);
  doFirstMove(-18, 3, M1);
  next = offerMove(next, { memberId: M1, chapterId: chapter().id, text: "Fictional: refill the cushion before anything new", at: iso(dayIn(c, -18, 4), 19) }).household;
  {
    const move = movesForChapter(next, chapter().id).find((row) => row.state === "offered")!;
    next = respondToMove(next, { memberId: M2, moveId: move.id, response: "accept", at: iso(dayIn(c, -18, 5), 19) }).household;
    next = completeMove(next, { memberId: M1, moveId: move.id, at: iso(dayIn(c, -18, 28), 21) }).household;
  }
  close(-16, 3, M2, "established", "Fictional: when something breaks, we sit down the same evening.");

  // 3 · Make rent boring (M−16 → M−12): the pre-rent ritual held most weeks
  next = openChapter(next, { memberId: M2, foundationId: "make-rent-boring", at: iso(dayIn(c, -16, 4), 19) }).household;
  for (let k = -16; k <= -13; k += 1) for (const day of [4, 11, 18, 25]) if (!(k === -15 && day === 18) && !(k === -14 && day === 11)) hold(k, day, day % 2 ? M1 : M2);
  doFirstMove(-16, 6, M1);
  close(-12, 5, M1, "established", "Fictional: rent is the most boring day of the month now.");

  // 4 · Build breathing room (M−12 → M−6)
  next = openChapter(next, { memberId: M1, foundationId: "build-breathing-room", at: iso(dayIn(c, -12, 6), 19) }).household;
  for (let k = -12; k <= -7; k += 1) { hold(k, 7, M1); hold(k, 22, M2); }
  doFirstMove(-12, 8, M2);
  close(-6, 4, M2, "established", "Fictional: a cushion first, then the fun.");

  // 5 · Share the mental load (M−6 → M−1): still forming
  next = openChapter(next, { memberId: M2, foundationId: "share-the-mental-load", at: iso(dayIn(c, -6, 5), 19) }).household;
  for (let k = -6; k <= -2; k += 1) { hold(k, 9, M2); if (k % 2 === 0) hold(k, 23, M1); }
  doFirstMove(-6, 7, M1);
  close(-1, 4, M1, "still-forming", "Fictional: the list lives on the fridge; we still forget whose week it is.");

  // 6 · Make room for joy (opened M−1): three rituals held, one Move waiting on Bianca
  next = openChapter(next, { memberId: M2, foundationId: "make-room-for-joy", at: iso(dayIn(c, -1, 5), 19) }).household;
  hold(-1, 7, M2); hold(-1, 22, M1);
  const lastHold = addDays(c.today, -2);
  next = recordRitualHeld(next, { memberId: M2, ritualId: ritualOf(chapter().id).id, onDate: lastHold, at: iso(lastHold, 20) }).household;
  next = offerMove(next, { memberId: M2, chapterId: chapter().id, text: "Fictional: a movie night every second Friday, snacks from the joy jar", ownerMemberId: M2, needsAcknowledgment: true, at: iso(addDays(c.today, -1), 20) }).household;

  // Wins: the housewarming (a First), the sofa (a First, kept by both), Tofino (a shared win)
  const purchaseTx = (goalName: string) => next.transactions.find((tx) => tx.type === "expense" && (next.goalPurchases ?? []).some((p) => p.goalId === c.goal[goalName] && p.transactionIds.includes(tx.id)))?.id
    ?? (next.goalPurchases ?? []).find((p) => p.goalId === c.goal[goalName])?.id;
  const housewarming = purchaseTx("Housewarming");
  if (housewarming) next = recordWin(next, { memberId: M1, level: "first", title: "Our first housewarming", evidenceRefs: [housewarming], chapterId: next.chapters?.[0]?.id ?? null, at: iso(dayIn(c, -23, 21), 12) }).household;
  const sofa = purchaseTx("The sofa");
  if (sofa) {
    next = recordWin(next, { memberId: M2, level: "first", title: "The sofa is home", evidenceRefs: [sofa], at: iso(dayIn(c, -3, 13), 18) }).household;
    const win = (next.wins ?? []).find((row) => row.title === "The sofa is home")!;
    next = keepWinAsMemory(next, { memberId: M2, winId: win.id, authoredNote: "Fictional: we sat on it for the first time and did not get up for a whole film.", at: iso(dayIn(c, -3, 13), 19) }).household;
    next = keepWinAsMemory(next, { memberId: M1, winId: win.id, at: iso(dayIn(c, -3, 14), 9) }).household;
  }
  const tofino = purchaseTx("Tofino trip");
  if (tofino) next = recordWin(next, { memberId: M1, level: "shared-win", title: "Tofino, paid before we left", evidenceRefs: [tofino], at: iso(dayIn(c, -2, 13), 18) }).household;
  return next;
}

// ---------------------------------------------------------------------------
// Charter, the island's name, the calendar, tasks, bridges and a recipe

function charterAndName(h: Household, c: StoryContext): Household {
  const founded = dayIn(c, -24, 2);
  let next = at(h, iso(founded, 20), (x) => foundHouseholdCharter(x, { memberId: M1, custodianMemberId: M1, purpose: "Fictional: a home that is calm about money, and room for the good things.", splitRule: "even", splitNote: "Fictional: in proportion to what we earn, roughly.", ceilingKind: "none", cadence: "weekly", cadenceWeekday: 0, date: founded }));
  next = at(next, iso(founded, 20, 30), (x) => signHouseholdCharter(x, { memberId: M2, at: iso(founded, 20, 30) }));
  next = at(next, iso(founded, 20, 40), (x) => signHouseholdCharter(x, { memberId: M1, at: iso(founded, 20, 40) }));
  // Jonathan's tip-outs are work, not life: the couple keep them off the island.
  if (next.categories.some((row) => row.id === "SUB-WORK-TIP-OUTS")) next = setPathCategorySignal(next, { memberId: M2, categoryId: "SUB-WORK-TIP-OUTS", signal: "none", at: iso(dayIn(c, -23, 10), 20) }).household;
  next = proposePathName(next, { memberId: M2, name: "Harbour Light", at: iso(dayIn(c, -23, 10), 21) }).household;
  next = proposePathName(next, { memberId: M1, name: "Harbour Light", at: iso(dayIn(c, -23, 11), 8) }).household;
  return next;
}

function trips(h: Household, c: StoryContext): Household {
  let next = h;
  const trip = (id: string, title: string, k: number, day: number, nights: number, location: string, by: string) => {
    const start = dayIn(c, k, day);
    const when = iso(dayIn(c, k - 1, 20), 20);
    next = saveNativeEvent(next, { memberId: by, id, expectedRevision: 0, event: {
      visibility: "household", title, start, end: addDays(start, nights), allDay: true, timezone: "America/Toronto", fold: "earlier",
      repeat: "none", until: null, location, notes: "Fictional trip", exceptions: {}, deleted: false,
    } }).household;
    next = restamp(next, "nativeEvents", id, when);
  };
  trip("EVENT-STORY-COTTAGE", "Cottage weekend with friends", -14, 11, 2, "A friend's cottage by the lake", M2);
  trip("EVENT-STORY-MONTREAL", "Weekend in Montréal", -11, 8, 2, "Montréal", M1);
  trip("EVENT-STORY-TOFINO", "Tofino trip", -2, 14, 6, "Tofino beach", M2);
  return next;
}

function tasks(h: Household, c: StoryContext): Household {
  let next = h;
  const base = (patch: Partial<Task>): Parameters<typeof saveTask>[1]["task"] => ({
    visibility: "household", title: "", notes: "", listId: null, parentId: null, doDate: null, dueDate: null, repeat: "none", cue: "none",
    assigneeId: null, backupId: null, chapterId: null, planReference: null, moneyLink: null, expectedAmountCents: null, deleted: false, ...patch,
  } as Parameters<typeof saveTask>[1]["task"]);
  const save = (id: string, by: string, when: string, patch: Partial<Task>) => {
    next = saveTask(next, { memberId: by, id, expectedRevision: 0, task: base(patch) }).household;
    next = restamp(next, "tasks", id, when);
  };
  const done = (id: string, by: string, when: string, evidence?: Parameters<typeof completeTask>[1]["evidence"]) => {
    const row = next.tasks!.find((t) => t.id === id)!;
    next = completeTask(next, { memberId: by, id, expectedRevision: row.revision, completedAt: when, ...(evidence ? { evidence } : {}) }).household;
    next = restamp(next, "tasks", id, when);
  };
  save("TASK-STORY-MOVERS", M2, iso(dayIn(c, -25, 20), 20), { title: "Book the movers", assigneeId: M2, backupId: M1, dueDate: dayIn(c, -24, 1) });
  done("TASK-STORY-MOVERS", M2, iso(dayIn(c, -25, 22), 18));
  // A money task: done only because the payment is in the books.
  const hydro = next.transactions.find((tx) => tx.note === "Toronto Hydro" && tx.date === dayIn(c, -24, 8));
  if (hydro) {
    save("TASK-STORY-HYDRO", M1, iso(dayIn(c, -24, 3), 20), { title: "Pay the first hydro bill", assigneeId: M1, backupId: M2, dueDate: hydro.date, moneyLink: { kind: "recurrence", recurrenceId: c.rec["Toronto Hydro"]!, date: hydro.date }, expectedAmountCents: hydro.amountCents });
    done("TASK-STORY-HYDRO", M1, iso(hydro.date, 18), { kind: "transaction", transactionId: hydro.id, amountCents: hydro.amountCents, date: hydro.date });
  }
  save("TASK-STORY-MEASURE", M1, iso(dayIn(c, -5, 2), 20), { title: "Measure the living room for the sofa", assigneeId: M1, backupId: M2, dueDate: dayIn(c, -4, 10) });
  done("TASK-STORY-MEASURE", M1, iso(dayIn(c, -4, 6), 18));
  save("TASK-STORY-FERRY", M2, iso(dayIn(c, -4, 2), 20), { title: "Book the Tofino ferry", assigneeId: M2, backupId: M1, dueDate: dayIn(c, -3, 1) });
  done("TASK-STORY-FERRY", M2, iso(dayIn(c, -4, 27), 18));
  save("TASK-STORY-PAINT", M1, iso(addDays(c.today, -6), 20), { title: "Pick paint samples for the bedroom", assigneeId: M1, backupId: M2, dueDate: addDays(c.today, 10) });
  // Jonathan's private footpath
  save("TASK-STORY-BEDFRAMES", M2, iso(addDays(c.today, -4), 22), { visibility: "personal", title: "Price out bed frames", dueDate: addDays(c.today, 9) });
  return next;
}

function bridgeAndRecipe(h: Household, c: StoryContext): Household {
  const when = iso(addDays(c.today, -3), 21);
  let next = at(h, when, (x) => savePlanBridgeDraft(x, { monthKey: c.M, kind: "contribution", label: "Dining table sooner", amountCents: 20_000, memberId: M2, createdBy: M2 }));
  const draft = (next.planBridgeDrafts ?? []).find((row) => row.ownerMemberId === M2 && row.label === "Dining table sooner");
  if (draft) next = at(next, iso(addDays(c.today, -3), 21, 5), (x) => sharePlanBridgeDraft(x, { draftId: draft.id, memberId: M2, createdBy: M2 }));
  next = proposePathRecipe(next, { memberId: M1, spec: { name: "Movie nights hang lanterns", when: { categoryId: "SUB-LIFE-FUN" }, brush: "lanterns", on: true }, at: iso(addDays(c.today, -1), 21) }).household;
  // Two planned costs ahead: the yearly memberships (Hearth's recurrences are monthly at most).
  const nextOf = (month: number) => {
    for (let k = 0; k <= 12; k += 1) if (calMonth(c, k) === month && dayIn(c, k, 15) > c.today) return dayIn(c, k, 15);
    return dayIn(c, 12, 15);
  };
  next = at(next, iso(addDays(c.today, -1), 9), (x) => addPotentialExpense(x, { date: nextOf(11), title: "Online shopping membership (yearly)", amount: 99, accountId: VISA, subcategoryId: "SUB-LIFE-FUN", createdBy: M2, visibility: "household" }));
  next = at(next, iso(addDays(c.today, -1), 9, 5), (x) => addPotentialExpense(x, { date: nextOf(3), title: "Membership store (yearly)", amount: 65, accountId: VISA, subcategoryId: "SUB-FOOD-GROCERIES", createdBy: M1, visibility: "household" }));
  return next;
}

/** The yearly memberships, paid in their month in the years behind us. */
function yearlyMemberships(c: StoryContext): Spend[] {
  const out: Spend[] = [];
  for (let k = -24; k <= 0; k += 1) {
    if (calMonth(c, k) === 3) out.push({ k, day: 15, amount: 65, category: "SUB-FOOD-GROCERIES", note: "Membership store (yearly)", place: "Membership store", by: M1 });
    if (calMonth(c, k) === 11) out.push({ k, day: 15, amount: 99, category: "SUB-LIFE-FUN", note: "Online shopping membership (yearly)", place: "Online shop", by: M2 });
  }
  return out;
}

// ---------------------------------------------------------------------------
// The journey

function agreeWaiting(h: Household, memberId: string, when: string): Household {
  let next = h;
  for (const row of pendingPathProposals(next)) {
    if (row.kind !== "era" || row.agreedByMemberIds.includes(memberId)) continue;
    next = agreePathProposal(next, { memberId, rowId: row.id, revision: row.pendingRevision, at: when }).household;
  }
  return next;
}

function eraId(h: Household, name: string): string {
  return shapePathWorld(h.pathWorld).find((row): row is PathEraRow => row.kind === "era" && (row.active?.name === name || row.pending?.name === name))!.id;
}

function journey(h: Household, c: StoryContext): Household {
  let next = h;
  const g = (name: string) => c.goal[name]!;
  const plan = (id: string, kind: PathEraPlan["kind"], label: string, goalId: string | null = null, month: string | null = null): PathEraPlan => ({ id, kind, label, goalId, month });
  const era = (spec: Omit<PathEraSpec, "crossedOn" | "retired">) => spec;
  const propose = (by: string, other: string, when: string, agreeAt: string, spec: Omit<PathEraSpec, "crossedOn" | "retired">) => {
    next = proposePathEra(next, { memberId: by, spec, at: when }).household;
    next = agreeWaiting(next, other, agreeAt);
  };
  const addPlan = (by: string, other: string, name: string, p: PathEraPlan, when: string, agreeAt: string | null) => {
    next = proposePathEraPlan(next, { memberId: by, rowId: eraId(next, name), plan: p, at: when }).household;
    if (agreeAt) next = agreeWaiting(next, other, agreeAt);
  };

  // Era 1 — the day we moved in.
  propose(M2, M1, iso(dayIn(c, -24, 5), 21), iso(dayIn(c, -24, 6), 8), era({
    order: 1, name: "Moving in", finishLine: "Get through our first year of moving in without going broke", from: monthOf(c, -24), by: monthOf(c, -13), home: "flat",
    finish: { kind: "survive", months: 12 },
    plans: [plan("PLAN-1", "bank", "Moving-in cushion", g("Moving-in cushion")), plan("PLAN-2", "bank", "Housewarming", g("Housewarming"), monthOf(c, -23)), plan("PLAN-3", "milestone", "First Sitdown", null, monthOf(c, -23)), plan("PLAN-4", "note", "Learn the building")],
  }));

  // A year in, the next eras are laid out at a Sitdown.
  const furnishing = ["The sofa", "Bed & mattress", "Dining table & chairs", "Desk & bookshelf", "Kitchen things", "Rug & lamps", "Art & frames", "Plant corner"];
  propose(M1, M2, iso(dayIn(c, -13, 25), 20), iso(dayIn(c, -13, 25), 21), era({
    order: 2, name: "Make it ours", finishLine: "Furnish the place", from: monthOf(c, -12), by: monthOf(c, 11), home: "furnished",
    finish: { kind: "banks", goalIds: furnishing.map(g) },
    plans: furnishing.map((name, i) => plan(`PLAN-${i + 1}`, "bank", name, g(name))),
  }));
  propose(M2, M1, iso(dayIn(c, -13, 25), 21, 10), iso(dayIn(c, -13, 25), 21, 20), era({
    order: 3, name: "Our first house", finishLine: "Get the keys to our first house", from: monthOf(c, 12), by: monthOf(c, 96), home: "house",
    finish: { kind: "banks", goalIds: [g("House down payment"), g("Closing costs")] },
    plans: [plan("PLAN-1", "bank", "House down payment", g("House down payment")), plan("PLAN-2", "bank", "Closing costs", g("Closing costs")), plan("PLAN-3", "milestone", "Get pre-approved"), plan("PLAN-4", "chapter", "Handle a Surprise Together, again")],
  }));
  propose(M1, M2, iso(dayIn(c, -13, 25), 21, 30), iso(dayIn(c, -13, 25), 21, 40), era({
    order: 4, name: "Retirement", finishLine: "We both say so", from: monthOf(c, 96), by: monthOf(c, 575), home: "porch",
    finish: { kind: "agree" },
    plans: [plan("PLAN-1", "bank", "Retirement nest", g("Retirement nest")), plan("PLAN-2", "note", "A garden and a porch")],
  }));

  // M−12: twelve months without going broke — we cross the bridge.
  const crossDay = dayIn(c, -12, 10);
  const first = currentPathEra(next, crossDay);
  if (first) {
    next = crossPathEra(next, { memberId: M1, rowId: first.id, today: crossDay, at: iso(crossDay, 20) }).household;
    next = agreeWaiting(next, M2, iso(crossDay, 20, 15));
  }

  // Plans added along the way inside Make it ours.
  addPlan(M2, M1, "Make it ours", plan("PLAN-9", "bank", "Tofino trip", g("Tofino trip"), monthOf(c, -2)), iso(dayIn(c, -11, 20), 21), iso(dayIn(c, -11, 21), 8));
  addPlan(M1, M2, "Make it ours", plan("PLAN-10", "bank", "Emergency buffer", g("Emergency buffer")), iso(dayIn(c, -10, 20), 21), iso(dayIn(c, -10, 20), 22));
  addPlan(M2, M1, "Make it ours", plan("PLAN-11", "chapter", "Make Room for Joy", null, monthOf(c, -1)), iso(dayIn(c, -6, 5), 21), iso(dayIn(c, -6, 6), 8));
  // Our first house: a note agreed, and Bianca's idea still waiting on Jonathan.
  addPlan(M2, M1, "Our first house", plan("PLAN-5", "note", "Neighbourhoods near the lake"), iso(dayIn(c, -2, 24), 21), iso(dayIn(c, -2, 25), 8));
  addPlan(M1, M2, "Our first house", plan("PLAN-6", "milestone", "Adopt a dog"), iso(addDays(c.today, -1), 22), null);
  return next;
}

// ---------------------------------------------------------------------------

/** The last three months, reconciled and closed. */
function closes(h: Household, c: StoryContext): Household {
  let next = h;
  for (const k of [-3, -2, -1]) {
    const statementDate = addDays(dayIn(c, k + 1, 1), -1);
    const when = iso(dayIn(c, k + 1, 3), 21);
    for (const account of next.accounts.filter((row) => row.active && row.kind !== "investment" && row.scope !== "personal")) {
      next = at(next, when, (x) => recordReconciliation(x, { accountId: account.id, statementDate, statementAmount: bookBalanceAsOf(x, account.id, statementDate) / 100, createdBy: M1 }));
    }
    next = at(next, when, (x) => closeBooksMonth(x, { monthKey: monthOf(c, k), createdBy: M1 }));
  }
  return next;
}

export function shapeStory(household: Household, options: { today: DateKey; seed: number }): Household {
  const { today, seed } = options;
  const c: StoryContext = { today, M: monthKeyFromDateKey(today), seed, random: createDemoRandom(seed, "habitat-story"), cat: {}, goal: {}, rec: {} };
  let next: Household = { ...household, name: STORY_NAME, ledgerNames: { shared: STORY_NAME, personal: { [M1]: "Bianca's fictional books", [M2]: "Jonathan's fictional books" } } };
  const opened = dayIn(c, -24, 1);
  next = at(next, iso(opened, 9), (x) => configureHouseholdFund(x, { custodianMemberId: M1, openedOn: opened, createdBy: M1, name: "Household Fund", at: iso(opened, 9) }));
  next = categories(next, c);
  next = charterAndName(next, c);
  // The Moving-in cushion is a shared bank the Fund fills; it exists from the first day.
  const cushion = bankEnvelope("Moving-in cushion", iso(dayIn(c, -24, 1), 11), M1);
  next = at(next, iso(dayIn(c, -24, 1), 11), (x) => addGoal(x, { name: "Moving-in cushion", target: 2000, shared: true, ownerMemberId: M1, ...(cushion ? { envelope: cushion } : {}) }));
  c.goal["Moving-in cushion"] = next.goals.find((g) => g.name === "Moving-in cushion")!.id;
  for (const bill of BILLS) if (bill.from === -24) next = addBill(next, c, bill);
  next = moneyStory(next, c);
  next = chapters(next, c);
  next = trips(next, c);
  next = tasks(next, c);
  next = journey(next, c);
  next = bridgeAndRecipe(next, c);
  next = closes(next, c);
  return next;
}

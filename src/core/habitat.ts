import { addDays, monthKeyFromDateKey, shiftMonthKey, type DateKey } from "./calendar.ts";
import {
  acknowledgeHouseholdPlan,
  addPotentialExpense,
  addRecurrence,
  closeBooksMonth,
  configureHouseholdFund,
  foundHouseholdCharter,
  addGoal,
  fundGoal,
  postDueRecurrences,
  postEntry,
  purchaseGoal,
  recordHouseholdFundReconciliation,
  proposeHouseholdFundContribution,
  confirmHouseholdFundContribution,
  recordReconciliation,
  reversePostedMoney,
  setHouseholdFundMonthPlan,
  signHouseholdCharter,
  updateRecurrence,
} from "./commands.ts";
import { closeChapter, movesForChapter, offerMove, openChapter, openChapterFor, recordRitualHeld, recordWin, respondToMove } from "./chapters.ts";
import { currentPlanVersion } from "./planSystem.ts";
import { bookBalanceAsOf } from "./statements.ts";
import { projectHouseholdFund } from "./householdFund.ts";
import { fundContributionReviewDigest } from "./fundContributionSources.ts";
import type { Household } from "./types.ts";

/**
 * The Hercules habitats (2026-09-14): two fictional Development households
 * Jonathan and Bianca can open and walk around in — one doing well, one doing
 * badly — with twelve months behind them and this month in front of them, so
 * every room of the house has something to say without anybody keying in a
 * year of data by hand.
 *
 * A habitat is the synthetic Demo Suite's twelve-month books (`seedStressHousehold`)
 * with a **story** laid over them through the ordinary commands, nothing else:
 *
 * - **doing well** — the Fund is set up, reconciled every month and standing
 *   above its buffer; the month's plan is agreed by both; rent, hydro, the
 *   phone and two subscriptions have been paid on their day for months; the
 *   Charter is signed; a foundation Chapter was held to its ritual and closed
 *   established, and the next one is open with its ritual kept this month; a
 *   goal was funded and one was bought (a win); the last two months are closed
 *   and every account reconciled. The Queen reads *building*; the cellar's
 *   water never dips under the mark; the jars are full and the shards stand
 *   on their days.
 * - **doing badly** — the same twelve months, but the Fund was reconciled low,
 *   under its buffer, and an emergency vet bill was paid out of it; the plan
 *   was agreed and no longer fits (*reset*); hydro and the gym are overdue and
 *   unpaid (cracks); three more subscriptions crept in; a double charge had to
 *   be reversed; the open Chapter's ritual has not been held in three weeks and
 *   a Move was declined; nothing has been closed or reconciled for two months.
 *   The cellar's water runs under the mark and dry before rent.
 *
 * Nothing here is real. Every figure is fictional Development data, every
 * write goes through a named command, and the story is deterministic for a
 * seed so the Demo Suite's replay check still holds.
 */
export type HabitatStory = "well" | "hard";

export const HABITAT_NAMES: Record<HabitatStory, string> = {
  well: "Hercules habitat · doing well",
  hard: "Hercules habitat · doing badly",
};

export const HABITAT_WORDS: Record<HabitatStory, { title: string; line: string }> = {
  well: { title: "Doing well", line: "A year of books where the Fund holds, the bills are paid on their day, and the two of them keep their ritual." },
  hard: { title: "Doing badly", line: "The same year, but the Fund ran low, a vet bill came out of it, two bills are overdue, and the Sitdowns stopped." },
};

const M1 = "MEM-001", M2 = "MEM-002";
const rec = (h: Household, note: string) => h.recurrences.find((row) => row.note === note);

/** Post a recurrence on its due day, as the books would have: the same command the cellar's hammer uses. */
function pay(h: Household, note: string, today: DateKey, by = M1): Household {
  const row = rec(h, note);
  if (!row || !row.active || row.nextDate > today) return h;
  return postDueRecurrences(h, today, [row.id], { createdBy: by }).household;
}

/** Twelve months of a bill's history on its day, so the cellar's months ribbon has a beat to keep. */
function history(h: Household, note: string, today: DateKey, months: number, by = M1): Household {
  let next = h;
  for (let back = months; back >= 1; back -= 1) {
    const row = rec(next, note);
    if (!row) return next;
    const month = shiftMonthKey(monthKeyFromDateKey(today), -back);
    const day = row.nextDate.slice(8, 10);
    const date = `${month}-${day}` as DateKey;
    if (date >= today) continue;
    next = postEntry(next, { type: "expense", date, amount: row.amountCents / 100, accountId: row.accountId, subcategoryId: row.subcategoryId, note: row.note, createdBy: by, visibility: "household", source: "recurring", sourceId: row.id, confirmDuplicate: true }).household;
  }
  return next;
}

const dayOfMonth = (today: DateKey, day: number, shift = 0): DateKey => {
  const month = shiftMonthKey(monthKeyFromDateKey(today), shift);
  return `${month}-${String(day).padStart(2, "0")}` as DateKey;
};

/** The bills both habitats share: the stress seed's rent, hydro and phone, plus two subscriptions with a year behind them. */
function sharedBills(h: Household, today: DateKey, story: HabitatStory): Household {
  let next = h;
  // In the habitat doing badly, hydro fell due six days ago and nobody paid it.
  const hydro = rec(next, "Toronto Hydro");
  if (story === "hard" && hydro) next = updateRecurrence(next, { id: hydro.id, cadence: hydro.cadence, nextDate: addDays(today, -6), type: "expense", amount: hydro.amountCents / 100, accountId: hydro.accountId, subcategoryId: hydro.subcategoryId, note: hydro.note, kind: "bill" }).household;
  next = addRecurrence(next, { cadence: "monthly", nextDate: dayOfMonth(today, 6), type: "expense", amount: 16.99, accountId: "ACC-VISA", subcategoryId: "SUB-LIFE-FUN", note: "Streaming", kind: "subscription" }).household;
  next = addRecurrence(next, { cadence: "monthly", nextDate: dayOfMonth(today, 10), type: "expense", amount: 44, accountId: "ACC-VISA", subcategoryId: "SUB-HEALTH-CARE", note: "Gym", kind: "subscription" }).household;
  next = addRecurrence(next, { cadence: "monthly", nextDate: dayOfMonth(today, 18), type: "expense", amount: 128, accountId: "ACC-CHEQUING", subcategoryId: "SUB-TRANSPORT-TRANSIT", note: "Transit pass", kind: "other" }).household;
  for (const note of ["Rent", "Toronto Hydro", "Freedom Mobile", "Streaming", "Gym", "Transit pass"]) next = history(next, note, today, 6, note === "Streaming" || note === "Gym" ? M2 : M1);
  // Every bill on the rail is one the Fund pays in full, so the cellar's water is the Fund's own walk.
  for (const note of ["Rent", "Toronto Hydro", "Freedom Mobile", "Streaming", "Gym", "Transit pass"]) {
    const row = rec(next, note);
    if (!row || !next.householdFund) continue;
    next = updateRecurrence(next, { id: row.id, cadence: row.cadence, nextDate: row.nextDate, type: "expense", amount: row.amountCents / 100, accountId: row.accountId, subcategoryId: row.subcategoryId, note: row.note, kind: row.kind, splits: row.splits, fundingDefault: { fundId: next.householdFund.id, fundedCents: "full", destinationAccountId: row.accountId } }).household;
  }
  // This month's rent went out on the 1st in both habitats: the shard stands on day one of the rail.
  const rent = rec(next, "Rent");
  if (rent && dayOfMonth(today, 1) <= today) next = postEntry(next, { type: "expense", date: dayOfMonth(today, 1), amount: rent.amountCents / 100, accountId: rent.accountId, subcategoryId: rent.subcategoryId, note: rent.note, createdBy: M1, visibility: "household", source: "recurring", sourceId: rent.id, confirmDuplicate: true }).household;
  return next;
}

function charterAndChapters(h: Household, today: DateKey, story: HabitatStory): Household {
  let next = h;
  if (!next.charter) {
    next = foundHouseholdCharter(next, { memberId: M1, custodianMemberId: M1, purpose: "Fictional: make rent boring and keep the Fund honest.", splitRule: "even", splitNote: "Fictional: half each.", ceilingKind: "none", cadence: "weekly", cadenceWeekday: 0, date: addDays(today, -80) }).household;
    next = signHouseholdCharter(next, { memberId: M2 }).household;
    if (story === "well") next = signHouseholdCharter(next, { memberId: M1 }).household;
  }
  // The first foundation Chapter, held to its ritual and closed established two months ago.
  const openedAt = `${addDays(today, -75)}T12:00:00.000Z`;
  next = openChapter(next, { memberId: M1, foundationId: "see-our-shared-life", at: openedAt }).household;
  const first = openChapterFor(next);
  const ritual = (next.rituals ?? []).find((row) => row.chapterId === first?.id);
  if (first && ritual) {
    const held = story === "well" ? 8 : 2;
    for (let i = 0; i < held; i += 1) next = recordRitualHeld(next, { memberId: i % 2 ? M2 : M1, ritualId: ritual.id, onDate: addDays(today, -72 + i * 7) }).household;
    next = closeChapter(next, { memberId: M2, chapterId: first.id, outcome: story === "well" ? "established" : "still-forming", carryForward: story === "well" ? "Fictional: we both know where the truth comes from." : "Fictional: we kept the question list, mostly.", at: `${addDays(today, -40)}T18:00:00.000Z` }).household;
  }
  // The second Chapter, open now.
  next = openChapter(next, { memberId: M2, foundationId: "make-rent-boring", at: `${addDays(today, -30)}T12:00:00.000Z` }).household;
  const current = openChapterFor(next);
  const currentRitual = (next.rituals ?? []).find((row) => row.chapterId === current?.id);
  if (current && currentRitual) {
    if (story === "well") {
      for (const back of [24, 17, 10, 3]) next = recordRitualHeld(next, { memberId: back % 2 ? M1 : M2, ritualId: currentRitual.id, onDate: addDays(today, -back) }).household;
      next = offerMove(next, { memberId: M2, chapterId: current.id, text: "Fictional: move the rent transfer to the payday before the 1st", needsAcknowledgment: true }).household;
      const move = movesForChapter(next, current.id).find((row) => row.state === "offered");
      if (move) next = respondToMove(next, { memberId: M1, moveId: move.id, response: "accept" }).household;
    } else {
      next = recordRitualHeld(next, { memberId: M1, ritualId: currentRitual.id, onDate: addDays(today, -23) }).household;
      next = offerMove(next, { memberId: M1, chapterId: current.id, text: "Fictional: sit down about the vet bill and the card", needsAcknowledgment: true }).household;
      const move = movesForChapter(next, current.id).find((row) => row.state === "offered");
      if (move) next = respondToMove(next, { memberId: M2, moveId: move.id, response: "decline" }).household;
    }
  }
  return next;
}

/** Both of them put money in: a proposal by the contributor, confirmed received by the custodian, the way the Fund works. */
function contribute(h: Household, by: string, amount: number, date: DateKey): Household {
  const offer = proposeHouseholdFundContribution(h, { memberId: by, contributorMemberId: by, date, amount, source: { version: 1, kind: "external-received", explanation: "Fictional: e-transfer into the shared savings" } });
  return confirmHouseholdFundContribution(offer.household, { memberId: M1, proposalEventId: offer.postedIds[0]!, received: true, expectedProposalDigest: fundContributionReviewDigest(offer.household, offer.postedIds[0]!) }).household;
}

/** A reconciliation that ties: the bank total is what the books say the Fund holds, plus a remainder the custodian names. */
function reconcileTied(h: Household, date: DateKey, remainder: number, note: string): Household {
  const projection = projectHouseholdFund(h, date);
  const held = (projection.operatingBalanceCents + projection.kittyCents) / 100;
  return recordHouseholdFundReconciliation(h, { memberId: M1, date, bankTotal: (held + remainder).toFixed(2), personalRemainder: remainder.toFixed(2), note }).household;
}

/** The Fund's plan and the money that went into it — before any bill is handed to the Fund to pay. */
function fundIn(h: Household, today: DateKey, story: HabitatStory, seed: number): Household {
  let next = h;
  const month = monthKeyFromDateKey(today);
  const buffer = 400 + (seed % 5) * 25;
  for (const back of [3, 2, 1, 0]) {
    next = setHouseholdFundMonthPlan(next, { memberId: M1, monthKey: shiftMonthKey(month, -back), target: 3200 + (seed % 9) * 50, buffer, agreedByMemberIds: [M1, M2] }).household;
  }
  if (story === "well") {
    // Both of them contributed every month, and the custodian reconciled every month-end.
    for (const back of [3, 2, 1, 0]) {
      const date = `${shiftMonthKey(month, -back)}-02` as DateKey;
      if (date > today) continue;
      next = contribute(next, M1, 950, date);
      next = contribute(next, M2, 950, date);
      if (back > 0) next = reconcileTied(next, `${shiftMonthKey(month, -back)}-28` as DateKey, 0, "Fictional month-end reconciliation");
    }
  } else {
    // Contributions came in thin, then stopped two months ago; the custodian reconciled once.
    next = contribute(next, M1, 1700, `${shiftMonthKey(month, -3)}-09` as DateKey);
    next = contribute(next, M2, 1300, `${shiftMonthKey(month, -3)}-09` as DateKey);
    next = reconcileTied(next, `${shiftMonthKey(month, -3)}-28` as DateKey, 0, "Fictional month-end reconciliation");
    next = contribute(next, M1, 600, `${shiftMonthKey(month, -2)}-14` as DateKey);
  }
  return next;
}

/** How the month has gone for the Fund — the part that decides what the Queen reads. */
function fundOut(h: Household, today: DateKey, story: HabitatStory): Household {
  let next = h;
  const month = monthKeyFromDateKey(today);
  if (story === "well") {
    next = reconcileTied(next, addDays(today, -2), 0, "Fictional weekly reconciliation");
  } else {
    // The emergency came out of the Fund, and the custodian reconciled after it — late, and low.
    next = postEntry(next, { type: "expense", date: addDays(today, -8), amount: 3400, accountId: "ACC-VISA", subcategoryId: "SUB-HEALTH-VET", note: "Emergency vet — Hercules", place: "Annex Cat Clinic", createdBy: M1, visibility: "household", funding: { fundId: next.householdFund!.id, fundedCents: 340_000, destinationAccountId: "ACC-VISA" }, confirmDuplicate: true }).household;
    next = reconcileTied(next, addDays(today, -6), 0, "Fictional: reconciled after the vet, and low");
  }
  const version = currentPlanVersion(next, "household", month);
  if (version) for (const memberId of [M1, M2]) next = acknowledgeHouseholdPlan(next, { planVersionId: version.id, expectedDigest: version.digest, memberId, createdBy: memberId }).household;
  return next;
}

/** This month on the rail: what got paid, what did not, what crept in. */
function monthOnTheRail(h: Household, today: DateKey, story: HabitatStory): Household {
  let next = h;
  if (story === "well") {
    for (const note of ["Streaming", "Gym", "Toronto Hydro", "Freedom Mobile", "Transit pass"]) next = pay(next, note, today, M1);
    next = addPotentialExpense(next, { date: addDays(today, 9), title: "Winter tires", amount: 480, accountId: "ACC-VISA", subcategoryId: "SUB-TRANSPORT-FUEL", createdBy: M1, visibility: "household" }).household;
    next = addPotentialExpense(next, { date: addDays(today, 16), title: "Bianca's birthday dinner", amount: 140, accountId: "ACC-VISA", subcategoryId: "SUB-LIFE-FUN", createdBy: M2, visibility: "household" }).household;
  } else {
    // The streaming got paid; hydro and the gym did not, and they are past due. Three more subscriptions crept in this year.
    next = pay(next, "Streaming", today, M1);
    for (const [note, amount, sub, day] of [["Second streaming", 22.99, "SUB-LIFE-FUN", 4], ["Cloud storage", 13.99, "SUB-LIFE-FUN", 12], ["Meal kit", 89, "SUB-FOOD-GROCERIES", 21]] as const) {
      next = addRecurrence(next, { cadence: "monthly", nextDate: dayOfMonth(today, day), type: "expense", amount, accountId: "ACC-VISA", subcategoryId: sub, note, kind: "subscription" }).household; // on the card, outside the Fund: that is how they crept in
      next = history(next, note, today, 3, M2);
      next = pay(next, note, today, M1);
    }
    // A double charge, reversed — a gold seam on her.
    const doubled = postEntry(next, { type: "expense", date: addDays(today, -5), amount: 89, accountId: "ACC-VISA", subcategoryId: "SUB-FOOD-GROCERIES", note: "Meal kit (charged twice)", createdBy: M2, visibility: "household", confirmDuplicate: true });
    next = reversePostedMoney(doubled.household, doubled.postedIds[0]!, { createdBy: M1, reversalDate: addDays(today, -4) }).household;
    next = addPotentialExpense(next, { date: addDays(today, 4), title: "Car repair estimate", amount: 620, accountId: "ACC-VISA", subcategoryId: "SUB-TRANSPORT-FUEL", createdBy: M1, visibility: "household" }).household;
  }
  return next;
}

/** Goals and wins: two Build goals on the loft's ledge for both; a habitat doing well has bought something it saved for. */
function goalsStory(h: Household, today: DateKey, story: HabitatStory): Household {
  let next = h;
  next = addGoal(next, { name: "A trip to the shore", target: 2400, deadline: `${shiftMonthKey(monthKeyFromDateKey(today), 6)}-01`, shared: true, ownerMemberId: M1 }).household;
  next = addGoal(next, { name: "Kitchen renovation", target: 6000, deadline: `${shiftMonthKey(monthKeyFromDateKey(today), 14)}-01`, shared: true, ownerMemberId: M2 }).household;
  const shore = next.goals.find((row) => row.name === "A trip to the shore");
  if (shore) next = fundGoal(next, { goalId: shore.id, amount: story === "well" ? 1100 : 180, fromAccountId: "ACC-SAVINGS", date: addDays(today, -26), createdBy: M1, visibility: "household" }).household;
  const shared = next.goals.filter((row) => row.status !== "retired" && row.shared);
  if (story === "well") {
    const trip = shared.find((row) => /Montréal|Montreal/.test(row.name)) ?? shared[0];
    if (trip) next = fundGoal(next, { goalId: trip.id, amount: 900, fromAccountId: "ACC-CHEQUING", date: addDays(today, -20), createdBy: M1, visibility: "household" }).household;
    const wheel = shared.find((row) => /pottery/i.test(row.name));
    if (wheel) {
      next = fundGoal(next, { goalId: wheel.id, amount: wheel.targetCents / 100, fromAccountId: "ACC-SAVINGS", date: addDays(today, -34), createdBy: M2, visibility: "household" }).household;
      next = purchaseGoal(next, { goalId: wheel.id, amount: wheel.targetCents / 100, date: addDays(today, -12), createdBy: M2 }).household;
    }
    next = recordWin(next, { memberId: M1, level: "shared-win", title: "Fictional: the pottery wheel is here", at: `${addDays(today, -12)}T19:00:00.000Z` }).household;
  } else {
    const trip = shared.find((row) => /Montréal|Montreal/.test(row.name)) ?? shared[0];
    if (trip) next = fundGoal(next, { goalId: trip.id, amount: 120, fromAccountId: "ACC-CHEQUING", date: addDays(today, -50), createdBy: M1, visibility: "household" }).household;
  }
  return next;
}

/** Closes and reconciliations: a habitat doing well keeps its books closed; one doing badly has let two months slide. */
function closesStory(h: Household, today: DateKey, story: HabitatStory): Household {
  let next = h;
  const month = monthKeyFromDateKey(today);
  const closeUpTo = story === "well" ? 1 : 3;
  for (const back of [3, 2, 1]) {
    if (back < closeUpTo) continue;
    const statementDate = addDays(`${shiftMonthKey(month, -back + 1)}-01` as DateKey, -1);
    for (const account of next.accounts.filter((row) => row.active && row.kind !== "investment" && row.scope !== "personal")) {
      next = recordReconciliation(next, { accountId: account.id, statementDate, statementAmount: bookBalanceAsOf(next, account.id, statementDate) / 100, createdBy: M1 }).household;
    }
    next = closeBooksMonth(next, { monthKey: shiftMonthKey(month, -back), createdBy: M1 }).household;
  }
  return next;
}

export function shapeHabitat(household: Household, options: { story: HabitatStory; today: DateKey; seed: number }): Household {
  const { story, today, seed } = options;
  let next: Household = { ...household, name: HABITAT_NAMES[story], ledgerNames: { shared: HABITAT_NAMES[story], personal: { [M1]: "Bianca's fictional books", [M2]: "Jonathan's fictional books" } } };
  next = configureHouseholdFund(next, { custodianMemberId: M1, openedOn: `${shiftMonthKey(monthKeyFromDateKey(today), -4)}-01`, createdBy: M1, name: "Household Fund" }).household;
  next = fundIn(next, today, story, seed);
  next = sharedBills(next, today, story);
  next = charterAndChapters(next, today, story);
  next = fundOut(next, today, story);
  next = monthOnTheRail(next, today, story);
  next = goalsStory(next, today, story);
  next = closesStory(next, today, story);
  return next;
}

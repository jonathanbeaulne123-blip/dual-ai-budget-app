import { describe, expect, it } from "vitest";
import { planLifeFixture } from "./fixtures/plan-life.ts";
import { addGoal, addRecurrence, pauseRecurrence, postDueRecurrences, recordBillPayment, reversePostedMoney, skipOccurrence, updateRecurrence } from "../src/core/commands.ts";
import { projectHouseholdFund } from "../src/core/householdFund.ts";
import {
  MISSING_GRACE_DAYS, agreeMissingRoll, declineMissingRoll, missingBridgeLabel, missingSubscriptions, missingWords,
  offerMissingRoll, retreatCadence, rollMissingSubscription, subscriptionCharges, withdrawMissingRoll,
} from "../src/core/missingSubscriptions.ts";
import { formatCad } from "../src/core/money.ts";
import type { Household } from "../src/core/types.ts";

/** Fictional books: Alex (MEM-001) holds the Fund; Sam (MEM-002) is the partner. Nothing here is real. */
const ALEX = "MEM-001", SAM = "MEM-002";

function withStreaming(options: { history?: boolean; account?: string; amount?: string } = {}): { h: Household; subId: string; goalId: string } {
  let h = planLifeFixture("household");
  const goal = addGoal(h, { name: "Fictional beach weekend", target: "600", shared: true, ownerMemberId: SAM });
  h = goal.household;
  const added = addRecurrence(h, { cadence: "monthly", nextDate: options.history === false ? "2026-09-12" : "2026-08-12", type: "expense", amount: options.amount ?? "16", accountId: options.account ?? "ACC-VISA", subcategoryId: "SUB-LIFE-FUN", note: "Fictional streaming", kind: "subscription" });
  h = added.household;
  const subId = added.postedIds[0]!;
  // August was charged in full, on its day.
  if (options.history !== false) h = postDueRecurrences(h, "2026-08-12", [subId], { createdBy: ALEX }).household;
  return { h, subId, goalId: goal.postedIds[0]! };
}
const read = (h: Household, today: string, memberId = ALEX) => missingSubscriptions(h, { today, memberId });
const pay = (h: Household, subId: string, occurrenceDate: string, paymentDate: string, amount: string) =>
  recordBillPayment(h, { recurrenceId: subId, occurrenceDate, paymentDate, amount, accountId: "ACC-VISA", createdBy: ALEX }).household;

describe("Missing subscriptions — the grace period and the marks", () => {
  it("is not missing inside the grace period, and is missing from the third day after its day", () => {
    const { h } = withStreaming();
    expect(MISSING_GRACE_DAYS).toBe(3);
    expect(read(h, "2026-09-12").open).toEqual([]);
    expect(read(h, "2026-09-14").open).toEqual([]);
    const [entry] = read(h, "2026-09-15").open;
    expect(entry).toMatchObject({ kind: "missing", date: "2026-09-12", railDate: "2026-09-12", carried: false, usualCents: 1600, chargedCents: null, differenceCents: 1600, stage: "open", visibleUntil: "2026-11-12" });
    expect(missingWords(entry!, formatCad)).toBe("Fictional streaming wasn't charged for Sep 12 — $16.00 stayed in the water.");
  });

  it("a charge in full on its day is never marked", () => {
    const { h, subId } = withStreaming();
    const paid = postDueRecurrences(h, "2026-09-12", [subId], { createdBy: ALEX }).household;
    expect(read(paid, "2026-09-20").open).toEqual([]);
  });

  it("a smaller charge is marked with the difference, and says how much lower", () => {
    const { h, subId } = withStreaming();
    const lower = pay(h, subId, "2026-09-12", "2026-09-12", "11");
    expect(subscriptionCharges(lower, lower.recurrences.find((row) => row.id === subId)!).get("2026-09-12")).toBe(1100);
    const [entry] = read(lower, "2026-09-12").open;
    expect(entry).toMatchObject({ kind: "smaller", usualCents: 1600, chargedCents: 1100, differenceCents: 500, stage: "open" });
    expect(missingWords(entry!, formatCad)).toBe("Fictional streaming came in $5.00 lower on Sep 12 — $11.00 instead of $16.00.");
  });

  it("stays one more cycle: carried onto next month's rail from its 1st, gone once the cycle after next comes due", () => {
    const { h } = withStreaming();
    const [october] = read(h, "2026-10-02").open;
    expect(october).toMatchObject({ date: "2026-09-12", railDate: "2026-10-01", carried: true });
    expect(read(h, "2026-11-11").open.map((row) => row.date)).toEqual(["2026-09-12"]);
    expect(read(h, "2026-11-12").open).toEqual([]);
  });

  it("a skipped occurrence of a subscription that was charging counts as missing; a brand-new one has no phantom past", () => {
    const { h, subId } = withStreaming();
    const skipped = skipOccurrence(h, subId).household;
    expect(skipped.recurrences.find((row) => row.id === subId)!.nextDate).toBe("2026-10-12");
    expect(read(skipped, "2026-09-16").open.map((row) => [row.date, row.kind])).toEqual([["2026-09-12", "missing"]]);
    const fresh = withStreaming({ history: false });
    const future = skipOccurrence(fresh.h, fresh.subId).household; // nextDate Oct 12, never charged
    expect(read(future, "2026-09-16").open).toEqual([]);
    expect(retreatCadence("2026-10-12", "monthly")).toBe("2026-09-12");
    expect(retreatCadence("2026-10-12", "biweekly")).toBe("2026-09-28");
  });

  it("edge: a late charge after the grace period clears the mark", () => {
    const { h, subId } = withStreaming();
    expect(read(h, "2026-09-16").open).toHaveLength(1);
    const late = pay(h, subId, "2026-09-12", "2026-09-17", "16");
    expect(read(late, "2026-09-18").open).toEqual([]);
    expect(read(late, "2026-09-18").settled).toEqual([]); // nothing was rolled, so nothing to settle
  });

  it("edge: a reversed charge is not a charge", () => {
    const { h, subId } = withStreaming();
    const paid = postDueRecurrences(h, "2026-09-12", [subId], { createdBy: ALEX });
    const reversed = reversePostedMoney(paid.household, paid.postedIds[0]!, { createdBy: ALEX, reversalDate: "2026-09-13" }).household;
    expect(read(reversed, "2026-09-16").open.map((row) => row.kind)).toEqual(["missing"]);
  });

  it("edge: an amount that changed for good is not a windfall — two lower charges in a row, or a lowered usual amount", () => {
    const { h, subId } = withStreaming();
    let lower = pay(h, subId, "2026-09-12", "2026-09-12", "11");
    expect(read(lower, "2026-09-20").open).toHaveLength(1);
    lower = pay(lower, subId, "2026-10-12", "2026-10-12", "11");
    expect(read(lower, "2026-10-13").open).toEqual([]);
    // Or the couple lowered the usual amount to what is now charged.
    const sub = lower.recurrences.find((row) => row.id === subId)!;
    const updated = updateRecurrence(pay(h, subId, "2026-09-12", "2026-09-12", "11"), { id: subId, cadence: "monthly", nextDate: "2026-10-12", type: "expense", amount: "11", accountId: sub.accountId, subcategoryId: sub.subcategoryId, note: sub.note, kind: "subscription" }).household;
    expect(read(updated, "2026-09-20").open).toEqual([]);
  });

  it("edge: a cancelled (paused) subscription is never missing", () => {
    const { h, subId } = withStreaming();
    const cancelled = pauseRecurrence(h, subId).household;
    expect(read(cancelled, "2026-09-20").open).toEqual([]);
    expect(read(cancelled, "2026-09-20", SAM).open).toEqual([]);
  });

  it("edge: a Personal subscription never reaches the shared cellar, for either person", () => {
    const base = planLifeFixture("household");
    const added = addRecurrence(base, { cadence: "monthly", nextDate: "2026-08-12", type: "expense", amount: "9", accountId: "ACC-CASH", subcategoryId: "SUB-LIFE-FUN", note: "Fictional private app", kind: "subscription" });
    const charged = postDueRecurrences(added.household, "2026-08-12", [added.postedIds[0]!], { createdBy: SAM }).household;
    // While the card is shared, the missed September shows; once it is Sam's Personal card, it never does.
    expect(read(charged, "2026-09-20", ALEX).open.map((row) => row.label)).toEqual(["Fictional private app"]);
    const h = { ...charged, accounts: charged.accounts.map((row) => row.id === "ACC-CASH" ? { ...row, scope: "personal" as const, ownerMemberId: SAM } : row) };
    expect(read(h, "2026-09-20", SAM).open).toEqual([]);
    expect(read(h, "2026-09-20", ALEX).open).toEqual([]);
  });

  it("only a subscription is read: an overdue house bill is the rail's crack, not a missing mark", () => {
    const h = planLifeFixture("household"); // the fixture rent is due Sep 20 and unpaid
    expect(read(h, "2026-09-28").open).toEqual([]);
  });
});

describe("Rolling the difference into a goal — the custodian offers, the partner confirms", () => {
  it("walks offer → yes → roll, through the Bridge and the Fund's rollover, and never rolls twice", () => {
    const { h, goalId } = withStreaming();
    const today = "2026-09-16";
    const [entry] = read(h, today).open;
    // Only the custodian offers; the partner cannot.
    expect(() => offerMissingRoll(h, { today, memberId: SAM, entryId: entry!.id, goalId })).toThrow(/custodian/);
    const offered = offerMissingRoll(h, { today, memberId: ALEX, entryId: entry!.id, goalId }).household;
    const row = offered.planBridgeDecisions!.at(-1)!;
    expect(row).toMatchObject({ kind: "shared-goal", state: "proposed", offeredByMemberId: ALEX, amountCents: 1600, expectedDate: "2026-09-12", monthKey: "2026-09",
      label: "Roll Fictional streaming's uncharged Sep 12 payment into Fictional beach weekend — from the cellar" });
    expect(row.label).toBe(missingBridgeLabel(entry!, "Fictional beach weekend"));
    // No money moved by offering.
    expect(offered.fundEvents).toEqual(h.fundEvents);
    expect(read(offered, today).open[0]).toMatchObject({ stage: "offered", offer: { goalId, goalName: "Fictional beach weekend", agreedRowId: null } });
    expect(read(offered, today, SAM).open[0]!.stage).toBe("offered");
    // A second offer and a roll before the partner's yes are refused.
    expect(() => offerMissingRoll(offered, { today, memberId: ALEX, entryId: entry!.id, goalId })).toThrow(/already waiting/);
    expect(() => rollMissingSubscription(offered, { today, memberId: ALEX, entryId: entry!.id })).toThrow(/Both of you/);
    // The custodian cannot answer their own offer; the partner can.
    expect(() => agreeMissingRoll(offered, { today, memberId: ALEX, entryId: entry!.id })).toThrow(/partner confirms/);
    const agreed = agreeMissingRoll(offered, { today, memberId: SAM, entryId: entry!.id }).household;
    expect(agreed.planBridgeDecisions!.at(-1)).toMatchObject({ offeredByMemberId: SAM, label: row.label, amountCents: 1600, state: "proposed" });
    expect(read(agreed, today).open[0]).toMatchObject({ stage: "agreed" });
    expect(() => agreeMissingRoll(agreed, { today, memberId: SAM, entryId: entry!.id })).toThrow(/already said yes/);
    // Only the custodian rolls.
    expect(() => rollMissingSubscription(agreed, { today, memberId: SAM, entryId: entry!.id })).toThrow(/custodian/);
    const before = projectHouseholdFund(agreed, today).kittyCents;
    const rolled = rollMissingSubscription(agreed, { today, memberId: ALEX, entryId: entry!.id }).household;
    expect(projectHouseholdFund(rolled, today).kittyCents - before).toBe(1600);
    const event = rolled.fundEvents!.at(-1)!;
    expect(event).toMatchObject({ kind: "kitty-allocated", amountCents: 1600, note: "[cellar-roll:" + entry!.recurrenceId + ":2026-09-12] Cellar roll-over: Fictional streaming's uncharged Sep 12 payment" });
    const after = read(rolled, today);
    expect(after.open[0]).toMatchObject({ stage: "rolled", rolledCents: 1600, rolledGoalIds: [goalId] });
    // Both people's open offers are now spent: each device withdraws its own.
    expect(after.voidRowIds).toEqual([row.id]);
    expect(read(rolled, today, SAM).voidRowIds).toEqual([agreed.planBridgeDecisions!.at(-1)!.id]);
    // A double tap, or a stale screen, cannot roll it again.
    expect(() => rollMissingSubscription(rolled, { today, memberId: ALEX, entryId: entry!.id })).toThrow(/already rolled/);
    expect(() => offerMissingRoll(rolled, { today, memberId: ALEX, entryId: entry!.id, goalId })).toThrow(/already rolled/);
    const tidied = withdrawMissingRoll(withdrawMissingRoll(rolled, { memberId: ALEX, rowId: after.voidRowIds[0]! }).household, { memberId: SAM, rowId: read(rolled, today, SAM).voidRowIds[0]! }).household;
    expect(read(tidied, today).open[0]!.stage).toBe("rolled");
    expect(read(tidied, today).voidRowIds).toEqual([]);
    expect(projectHouseholdFund(tidied, today).kittyCents - before).toBe(1600);
  });

  it("edge: a charge that shows up after a confirmed roll clears the mark, keeps the one roll, and offers nothing again (no double count)", () => {
    const { h, subId, goalId } = withStreaming();
    const today = "2026-09-16";
    const entryId = read(h, today).open[0]!.id;
    let books = offerMissingRoll(h, { today, memberId: ALEX, entryId, goalId }).household;
    books = agreeMissingRoll(books, { today, memberId: SAM, entryId }).household;
    books = rollMissingSubscription(books, { today, memberId: ALEX, entryId }).household;
    const kitty = projectHouseholdFund(books, today).kittyCents;
    const late = pay(books, subId, "2026-09-12", "2026-09-18", "16");
    const reading = read(late, "2026-09-18");
    expect(reading.open).toEqual([]);
    expect(reading.settled).toEqual([{ key: `cellar-roll:${subId}:2026-09-12`, recurrenceId: subId, date: "2026-09-12", chargedCents: 1600, why: "charged", rolledCents: 1600 }]);
    expect(() => rollMissingSubscription(late, { today: "2026-09-18", memberId: ALEX, entryId })).toThrow(/no longer missing/);
    expect(projectHouseholdFund(late, "2026-09-18").kittyCents).toBe(kitty);
    const rollovers = late.fundEvents!.filter((event) => event.kind === "kitty-allocated" && event.note.includes(`cellar-roll:${subId}:2026-09-12`));
    expect(rollovers).toHaveLength(1);
  });

  it("edge: a late charge withdraws an offer nobody confirmed yet", () => {
    const { h, subId, goalId } = withStreaming();
    const today = "2026-09-16";
    const entryId = read(h, today).open[0]!.id;
    let books = offerMissingRoll(h, { today, memberId: ALEX, entryId, goalId }).household;
    books = agreeMissingRoll(books, { today, memberId: SAM, entryId }).household;
    const late = pay(books, subId, "2026-09-12", "2026-09-17", "16");
    const alex = read(late, "2026-09-17"), sam = read(late, "2026-09-17", SAM);
    expect(alex.open).toEqual([]);
    expect(alex.voidRowIds).toHaveLength(1);
    expect(sam.voidRowIds).toHaveLength(1);
    expect(() => rollMissingSubscription(late, { today: "2026-09-17", memberId: ALEX, entryId })).toThrow(/no longer missing/);
    const cleared = withdrawMissingRoll(late, { memberId: ALEX, rowId: alex.voidRowIds[0]! }).household;
    expect(cleared.planBridgeDecisions!.find((row) => row.id === alex.voidRowIds[0])!.state).toBe("withdrawn");
    expect(() => withdrawMissingRoll(cleared, { memberId: ALEX, rowId: sam.voidRowIds[0]! })).toThrow();
    expect(late.fundEvents).toEqual(h.fundEvents);
  });

  it("the partner can set the offer aside; the custodian may offer again", () => {
    const { h, subId, goalId } = withStreaming();
    const today = "2026-09-16";
    const lower = pay(h, subId, "2026-09-12", "2026-09-12", "11");
    const entryId = read(lower, today).open[0]!.id;
    const offered = offerMissingRoll(lower, { today, memberId: ALEX, entryId, goalId }).household;
    expect(offered.planBridgeDecisions!.at(-1)!.label).toBe("Roll Fictional streaming's Sep 12 difference into Fictional beach weekend — from the cellar");
    expect(offered.planBridgeDecisions!.at(-1)!.amountCents).toBe(500);
    expect(() => declineMissingRoll(offered, { today, memberId: ALEX, entryId })).toThrow();
    const declined = declineMissingRoll(offered, { today, memberId: SAM, entryId }).household;
    expect(read(declined, today).open[0]).toMatchObject({ stage: "open", offer: { state: "declined", declineReason: "Keep it in the Fund's water for now." } });
    expect(read(declined, today).voidRowIds).toEqual([]);
    const again = offerMissingRoll(declined, { today, memberId: ALEX, entryId, goalId }).household;
    expect(read(again, today).open[0]!.stage).toBe("offered");
  });

  it("a roll that exceeds the Fund's safe surplus is refused by the rollover itself, and nothing is written", () => {
    const { h, goalId } = withStreaming({ amount: "3900" });
    const today = "2026-09-16";
    const entryId = read(h, today).open[0]!.id;
    let books = offerMissingRoll(h, { today, memberId: ALEX, entryId, goalId }).household;
    books = agreeMissingRoll(books, { today, memberId: SAM, entryId }).household;
    expect(() => rollMissingSubscription(books, { today, memberId: ALEX, entryId })).toThrow(/safe surplus/);
    expect(read(books, today).open[0]!.stage).toBe("agreed");
  });
});

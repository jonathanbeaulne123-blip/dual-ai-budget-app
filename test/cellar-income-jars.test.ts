import { describe, expect, it } from "vitest";
import { planLifeFixture } from "./fixtures/plan-life.ts";
import { addRecurrence, confirmHouseholdFundContribution, dismissNotice, proposeHouseholdFundContribution } from "../src/core/commands.ts";
import { fundContributionReviewDigest } from "../src/core/fundContributionSources.ts";
import { cellarIncomeJars, cellarPayMark, hiddenPayMembers, incomeJarWords } from "../src/core/cellarIncomeJars.ts";
import { formatCad } from "../src/core/money.ts";
import type { Household, Shift } from "../src/core/types.ts";

/** Fictional books only. Alex (MEM-001) holds the Fund; Sam (MEM-002) works shifts. */
const ALEX = "MEM-001", SAM = "MEM-002";
const TODAY = "2026-09-16";

const shift = (id: string, date: string, visibility: Shift["visibility"], wages: number, tips: number): Shift => ({
  id, date, memberId: SAM, accountId: "ACC-CHEQUING", salesCents: 0, cashTipsCents: 0, ccTipsCents: 0, hours: 6,
  floorTipOutCents: 0, barTipOutCents: 0, ccTipOutCents: 0, netTipsCents: tips, wagesCents: wages,
  settings: { floorPct: 0, barPct: 0, barRoundCents: 0, ccPct: 0, hourlyRateCents: 0 }, settingsFingerprint: "fiction",
  wagesTransactionId: "", tipsTransactionId: "", createdBy: SAM, visibility, createdAt: `${date}T22:00:00.000Z`, updatedAt: `${date}T22:00:00.000Z`,
});

function contribute(h: Household, memberId: string, date: string, amount: string): Household {
  const offer = proposeHouseholdFundContribution(h, { memberId, contributorMemberId: memberId, date, amount, source: { version: 1, kind: "external-received", explanation: "Fictional transfer" } });
  return confirmHouseholdFundContribution(offer.household, { memberId: ALEX, proposalEventId: offer.postedIds[0]!, received: true, expectedProposalDigest: fundContributionReviewDigest(offer.household, offer.postedIds[0]!) }).household;
}

function books(): Household {
  let h = planLifeFixture("household");
  const income = h.categories.find((row) => row.recordType === "category" && row.transactionType === "income")!.id;
  // Alex's pay lands every two weeks in the joint chequing, split to Alex: household-visible.
  h = addRecurrence(h, { cadence: "biweekly", nextDate: "2026-09-18", type: "income", amount: "2100", accountId: "ACC-CHEQUING", subcategoryId: income, note: "Fictional pay", splits: [{ party: ALEX, amountCents: 210000 }] }).household;
  // Alex's side gig lands in a Personal savings account: never read for Sam, and for Alex only by opt-in.
  h = addRecurrence(h, { cadence: "monthly", nextDate: "2026-09-28", type: "income", amount: "300", accountId: "ACC-SAVINGS", subcategoryId: income, note: "Fictional side gig" }).household;
  h = { ...h, accounts: h.accounts.map((row) => row.id === "ACC-SAVINGS" ? { ...row, scope: "personal" as const, ownerMemberId: ALEX } : row) };
  // Sam is paid every other Friday (household-visible timing), for shifts recorded household-visible — and one kept Personal.
  h = { ...h, members: h.members.map((row) => row.id === SAM ? { ...row, earningCadence: { cadence: "biweekly" as const, anchorDate: "2026-09-11", weekday: 5, monthDays: [15, 30], customDates: [], reminderTime: "09:00" } } : row) };
  h = { ...h, shifts: [...h.shifts, shift("SHIFT-F1", "2026-09-08", "household", 12000, 8000), shift("SHIFT-F2", "2026-09-09", "household", 12000, 8000), shift("SHIFT-F3", "2026-09-15", "household", 12000, 8000), shift("SHIFT-F4", "2026-09-16", "both", 12000, 8000), shift("SHIFT-F5", "2026-09-17", "personal", 50000, 0)] };
  // Sam contributed after the 11th's pay day.
  h = contribute(h, SAM, "2026-09-12", "300");
  return h;
}
const days = [{ date: "2026-09-18", balanceCents: 250_000 }, { date: "2026-09-25", balanceCents: 160_000 }];
const view = (h: Household, memberId: string, extra: { ownPrivateOptIn?: boolean; today?: string } = {}) => cellarIncomeJars(h, { today: extra.today ?? TODAY, memberId, days, ownPrivateOptIn: extra.ownPrivateOptIn });
const brief = (h: Household, memberId: string, extra: { ownPrivateOptIn?: boolean; today?: string } = {}) =>
  view(h, memberId, extra).jars.map((jar) => [jar.memberName.split(" ")[0], jar.date, jar.state, jar.expectedCents, jar.ifAllCents, jar.contributedCents, jar.sources.join("+")]);

describe("Hypothetical income jars — glass until the pay date, then the contribution bank", () => {
  it("stands each partner's expected pay as glass ahead, and what was actually contributed behind", () => {
    const h = books();
    expect(brief(h, ALEX)).toEqual([
      ["Alex", "2026-09-04", "contributed", 0, null, 0, ""],
      ["Sam", "2026-09-11", "contributed", 0, null, 30000, ""],
      ["Alex", "2026-09-18", "hypothetical", 210000, 460000, 0, "recurrence"],
      ["Sam", "2026-09-25", "hypothetical", 40000, 200000, 0, "shift"],
    ]);
    const reading = view(h, ALEX);
    expect(reading.hidden).toEqual([]);
    expect(reading.unshared).toEqual([]);
    const [, sam11, alex18] = reading.jars;
    expect(incomeJarWords(alex18!, formatCad)).toBe("If all of your pay came in — about $2100.00 — the Fund could stand at $4600.00. Only a contribution moves money.");
    expect(incomeJarWords(sam11!, formatCad)).toBe("Sam (fictional) contributed $300.00 to the Fund since their pay day.");
  });

  it("on the pay date the glass jar is gone and the bank takes its place", () => {
    const h = contribute(books(), ALEX, "2026-09-18", "150");
    const onTheDay = brief(h, ALEX, { today: "2026-09-18" }).find((row) => row[0] === "Alex" && row[1] === "2026-09-18");
    expect(onTheDay).toEqual(["Alex", "2026-09-18", "contributed", 0, null, 15000, ""]);
    expect(incomeJarWords(view(h, SAM, { today: "2026-09-18" }).jars.find((jar) => jar.id === `income:${ALEX}:2026-09-18`)!, formatCad)).toBe("Alex (fictional) contributed $150.00 to the Fund since their pay day.");
  });

  it("privacy: a partner's Personal shift never shapes their jar, on either phone", () => {
    const h = books();
    const samOnAlex = view(h, ALEX).jars.find((jar) => jar.id === `income:${SAM}:2026-09-25`)!;
    const samOnSam = view(h, SAM).jars.find((jar) => jar.id === `income:${SAM}:2026-09-25`)!;
    expect(samOnAlex.expectedCents).toBe(40000);
    expect(samOnSam.expectedCents).toBe(40000);
  });

  it("privacy: a member's own Personal income shapes only their own jar, only with their opt-in, only on their view", () => {
    const h = books();
    const plain = view(h, ALEX).jars.map((jar) => jar.date);
    expect(plain).not.toContain("2026-09-28");
    expect(brief(h, ALEX, { ownPrivateOptIn: true }).filter((row) => row[0] === "Alex")).toEqual([
      ["Alex", "2026-09-04", "contributed", 0, null, 0, ""],
      ["Alex", "2026-09-18", "hypothetical", 210000, 460000, 0, "recurrence"],
      ["Alex", "2026-09-28", "hypothetical", 30000, null, 0, "own-private"],
    ]);
    // Sam's phone never reads Alex's Personal income, whatever Sam opts into.
    expect(view(h, SAM, { ownPrivateOptIn: true }).jars.some((jar) => jar.memberId === ALEX && jar.date === "2026-09-28")).toBe(false);
    // Sam's own opt-in adds Sam's Personal shift to Sam's own jar, on Sam's view only.
    expect(view(h, SAM, { ownPrivateOptIn: true }).jars.find((jar) => jar.id === `income:${SAM}:2026-09-25`)).toMatchObject({ expectedCents: 90000, sources: ["own-private", "shift"] });
    expect(view(h, ALEX, { ownPrivateOptIn: true }).jars.find((jar) => jar.id === `income:${SAM}:2026-09-25`)!.expectedCents).toBe(40000);
  });

  it("edge: partner hidden pay — Sam hides theirs; both phones drop Sam's glass jar and keep the contribution bank; the newest mark wins", () => {
    const hidden = dismissNotice(books(), cellarPayMark(SAM, "hide", "2026-09-16T10:00:00.000Z")).household;
    expect([...hiddenPayMembers(hidden)]).toEqual([SAM]);
    for (const viewer of [ALEX, SAM]) {
      const reading = view(hidden, viewer);
      expect(reading.jars.filter((jar) => jar.memberId === SAM).map((jar) => jar.state)).toEqual(["contributed"]);
      expect(reading.hidden).toEqual([{ memberId: SAM, name: "Sam (fictional)", mine: viewer === SAM }]);
    }
    const shown = dismissNotice(hidden, cellarPayMark(SAM, "show", "2026-09-16T11:00:00.000Z")).household;
    expect(hiddenPayMembers(shown).size).toBe(0);
    expect(view(shown, ALEX).jars.filter((jar) => jar.memberId === SAM).map((jar) => jar.state)).toEqual(["contributed", "hypothetical"]);
    // An older show that syncs in late does not undo a newer hide (the union keeps both; the newest wins).
    const late = dismissNotice(dismissNotice(books(), cellarPayMark(SAM, "hide", "2026-09-16T12:00:00.000Z")).household, cellarPayMark(SAM, "show", "2026-09-16T09:00:00.000Z")).household;
    expect([...hiddenPayMembers(late)]).toEqual([SAM]);
  });

  it("a shared pay day with no shared amount makes no jar, and says so", () => {
    let h = planLifeFixture("household");
    h = { ...h, members: h.members.map((row) => row.id === SAM ? { ...row, earningCadence: { cadence: "biweekly" as const, anchorDate: "2026-09-11", weekday: 5, monthDays: [15, 30], customDates: [], reminderTime: "09:00" } } : row) };
    const reading = cellarIncomeJars(h, { today: TODAY, memberId: ALEX });
    expect(reading.jars.filter((jar) => jar.state === "hypothetical")).toEqual([]);
    expect(reading.unshared).toEqual([{ memberId: SAM, name: "Sam (fictional)", mine: false }]);
  });

  it("an income on a joint account with a joint split belongs to no one, so it makes no jar", () => {
    let h = planLifeFixture("household");
    const income = h.categories.find((row) => row.recordType === "category" && row.transactionType === "income")!.id;
    h = addRecurrence(h, { cadence: "monthly", nextDate: "2026-09-20", type: "income", amount: "100", accountId: "ACC-CHEQUING", subcategoryId: income, note: "Fictional joint rebate" }).household;
    expect(cellarIncomeJars(h, { today: TODAY, memberId: ALEX }).jars).toEqual([]);
  });
});

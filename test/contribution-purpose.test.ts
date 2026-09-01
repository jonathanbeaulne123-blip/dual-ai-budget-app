import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  HOUSEHOLD_FUND_ID,
  addGoal,
  addRecurrence,
  catalogHousehold,
  configureHouseholdFund,
  confirmHouseholdFundContribution,
  commandIdentityHash,
  contributionRegister,
  financialAuditHash,
  postEntry,
  projectHouseholdFund,
  proposeHouseholdFundContribution,
  shapeHouseholdFundEvents,
  type ContributionRegister,
  type Household,
} from "../src/core/index.ts";
import { financialAuditHashForScope } from "../src/core/commandIdentity.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";

type PurposeKey = "carried" | "biancaFirst" | "jonathanFirst" | "jonathanSecond" | "biancaSecond";

const PURPOSES: Record<PurposeKey, string> = {
  carried: "Opening the month",
  biancaFirst: "Rent and hydro",
  jonathanFirst: "Rent",
  jonathanSecond: "Insurance",
  biancaSecond: "The rest of September",
};

function configuredFund(): Household {
  return configureHouseholdFund(catalogHousehold(), {
    custodianMemberId: BIANCA,
    openedOn: "2026-08-01",
    createdBy: BIANCA,
  }).household;
}

function contribute(
  household: Household,
  contributorMemberId: string,
  amount: string,
  date: string,
  purpose?: string,
): Household {
  const proposed = proposeHouseholdFundContribution(household, {
    memberId: contributorMemberId,
    contributorMemberId,
    amount,
    date,
    purpose,
  });
  return confirmHouseholdFundContribution(proposed.household, {
    memberId: BIANCA,
    proposalEventId: proposed.postedIds[0]!,
  }).household;
}

function addExpenseRecurrence(household: Household, amount: string, date: string, note: string): Household {
  return addRecurrence(household, {
    cadence: "monthly",
    nextDate: date,
    type: "expense",
    amount,
    accountId: "ACC-VISA",
    subcategoryId: "SUB-HOUSING-ELECTRIC",
    note,
    fundingDefault: { fundId: HOUSEHOLD_FUND_ID, fundedCents: "full", destinationAccountId: "ACC-VISA" },
  }).household;
}

function canonicalHousehold(): Household {
  let household = configuredFund();
  household = contribute(household, BIANCA, "240", "2026-08-31");
  household = contribute(household, BIANCA, "980", "2026-09-04");
  household = contribute(household, JONATHAN, "310", "2026-09-06");
  household = contribute(household, JONATHAN, "225", "2026-09-11");
  household = contribute(household, BIANCA, "980", "2026-09-18");

  for (const posted of [
    { date: "2026-09-04", amount: "128", note: "Hydro" },
    { date: "2026-09-05", amount: "1450", note: "Rent · our share" },
    { date: "2026-09-10", amount: "186", note: "Insurance" },
  ]) household = postEntry(household, {
    date: posted.date,
    type: "expense",
    amount: posted.amount,
    accountId: "ACC-VISA",
    subcategoryId: "SUB-HOUSING-ELECTRIC",
    note: posted.note,
    createdBy: JONATHAN,
    visibility: "household",
    confirmDuplicate: true,
    funding: {
      fundId: HOUSEHOLD_FUND_ID,
      fundedCents: Math.round(Number(posted.amount) * 100),
      destinationAccountId: "ACC-VISA",
    },
  }).household;
  household = addExpenseRecurrence(household, "520", "2026-09-15", "Groceries · planned");
  household = addExpenseRecurrence(household, "92", "2026-09-20", "Internet");
  household = addExpenseRecurrence(household, "74", "2026-09-22", "Gas");
  household = addExpenseRecurrence(household, "110", "2026-09-25", "Phone");
  household = addExpenseRecurrence(household, "215", "2026-09-26", "Vet · Marmalade");
  const goal = addGoal(household, {
    name: "Winter reserve",
    target: "300",
    shared: true,
    ownerMemberId: BIANCA,
  });
  return addRecurrence(goal.household, {
    cadence: "monthly",
    nextDate: "2026-09-30",
    type: "transfer",
    amount: "300",
    accountId: "ACC-CHEQUING",
    transferToAccountId: "ACC-GOALS",
    goalId: goal.postedIds[0]!,
    note: "Standing · jar · Winter reserve",
  }).household;
}

function withContributionPurposes(household: Household): Household {
  const keys = new Map<string, PurposeKey>([
    [`${BIANCA}:2026-08-31`, "carried"],
    [`${BIANCA}:2026-09-04`, "biancaFirst"],
    [`${JONATHAN}:2026-09-06`, "jonathanFirst"],
    [`${JONATHAN}:2026-09-11`, "jonathanSecond"],
    [`${BIANCA}:2026-09-18`, "biancaSecond"],
  ]);
  return {
    ...household,
    fundEvents: household.fundEvents?.map((event) => {
      if (event.kind !== "contribution-proposed" && event.kind !== "contribution-confirmed") return event;
      const key = event.contributorMemberId ? keys.get(`${event.contributorMemberId}:${event.date}`) : undefined;
      return { ...event, purpose: key ? PURPOSES[key] : "" };
    }),
  };
}

function withoutPurposeValues(register: ContributionRegister): ContributionRegister {
  return {
    ...register,
    sources: register.sources.map((source) => ({ ...source, purpose: "" })),
  };
}

describe("Household Fund contribution purpose", () => {
  it("shapes legacy purposes to blank and trims supplied purposes to 90 characters", () => {
    const proposed = proposeHouseholdFundContribution(configuredFund(), {
      memberId: JONATHAN,
      contributorMemberId: JONATHAN,
      amount: "25",
      date: "2026-09-03",
      purpose: `  ${"p".repeat(100)}  `,
    });
    const proposal = proposed.household.fundEvents?.find((event) => event.id === proposed.postedIds[0])!;
    const { purpose: _purpose, ...legacy } = proposal;

    expect(proposal.purpose).toBe("p".repeat(90));
    expect(shapeHouseholdFundEvents([legacy])[0]?.purpose).toBe("");

    const confirmed = confirmHouseholdFundContribution(proposed.household, {
      memberId: BIANCA,
      proposalEventId: proposal.id,
    });
    expect(confirmed.household.fundEvents?.find((event) => event.id === confirmed.postedIds[0])?.purpose)
      .toBe("p".repeat(90));
  });

  it("keeps the canonical register identical except for contribution purpose strings", () => {
    const blankHousehold = canonicalHousehold();
    const purposeHousehold = withContributionPurposes(blankHousehold);
    const blank = contributionRegister(blankHousehold, "2026-09", "2026-09-12");
    const labelled = contributionRegister(purposeHousehold, "2026-09", "2026-09-12");

    expect(labelled.sources.map((source) => source.purpose)).toEqual([
      "",
      PURPOSES.biancaFirst,
      PURPOSES.jonathanFirst,
      PURPOSES.jonathanSecond,
      PURPOSES.biancaSecond,
    ]);
    expect(withoutPurposeValues(labelled)).toEqual(withoutPurposeValues(blank));
    expect(labelled).toMatchObject({
      carriedCents: 24000,
      byMember: [
        { memberId: BIANCA, amountCents: 196000 },
        { memberId: JONATHAN, amountCents: 53500 },
      ],
      owedCents: 307500,
      unfundedCents: 34000,
      tiesToProjection: true,
    });
    expect(labelled.rows.map((row) => row.segments)).toEqual(blank.rows.map((row) => row.segments));
  });

  it("leaves the Household Fund projection byte-identical", () => {
    const blankHousehold = canonicalHousehold();
    const blank = projectHouseholdFund(blankHousehold, "2026-09-12");
    const labelled = projectHouseholdFund(withContributionPurposes(blankHousehold), "2026-09-12");

    expect(JSON.stringify(labelled)).toBe(JSON.stringify(blank));
  });

  it("keeps purpose outside financial audit identity while retaining it in shared provenance", async () => {
    const blankHousehold = canonicalHousehold();
    const labelledHousehold = withContributionPurposes(blankHousehold);

    expect(await financialAuditHash(labelledHousehold)).toBe(await financialAuditHash(blankHousehold));
    expect(await financialAuditHashForScope(labelledHousehold, "shared", BIANCA))
      .toBe(await financialAuditHashForScope(blankHousehold, "shared", BIANCA));
    expect(contributionRegister(labelledHousehold, "2026-09", "2026-09-12").sources.map((source) => source.purpose))
      .not.toEqual(contributionRegister(blankHousehold, "2026-09", "2026-09-12").sources.map((source) => source.purpose));
  });

  it("keeps blank-purpose command identity backward compatible and binds a supplied purpose", async () => {
    const blankHousehold = canonicalHousehold();
    const labelledHousehold = withContributionPurposes(blankHousehold);
    const eventId = blankHousehold.fundEvents?.find((event) => (
      event.kind === "contribution-confirmed" && event.date === "2026-09-04"
    ))?.id!;
    const legacyHousehold = {
      ...blankHousehold,
      fundEvents: blankHousehold.fundEvents?.map(({ purpose: _purpose, ...event }) => event),
    } as unknown as Household;

    expect(await commandIdentityHash(null, blankHousehold, [eventId]))
      .toBe(await commandIdentityHash(null, legacyHousehold, [eventId]));
    expect(await commandIdentityHash(null, labelledHousehold, [eventId]))
      .not.toBe(await commandIdentityHash(null, blankHousehold, [eventId]));
  });

  it("reads purpose as provenance without branching on it", () => {
    const source = readFileSync(new URL("../src/core/contributionRegister.ts", import.meta.url), "utf8");
    const executable = source.replace(/\/\/.*$/gm, "");

    expect(source).toContain("purpose: event.purpose");
    expect(executable).not.toMatch(/\b(?:if|switch|filter|sort|while|for)\b[^\n{]*purpose/i);
    expect(executable).not.toMatch(/purpose[^\n]*(?:&&|\|\||\?|[+*/])/i);
  });
});

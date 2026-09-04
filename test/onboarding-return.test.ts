import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  addRecurrence,
  approveHouseholdFundConfiguration,
  catalogHousehold,
  configureHouseholdFund,
  confirmHouseholdOnboarding,
  foundHouseholdCharter,
  postOpeningBalances,
  proposeHouseholdOnboarding,
  recordChapterAcknowledgement,
  recordEarningCadence,
  recordObservedChapterCompletion,
  signHouseholdCharter,
  setFundCardAccount,
  type Household,
} from "../src/core/index.ts";
import {
  activeReturnMessage,
  clearReturnMessage,
  loadReturnMessage,
  navTargetSurfaceLabel,
  onboardingNavigationTarget,
  returnMessageProbePassed,
  saveReturnMessage,
  type ReturnMessageRecord,
} from "../src/core/onboarding/returnMessage.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const TODAY = "2026-09-03";

const moduleSource = readFileSync(join(process.cwd(), "src/core/onboarding/returnMessage.ts"), "utf8");

function memoryStore(): Storage {
  const memory = new Map<string, string>();
  return {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value); },
    removeItem: (key: string) => { memory.delete(key); },
    clear: () => memory.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

function proposedActive(): Household {
  let household = proposeHouseholdOnboarding(catalogHousehold("development"), { memberId: BIANCA, at: "2026-09-03T14:00:00.000Z" }).household;
  household = confirmHouseholdOnboarding(household, { memberId: JONATHAN, at: "2026-09-03T14:01:00.000Z" }).household;
  return household;
}

function acknowledgeBoth(household: Household, chapterId: string): Household {
  if (chapterId === "ch-02-household") {
    const observation = (memberId: string) => ({
      kind: "resolved" as const,
      scope: { environment: household.environment, householdId: household.householdId, memberId },
      currentMemberId: memberId,
      seatMemberIds: [BIANCA, JONATHAN],
      observedAt: "2026-09-03T14:02:00.000Z",
    });
    let next = recordObservedChapterCompletion(household, {
      memberId: BIANCA, chapterId, createdBy: BIANCA, observation: observation(BIANCA),
    }).household;
    next = recordObservedChapterCompletion(next, {
      memberId: JONATHAN, chapterId, createdBy: JONATHAN, observation: observation(JONATHAN),
    }).household;
    return next;
  }
  let next = recordChapterAcknowledgement(household, { memberId: BIANCA, chapterId, createdBy: BIANCA }).household;
  next = recordChapterAcknowledgement(next, { memberId: JONATHAN, chapterId, createdBy: JONATHAN }).household;
  return next;
}

/** Charter founded and signed, ch-01/02/03 acknowledged by both — lands on ch-04-accounts (target { tab: "ledger" }). */
function throughSittingOne(): Household {
  let household = proposedActive();
  household = acknowledgeBoth(household, "ch-01-meet");
  household = acknowledgeBoth(household, "ch-02-household");
  household = foundHouseholdCharter(household, {
    memberId: JONATHAN,
    custodianMemberId: BIANCA,
    purpose: "Roof and groceries.",
    splitRule: "remainder",
    splitNote: "Bianca covers what she can, Jonathan closes the rest.",
    ceilingKind: "none",
    cadence: "weekly",
    cadenceWeekday: 0,
    date: TODAY,
  }).household;
  household = signHouseholdCharter(household, { memberId: BIANCA }).household;
  household = signHouseholdCharter(household, { memberId: JONATHAN }).household;
  household = acknowledgeBoth(household, "ch-03-charter");
  household = setFundCardAccount(household, {
    memberId: BIANCA, accountId: "ACC-VISA", createdBy: BIANCA,
  }).household;
  return household;
}

function recordFor(household: Household, memberId: string, chapterId: string, tab: ReturnMessageRecord["tab"]): ReturnMessageRecord {
  return {
    environment: household.environment,
    householdId: household.householdId,
    memberId,
    chapterId,
    tab,
    setAt: "2026-09-03T14:05:00.000Z",
  };
}

describe("onboardingNavigationTarget", () => {
  it("offers the conductor a target when the chapter's registry row lists navigate", () => {
    const household = throughSittingOne();
    expect(onboardingNavigationTarget(household, BIANCA, TODAY)).toEqual({
      chapterId: "ch-04-accounts",
      target: { tab: "ledger" },
    });
  });

  it("never offers the witness a control that would write the conductor's state", () => {
    const household = throughSittingOne();
    expect(onboardingNavigationTarget(household, JONATHAN, TODAY)).toBeNull();
  });

  it("returns null for a chapter whose target is null (ch-01-meet: no navigate action)", () => {
    const household = proposedActive();
    expect(onboardingNavigationTarget(household, BIANCA, TODAY)).toBeNull();
    expect(onboardingNavigationTarget(household, JONATHAN, TODAY)).toBeNull();
  });

  it("returns null once there is no next chapter left at all for this member", () => {
    // nextChapterFor is per-member: acknowledging every household chapter
    // as Bianca (regardless of who actually conducts each one — recording
    // is not the same as satisfying someone else's turn) exhausts her own
    // queue while onboarding stays active, which is the one path in
    // progress.ts that returns null instead of falling through to a
    // personal module.
    const HOUSEHOLD_CHAPTER_IDS = [
      "ch-01-meet", "ch-02-household", "ch-03-charter", "ch-04-accounts",
      "ch-05-opening", "ch-06-fund", "ch-07-recurrences", "ch-08-cadence",
      "ch-09-categories", "ch-10-estimates", "ch-11-plan", "ch-12-ready",
    ];
    let household = proposedActive();
    for (const chapterId of HOUSEHOLD_CHAPTER_IDS) {
      if (chapterId === "ch-03-charter") {
        household = foundHouseholdCharter(household, {
          memberId: JONATHAN,
          custodianMemberId: BIANCA,
          purpose: "Roof and groceries.",
          splitRule: "remainder",
          splitNote: "Bianca covers what she can, Jonathan closes the rest.",
          ceilingKind: "none",
          cadence: "weekly",
          cadenceWeekday: 0,
          date: TODAY,
        }).household;
        household = signHouseholdCharter(household, { memberId: BIANCA }).household;
        household = signHouseholdCharter(household, { memberId: JONATHAN }).household;
      }
      if (chapterId === "ch-04-accounts") {
        household = setFundCardAccount(household, {
          memberId: BIANCA, accountId: "ACC-VISA", createdBy: BIANCA,
        }).household;
      }
      if (chapterId === "ch-05-opening") {
        const confirmationId = "OPEN-RETURN-TEST";
        const posted = postOpeningBalances(household, {
          asOfDate: TODAY,
          createdBy: BIANCA,
          confirmationId,
          lines: household.accounts
            .filter((account) => account.active && account.scope !== "personal")
            .map((account, index) => ({ accountId: account.id, amountCents: (index + 1) * 100_00 })),
        });
        household = {
          ...posted.household,
          commandReceipts: [
            ...(posted.household.commandReceipts ?? []),
            {
              confirmationId,
              identityHash: `identity-${confirmationId}`,
              auditHash: `audit-${confirmationId}`,
              commandKind: "postOpeningBalances",
              postedIds: posted.postedIds,
              revision: 1,
              acceptedAt: "2026-09-03T16:00:00.000Z",
            },
          ],
        };
      }
      if (chapterId === "ch-06-fund") {
        const revision = "2026-09-03T16:05:00.000Z";
        household = configureHouseholdFund(household, {
          custodianMemberId: BIANCA,
          openedOn: TODAY,
          createdBy: BIANCA,
          at: revision,
        }).household;
        household = approveHouseholdFundConfiguration(household, {
          memberId: JONATHAN,
          createdBy: JONATHAN,
          revision,
          at: "2026-09-03T16:06:00.000Z",
        }).household;
      }
      if (chapterId === "ch-07-recurrences") {
        for (const recurrence of [
          { note: "Rent", amount: "1850", subcategoryId: "SUB-HOUSING-RENT" },
          { note: "Phone", amount: "95", subcategoryId: "SUB-LIFE-PHONE" },
        ]) {
          household = addRecurrence(household, {
            cadence: "monthly",
            nextDate: TODAY,
            type: "expense",
            amount: recurrence.amount,
            accountId: "ACC-CHEQUING",
            subcategoryId: recurrence.subcategoryId,
            note: recurrence.note,
            origin: "manual",
          }).household;
        }
      }
      if (chapterId === "ch-08-cadence") {
        household = recordEarningCadence(household, {
          memberId: BIANCA,
          createdBy: BIANCA,
          paySchedule: {
            cadence: "irregular",
            anchorDate: TODAY,
            weekday: 0,
            monthDays: [15, 30],
            customDates: [],
            reminderTime: "09:00",
          },
          detailAction: "skip",
        }).household;
      }
      household = chapterId === "ch-02-household"
        ? recordObservedChapterCompletion(household, {
            memberId: BIANCA,
            chapterId,
            createdBy: BIANCA,
            observation: {
              kind: "resolved",
              scope: { environment: household.environment, householdId: household.householdId, memberId: BIANCA },
              currentMemberId: BIANCA,
              seatMemberIds: [BIANCA, JONATHAN],
              observedAt: "2026-09-03T14:02:00.000Z",
            },
          }).household
        : recordChapterAcknowledgement(household, { memberId: BIANCA, chapterId, createdBy: BIANCA }).household;
    }
    expect(onboardingNavigationTarget(household, BIANCA, TODAY)).toBeNull();
  });
});

describe("navTargetSurfaceLabel", () => {
  it("names the tab the way the sentence needs, not the abbreviated nav-strip text", () => {
    expect(navTargetSurfaceLabel("more")).toBe("More");
    expect(navTargetSurfaceLabel("ledger")).toBe("Books");
    expect(navTargetSurfaceLabel("calendar")).toBe("Calendar");
    expect(navTargetSurfaceLabel("plan")).toBe("Plan");
    expect(navTargetSurfaceLabel("shift")).toBe("Shifts");
  });
});

describe("return-message persistence — phone-local, same shape as locationPrefs", () => {
  it("round-trips a saved record through load", () => {
    const household = throughSittingOne();
    const store = memoryStore();
    const record = recordFor(household, BIANCA, "ch-04-accounts", "more");
    saveReturnMessage(record, store);
    expect(loadReturnMessage(household.environment, household.householdId, BIANCA, store)).toEqual(record);
  });

  it("has nothing to load before anything is saved", () => {
    const household = throughSittingOne();
    expect(loadReturnMessage(household.environment, household.householdId, BIANCA, memoryStore())).toBeNull();
  });

  it("clearReturnMessage removes exactly the one record", () => {
    const household = throughSittingOne();
    const store = memoryStore();
    saveReturnMessage(recordFor(household, BIANCA, "ch-04-accounts", "more"), store);
    saveReturnMessage(recordFor(household, JONATHAN, "ch-04-accounts", "more"), store);
    clearReturnMessage(household.environment, household.householdId, BIANCA, store);
    expect(loadReturnMessage(household.environment, household.householdId, BIANCA, store)).toBeNull();
    expect(loadReturnMessage(household.environment, household.householdId, JONATHAN, store)).not.toBeNull();
  });

  it("a malformed or foreign value in storage loads as nothing, not a crash", () => {
    const household = throughSittingOne();
    const store = memoryStore();
    store.setItem(`hearth:onboardingReturn:${household.environment}:${household.householdId}:${BIANCA}`, "{not json");
    expect(loadReturnMessage(household.environment, household.householdId, BIANCA, store)).toBeNull();
    store.setItem(`hearth:onboardingReturn:${household.environment}:${household.householdId}:${BIANCA}`, JSON.stringify({ chapterId: "ch-04-accounts" }));
    expect(loadReturnMessage(household.environment, household.householdId, BIANCA, store)).toBeNull();
  });
});

describe("the instruction survives ordinary navigation and a reload; only a passing probe clears it", () => {
  it("stays active across three simulated navigations", () => {
    const household = throughSittingOne();
    const store = memoryStore();
    const record = saveReturnMessage(recordFor(household, BIANCA, "ch-04-accounts", "more"), store);

    // Three "navigations": re-derive activeReturnMessage against the same
    // still-pending household, each time as if the member had just landed
    // on a different tab (home, then more, then back to home). Nothing
    // about the navigation itself is inspected by activeReturnMessage —
    // that is the point: it has no route listener to react to, only the
    // household's own chapter progress.
    for (let hop = 0; hop < 3; hop += 1) {
      const reloaded = loadReturnMessage(household.environment, household.householdId, BIANCA, store);
      expect(activeReturnMessage(reloaded, household, TODAY)).toEqual(record);
    }
  });

  it("survives a reload — a fresh load from the same backing store still carries it", () => {
    const household = throughSittingOne();
    const store = memoryStore();
    const record = saveReturnMessage(recordFor(household, BIANCA, "ch-04-accounts", "more"), store);

    // "Reload" = a brand new read, not the in-memory object saveReturnMessage
    // handed back — this is what a real page refresh would do too.
    const reloaded = loadReturnMessage(household.environment, household.householdId, BIANCA, store);
    expect(reloaded).toEqual(record);
    expect(activeReturnMessage(reloaded, household, TODAY)).toEqual(record);
  });

  it("clears once the chapter that sent the member away is no longer their next chapter", () => {
    const household = throughSittingOne();
    const store = memoryStore();
    saveReturnMessage(recordFor(household, BIANCA, "ch-04-accounts", "more"), store);

    const stillPending = loadReturnMessage(household.environment, household.householdId, BIANCA, store)!;
    expect(returnMessageProbePassed(stillPending, household, TODAY)).toBe(false);
    expect(activeReturnMessage(stillPending, household, TODAY)).not.toBeNull();

    const finished = recordChapterAcknowledgement(household, { memberId: BIANCA, chapterId: "ch-04-accounts", createdBy: BIANCA }).household;
    expect(returnMessageProbePassed(stillPending, finished, TODAY)).toBe(true);
    expect(activeReturnMessage(stillPending, finished, TODAY)).toBeNull();
  });

  it("does not clear on an unrelated household change while the chapter is still outstanding", () => {
    const household = throughSittingOne();
    const record = recordFor(household, BIANCA, "ch-04-accounts", "more");
    // A revision bump from something wholly unrelated to onboarding —
    // still the same next chapter for Bianca, so still active. Nothing in
    // this module reacts to "the household changed"; only to whether the
    // one chapter it is watching has been satisfied.
    const untouched: Household = { ...household, revision: household.revision + 7 };
    expect(activeReturnMessage(record, untouched, TODAY)).toEqual(record);
  });

  it("does not apply a record left over from a different household or environment", () => {
    const household = throughSittingOne();
    const foreignHousehold = recordFor(household, BIANCA, "ch-04-accounts", "more");
    foreignHousehold.householdId = "some-other-household";
    expect(activeReturnMessage(foreignHousehold, household, TODAY)).toBeNull();

    const foreignEnvironment = recordFor(household, BIANCA, "ch-04-accounts", "more");
    foreignEnvironment.environment = household.environment === "development" ? "production" : "development";
    expect(activeReturnMessage(foreignEnvironment, household, TODAY)).toBeNull();
  });

  it("activeReturnMessage(null, ...) is null — nothing stored, nothing shown", () => {
    const household = throughSittingOne();
    expect(activeReturnMessage(null, household, TODAY)).toBeNull();
  });
});

describe("the fence — returnMessage.ts owns no timer, no route listener, no click handler", () => {
  it("contains no setTimeout", () => {
    expect(moduleSource).not.toMatch(/setTimeout/);
  });

  it("contains no route listener", () => {
    expect(moduleSource).not.toMatch(/addEventListener/);
    expect(moduleSource).not.toMatch(/popstate/);
    expect(moduleSource).not.toMatch(/useNavigate|history\.push|window\.location/);
  });

  it("contains no click handler — this is not a React file", () => {
    expect(moduleSource).not.toMatch(/onClick/);
    expect(moduleSource).not.toMatch(/from "react"/);
  });

  it("clears only through returnMessageProbePassed / activeReturnMessage — no other exported function removes an active record's meaning", () => {
    // The only way this module lets a caller conclude "the instruction is
    // gone" is by calling activeReturnMessage (or its probe) again with
    // fresher household data. clearReturnMessage exists only to tidy up
    // storage after that — it is never what an aria-live consumer should
    // branch on.
    expect(moduleSource).toMatch(/export function activeReturnMessage/);
    expect(moduleSource).toMatch(/export function returnMessageProbePassed/);
  });
});

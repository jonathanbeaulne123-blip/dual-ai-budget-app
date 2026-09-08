import {
  catalogHousehold,
  confirmHouseholdOnboarding,
  foundHouseholdCharter,
  proposeHouseholdOnboarding,
  recordChapterAcknowledgement,
  recordObservedChapterCompletion,
  signHouseholdCharter,
  setFundCardAccount,
  type Household,
} from "../../src/core/index.ts";

const BIANCA="MEM-001", JONATHAN="MEM-002", TODAY="2026-09-03";
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
export function throughSittingOne(): Household {
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

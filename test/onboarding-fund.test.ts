// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { HouseholdFundPanel } from "../src/HouseholdFundPanel.tsx";
import { OnboardingChat } from "../src/OnboardingChat.tsx";
import {
  approveHouseholdFundConfiguration,
  addAccount,
  bindHouseholdFundBackingAccount,
  catalogHousehold,
  configureHouseholdFund,
  confirmHouseholdOnboarding,
  emptyMemberOnboardingProgress,
  evidenceFor,
  financialAuditHash,
  foundHouseholdCharter,
  mergeShared,
  projectHouseholdFund,
  proposeHouseholdOnboarding,
  recordChapterAcknowledgement,
  setFundCardAccount,
  splitForSync,
  type Household,
} from "../src/core/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const TODAY = "2026-09-04";
const REVISION_A = "2026-09-04T14:00:00.000Z";
const REVISION_B = "2026-09-04T15:00:00.000Z";

function chartered(): Household {
  let household = catalogHousehold("development");
  household = addAccount(household, {
    name: "Bianca private reserve",
    kind: "savings",
    scope: "personal",
    ownerMemberId: BIANCA,
    institution: "Private Bank",
    last4: "9876",
  }).household;
  household = foundHouseholdCharter(household, {
    memberId: JONATHAN,
    custodianMemberId: BIANCA,
    purpose: "Keep the household steady.",
    splitRule: "remainder",
    splitNote: "We cover the home together.",
    ceilingKind: "none",
    cadence: "weekly",
    cadenceWeekday: 0,
    date: TODAY,
  }).household;
  return setFundCardAccount(household, {
    memberId: BIANCA,
    accountId: "ACC-VISA",
    createdBy: BIANCA,
  }).household;
}

function configured(at = REVISION_A): Household {
  const household = configureHouseholdFund(chartered(), {
    custodianMemberId: BIANCA,
    openedOn: TODAY,
    createdBy: BIANCA,
    at,
  }).household;
  const backing = household.accounts.find((account) => account.name === "Bianca private reserve")!;
  return bindHouseholdFundBackingAccount(household, {
    memberId: BIANCA,
    accountId: backing.id,
    provider: "manual",
    accountDigest: "private-bank-9876",
  }).household;
}

function approved(at = REVISION_A): Household {
  return approveHouseholdFundConfiguration(configured(at), {
    memberId: JONATHAN,
    createdBy: JONATHAN,
    revision: at,
    at: "2026-09-04T16:00:00.000Z",
  }).household;
}

function atChapterSix(household: Household): Household {
  let next = proposeHouseholdOnboarding(household, {
    memberId: BIANCA,
    at: "2026-09-04T12:00:00.000Z",
  }).household;
  next = confirmHouseholdOnboarding(next, {
    memberId: JONATHAN,
    at: "2026-09-04T12:01:00.000Z",
  }).household;
  return {
    ...next,
    members: next.members.map((member) => {
      const progress = emptyMemberOnboardingProgress({
        environment: next.environment,
        householdId: next.householdId,
        memberId: member.id,
      });
      return {
        ...member,
        onboardingProgress: {
          ...progress,
          rows: progress.rows.map((row) => Number(row.chapterId.slice(3, 5)) < 6
            ? { ...row, acknowledgedAt: "2026-09-04T13:00:00.000Z", lastSafeResumePoint: row.chapterId }
            : row),
          updatedAt: "2026-09-04T13:00:00.000Z",
        },
      };
    }),
  };
}

describe("onboarding Slice 15 — Chapter 6 Household Fund", () => {
  it("requires both people to approve the same exact configuration revision", () => {
    const oneApproval = configured();
    expect(oneApproval.householdFund?.approvals).toEqual([{
      memberId: BIANCA,
      revision: REVISION_A,
      approvedAt: REVISION_A,
    }]);
    expect(evidenceFor(oneApproval, "ch-06-fund", BIANCA)).toEqual({ kind: "empty" });

    const both = approved();
    const evidence = evidenceFor(both, "ch-06-fund", JONATHAN);
    expect(evidence).toMatchObject({ kind: "accepted", card: { scope: "household", kind: "approval" } });
    expect(evidence.kind === "accepted" && evidence.card.lines).toEqual(expect.arrayContaining([
      { label: "Custodian", value: "Bianca" },
      { label: "Bianca approved", value: TODAY },
      { label: "Jonathan approved", value: TODAY },
    ]));
  });

  it("keeps Personal backing-account facts out of Shared evidence", () => {
    const household = approved();
    const personal = household.accounts.find((account) => (
      account.scope === "personal" && account.ownerMemberId === BIANCA && account.kind === "savings"
    ));
    expect(personal).toBeDefined();
    const evidence = evidenceFor(household, "ch-06-fund", BIANCA);
    const serialized = JSON.stringify(evidence);
    expect(serialized).toContain("details stay private");
    expect(serialized).not.toContain(personal!.id);
    expect(serialized).not.toContain(personal!.name);
    expect(serialized).not.toContain(personal!.institution);
    expect(serialized).not.toContain(personal!.last4);
  });

  it("records consent without changing accepted books, the Fund projection, or money rows", async () => {
    const before = configured();
    const beforeProjection = projectHouseholdFund(before, TODAY);
    const beforeHash = await financialAuditHash(before);
    const result = approveHouseholdFundConfiguration(before, {
      memberId: JONATHAN,
      createdBy: JONATHAN,
      revision: REVISION_A,
      at: "2026-09-04T16:00:00.000Z",
    });
    expect(result.postedIds).toEqual(["FUND-HOUSEHOLD"]);
    expect(result.household.transactions).toEqual(before.transactions);
    expect(result.household.fundEvents).toEqual(before.fundEvents);
    expect(projectHouseholdFund(result.household, TODAY)).toEqual(beforeProjection);
    expect(await financialAuditHash(result.household)).toBe(beforeHash);
  });

  it("keeps approval self-owned and refuses a stale button revision", () => {
    const household = configured();
    expect(() => approveHouseholdFundConfiguration(household, {
      memberId: JONATHAN,
      createdBy: BIANCA,
      revision: REVISION_A,
    })).toThrow("Only you can approve your own Fund setup.");
    expect(() => approveHouseholdFundConfiguration(household, {
      memberId: JONATHAN,
      createdBy: JONATHAN,
      revision: REVISION_B,
    })).toThrow("That Fund setup changed. Review the current version before approving it.");
  });

  it("merges independent seats, but blocks approvals made against different revisions", () => {
    const left = approved(REVISION_A);
    const right = configured(REVISION_B);
    const merged = mergeShared(splitForSync(left, BIANCA).shared, splitForSync(right, BIANCA).shared);
    expect(merged.householdFund?.configurationRevision).toBe(REVISION_B);
    expect(merged.householdFund?.approvals).toEqual(expect.arrayContaining([
      expect.objectContaining({ memberId: BIANCA, revision: REVISION_B }),
      expect.objectContaining({ memberId: JONATHAN, revision: REVISION_A }),
    ]));
    expect(mergeShared(splitForSync(right, BIANCA).shared, splitForSync(left, BIANCA).shared).householdFund)
      .toEqual(merged.householdFund);
    expect(evidenceFor({ ...right, ...merged }, "ch-06-fund", BIANCA))
      .toEqual({ kind: "ineligible", reason: "stale" });
  });

  it("blocks Charter and Fund custody disagreement with the required honest copy", () => {
    const household = approved();
    const hostileLegacy = {
      ...household,
      charter: { ...household.charter!, custodianMemberId: JONATHAN },
    };
    expect(evidenceFor(hostileLegacy, "ch-06-fund", BIANCA))
      .toEqual({ kind: "ineligible", reason: "custody" });
    const chatSource = readFileSync(resolve(process.cwd(), "src/OnboardingChat.tsx"), "utf8");
    expect(chatSource).toContain('case "custody": return { copyKey: "fund.custody-mismatch"');
    expect(chatSource).not.toContain("approveHouseholdFundConfiguration");
  });

  it("refuses Next until the joint evidence exists", () => {
    expect(() => recordChapterAcknowledgement(configured(), {
      memberId: BIANCA,
      chapterId: "ch-06-fund",
      createdBy: BIANCA,
    })).toThrow("Both people need to approve the current Household Fund setup before continuing.");
    expect(() => recordChapterAcknowledgement(approved(), {
      memberId: BIANCA,
      chapterId: "ch-06-fund",
      createdBy: BIANCA,
    })).not.toThrow();
  });

  it("puts the reviewed approval on the real Fund surface with accessible controls", () => {
    let household = configured();
    const personal = household.accounts.find((account) => (
      account.scope === "personal" && account.ownerMemberId === BIANCA && account.kind === "savings"
    ));
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const render = () => act(() => root.render(createElement(HouseholdFundPanel, {
      household,
      memberId: JONATHAN,
      view: "household",
      onCommand: (command) => { household = command(household).household; },
    })));
    render();
    expect(host.textContent).toContain("The backing account stays in the custodian's Personal books.");
    expect(host.textContent).toContain("This records your agreement with the setup. It doesn't move money.");
    expect(host.textContent).not.toContain(personal!.name);
    const approval = [...host.querySelectorAll("button")].find((button) => (
      button.textContent === "I approve this Fund setup"
    ));
    expect(approval).toBeDefined();
    expect(approval?.style.minHeight).toBe("44px");
    act(() => approval!.click());
    render();
    expect(host.textContent).toContain("You're approved on this version.");
    act(() => root.unmount());
    host.remove();
  });

  it("keeps the second seat in the actor flow through approval and Next", () => {
    const household = atChapterSix(approved());
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(createElement(OnboardingChat, {
      household,
      memberId: JONATHAN,
      today: TODAY,
      onDismiss: () => {},
      onCommit: () => {},
      onOpenHouseholdFund: () => {},
    })));
    expect(host.textContent).toContain("The approvals");
    expect([...host.querySelectorAll("button")].map((button) => button.textContent))
      .toEqual(["Next", "Stop setup for now"]);
    act(() => root.unmount());
    host.remove();
  });
});

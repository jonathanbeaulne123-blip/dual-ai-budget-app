import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  HANDSHAKE_WINDOW_MINUTES,
  ONBOARDING_MODE_COPY,
  ONBOARDING_REGISTRY_VERSION,
  acceptHouseholdWrite,
  assembleHousehold,
  catalogHousehold,
  commandIdentityHash,
  confirmHouseholdOnboarding,
  handshakeExpired,
  mergeShared,
  offerHouseholdOnboarding,
  onboardingIsActive,
  ordinaryHerculesAvailable,
  proposeHouseholdOnboarding,
  resumeHouseholdOnboarding,
  shapeHouseholdOnboarding,
  splitForSync,
  stopHouseholdOnboarding,
  type Household,
  type CommitResult,
} from "../src/core/index.ts";
import {
  appendHostedCommandEvent,
  buildCommandEventFromReceipt,
  catchUpClientFromCommandLog,
  createMemoryCommandLogStore,
} from "../src/ledger/index.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const PROPOSED_AT = "2026-09-03T14:00:00.000Z";

function proposed(): Household {
  return proposeHouseholdOnboarding(catalogHousehold("development"), {
    memberId: BIANCA,
    at: PROPOSED_AT,
  }).household;
}

function active(): Household {
  return confirmHouseholdOnboarding(proposed(), {
    memberId: JONATHAN,
    at: "2026-09-03T14:01:00.000Z",
  }).household;
}

async function acceptCommand(previous: Household, result: CommitResult, confirmationId: string, memberId: string): Promise<Household> {
  const outcome = await acceptHouseholdWrite({
    previous,
    candidate: result.household,
    confirmationId,
    commandKind: result.undo.commandKind,
    postedIds: result.postedIds,
    actingMemberId: memberId,
    adapters: {
      persist: async () => {},
      ingest: async () => ({ ok: true }),
    },
  });
  expect(outcome.ok).toBe(true);
  return outcome.household;
}

describe("onboarding household mode", () => {
  it("uses an exact fifteen-minute handshake window and never activates an expired proposal", () => {
    const household = proposed();
    const row = household.householdOnboarding!;
    expect(HANDSHAKE_WINDOW_MINUTES).toBe(15);
    expect(row.handshakeExpiresAt).toBe("2026-09-03T14:15:00.000Z");
    expect(handshakeExpired(row, "2026-09-03T14:14:59.999Z")).toBe(false);
    expect(handshakeExpired(row, "2026-09-03T14:15:00.000Z")).toBe(true);
    expect(() => confirmHouseholdOnboarding(household, {
      memberId: JONATHAN,
      at: "2026-09-03T14:15:00.000Z",
    })).toThrow(ONBOARDING_MODE_COPY["invite.expired"]);
    expect(onboardingIsActive(household)).toBe(false);
  });

  it("activates only after both active members have confirmed on their own devices", () => {
    const ownConfirmation = confirmHouseholdOnboarding(proposed(), {
      memberId: BIANCA,
      at: "2026-09-03T14:01:00.000Z",
    }).household;
    expect(ownConfirmation.householdOnboarding).toMatchObject({
      state: "handshake-pending",
      confirmedByMemberIds: [BIANCA],
      startedAt: null,
    });
    expect(onboardingIsActive(ownConfirmation)).toBe(false);

    const partnerConfirmation = confirmHouseholdOnboarding(ownConfirmation, {
      memberId: JONATHAN,
      at: "2026-09-03T14:02:00.000Z",
    }).household;
    expect(partnerConfirmation.householdOnboarding).toMatchObject({
      state: "active",
      confirmedByMemberIds: [BIANCA, JONATHAN],
      startedAt: "2026-09-03T14:02:00.000Z",
    });
    expect(onboardingIsActive(partnerConfirmation)).toBe(true);
  });

  it.each([
    ["offerHouseholdOnboarding", () => offerHouseholdOnboarding(catalogHousehold("development"), { memberId: BIANCA, at: PROPOSED_AT }).household],
    ["proposeHouseholdOnboarding", () => proposed()],
    ["confirmHouseholdOnboarding", () => confirmHouseholdOnboarding(proposed(), { memberId: BIANCA, at: "2026-09-03T14:01:00.000Z" }).household],
    ["stopHouseholdOnboarding", () => stopHouseholdOnboarding(active(), { memberId: BIANCA }).household],
    ["resumeHouseholdOnboarding", () => {
      const stopped = stopHouseholdOnboarding(active(), { memberId: BIANCA, soloReason: "Partner is unreachable." }).household;
      return resumeHouseholdOnboarding(stopped, { memberId: BIANCA }).household;
    }],
  ])("%s cannot put the household into active mode with one member action", (_name, run) => {
    expect(run().householdOnboarding?.state).not.toBe("active");
  });

  it("keeps the single-member activation proof exhaustive over every mode command", () => {
    const source = readFileSync(new URL("../src/core/commands.ts", import.meta.url), "utf8");
    const commandNames = [...source.matchAll(/export function (\w*HouseholdOnboarding)\s*\(/g)]
      .map((match) => match[1])
      .sort();
    expect(commandNames).toEqual([
      "confirmHouseholdOnboarding",
      "offerHouseholdOnboarding",
      "proposeHouseholdOnboarding",
      "resumeHouseholdOnboarding",
      "stopHouseholdOnboarding",
    ]);
  });

  it("records an honest two-member stop without completion", () => {
    const running = active();
    running.householdOnboarding = {
      ...running.householdOnboarding!,
      completedAt: "2026-09-03T14:01:30.000Z",
      completionDigest: "forged-completion",
    };
    const waiting = stopHouseholdOnboarding(running, { memberId: BIANCA }).household;
    expect(waiting.householdOnboarding).toMatchObject({
      state: "waiting-member",
      stoppedByMemberIds: [BIANCA],
      stoppedSolo: false,
      completedAt: null,
      completionDigest: null,
    });
    expect(ordinaryHerculesAvailable(waiting)).toBe(false);

    const stopped = stopHouseholdOnboarding(waiting, { memberId: JONATHAN }).household;
    expect(stopped.householdOnboarding).toMatchObject({
      state: "stopped-incomplete",
      stoppedByMemberIds: [BIANCA, JONATHAN],
      stoppedSolo: false,
      completedAt: null,
      completionDigest: null,
    });
    expect(ordinaryHerculesAvailable(stopped)).toBe(true);
  });

  it("takes the solo stop path only when a reason is supplied", () => {
    const noReason = stopHouseholdOnboarding(active(), { memberId: BIANCA }).household;
    expect(noReason.householdOnboarding).toMatchObject({ state: "waiting-member", stoppedSolo: false });

    const solo = stopHouseholdOnboarding(active(), {
      memberId: BIANCA,
      soloReason: "Partner is unreachable.",
    }).household;
    expect(solo.householdOnboarding).toMatchObject({
      state: "stopped-incomplete",
      stoppedByMemberIds: [BIANCA],
      stoppedSolo: true,
      completedAt: null,
      completionDigest: null,
    });
  });

  it("derives ordinary Hercules availability only from the accepted shared record", () => {
    const freeRoam = catalogHousehold("development");
    const offered = offerHouseholdOnboarding(freeRoam, { memberId: BIANCA, at: PROPOSED_AT }).household;
    const pending = proposed();
    const running = active();
    expect(ordinaryHerculesAvailable(freeRoam)).toBe(true);
    expect(ordinaryHerculesAvailable(offered)).toBe(true);
    expect(ordinaryHerculesAvailable(pending)).toBe(true);
    expect(ordinaryHerculesAvailable(running)).toBe(false);

    const wrongHousehold = structuredClone(running);
    wrongHousehold.householdOnboarding = { ...wrongHousehold.householdOnboarding!, householdId: "HH-OTHER" };
    expect(ordinaryHerculesAvailable(wrongHousehold)).toBe(true);
    const wrongEnvironment = structuredClone(running);
    wrongEnvironment.householdOnboarding = { ...wrongEnvironment.householdOnboarding!, environment: "production" };
    expect(ordinaryHerculesAvailable(wrongEnvironment)).toBe(true);

    const source = readFileSync(new URL("../src/core/onboarding/mode.ts", import.meta.url), "utf8");
    expect(source).not.toContain(".tsx");
    expect(source).not.toMatch(/from\s+["'][^"']*(?:App|commands|commandRuntime|provider)[^"']*["']/i);
  });

  it("shapes an unknown state to blocked, never complete", () => {
    const row = shapeHouseholdOnboarding({
      ...proposed().householdOnboarding,
      state: "surprise-complete",
    });
    expect(row?.state).toBe("blocked");
    expect(row?.state).not.toBe("complete");
  });

  it("shapes a mismatched registry version to repair, never active", () => {
    const household = active();
    const future = shapeHouseholdOnboarding({
      ...household.householdOnboarding,
      registryVersion: ONBOARDING_REGISTRY_VERSION + 1,
      state: "active",
    });
    expect(future?.state).toBe("repair");
    household.householdOnboarding = future;
    expect(onboardingIsActive(household)).toBe(false);
    expect(ordinaryHerculesAvailable(household)).toBe(false);
  });

  it("merges two offline device confirmations to active exactly once", () => {
    const base = proposed();
    const biancaDevice = confirmHouseholdOnboarding(base, {
      memberId: BIANCA,
      at: "2026-09-03T14:01:00.000Z",
    }).household;
    const jonathanDevice = confirmHouseholdOnboarding(base, {
      memberId: JONATHAN,
      at: "2026-09-03T14:02:00.000Z",
    }).household;
    const biancaShared = splitForSync(biancaDevice, BIANCA).shared;
    const jonathanParts = splitForSync(jonathanDevice, JONATHAN);
    const jonathanShared = jonathanParts.shared;
    expect(jonathanParts.personal).not.toHaveProperty("householdOnboarding");

    const mergedOnce = mergeShared(biancaShared, jonathanShared);
    const mergedTwice = mergeShared(mergedOnce, biancaShared);
    const assembled = assembleHousehold(mergedTwice, null, { linked: true });
    expect(mergedOnce.householdOnboarding).toMatchObject({
      state: "active",
      confirmedByMemberIds: [BIANCA, JONATHAN],
      startedAt: "2026-09-03T14:02:00.000Z",
    });
    expect(mergedTwice.householdOnboarding).toEqual(mergedOnce.householdOnboarding);
    expect(assembled.householdOnboarding).toEqual(mergedOnce.householdOnboarding);
    expect(onboardingIsActive(assembled)).toBe(true);
  });

  it("binds the mode row into command identity and ordered continuity replay", async () => {
    const base = catalogHousehold("development");
    const proposal = proposeHouseholdOnboarding(base, { memberId: BIANCA, at: PROPOSED_AT });
    const acceptedProposal = await acceptCommand(base, proposal, "onboarding-proposal", BIANCA);
    const proposalReceipt = acceptedProposal.commandReceipts.find((row) => row.confirmationId === "onboarding-proposal")!;
    expect(proposalReceipt.materializationHash).toMatch(/^[a-f0-9]{64}$/);

    const store = createMemoryCommandLogStore(base.revision);
    expect(appendHostedCommandEvent(store, buildCommandEventFromReceipt({
      household: acceptedProposal,
      confirmationId: "onboarding-proposal",
      baseRevision: base.revision,
      memberId: BIANCA,
    }))).toMatchObject({ ok: true });
    const remotePending = await catchUpClientFromCommandLog({ client: base, store, memberId: JONATHAN });
    expect(remotePending.householdOnboarding?.state).toBe("handshake-pending");

    const confirmation = confirmHouseholdOnboarding(acceptedProposal, {
      memberId: JONATHAN,
      at: "2026-09-03T14:02:00.000Z",
    });
    const ownConfirmation = confirmHouseholdOnboarding(acceptedProposal, {
      memberId: BIANCA,
      at: "2026-09-03T14:02:00.000Z",
    });
    expect(await commandIdentityHash(acceptedProposal, confirmation.household, confirmation.postedIds))
      .not.toBe(await commandIdentityHash(acceptedProposal, ownConfirmation.household, ownConfirmation.postedIds));

    const acceptedConfirmation = await acceptCommand(
      acceptedProposal,
      confirmation,
      "onboarding-confirmation",
      JONATHAN,
    );
    expect(appendHostedCommandEvent(store, buildCommandEventFromReceipt({
      household: acceptedConfirmation,
      confirmationId: "onboarding-confirmation",
      baseRevision: acceptedProposal.revision,
      memberId: JONATHAN,
    }))).toMatchObject({ ok: true });
    const remoteActive = await catchUpClientFromCommandLog({
      client: remotePending,
      store,
      memberId: JONATHAN,
    });
    expect(remoteActive.householdOnboarding).toMatchObject({
      state: "active",
      confirmedByMemberIds: [BIANCA, JONATHAN],
    });
  });

  it("keeps the required handshake copy byte-exact", () => {
    expect(ONBOARDING_MODE_COPY).toEqual({
      "invite.explain": "This puts both of us in setup mode until we finish or stop. Three sittings, about an hour all in — we can stop between any of them.",
      "invite.waiting": "Waiting for {name} to say yes on their device.",
      "invite.expired": "That invitation expired. Start it again whenever you're both ready.",
      "stop.recorded": "Setup stopped. Nothing was marked done — we can pick it up whenever.",
    });
  });
});

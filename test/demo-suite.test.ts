import { describe, expect, it } from "vitest";
import {
  assertDemoReplacementAllowed,
  acceptHouseholdWrite,
  assembleHousehold,
  catalogHousehold,
  DEMO_SUITE_COMMAND_KIND,
  DEMO_ENGINE_NAMES,
  DEMO_TOOL_COVERAGE,
  ensureHouseholdShape,
  executeHerculesReadToolPlan,
  generateDemoSuite,
  HERCULES_PRO_INVESTOR_PROMPTS,
  HERCULES_READ_TOOL_NAMES,
  householdForShiftReadTools,
  mergeShared,
  personalReplicaForMember,
  preserveDemoShowcaseContinuity,
  splitForSync,
  torontoOffsetForDate,
  verifyDemoSuite,
} from "../src/core/index.ts";

const TODAY = "2026-08-29" as const;

async function yieldToRunner(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

describe("trustworthy synthetic Demo Suite", () => {
  it("replays the exact same dated household and manifest from one seed", async () => {
    const first = await generateDemoSuite({ today: TODAY, seed: 8675309, buildSha: "test-sha" });
    await yieldToRunner();
    const replay = await generateDemoSuite({ today: TODAY, seed: 8675309, buildSha: "test-sha" });
    expect(replay).toEqual(first);
    expect(first.household.syntheticFixture).toMatchObject({
      kind: "hearth-demo-suite",
      version: "2.0.0",
      seed: 8675309,
      generatedForDate: TODAY,
      buildSha: "test-sha",
      numberStyle: "realistic",
      fixtureHashSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(first.manifest.fixtureHashSha256).toBe(first.household.syntheticFixture?.fixtureHashSha256);
  }, 300_000);

  it("covers every domain engine and every Hercules Pro calculation surface", async () => {
    const generated = await generateDemoSuite({ today: TODAY, seed: 424242 });
    await yieldToRunner();
    const accepted = await acceptHouseholdWrite({
      previous: null,
      candidate: generated.household,
      confirmationId: "CONFIRM-DEMO-CREATE",
      commandKind: DEMO_SUITE_COMMAND_KIND,
      postedIds: [],
      adapters: {
        ingest: async () => ({ ok: true }),
        persist: async () => undefined,
      },
    });
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) throw new Error(accepted.userMessage ?? "Demo fixture acceptance failed");
    const report = await verifyDemoSuite(accepted.household, generated.manifest);
    expect(generated.manifest.engines.map((row) => row.name)).toEqual(DEMO_ENGINE_NAMES);
    expect(Object.keys(DEMO_TOOL_COVERAGE).sort()).toEqual([...HERCULES_READ_TOOL_NAMES].sort());
    expect(generated.manifest.prompts).toEqual(HERCULES_PRO_INVESTOR_PROMPTS);
    expect(report.tools).toHaveLength(HERCULES_READ_TOOL_NAMES.length);
    expect(report.attestationSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(report.checks.filter((row) => row.status === "fail")).toEqual([]);
    expect(report.status).toBe("ready");
  }, 300_000);

  it("accepts dedicated creation, same-seed replay, and fresh-seed replacement without overwriting ordinary books", async () => {
    const generated = await generateDemoSuite({ today: TODAY, seed: 616161, buildSha: "demo-boundary" });
    await yieldToRunner();
    const adapters = {
      ingest: async () => ({ ok: true }),
      persist: async () => undefined,
      validateCandidate: async () => ({ ok: true }),
      transport: async () => ({ ok: true as const }),
    };
    const ordinaryOpenHousehold = catalogHousehold("development");
    const created = await acceptHouseholdWrite({
      previous: ordinaryOpenHousehold,
      candidate: generated.household,
      confirmationId: "CONFIRM-DEMO-DEDICATED",
      commandKind: DEMO_SUITE_COMMAND_KIND,
      postedIds: [],
      actingMemberId: "MEM-001",
      transportRequested: true,
      requireSynchronized: true,
      adapters,
    });
    expect(created.ok).toBe(true);
    expect(created.kind).toBe("synchronized");
    if (!created.ok) throw new Error(created.userMessage ?? "Dedicated Demo Suite creation failed");

    const replay = preserveDemoShowcaseContinuity(created.household, generated.household);
    const replayed = await acceptHouseholdWrite({
      previous: created.household,
      candidate: replay,
      confirmationId: "CONFIRM-DEMO-REPLAY",
      commandKind: DEMO_SUITE_COMMAND_KIND,
      postedIds: [],
      actingMemberId: "MEM-001",
      transportRequested: true,
      requireSynchronized: true,
      adapters,
    });
    expect(replayed.ok).toBe(true);
    expect(replayed.kind).toBe("synchronized");
    if (!replayed.ok) throw new Error(replayed.userMessage ?? "Demo Suite replay failed");

    const fresh = await generateDemoSuite({ today: TODAY, seed: 616162, buildSha: "demo-boundary" });
    await yieldToRunner();
    const replacement = preserveDemoShowcaseContinuity(replayed.household, fresh.household);
    const replaced = await acceptHouseholdWrite({
      previous: replayed.household,
      candidate: replacement,
      confirmationId: "CONFIRM-DEMO-FRESH",
      commandKind: DEMO_SUITE_COMMAND_KIND,
      postedIds: [],
      actingMemberId: "MEM-001",
      transportRequested: true,
      requireSynchronized: true,
      adapters,
    });
    expect(replaced.ok).toBe(true);
    expect(replaced.kind).toBe("synchronized");
    if (!replaced.ok) throw new Error(replaced.userMessage ?? "Fresh Demo Suite replacement failed");
    expect(replaced.household.householdId).toBe(created.household.householdId);
    expect(replaced.household.syntheticFixture?.seed).toBe(616162);
    expect(replaced.household.google).toEqual(created.household.google);
    expect(replaced.household.devices).toEqual(created.household.devices);

    const legacySuite = structuredClone(created.household);
    legacySuite.householdOnboarding = undefined;
    legacySuite.onboardingApprovals = [];
    legacySuite.members = legacySuite.members.map((member) => ({ ...member, onboardingProgress: undefined }));
    const migratedCandidate = preserveDemoShowcaseContinuity(legacySuite, fresh.household);
    const migrated = await acceptHouseholdWrite({
      previous: legacySuite,
      candidate: migratedCandidate,
      confirmationId: "CONFIRM-DEMO-LEGACY-REPLACE",
      commandKind: DEMO_SUITE_COMMAND_KIND,
      postedIds: [],
      actingMemberId: "MEM-001",
      adapters,
    });
    expect(migrated.ok).toBe(true);

    const sameIdOrdinary = { ...ordinaryOpenHousehold, householdId: generated.household.householdId };
    let refusedAdapterCalls = 0;
    const refused = await acceptHouseholdWrite({
      previous: sameIdOrdinary,
      candidate: generated.household,
      confirmationId: "REJECT-DEMO-OVERWRITE",
      commandKind: DEMO_SUITE_COMMAND_KIND,
      postedIds: [],
      actingMemberId: "MEM-001",
      adapters: {
        ingest: async () => { refusedAdapterCalls += 1; return { ok: true }; },
        persist: async () => { refusedAdapterCalls += 1; },
      },
    });
    expect(refused.ok).toBe(false);
    expect(refused.postedNothing).toBe(true);
    expect(refusedAdapterCalls).toBe(0);

    for (const input of [
      { previous: null, candidate: generated.household, commandKind: "commit", postedIds: [] },
      { previous: null, candidate: generated.household, commandKind: DEMO_SUITE_COMMAND_KIND, postedIds: ["forged-posted-id"] },
      { previous: ordinaryOpenHousehold, candidate: generated.household, commandKind: DEMO_SUITE_COMMAND_KIND, postedIds: [] },
      { previous: null, candidate: { ...generated.household, syntheticFixture: null }, commandKind: DEMO_SUITE_COMMAND_KIND, postedIds: [] },
    ]) {
      const outcome = await acceptHouseholdWrite({
        ...input,
        confirmationId: `REJECT-DEMO-SUITE-${input.commandKind}-${input.postedIds.length}`,
        adapters: {
          ingest: async () => { refusedAdapterCalls += 1; return { ok: true }; },
          persist: async () => { refusedAdapterCalls += 1; },
        },
      });
      expect(outcome.ok).toBe(false);
      expect(outcome.postedNothing).toBe(true);
    }
    expect(refusedAdapterCalls).toBe(0);
  }, 300_000);

  it("marks any changed generated fact not-ready even when provenance is retained", async () => {
    const generated = await generateDemoSuite({ today: TODAY, seed: 551122, buildSha: "trust-proof" });
    await yieldToRunner();
    const postedRow = structuredClone(generated.household);
    postedRow.transactions[0]!.note = `${postedRow.transactions[0]!.note} altered`;

    const scheduleAndEnvelope = structuredClone(generated.household);
    scheduleAndEnvelope.sevenShiftsSchedules![0]!.startedAt = `${TODAY}T01:23:00-04:00`;
    scheduleAndEnvelope.shiftEnvelopes![0]!.canonicalShiftKey += "-altered";

    const privacyFact = structuredClone(generated.household);
    privacyFact.accounts.find((row) => row.name === "Bianca Private Canary Vault")!.last4 = "0000";

    for (const changed of [postedRow, scheduleAndEnvelope, privacyFact]) {
      const report = await verifyDemoSuite(changed, generated.manifest);
      expect(report.status).toBe("not-ready");
      expect(report.checks.find((row) => row.id === "replay")).toMatchObject({ status: "fail" });
      expect(report.observedFixtureHashSha256).not.toBe(report.fixtureHashSha256);
      await yieldToRunner();
    }
  }, 300_000);

  it("keeps synthetic schedules proposal-only and partner-personal facts out of Shared", async () => {
    const { household, manifest } = await generateDemoSuite({ today: TODAY, seed: 10101 });
    await yieldToRunner();
    expect(manifest.transactionCountAfterEvidence).toBe(manifest.transactionCountBeforeEvidence);
    expect(household.sevenShiftsSchedules?.length).toBeGreaterThan(0);
    expect(household.shiftEnvelopes?.some((row) => row.status === "upcoming")).toBe(true);
    expect(household.shifts.filter((row) => row.memberId === "MEM-002").length).toBeGreaterThan(90);
    for (const shift of household.shifts.filter((row) => row.shiftBible?.outcome === "worked")) {
      const matching = household.shiftEnvelopes?.filter((row) => row.id === shift.shiftBible!.envelopeId) ?? [];
      expect(matching).toHaveLength(1);
      expect(matching[0]).toMatchObject({ status: "confirmed", confirmedBibleId: shift.shiftBible!.id });
    }
    expect(householdForShiftReadTools(household, "MEM-002", "personal", "Jonathan").shifts.length).toBeGreaterThan(90);
    expect(executeHerculesReadToolPlan(household, { calls: [{ id: "shift-proof", name: "tip_oracle", args: { member: "Jonathan" } }] }, TODAY, { memberId: "MEM-002", view: "personal" }).results[0]?.status).toBe("ok");
    const biancaPrivate = household.transactions.filter((row) => row.createdBy === "MEM-001" && row.visibility === "personal");
    expect(biancaPrivate.length).toBeGreaterThan(0);
    const { shared } = splitForSync(household, "MEM-002");
    const personal = personalReplicaForMember(household, "MEM-002");
    expect(shared.syntheticFixture).toEqual(household.syntheticFixture);
    expect(shared.transactions.some((row) => biancaPrivate.some((privateRow) => privateRow.id === row.id))).toBe(false);
    expect(shared.accounts.some((row) => row.name === "Bianca Private Canary Vault")).toBe(false);
    expect(shared.goals.some((row) => row.name === "BIANCA_PRIVATE_CANARY_GOAL")).toBe(false);
    expect("sevenShiftsSchedules" in shared).toBe(false);
    expect("shiftEnvelopes" in shared).toBe(false);
    expect("fundPrivate" in shared).toBe(false);
    const forbidden = ["BIANCA_PRIVATE_CANARY_TRANSACTION", "Bianca Private Canary Vault", "BIANCA_PRIVATE_CANARY_GOAL"];
    expect(forbidden.some((token) => JSON.stringify(shared).includes(token))).toBe(false);
    expect(forbidden.some((token) => JSON.stringify(personal).includes(token))).toBe(false);
  }, 300_000);

  it("refuses Production and ordinary Development replacement", async () => {
    const { household } = await generateDemoSuite({ today: TODAY, seed: 2026 });
    await yieldToRunner();
    expect(() => assertDemoReplacementAllowed({ ...household, environment: "production" })).toThrow(/Development-only/);
    expect(() => assertDemoReplacementAllowed({ ...household, syntheticFixture: null })).toThrow(/ordinary Development books/);
    expect(() => assertDemoReplacementAllowed(household)).not.toThrow();
  }, 300_000);

  it("rejects synthetic provenance outside Development and preserves it through shared merges", async () => {
    const { household } = await generateDemoSuite({ today: TODAY, seed: 8181 });
    await yieldToRunner();
    const { shared } = splitForSync(household, "MEM-002");
    const production = { ...household, environment: "production" as const };
    expect(() => ensureHouseholdShape(production)).toThrow(/only in Development/);
    expect(() => assembleHousehold({ ...shared, environment: "production" }, null)).toThrow(/only in Development/);
    const previous = { ...household, environment: "production" as const, syntheticFixture: null };
    const outcome = await acceptHouseholdWrite({
      previous,
      candidate: production,
      adapters: {
        ingest: async () => ({ ok: true }),
        persist: async () => undefined,
      },
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.postedNothing).toBe(true);
    expect(outcome.userMessage).toMatch(/only in Development/);
    expect(mergeShared(shared, { ...shared, syntheticFixture: null }).syntheticFixture).toEqual(household.syntheticFixture);
  }, 300_000);

  it("uses profile as part of generation while keeping each profile replayable", async () => {
    const investor = await generateDemoSuite({ today: TODAY, seed: 9988, profile: "investor" });
    await yieldToRunner();
    const edge = await generateDemoSuite({ today: TODAY, seed: 9988, profile: "edge" });
    await yieldToRunner();
    expect(edge.household).not.toEqual(investor.household);
    const replay = await generateDemoSuite({ today: TODAY, seed: 9988, profile: "edge" });
    expect(replay.household).toEqual(edge.household);
  }, 300_000);

  it("uses Toronto standard and daylight offsets and derives coherent shift duration", async () => {
    expect(torontoOffsetForDate("2026-01-15")).toBe("-05:00");
    expect(torontoOffsetForDate("2026-07-15")).toBe("-04:00");
    const { household } = await generateDemoSuite({ today: TODAY, seed: 707 });
    await yieldToRunner();
    for (const shift of household.shifts) {
      expect(shift.startedAt).toContain(torontoOffsetForDate(shift.date));
      const elapsedHours = (Date.parse(shift.endedAt!) - Date.parse(shift.startedAt!)) / 3_600_000;
      expect(elapsedHours).toBeGreaterThanOrEqual(shift.hours);
      expect(elapsedHours - shift.hours).toBeLessThanOrEqual(0.5);
    }
  }, 300_000);
});

import { beforeEach, describe, expect, it } from "vitest";
import {
  assertDemoReplacementAllowed,
  acceptHouseholdWrite,
  assembleHousehold,
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
  splitForSync,
  torontoOffsetForDate,
  verifyDemoSuite,
} from "../src/core/index.ts";

const TODAY = "2026-08-29" as const;

describe("trustworthy synthetic Demo Suite", () => {
  beforeEach(async () => {
    await new Promise<void>((resolve) => setImmediate(resolve));
  });

  it("replays the exact same dated household and manifest from one seed", async () => {
    const first = await generateDemoSuite({ today: TODAY, seed: 8675309, buildSha: "test-sha" });
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
  }, 180_000);

  it("covers every domain engine and every Hercules Pro calculation surface", async () => {
    const generated = await generateDemoSuite({ today: TODAY, seed: 424242 });
    const accepted = await acceptHouseholdWrite({
      previous: null,
      candidate: generated.household,
      confirmationId: "CONFIRM-DEMO-CREATE",
      commandKind: "create-demo-suite",
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
  }, 180_000);

  it("marks any changed generated fact not-ready even when provenance is retained", async () => {
    const generated = await generateDemoSuite({ today: TODAY, seed: 551122, buildSha: "trust-proof" });
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
    }
  }, 180_000);

  it("keeps synthetic schedules proposal-only and partner-personal facts out of Shared", async () => {
    const { household, manifest } = await generateDemoSuite({ today: TODAY, seed: 10101 });
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
  }, 60_000);

  it("refuses Production and ordinary Development replacement", async () => {
    const { household } = await generateDemoSuite({ today: TODAY, seed: 2026 });
    expect(() => assertDemoReplacementAllowed({ ...household, environment: "production" })).toThrow(/Development-only/);
    expect(() => assertDemoReplacementAllowed({ ...household, syntheticFixture: null })).toThrow(/ordinary Development books/);
    expect(() => assertDemoReplacementAllowed(household)).not.toThrow();
  }, 60_000);

  it("rejects synthetic provenance outside Development and preserves it through shared merges", async () => {
    const { household } = await generateDemoSuite({ today: TODAY, seed: 8181 });
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
  }, 60_000);

  it("uses profile as part of generation while keeping each profile replayable", async () => {
    const investor = await generateDemoSuite({ today: TODAY, seed: 9988, profile: "investor" });
    const edge = await generateDemoSuite({ today: TODAY, seed: 9988, profile: "edge" });
    expect(edge.household).not.toEqual(investor.household);
    expect((await generateDemoSuite({ today: TODAY, seed: 9988, profile: "edge" })).household).toEqual(edge.household);
  }, 180_000);

  it("uses Toronto standard and daylight offsets and derives coherent shift duration", async () => {
    expect(torontoOffsetForDate("2026-01-15")).toBe("-05:00");
    expect(torontoOffsetForDate("2026-07-15")).toBe("-04:00");
    const { household } = await generateDemoSuite({ today: TODAY, seed: 707 });
    for (const shift of household.shifts) {
      expect(shift.startedAt).toContain(torontoOffsetForDate(shift.date));
      const elapsedHours = (Date.parse(shift.endedAt!) - Date.parse(shift.startedAt!)) / 3_600_000;
      expect(elapsedHours).toBeGreaterThanOrEqual(shift.hours);
      expect(elapsedHours - shift.hours).toBeLessThanOrEqual(0.5);
    }
  }, 180_000);
});

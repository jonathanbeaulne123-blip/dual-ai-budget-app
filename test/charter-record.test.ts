import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  charterActivePermissions,
  charterCeilingLabel,
  charterIsSigned,
  charterUnsignedMemberIds,
  assembleHousehold,
  catalogHousehold,
  configureHouseholdFund,
  ensureHouseholdShape,
  mergeShared,
  shapeHouseholdCharter,
  splitForSync,
} from "../src/core/index.ts";
import type { HouseholdCharter } from "../src/core/types.ts";

const CREATED_AT = "2026-09-01T12:00:00.000Z";
const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";

function record(overrides: Partial<HouseholdCharter> = {}): HouseholdCharter {
  return {
    id: "CHARTER-001",
    purpose: "Keep the household steady.",
    custodianMemberId: BIANCA,
    splitRule: "remainder",
    splitNote: "One income covers what it covers and the other closes the rest.",
    ceilingKind: "hours-per-week",
    ceilingValue: 240,
    cadence: "weekly",
    cadenceWeekday: 0,
    clauses: [],
    permissions: [],
    signatures: [
      { memberId: BIANCA, signedAt: null },
      { memberId: JONATHAN, signedAt: null },
    ],
    amendments: [],
    foundedOn: "2026-09-01",
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  };
}

describe("household charter record", () => {
  it("rejects garbage, clamps prose, and drops malformed clauses", () => {
    expect(shapeHouseholdCharter("not a charter")).toBeNull();
    const shaped = shapeHouseholdCharter(record({
      purpose: "x".repeat(260),
      clauses: [
        { id: "CLAUSE-B", heading: "", body: "No heading" },
        { id: "CLAUSE-A", heading: "  Groceries  ", body: "y".repeat(420) },
      ],
    }));

    expect(shaped?.purpose).toHaveLength(240);
    expect(shaped?.clauses).toEqual([{ id: "CLAUSE-A", heading: "Groceries", body: "y".repeat(400) }]);
  });

  it("keeps an unsigned charter as a valid record", () => {
    const shaped = shapeHouseholdCharter(record({ signatures: [] }));
    expect(shaped).not.toBeNull();
    expect(charterIsSigned(shaped!)).toBe(false);
  });

  it("reports both unsigned members and then the one remaining line", () => {
    const fresh = shapeHouseholdCharter(record())!;
    expect(charterUnsignedMemberIds(fresh)).toEqual([BIANCA, JONATHAN]);

    const oneSigned = shapeHouseholdCharter(record({
      signatures: [
        { memberId: JONATHAN, signedAt: null },
        { memberId: BIANCA, signedAt: "2026-09-01T12:30:00-04:00" },
      ],
    }))!;
    expect(charterUnsignedMemberIds(oneSigned)).toEqual([JONATHAN]);
    expect(charterIsSigned(oneSigned)).toBe(false);
  });

  it("normalizes one signature line per real member and fails duplicate rows closed", () => {
    const context = {
      members: [{ id: BIANCA }, { id: JONATHAN }],
      householdFund: { custodianMemberId: BIANCA },
    };
    const malformed = shapeHouseholdCharter(record({
      signatures: [
        { memberId: BIANCA, signedAt: "2026-09-01T12:30:00-04:00" },
        { memberId: BIANCA, signedAt: "2026-09-01T12:31:00-04:00" },
        { memberId: "MEM-NOT-HERE", signedAt: "2026-09-01T12:32:00-04:00" },
      ],
    }), context)!;

    expect(malformed.signatures).toEqual([
      { memberId: BIANCA, signedAt: null },
      { memberId: JONATHAN, signedAt: null },
    ]);
    expect(charterIsSigned(malformed)).toBe(false);

    const complete = shapeHouseholdCharter(record({
      signatures: [
        { memberId: BIANCA, signedAt: "2026-09-01T12:30:00-04:00" },
        { memberId: JONATHAN, signedAt: "2026-09-01T12:31:00-04:00" },
      ],
    }), context)!;
    expect(charterIsSigned(complete)).toBe(true);
  });

  it("labels all three ceiling kinds", () => {
    expect(charterCeilingLabel(record({ ceilingKind: "hours-per-week", ceilingValue: 240 }))).toBe("24 hours a week");
    expect(charterCeilingLabel(record({ ceilingKind: "amount-per-month", ceilingValue: 40000 }))).toBe("$400 a month");
    expect(charterCeilingLabel(record({ ceilingKind: "none", ceilingValue: 999 }))).toBe("no ceiling agreed");
  });

  it("keeps only live permissions and forces a no-ceiling value to zero", () => {
    const shaped = shapeHouseholdCharter(record({
      ceilingKind: "none",
      ceilingValue: 900,
      permissions: [
        { id: "PERM-B", label: "Bianca may post an agreed bill.", grantedByMemberId: JONATHAN, actorMemberId: BIANCA, revokedAt: null },
        { id: "PERM-A", label: "Jonathan may annotate the record.", grantedByMemberId: BIANCA, actorMemberId: JONATHAN, revokedAt: "2026-09-02T16:00:00-04:00" },
        { id: "PERM-C", label: "Malformed revocation stays inactive.", grantedByMemberId: BIANCA, actorMemberId: JONATHAN, revokedAt: "not-a-time" },
      ],
    }))!;

    expect(shaped.ceilingValue).toBe(0);
    expect(charterActivePermissions(shaped).map((permission) => permission.id)).toEqual(["PERM-B"]);
  });

  it("checks member and Fund custody when household context is available", () => {
    const context = {
      members: [{ id: BIANCA }, { id: JONATHAN }],
      householdFund: { custodianMemberId: BIANCA },
    };
    expect(shapeHouseholdCharter(record(), context)).not.toBeNull();
    expect(shapeHouseholdCharter(record({ custodianMemberId: "MEM-NOT-HERE" }), context)).toBeNull();
    expect(shapeHouseholdCharter(record({ custodianMemberId: JONATHAN }), context)).toBeNull();
  });

  it("survives the current household and cloud-envelope shaping boundaries", () => {
    const configured = configureHouseholdFund(catalogHousehold(), {
      custodianMemberId: BIANCA,
      openedOn: "2026-09-01",
      createdBy: BIANCA,
    }).household;
    const shaped = ensureHouseholdShape({ ...configured, charter: record() });
    const envelopes = splitForSync(shaped, BIANCA);
    const roundTrip = assembleHousehold(envelopes.shared, envelopes.personal);
    const merged = mergeShared(
      { ...envelopes.shared, charter: record({ purpose: "Earlier words." }) },
      { ...envelopes.shared, charter: record({ purpose: "Current words.", updatedAt: "2026-09-02T12:00:00.000Z" }) },
    );

    expect(roundTrip.charter).toEqual(shaped.charter);
    expect(merged.charter?.purpose).toBe("Current words.");
    expect(ensureHouseholdShape({
      ...configured,
      charter: record({ custodianMemberId: JONATHAN }),
    }).charter).toBeNull();
  });

  it("keeps the no-comparison fence in the record module", () => {
    const source = readFileSync(new URL("../src/core/charter.ts", import.meta.url), "utf8").toLowerCase();
    expect(source).not.toContain("percent");
    expect(source).not.toContain("ratio");
    expect(source).not.toContain("share");
  });
});

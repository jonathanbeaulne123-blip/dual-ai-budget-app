import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  charterActivePermissions,
  charterCeilingLabel,
  charterIsSigned,
  charterUnsignedMemberIds,
  assembleHousehold,
  catalogHousehold,
  confirmCharterAmendment,
  configureHouseholdFund,
  ensureHouseholdShape,
  foundHouseholdCharter,
  grantCharterPermission,
  mergeShared,
  proposeCharterAmendment,
  signHouseholdCharter,
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
    termsUpdatedAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  };
}

function found(): ReturnType<typeof foundHouseholdCharter>["household"] {
  return foundHouseholdCharter(catalogHousehold(), {
    memberId: JONATHAN,
    custodianMemberId: BIANCA,
    purpose: "Keep the household steady.",
    splitRule: "remainder",
    splitNote: "One income covers what it covers and the other closes the rest.",
    ceilingKind: "hours-per-week",
    ceilingValue: "24",
    cadence: "weekly",
    cadenceWeekday: 0,
    date: "2026-09-01",
  }).household;
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
      { ...envelopes.shared, charter: record({
        purpose: "Current words.",
        termsUpdatedAt: "2026-09-02T12:00:00.000Z",
        updatedAt: "2026-09-02T12:00:00.000Z",
      }) },
    );

    expect(roundTrip.charter).toEqual(shaped.charter);
    expect(merged.charter?.purpose).toBe("Current words.");
    expect(ensureHouseholdShape({
      ...configured,
      charter: record({ custodianMemberId: JONATHAN }),
    }).charter).toBeNull();
  });

  it("merges concurrent signatures, permissions, and amendment proposals without silent loss", () => {
    const base = found();
    const biancaSigned = signHouseholdCharter(base, {
      memberId: BIANCA,
      at: "2026-09-01T12:30:00-04:00",
    }).household;
    const jonathanSigned = signHouseholdCharter(base, {
      memberId: JONATHAN,
      at: "2026-09-01T12:31:00-04:00",
    }).household;
    const bothSigned = mergeShared(splitForSync(biancaSigned, BIANCA).shared, splitForSync(jonathanSigned, JONATHAN).shared);
    expect(bothSigned.charter?.signatures.every((row) => row.signedAt)).toBe(true);

    const biancaGrant = grantCharterPermission(base, {
      memberId: BIANCA,
      actorMemberId: JONATHAN,
      label: "Jonathan may confirm the agreed grocery list.",
    }).household;
    const jonathanGrant = grantCharterPermission(base, {
      memberId: JONATHAN,
      actorMemberId: BIANCA,
      label: "Bianca may confirm the agreed utility list.",
    }).household;
    expect(biancaGrant.charter?.permissions[0]?.id).not.toBe(jonathanGrant.charter?.permissions[0]?.id);
    const bothGrants = mergeShared(splitForSync(biancaGrant, BIANCA).shared, splitForSync(jonathanGrant, JONATHAN).shared);
    expect(bothGrants.charter?.permissions).toHaveLength(2);

    const purpose = proposeCharterAmendment(base, {
      memberId: JONATHAN,
      field: "purpose",
      toText: "Keep the household steady and protect both people's time.",
    }).household;
    const splitNote = proposeCharterAmendment(base, {
      memberId: BIANCA,
      field: "splitNote",
      toText: "One income covers standing bills and the other closes the remainder.",
    }).household;
    expect(purpose.charter?.amendments[0]?.id).not.toBe(splitNote.charter?.amendments[0]?.id);
    const bothProposals = mergeShared(splitForSync(purpose, BIANCA).shared, splitForSync(splitNote, JONATHAN).shared);
    expect(bothProposals.charter?.amendments).toHaveLength(2);
  });

  it("preserves disjoint confirmed terms and a concurrent signature in either merge order", () => {
    const base = found();
    const purposeProposal = proposeCharterAmendment(base, {
      memberId: JONATHAN,
      field: "purpose",
      toText: "Keep a shared home and protect both people's time.",
    });
    const purpose = confirmCharterAmendment(purposeProposal.household, {
      memberId: BIANCA,
      amendmentId: purposeProposal.postedIds[0]!,
    }).household;
    const splitProposal = proposeCharterAmendment(base, {
      memberId: BIANCA,
      field: "splitNote",
      toText: "Standing bills come first; the other income closes what remains.",
    });
    const splitNote = confirmCharterAmendment(splitProposal.household, {
      memberId: JONATHAN,
      amendmentId: splitProposal.postedIds[0]!,
    }).household;
    const signed = signHouseholdCharter(splitNote, {
      memberId: BIANCA,
      at: "2026-09-01T13:00:00-04:00",
    }).household;
    const left = splitForSync(purpose, BIANCA).shared;
    const right = splitForSync(signed, JONATHAN).shared;
    const forward = mergeShared(left, right);
    const reverse = mergeShared(right, left);

    for (const merged of [forward, reverse]) {
      expect(merged.charter).toMatchObject({
        purpose: "Keep a shared home and protect both people's time.",
        splitNote: "Standing bills come first; the other income closes what remains.",
      });
      expect(merged.charter?.signatures.find((row) => row.memberId === BIANCA)?.signedAt).not.toBeNull();
      expect(merged.charter?.amendments.filter((row) => row.confirmedByMemberId)).toHaveLength(2);
    }
    expect(reverse.charter).toEqual(forward.charter);
    expect(mergeShared(forward, forward).charter).toEqual(forward.charter);
  });

  it("refuses self-confirmed and outsider-confirmed synced amendments", () => {
    const clean = splitForSync(found(), BIANCA).shared;
    const corrupt = structuredClone(clean);
    corrupt.charter!.amendments = [
      {
        id: "CHARTER-AMEND-SELF",
        raisedByMemberId: BIANCA,
        field: "purpose",
        fromText: "Keep the household steady.",
        toText: "One person changed this alone.",
        confirmedByMemberId: BIANCA,
        heldByMemberId: null,
        heldNote: "",
        raisedAt: "2026-09-01T17:00:00.000Z",
        resolvedAt: "2026-09-01T17:01:00.000Z",
        ceilingChange: null,
      },
      {
        id: "CHARTER-AMEND-OUTSIDER",
        raisedByMemberId: BIANCA,
        field: "splitNote",
        fromText: "One income covers what it covers and the other closes the rest.",
        toText: "An outsider changed this.",
        confirmedByMemberId: "MEM-NOT-HERE",
        heldByMemberId: "MEM-NOT-HERE",
        heldNote: "Outsider hold",
        raisedAt: "2026-09-01T17:02:00.000Z",
        resolvedAt: "2026-09-01T17:03:00.000Z",
        ceilingChange: null,
      },
      {
        id: "CHARTER-AMEND-BAD-CUSTODIAN",
        raisedByMemberId: BIANCA,
        field: "custodianMemberId",
        fromText: BIANCA,
        toText: "MEM-NOT-HERE",
        confirmedByMemberId: JONATHAN,
        heldByMemberId: null,
        heldNote: "",
        raisedAt: "2026-09-01T17:04:00.000Z",
        resolvedAt: "2026-09-01T17:05:00.000Z",
        ceilingChange: null,
      },
      {
        id: "CHARTER-AMEND-UNPAIRED-CEILING",
        raisedByMemberId: BIANCA,
        field: "ceilingKind",
        fromText: "hours-per-week",
        toText: "amount-per-month",
        confirmedByMemberId: JONATHAN,
        heldByMemberId: null,
        heldNote: "",
        raisedAt: "2026-09-01T17:06:00.000Z",
        resolvedAt: "2026-09-01T17:07:00.000Z",
        ceilingChange: null,
      },
    ];

    const merged = mergeShared(clean, corrupt);
    expect(merged.charter).toMatchObject({
      purpose: "Keep the household steady.",
      splitNote: "One income covers what it covers and the other closes the rest.",
      custodianMemberId: BIANCA,
      ceilingKind: "hours-per-week",
      ceilingValue: 240,
    });
    expect(merged.charter?.amendments).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "CHARTER-AMEND-SELF", confirmedByMemberId: null, resolvedAt: null }),
      expect.objectContaining({
        id: "CHARTER-AMEND-OUTSIDER",
        confirmedByMemberId: null,
        heldByMemberId: null,
        heldNote: "",
        resolvedAt: null,
      }),
    ]));
  });

  it("retains distinct same-id permission and amendment collision evidence deterministically", () => {
    const left = splitForSync(found(), BIANCA).shared;
    const right = structuredClone(left);
    left.charter!.permissions = [{
      id: "CHARTER-PERM-COLLISION",
      label: "Jonathan may confirm groceries.",
      grantedByMemberId: BIANCA,
      actorMemberId: JONATHAN,
      revokedAt: null,
    }];
    right.charter!.permissions = [{
      id: "CHARTER-PERM-COLLISION",
      label: "Bianca may confirm utilities.",
      grantedByMemberId: JONATHAN,
      actorMemberId: BIANCA,
      revokedAt: null,
    }];
    left.charter!.amendments = [{
      id: "CHARTER-AMEND-COLLISION",
      raisedByMemberId: BIANCA,
      field: "purpose",
      fromText: "Keep the household steady.",
      toText: "Protect both people's time.",
      confirmedByMemberId: null,
      heldByMemberId: null,
      heldNote: "",
      raisedAt: "2026-09-01T17:10:00.000Z",
      resolvedAt: null,
      ceilingChange: null,
    }];
    right.charter!.amendments = [{
      id: "CHARTER-AMEND-COLLISION",
      raisedByMemberId: JONATHAN,
      field: "splitNote",
      fromText: "One income covers what it covers and the other closes the rest.",
      toText: "Standing bills come first.",
      confirmedByMemberId: null,
      heldByMemberId: null,
      heldNote: "",
      raisedAt: "2026-09-01T17:11:00.000Z",
      resolvedAt: null,
      ceilingChange: null,
    }];

    const forward = mergeShared(left, right);
    const reverse = mergeShared(right, left);
    expect(forward.charter?.permissions).toHaveLength(2);
    expect(forward.charter?.amendments).toHaveLength(2);
    expect(forward.charter?.permissions.some((row) => row.id.includes("~conflict-"))).toBe(true);
    expect(forward.charter?.amendments.some((row) => row.id.includes("~conflict-"))).toBe(true);
    expect(reverse.charter).toEqual(forward.charter);
    expect(mergeShared(forward, left).charter).toEqual(forward.charter);

    const forged = structuredClone(forward);
    const permissionAlias = forward.charter!.permissions.find((row) => row.id.includes("~conflict-"))!.id;
    const amendmentAlias = forward.charter!.amendments.find((row) => row.id.includes("~conflict-"))!.id;
    forged.charter!.permissions = [{
      id: permissionAlias,
      label: "A crafted alias must not erase retained evidence.",
      grantedByMemberId: BIANCA,
      actorMemberId: JONATHAN,
      revokedAt: null,
    }];
    forged.charter!.amendments = [{
      id: amendmentAlias,
      raisedByMemberId: BIANCA,
      field: "cadence",
      fromText: "weekly",
      toText: "monthly",
      confirmedByMemberId: null,
      heldByMemberId: null,
      heldNote: "",
      raisedAt: "2026-09-01T17:12:00.000Z",
      resolvedAt: null,
      ceilingChange: null,
    }];
    const retained = mergeShared(forward, forged);
    expect(retained.charter?.permissions).toHaveLength(3);
    expect(retained.charter?.amendments).toHaveLength(3);
    expect(mergeShared(forged, forward).charter).toEqual(retained.charter);
  });

  it("keeps the no-comparison fence in the record module", () => {
    const source = readFileSync(new URL("../src/core/charter.ts", import.meta.url), "utf8").toLowerCase();
    expect(source).not.toContain("percent");
    expect(source).not.toContain("ratio");
    expect(source).not.toContain("share");
  });
});

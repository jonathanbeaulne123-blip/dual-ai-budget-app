import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  catalogHousehold,
  commandIdentityHash,
  configureHouseholdFund,
  confirmCharterAmendment,
  foundHouseholdCharter,
  grantCharterPermission,
  holdCharterAmendment,
  proposeCharterAmendment,
  revokeCharterPermission,
  signHouseholdCharter,
} from "../src/core/index.ts";
import type { Household } from "../src/core/types.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const DATE = "2026-09-01";

function found(household = catalogHousehold()): Household {
  return foundHouseholdCharter(household, {
    memberId: JONATHAN,
    custodianMemberId: BIANCA,
    purpose: "Keep the household steady without overwork.",
    splitRule: "remainder",
    splitNote: "Bianca's pay covers what it covers. Jonathan closes the rest.",
    ceilingKind: "hours-per-week",
    ceilingValue: "24",
    cadence: "weekly",
    cadenceWeekday: 0,
    clauses: [{ heading: "Bills", body: "The Fund covers agreed household bills." }],
    date: DATE,
  }).household;
}

describe("household Charter commands", () => {
  it("founds one unsigned Charter and refuses founding twice", () => {
    const result = foundHouseholdCharter(catalogHousehold(), {
      memberId: JONATHAN,
      custodianMemberId: BIANCA,
      purpose: "  Keep the household steady without overwork.  ",
      splitRule: "remainder",
      splitNote: "One income covers what it covers.",
      ceilingKind: "hours-per-week",
      ceilingValue: "24",
      cadence: "weekly",
      cadenceWeekday: 0,
      clauses: [{ heading: "  Bills  ", body: "  Use the Fund.  " }],
      date: DATE,
    });

    expect(result.household.charter).toMatchObject({
      purpose: "Keep the household steady without overwork.",
      custodianMemberId: BIANCA,
      splitRule: "remainder",
      ceilingKind: "hours-per-week",
      ceilingValue: 240,
      cadence: "weekly",
      cadenceWeekday: 0,
      foundedOn: DATE,
      clauses: [{ heading: "Bills", body: "Use the Fund." }],
    });
    expect(result.household.charter?.signatures).toEqual([
      { memberId: BIANCA, signedAt: null },
      { memberId: JONATHAN, signedAt: null },
    ]);
    expect(() => found(result.household)).toThrow("That charter already exists. Raise an amendment instead.");
  });

  it("signs only the caller's own line and leaves the other line blank", () => {
    const household = found();
    const signed = signHouseholdCharter(household, {
      memberId: BIANCA,
      at: "2026-09-01T12:30:00-04:00",
    }).household;

    expect(signed.charter?.signatures).toEqual([
      { memberId: BIANCA, signedAt: "2026-09-01T16:30:00.000Z" },
      { memberId: JONATHAN, signedAt: null },
    ]);

    const missingOwnLine = structuredClone(household);
    missingOwnLine.charter!.signatures = missingOwnLine.charter!.signatures.filter((row) => row.memberId !== BIANCA);
    expect(() => signHouseholdCharter(missingOwnLine, { memberId: BIANCA }))
      .toThrow("You can only sign your own line.");
  });

  it("lets a member give away only their own Confirm and only the granter revoke it", () => {
    const household = found();
    expect(() => grantCharterPermission(household, {
      memberId: BIANCA,
      actorMemberId: BIANCA,
      label: "Bianca can confirm agreed bills.",
    })).toThrow("You can only give away your own confirm.");

    const granted = grantCharterPermission(household, {
      memberId: JONATHAN,
      actorMemberId: BIANCA,
      label: "Bianca can confirm agreed household bills.",
    });
    const permission = granted.household.charter!.permissions[0]!;
    expect(permission).toMatchObject({
      label: "Bianca can confirm agreed household bills.",
      grantedByMemberId: JONATHAN,
      actorMemberId: BIANCA,
      revokedAt: null,
    });
    expect(() => revokeCharterPermission(granted.household, {
      memberId: BIANCA,
      permissionId: permission.id,
    })).toThrow(/only the person who granted/i);

    const revoked = revokeCharterPermission(granted.household, {
      memberId: JONATHAN,
      permissionId: permission.id,
    }).household;
    expect(revoked.charter?.permissions[0]?.revokedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("captures the old value, refuses a self-second, and applies the other member's confirmation", () => {
    const household = found();
    const proposed = proposeCharterAmendment(household, {
      memberId: JONATHAN,
      field: "purpose",
      toText: "Keep a shared home and protect both people's time.",
    });
    const amendment = proposed.household.charter!.amendments[0]!;
    expect(amendment).toMatchObject({
      raisedByMemberId: JONATHAN,
      field: "purpose",
      fromText: "Keep the household steady without overwork.",
      toText: "Keep a shared home and protect both people's time.",
      confirmedByMemberId: null,
      resolvedAt: null,
    });
    expect(() => confirmCharterAmendment(proposed.household, {
      memberId: JONATHAN,
      amendmentId: amendment.id,
    })).toThrow("An amendment needs the other person to agree.");

    const confirmed = confirmCharterAmendment(proposed.household, {
      memberId: BIANCA,
      amendmentId: amendment.id,
    }).household;
    expect(confirmed.charter?.purpose).toBe("Keep a shared home and protect both people's time.");
    expect(confirmed.charter?.amendments[0]).toMatchObject({
      confirmedByMemberId: BIANCA,
      resolvedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
  });

  it("keeps a held amendment open and confirmable later", () => {
    const proposed = proposeCharterAmendment(found(), {
      memberId: JONATHAN,
      field: "splitNote",
      toText: "One income covers the standing bills; the other closes what remains.",
    });
    const amendmentId = proposed.postedIds[0]!;
    const held = holdCharterAmendment(proposed.household, {
      memberId: BIANCA,
      amendmentId,
      note: "Show me the September rows first.",
    }).household;
    expect(held.charter?.amendments[0]).toMatchObject({
      heldByMemberId: BIANCA,
      heldNote: "Show me the September rows first.",
      confirmedByMemberId: null,
      resolvedAt: null,
    });

    const confirmed = confirmCharterAmendment(held, { memberId: BIANCA, amendmentId }).household;
    expect(confirmed.charter?.splitNote).toBe("One income covers the standing bills; the other closes what remains.");
    expect(confirmed.charter?.amendments[0]).toMatchObject({
      heldByMemberId: BIANCA,
      heldNote: "Show me the September rows first.",
      confirmedByMemberId: BIANCA,
      resolvedAt: expect.any(String),
    });
  });

  it("routes custody changes through an existing Household Fund", () => {
    const withFund = configureHouseholdFund(catalogHousehold(), {
      custodianMemberId: BIANCA,
      openedOn: DATE,
      createdBy: BIANCA,
    }).household;
    const household = found(withFund);
    expect(() => proposeCharterAmendment(household, {
      memberId: JONATHAN,
      field: "custodianMemberId",
      toText: JONATHAN,
    })).toThrow("Custody moves through the Fund, not the charter.");
  });

  it("applies typed cadence and ceiling amendments without creating money", () => {
    let household = found();
    const cadence = proposeCharterAmendment(household, {
      memberId: JONATHAN,
      field: "cadence",
      toText: "none",
    });
    household = confirmCharterAmendment(cadence.household, {
      memberId: BIANCA,
      amendmentId: cadence.postedIds[0]!,
    }).household;
    expect(household.charter).toMatchObject({ cadence: "none", cadenceWeekday: 0 });

    const ceiling = proposeCharterAmendment(household, {
      memberId: BIANCA,
      field: "ceilingKind",
      toText: "none",
    });
    household = confirmCharterAmendment(ceiling.household, {
      memberId: JONATHAN,
      amendmentId: ceiling.postedIds[0]!,
    }).household;
    expect(household.charter).toMatchObject({ ceilingKind: "none", ceilingValue: 0 });
    expect(household.transactions).toEqual([]);
    expect(household.shifts).toEqual([]);
  });

  it("refuses to reinterpret a ceiling value in different units", () => {
    const hours = found();
    expect(() => proposeCharterAmendment(hours, {
      memberId: JONATHAN,
      field: "ceilingKind",
      toText: "amount-per-month",
    })).toThrow("Change the ceiling value and unit together.");

    const removed = proposeCharterAmendment(hours, {
      memberId: JONATHAN,
      field: "ceilingKind",
      toText: "none",
    });
    const none = confirmCharterAmendment(removed.household, {
      memberId: BIANCA,
      amendmentId: removed.postedIds[0]!,
    }).household;
    expect(() => proposeCharterAmendment(none, {
      memberId: BIANCA,
      field: "ceilingKind",
      toText: "hours-per-week",
    })).toThrow("Change the ceiling value and unit together.");
  });

  it("binds command identity to the Charter material that a command changed", async () => {
    const previous = catalogHousehold();
    const first = found(previous);
    const changed = structuredClone(first);
    changed.charter!.purpose = "A different agreement on the same command id.";
    const postedIds = [first.charter!.id];

    expect(await commandIdentityHash(previous, first, postedIds))
      .not.toBe(await commandIdentityHash(previous, changed, postedIds));
  });

  it("keeps the exact refusal copy in the command boundary", () => {
    const source = readFileSync(new URL("../src/core/commands.ts", import.meta.url), "utf8");
    expect(source).toContain("You can only sign your own line.");
    expect(source).toContain("An amendment needs the other person to agree.");
    expect(source).toContain("That charter already exists. Raise an amendment instead.");
    expect(source).toContain("You can only give away your own confirm.");
    expect(source).toContain("Custody moves through the Fund, not the charter.");
  });
});

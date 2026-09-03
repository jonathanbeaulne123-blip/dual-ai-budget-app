// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_RAIL_CONTRIBUTOR,
  DEFAULT_RAIL_CUSTODIAN,
  FUND_WIDGETS,
  RAIL_SLOTS_DESK,
  RAIL_SLOTS_PHONE,
  assembleHousehold,
  catalogHousehold,
  configureHouseholdFund,
  drawerFor,
  financialAuditHash,
  fundRailPreferenceUpdateAllowed,
  mergePersonal,
  phoneRail,
  railFor,
  resetFundRail,
  setFundRailSlot,
  splitForSync,
  widgetAllowedFor,
  type Household,
  type PersonalEnvelope,
} from "../src/core/index.ts";
import { loadPersonalReplica, savePersonalReplicaOnly } from "../src/storage.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";

function configuredFund(): Household {
  return configureHouseholdFund(catalogHousehold(), {
    custodianMemberId: BIANCA,
    openedOn: "2026-09-01",
    createdBy: BIANCA,
  }).household;
}

describe("Fund slice 3 member rail", () => {
  it("publishes one sixteen-widget library and role-derived eight-place defaults", () => {
    const household = configuredFund();
    expect(FUND_WIDGETS).toHaveLength(16);
    expect(new Set(FUND_WIDGETS)).toHaveLength(16);
    expect(RAIL_SLOTS_DESK).toBe(8);
    expect(RAIL_SLOTS_PHONE).toBe(6);
    expect(railFor(household, BIANCA)).toEqual(DEFAULT_RAIL_CUSTODIAN);
    expect(railFor(household, JONATHAN)).toEqual(DEFAULT_RAIL_CONTRIBUTOR);
    expect(household.members.every((member) => member.fundRail === undefined)).toBe(true);
  });

  it("projects the phone from the first six places without a second arrangement", () => {
    const rail = [...DEFAULT_RAIL_CONTRIBUTOR];
    expect(phoneRail(rail)).toEqual(rail.slice(0, 6));
    expect(phoneRail(rail)).toHaveLength(6);
  });

  it("refuses cross-member and target-derived writes with exact copy and zero mutation", () => {
    const household = configuredFund();
    const before = structuredClone(household);
    expect(() => setFundRailSlot(household, {
      memberId: BIANCA,
      createdBy: JONATHAN,
      slot: 2,
      widgetId: "waiting",
    })).toThrow("Only you can arrange your own board.");
    expect(() => setFundRailSlot(household, {
      memberId: BIANCA,
      slot: 2,
      widgetId: "waiting",
    } as Parameters<typeof setFundRailSlot>[1])).toThrow("Only you can arrange your own board.");
    expect(household).toEqual(before);
  });

  it("pins Level in place one and keeps every resulting rail unique and exactly eight", () => {
    const household = configuredFund();
    expect(() => setFundRailSlot(household, {
      memberId: BIANCA,
      createdBy: BIANCA,
      slot: 2,
      widgetId: "level",
    })).toThrow("The Fund stays at the top of the board.");
    expect(() => setFundRailSlot(household, {
      memberId: BIANCA,
      createdBy: BIANCA,
      slot: 1,
      widgetId: "waiting",
    })).toThrow("The Fund stays at the top of the board.");
    expect(() => setFundRailSlot(household, {
      memberId: BIANCA,
      createdBy: BIANCA,
      slot: 9,
      widgetId: "waiting",
    })).toThrow("The Fund board has exactly eight places.");

    const arranged = setFundRailSlot(household, {
      memberId: BIANCA,
      createdBy: BIANCA,
      slot: 3,
      widgetId: "settle",
    }).household;
    const rail = railFor(arranged, BIANCA);
    expect(rail).toHaveLength(8);
    expect(new Set(rail)).toHaveLength(8);
    expect(rail[0]).toBe("level");
    expect(rail[2]).toBe("settle");
  });

  it("allows Ask only on the non-custodian's own desk", () => {
    const household = configuredFund();
    expect(widgetAllowedFor("ask", household, BIANCA)).toBe(false);
    expect(widgetAllowedFor("ask", household, JONATHAN)).toBe(true);
    expect(() => setFundRailSlot(household, {
      memberId: BIANCA,
      createdBy: BIANCA,
      slot: 2,
      widgetId: "ask",
    })).toThrow("That one only belongs on your own desk.");
    const contributor = setFundRailSlot(household, {
      memberId: JONATHAN,
      createdBy: JONATHAN,
      slot: 4,
      widgetId: "ask",
    }).household;
    expect(railFor(contributor, JONATHAN)[3]).toBe("ask");
  });

  it("returns the full library with truthful on-rail and allowed flags", () => {
    const household = configuredFund();
    const custodian = drawerFor(household, BIANCA);
    const contributor = drawerFor(household, JONATHAN);
    expect(custodian).toHaveLength(16);
    expect(contributor).toHaveLength(16);
    expect(custodian.filter((row) => row.onRail)).toHaveLength(8);
    expect(contributor.filter((row) => row.onRail)).toHaveLength(8);
    expect(custodian.find((row) => row.id === "ask")?.allowed).toBe(false);
    expect(contributor.find((row) => row.id === "ask")?.allowed).toBe(true);
  });

  it("keeps the arrangement Personal through split, assembly, and deterministic convergence", async () => {
    const before = configuredFund();
    const result = setFundRailSlot(before, {
      memberId: JONATHAN,
      createdBy: JONATHAN,
      slot: 2,
      widgetId: "accounts",
    });
    const arranged = result.household;
    expect(result).toMatchObject({ persistenceScope: "member-personal", personalMemberId: JONATHAN });
    expect(result.undo.commandKind).toBe("fund-rail-personal");
    expect(arranged.lastCommittedAt).toBe(before.lastCommittedAt);
    expect(arranged.revision).toBe(before.revision);
    expect(arranged.commandReceipts).toEqual(before.commandReceipts);
    expect(arranged.booksAcceptedHash).toBe(before.booksAcceptedHash);
    expect(fundRailPreferenceUpdateAllowed(before, arranged, JONATHAN)).toBe(true);
    expect(fundRailPreferenceUpdateAllowed(before, { ...arranged, activity: [] }, JONATHAN)).toBe(false);
    const split = splitForSync(arranged, JONATHAN);
    expect(split.personal.fundRail?.slots[1]).toBe("accounts");
    expect(split.shared.members.every((member) => member.fundRail === undefined)).toBe(true);
    expect(split.shared.activity).toEqual(splitForSync(before, JONATHAN).shared.activity);
    expect(railFor(assembleHousehold(split.shared, split.personal), JONATHAN)[1]).toBe("accounts");
    expect(await financialAuditHash(arranged)).toBe(await financialAuditHash(before));

    const later: PersonalEnvelope = {
      ...split.personal,
      fundRail: {
        memberId: JONATHAN,
        slots: ["level", "settle", "waiting", "ask", "next-out", "streams", "shape", "week"],
        updatedAt: "2099-01-01T00:00:00.000Z",
      },
      lastCommittedAt: "2099-01-01T00:00:00.000Z",
    };
    expect(mergePersonal(split.personal, later).fundRail).toEqual(later.fundRail);
    expect(mergePersonal(later, split.personal).fundRail).toEqual(later.fundRail);
  });

  it("persists only the acting member's Personal envelope outside accepted books", async () => {
    localStorage.clear();
    const before = configuredFund();
    const arranged = setFundRailSlot(before, {
      memberId: JONATHAN,
      createdBy: JONATHAN,
      slot: 2,
      widgetId: "accounts",
    }).household;
    await savePersonalReplicaOnly(arranged, JONATHAN, "development");
    const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index));
    expect(keys).toEqual([expect.stringContaining("hearth:personal:v2:development:")]);
    expect(keys.some((key) => key?.includes("hearth:household:v2:"))).toBe(false);
    await expect(loadPersonalReplica("development", arranged.householdId, JONATHAN)).resolves.toMatchObject({
      kind: "personal",
      memberId: JONATHAN,
      fundRail: { slots: expect.arrayContaining(["accounts"]) },
    });
  });

  it("resets only the acting member to the role-derived default", () => {
    const arranged = setFundRailSlot(configuredFund(), {
      memberId: JONATHAN,
      createdBy: JONATHAN,
      slot: 2,
      widgetId: "accounts",
    }).household;
    const reset = resetFundRail(arranged, { memberId: JONATHAN, createdBy: JONATHAN }).household;
    expect(railFor(reset, JONATHAN)).toEqual(DEFAULT_RAIL_CONTRIBUTOR);
    expect(reset.members.find((member) => member.id === BIANCA)?.fundRail).toBeUndefined();
  });

  it("keeps unchanged arrangements on the Personal no-op lane", () => {
    const household = configuredFund();
    const unchanged = setFundRailSlot(household, {
      memberId: JONATHAN,
      createdBy: JONATHAN,
      slot: 2,
      widgetId: DEFAULT_RAIL_CONTRIBUTOR[1]!,
    });
    const alreadyDefault = resetFundRail(household, { memberId: JONATHAN, createdBy: JONATHAN });
    expect(unchanged).toMatchObject({
      household,
      persistenceScope: "member-personal",
      personalMemberId: JONATHAN,
    });
    expect(alreadyDefault).toMatchObject({
      household,
      persistenceScope: "member-personal",
      personalMemberId: JONATHAN,
    });
  });

  it("keeps stage selection in session storage and outside every money or rail command", () => {
    const office = readFileSync(resolve(process.cwd(), "src/OfficeWide.tsx"), "utf8");
    const plates = readFileSync(resolve(process.cwd(), "src/DeskPlates.tsx"), "utf8");
    expect(office).toContain("sessionStorage.setItem(fundStageStorageKey(environment, household.householdId, memberId, today), widgetId)");
    expect(office).toContain('role={spreadIsStage && fundConfigured ? "tabpanel" : undefined}');
    expect(office).toContain('role={fundConfigured && spreadIsStage ? "tablist" : undefined}');
    expect(office).not.toContain("setFundRailSlot");
    expect(office).not.toMatch(/postEntry|confirmHouseholdFundContribution/);
    expect(plates).toContain('role={tab ? "tab" : undefined}');
    expect(plates).toContain('aria-current={tab && active ? "true" : undefined}');
    expect(plates).toContain("onDoubleClick={tab ? undefined : onOpenCabinet}");
  });
});

// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { Till } from "../src/Till.tsx";
import {
  assembleHousehold,
  catalogHousehold,
  configureHouseholdFund,
  financialAuditHash,
  landingSurfaceForMember,
  mergePersonal,
  setLandingSurface,
  splitForSync,
  type Household,
} from "../src/core/index.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const TODAY = "2026-09-12";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function configuredFund(): Household {
  return configureHouseholdFund(catalogHousehold(), {
    custodianMemberId: BIANCA,
    openedOn: "2026-09-01",
    createdBy: BIANCA,
  }).household;
}

describe("Till slice 4 landing preference", () => {
  it("defaults the Fund custodian to the Till and everyone else to the desk without assigning either", () => {
    const household = configuredFund();
    expect(landingSurfaceForMember(household, BIANCA)).toBe("till");
    expect(landingSurfaceForMember(household, JONATHAN)).toBe("desk");
    expect(household.members.every((member) => member.landingSurface === undefined)).toBe(true);
  });

  it("lets a member set and reverse only their own preference without changing money", async () => {
    const before = configuredFund();
    const deskResult = setLandingSurface(before, { memberId: BIANCA, createdBy: BIANCA, surface: "desk" });
    const desk = deskResult.household;
    const till = setLandingSurface(desk, { memberId: BIANCA, createdBy: BIANCA, surface: "till" }).household;

    expect(deskResult).toMatchObject({ persistenceScope: "member-personal", personalMemberId: BIANCA });
    expect(deskResult.undo.commandKind).toBe("landing-surface-personal");

    expect(landingSurfaceForMember(desk, BIANCA)).toBe("desk");
    expect(landingSurfaceForMember(till, BIANCA)).toBe("till");
    expect(till.members.find((member) => member.id === JONATHAN)?.landingSurface).toBeUndefined();
    expect(till.transactions).toEqual(before.transactions);
    expect(till.shifts).toEqual(before.shifts);
    expect(till.fundEvents).toEqual(before.fundEvents);
    expect(await financialAuditHash(till)).toBe(await financialAuditHash(before));
  });

  it("refuses a cross-member change with the exact copy and zero mutation", () => {
    const household = configuredFund();
    const before = structuredClone(household);
    expect(() => setLandingSurface(household, {
      memberId: BIANCA,
      createdBy: JONATHAN,
      surface: "desk",
    })).toThrow("Only you can choose where you land.");
    expect(household).toEqual(before);
  });

  it("refuses a target-derived actor when trusted actor identity is omitted", () => {
    const household = configuredFund();
    const before = structuredClone(household);
    expect(() => setLandingSurface(household, {
      memberId: BIANCA,
      surface: "desk",
    } as Parameters<typeof setLandingSurface>[1])).toThrow("Only you can choose where you land.");
    expect(household).toEqual(before);
  });

  it("keeps the preference member-Personal through split, assembly, and convergence", () => {
    const desk = setLandingSurface(configuredFund(), {
      memberId: BIANCA,
      createdBy: BIANCA,
      surface: "desk",
    }).household;
    const split = splitForSync(desk, BIANCA);
    expect(split.personal.landingSurface).toBe("desk");
    expect(split.shared.members.every((member) => member.landingSurface === undefined)).toBe(true);
    expect(landingSurfaceForMember(assembleHousehold(split.shared, split.personal), BIANCA)).toBe("desk");

    const later = {
      ...split.personal,
      landingSurface: "till" as const,
      landingSurfaceUpdatedAt: "2099-01-01T00:00:00.000Z",
      lastCommittedAt: "2099-01-01T00:00:00.000Z",
    };
    expect(mergePersonal(split.personal, later).landingSurface).toBe("till");
    expect(mergePersonal(later, split.personal).landingSurface).toBe("till");

    const unrelatedNewerEnvelope = { ...split.personal, lastCommittedAt: "2100-01-01T00:00:00.000Z" };
    expect(mergePersonal(later, unrelatedNewerEnvelope).landingSurface).toBe("till");

    const sameClockDesk = {
      ...split.personal,
      landingSurface: "desk" as const,
      landingSurfaceUpdatedAt: "2099-01-01T00:00:00.000Z",
    };
    const sameClockTill = { ...sameClockDesk, landingSurface: "till" as const };
    expect(mergePersonal(sameClockDesk, sameClockTill).landingSurface).toBe("till");
    expect(mergePersonal(sameClockTill, sameClockDesk).landingSurface).toBe("till");
  });

  it("treats see everything as a peek and never as a preference write", () => {
    const household = setLandingSurface(configuredFund(), {
      memberId: BIANCA,
      createdBy: BIANCA,
      surface: "till",
    }).household;
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    let peeked = false;
    act(() => {
      root.render(createElement(Till, {
        household,
        memberId: BIANCA,
        today: TODAY,
        busy: false,
        showSwipe: false,
        offlinePending: false,
        onOpenSwipe: () => undefined,
        onSeeEverything: () => { peeked = true; },
        onCommand: () => undefined,
      }));
    });
    act(() => (host.querySelector("[data-till='desk']") as HTMLAnchorElement).click());
    expect(peeked).toBe(true);
    expect(landingSurfaceForMember(household, BIANCA)).toBe("till");
    act(() => root.unmount());
    host.remove();
  });

  it("fences every preference write behind the self-owned command", () => {
    const commandSource = readFileSync(resolve(process.cwd(), "src/core/commands.ts"), "utf8");
    const appSource = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
    const tillSource = readFileSync(resolve(process.cwd(), "src/Till.tsx"), "utf8");
    expect(commandSource.match(/landingSurface:\s*surface/g)).toHaveLength(1);
    expect(commandSource.indexOf("actor.createdBy !== member.id")).toBeLessThan(commandSource.indexOf("landingSurface: surface"));
    expect(appSource).not.toContain("setLandingSurface");
    expect(tillSource).not.toContain("setLandingSurface");
  });
});

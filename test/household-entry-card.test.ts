import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { catalogHousehold } from "../src/core/index.ts";
import {
  HouseholdEntryCard,
  discoveredHouseholdCardModels,
  formatHouseholdEditedAt,
  inviteFlowMessage,
  replicaHouseholdCardModels,
} from "../src/HouseholdEntryCard.tsx";

describe("household entry presentation", () => {
  const now = new Date("2026-08-31T16:30:00.000Z");

  it("shows relative and exact edit time in the device zone", () => {
    const toronto = formatHouseholdEditedAt("2026-08-31T16:22:00.000Z", now, "America/Toronto");
    const vancouver = formatHouseholdEditedAt("2026-08-31T16:22:00.000Z", now, "America/Vancouver");
    expect(toronto.lastEditedIso).toBe("2026-08-31T16:22:00.000Z");
    expect(toronto.lastEditedRelative).toBe("Edited 8 mins ago");
    expect(toronto.lastEditedExact).toContain("Aug 31, 2026");
    expect(toronto.lastEditedExact).toContain("12:22");
    expect(vancouver.lastEditedExact).toContain("9:22");
  });

  it("uses an honest empty state for missing and invalid edit stamps", () => {
    expect(formatHouseholdEditedAt(null, now, "America/Toronto").lastEditedRelative).toBe("No edits yet");
    expect(formatHouseholdEditedAt("not-a-date", now, "America/Toronto").lastEditedIso).toBeNull();
  });

  it("deduplicates and sorts authorized households newest first", () => {
    const older = { ...catalogHousehold("development"), householdId: "HH-OLDER", name: "Older", lastCommittedAt: "2026-08-31T14:00:00.000Z" };
    const newer = { ...catalogHousehold("development"), householdId: "HH-NEWER", name: "Newer", lastCommittedAt: "2026-08-31T16:00:00.000Z" };
    const rows = discoveredHouseholdCardModels([
      { household: older, memberId: "MEM-001" },
      { household: newer, memberId: "MEM-002" },
      { household: newer, memberId: "MEM-002" },
    ], now, "America/Toronto");
    expect(rows.map((row) => row.householdId)).toEqual(["HH-NEWER", "HH-OLDER"]);
    expect(rows[0]?.memberName).toBe("Jonathan");
  });

  it("sorts device replicas by their accepted edit stamps", () => {
    const rows = replicaHouseholdCardModels([
      { householdId: "HH-A", name: "A", environment: "development", revision: 1, memberIds: [], updatedAt: null },
      { householdId: "HH-B", name: "B", environment: "development", revision: 2, memberIds: [], updatedAt: "2026-08-31T16:00:00.000Z" },
    ], now, "America/Toronto");
    expect(rows.map((row) => row.householdId)).toEqual(["HH-B", "HH-A"]);
  });

  it("renders a keyboard button, exact time, member, and highlighted invitation status", () => {
    const model = discoveredHouseholdCardModels([{
      household: { ...catalogHousehold("development"), householdId: "HH-READY", name: "Beaulne Household", lastCommittedAt: "2026-08-31T16:22:00.000Z" },
      memberId: "MEM-001",
    }], now, "America/Toronto")[0]!;
    const html = renderToStaticMarkup(createElement(HouseholdEntryCard, {
      model,
      busy: false,
      highlighted: true,
      onOpen: () => undefined,
    }));
    expect(html).toContain("Beaulne Household");
    expect(html).toContain("Bianca");
    expect(html).toContain("Edited 8 mins ago");
    expect(html).toContain("2026-08-31T16:22:00.000Z");
    expect(html).toContain("Invitation accepted · ready to open");
    expect(html).toContain("autofocus");
  });

  it("keeps every invitation phase truthful", () => {
    expect(inviteFlowMessage("awaiting-google")).toMatch(/Continue with Google/);
    expect(inviteFlowMessage("redeeming")).toMatch(/Accepting/);
    expect(inviteFlowMessage("refreshing")).toMatch(/Refreshing/);
    expect(inviteFlowMessage("ready")).toMatch(/ready to open/);
    expect(inviteFlowMessage("error")).toMatch(/not changed/);
  });
});

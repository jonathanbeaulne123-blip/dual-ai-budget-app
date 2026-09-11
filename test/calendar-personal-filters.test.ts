import { describe, expect, it } from "vitest";
import { addRecurrence, addPotentialExpense, buildMonthBoard, calendarPresentation, catalogHousehold, postPotentialExpense, splitForSync } from "../src/core/index.ts";
import { calendarItemVisible } from "../src/calendar/visibility.ts";
import type { BoardItem } from "../src/core/board.ts";

describe("Calendar scope and display layers", () => {
  it("lets Personal plans use accessible accounts and keeps the plan and receipt private", () => {
    let h = catalogHousehold();
    h.accounts.push({ ...h.accounts[0]!, id: "own", scope: "personal", ownerMemberId: "MEM-001" }, { ...h.accounts[0]!, id: "partner", scope: "personal", ownerMemberId: "MEM-002" });
    const personal = calendarPresentation(h, "MEM-001", "personal");
    expect(personal.accounts.map(a => a.id)).toContain("ACC-CHEQUING");
    expect(personal.accounts.map(a => a.id)).toContain("own");
    expect(personal.accounts.map(a => a.id)).not.toContain("partner");
    h = addPotentialExpense(h, { date: "2026-09-11", title: "Private appointment travel", amount: "20", accountId: "ACC-CHEQUING", subcategoryId: "SUB-LIFE-FUN", createdBy: "MEM-001", visibility: "personal" }).household;
    const plan = h.potentialExpenses.at(-1)!;
    expect(calendarPresentation(h, "MEM-001", "personal").potentialExpenses).toContainEqual(plan);
    expect(calendarPresentation(h, "MEM-002", "personal").potentialExpenses).not.toContainEqual(plan);
    expect(calendarPresentation(h, "MEM-001", "household").potentialExpenses).not.toContainEqual(plan);
    h = postPotentialExpense(h, { id: plan.id, createdBy: "MEM-001" }).household;
    const receipt = h.transactions.find(row => row.sourceId === plan.id)!;
    expect(receipt.visibility).toBe("personal");
    expect(calendarPresentation(h, "MEM-001", "personal").transactions).toContainEqual(receipt);
    expect(splitForSync(h, "MEM-001").shared.transactions).not.toContainEqual(receipt);
  });
  it("does not offer Shared repeating templates with private destinations", () => {
    const h = catalogHousehold();
    h.accounts.push({ ...h.accounts[0]!, id: "private", scope: "personal", ownerMemberId: "MEM-001" });
    const template = addRecurrence(h, { cadence: "monthly", nextDate: "2026-09-11", type: "expense", amount: "20", accountId: "ACC-CHEQUING", subcategoryId: "SUB-LIFE-FUN", note: "Shared bill" }).household.recurrences[0]!;
    expect(template).toBeDefined();
    h.recurrences = [{ ...template, id: "private-destination", type: "transfer", accountId: "ACC-CHEQUING", transferToAccountId: "private" }];
    expect(calendarPresentation(h, "MEM-001", "personal").recurrences).toEqual([]);
  });
  it("filters duplicate-titled Google sources independently without changing board amounts", () => {
    const board = buildMonthBoard(catalogHousehold(), "2026-09", "2026-09-11", [
      { id: "a", calendarId: "primary", title: "Appointment", date: "2026-09-11", memberId: "MEM-001", memberColor: "green", hearthOwned: false },
      { id: "b", calendarId: "shared", title: "Appointment", date: "2026-09-11", memberId: "MEM-001", memberColor: "green", hearthOwned: false },
    ]);
    const before = JSON.stringify(board);
    const rows = board.days.flatMap(day => day.items).filter(item => calendarItemVisible(item, { "google:primary": false }));
    expect(rows.filter(item => item.kind === "google").map(item => item.calendarId)).toEqual(["shared"]);
    expect(JSON.stringify(board)).toBe(before);
    expect(rows.filter(item => calendarItemVisible(item, { google: false })).some(item => item.kind === "google")).toBe(false);
  });
  it.each(["bill", "subscription", "paycheck", "potential-expense", "event", "detected", "other"])("independently hides %s", kind => {
    const item = { kind, source: kind === "event" ? "event" : "recurrence" } as BoardItem;
    expect(calendarItemVisible(item, {})).toBe(true);
    expect(calendarItemVisible(item, { [kind]: false })).toBe(false);
  });
});

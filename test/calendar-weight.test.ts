import { describe, expect, it } from "vitest";
import { addAppointment, addRecurrence, buildMonthBoard, catalogHousehold, cashFlowStatement, markDuplicate, postEntry, postOneRecurrence, postTransfer, postVisit, reversePostedMoney, type Household } from "../src/core/index.ts";
import { projectLedgerExperience } from "../src/core/ledgerExperience.ts";
import { calendarWeight } from "../src/core/calendarWeight.ts";
import { cashFlowDelta, cashFlowRows } from "../src/core/cashFlowRows.ts";
import parity from "./fixtures/cash-flow-parity.json";
const today = "2026-09-08";
const weights = (h: Household, month = "2026-09") => calendarWeight(h, buildMonthBoard(h, month, today), today);
const day = (h: Household, date = today) => weights(h).find(row => row.date === date)!;
function recurrence(h: Household, accountId = "ACC-CHEQUING", nextDate = today, cadence: "monthly" | "weekly" = "monthly") {
  return addRecurrence(h, { cadence, nextDate, type: "expense", amount: "20", accountId, subcategoryId: "SUB-FOOD-GROCERIES", note: "Fictional due" }).household;
}
function appointment(h: Household, recovery = 0) {
  return addAppointment(h, { title: "Fictional visit", kind: "dentist", nextDate: "2026-09-05", cadence: { kind: "once" }, typicalCost: 200, typicalRecovery: recovery, subcategoryId: "SUB-HEALTH-DENTAL", accountId: "ACC-CHEQUING" }).household;
}
function visit(h: Household) {
  return postVisit(h, { appointmentId: h.appointments[0]!.id, date: "2026-09-05", amount: 200, expectedRecovery: 0, confirmDuplicate: true });
}
describe("dated cash and Claude's Weight", () => {
  it("preserves all24 recorded pre-extraction monthly statements exactly and dated cash deltas tie", () => {
    for (const fixture of parity) {
      const household = { ...catalogHousehold(), ...fixture.household } as Household;
      for (const expected of fixture.statements) {
        expect(cashFlowStatement(household, expected.monthKey), fixture.name).toEqual(expected);
        const rows = cashFlowRows(household, `${expected.monthKey}-01`, `${expected.monthKey}-31`);
        expect(rows.reduce((sum, row) => sum + cashFlowDelta(row), 0), fixture.name).toBe(expected.netCashCents);
      }
    }
  });
  it("shows a cash purchase, paired Visa payment and still-outstanding future bill without counting card spend twice", () => {
    let h = recurrence(catalogHousehold(), "ACC-CHEQUING", "2026-09-11");
    h = postEntry(h, { date: today, type: "expense", amount: 37.51, accountId: "ACC-CHEQUING", subcategoryId: "SUB-FOOD-GROCERIES", confirmDuplicate: true }).household;
    h = postEntry(h, { date: today, type: "expense", amount: 82.13, accountId: "ACC-VISA", subcategoryId: "SUB-FOOD-GROCERIES", confirmDuplicate: true }).household;
    h = postTransfer(h, { date: today, amount: 40, fromAccountId: "ACC-CHEQUING", toAccountId: "ACC-VISA", confirmDuplicate: true }).household;
    const original = JSON.stringify(h);
    expect(day(h).postedOutCents).toBe(7751); expect(day(h).posted.filter(row => row.component === "debtPaydownCents")).toHaveLength(1);
    expect(day(h).posted.filter(row => row.component === "cardSpendCents")[0]!.amountCents).toBe(8213);
    expect(day(h, "2026-09-11").outstandingOutCents).toBe(2000); expect(day(h, "2026-09-11").scheduled[0]!.item.due).toBe(false);
    expect(JSON.stringify(h)).toBe(original);
    expect(day({ ...h, transactions: [...h.transactions].reverse() }).postedOutCents).toBe(7751);
  });
  it("uses signed cash delta for reversed income, reversed receivable settlement, and cash expense returned", () => {
    const income = postEntry(catalogHousehold(), { date: "2026-09-01", type: "income", amount: 100, accountId: "ACC-CHEQUING", subcategoryId: "SUB-INCOME-WAGES", confirmDuplicate: true });
    let h = reversePostedMoney(income.household, income.postedIds[0]!, { reversalDate: today }).household;
    const transfer = postTransfer(h, { date: "2026-09-02", amount: 50, fromAccountId: "ACC-CLAIMS", toAccountId: "ACC-CHEQUING", confirmDuplicate: true });
    h = reversePostedMoney(transfer.household, transfer.postedIds[0]!, { reversalDate: today }).household;
    const expense = postEntry(h, { date: "2026-09-03", type: "expense", amount: 25, accountId: "ACC-CHEQUING", subcategoryId: "SUB-FOOD-GROCERIES", confirmDuplicate: true });
    h = reversePostedMoney(expense.household, expense.postedIds[0]!, { reversalDate: today }).household;
    expect(day(h).postedOutCents).toBe(15000); expect(day(h).postedInCents).toBe(2500);
    expect(day(h).posted.reduce((sum, row) => sum + cashFlowDelta(row), 0)).toBe(-12500);
  });
  it("turns a due recurrence into posted ink and retains real mixed dates", () => {
    let h = recurrence(catalogHousehold()); const id = h.recurrences[0]!.id;
    expect(day(h).outstandingOutCents).toBe(2000); expect(day(h).postedOutCents).toBe(0);
    h = postOneRecurrence(h, id, today).household;
    expect(day(h).postedOutCents).toBe(2000); expect(day(h).outstandingOutCents).toBe(0);
    h = recurrence(h); expect(day(h).postedOutCents).toBe(2000); expect(day(h).outstandingOutCents).toBe(2000);
  });
  it("keeps card and internal-transfer plans as context while debt payments leave cash", () => {
    let h = recurrence(catalogHousehold(), "ACC-VISA");
    for (const to of ["ACC-SAVINGS", "ACC-VISA"]) h = addRecurrence(h, { cadence: "monthly", nextDate: today, type: "transfer", amount: "30", accountId: "ACC-CHEQUING", transferToAccountId: to, subcategoryId: "", note: "Standing transfer" }).household;
    const d = day(h); expect(d.outstandingOutCents).toBe(3000); expect(d.scheduled).toHaveLength(3);
    expect(d.scheduled.some(row => row.note.includes("card spending"))).toBe(true);
  });
  it("deduplicates once visits, keeps gross cost and recovery separate and recognizes no-claim receipts", () => {
    const h = appointment(catalogHousehold(), 150);
    expect(weights(h).reduce((sum, row) => sum + row.outstandingOutCents, 0)).toBe(20000);
    expect(day(h, "2026-09-05").scheduled[0]!.item.amountCents).toBe(20000);
    expect(day(h, "2026-09-05").scheduled[0]!.note).toContain("$150.00 expected back separately");
    const posted = visit(h).household;
    expect(posted.transactions.find(tx => tx.source === "visit")?.sourceId).toBe(h.appointments[0]!.id);
    expect(weights(posted).flatMap(row => row.scheduled).filter(row => row.item.source === "appointment")).toHaveLength(0);
    expect(day(posted, "2026-09-05").postedOutCents).toBe(20000);
  });
  it("does not call an excluded or reversed appointment paid, or silently reopen its Post action; reinstatement restores recognition", () => {
    const posted = visit(appointment(catalogHousehold()));
    const excluded = markDuplicate(posted.household, posted.postedIds[0]!, true).household;
    expect(day(excluded, "2026-09-05").postedOutCents).toBe(0);
    expect(day(excluded, "2026-09-05").scheduled[0]!.allowPost).toBe(false);
    expect(day(excluded, "2026-09-05").outstandingOutCents).toBe(0);
    expect(day(excluded, "2026-09-05").scheduled[0]!.note).toContain("not plotted");
    const reversed = reversePostedMoney(posted.household, posted.postedIds[0]!, { reversalDate: today });
    expect(day(reversed.household, "2026-09-05").scheduled[0]!.allowPost).toBe(false);
    expect(day(reversed.household).postedInCents).toBe(20000);
    const reversalId = reversed.household.transactions.find(tx => tx.reversalOfId === posted.postedIds[0])!.id;
    const restored = reversePostedMoney(reversed.household, reversalId, { reversalDate: "2026-09-09" }).household;
    expect(weights(restored).flatMap(row => row.scheduled).filter(row => row.item.source === "appointment")).toHaveLength(0);
  });
  it("names an older occurrence carried to today and keeps a real daily occurrence on today", () => {
    const h = appointment(catalogHousehold());
    const older = { ...h, appointments: h.appointments.map(row => ({ ...row, nextDate: "2026-08-20" })) };
    expect(day(older).scheduled[0]!.note).toContain("overdue from 2026-08-20, shown today");
    expect(day(older).scheduled[0]!.scheduledDate).toBe("2026-08-20");
    expect(weights(older).reduce((sum, row) => sum + row.outstandingOutCents, 0)).toBe(20000);
    const daily = { ...h, appointments: h.appointments.map(row => ({ ...row, cadence: { kind: "days" as const, interval: 1 } })) };
    expect(day(daily).scheduled).toHaveLength(1);
    expect(day(daily).scheduled[0]!.scheduledDate).toBeUndefined();
  });
  it("uses the same scoped Calendar floor and never carries a partner Personal canary", () => {
    let h = catalogHousehold();
    const template = h.accounts.find(row => row.id === "ACC-CHEQUING")!;
    h = { ...h, accounts: [...h.accounts, { ...template, id: "PARTNER-PRIVATE", name: "PARTNER CANARY", scope: "personal", ownerMemberId: "MEM-002" }] };
    h = postEntry(h, { date: today, type: "expense", amount: 918.27, accountId: "PARTNER-PRIVATE", subcategoryId: "SUB-FOOD-GROCERIES", note: "PARTNER CANARY", createdBy: "MEM-002", visibility: "personal", confirmDuplicate: true }).household;
    for (const view of ["household", "personal"] as const) {
      const projection = projectLedgerExperience(h, "MEM-001", view, today);
      if (!projection.ok) throw new Error(projection.reason);
      const floor = projection.scopedHousehold;
      expect(JSON.stringify(weights(floor))).not.toMatch(/PARTNER CANARY|91827/);
    }
  });
});

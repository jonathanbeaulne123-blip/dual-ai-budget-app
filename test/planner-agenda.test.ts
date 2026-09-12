import { describe, expect, it } from "vitest";
import { catalogHousehold, compileHousehold, postEntry, addRecurrence, postOneRecurrence } from "../src/core/index.ts";
import { saveTask, completeTask, type TaskInput } from "../src/core/tasks.ts";
import { agenda, affordability, evidenceForTask, suggestedEvidence, nextPayday, taskOccurrences } from "../src/core/agenda.ts";
import { parseTaskCapture } from "../src/core/taskCapture.ts";

const B = "MEM-001", J = "MEM-002", TODAY = "2026-09-14"; // a Monday
const draft = (patch: Partial<TaskInput["task"]> = {}): TaskInput["task"] => ({
  visibility: "household", title: "Call the vet", notes: "", listId: null, parentId: null, doDate: TODAY, dueDate: null, repeat: "none", cue: "none",
  assigneeId: null, backupId: null, chapterId: null, planReference: null, moneyLink: null, expectedAmountCents: null, deleted: false, ...patch,
});
const input = (id: string, patch: Partial<TaskInput["task"]> = {}, memberId = B, expectedRevision = 0): TaskInput => ({ memberId, id: `TASK-${id}`, expectedRevision, task: draft(patch) });
function fixture() {
  let h = postEntry(catalogHousehold(), { date: "2026-09-10", type: "income", amount: 1060, accountId: "ACC-CHEQUING", subcategoryId: "SUB-INCOME-WAGES", createdBy: B, note: "Pay", confirmDuplicate: true }).household;
  h = addRecurrence(h, { cadence: "monthly", nextDate: "2026-09-18", type: "expense", amount: "140", accountId: "ACC-CHEQUING", subcategoryId: "SUB-HOUSING-ELECTRIC", note: "Hydro", kind: "bill" }).household;
  h = addRecurrence(h, { cadence: "biweekly", nextDate: "2026-09-18", type: "income", amount: "900", accountId: "ACC-CHEQUING", subcategoryId: "SUB-INCOME-WAGES", note: "Paycheque", kind: "paycheck" }).household;
  return h;
}

describe("planner agenda and affordability (D-245)", () => {
  it("unions tasks with bills already in the books, one list per day, and never changes money", () => {
    let h = fixture();
    const before = compileHousehold(h);
    h = saveTask(h, input("vet")).household;
    h = saveTask(h, input("hotel", { title: "Book the wedding hotel", expectedAmountCents: 60_000, doDate: "2026-09-16", dueDate: "2026-09-19" })).household;
    h = saveTask(h, input("tires", { title: "Tires", expectedAmountCents: 78_000, doDate: "2026-09-17" })).household;
    h = saveTask(h, input("someday", { title: "Learn to make bread", doDate: null })).household;
    const week = agenda(h, "week", { memberId: B, view: "household", today: TODAY });
    expect(week.from).toBe(TODAY); expect(week.to).toBe("2026-09-20"); expect(week.days).toHaveLength(7);
    expect(week.items.map((item) => `${item.kind}:${item.title}@${item.date}`)).toEqual([
      "task:Call the vet@2026-09-14", "task:Book the wedding hotel@2026-09-16", "task:Tires@2026-09-17", "bill:Hydro@2026-09-18", "bill:Paycheque@2026-09-18",
    ]);
    expect(week.days[2]!.items.map((item) => item.title)).toEqual(["Book the wedding hotel"]);
    expect(week.items.find((item) => item.title === "Book the wedding hotel")).toMatchObject({ money: true, dueDate: "2026-09-19", amountCents: 60_000 });
    expect(agenda(h, "anytime", { memberId: B, view: "household", today: TODAY }).items.map((item) => item.title)).toEqual(["Learn to make bread"]);
    expect(agenda(h, "today", { memberId: B, view: "household", today: TODAY }).items.map((item) => item.title)).toEqual(["Call the vet"]);
    expect({ ...compileHousehold(h), activity: before.activity, lastCommittedAt: before.lastCommittedAt }).toEqual(before);
  });
  it("tells the week what it can afford, with the payday line", () => {
    let h = fixture();
    h = saveTask(h, input("hotel", { title: "Book the wedding hotel", expectedAmountCents: 60_000, doDate: "2026-09-16" })).household;
    h = saveTask(h, input("tires", { title: "Tires", expectedAmountCents: 78_000, doDate: "2026-09-17" })).household;
    h = saveTask(h, input("vet")).household;
    const week = agenda(h, "week", { memberId: B, view: "household", today: TODAY });
    const money = affordability(h, week.items, { memberId: B, view: "household", today: TODAY, from: week.from, to: week.to });
    expect(money.source).toBe("accounts");
    expect(money.availableCents).toBe(106_000);
    expect(money.plannedCents).toBe(60_000 + 78_000 + 14_000);
    expect(money.nextPayday).toBe("2026-09-18");
    expect(money.incomeCents).toBe(90_000);
    expect(money.lines.get("TASK-hotel")).toMatchObject({ status: "covered", shortCents: 0 });
    // Tires land on the 17th: $1,060 − $600 − $780 = −$320 now; the paycheque is the 18th, after the do date, so it is short.
    expect(money.lines.get("TASK-tires")).toMatchObject({ status: "short", shortCents: 32_000, payday: "2026-09-18" });
    // Hydro is due the 18th, the same day $900 lands, so known income covers it.
    expect(money.lines.get("bill:" + h.recurrences.find((r) => r.note === "Hydro")!.id + ":2026-09-18")).toMatchObject({ status: "covered" });
    expect(money.lines.get("TASK-vet")).toMatchObject({ status: "none" });
    const moved = saveTask(h, input("tires", { title: "Tires", expectedAmountCents: 78_000, doDate: "2026-09-19" }, B, 1)).household;
    const later = agenda(moved, "week", { memberId: B, view: "household", today: TODAY });
    expect(affordability(moved, later.items, { memberId: B, view: "household", today: TODAY, from: later.from, to: later.to }).lines.get("TASK-tires")).toMatchObject({ status: "covered" });
    expect(nextPayday(h, B, "personal", TODAY)).toBe("2026-09-18");
  });
  it("derives completion from evidence for a linked bill and suggests receipts for an expected cost", () => {
    let h = fixture();
    const hydro = h.recurrences.find((r) => r.note === "Hydro")!;
    h = saveTask(h, input("hydro", { title: "Pay hydro", moneyLink: { kind: "recurrence", recurrenceId: hydro.id, date: "2026-09-18" }, expectedAmountCents: 14_000, doDate: "2026-09-18" })).household;
    expect(evidenceForTask(h, h.tasks![0]!)).toBeNull();
    expect(agenda(h, "week", { memberId: B, view: "household", today: TODAY }).items.filter((i) => i.kind === "task")[0]).toMatchObject({ done: false });
    const paid = postOneRecurrence(h, hydro.id, "2026-09-18").household;
    const evidence = evidenceForTask(paid, paid.tasks![0]!);
    expect(evidence).toMatchObject({ kind: "transaction", amountCents: 14_000, date: "2026-09-18" });
    const week = agenda(paid, "week", { memberId: B, view: "household", today: TODAY });
    expect(week.items.find((i) => i.id === "TASK-hydro")).toMatchObject({ done: true, evidence });
    expect(week.items.find((i) => i.kind === "bill" && i.title === "Hydro")).toMatchObject({ done: true });
    expect(agenda(paid, "logbook", { memberId: B, view: "household", today: "2026-09-30" }).months[0]).toMatchObject({ monthKey: "2026-09", handled: 1, bills: 1, billCents: 14_000 });
    // Attaching that evidence is a command the person confirms; the receipt is verified against the books.
    const done = completeTask(paid, { memberId: B, id: "TASK-hydro", expectedRevision: 1, evidence }).household;
    expect(done.tasks![0]!.completionEvidence).toEqual(evidence);
    h = saveTask(h, input("tires", { title: "Tires at Canadian Tire", expectedAmountCents: 78_000, doDate: "2026-09-17" })).household;
    h = postEntry(h, { date: "2026-09-17", type: "expense", amount: 802.5, accountId: "ACC-VISA", subcategoryId: "SUB-FOOD-GROCERIES", createdBy: B, note: "Canadian Tire", confirmDuplicate: true }).household;
    h = postEntry(h, { date: "2026-09-17", type: "expense", amount: 12, accountId: "ACC-VISA", subcategoryId: "SUB-FOOD-GROCERIES", createdBy: B, note: "Coffee", confirmDuplicate: true }).household;
    const suggestions = suggestedEvidence(h, B, h.tasks!.find((t) => t.id === "TASK-tires")!, TODAY);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({ kind: "transaction", amountCents: 80_250 });
  });
  it("keeps repeating tasks on their own cadence and opens the next one when one is done", () => {
    let h = saveTask(fixture(), input("bins", { title: "Bins out", doDate: "2026-09-15", repeat: "weekly" })).household;
    expect(taskOccurrences(h.tasks![0]!, TODAY, "2026-10-05")).toEqual(["2026-09-15", "2026-09-22", "2026-09-29"]);
    expect(agenda(h, "week", { memberId: B, view: "household", today: TODAY }).items.map((i) => i.key)).toContain("TASK-bins@2026-09-15");
    h = completeTask(h, { memberId: B, id: "TASK-bins", expectedRevision: 1 }).household;
    expect(h.tasks!.map((t) => [t.id, t.doDate, Boolean(t.completedAt)])).toEqual([["TASK-bins", "2026-09-15", true], ["TASK-bins-r20260922", "2026-09-22", false]]);
    expect(agenda(h, "week", { memberId: B, view: "household", today: "2026-09-21" }).items.map((i) => i.key)).toContain("TASK-bins-r20260922@2026-09-22");
  });
  it("shows Mine, Theirs and Ours without ever showing a partner's private task", () => {
    let h = fixture();
    h = saveTask(h, input("mine", { title: "Mine", assigneeId: B })).household;
    h = saveTask(h, input("theirs", { title: "Theirs", assigneeId: J })).household;
    h = saveTask(h, input("ours", { title: "Ours" })).household;
    h = saveTask(h, input("secret", { title: "Secret", visibility: "personal" }, J)).household;
    const titles = (ownership: "mine" | "theirs" | "ours" | "all", memberId = B, view: "household" | "personal" = "household") => agenda(h, "today", { memberId, view, today: TODAY, ownership }).items.map((i) => i.title).sort();
    expect(titles("mine")).toEqual(["Mine"]);
    expect(titles("theirs")).toEqual(["Theirs"]);
    expect(titles("ours")).toEqual(["Ours"]);
    expect(titles("all")).toEqual(["Mine", "Ours", "Theirs"]);
    expect(titles("all", J, "personal")).toEqual(["Secret"]);
    expect(titles("all", B, "personal")).toEqual([]);
  });
  it("parses capture with money, dates, deadlines, repeats, cues, people and lists", () => {
    const h = catalogHousehold();
    const ctx = { today: TODAY, household: h, memberId: B };
    expect(parseTaskCapture("pay hydro friday $140", ctx)).toMatchObject({ title: "Pay hydro", doDate: "2026-09-18", dueDate: null, expectedAmountCents: 14_000, repeat: "none" });
    expect(parseTaskCapture("Book the wedding hotel by next friday $1,240.50 @Jonathan #wedding", ctx)).toMatchObject({ title: "Book the wedding hotel", dueDate: "2026-09-25", doDate: null, expectedAmountCents: 124_050, assigneeId: J, listName: "wedding" });
    expect(parseTaskCapture("bins out every week tuesday", ctx)).toMatchObject({ title: "Bins out", repeat: "weekly", doDate: "2026-09-15" });
    expect(parseTaskCapture("tires after payday", ctx)).toMatchObject({ title: "Tires", cue: "after-payday", doDate: null });
    expect(parseTaskCapture("surprise gift for Jonathan private tomorrow", ctx)).toMatchObject({ title: "Surprise gift", visibility: "personal", assigneeId: null, doDate: "2026-09-15" });
    expect(parseTaskCapture("call the vet on the 30th", ctx)).toMatchObject({ title: "Call the vet", doDate: "2026-09-30" });
    expect(parseTaskCapture("renew passport by 2027-01-10", ctx)).toMatchObject({ title: "Renew passport", dueDate: "2027-01-10" });
    expect(parseTaskCapture("Dentist oct 3", ctx)).toMatchObject({ title: "Dentist", doDate: "2026-10-03" });
    expect(parseTaskCapture("   ", ctx).title).toBe("");
  });
});

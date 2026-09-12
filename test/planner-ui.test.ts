// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { catalogHousehold, postEntry, addRecurrence, saveBoardTask, type Household, type CommitResult } from "../src/core/index.ts";
import { saveTask, type TaskInput } from "../src/core/tasks.ts";
import { Planner, type PlannerProps } from "../src/planner/Planner.tsx";

let host: HTMLDivElement; let root: Root; let household: Household;
let commands: ((current: Household) => CommitResult)[];
const B = "MEM-001", J = "MEM-002", today = "2026-09-14";
const draft = (patch: Partial<TaskInput["task"]> = {}): TaskInput["task"] => ({ visibility: "household", title: "Call the vet", notes: "", listId: null, parentId: null, doDate: today, dueDate: null, repeat: "none", cue: "none", assigneeId: null, backupId: null, chapterId: null, planReference: null, moneyLink: null, expectedAmountCents: null, deleted: false, ...patch });
function props(): PlannerProps {
  return { household, memberId: B, view: "household", today, busy: false, onRecord: vi.fn(), onCommand: (fn) => { commands.push(fn); const result = fn(household); household = result.household; return { kind: "accepted-local", ok: true, household, previous: null, postedIds: result.postedIds, confirmationId: "c", identityHash: null, revision: 1, sharingMode: "local" as never, errorClass: null, userMessage: null, retryable: false, postedExactlyOnce: true, postedNothing: false, recoveryAvailable: false }; } };
}
async function render(next: Partial<PlannerProps> = {}) { await act(async () => root.render(h(Planner, { ...props(), ...next }))); }
function button(name: string) { const found = [...host.querySelectorAll<HTMLButtonElement>("button")].find((row) => row.getAttribute("aria-label") === name || row.textContent?.trim() === name); if (!found) throw new Error(`Missing ${name}`); return found; }
async function click(name: string) { await act(async () => button(name).click()); await render(); }
async function type(element: HTMLInputElement, value: string) { await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, value); element.dispatchEvent(new Event("input", { bubbles: true })); }); }
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  commands = [];
  household = postEntry(catalogHousehold(), { date: "2026-09-10", type: "income", amount: 1060, accountId: "ACC-CHEQUING", subcategoryId: "SUB-INCOME-WAGES", createdBy: B, note: "Pay", confirmDuplicate: true }).household;
  household = addRecurrence(household, { cadence: "biweekly", nextDate: "2026-09-18", type: "income", amount: "900", accountId: "ACC-CHEQUING", subcategoryId: "SUB-INCOME-WAGES", note: "Paycheque", kind: "paycheck" }).household;
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("planner UI (D-245)", () => {
  it("captures a task with money, shows the affordability line, and never offers a checkbox on money", async () => {
    await render();
    await type(host.querySelector<HTMLInputElement>("#planner-capture")!, "tires wednesday $780");
    expect(host.querySelector(".planner-capture__understood")!.textContent).toContain("$780.00");
    await click("Add");
    expect(household.tasks?.map((row) => [row.title, row.doDate, row.expectedAmountCents])).toEqual([["Tires", "2026-09-16", 78_000]]);
    await click("This week");
    expect(host.querySelector(".planner-afford")!.textContent).toContain("$780.00 planned, $1060.00 available before Friday");
    const row = host.querySelector(".planner-row--task.is-money")!;
    expect(row.querySelector(".planner-row__check")).toBeNull();
    expect(row.textContent).toContain("covered");
    expect(row.querySelector("button")?.textContent).toBe("Record");
    await click("Record");
    expect(household.transactions).toHaveLength(1);
  });
  it("ticks a life task, keeps it in the logbook, and takes an assigned task as a real act", async () => {
    household = saveTask(household, { memberId: J, id: "TASK-vet", expectedRevision: 0, task: draft({ assigneeId: B, backupId: J }) }).household;
    await render();
    expect(host.textContent).toContain("Taking it");
    await click("Taking it");
    expect(household.tasks![0]!.acknowledgedBy).toEqual([B]);
    await click("Complete Call the vet");
    expect(household.tasks![0]!.completedAt).toBeTruthy();
    await click("Logbook");
    expect(host.querySelector(".planner-month")!.textContent).toContain("1 thing handled");
    await click("Reopen Call the vet");
    expect(household.tasks![0]!.completedAt).toBeNull();
  });
  it("attaches a receipt from the books to a money task instead of ticking it", async () => {
    household = saveTask(household, { memberId: B, id: "TASK-hydro", expectedRevision: 0, task: draft({ title: "Pay hydro", expectedAmountCents: 14_000 }) }).household;
    household = postEntry(household, { date: today, type: "expense", amount: 140, accountId: "ACC-CHEQUING", subcategoryId: "SUB-HOUSING-ELECTRIC", createdBy: B, note: "Hydro bill", confirmDuplicate: true }).household;
    await render();
    await click("Attach receipt");
    const receipt = host.querySelector<HTMLButtonElement>(".planner-attach li button")!;
    expect(receipt.textContent).toContain("$140.00");
    await act(async () => receipt.click()); await render();
    expect(household.tasks![0]!.completionEvidence).toMatchObject({ kind: "transaction", amountCents: 14_000 });
    expect(household.transactions).toHaveLength(2);
  });
  it("brings the board to-dos in once and shows Mine / Theirs / Ours", async () => {
    household = saveBoardTask(household, { memberId: B, id: "BOARD-TASK-one", title: "Feed Hercules", assigneeId: J, dueDate: null, completed: false, expectedVersion: 0 }).household;
    await render();
    expect(host.querySelector(".planner-adopt")!.textContent).toContain("1 to-do");
    await click("Bring them in");
    expect(household.kitchen.boards?.tasks).toEqual([]);
    expect(host.querySelector(".planner-adopt")).toBeNull();
    await click("Anytime");
    expect(host.textContent).toContain("Feed Hercules");
    await click("Mine");
    expect(host.textContent).not.toContain("Feed Hercules");
    await click("Theirs");
    expect(host.textContent).toContain("Feed Hercules");
    expect(host.textContent).toContain("Jonathan hasn’t seen this yet");
  });
  it("keeps a private task to its owner in the personal view", async () => {
    household = saveTask(household, { memberId: J, id: "TASK-secret", expectedRevision: 0, task: draft({ title: "Surprise", visibility: "personal" }) }).household;
    await render();
    expect(host.textContent).not.toContain("Surprise");
    await render({ memberId: J, view: "personal" });
    expect(host.textContent).toContain("Surprise");
    expect(host.querySelector(".planner-ownership")).toBeNull();
  });
});

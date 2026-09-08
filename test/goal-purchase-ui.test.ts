// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { JarsBody } from "../src/widgets/Jars.tsx";
import { addGoal, assembleHousehold, buildDashboard, catalogHousehold, fundGoal, splitForSync, type CommitResult, type Household } from "../src/core/index.ts";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
async function fixture() {
  let h = addGoal(catalogHousehold(), { name: "Shared kettle", shared: true, target: 100 }).household;
  h = fundGoal(h, { goalId: h.goals[0]!.id, amount: 100, fromAccountId: "ACC-CHEQUING", date: "2026-09-08", createdBy: "MEM-001" }).household;
  h = addGoal(h, { name: "PRIVATE PURCHASE CANARY", shared: false, target: 100, ownerMemberId: "MEM-001" }).household;
  const scoped = assembleHousehold(splitForSync(h, "MEM-001").shared, null);
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  const queue: ((h: Household) => CommitResult)[] = [];
  const props = { household: scoped, booksHousehold: h, view: "household" as const, memberId: "MEM-001", dashboard: buildDashboard(scoped, "2026-09-08"), today: "2026-09-08", busy: false, onPlan: () => {}, onCommand: (fn: (h: Household) => CommitResult) => queue.push(fn) };
  await act(async () => root.render(createElement(JarsBody, props)));
  return { h, host, root, queue, props, close: async () => { await act(async () => root.unmount()); host.remove(); } };
}
async function click(name: string) { await act(async () => [...document.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent?.trim() === name)!.click()); }
describe("goal purchase confirmation", () => {
  it("reviews scoped names against full accepted books and freezes the date across a delayed write", async () => {
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-09-08T16:00:00Z"));
    const m = await fixture();
    try {
      expect(m.host.textContent).not.toContain("PRIVATE PURCHASE CANARY");
      await click("Mark purchased"); await click("Review purchase"); expect(m.queue).toHaveLength(0);
      expect(document.body.textContent).toContain("2026-09-08"); await click("Cancel"); expect(m.queue).toHaveLength(0);
      await click("Review purchase"); await click("Confirm purchase"); expect(m.queue).toHaveLength(1);
      vi.setSystemTime(new Date("2026-09-09T16:00:00Z"));
      const bought = m.queue[0]!(m.h).household;
      expect(bought.goalPurchases[0]!.date).toBe("2026-09-08");
      expect(bought.transactions.find(tx => tx.type === "expense")!.date).toBe("2026-09-08");
      expect(bought.goals[0]!.status).toBe("retired");
      expect(m.host.textContent).not.toContain("PRIVATE PURCHASE CANARY");
    } finally { await m.close(); vi.useRealTimers(); }
  });
  it("refuses queued purchases after room change", async () => {
    const m = await fixture();
    try {
      await click("Mark purchased"); await click("Review purchase"); await click("Confirm purchase");
      await act(async () => m.root.render(createElement(JarsBody, { ...m.props, view: "personal" })));
      expect(() => m.queue[0]!(m.h)).toThrow(/changed/);
    } finally { await m.close(); }
  });
});

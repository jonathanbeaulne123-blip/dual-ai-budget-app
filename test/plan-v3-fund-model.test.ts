// @vitest-environment jsdom
import { act, createElement, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import PlanStudioV3 from "../src/plan-v3/PlanStudioV3.tsx";
import { defaultFundSnapshotSource, fundModelSnapshot, planStudioFundSnapshot, planStudioV3Model } from "../src/plan-v3/model.ts";
import { fundSnapshot } from "../src/core/fundModel.ts";
import { divisionFor } from "../src/core/fundModel.ts";
import { openChapter, type CommitResult, type Household } from "../src/core/index.ts";
import { ALEX, SAM, TODAY, buffer, fundBill, fundedHousehold, migrated, reserveGoal } from "./fixtures/fund-model.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Fictional: a sorted household with rent and hydro in Prepare, a goal in Build and a $400 cushion. */
function sortedMonth(): Household {
  let h = fundedHousehold("2000");
  h = fundBill(h, { note: "Fictional rent", amount: "1500", subcategoryId: "SUB-HOUSING-RENT", day: 25 }).household;
  h = fundBill(h, { note: "Fictional hydro", amount: "300", subcategoryId: "SUB-HOUSING-ELECTRIC", day: 28 }).household;
  h = reserveGoal(h, "Fictional trip", "100", "build").household;
  h = buffer(h, "400");
  return migrated(h);
}

describe("the studio reads the money model (D-281)", () => {
  it("picks fundSnapshot only when VITE_FUND_MODEL_V2 is on", () => {
    expect(defaultFundSnapshotSource("1")).toBe(fundModelSnapshot);
    expect(defaultFundSnapshotSource("0")).toBe(planStudioFundSnapshot);
    // The vitest environment has the flag off: the studio keeps the transitional adapter.
    expect(defaultFundSnapshotSource()).toBe(planStudioFundSnapshot);
  });

  it("maps Now, Prepare, Protect and Build from the snapshot, to the cent", () => {
    const h = sortedMonth();
    const core = fundSnapshot(h, { memberId: ALEX, view: "household", today: TODAY });
    const snap = fundModelSnapshot(h, { memberId: ALEX, view: "household", today: TODAY });
    expect(snap.mode).toBe(2);
    expect(snap.now.amountCents).toBe(core.now);
    expect(snap.prepare.amountCents).toBe(core.prepare.amountCents);
    expect(snap.protect).toMatchObject({ amountCents: core.protect.amountCents, targetCents: 40000, line: "of $400 cushion" });
    expect(snap.build.amountCents).toBe(core.build.amountCents);
    expect(snap.prepare.line).toBe("Bills covered all September");
    expect(snap.prepare.rows.map(row => row.label)).toEqual(expect.arrayContaining(["Fictional rent", "Fictional hydro"]));
    expect(snap.build.rows.map(row => row.label)).toEqual(["Fictional trip"]);
    // The bills are in Prepare now, not Protect: no more "$0 beside Bills covered".
    expect(snap.prepare.amountCents).toBeGreaterThan(0);
    expect(snap.flow?.source).toBe("fund-walk");
  });

  it("names the short bill on Prepare's line", () => {
    let h = sortedMonth();
    h = fundBill(h, { note: "Fictional insurance", amount: "500", subcategoryId: "SUB-HOUSING-RENT", day: 27 }).household;
    const snap = fundModelSnapshot(h, { memberId: ALEX, view: "household", today: TODAY });
    expect(snap.prepare.tone).toBe("attention");
    expect(snap.prepare.line).toBe("Short $100 for Fictional insurance, Sep 27");
  });

  it("lists undivided contributions with Hercules's draft split, and the open proposal once one exists", () => {
    const h = sortedMonth();
    const snap = fundModelSnapshot(h, { memberId: ALEX, view: "household", today: TODAY });
    expect(snap.undividedContributions).toHaveLength(1);
    const row = snap.undividedContributions[0]!;
    expect(row).toMatchObject({ memberName: "Sam (fictional)", amountCents: 200000, proposal: null, waitingOn: ["Alex (fictional)", "Sam (fictional)"] });
    expect(Object.values(row.suggestion!).reduce((a, b) => a + b, 0)).toBe(200000);
  });

  it("falls back to the transitional adapter for a household not sorted yet", () => {
    let h = fundedHousehold("2000");
    h = fundBill(h, { note: "Fictional rent", amount: "1500", subcategoryId: "SUB-HOUSING-RENT" }).household;
    expect(fundModelSnapshot(h, { memberId: ALEX, view: "household", today: TODAY })).toEqual(planStudioFundSnapshot(h, { memberId: ALEX, view: "household", today: TODAY }));
  });

  it("reads the open Chapter as its calendar month and reminds once the month has ended", () => {
    let h = sortedMonth();
    h = openChapter(h, { memberId: ALEX, foundationId: "make-rent-boring", intendedMonth: "2026-08", at: "2026-08-03T12:00:00.000Z" }).household;
    const model = planStudioV3Model(h, { memberId: ALEX, view: "household", today: TODAY, source: fundModelSnapshot });
    expect(model.chapter).toMatchObject({ monthKey: "2026-08", monthLabel: "August" });
    expect(model.chapter?.reminder).toContain("still open from August");
    // Nothing closed it.
    expect(h.chapters!.find(row => row.id === model.chapter!.id)!.state).toBe("open");
  });
});

let host: HTMLDivElement, root: Root;
afterEach(async () => { await act(async () => root?.unmount()); host?.remove(); document.body.innerHTML = ""; });

function mount(start: Household, memberId: string) {
  const state = { household: start };
  function Proof() {
    const [household, setHousehold] = useState(start);
    const ref = useRef(household); ref.current = household;
    const onCommand = async (fn: (current: Household) => CommitResult) => {
      try { const result = fn(ref.current); ref.current = result.household; state.household = result.household; setHousehold(result.household); return { ...result, ok: true }; }
      catch (error) { return { ok: false, userMessage: (error as Error).message }; }
    };
    return createElement(PlanStudioV3, { household, view: "household", memberId, today: TODAY, busy: false, onCommand, snapshotSource: fundModelSnapshot });
  }
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  return { state, render: async () => act(async () => root.render(createElement(Proof))) };
}
const findButton = (text: string) => [...document.querySelectorAll<HTMLButtonElement>("button")].find(b => (b.textContent ?? "").startsWith(text) || (b.getAttribute("aria-label") ?? "").startsWith(text));
const click = async (target: HTMLElement | undefined) => { if (!target) throw new Error("missing button"); await act(async () => { target.click(); await new Promise(r => setTimeout(r, 0)); }); };

describe("the studio's split and refill flows (D-281)", () => {
  it("one partner proposes the split, the other confirms, and only then is it divided", async () => {
    const a = mount(sortedMonth(), ALEX);
    await a.render();
    expect(host.querySelector(".pv3-divide")?.textContent).toContain("Divide $2,000");
    await click(findButton("Propose this split"));
    expect(host.textContent).toContain("Waiting for Sam (fictional) to say yes.");
    const eventId = a.state.household.fundModelRows!.find(row => row.kind === "division")!;
    expect(eventId.state).toBe("proposed");
    const proposed = a.state.household;
    await act(async () => root.unmount()); host.remove();

    const b = mount(proposed, SAM);
    await b.render();
    expect(findButton("Propose this split")).toBeUndefined();
    await click(findButton("Yes, divide it this way"));
    const division = b.state.household.fundModelRows!.find(row => row.kind === "division")!;
    expect(division.state).toBe("confirmed");
    expect(divisionFor(b.state.household, (division as { contributionEventId: string }).contributionEventId)?.state).toBe("confirmed");
    // Divided: the moment is gone, and no Fund event was posted.
    expect(host.querySelector(".pv3-divide")).toBeNull();
    expect(b.state.household.fundEvents!.length).toBe(proposed.fundEvents!.length);
  });

  it("the custodian suggests a Protect refill in its sheet, and the partner confirms", async () => {
    const a = mount(sortedMonth(), ALEX);
    await a.render();
    await click(findButton("Protect,"));
    const input = document.querySelector<HTMLInputElement>(".pv3-refill input")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "50");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await click(findButton("Suggest a refill"));
    const refill = a.state.household.fundModelRows!.find(row => row.kind === "refill")!;
    expect(refill).toMatchObject({ state: "proposed", amountCents: 5000, toFund: "everyday" });
    const proposed = a.state.household;
    await act(async () => root.unmount()); host.remove(); document.body.innerHTML = "";

    const b = mount(proposed, SAM);
    await b.render();
    await click(findButton("Protect,"));
    expect(findButton("Suggest a refill")).toBeUndefined();
    await click(findButton("Yes, lend it"));
    expect(b.state.household.fundModelRows!.find(row => row.kind === "refill")!.state).toBe("confirmed");
    expect(document.body.textContent).toContain("Agreed by both of you");
    expect(b.state.household.fundEvents!.length).toBe(proposed.fundEvents!.length);
  });
});

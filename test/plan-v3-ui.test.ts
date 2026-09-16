// @vitest-environment jsdom
import { act, createElement, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { PlanStudio } from "../src/PlanStudio.tsx";
import PlanStudioV3 from "../src/plan-v3/PlanStudioV3.tsx";
import { planStudioFundSnapshot, type FundSnapshotSource } from "../src/plan-v3/model.ts";
import { PathTentContext } from "../src/path/tentContext.ts";
import { acknowledgeHouseholdPlan, openChapter, type CommitResult, type Household, type LedgerView } from "../src/core/index.ts";
import { planLifeFixture } from "./fixtures/plan-life.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const today = "2026-09-11";
let host: HTMLDivElement, root: Root;

type Harness = { commands: string[]; refuse: boolean; household: Household };
function mount(start: Household, options: { view?: LedgerView; memberId?: string; source?: FundSnapshotSource; tent?: () => void } = {}) {
  const harness: Harness = { commands: [], refuse: false, household: start };
  function Proof() {
    const [household, setHousehold] = useState(start);
    const ref = useRef(household); ref.current = household;
    const onCommand = async (fn: (current: Household) => CommitResult) => {
      harness.commands.push(fn.toString());
      if (harness.refuse) return { ok: false, userMessage: "Refused in the fictional test." };
      try {
        const result = fn(ref.current);
        ref.current = result.household; harness.household = result.household; setHousehold(result.household);
        return { ...result, ok: true };
      } catch (error) { return { ok: false, userMessage: (error as Error).message }; }
    };
    const studio = createElement(PlanStudioV3, { household, view: options.view ?? "household", memberId: options.memberId ?? "MEM-001", today, busy: false, onCommand, snapshotSource: options.source });
    return options.tent ? createElement(PathTentContext.Provider, { value: { leaveTent: options.tent } }, studio) : studio;
  }
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  return { harness, render: async () => act(async () => root.render(createElement(Proof))) };
}
const buttons = (scope: ParentNode = document) => [...scope.querySelectorAll<HTMLButtonElement>("button")];
const button = (name: string | RegExp, scope: ParentNode = document) => {
  const found = buttons(scope).find(b => typeof name === "string" ? (b.getAttribute("aria-label") ?? b.textContent ?? "").trim().startsWith(name) : name.test(b.getAttribute("aria-label") ?? b.textContent ?? ""));
  if (!found) throw new Error(`No button ${name}. Have: ${buttons(scope).map(b => b.getAttribute("aria-label") ?? b.textContent).join(" | ")}`);
  return found;
};
const click = async (target: HTMLElement) => act(async () => { target.click(); await new Promise(r => setTimeout(r, 0)); });
const key = async (k: string) => act(async () => { (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true })); await new Promise(r => setTimeout(r, 0)); });
const agreedHousehold = () => {
  let h = planLifeFixture("household");
  h = openChapter(h, { memberId: "MEM-001", foundationId: "make-rent-boring", at: "2026-09-01T12:00:00.000Z" }).household;
  const v = h.planVersions!.find(r => r.state === "proposed")!;
  for (const m of ["MEM-001", "MEM-002"]) h = acknowledgeHouseholdPlan(h, { planVersionId: v.id, expectedDigest: v.digest, memberId: m, createdBy: m }).household;
  return h;
};

afterEach(async () => { await act(async () => root?.unmount()); host?.remove(); document.body.innerHTML = ""; });

describe("Plan Studio v3 behind its flag", () => {
  it("keeps today's studio when the flag is off", async () => {
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root.render(createElement(PlanStudio, { household: planLifeFixture("household"), view: "household", memberId: "MEM-001", today, busy: false, onCommand: async () => null })));
    expect(host.querySelector(".pv3")).toBeNull();
    expect(host.querySelector(".plan-studio")).not.toBeNull();
    expect(host.textContent).toContain("Plan tools");
  });
});

describe("the plan at rest", () => {
  it("stands the Queen's Now, three funds with one line each, the month, and one primary action", async () => {
    const { render } = mount(planLifeFixture("household"));
    await render();
    expect(host.querySelector("h1")?.textContent).toBe("September");
    const queen = button("Everyday, the Queen");
    expect(queen.getAttribute("aria-label")).toContain("$3,100");
    expect(host.querySelectorAll(".pv3-fund")).toHaveLength(3);
    expect(button("Prepare,").getAttribute("aria-label")).toContain("Bills covered all September");
    expect(host.querySelectorAll(".pv3-cta")).toHaveLength(1);
    expect(button(/^Read it and agree/).className).toContain("pv3-cta");
    // Nothing the money model does not supply is claimed.
    expect(host.textContent).not.toContain("not divided yet");
    expect(host.querySelector(".pv3-chip")?.textContent).toContain("Alex (fictional) not yet, Sam (fictional) not yet");
  });

  it("shows seven tools for the household, six for a personal plan, and at most one badge", async () => {
    const h = planLifeFixture("household");
    h.planBridgeDecisions = [{ id: "B1", monthKey: "2026-09", kind: "contribution", label: "Fictional offer", amountCents: 1000, offeredByMemberId: "MEM-002", state: "proposed", createdAt: "2026-09-10T00:00:00.000Z", updatedAt: "2026-09-10T00:00:00.000Z" }];
    const { render } = mount(h);
    await render();
    expect(host.querySelectorAll(".pv3-shelf [data-tool]")).toHaveLength(7);
    expect(host.querySelectorAll("[data-badge='on']")).toHaveLength(1);
    expect(button("Letter tray").getAttribute("aria-label")).toBe("Letter tray, between yours and ours, 1 waiting");
    await act(async () => root.unmount()); host.remove();
    const personal = mount(planLifeFixture("personal"), { view: "personal" });
    await personal.render();
    expect(host.querySelectorAll(".pv3-shelf [data-tool]")).toHaveLength(6);
    expect(host.querySelector("[data-tool='letter']")).toBeNull();
  });

  it("opens a tool as a dialog with the existing section inside, closes on Escape and returns focus", async () => {
    const { render } = mount(planLifeFixture("household"));
    await render();
    const letter = button("Letter tray");
    letter.focus();
    await click(letter);
    const dialog = document.body.querySelector<HTMLElement>("[role='dialog']")!;
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.textContent).toContain("Letter tray");
    // The existing Bridge editor, unchanged, is what the tray holds.
    expect(buttons(dialog).some(b => b.textContent === "Save privately and review")).toBe(true);
    expect(dialog.querySelector("main")).toBeNull();
    expect(host.closest("[inert]") ?? host.parentElement?.querySelector("[inert]")).not.toBeNull();
    await key("Escape");
    expect(document.body.querySelector("[role='dialog']")).toBeNull();
    expect(document.activeElement).toBe(letter);
  });

  it("tapping a fund highlights its lane and opens its lines", async () => {
    const { render } = mount(planLifeFixture("household"));
    await render();
    await click(button("Protect,"));
    expect(host.querySelector(".pv3-flow")?.getAttribute("data-highlight")).toBe("protect");
    const dialog = document.body.querySelector<HTMLElement>("[role='dialog']")!;
    expect(dialog.textContent).toContain("Fictional rent");
    expect(dialog.textContent).toContain("not a bank move");
    await click(button("Close Protect", dialog));
    await click(button("Show all"));
    expect(host.querySelector(".pv3-flow")?.hasAttribute("data-highlight")).toBe(false);
  });

  it("walks the month's stones by keyboard and offers the same month as a list", async () => {
    const { render } = mount(planLifeFixture("household"));
    await render();
    const stones = [...host.querySelectorAll<HTMLButtonElement>(".pv3-stonebtn")];
    expect(stones).toHaveLength(30);
    expect(stones[19]!.getAttribute("aria-label")).toBe("Sun, Sep 20, Fictional rent $900 from Prepare, coming, the Fund about $2,800");
    stones[0]!.focus();
    await key("ArrowRight");
    expect(document.activeElement).toBe(stones[1]);
    await click(button("Show as a list"));
    const list = host.querySelector(".pv3-flow__list")!;
    expect(list.textContent).toContain("Sam (fictional)'s contribution $4,000");
    expect(list.textContent).toContain("Fictional rent $900 from Prepare");
  });

  it("shows the undivided-contribution moment only when the money model supplies one", async () => {
    const source: FundSnapshotSource = (h, o) => ({ ...planStudioFundSnapshot(h, o), undividedContributions: [{ id: "U1", memberId: "MEM-002", memberName: "Sam (fictional)", amountCents: 140000, date: today, suggestion: { prepare: 80000, protect: 0, build: 12500, everyday: 47500 }, waitingOn: ["Sam (fictional)"] }] });
    const { render } = mount(planLifeFixture("household"), { source });
    await render();
    expect(host.querySelector(".pv3-divide")?.textContent).toContain("Divide $1,400");
    expect(host.querySelector(".pv3-sent")?.textContent).toBe("Sam (fictional)'s $1,400 landed today. It's not divided yet.");
    // No split command exists yet, so nothing offers to post one, and the rest screen has no competing action.
    expect(buttons(host).some(b => b.textContent?.startsWith("Propose this split"))).toBe(false);
    expect(host.querySelector(".pv3-cta")).toBeNull();
  });
});

describe("the one check-in", () => {
  it("agreeing is per person: my paw stamps, my partner's does not", async () => {
    const { harness, render } = mount(planLifeFixture("household"));
    await render();
    await click(button(/^Read it and agree/));
    expect(host.querySelector("#pv3-step-h")?.textContent).toBe("Here's the month on one page. Ready to agree?");
    expect(document.activeElement).toBe(host.querySelector("#pv3-step-h"));
    await click(button(/^I agree to this plan/));
    expect(harness.commands.some(c => c.includes("acknowledgeHouseholdPlan"))).toBe(true);
    expect(host.querySelector(".pv3-seal")?.getAttribute("aria-label")).toBe("Agreement: Alex (fictional) agreed, Sam (fictional) not yet");
    expect(host.textContent).toContain("Waiting for Sam (fictional); agreeing is their own step.");
    expect(buttons(host).some(b => b.textContent?.startsWith("I agree"))).toBe(false);
  });

  it("pauses into the Shared Sitdown session, and either partner can pick it up", async () => {
    const { harness, render } = mount(planLifeFixture("household"));
    await render();
    await click(button("Two chairs"));
    await click(button(/^Start our check-in together/, document.body.querySelector("[role='dialog']")!));
    expect(host.querySelector(".pv3-checkin")?.getAttribute("data-step")).toBe("hello");
    await click(button("We're doing this together"));
    await click(button("Save and continue"));
    await click(button("Looks right"));
    expect(harness.commands.filter(c => c.includes("appendPlanSitdownTurn"))).toHaveLength(0); // "Looks right" only moves on (F4)
    await click(button("Pause"));
    const session = harness.household.planHerculesSessions!.at(-1)!;
    expect(session).toMatchObject({ state: "active", stage: 3, monthKey: "2026-09" });
    expect(host.querySelector(".pv3-toast")?.textContent).toBe("I'll keep your place: Prepare, step 4 of 9.");
    expect(button(/^Continue where we left off/).textContent).toContain("Prepare · step 4 of 9");
    // Sam opens the same household and resumes at the same step.
    await act(async () => root.unmount()); host.remove();
    const sam = mount(harness.household, { memberId: "MEM-002" });
    await sam.render();
    await click(button(/^Continue where we left off/));
    expect(host.querySelector(".pv3-checkin")?.getAttribute("data-step")).toBe("prepare");
    expect(host.querySelectorAll(".pv3-trail .is-done")).toHaveLength(3);
  });

  it("never says the place was kept when the save was refused", async () => {
    const { harness, render } = mount(planLifeFixture("household"));
    await render();
    await click(button(/^Read it and agree/));
    harness.refuse = true;
    await click(button("Pause"));
    expect(host.querySelector("[role='alert']")?.textContent).toContain("Refused in the fictional test.");
    expect(host.querySelector(".pv3-toast")).toBeNull();
    expect(host.querySelector(".pv3-checkin")).not.toBeNull();
  });

  it("look-closer chips open the same tool sheet, already on the right section", async () => {
    const { render } = mount(planLifeFixture("household"));
    await render();
    await click(button("Two chairs"));
    await click(button(/^Start our check-in together/, document.body.querySelector("[role='dialog']")!));
    await click(button("We're doing this together"));
    await click(button("Save and continue"));
    const chip = button("What if a pay is late?");
    chip.focus(); // a real press focuses the chip; jsdom's click() does not
    await click(chip);
    const dialog = document.body.querySelector<HTMLElement>("[role='dialog']")!;
    expect(dialog.querySelector("h2")?.textContent).toBe("Tracing paper");
    expect(dialog.querySelector("[aria-selected='true']")?.textContent).toBe("A pay runs late");
    expect(dialog.textContent).toContain("Rehearse a difficult month");
    await key("Escape");
    expect(document.activeElement).toBe(chip);
  });

  it("collapses a step that matches last month's agreed plan", async () => {
    const h = planLifeFixture("household");
    const v = h.planVersions![0]!;
    h.planVersions = [...h.planVersions!, { ...v, id: "PREV", monthKey: "2026-08", state: "active", sequence: 1 }];
    const { render } = mount(h);
    await render();
    await click(button(/^Read it and agree/));
    await click(button("Back"));
    expect(host.querySelector(".pv3-same")?.textContent).toContain("Same as August.");
    await click(button("Still right"));
    expect(host.querySelector(".pv3-checkin")?.getAttribute("data-step")).toBe("together");
  });

  it("the Sitdown closes the agreed month and the island door walks back", async () => {
    let left = 0;
    const { harness, render } = mount(agreedHousehold(), { tent: () => { left++; } });
    await render();
    await click(button(/^Close September's Chapter together/));
    expect(host.querySelector(".pv3-checkin")?.getAttribute("data-step")).toBe("sitdown");
    await click(button(/^Close the Sitdown with our agreed plan/));
    expect(harness.household.planHerculesSessions!.at(-1)!.state).toBe("closed");
    expect(host.textContent).toContain("September is set on our island.");
    await click(button("See it on our island"));
    expect(left).toBe(1);
    await click(button("Back to the plan"));
    expect(host.querySelector(".pv3-island")?.textContent).toContain("Set on our island");
    expect(button(/^Can we afford something/).className).toContain("pv3-cta");
  });

  it("a personal check-in has no Sitdown and no shared save", async () => {
    const { harness, render } = mount(planLifeFixture("personal"), { view: "personal" });
    await render();
    await click(button("Tracing paper"));
    await key("Escape");
    await click(button("Two chairs"));
    const dialog = document.body.querySelector<HTMLElement>("[role='dialog']")!;
    expect(buttons(dialog).some(b => b.textContent?.startsWith("Start our check-in"))).toBe(false);
    expect([...dialog.querySelectorAll("[role='tab']")].map(t => t.textContent)).toEqual([]);
    await key("Escape");
    expect(harness.commands).toHaveLength(0);
  });
});

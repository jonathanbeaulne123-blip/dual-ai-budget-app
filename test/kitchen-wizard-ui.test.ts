// @vitest-environment jsdom
import { act, createElement, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import KitchenWizard from "../src/plan-wizard/KitchenWizard.tsx";
import { PlanStudio } from "../src/PlanStudio.tsx";
import { currentPlanVersion, shapePlanDrafts, type CommitResult, type Household, type LedgerView } from "../src/core/index.ts";
import { planLifeFixture } from "./fixtures/plan-life.ts";

/**
 * The Kitchen wizard, driven. Fictional books only.
 *
 * The laws under test: one answer lays one line; the pull writes nothing; the
 * two writes are the app's own commands, each called exactly once; a refusal
 * is told as a refusal and keeps every answer; and no screen claims a card was
 * written, kept or pinned before the command that would do it came back.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const TODAY = "2026-09-11";
let host: HTMLDivElement, root: Root;

type Harness = { commands: string[]; refuse: boolean; household: Household };

function mount(start: Household, options: { view?: LedgerView; memberId?: string; door?: boolean } = {}) {
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
    const props = { household, view: options.view ?? "household" as LedgerView, memberId: options.memberId ?? "MEM-001", today: TODAY, busy: false, onCommand };
    return options.door ? createElement(PlanStudio, props) : createElement(KitchenWizard, { ...props, onOpenDrawer: () => {} });
  }
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  return { harness, render: async () => act(async () => { root.render(createElement(Proof)); await new Promise(r => setTimeout(r, 0)); }) };
}

const buttons = () => [...document.querySelectorAll<HTMLButtonElement>("button")];
const button = (name: string | RegExp) => {
  const found = buttons().find(b => {
    const text = (b.getAttribute("aria-label") ?? b.textContent ?? "").trim();
    return typeof name === "string" ? text === name : name.test(text);
  });
  if (!found) throw new Error(`No button ${name}. Have: ${buttons().map(b => (b.textContent ?? "").trim()).join(" | ")}`);
  return found;
};
const click = async (target: HTMLElement) => act(async () => { target.click(); await new Promise(r => setTimeout(r, 0)); });
const text = () => host.textContent ?? "";
const cardLine = (key: string) => host.querySelector(`.kw-line[data-line="${key}"] .kw-val`)?.textContent ?? "";
const laidCount = () => [...host.querySelectorAll(".kw-line")].filter(node => (node as HTMLElement).dataset.state === "done").length;
const ranks = () => host.querySelectorAll(".kw-rank").length;

async function setRange(node: HTMLInputElement, value: number) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(node, String(value));
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise(r => setTimeout(r, 0));
  });
}

/** Walk the five questions. Each step is one click, and lays one line. */
async function writeTheCard(options: { fixedDay?: boolean; who?: "Both of us" | "Just me" } = {}) {
  await click(button("Lay a fresh card flat"));
  expect(laidCount()).toBe(0);
  await click(button("Car insurance"));
  await click(button("$820.00"));
  if (options.fixedDay) {
    const day = host.querySelector<HTMLInputElement>("#kw-when")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(day, "2026-11-02");
      day.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise(r => setTimeout(r, 0));
    });
    await click(button("Fit it"));
  } else {
    await click(button("Not fixed yet"));
  }
  await click(button("Fit it")); // the pot: the suggestion is already selected
  await click(button(options.who ?? "Both of us"));
}

const pullTab = () => host.querySelector<HTMLInputElement>(".kw-pull")!;

afterEach(async () => { await act(async () => root?.unmount()); host?.remove(); document.body.innerHTML = ""; });

describe("Hercules asks one question at a time", () => {
  it("shows one question, lays exactly one line per answer, and fits one rank each", async () => {
    const { render } = mount(planLifeFixture("household"));
    await render();
    await click(button("Lay a fresh card flat"));

    const asks = ["What are we making room for?", "How much do you think it takes?", "By when?", "Which pot does this come out of?", "Who is sitting at this one?"];
    expect(host.querySelector(".kw-ask")?.textContent).toBe(asks[0]);
    expect(ranks()).toBe(0);

    await click(button("Car insurance"));
    expect(laidCount()).toBe(1);
    expect(cardLine("what")).toBe("Car insurance");
    expect(ranks()).toBe(1);
    expect(host.querySelector(".kw-ask")?.textContent).toBe(asks[1]);

    await click(button("$820.00"));
    expect(laidCount()).toBe(2);
    expect(cardLine("much")).toBe("$820.00");
    expect(ranks()).toBe(2);

    await click(button("Not fixed yet"));
    expect(cardLine("when")).toBe("Not fixed yet");
    expect(ranks()).toBe(3);

    await click(button("Fit it"));
    expect(cardLine("pot")).toBe("Prepare");
    expect(ranks()).toBe(4);

    await click(button("Both of us"));
    expect(laidCount()).toBe(5);
    expect(ranks()).toBe(5);
    expect(host.querySelector(".kw-ask")?.textContent).toBe("Now pull it.");
  });

  it("goes back one question and forward again without duplicating a line", async () => {
    const { render } = mount(planLifeFixture("household"));
    await render();
    await click(button("Lay a fresh card flat"));
    await click(button("Car insurance"));
    await click(button("$820.00"));
    await click(button("Back one question"));
    expect(host.querySelector(".kw-ask")?.textContent).toBe("How much do you think it takes?");
    await click(button("$600.00"));
    expect(cardLine("much")).toBe("$600.00");
    expect(laidCount()).toBe(2);
    expect(ranks()).toBe(2);
  });

  it("holds the tab shut until all five ranks are fitted", async () => {
    const { render } = mount(planLifeFixture("household"));
    await render();
    await click(button("Lay a fresh card flat"));
    expect(pullTab().disabled).toBe(true);
    await click(button("Car insurance"));
    expect(pullTab().disabled).toBe(true);
    await writeRest();
    expect(pullTab().disabled).toBe(false);

    async function writeRest() {
      await click(button("$820.00"));
      await click(button("Not fixed yet"));
      await click(button("Fit it"));
      await click(button("Both of us"));
    }
  });
});

describe("the pot speaks the live money model", () => {
  it("pre-selects the suggestion the app's own rules make, and never Protect", async () => {
    const { render } = mount(planLifeFixture("household"));
    await render();
    await click(button("Lay a fresh card flat"));
    await click(button("Car insurance"));
    await click(button("$820.00"));
    await click(button("Not fixed yet"));

    const pots = [...host.querySelectorAll<HTMLButtonElement>(".kw-pick")];
    expect(pots.map(node => node.dataset.fund)).toEqual(["everyday", "prepare", "protect", "build"]);
    const pressed = pots.filter(node => node.getAttribute("aria-pressed") === "true");
    expect(pressed).toHaveLength(1);
    expect(pressed[0]!.dataset.fund).toBe("prepare");
    expect(pressed[0]!.dataset.fund).not.toBe("protect");
    expect(text()).toMatch(/Nothing is ever put there by default/);

    // Protect is offered, and can be chosen on purpose.
    await click(pots[2]!);
    await click(button("Fit it"));
    expect(cardLine("pot")).toBe("Protect");
  });
});

describe("the pull is a view, not a write", () => {
  it("raises and lowers the card without calling a command", async () => {
    const { harness, render } = mount(planLifeFixture("household"));
    await render();
    await writeTheCard();
    expect(harness.commands).toHaveLength(0);

    await setRange(pullTab(), 1000);
    expect(host.querySelector('[data-testid="kw-pullstate"]')?.textContent).toContain("Fully raised");
    await setRange(pullTab(), 0);
    expect(host.querySelector('[data-testid="kw-pullstate"]')?.textContent).toContain("Flat on the card");
    expect(harness.commands).toHaveLength(0);
  });
});

describe("no screen claims a save before the command resolves", () => {
  it("says nothing is written until savePlanDraft comes back", async () => {
    const { harness, render } = mount(planLifeFixture("household"));
    await render();
    await writeTheCard();
    await setRange(pullTab(), 1000);

    expect(text()).toMatch(/Nothing is written yet/);
    expect(text()).not.toMatch(/Written to your private draft/);
    expect(text()).not.toMatch(/On the wall/i);
    expect(harness.commands).toHaveLength(0);

    await click(button("Write it on the card"));
    expect(harness.commands).toHaveLength(1);
    expect(harness.commands[0]).toContain("savePlanDraft");
    expect(text()).toMatch(/Written to your private draft for 2026-09/);
    expect(text()).toMatch(/Nothing was shared and no money moved/);
    // Still not on the wall — pinning is a separate act.
    expect(text()).not.toMatch(/On the wall as a proposal/);
    expect(currentPlanVersion(harness.household, "household", "2026-09")!.lines.some(line => line.labelSnapshot === "Car insurance")).toBe(false);
  });

  it("tells a refusal as a refusal, writes nothing, and keeps every answer", async () => {
    const { harness, render } = mount(planLifeFixture("household"));
    await render();
    await writeTheCard();
    await setRange(pullTab(), 1000);
    harness.refuse = true;

    await click(button("Write it on the card"));
    expect(harness.commands).toHaveLength(1);
    expect(text()).toContain("Refused in the fictional test.");
    expect(text()).toMatch(/Nothing was written/);
    expect(text()).not.toMatch(/Written to your private draft/);
    // Every line is still on the card.
    expect(laidCount()).toBe(5);
    expect(cardLine("what")).toBe("Car insurance");
    expect(cardLine("much")).toBe("$820.00");
    expect(shapePlanDrafts(harness.household.planDrafts, "MEM-001").find(row => row.id === "LIFE-DRAFT")!.lines.some(line => line.labelSnapshot === "Car insurance")).toBe(false);
  });
});

describe("pinning the card to the wall", () => {
  it("proposes the Shared plan once, and says it waits for the partner", async () => {
    const { harness, render } = mount(planLifeFixture("household"));
    await render();
    await writeTheCard({ fixedDay: true });
    await setRange(pullTab(), 1000);
    await click(button("Write it on the card"));
    expect(harness.commands).toHaveLength(1);

    await click(button("Pin it to the wall for both of us"));
    expect(harness.commands).toHaveLength(2);
    expect(harness.commands[1]).toContain("proposeHouseholdPlan");
    const version = currentPlanVersion(harness.household, "household", "2026-09")!;
    expect(version.state).toBe("proposed");
    expect(version.lines.some(line => line.labelSnapshot === "Car insurance")).toBe(true);
    expect(text()).toMatch(/waits on the table until|stays pulled out until/);
    expect(text()).toMatch(/nothing is agreed until you both acknowledge/i);
    // The commit is one call of one command, not a loop.
    expect(harness.commands.filter(row => row.includes("proposeHouseholdPlan"))).toHaveLength(1);
  });

  it("locks the Personal plan instead, in the Personal ledger", async () => {
    const { harness, render } = mount(planLifeFixture("personal"), { view: "personal" });
    await render();
    await writeTheCard({ who: "Just me" });
    await setRange(pullTab(), 1000);
    await click(button("Write it on the card"));
    await click(button("Keep it as my plan"));
    expect(harness.commands).toHaveLength(2);
    expect(harness.commands[1]).toContain("lockPersonalPlan");
    expect(text()).toMatch(/Kept as your Personal Plan for 2026-09/);
  });

  it("honours a refused pin: nothing goes on the wall", async () => {
    const { harness, render } = mount(planLifeFixture("household"));
    await render();
    await writeTheCard();
    await setRange(pullTab(), 1000);
    await click(button("Write it on the card"));
    harness.refuse = true;
    await click(button("Pin it to the wall for both of us"));
    expect(text()).toMatch(/Not pinned\./);
    expect(text()).not.toMatch(/On the wall as a proposal/);
    expect(currentPlanVersion(harness.household, "household", "2026-09")!.lines.some(line => line.labelSnapshot === "Car insurance")).toBe(false);
  });

  it("puts “Not now” in the drawer, never the bin", async () => {
    const { harness, render } = mount(planLifeFixture("household"));
    await render();
    await writeTheCard();
    await setRange(pullTab(), 1000);
    await click(button("Write it on the card"));
    await click(button("Not now"));
    expect(text()).toMatch(/drawer, not the bin/);
    expect(text()).not.toMatch(/On the wall as a proposal/);
    expect(harness.commands).toHaveLength(1);
    expect(harness.commands.some(row => row.includes("proposeHouseholdPlan"))).toBe(false);
  });

  it("abandoning the card mid-flow keeps nothing on the wall and writes nothing", async () => {
    const { harness, render } = mount(planLifeFixture("household"));
    await render();
    await click(button("Lay a fresh card flat"));
    await click(button("Car insurance"));
    await click(button("$820.00"));
    await click(button("Lay a fresh card flat"));
    expect(laidCount()).toBe(0);
    expect(ranks()).toBe(0);
    expect(harness.commands).toHaveLength(0);
  });
});

describe("the Kitchen's doors land on the wizard, and the drawer still holds the studio", () => {
  it("opens the wizard as the Plan Studio's front door, with the seven tools one press away", async () => {
    const { render } = mount(planLifeFixture("household"), { door: true });
    await render();
    await act(async () => { await new Promise(r => setTimeout(r, 0)); });
    expect(host.querySelector(".kw")).not.toBeNull();
    expect(host.querySelector(".plan-studio")).toBeNull();

    await click(button(/Open the drawer/));
    await act(async () => { await new Promise(r => setTimeout(r, 0)); });
    expect(host.querySelector(".plan-studio")).not.toBeNull();

    await click(button("Back to the table"));
    expect(host.querySelector(".kw")).not.toBeNull();
  });
});

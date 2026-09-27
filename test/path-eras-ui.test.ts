// @vitest-environment jsdom
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addGoal, openChapter, postEntry, type CommitResult, type Household } from "../src/core/index.ts";
import { agreePathProposal, pendingPathProposals, shapePathWorld, type PathEraRow, type PathEraSpec } from "../src/core/pathWorld.ts";
import { crossPathEra, currentPathEra, pathEras, proposePathEra, proposePathEraPlan } from "../src/core/pathEras.ts";
import { pathMonths } from "../src/core/pathSignals.ts";
import { OurPathWorld } from "../src/path/OurPathWorld.tsx";
import { eraOffsets, newEraDraft } from "../src/path/eras.ts";
import { planLifeFixture } from "./fixtures/plan-life.ts";

// The Journey of Life on the page (D-268). jsdom has no WebGL; the "fake" mode hands back a stand-in world.
const created = vi.hoisted(() => ({ mode: "throw" as "throw" | "fake", worlds: [] as Record<string, ReturnType<typeof vi.fn>>[] }));
vi.mock("../src/path/world/pathWorld3d.ts", () => ({
  createPathWorld: () => {
    if (created.mode === "throw") throw new Error("WebGL unavailable");
    const names = ["setScene", "resize", "setAmbient", "setQuality", "sleep", "wake", "refresh", "focus", "focusMonth", "setLevel", "zoom", "turn", "stats", "dispose"];
    const world = Object.fromEntries(names.map((n) => [n, vi.fn()]));
    created.worlds.push(world);
    return world;
  },
}));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ME = "MEM-001";
const PARTNER = "MEM-002";
const AT = "2026-07-02T12:00:00.000Z";
const TODAY = "2026-09-15";

let host: HTMLDivElement, root: Root;
beforeEach(() => { delete (window as unknown as { __household?: Household }).__household; localStorage.clear(); Object.assign(created, { mode: "throw", worlds: [] }); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); localStorage.clear(); });

const era = (over: Partial<PathEraSpec> = {}): Omit<PathEraSpec, "crossedOn" | "retired"> => ({
  order: 1, name: "Moving in", finishLine: "Survive our first months without going broke", from: "2026-03", by: "2026-06",
  home: "flat", finish: { kind: "agree" }, plans: [], ...over,
});
function agreeAll(h: Household, by = [ME, PARTNER]): Household {
  let next = h;
  for (const row of pendingPathProposals(next)) {
    if (row.kind !== "era") continue;
    for (const memberId of by) {
      const fresh = shapePathWorld(next.pathWorld).find((r) => r.id === row.id) as PathEraRow;
      if (fresh.pending && !fresh.agreedByMemberIds.includes(memberId)) next = agreePathProposal(next, { memberId, rowId: fresh.id, revision: fresh.pendingRevision, at: AT }).household;
    }
  }
  return next;
}
function base(): Household {
  let h = planLifeFixture("household");
  h = openChapter(h, { memberId: ME, foundationId: "make-rent-boring", at: "2026-04-01T12:00:00.000Z" }).household;
  h = addGoal(h, { name: "Fictional down payment", target: "2000", shared: true, ownerMemberId: ME }).household;
  h = postEntry(h, { type: "expense", date: "2026-04-12", amount: "80", accountId: "ACC-VISA", subcategoryId: "SUB-LIFE-FUN", note: "Fictional concert", createdBy: ME, visibility: "household", confirmDuplicate: true }).household;
  return h;
}
const eraId = (h: Household, name: string) => pathEras(h, TODAY).find((row) => row.spec.name === name)!.id;
/** A past era (crossed in July), the current era (agree finish), a future era with a bank plan, and a sketched one. */
function journey({ currentFinish = { kind: "agree" } as PathEraSpec["finish"] } = {}): Household {
  let h = base();
  const goalId = h.goals.find((g) => g.name === "Fictional down payment")!.id;
  h = proposePathEra(h, { memberId: ME, spec: era(), at: AT }).household;
  h = proposePathEra(h, { memberId: ME, spec: era({ order: 2, name: "Making it ours", from: "2026-07", by: "2027-06", home: "furnished", finish: currentFinish }), at: AT }).household;
  h = proposePathEra(h, { memberId: ME, spec: era({ order: 3, name: "Our first house", from: "2027-07", by: null, home: "house", plans: [{ id: "PLAN-DOWN", kind: "bank", label: "The down payment", goalId, month: null }] }), at: AT }).household;
  h = agreeAll(h);
  h = crossPathEra(h, { memberId: ME, rowId: currentPathEra(h, "2026-07-15")!.id, today: "2026-07-15", at: AT }).household;
  h = agreeAll(h);
  // Sam pencils in a later era; only Sam has agreed.
  h = proposePathEra(h, { memberId: PARTNER, spec: era({ order: 4, name: "Porch years", from: "2030-01", by: null, home: "porch" }), at: AT }).household;
  return h;
}

function Harness({ initial, today = TODAY, extra }: { initial: Household; today?: string; extra?: Record<string, unknown> }) {
  const [household, setHousehold] = useState(initial);
  const [member, setMember] = useState(ME);
  const onCommand = async (fn: (h: Household) => CommitResult) => {
    const result = fn(household);
    setHousehold(result.household);
    (window as unknown as { __household: Household }).__household = result.household;
    return { ok: true, household: result.household };
  };
  return createElement("div", null,
    createElement("button", { id: "switch", onClick: () => setMember(member === ME ? PARTNER : ME) }, "switch"),
    createElement(OurPathWorld, {
      household, memberId: member, today, busy: false, onCommand, theme: "classic", ...extra,
      renderMini: null, classicRoom: createElement("div", { id: "classic" }, "Today's Our Path"),
    }));
}
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => host.querySelector<T>(selector)!;
const buttons = () => [...host.querySelectorAll<HTMLButtonElement>("button")];
const byText = (text: string | RegExp) => buttons().find((b) => (typeof text === "string" ? b.textContent?.trim() === text : text.test(b.textContent ?? "")))!;
const click = async (element: HTMLElement) => act(async () => { element.click(); });
const settle = async () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
async function waitForWorld(timeout = 2_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const world = created.worlds[0];
    if (world) return world;
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 25)); });
  }
  throw new Error("The fake world did not finish its staged load.");
}
const household = () => (window as unknown as { __household: Household }).__household;
async function type(element: HTMLInputElement | HTMLSelectElement, value: string) {
  await act(async () => {
    const proto = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}
const outline = () => [...host.querySelectorAll(".path-world__outline button")].map((b) => b.textContent ?? "");
const byLabel = (label: string) => buttons().find((b) => b.getAttribute("aria-label") === label)!;
const inPlanner = (text: string) => [...host.querySelectorAll<HTMLButtonElement>(".path-planner button")].find((b) => b.textContent?.trim() === text)!;
const inCard = (text: string) => [...host.querySelectorAll<HTMLButtonElement>(".path-world__card button")].find((b) => b.textContent?.trim() === text);
const cardText = () => host.querySelector(".path-world__card")?.textContent ?? "";

describe("The Journey of Life on the page (D-268)", () => {
  it("helpers: offsets run past −n…−1, future +1…, sketched after; a new era starts after the last one", () => {
    const h = journey();
    const eras = pathEras(h, TODAY);
    expect(eras.map((e) => e.state)).toEqual(["past", "current", "future", "sketched"]);
    const offsets = eraOffsets(eras);
    expect(eras.map((e) => offsets.get(e.id) ?? null)).toEqual([-1, null, 1, 2]);
    const draft = newEraDraft(eras, "2026-09");
    expect(draft.order).toBe(5);
    expect(draft.from).toBe("2031-01");
    expect(draft.home).toBe("porch");
    expect(draft.finish).toEqual({ kind: "agree" });
  });

  it("frames the Sky journey clear of the page's controls", async () => {
    const { eraSkyFrame: frame, eraRingSpot: spot, eraSkyTheta: turn, ERA_FUTURE_RADIUS: R, ERA_SKY_MAX: MAX } = await vi.importActual<typeof import("../src/path/world/pathWorld3d.ts")>("../src/path/world/pathWorld3d.ts");
    const islands = [{ x: 0, z: 0, r: 40, y: 0 }, ...[-2, -1, 1, 2, 3].map((k) => { const s = spot(k); return { x: Math.cos(s.a) * s.r, z: Math.sin(s.a) * s.r, r: k < 0 ? 12 : R, y: 22 }; })];
    const aspect = 1100 / 577, theta = turn(aspect);
    const open = frame(islands, aspect, theta);
    const covered = frame(islands, aspect, theta, 0.95, { top: 0, right: 0.25, bottom: 0.23, left: 0 });
    // Less room: the camera stands further back, and the aim moves right so the journey sits left of the controls.
    expect(covered.r).toBeGreaterThan(open.r);
    expect(covered.r).toBeLessThanOrEqual(MAX);
    const right = { x: Math.cos(theta), z: -Math.sin(theta) };
    expect((covered.tx - open.tx) * right.x + (covered.tz - open.tz) * right.z).toBeGreaterThan(0);
    // A phone with bands top and bottom still frames every island within the bound.
    const phone = frame(islands, 366 / 575, turn(366 / 575), 0.95, { top: 0.21, right: 0, bottom: 0.2, left: 0 });
    expect(phone.r).toBeLessThanOrEqual(MAX);
  });

  it("grows the main island from the current era only, and floats the other eras with marks, cards and outline entries", async () => {
    created.mode = "fake";
    const h = journey();
    await act(async () => root.render(createElement(Harness, { initial: h })));
    await settle();
    // Game mode (D-285): the world is built when the open world is first opened.
    expect(created.worlds).toHaveLength(0);
    await click(byText("Open the world"));
    const world = await waitForWorld();
    const input = world.setScene!.mock.calls.at(-1)![0] as { characters: unknown[]; eras: { id: string; state: string; offset: number; island: unknown; focused: boolean; plans: { sketched: boolean }[] }[]; home: string; gate: { lanterns: boolean[]; open: boolean; crossing: boolean } };
    // The current era began when the bridge was crossed in July: July, August, September.
    expect(input.characters).toHaveLength(3);
    expect(pathMonths(h, TODAY).length).toBeGreaterThan(3);
    expect($<HTMLInputElement>(".path-world__slider input").max).toBe("2");
    expect(host.querySelectorAll(".path-world__ticks li")).toHaveLength(3);
    expect(input.home).toBe("furnished");
    expect(input.gate).toEqual({ lanterns: [true], open: true, crossing: false });
    expect(input.eras.map((e) => [e.state, e.offset, e.focused])).toEqual([["past", -1, false], ["future", 1, false], ["sketched", 2, false]]);
    expect(input.eras[0]!.island).toBeTruthy();
    expect(input.eras[1]!.island).toBeNull();
    // The Chapter opened in April (the past era) still burns on this era's island, because it is still open.
    const fires = (world.setScene!.mock.calls.at(-1)![0] as { campfires: { month: number }[] }).campfires;
    expect(fires.every((f) => f.month >= 0)).toBe(true);

    const marks = [...host.querySelectorAll<HTMLButtonElement>(".path-mark")];
    const label = (id: string) => marks.find((m) => m.dataset.place === id)?.getAttribute("aria-label");
    const past = eraId(h, "Moving in"), future = eraId(h, "Our first house"), sketched = eraId(h, "Porch years");
    expect(label(`era:${past}`)).toBe("Moving in, Past · crossed Jul 2026");
    expect(label(`era:${future}`)).toBe("Our first house, Next era · foggy");
    expect(label(`era:${sketched}`)).toBe("Porch years, Suggested by Sam (fictional)");
    expect(label("era-gate")).toBe("The bridge to Our first house, Ready to cross");
    expect(label("era-home")).toBe("Our home · the flat, furnished, Making it ours");
    // No plan marks until an island is focused.
    expect(marks.some((m) => m.dataset.place?.includes(":plan:"))).toBe(false);

    // The outline lists the journey: eras with states, plans, the gate.
    const rows = outline();
    expect(rows).toContain("Moving in · Past · crossed Jul 2026");
    expect(rows).toContain("Our first house · Next era · foggy");
    expect(rows).toContain("The down payment · A Kitty Bank · 0 of 10 steps");
    expect(rows).toContain("The bridge to Our first house · Ready to cross");

    // Travel to the future island: its fog lifts, its plans get marks, and its card shows what is already planned.
    await click(byText("Take me to Our first house"));
    expect(world.focus).toHaveBeenLastCalledWith(`era:${future}`, 2);
    const focusedInput = world.setScene!.mock.calls.at(-1)![0] as typeof input;
    expect(focusedInput.eras.find((e) => e.id === future)!.focused).toBe(true);
    expect(host.querySelector(`.path-mark[data-place="era:${future}:plan:PLAN-DOWN"]`)).toBeTruthy();
    expect($(".path-world__card h3").textContent).toBe("Our first house");
    expect(cardText()).toContain("The next era");
    expect(cardText()).toContain("Starts Jul 2027");
    expect(cardText()).toContain("Home: a house");
    expect(cardText()).toContain("The down payment");
    // The plan's card opens its Kitty Bank.
    const opened: unknown[] = [];
    await act(async () => root.render(createElement(Harness, { initial: h, extra: { onOpenBank: (id: string) => opened.push(id) } })));
    await click(host.querySelector<HTMLButtonElement>(`.path-world__outline button[data-place="era:${future}:plan:PLAN-DOWN"]`)!);
    expect($(".path-world__card h3").textContent).toBe("The down payment");
    expect(cardText()).toContain("0 of 10 steps");
    await click(byText("Open this Kitty Bank"));
    const exitDeadline = Date.now() + 2_000;
    while (opened.length === 0 && Date.now() < exitDeadline) {
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 25)); });
    }
    expect(opened).toHaveLength(1);
    await click(byText("Back to the island"));

    // Back to where we are: the focus clears.
    await click(byText("Where we are"));
    expect((world.setScene!.mock.calls.at(-1)![0] as typeof input).eras.every((e) => !e.focused)).toBe(true);

    // The past era's card: months, crossing, what grew, and a Time Machine door at its first month.
    const doors: string[] = [];
    await act(async () => root.render(createElement(Harness, { initial: h, extra: { onOpenTimeMachine: (key: string) => doors.push(key) } })));
    await click(byText("Take me to Moving in"));
    expect($(".path-world__card .kicker").textContent).toBe("A past era");
    expect(cardText()).toContain("Mar 2026 – Jun 2026");
    expect(cardText()).toContain("Crossed Jul 2026");
    expect(cardText()).toContain("What grew");
    await click(byText("Open the books for March 2026"));
    expect(doors).toEqual(["2026-03"]);
  });

  it("offers Cross together only when the finish line is met, and crosses once both agree", async () => {
    // A survive-12-months era that started in July is not finished in September.
    await act(async () => root.render(createElement(Harness, { initial: journey({ currentFinish: { kind: "survive", months: 12 } }) })));
    await settle();
    await click(byText(/^Where we are: Making it ours/));
    expect($(".path-world__card .kicker").textContent).toBe("The era we are in");
    expect(cardText()).toContain("months through without going broke");
    expect(cardText()).toContain("By Jun 2027");
    expect(byText("Cross together")).toBeUndefined();
    await click(byText(/^The bridge ·/));
    expect(cardText()).toMatch(/Unlit · Month \d+ to \d+ · still ahead/);
    expect(byText("Cross together")).toBeUndefined();
    await act(async () => root.unmount());
    root = createRoot(host);

    await act(async () => root.render(createElement(Harness, { initial: journey() })));
    await settle();
    await click(byText(/^Where we are: Making it ours/));
    await click(byText("Cross together"));
    expect(host.querySelector(".path-world__notice")!.textContent).toBe("Suggested. The bridge is built once you both agree.");
    const h1 = household();
    expect(currentPathEra(h1, TODAY)!.pending?.crossedOn).toBe("2026-09");
    expect(cardText()).toContain("Alex (fictional) agreed to cross the bridge.");
    expect(inCard("Agree")).toBeUndefined();
    expect(inCard("Withdraw")).toBeTruthy();
    // The waiting panel reads it in words.
    expect($(".path-world__proposals").textContent).toContain("Alex (fictional) suggested crossing out of “Making it ours”");
    // Sam agrees: the era is behind us, and the next island is the one that grows.
    await click($("#switch"));
    await click(byText(/^Where we are: Making it ours/));
    await click(inCard("Agree")!);
    const h2 = household();
    expect(pathEras(h2, TODAY).map((e) => [e.spec.name, e.state])).toEqual([["Moving in", "past"], ["Making it ours", "past"], ["Our first house", "current"], ["Porch years", "sketched"]]);
    expect(byText(/^Where we are: Our first house/)).toBeTruthy();
  });

  it("saves a new era from the planner as one pending suggestion, and shows pencil plans as suggested", async () => {
    let h = journey();
    // Sam pencils a plan into the future era (only Sam has agreed so far).
    h = proposePathEraPlan(h, { memberId: PARTNER, rowId: eraId(h, "Our first house"), plan: { id: "PLAN-KEYS", kind: "milestone", label: "Get the keys", goalId: null, month: "2027-09" }, at: AT }).household;
    await act(async () => root.render(createElement(Harness, { initial: h })));
    await settle();
    expect(outline()).toContain("Get the keys · A milestone · suggested by Sam (fictional)");
    expect($(".path-world__proposals").textContent).toContain("Sam (fictional) suggested a plan “Get the keys” in “Our first house”");
    expect($(".path-world__proposals").textContent).toContain("Sam (fictional) suggested the era “Porch years”");
    await click(host.querySelector<HTMLButtonElement>('.path-world__outline button[data-place$=":plan:PLAN-KEYS"]')!);
    expect(cardText()).toContain("Suggested by Sam (fictional). Part of the plan once you both agree.");

    // Plan our journey → Add an era. Nothing is sent until Save.
    await click(byText("Plan our journey"));
    expect($(".path-planner h3").textContent).toBe("Plan our journey");
    expect(document.activeElement).toBe($(".path-planner h3"));
    expect([...host.querySelectorAll(".path-planner__era strong")].map((n) => n.textContent)).toEqual(["Moving in", "Making it ours", "Our first house", "Porch years"]);
    await click(byText("Add an era"));
    const name = $<HTMLInputElement>("#path-era-new-name");
    expect($<HTMLInputElement>("#path-era-new-from").value).toBe("2031-01");
    await type(name, "Saving $5000 for a cabin 2032");
    await type($<HTMLInputElement>("#path-era-new-line"), "When the cabin is ours");
    await type($<HTMLSelectElement>("#path-era-new-home"), "cabin");
    await type($<HTMLSelectElement>("#path-era-new-finish"), "banks");
    await click($<HTMLInputElement>('.path-planner__banks input[type="checkbox"]'));
    await type($<HTMLInputElement>("#path-era-new-plan-label"), "A first night by the lake");
    await click(byText("Add this plan"));
    expect(host.querySelector(".path-planner__plans li")!.textContent).toContain("A first night by the lake");
    // Nothing was sent while drafting: still only the two suggestions from before.
    expect(pendingPathProposals(h).filter((r) => r.kind === "era")).toHaveLength(2);
    expect(household()).toBeUndefined();
    await click(byText("Suggest this era"));
    expect(host.querySelector(".path-world__notice")!.textContent).toBe("Suggested. It becomes part of the journey once you both agree.");
    const after = household();
    const added = pathEras(after, TODAY).find((e) => e.state === "sketched" && e.spec.home === "cabin")!;
    // Words only: the amount and the year never reach the journey.
    expect(added.spec.name).toBe("Saving for a cabin");
    expect(added.spec.finish.kind).toBe("banks");
    expect(added.plans.map((p) => [p.label, p.sketched])).toEqual([["A first night by the lake", true]]);
    expect($(".path-planner h3").textContent).toBe("Plan our journey");
    expect($(".path-world__proposals").textContent).toContain("Alex (fictional) suggested the era “Saving for a cabin”");

    // No era mark or outline row carries an amount.
    const eraText = [...host.querySelectorAll('.path-mark[data-place^="era"], .path-world__outline-journey button, .path-journey button')].map((b) => `${b.getAttribute("aria-label") ?? ""} ${b.textContent}`).join(" ");
    expect(eraText).not.toMatch(/\$|5000/);
    for (const row of [...host.querySelectorAll('.path-mark[data-place^="era:"]')]) expect(row.querySelector(".path-mark__label")!.textContent).not.toMatch(/\d/);

    // An era with a waiting suggestion can't be planned further until it is agreed or set aside.
    await click(byLabel("Plan Our first house"));
    expect($(".path-planner__waiting").textContent).toContain("Sam (fictional) suggested a plan “Get the keys” in “Our first house”. Agree to it or set it aside");
    expect($<HTMLFieldSetElement>(".path-planner__fields").disabled).toBe(true);
    expect(inPlanner("Suggest these changes").disabled).toBe(true);
    await click(inPlanner("Agree"));
    expect(pathEras(household(), TODAY).find((e) => e.spec.name === "Our first house")!.plans.map((p) => [p.label, p.sketched])).toEqual([["The down payment", false], ["Get the keys", false]]);
    expect($<HTMLFieldSetElement>(".path-planner__fields").disabled).toBe(false);

    // One plan removed and saved reads as that plan.
    await click(byLabel("Remove The down payment"));
    await click(byText("Suggest these changes"));
    expect($(".path-world__proposals").textContent).toContain("Alex (fictional) suggested taking the plan “The down payment” off “Our first house”");

    // A rule the journey keeps shows as words: a past era keeps its months.
    await click(byLabel("Plan Moving in"));
    expect($<HTMLInputElement>(`#path-era-${eraId(h, "Moving in")}-from`).disabled).toBe(true);
    await click(byText("Close the planner"));
    expect(host.querySelector(".path-planner")).toBeNull();
  });

  it("opens the planner from the tent and from a card, and shows a planner-only journey without WebGL", async () => {
    await act(async () => root.render(createElement(Harness, { initial: base() })));
    await settle();
    // No journey yet: the island is exactly today's (whole history), and the panel invites a first era.
    expect(host.querySelectorAll(".path-world__ticks li")).toHaveLength(pathMonths(base(), TODAY).length);
    expect($(".path-world__journey").textContent).toContain("Plan as much or as little as you want");
    await click(byText("Open the Plan Studio tent"));
    const inTent = [...host.querySelectorAll<HTMLButtonElement>(".path-world__room button")].find((b) => b.textContent === "Plan our journey")!;
    await click(inTent);
    expect($(".path-world__island").hidden).toBe(false);
    expect($(".path-planner")).toBeTruthy();
    await click(byText("Add an era"));
    await type($<HTMLInputElement>("#path-era-new-name"), "Moving in");
    expect($<HTMLInputElement>("#path-era-new-from").value).toBe("2026-09");
    await type($<HTMLSelectElement>("#path-era-new-finish"), "survive");
    await type($<HTMLInputElement>("#path-era-new-months"), "12");
    await click(byText("Suggest this era"));
    let h = household();
    expect(pathEras(h, TODAY).map((e) => [e.spec.name, e.state, e.spec.finish])).toEqual([["Moving in", "sketched", { kind: "survive", months: 12 }]]);
    // Sam agrees from the waiting panel; now there is a current era and the island is its window.
    await click($("#switch"));
    await click(byText("Agree"));
    h = household();
    expect(currentPathEra(h, TODAY)!.spec.name).toBe("Moving in");
    expect(host.querySelectorAll(".path-world__ticks li")).toHaveLength(1);
    // The flat map (no WebGL) grows from the same era window and carries the era's name.
    expect($(".path-world__flat svg").dataset.months).toBe("1");
    expect($(".path-world__flat svg").dataset.era).toBe("Moving in");
    await click(byText(/^Where we are: Moving in/));
    await click(byText("Plan this era"));
    expect($(".path-planner h3").textContent).toBe("Plan “Moving in”");
    expect($<HTMLInputElement>(`#path-era-${currentPathEra(h, TODAY)!.id}-from`).disabled).toBe(true);
  });
});

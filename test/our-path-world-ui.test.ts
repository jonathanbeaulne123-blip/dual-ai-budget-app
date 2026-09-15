// @vitest-environment jsdom
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addGoal, offerMove, openChapter, postEntry, recordRitualHeld, type CommitResult, type Household } from "../src/core/index.ts";
import { movesForChapter, openChapterFor, respondToMove } from "../src/core/chapters.ts";
import { pathIslandName } from "../src/core/pathWorld.ts";
import { OurPathWorld } from "../src/path/OurPathWorld.tsx";
import { planLifeFixture } from "./fixtures/plan-life.ts";
import { kittyBankBackingStep } from "../src/core/kittyBanks.ts";
import { newKittyPiece } from "../src/core/kittyStudio.ts";
import { pathMonths } from "../src/core/pathSignals.ts";
import type { Goal, KittyStudioV1 } from "../src/core/types.ts";
import { pathMonthAsOf } from "../src/path/landmarks.ts";
import { acknowledgeHouseholdPlan, appendPlanSitdownTurn, closeBooksMonth, foundHouseholdCharter, signHouseholdCharter } from "../src/core/commands.ts";
import { addRecurrence, setHouseholdFundMonthPlan, stampWeeklyDocument } from "../src/core/index.ts";
import { pathWeather } from "../src/core/pathWeather.ts";
import { pathStones } from "../src/core/pathStones.ts";
import { completeTask, saveTask, type TaskInput } from "../src/core/tasks.ts";

// jsdom has no WebGL: by default the world fails to load and the page must stay fully usable.
// The "fake" variant hands back a stand-in world so the page's calls into it can be counted.
type FakeWorld = Record<"setScene" | "resize" | "setAmbient" | "setQuality" | "sleep" | "wake" | "refresh" | "focus" | "setLevel" | "zoom" | "turn" | "stats" | "dispose", ReturnType<typeof vi.fn>>;
const created = vi.hoisted(() => ({ count: 0, mode: "throw" as "throw" | "fake", options: [] as { quality?: string }[], worlds: [] as unknown[] }));
vi.mock("../src/path/world/pathWorld3d.ts", () => ({
  createPathWorld: (_host: HTMLElement, options: { quality?: string }) => {
    created.count += 1;
    if (created.mode === "throw") throw new Error("WebGL unavailable");
    created.options.push(options);
    const names = ["setScene", "resize", "setAmbient", "setQuality", "sleep", "wake", "refresh", "focus", "setLevel", "zoom", "turn", "stats", "dispose"];
    const world = Object.fromEntries(names.map((n) => [n, vi.fn()]));
    created.worlds.push(world);
    return world;
  },
}));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement, root: Root;
beforeEach(() => { localStorage.clear(); Object.assign(created, { count: 0, mode: "throw", options: [], worlds: [] }); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); localStorage.clear(); });

function seeded(): Household {
  let h = planLifeFixture("household");
  h = openChapter(h, { memberId: "MEM-001", foundationId: "make-rent-boring", at: "2026-07-01T12:00:00.000Z" }).household;
  h = recordRitualHeld(h, { memberId: "MEM-001", ritualId: h.rituals![0]!.id, onDate: "2026-08-04" }).household;
  const opening = movesForChapter(h, openChapterFor(h)!.id)[0]!;
  h = respondToMove(h, { memberId: "MEM-001", moveId: opening.id, response: "decline" }).household;
  h = offerMove(h, { memberId: "MEM-002", chapterId: openChapterFor(h)!.id, text: "Fictional: check the pre-rent payday", needsAcknowledgment: true }).household;
  h = addGoal(h, { name: "Fictional trip to the shore", target: "2000", shared: true, ownerMemberId: "MEM-001" }).household;
  h = postEntry(h, { type: "expense", date: "2026-08-12", amount: "80", accountId: "ACC-VISA", subcategoryId: "SUB-LIFE-FUN", note: "Fictional concert", createdBy: "MEM-001", visibility: "household", confirmDuplicate: true }).household;
  return h;
}

function Harness({ initial, today }: { initial: Household; today: string }) {
  const [household, setHousehold] = useState(initial);
  const [member, setMember] = useState("MEM-001");
  const onCommand = async (fn: (h: Household) => CommitResult) => {
    const result = fn(household);
    setHousehold(result.household);
    (window as unknown as { __household: Household }).__household = result.household;
    return { ok: true, household: result.household };
  };
  return createElement("div", null,
    createElement("button", { id: "switch", onClick: () => setMember(member === "MEM-001" ? "MEM-002" : "MEM-001") }, "switch"),
    createElement(OurPathWorld, {
      household, memberId: member, today, busy: false, onCommand, theme: "taylor",
      classicRoom: createElement("div", { id: "classic" }, createElement("input", { id: "draft", defaultValue: "" })),
    }));
}

const $ = <T extends HTMLElement = HTMLElement>(selector: string) => host.querySelector<T>(selector)!;
const byText = (text: string | RegExp) => [...host.querySelectorAll<HTMLButtonElement>("button")].find((b) => (typeof text === "string" ? b.textContent?.trim() === text : text.test(b.textContent ?? "")))!;
const click = async (element: HTMLElement) => act(async () => { element.click(); });
const scrub = async (slider: HTMLInputElement, value: number) => act(async () => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(slider, String(value));
  slider.dispatchEvent(new Event("input", { bubbles: true }));
});
const settle = async () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

describe("Our Path world page (D-262)", () => {
  it("keeps every place reachable without WebGL, and the tent keeps today's Our Path mounted", async () => {
    await act(async () => root.render(createElement(Harness, { initial: seeded(), today: "2026-09-15" })));
    await settle();
    expect(created.count).toBe(1);
    expect($("h2").textContent).toBe("Where we are going");
    expect($(".path-world__flat svg")).toBeTruthy();
    expect($(".path-world__marks").hidden).toBe(true);
    expect(host.querySelectorAll(".path-world__flat circle").length).toBeGreaterThanOrEqual(3);
    const outline = [...host.querySelectorAll(".path-world__outline button")].map((b) => b.textContent);
    expect(outline).toContain("Make Rent Boring · this Chapter");
    expect(outline).toContain("Fictional trip to the shore · 0 of 10 steps");
    expect(outline.some((t) => t?.startsWith("We are here"))).toBe(true);

    // The month card grows with the lantern.
    await click(byText(/^We are here/));
    expect($(".path-world__card h3").textContent).toBe("This month, so far");
    const warmLines = host.querySelectorAll(".path-world__card li").length;
    await click(byText("Bright"));
    expect(host.querySelectorAll(".path-world__card li").length).toBeGreaterThan(warmLines);
    expect(localStorage.getItem("hearth:pathWorld:lantern")).toBe("2");
    await click(byText("Dim"));
    expect($(".path-world__card").textContent).toContain("Turn the lantern up for more.");

    // The next Move needs both acknowledgments before it can be done (the proposer's is already there).
    await click(byText("Warm"));
    await click(byText(/^Next Move/));
    expect($(".path-world__card h3").textContent).toBe("Fictional: check the pre-rent payday");
    expect($(".path-world__card").textContent).toContain("Acknowledged by 1 of 2");
    expect(byText("Mark done").disabled).toBe(true);
    await click(byText("Acknowledge"));
    expect(byText("Mark done").disabled).toBe(false);
    expect(byText("Acknowledge")).toBeUndefined();

    // Into the tent and back: the classic page never unmounts, so a draft survives.
    const draft = $<HTMLInputElement>("#draft");
    draft.value = "half-typed";
    await click(byText("Open the Plan Studio tent"));
    expect($(".path-world__island").hidden).toBe(true);
    expect($(".path-world__room").hidden).toBe(false);
    await click(byText("Back to the island"));
    expect($<HTMLInputElement>("#draft").value).toBe("half-typed");
    expect($(".path-world__island").hidden).toBe(false);
    // The tent round trip never tries to build a second world.
    await settle();
    expect(created.count).toBe(1);
    // Without a world there is nothing to tune, so no quality toggle.
    expect(host.querySelector(".path-world__quality")).toBeNull();
  });

  it("puts one world to sleep in the tent and wakes it on return, and keeps the quality choice on this device", async () => {
    created.mode = "fake";
    localStorage.setItem("hearth:pathWorld:quality", "full");
    await act(async () => root.render(createElement(Harness, { initial: seeded(), today: "2026-09-15" })));
    await settle();
    expect(created.count).toBe(1);
    expect(created.options[0]!.quality).toBe("full");
    const world = created.worlds[0] as FakeWorld;
    expect($(".path-world__marks").hidden).toBe(false);
    expect(world.sleep).not.toHaveBeenCalled();

    const draft = $<HTMLInputElement>("#draft");
    draft.value = "still here";
    await click(byText("Open the Plan Studio tent"));
    expect(world.sleep).toHaveBeenCalledTimes(1);
    expect(world.dispose).not.toHaveBeenCalled();
    const wakesBefore = world.wake.mock.calls.length;
    await click(byText("Back to the island"));
    await settle();
    expect(world.wake.mock.calls.length).toBe(wakesBefore + 1);
    expect(world.sleep).toHaveBeenCalledTimes(1);
    expect(world.dispose).not.toHaveBeenCalled();
    expect(created.count).toBe(1);
    expect($<HTMLInputElement>("#draft").value).toBe("still here");

    // Quality: Full / Lite, pressed state, remembered per device, handed to the live world.
    const group = $(".path-world__quality");
    expect(group.getAttribute("role")).toBe("group");
    expect(byText("Full").getAttribute("aria-pressed")).toBe("true");
    await click(byText("Lite"));
    expect(byText("Lite").getAttribute("aria-pressed")).toBe("true");
    expect(byText("Full").getAttribute("aria-pressed")).toBe("false");
    expect(localStorage.getItem("hearth:pathWorld:quality")).toBe("lite");
    expect(world.setQuality).toHaveBeenLastCalledWith("lite");
    expect(created.count).toBe(1);

    // A fresh mount on this device starts on the remembered tier.
    await act(async () => root.unmount());
    expect(world.dispose).toHaveBeenCalledTimes(1);
    root = createRoot(host);
    await act(async () => root.render(createElement(Harness, { initial: seeded(), today: "2026-09-15" })));
    await settle();
    expect(created.count).toBe(2);
    expect(created.options[1]!.quality).toBe("lite");
    expect(byText("Lite").getAttribute("aria-pressed")).toBe("true");
  });

  it("opens straight into the tent with the world asleep", async () => {
    created.mode = "fake";
    await act(async () => root.render(createElement(OurPathWorld, { household: seeded(), memberId: "MEM-001", today: "2026-09-15", busy: false, onCommand: async () => ({ ok: true }), theme: "newfoundland", classicRoom: createElement("p", null, "today"), openTentFor: { kind: "goal", id: "G" } })));
    await settle();
    const world = created.worlds[0] as FakeWorld;
    expect($(".path-world__room").hidden).toBe(false);
    expect(world.sleep).toHaveBeenCalled();
    await click(byText("Back to the island"));
    expect(world.wake).toHaveBeenCalledTimes(1);
    expect(created.count).toBe(1);
  });

  it("opens the tent when a Hercules source link arrives, and moves focus with the tent", async () => {
    const focus = { kind: "goal", id: "G" };
    await act(async () => root.render(createElement(OurPathWorld, { household: seeded(), memberId: "MEM-001", today: "2026-09-15", busy: false, onCommand: async () => ({ ok: true }), theme: "classic", classicRoom: createElement("p", { id: "classic" }, "today"), openTentFor: focus })));
    await settle();
    expect($(".path-world__room").hidden).toBe(false);
    await click(byText("Back to the island"));
    expect(document.activeElement?.textContent).toBe("Open the Plan Studio tent");
    await click(byText("Open the Plan Studio tent"));
    expect(document.activeElement?.textContent).toBe("Back to the island");
  });

  it("names the island only when both people agree", async () => {
    await act(async () => root.render(createElement(Harness, { initial: seeded(), today: "2026-09-15" })));
    await settle();
    await click(byText("Name our island together"));
    const input = $<HTMLInputElement>("#path-world-name");
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(input, "Little Harbour");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await click(byText("Suggest this name"));
    expect($("h2").textContent).toBe("Where we are going");
    expect($(".path-world__proposals").textContent).toContain("Call the island “Little Harbour”");
    expect([...host.querySelectorAll(".path-world__proposals button")].map((b) => b.textContent)).toEqual(["Withdraw"]);
    await click($("#switch"));
    await click(byText("I agree"));
    expect($("h2").textContent).toBe("Little Harbour");
    expect(host.querySelector(".path-world__proposals")).toBeNull();
    expect(pathIslandName((window as unknown as { __household: Household }).__household)).toBe("Little Harbour");
  });

  it("lets a person fix a category guess and suggest a recipe change for both to agree", async () => {
    await act(async () => root.render(createElement(Harness, { initial: seeded(), today: "2026-09-15" })));
    await settle();
    const fun = $<HTMLSelectElement>("#path-cat-SUB-LIFE-FUN");
    expect(fun.value).toBe("joy");
    await act(async () => { fun.value = "celebration"; fun.dispatchEvent(new Event("change", { bubbles: true })); });
    expect($<HTMLSelectElement>("#path-cat-SUB-LIFE-FUN").value).toBe("celebration");

    const toggle = $<HTMLInputElement>("#path-recipe-joy-on");
    await act(async () => { toggle.click(); });
    await click(byText("Suggest this change"));
    expect($(".path-world__proposals").textContent).toContain("Good months bloom");
    expect($(".path-recipe").textContent).toContain("a change is waiting");
  });

  it("draws the two of us at the current month without WebGL, and they move when the months are scrubbed", async () => {
    await act(async () => root.render(createElement(Harness, { initial: seeded(), today: "2026-09-15" })));
    await settle();
    const us = () => host.querySelector(".path-world__flat .path-world__us")!;
    expect(us()).toBeTruthy();
    expect(us().querySelectorAll("circle").length).toBe(2);
    expect(us().querySelectorAll("line").length).toBe(1);
    const slider = $<HTMLInputElement>(".path-world__slider input");
    const last = Number(slider.max);
    expect(last).toBeGreaterThanOrEqual(2);
    const at = () => us().getAttribute("transform");
    const spotOf = (dot: Element) => `translate(${Number(dot.getAttribute("cx")).toFixed(2)} ${Number(dot.getAttribute("cy")).toFixed(2)})`;
    const dots = () => [...host.querySelectorAll(".path-world__flat .path-world__dot")];
    // At "now" the glyph stands on the current (newest) month dot.
    expect(at()).toBe(spotOf(dots().at(-1)!));
    const before = at();
    await scrub(slider, 0);
    expect(at()).not.toBe(before);
    expect(at()).toBe(spotOf(dots()[0]!));
    await scrub(slider, last);
    expect(at()).toBe(before);

    // The newest month's card says they walked here together (Warm and up), with no numbers.
    await click(byText(/^We are here/));
    expect($(".path-world__card h3").textContent).toBe("This month, so far");
    expect($(".path-world__card").textContent).toContain("You walked here together.");
    await click(byText("Dim"));
    expect($(".path-world__card").textContent).not.toContain("You walked here together.");
    await click(byText("Warm"));
    // An earlier month does not claim it.
    await scrub(slider, 0);
    await click([...host.querySelectorAll<HTMLButtonElement>(".path-world__outline button")].find((b) => b.textContent?.includes("·"))!);
    expect($(".path-world__card h3").textContent).not.toBe("This month, so far");
    expect($(".path-world__card").textContent).not.toContain("You walked here together.");
  });

  it("hands the live world each new month so the walkers can walk there", async () => {
    created.mode = "fake";
    await act(async () => root.render(createElement(Harness, { initial: seeded(), today: "2026-09-15" })));
    await settle();
    const world = created.worlds[0] as FakeWorld;
    const slider = $<HTMLInputElement>(".path-world__slider input");
    const last = Number(slider.max);
    const lastScene = () => world.setScene.mock.calls.at(-1)![0] as { island: { cur: number } };
    expect(lastScene().island.cur).toBe(last);
    await scrub(slider, last - 2);
    expect(lastScene().island.cur).toBe(last - 2);
    await scrub(slider, last - 1);
    expect(lastScene().island.cur).toBe(last - 1);
    // "Where we are" returns to now and travels to the walkers.
    await click(byText("Where we are"));
    await settle();
    expect(lastScene().island.cur).toBe(last);
    expect(world.focus).toHaveBeenLastCalledWith("now", 2);
  });

  it("opens a landmark's own Kitty Bank in the tent, and never moves money from the island", async () => {
    const opened: string[] = [];
    const tent: boolean[] = [];
    const h = seeded();
    const trip = h.goals.find((g) => g.name === "Fictional trip to the shore")!;
    let commands = 0;
    await act(async () => root.render(createElement(OurPathWorld, { household: h, memberId: "MEM-001", today: "2026-09-15", busy: false, onCommand: async () => { commands += 1; return { ok: true }; }, theme: "classic", onOpenBank: (id: string) => opened.push(id), onTentChange: (open: boolean) => tent.push(open), classicRoom: createElement("input", { id: "draft" }) })));
    await settle();
    await click([...host.querySelectorAll<HTMLButtonElement>(".path-world__outline button")].find((b) => b.textContent?.startsWith("Fictional trip to the shore"))!);
    expect($(".path-world__card h3").textContent).toBe("Fictional trip to the shore");
    expect(byText("Open Kitty Banks")).toBeUndefined();
    $<HTMLInputElement>("#draft").value = "kept";
    await click(byText("Open this Kitty Bank"));
    expect(opened).toEqual([trip.id]);
    expect($(".path-world__room").hidden).toBe(false);
    expect(tent).toEqual([true]);
    await click(byText("Back to the island"));
    expect(tent).toEqual([true, false]);
    expect($<HTMLInputElement>("#draft").value).toBe("kept");
    expect(commands).toBe(0);
  });

  it("stands a kiln beside the landmarks once a shared bank exists, warm only after a recent firing", async () => {
    const outline = () => [...host.querySelectorAll(".path-world__outline button")].map((b) => b.textContent ?? "");
    const none = { ...seeded(), goals: [] };
    await act(async () => root.render(createElement(OurPathWorld, { household: none, memberId: "MEM-001", today: "2026-09-15", busy: false, onCommand: async () => ({ ok: true }), theme: "classic", classicRoom: null })));
    await settle();
    expect(outline().some((t) => t.startsWith("The kiln"))).toBe(false);

    const h = seeded();
    const trip = h.goals.find((g) => g.name === "Fictional trip to the shore")!;
    const piece = (firedAt: string | null) => ({ ...newKittyPiece("PIECE-FICTIONAL", "2026-09-01T12:00:00.000Z"), firedAt });
    const withStudio = (studio: KittyStudioV1 | undefined): Household => ({ ...h, goals: h.goals.map((g) => (g.id === trip.id ? { ...g, envelope: { ...(g.envelope ?? {}), studio } as Goal["envelope"] } : g)) });
    const opened: string[] = [];
    const show = async (household: Household) => act(async () => root.render(createElement(OurPathWorld, { household, memberId: "MEM-001", today: "2026-09-15", busy: false, onCommand: async () => ({ ok: true }), theme: "classic", onOpenBank: (id: string) => opened.push(id), classicRoom: null })));
    const openCard = async (prefix: string) => click([...host.querySelectorAll<HTMLButtonElement>(".path-world__outline button")].find((b) => b.textContent?.startsWith(prefix))!);

    await show(withStudio(undefined));
    await settle();
    expect(outline()).toContain("The kiln · cold");
    await openCard("Fictional trip to the shore");
    expect($(".path-world__card").textContent).toContain("Not sculpted yet. Open the studio to make it.");

    await show(withStudio({ version: 1, draft: piece(null), fired: [] }));
    expect($(".path-world__card").textContent).toContain("Still bisque — not fired yet.");
    expect(outline()).toContain("The kiln · cold");

    await show(withStudio({ version: 1, draft: null, fired: [piece("2026-09-10T15:00:00.000Z")] }));
    expect($(".path-world__card").textContent).toContain("Fired on September 10, 2026.");
    expect($(".path-world__card").textContent).not.toMatch(/\$/);
    expect(outline()).toContain("The kiln · warm");
    await openCard("The kiln");
    expect($(".path-world__card").textContent).toContain("Banks are fired here. A fired bank keeps its glaze.");
    await click(byText("Open the studio"));
    expect(opened).toEqual([trip.id]);

    // A firing more than a month old leaves the kiln cold.
    await show(withStudio({ version: 1, draft: null, fired: [piece("2026-07-01T15:00:00.000Z")] }));
    expect(outline()).toContain("The kiln · cold");
  });

  it("hands the world each bank's step as of the shown month, so Replay shows the banks growing", async () => {
    created.mode = "fake";
    const h = seeded();
    await act(async () => root.render(createElement(OurPathWorld, { household: h, memberId: "MEM-001", today: "2026-09-15", busy: false, onCommand: async () => ({ ok: true }), theme: "taylor", classicRoom: null })));
    await settle();
    const world = created.worlds[0] as FakeWorld;
    const scene = () => world.setScene.mock.calls.at(-1)![0] as { goals: { id: string; step: number }[]; kiln?: { warm: boolean } | null };
    const reserve = h.goals.find((g) => g.name === "Fictional seasonal reserve")!;
    const stepOf = () => scene().goals.find((g) => g.id === `goal:${reserve.id}`)!.step;
    expect(stepOf()).toBe(kittyBankBackingStep(h, reserve, "2026-09-15"));
    expect(scene().kiln).toEqual({ warm: false });
    const months = pathMonths(h, "2026-09-15");
    const slider = $<HTMLInputElement>(".path-world__slider input");
    const past = months.length - 2;
    await scrub(slider, past);
    const monthEnd = pathMonthAsOf(months[past]!.key, "2026-09-15");
    expect(monthEnd).toMatch(/^\d{4}-\d{2}-(28|29|30|31)$/);
    expect(stepOf()).toBe(kittyBankBackingStep(h, reserve, monthEnd));
    expect(stepOf()).not.toBe(kittyBankBackingStep(h, reserve, "2026-09-15"));
    const outlineSub = [...host.querySelectorAll(".path-world__outline button")].map((b) => b.textContent ?? "").find((t) => t.startsWith("Fictional seasonal reserve"));
    expect(outlineSub).toBe(`Fictional seasonal reserve · ${stepOf()} of 10 steps`);
  });

  describe("Together on the island", () => {
    const outline = () => [...host.querySelectorAll<HTMLButtonElement>(".path-world__outline button")];
    const openFromOutline = async (prefix: string) => click(outline().find((b) => b.textContent?.startsWith(prefix))!);
    const withCharter = (h: Household) => foundHouseholdCharter(h, {
      memberId: "MEM-001", custodianMemberId: "MEM-001", purpose: "Keep $1,200.50 of calm between us and 3 paydays without overwork, and talk before any big change to the home.",
      splitRule: "remainder", splitNote: "Fictional split note.", ceilingKind: "hours-per-week", ceilingValue: "24", cadence: "weekly", cadenceWeekday: 0,
      clauses: [{ heading: "Bills", body: "Fictional: the Fund covers agreed bills." }], date: "2026-09-01",
    }).household;
    const accepted = (h: Household) => {
      const version = h.planVersions!.find((row) => row.scope === "household" && row.state === "proposed")!;
      for (const actor of ["MEM-001", "MEM-002"]) h = acknowledgeHouseholdPlan(h, { memberId: actor, createdBy: actor, planVersionId: version.id, expectedDigest: version.digest }).household;
      return { household: h, version: h.planVersions!.find((row) => row.id === version.id)! };
    };

    it("makes the open Chapter's campfire a door to Together, keeping the Chapter room as the second way in", async () => {
      const together: number[] = [];
      await act(async () => root.render(createElement(OurPathWorld, { household: seeded(), memberId: "MEM-001", today: "2026-09-15", busy: false, onCommand: async () => ({ ok: true }), theme: "classic", onOpenTogether: () => together.push(1), classicRoom: createElement("p", null, "today") })));
      await settle();
      await openFromOutline("Make Rent Boring");
      const actions = [...host.querySelectorAll<HTMLButtonElement>(".path-world__card .path-world__actions button")];
      expect(actions.map((b) => b.textContent)).toEqual(["Sit down together", "Open the Chapter room"]);
      expect(actions[0]!.className).toBe("primary");
      await click(actions[0]!);
      expect(together).toEqual([1]);
      expect($(".path-world__room").hidden).toBe(true);
      await click(byText("Open the Chapter room"));
      expect($(".path-world__room").hidden).toBe(false);
    });

    it("stands the Charter as a stone square: words only, waiting until both sign, and a link to read it", async () => {
      const charters: number[] = [];
      const show = async (household: Household) => act(async () => root.render(createElement(OurPathWorld, { household, memberId: "MEM-001", today: "2026-09-15", busy: false, onCommand: async () => ({ ok: true }), theme: "newfoundland", onOpenCharter: () => charters.push(1), classicRoom: null })));
      await show(seeded());
      await settle();
      expect(outline().some((b) => b.textContent?.startsWith("Our Charter"))).toBe(false);

      let h = withCharter(seeded());
      await show(h);
      expect(outline().map((b) => b.textContent)).toContain("Our Charter · waiting for 2");
      expect(host.querySelector(".path-world__flat .path-world__charter")).toBeTruthy();
      await openFromOutline("Our Charter");
      const card = () => $(".path-world__card").textContent ?? "";
      expect(card()).toContain("Keep of calm between us and paydays without overwork");
      expect($(".path-world__card li").textContent).not.toMatch(/\d/);
      expect(card()).not.toMatch(/\$/);
      expect(card()).toContain("Waiting for Alex (fictional) and Sam (fictional) to sign.");
      await click(byText("Read the Charter"));
      expect(charters).toEqual([1]);

      h = signHouseholdCharter(signHouseholdCharter(h, { memberId: "MEM-001" }).household, { memberId: "MEM-002" }).household;
      await show(h);
      expect(outline().map((b) => b.textContent)).toContain("Our Charter · signed");
      expect(card()).toContain("Signed by both of you.");
    });

    it("forks the path once per agreed decision, and each fork opens that agreement in the tent", async () => {
      created.mode = "fake";
      const { household, version } = accepted(seeded());
      const decisions = version.lines.filter((line) => line.decision?.nextStep);
      expect(decisions.length).toBe(2);
      const sources: unknown[] = [];
      const tent: boolean[] = [];
      let commands = 0;
      await act(async () => root.render(createElement(OurPathWorld, { household, memberId: "MEM-001", today: "2026-09-15", busy: false, onCommand: async () => { commands += 1; return { ok: true }; }, theme: "taylor", onOpenInTent: (source: unknown) => sources.push(source), onTentChange: (open: boolean) => tent.push(open), classicRoom: null })));
      await settle();
      const world = created.worlds[0] as FakeWorld;
      const scene = world.setScene.mock.calls.at(-1)![0] as { forks: { id: string }[] };
      expect(scene.forks.map((f) => f.id)).toEqual(decisions.map((line) => `fork:${line.id}`));
      for (const line of decisions) expect(outline().map((b) => b.textContent)).toContain(`${line.labelSnapshot} · Together`);
      const line = decisions[0]!;
      await openFromOutline(line.labelSnapshot);
      expect($(".path-world__card").textContent).toContain(line.decision!.nextStep!);
      expect($(".path-world__card").textContent).not.toMatch(/\$/);
      await click(byText("Read the agreement"));
      expect(sources).toEqual([{ route: "plan", view: "household", label: line.labelSnapshot, planVersionId: version.id, planLineId: line.id }]);
      expect($(".path-world__room").hidden).toBe(false);
      expect(tent).toEqual([true]);
      expect(commands).toBe(0);
    });

    it("tells the world who is here, whether the Sitdown is open, and which months are set land", async () => {
      created.mode = "fake";
      let h = seeded();
      h = appendPlanSitdownTurn(h, { sitDownSessionId: "SITDOWN-FICTIONAL", monthKey: "2026-09", planDraftId: "LIFE-DRAFT", memberId: "MEM-001", text: "Fictional: let's start." }).household;
      h = closeBooksMonth(h, { monthKey: "2026-08", createdBy: "MEM-001" }).household;
      const render = async (present: number) => act(async () => root.render(createElement(OurPathWorld, { household: h, memberId: "MEM-001", today: "2026-09-15", busy: false, onCommand: async () => ({ ok: true }), theme: "classic", presentMembers: present, onOpenTogether: () => {}, classicRoom: null })));
      await render(1);
      await settle();
      const world = created.worlds[0] as FakeWorld;
      type Scene = { presentMembers: number; campfires: { id: string; sitdown: string; lit: boolean }[]; land: { month: number; closed: boolean; stamps: number }[] };
      const scene = () => world.setScene.mock.calls.at(-1)![0] as Scene;
      expect(scene().presentMembers).toBe(1);
      const fire = scene().campfires.find((c) => c.id === `fire:${openChapterFor(h)!.id}`)!;
      expect(fire).toMatchObject({ sitdown: "open", lit: true });
      const months = pathMonths(h, "2026-09-15");
      const august = months.findIndex((m) => m.key === "2026-08");
      expect(scene().land).toContainEqual({ month: august, closed: true, stamps: 0, set: false });
      expect(outline().map((b) => b.textContent)).toContain("Make Rent Boring · this Chapter · Sitdown open");

      await render(2);
      expect(scene().presentMembers).toBe(2);
      await openFromOutline("Make Rent Boring");
      expect($(".path-world__card").textContent).toContain("You're both here.");
      expect($(".path-world__card").textContent).toContain("Your Sitdown is open. The fire is blazing.");

      // The August month card says why its land is permanent.
      await openFromOutline("Aug");
      expect($(".path-world__card").textContent).toContain("Books closed");
    });
  });

  describe("The Calendar as weather, tasks as stepping stones, and the little touches", () => {
    const TODAY = "2026-09-15";
    const outline = () => [...host.querySelectorAll<HTMLButtonElement>(".path-world__outline button")];
    const openFromOutline = async (prefix: string) => click(outline().find((b) => b.textContent?.startsWith(prefix))!);
    const cardText = () => $(".path-world__card").textContent ?? "";
    type Scene = { weather: { id: string; kind: string; weight: number; dayOffset: number }[]; sunlit: { fromOffset: number; toOffset: number }[]; stones: { id: string; month: number; state: string; lit: boolean; money: boolean; owner: boolean; backup: boolean }[] };
    const withPayClock = (h: Household): Household => ({
      ...h,
      members: h.members.map((row) => row.id === "MEM-001"
        ? { ...row, earningCadence: { cadence: "biweekly" as const, anchorDate: "2026-09-18", weekday: 5, monthDays: [], customDates: [], reminderTime: "09:00" } }
        : row),
    });
    const withInternet = (h: Household): Household => addRecurrence(h, {
      cadence: "monthly", nextDate: "2026-09-25", type: "expense", amount: "100", accountId: "ACC-VISA", subcategoryId: "SUB-HOUSING-ELECTRIC", note: "Fictional internet",
      fundingDefault: { fundId: h.householdFund!.id, fundedCents: "full", destinationAccountId: "ACC-VISA" },
    }).household;
    const render = async (household: Household, extra: Record<string, unknown> = {}) => act(async () => root.render(createElement(OurPathWorld, { household, memberId: "MEM-001", today: TODAY, busy: false, onCommand: async () => ({ ok: true }), theme: "classic", classicRoom: null, ...extra })));

    it("turns Calendar bills into clouds and a storm, paydays into sunrises, with links only and no amounts", async () => {
      created.mode = "fake";
      const h = withInternet(withPayClock(planLifeFixture("household")));
      const weather = pathWeather(h, TODAY);
      expect(weather.forecast).toBe("clear");
      const calendar: number[] = [], fund: number[] = [];
      let commands = 0;
      await render(h, { onOpenCalendar: () => calendar.push(1), onOpenFund: () => fund.push(1), onCommand: async () => { commands += 1; return { ok: true }; } });
      await settle();
      const world = created.worlds[0] as FakeWorld;
      const scene = () => world.setScene.mock.calls.at(-1)![0] as Scene;
      const bills = weather.days.filter((d) => d.kind === "cloud" || d.kind === "storm");
      expect(scene().weather.filter((w) => w.kind === "cloud" || w.kind === "storm")).toEqual(bills.map((d) => ({ id: `bill:${d.sourceId}`, kind: d.kind, weight: d.weight, dayOffset: d.date === "2026-09-20" ? 5 : 10 })));
      expect(scene().weather.filter((w) => w.kind === "sunrise").map((w) => w.dayOffset)).toEqual([3, 17]);
      expect(scene().weather.some((w) => w.kind === "mist")).toBe(false);
      expect(scene().sunlit).toEqual([{ fromOffset: 0, toOffset: 30 }]);

      const labels = outline().map((b) => b.textContent);
      expect(labels).toContain("Fictional rent · September 20");
      expect(labels).toContain("Fictional internet · September 25");
      expect(labels).toContain("Payday · September 18");
      expect(labels).toContain("Payday · October 2");
      expect(labels.some((t) => t?.startsWith("Forecast mist") || t?.startsWith("No forecast yet"))).toBe(false);
      for (const text of labels) expect(text ?? "").not.toMatch(/\$/);

      await openFromOutline("Fictional rent");
      expect($(".path-world__card h3").textContent).toBe("Fictional rent");
      expect(cardText()).toContain("Weather ahead · a storm");
      expect(cardText()).toContain("Rolling in September 20");
      expect(cardText()).toContain("Fictional rent is one of the heaviest things due in this stretch.");
      expect(cardText()).not.toMatch(/\$|1,?\d{3}/);
      await click(byText("Open the Calendar"));
      expect(calendar).toEqual([1]);
      await click(byText("Open the Fund"));
      expect(fund).toEqual([1]);

      // At Bright the mark's sub carries the reason too — still words only.
      await click(byText("Bright"));
      expect(outline().map((b) => b.textContent)).toContain("Fictional internet · September 25 · Fictional internet is due.");

      await openFromOutline("Payday");
      expect(cardText()).toContain("Payday on September 18. The light comes back.");
      expect(commands).toBe(0);
    });

    it("puts a signpost in the mist with the horizon's reasons, and says so when there is no forecast", async () => {
      created.mode = "fake";
      const misty = setHouseholdFundMonthPlan(planLifeFixture("household"), { memberId: "MEM-001", monthKey: "2026-09", target: "0", buffer: "3000" }).household;
      const weather = pathWeather(misty, TODAY);
      expect(weather.forecast).toBe("mist");
      const fund: number[] = [];
      await render(misty, { onOpenFund: () => fund.push(1) });
      await settle();
      const world = created.worlds[0] as FakeWorld;
      const scene = () => world.setScene.mock.calls.at(-1)![0] as Scene;
      expect(scene().weather.find((w) => w.kind === "mist")).toEqual({ id: "mist", kind: "mist", weight: 0.5, dayOffset: 5 });
      expect(outline().map((b) => b.textContent)).toContain("Forecast mist · why?");
      await openFromOutline("Forecast mist");
      const lines = () => [...host.querySelectorAll(".path-world__card li")].map((li) => li.textContent);
      expect(lines()).toEqual(weather.mistWhy);
      expect(lines().at(-1)).toContain("Fictional rent");
      await click(byText("Dim"));
      expect(lines()).toEqual([weather.mistWhy[0]]);
      expect(cardText()).not.toMatch(/\$/);
      await click(byText("Open the Fund"));
      expect(fund).toEqual([1]);

      const daily = addRecurrence(planLifeFixture("household"), {
        cadence: "daily", nextDate: "2026-09-16", type: "expense", amount: "5", accountId: "ACC-VISA", subcategoryId: "SUB-HOUSING-ELECTRIC", note: "Fictional daily coffee",
        fundingDefault: { fundId: planLifeFixture("household").householdFund!.id, fundedCents: "full", destinationAccountId: "ACC-VISA" },
      }).household;
      expect(pathWeather(daily, TODAY).forecast).toBe("unavailable");
      await render(daily);
      expect(outline().map((b) => b.textContent)).toContain("No forecast yet · why?");
      await openFromOutline("No forecast yet");
      expect(cardText()).toContain("A daily Fund bill needs a complete recurrence review before a long Plan projection.");
    });

    it("lays household tasks as stepping stones with footprints, keeps a money stone dark until the books hold it, and never ticks a task", async () => {
      created.mode = "fake";
      const draft = (patch: Partial<TaskInput["task"]>): TaskInput["task"] => ({
        visibility: "household", title: "Water the fern", notes: "", listId: null, parentId: null, doDate: null, dueDate: null, repeat: "none", cue: "none",
        assigneeId: null, backupId: null, chapterId: null, planReference: null, moneyLink: null, expectedAmountCents: null, deleted: false, ...patch,
      });
      let h = seeded();
      h = saveTask(h, { memberId: "MEM-001", id: "TASK-ferry", expectedRevision: 0, task: draft({ title: "Fictional: book the ferry", assigneeId: "MEM-001", backupId: "MEM-002", dueDate: "2026-09-20" }) }).household;
      h = saveTask(h, { memberId: "MEM-001", id: "TASK-hydro", expectedRevision: 0, task: draft({ title: "Fictional: pay hydro", expectedAmountCents: 14_000, dueDate: "2026-09-18", assigneeId: "MEM-002" }) }).household;
      h = saveTask(h, { memberId: "MEM-001", id: "TASK-secret", expectedRevision: 0, task: draft({ title: "Fictional surprise picnic", visibility: "personal" }) }).household;
      const planner: number[] = [];
      let commands = 0;
      await render(h, { onOpenPlanner: () => planner.push(1), onCommand: async () => { commands += 1; return { ok: true }; } });
      await settle();
      const world = created.worlds[0] as FakeWorld;
      const scene = () => world.setScene.mock.calls.at(-1)![0] as Scene;
      const now = pathMonths(h, TODAY).length - 1;
      expect(scene().stones).toEqual(expect.arrayContaining([
        { id: "stone:TASK-ferry", month: now, state: "open", lit: false, money: false, owner: true, backup: true },
        { id: "stone:TASK-hydro", month: now, state: "waiting", lit: false, money: true, owner: true, backup: false },
      ]));
      expect(scene().stones).toHaveLength(2);
      expect(outline().map((b) => b.textContent)).toContain("Fictional: book the ferry · Owned by Alex (fictional), Sam (fictional) as backup");
      expect(JSON.stringify(outline().map((b) => b.textContent))).not.toContain("surprise");

      await openFromOutline("Fictional: pay hydro");
      expect(cardText()).toContain("Owned by Sam (fictional)");
      expect(cardText()).toContain("Lights when the money is confirmed in the books.");
      expect(cardText()).not.toMatch(/\$|140/);
      const actions = [...host.querySelectorAll<HTMLButtonElement>(".path-world__card .path-world__actions button")].map((b) => b.textContent);
      expect(actions).toEqual(["Open the planner"]);
      expect(byText(/mark done|complete|tick/i)).toBeUndefined();
      await click(byText("Open the planner"));
      expect(planner).toEqual([1]);
      expect(commands).toBe(0);

      // Posted and attached as evidence (D-245): the stone lights. The island itself never did this.
      const posted = postEntry(h, { date: "2026-09-14", type: "expense", amount: 140.5, accountId: "ACC-CHEQUING", subcategoryId: "SUB-HOUSING-ELECTRIC", createdBy: "MEM-001", note: "Fictional hydro", confirmDuplicate: true }).household;
      expect(pathStones(posted, "MEM-001", TODAY).find((s) => s.id === "TASK-hydro")!.lit).toBe(false);
      const tx = posted.transactions.find((row) => row.note === "Fictional hydro")!;
      const done = completeTask(posted, { memberId: "MEM-001", id: "TASK-hydro", expectedRevision: 1, evidence: { kind: "transaction", transactionId: tx.id, amountCents: tx.amountCents, date: tx.date } }).household;
      await render(done);
      expect(scene().stones.find((s) => s.id === "stone:TASK-hydro")).toMatchObject({ state: "done", lit: true, money: true });
      expect(cardText()).toContain("Lit because the money is confirmed in the books.");
    });

    it("lets a year-old sea cove's bottle carry the trip's calendar note, words only", async () => {
      let h = seeded();
      h = postEntry(h, { type: "expense", date: "2025-07-05", amount: "20", accountId: "ACC-VISA", subcategoryId: "SUB-LIFE-FUN", note: "Fictional picnic", createdBy: "MEM-001", visibility: "household", confirmDuplicate: true }).household;
      const event = (id: string, visibility: string, title: string, notes: string) => ({ version: 1, id, revision: 1, createdBy: "MEM-001", visibility, title, start: "2025-08-09", end: "2025-08-11", allDay: true, timezone: "America/Toronto", fold: "earlier", repeat: "none", until: null, location: "Fictional shore", notes, exceptions: {}, createdAt: "2025-07-01T12:00:00.000Z", updatedAt: "2025-07-01T12:00:00.000Z" });
      h = { ...h, nativeEvents: [
        event("EV-PRIVATE", "personal", "Fictional private beach trip", "Private words that must never wash up."),
        event("EV-SHORE", "household", "Fictional beach trip", "We spent $240.50 on 2 lobsters and swore we'd come back every summer."),
      ] as never };
      const months = pathMonths(h, TODAY);
      expect(months[0]!.key).toBe("2025-07");
      await render(h);
      await settle();
      await openFromOutline("A message in a bottle");
      expect($(".path-world__card h3").textContent).toBe("Fictional beach trip");
      expect(cardText()).toContain("We spent on lobsters and swore we'd come back every summer.");
      expect(cardText()).not.toMatch(/\$|\d/);
      expect(cardText()).not.toContain("Private words");
    });

    it("rings set land and dots stamped weeks on the flat map", async () => {
      let h = seeded();
      h = closeBooksMonth(h, { monthKey: "2026-08", createdBy: "MEM-001" }).household;
      h = stampWeeklyDocument(h, { memberId: "MEM-001", today: "2026-09-13", now: "2026-09-13T16:00:00.000Z" }).household;
      await render(h);
      await settle();
      const kerbs = [...host.querySelectorAll(".path-world__flat .path-world__kerb")];
      expect(kerbs).toHaveLength(1);
      expect(kerbs[0]!.classList.contains("path-world__kerb--closed")).toBe(true);
      const months = pathMonths(h, TODAY);
      const august = months.findIndex((m) => m.key === "2026-08");
      const dots = [...host.querySelectorAll(".path-world__flat .path-world__dot")];
      const group = kerbs[0]!.parentElement!;
      expect(group.getAttribute("transform")).toBe(`translate(${Number(dots[august]!.getAttribute("cx")).toFixed(2)} ${Number(dots[august]!.getAttribute("cy")).toFixed(2)})`);
      expect(host.querySelectorAll(".path-world__flat .path-world__stamp")).toHaveLength(1);
      // Scrubbed back before August, the kerb is not there yet.
      await scrub($<HTMLInputElement>(".path-world__slider input"), august - 1);
      expect(host.querySelectorAll(".path-world__flat .path-world__kerb")).toHaveLength(0);
    });

    it("folds the quality choice into one Lite toggle on a narrow screen", async () => {
      created.mode = "fake";
      const width = window.innerWidth;
      Object.defineProperty(window, "innerWidth", { configurable: true, value: 360 });
      try {
        localStorage.setItem("hearth:pathWorld:quality", "full");
        await render(seeded());
        await settle();
        const world = created.worlds[0] as FakeWorld;
        const group = $(".path-world__quality");
        expect(group.getAttribute("role")).toBe("group");
        expect([...group.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["Lite"]);
        expect(byText("Full")).toBeUndefined();
        expect(byText("Lite").getAttribute("aria-pressed")).toBe("false");
        await click(byText("Lite"));
        expect(byText("Lite").getAttribute("aria-pressed")).toBe("true");
        expect(localStorage.getItem("hearth:pathWorld:quality")).toBe("lite");
        expect(world.setQuality).toHaveBeenLastCalledWith("lite");
        await click(byText("Lite"));
        expect(localStorage.getItem("hearth:pathWorld:quality")).toBe("full");
        // Wide again: the two-button group returns.
        Object.defineProperty(window, "innerWidth", { configurable: true, value: 1100 });
        await act(async () => { window.dispatchEvent(new Event("resize")); });
        expect(byText("Full").getAttribute("aria-pressed")).toBe("true");
      } finally {
        Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
      }
    });

    it("keeps the Kitty kiln and the recipe kiln hut apart by name", async () => {
      const source = await import("node:fs").then((fs) => fs.readFileSync("src/path/OurPathWorld.tsx", "utf8"));
      expect(source).toContain('kiln: "A kiln hut"');
      expect(source).toContain('label: "The kiln"');
    });
  });

  it("opens on a household with no Chapter yet: no Move, no tent campfire, and still a place to stand", async () => {
    await act(async () => root.render(createElement(Harness, { initial: planLifeFixture("household"), today: "2026-09-15" })));
    await settle();
    expect(host.querySelector(".path-world__next")).toBeNull();
    const outline = [...host.querySelectorAll(".path-world__outline button")].map((b) => b.textContent ?? "");
    expect(outline.some((t) => t.startsWith("We are here"))).toBe(true);
    expect(outline.some((t) => t.startsWith("Plan Studio"))).toBe(false);
    expect(byText("Open the Plan Studio tent")).toBeTruthy();
  });
});

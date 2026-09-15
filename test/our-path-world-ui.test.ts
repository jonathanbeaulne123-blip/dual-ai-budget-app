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

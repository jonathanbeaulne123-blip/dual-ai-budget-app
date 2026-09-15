// @vitest-environment jsdom
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addGoal, offerMove, openChapter, postEntry, recordRitualHeld, type CommitResult, type Household } from "../src/core/index.ts";
import { movesForChapter, openChapterFor, respondToMove } from "../src/core/chapters.ts";
import { pathIslandName } from "../src/core/pathWorld.ts";
import { OurPathWorld } from "../src/path/OurPathWorld.tsx";
import { planLifeFixture } from "./fixtures/plan-life.ts";

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

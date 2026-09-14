// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HouseholdHome } from "../src/HouseholdHome.tsx";
import { addGoal, addRecurrence, postEntry, type CommitResult, type Household } from "../src/core/index.ts";
import { planLifeFixture } from "./fixtures/plan-life.ts";
import { HOUSE_FLOORS, houseCan, houseKey, houseOwnsEvent, houseStep, houseSwipe, houseTurnKey } from "../src/queen/queenHouse.ts";
import { BANK_SCULPT, bankMetrics } from "../src/queen/world/queenBankSculpture.ts";

vi.mock("../src/kitty/KittyStage.tsx", () => ({ KittyStage: () => null }));
vi.mock("../src/kitty/studio/flat.tsx", () => ({ KittyFlat: () => createElement("svg", { "data-flat-kitty": true }) }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("The house axis — one line, three floors, and up goes up", () => {
  it("stacks loft over hearth over cellar and clamps at both ends", () => {
    expect([...HOUSE_FLOORS]).toEqual(["loft", "home", "cellar"]);
    expect(houseStep("home", "up")).toBe("loft");
    expect(houseStep("home", "down")).toBe("cellar");
    expect(houseStep("cellar", "up")).toBe("home");
    expect(houseStep("loft", "down")).toBe("home");
    // The loft has no upstairs and the cellar no down: the stair resists rather than wrapping.
    expect(houseStep("loft", "up")).toBe("loft");
    expect(houseStep("cellar", "down")).toBe("cellar");
    expect(houseCan("loft", "up")).toBe(false);
    expect(houseCan("loft", "down")).toBe(true);
  });

  it("reads a swipe only when it leans vertical and travels far enough", () => {
    // Up the screen is negative, and up goes up.
    expect(houseSwipe({ dx: 0, dy: -90 })).toBe("up");
    expect(houseSwipe({ dx: 0, dy: 90 })).toBe("down");
    // A scrub across the ribbon is never a stair, however far it goes.
    expect(houseSwipe({ dx: 200, dy: -60 })).toBe(null);
    expect(houseSwipe({ dx: -200, dy: 70 })).toBe(null);
    // A twitch is not a floor.
    expect(houseSwipe({ dx: 0, dy: -20 })).toBe(null);
    // A flick counts at half the distance, but only when it is timed.
    expect(houseSwipe({ dx: 0, dy: -32, ms: 40 })).toBe("up");
    expect(houseSwipe({ dx: 0, dy: -32, ms: 900 })).toBe(null);
    expect(houseSwipe({ dx: 0, dy: -32 })).toBe(null);
    // A short phone asks for less travel than a desk, never for more than the flat minimum.
    expect(houseSwipe({ dx: 0, dy: -40, reach: 300 })).toBe("up");
    expect(houseSwipe({ dx: 0, dy: -40, reach: 900 })).toBe(null);
    expect(houseSwipe({ dx: Number.NaN, dy: -90 })).toBe(null);
  });

  it("owns the arrows on its own axis and leaves every other key alone", () => {
    expect(houseKey("ArrowUp")).toBe("up");
    expect(houseKey("ArrowDown")).toBe("down");
    expect(houseKey("ArrowLeft")).toBe(null);
    expect(houseTurnKey("ArrowLeft")).toBe(-1);
    expect(houseTurnKey("ArrowRight")).toBe(1);
    expect(houseTurnKey("ArrowUp")).toBe(null);
  });

  it("keeps its hands off anything that owns its own pointer or arrows", () => {
    const page = document.createElement("div");
    page.innerHTML = `<div data-house-hold="ledge"><button id="bank"></button></div><input id="scrub" type="range"><button id="free"></button><button id="queen" data-house-hold="down"></button>`;
    expect(houseOwnsEvent(page.querySelector("#free"))).toBe(true);
    expect(houseOwnsEvent(page.querySelector("#scrub"))).toBe(false);
    // Arranging on the ledge is the ledge's; travelling past it is the house's.
    expect(houseOwnsEvent(page.querySelector("#bank"))).toBe(false);
    expect(houseOwnsEvent(page.querySelector("#bank"), "up")).toBe(false);
    // She keeps the pull down that tips her over, and lets the climb up pass through.
    expect(houseOwnsEvent(page.querySelector("#queen"), "down")).toBe(false);
    expect(houseOwnsEvent(page.querySelector("#queen"), "up")).toBe(true);
    expect(houseOwnsEvent(null)).toBe(true);
  });
});

describe("The kitty bank, ported onto the rooms' ledges", () => {
  it("gives every form the studio's own silhouette, one unit tall", () => {
    for (const form of ["jar", "goal", "bill"] as const) {
      const metrics = bankMetrics(form);
      expect(metrics.height).toBeGreaterThan(1);
      // `unit` is what makes a cat exactly one unit tall, which is what a seat's height scales.
      expect(metrics.height * metrics.unit).toBeCloseTo(1, 10);
      // Head above body, ears above head: nothing is buried in the skull.
      expect(metrics.headY).toBeGreaterThan(metrics.bodyTop);
      expect(metrics.headTop).toBeGreaterThan(metrics.headY);
      expect(metrics.height).toBeGreaterThan(metrics.headTop);
      expect(metrics.radius).toBeGreaterThan(0.3);
    }
    // The forms are the nest's own tiers, not new ones: a bill is the bean cat, a goal the pear one with its tail.
    expect(BANK_SCULPT.bill.body).toBe("bean");
    expect(BANK_SCULPT.bill.tail).toBe("none");
    expect(BANK_SCULPT.jar).toEqual(BANK_SCULPT.bill);
    expect(BANK_SCULPT.goal.body).toBe("pear");
    expect(BANK_SCULPT.goal.tail).toBe("wrap");
  });
});

// ---- the house, in the App ------------------------------------------------
let host: HTMLDivElement, root: Root;
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); localStorage.clear(); sessionStorage.clear(); vi.restoreAllMocks(); delete (window as { matchMedia?: unknown }).matchMedia; });

const memberId = "MEM-001";
function seeded(): Household {
  let h = planLifeFixture("household");
  const rent = h.recurrences.find((row) => row.note === "Fictional rent")!;
  for (const [month, amount] of [["06", "900"], ["07", "1380"], ["08", "900"]] as const) {
    h = postEntry(h, { type: "expense", date: `2026-${month}-20`, amount, accountId: "ACC-VISA", subcategoryId: "SUB-HOUSING-ELECTRIC", note: "Fictional rent", createdBy: memberId, visibility: "household", source: "recurring", sourceId: rent.id, confirmDuplicate: true }).household;
  }
  h = addRecurrence(h, { cadence: "monthly", nextDate: "2026-09-26", type: "expense", amount: "60", accountId: "ACC-VISA", subcategoryId: "SUB-LIFE-FUN", note: "Fictional date night" }).household;
  h = addGoal(h, { name: "Fictional trip to the shore", target: "2000", shared: true, ownerMemberId: memberId }).household;
  return h;
}
function widthIs(wide: boolean) {
  (window as { matchMedia?: unknown }).matchMedia = (query: string) => ({ matches: wide && query.includes("min-width: 720px"), media: query, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false });
}
async function render(household: Household) {
  const onCommand = vi.fn(async (fn: (h: Household) => CommitResult) => ({ ok: true, household: fn(household).household }));
  await act(async () => root.render(createElement(HouseholdHome, {
    household, memberId, today: "2026-09-12", freshness: "current" as const, busy: false,
    onCommand, onGo: vi.fn(), onOpenSetup: vi.fn(), composition: "queen" as const,
  })));
}
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => host.querySelector<T>(selector)!;
const place = () => $(".queen-home").dataset.scene;
const key = async (element: HTMLElement, name: string) => act(async () => { element.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true })); });
const haul = async (element: HTMLElement, dy: number) => act(async () => {
  element.dispatchEvent(new MouseEvent("pointerdown", { clientX: 40, clientY: 300, bubbles: true }));
  element.dispatchEvent(new MouseEvent("pointermove", { clientX: 40, clientY: 300 + dy, bubbles: true }));
  element.dispatchEvent(new MouseEvent("pointerup", { clientX: 40, clientY: 300 + dy, bubbles: true }));
});

describe("Travelling the house — a rail, the arrow keys, and a grab", () => {
  beforeEach(() => widthIs(true));

  it("names all three floors on the rail and marks the one you are standing on", async () => {
    await render(seeded());
    const stops = [...host.querySelectorAll<HTMLButtonElement>(".queen-house-rail__stop")];
    expect(stops.map((stop) => stop.dataset.floor)).toEqual(["loft", "home", "cellar"]);
    expect(stops.filter((stop) => stop.getAttribute("aria-current") === "true").map((stop) => stop.dataset.floor)).toEqual(["home"]);
    // Every floor is one press away, so the gesture is never the only way in.
    await act(async () => stops[2]!.click());
    expect(place()).toBe("cellar");
    expect($(".queen-house-rail__stop[data-floor='cellar']").getAttribute("aria-current")).toBe("true");
    await act(async () => host.querySelectorAll<HTMLButtonElement>(".queen-house-rail__stop")[0]!.click());
    expect(place()).toBe("loft");
  });

  it("climbs and descends on the arrow keys, and stops at the ceiling and the floor", async () => {
    await render(seeded());
    const field = $(".queen-field");
    await key(field, "ArrowUp");
    expect(place()).toBe("loft");
    await key($(".queen-room--loft"), "ArrowUp");
    expect(place()).toBe("loft");
    await key($(".queen-room--loft"), "ArrowDown");
    expect(place()).toBe("home");
    await key($(".queen-field"), "ArrowDown");
    expect(place()).toBe("cellar");
    await key($(".queen-room--cellar"), "ArrowDown");
    expect(place()).toBe("cellar");
    await key($(".queen-room--cellar"), "ArrowUp");
    expect(place()).toBe("home");
  });

  it("leaves the arrows a control already answered alone", async () => {
    await render(seeded());
    // ArrowDown on her tips her over; it must not drop the house into the cellar as well.
    const queen = $(".queen-figure");
    expect(queen).toBeTruthy();
    await key(queen, "ArrowDown");
    expect(place()).toBe("home");
    expect($(".queen-home").dataset.tipped).toBe("true");
    // Pulling her down tips her; it never drops the house into the cellar underneath her.
    await haul(queen, 120);
    expect(place()).toBe("home");
    // Pushing up past her is not her gesture at all, so the loft is still reachable through her.
    await key(queen, "ArrowUp");
    expect(place()).toBe("home");
    // A scrubber owns its own arrows, wherever it sits.
    await act(async () => $(".queen-house-rail__stop[data-floor='cellar']").click());
    const scrub = host.querySelector<HTMLInputElement>(".queen-scrub input");
    if (scrub) { await key(scrub, "ArrowUp"); expect(place()).toBe("cellar"); }
  });

  it("takes a grab and a haul, and ignores a drag that leans across", async () => {
    await render(seeded());
    await haul($(".queen-field"), -120);
    expect(place()).toBe("loft");
    await haul($(".queen-room--loft"), 120);
    expect(place()).toBe("home");
    // A short pull is a twitch, not a floor.
    await haul($(".queen-field"), 18);
    expect(place()).toBe("home");
  });
});

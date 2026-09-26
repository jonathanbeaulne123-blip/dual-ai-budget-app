// @vitest-environment jsdom
import * as THREE from "three";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BINDERY_MACHINES, BINDERY_DOOR_PREFIX, binderyDivisionFor, binderyDoorObject, binderyMachine } from "../src/house/bindery.ts";
import { BOOK_DIVISIONS, HouseBooks } from "../src/house/HouseBooks.tsx";
import { libraryPlace } from "../src/harbour/library/LibraryScene.ts";
import { seedDemoHousehold } from "../src/core/seed.ts";

/**
 * Per-machine Bindery deep links (W6 #1). Each of the Library's five machines
 * doors onto the books surface at its own division; the books surface turns to
 * the division the address names, and to nothing else.
 */

describe("the Bindery table", () => {
  it("names five machines, each with its own id and a real division of the book", () => {
    expect(BINDERY_MACHINES.map((machine) => machine.name))
      .toEqual(["Lantern Row", "Low Water", "Cut Bank", "The Glasshouse pane", "The Handoff bench"]);
    expect(new Set(BINDERY_MACHINES.map((machine) => machine.id)).size).toBe(5);
    expect(new Set(BINDERY_MACHINES.map((machine) => machine.division)).size).toBe(5);
    for (const machine of BINDERY_MACHINES) expect(BOOK_DIVISIONS).toContain(machine.division);
  });

  it("is the truth table the pop-up work agreed, both ways round", () => {
    expect(Object.fromEntries(BINDERY_MACHINES.map((machine) => [machine.id, machine.division]))).toEqual({
      "lantern-row": "Spending",
      "low-water": "Bills",
      "cut-bank": "Accounts",
      "glasshouse-pane": "Goals",
      "handoff-bench": "Contributions",
    });
    for (const machine of BINDERY_MACHINES) {
      expect(binderyDoorObject(machine.id)).toBe(`${BINDERY_DOOR_PREFIX}${machine.id}`);
      expect(binderyMachine(binderyDoorObject(machine.id))).toEqual(machine);
      expect(binderyDivisionFor(binderyDoorObject(machine.id))).toBe(machine.division);
    }
  });

  it("reads no division out of any other address the books surface carries", () => {
    for (const object of [null, undefined, "", "bindery/", "bindery/nope", "bank/plan:protect", "task/T-1", "journey/era:one", "Spending"]) {
      expect(binderyMachine(object)).toBeNull();
      expect(binderyDivisionFor(object)).toBeNull();
    }
  });
});

describe("the Library's Bindery bench", () => {
  const build = () => libraryPlace.build(new THREE.Scene(), { theme: "classic" } as never, null, "lite", {
    composition: "desktop", signal: new AbortController().signal, invalidate: () => {},
  });

  it("stands one door per machine, each carrying its own target, and keeps the bench's own door", () => {
    const handle = build();
    const anchors = handle.anchors();
    const doors = Object.fromEntries(anchors.filter((anchor) => anchor.id.startsWith("bindery:"))
      .map((anchor) => [anchor.id, `${anchor.door!.target}/${anchor.door!.object}`]));
    expect(doors).toEqual({
      "bindery:lantern-row": "books/bindery/lantern-row",
      "bindery:low-water": "books/bindery/low-water",
      "bindery:cut-bank": "books/bindery/cut-bank",
      "bindery:glasshouse-pane": "books/bindery/glasshouse-pane",
      "bindery:handoff-bench": "books/bindery/handoff-bench",
    });
    // The bench itself still opens the book plainly; a machine says which division it opens.
    const bench = anchors.find((anchor) => anchor.id === "bindery")!;
    expect(bench.door).toEqual({ target: "books" });
    expect(bench.door!.object).toBeUndefined();
    expect(anchors.find((anchor) => anchor.id === "bindery:cut-bank")!.label).toContain("Open the Standing Book at Accounts");
    handle.dispose();
  });

  it("gives every machine its own body to be touched, and its own region with a box", () => {
    const handle = build();
    const stamps = new Set<string>();
    handle.group.traverse((node) => { const anchor = node.userData.anchor; if (typeof anchor === "string" && anchor.startsWith("bindery:")) stamps.add(anchor); });
    expect([...stamps].sort()).toEqual(BINDERY_MACHINES.map((machine) => `bindery:${machine.id}`).sort());
    const regions = handle.regions().filter((region) => region.id.startsWith("bindery:"));
    expect(regions.length).toBe(5);
    for (const region of regions) expect(region.box).toBeTruthy();
    // The machines stand apart along the bench: no two share a place.
    const spots = handle.anchors().filter((anchor) => anchor.id.startsWith("bindery:")).map((anchor) => anchor.position[2]);
    expect(new Set(spots).size).toBe(5);
    handle.dispose();
  });
});

describe("the books surface arrives at the division the door named", () => {
  let host: HTMLDivElement, root: Root;
  const household = seedDemoHousehold({ today: "2026-09-20" });
  const memberId = household.members[0]!.id;
  const divisions = () => [...host.querySelectorAll<HTMLElement>(".house-book__ribbons button")];
  const open = () => host.querySelector<HTMLElement>(".house-book")?.dataset.bookDivision ?? null;
  const render = (openAt: (typeof BOOK_DIVISIONS)[number] | null) => act(async () => root.render(createElement(
    HouseBooks,
    { household, memberId, view: "household" as const, openAt, children: () => null },
  )));

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    try { localStorage.clear(); } catch { /* the book stays readable */ }
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

  it("opens on Today with no address, and on each machine's division with one", async () => {
    await render(null);
    expect(open()).toBe("Today");
    for (const machine of BINDERY_MACHINES) {
      await render(machine.division);
      expect(open(), machine.name).toBe(machine.division);
      expect(divisions().find((button) => button.getAttribute("aria-current") === "page")?.textContent).toContain(machine.division);
    }
  });

  it("is a preselect, not a lock: the reader can still turn the book, and no address leaves them where they were", async () => {
    await render(binderyDivisionFor(binderyDoorObject("cut-bank")));
    expect(open()).toBe("Accounts");
    const record = divisions().find((button) => button.textContent?.includes("Paper trail"))!;
    await act(async () => record.click());
    expect(open()).toBe("Paper trail");
    // The same address again does not snatch the page back.
    await render(binderyDivisionFor(binderyDoorObject("cut-bank")));
    expect(open()).toBe("Paper trail");
    // Arriving with no address at all keeps the page the reader left open.
    await render(null);
    expect(open()).toBe("Paper trail");
  });
});

// @vitest-environment jsdom
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FundStandingBook } from "../src/FundStandingBook.tsx";
import { FundBoard } from "../src/FundBoard.tsx";
import { FundLedge } from "../src/FundLedge.tsx";
import { formatCad, fundPlates, seedDemoHousehold, type DeskPlateModel, type FundWidgetId } from "../src/core/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TODAY = "2026-09-12";
const BIANCA = "MEM-001";

function demo() {
  return seedDemoHousehold({ today: TODAY, environment: "development" });
}

function mount() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  return { host, root, unmount: async () => { await act(async () => root.unmount()); host.remove(); } };
}

/** A plate with the given edge, on the ten Fund ids, so the fore-edge can be set by hand. */
function plateWith(id: DeskPlateModel["id"], edge: DeskPlateModel["edge"], figure: DeskPlateModel["figure"] = { primitive: "tally", count: 1 }): DeskPlateModel {
  return {
    id, kicker: `Kicker ${id}`, glance: `Glance ${id}`, verdict: `Verdict ${id}.`, footing: `Footing ${id}.`,
    edge, copperVerdict: edge === "attention", figure, empty: null, cabinet: "blotter", cabinetName: `the ${id} cabinet`,
  };
}

const TEN: DeskPlateModel["id"][] = ["fund-level", "waiting", "next-out", "spoken-for", "settle", "accounts", "week", "saving", "shape", "streams"];

function tabs(host: HTMLElement) {
  return [...host.querySelectorAll<HTMLElement>('[role="tab"]')];
}

function tabContract(host: HTMLElement) {
  return tabs(host).map((tab) => ({
    id: tab.id,
    controls: tab.getAttribute("aria-controls"),
    selected: tab.getAttribute("aria-selected"),
    current: tab.getAttribute("aria-current"),
    tabIndex: tab.tabIndex,
    widget: tab.getAttribute("data-fund-widget") ?? tab.getAttribute("data-plate-id"),
  }));
}

async function render(root: Root, props: Parameters<typeof FundStandingBook>[0]) {
  await act(async () => root.render(createElement(FundStandingBook, props)));
}

afterEach(() => {
  delete document.documentElement.dataset.motion;
  vi.unstubAllEnvs();
});

describe("The Standing Book", () => {
  it("keeps FundBoard's tablist contract, id for id, on both presentations, and writes nothing", async () => {
    const household = demo();
    const before = JSON.stringify(household);
    const { host, root, unmount } = mount();
    const seen: FundWidgetId[] = [];
    try {
      for (const presentation of ["phone", "desk"] as const) {
        await render(root, { household, memberId: BIANCA, today: TODAY, presentation, selected: "level", onSelect: (id) => seen.push(id) });
        const list = host.querySelector('[role="tablist"]');
        expect(list?.getAttribute("aria-label")).toBe("Fund board");
        expect(list?.classList.contains("fund-book-edge")).toBe(true);
        expect(tabs(host)).toHaveLength(presentation === "phone" ? 6 : 8);
        expect(host.querySelectorAll('[aria-selected="true"]')).toHaveLength(1);
        // The room sits beside the tablist, never inside it: no button nests in a tab.
        expect(list?.querySelector("button button")).toBeNull();
        const book = tabContract(host);
        const boardHost = document.createElement("div");
        document.body.append(boardHost);
        const boardRoot = createRoot(boardHost);
        await act(async () => boardRoot.render(createElement(FundBoard, { household, memberId: BIANCA, today: TODAY, presentation, selected: "level", onSelect: () => {} })));
        const board = tabContract(boardHost);
        await act(async () => boardRoot.unmount());
        boardHost.remove();
        expect(book.map((tab) => tab.id)).toEqual(board.map((tab) => tab.id));
        expect(book.map((tab) => tab.controls)).toEqual(board.map((tab) => tab.controls));
        expect(book.map((tab) => tab.selected)).toEqual(board.map((tab) => tab.selected));
        expect(book.map((tab) => tab.current)).toEqual(board.map((tab) => tab.current));
        expect(book.map((tab) => tab.tabIndex)).toEqual(board.map((tab) => tab.tabIndex));
      }
      await act(async () => tabs(host)[2]!.click());
      expect(seen).toEqual(["waiting"]);
      expect(JSON.stringify(household)).toBe(before);
    } finally { await unmount(); }
  });

  it("roves focus with the arrows, Home and End exactly as the board does", async () => {
    const household = demo();
    const { host, root, unmount } = mount();
    try {
      await render(root, { household, memberId: BIANCA, today: TODAY, presentation: "desk", selected: "level", onSelect: () => {} });
      const all = tabs(host);
      const key = (target: HTMLElement, key: string) => act(async () => { target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true })); });
      all[0]!.focus();
      await key(all[0]!, "ArrowRight");
      expect(document.activeElement).toBe(all[1]);
      await key(all[1]!, "ArrowDown");
      expect(document.activeElement).toBe(all[2]);
      await key(all[2]!, "ArrowLeft");
      expect(document.activeElement).toBe(all[1]);
      await key(all[1]!, "End");
      expect(document.activeElement).toBe(all[all.length - 1]);
      await key(all[all.length - 1]!, "ArrowRight");
      expect(document.activeElement).toBe(all[0]);
      await key(all[0]!, "ArrowUp");
      expect(document.activeElement).toBe(all[all.length - 1]);
      await key(all[all.length - 1]!, "Home");
      expect(document.activeElement).toBe(all[0]);
      expect(all.filter((tab) => tab.tabIndex === 0)).toHaveLength(1);
    } finally { await unmount(); }
  });

  it("prints the Level plate's real glance on the running head and its footing and verdict on the plinth", async () => {
    const household = demo();
    const level = fundPlates({ household, memberId: BIANCA, today: TODAY }).find((plate) => plate.id === "fund-level")!;
    const { host, root, unmount } = mount();
    try {
      await render(root, { household, memberId: BIANCA, today: TODAY, presentation: "desk", selected: "level", onSelect: () => {} });
      expect(host.querySelector(".fund-book-head-level")?.textContent).toBe(level.glance);
      expect(host.querySelector(".fund-book-head-state")?.getAttribute("data-edge")).toBe(level.edge);
      expect(host.querySelector(".fund-book-plinth-footing")?.textContent).toBe(level.footing);
      expect(host.querySelector(".fund-book-plinth-verdict")?.textContent).toBe(level.verdict);
      expect(host.querySelector(".fund-book")?.getAttribute("data-fund-book-state")).toBe(level.edge);
      // The corner is today: the Level's concertina carries a corner and a standing ink line.
      expect(host.querySelector(".fund-book-concertina .fund-book-corner")).not.toBeNull();
      expect(host.querySelector(".fund-book-concertina .fund-book-ink")).not.toBeNull();
    } finally { await unmount(); }
  });

  it("marks an attention bookmark proud and dog-eared, and a household with every plate clear keeps a flush fore-edge", async () => {
    const household = demo();
    const { host, root, unmount } = mount();
    try {
      const clear = TEN.map((id) => plateWith(id, "clear"));
      await render(root, { household, memberId: BIANCA, today: TODAY, presentation: "desk", selected: "level", onSelect: () => {}, plates: clear });
      expect(host.querySelector(".fund-book")?.getAttribute("data-fund-book-edge")).toBe("flush");
      expect(host.querySelector(".is-dogeared")).toBeNull();
      expect(tabs(host).every((tab) => tab.getAttribute("data-reach") === "0")).toBe(true);
      const worried = TEN.map((id) => plateWith(id, id === "waiting" ? "attention" : id === "week" ? "live" : "clear"));
      await render(root, { household, memberId: BIANCA, today: TODAY, presentation: "desk", selected: "level", onSelect: () => {}, plates: worried });
      expect(host.querySelector(".fund-book")?.getAttribute("data-fund-book-edge")).toBe("proud");
      const waiting = host.querySelector<HTMLElement>('[data-fund-widget="waiting"]')!;
      expect(waiting.classList.contains("is-dogeared")).toBe(true);
      expect(waiting.getAttribute("data-reach")).toBe("2");
      expect(host.querySelector('[data-fund-widget="week"]')?.getAttribute("data-reach")).toBe("1");
      expect(host.querySelectorAll(".is-dogeared")).toHaveLength(1);
    } finally { await unmount(); }
  });

  it("never stands anything projected: right of the corner lies flat in pencil", async () => {
    const household = demo();
    const { host, root, unmount } = mount();
    try {
      const plates = TEN.map((id) => id === "fund-level"
        ? plateWith(id, "clear", { primitive: "spark", points: [1000, 500, -500, 700], actualCount: 2, room: 28 })
        : plateWith(id, "clear"));
      await render(root, { household, memberId: BIANCA, today: TODAY, presentation: "desk", selected: "level", onSelect: () => {}, plates });
      expect(host.querySelectorAll(".fund-book-panel.is-standing")).toHaveLength(1);
      expect(host.querySelectorAll(".fund-book-pencil.is-projected")).toHaveLength(2);
      expect(host.querySelector(".is-projected.is-standing")).toBeNull();
      expect(host.querySelectorAll(".fund-book-corner")).toHaveLength(1);
      // The real seeded Level: every projected panel is a flat pencil line, none a standing fold.
      await render(root, { household, memberId: BIANCA, today: TODAY, presentation: "desk", selected: "level", onSelect: () => {} });
      const level = fundPlates({ household, memberId: BIANCA, today: TODAY }).find((plate) => plate.id === "fund-level")!;
      if (level.figure.primitive === "spark") {
        const projected = Math.max(0, level.figure.points.length - Math.min(level.figure.points.length, level.figure.actualCount ?? level.figure.points.length));
        expect(host.querySelectorAll(".fund-book-pencil.is-projected")).toHaveLength(projected);
        expect(host.querySelector(".is-projected.is-standing")).toBeNull();
      }
      // A figure with no boundary invents no corner.
      const noBoundary = TEN.map((id) => id === "fund-level" ? plateWith(id, "clear", { primitive: "spark", points: [1, 2, 3], room: 28 }) : plateWith(id, "clear"));
      await render(root, { household, memberId: BIANCA, today: TODAY, presentation: "desk", selected: "level", onSelect: () => {}, plates: noBoundary });
      expect(host.querySelector(".fund-book-corner")).toBeNull();
      expect(host.querySelectorAll(".is-projected")).toHaveLength(0);
    } finally { await unmount(); }
  });

  it("reads the strip past a fixed gate with the arrows, Home and End, and says what stands in it", async () => {
    const household = demo();
    const { host, root, unmount } = mount();
    try {
      const plates = TEN.map((id) => id === "next-out"
        ? plateWith(id, "live", { primitive: "track", days: 31, room: 28, marks: [{ day: 18, cents: 14230, label: "Hydro" }, { day: 25, cents: 185000, label: "Rent" }, { day: 30, cents: 9640, label: "Car insurance" }] })
        : plateWith(id, "clear"));
      await render(root, { household, memberId: BIANCA, today: TODAY, presentation: "desk", selected: "next-out", onSelect: () => {}, plates });
      const view = host.querySelector<HTMLElement>(".fund-book-gate-view")!;
      expect(view.getAttribute("role")).toBe("group");
      expect(view.tabIndex).toBe(0);
      expect(host.querySelector(".fund-book-gate")?.getAttribute("aria-hidden")).toBe("true");
      const marks = () => [...host.querySelectorAll<HTMLElement>(".fund-book-gate-mark")];
      expect(marks().map((mark) => mark.getAttribute("aria-current"))).toEqual(["true", null, null]);
      expect(host.querySelector(".fund-book-gate-line")?.textContent).toContain(`Hydro stands in the gate: day 18, ${formatCad(14230)}.`);
      const key = (key: string) => act(async () => { view.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true })); });
      await key("ArrowRight");
      expect(marks().map((mark) => mark.getAttribute("aria-current"))).toEqual([null, "true", null]);
      expect(host.querySelector(".fund-book-gate-line")?.textContent).toContain(`Rent stands in the gate: day 25, ${formatCad(185000)}.`);
      await key("End");
      expect(marks()[2]!.getAttribute("aria-current")).toBe("true");
      await key("ArrowRight");
      expect(marks()[2]!.getAttribute("aria-current")).toBe("true");
      await key("Home");
      expect(marks()[0]!.getAttribute("aria-current")).toBe("true");
      await act(async () => host.querySelector<HTMLButtonElement>(".fund-book-gate-step:last-of-type")!.click());
      expect(marks()[1]!.getAttribute("aria-current")).toBe("true");
      await act(async () => marks()[2]!.click());
      expect(marks()[2]!.getAttribute("aria-current")).toBe("true");
      // Ghost paper: dated and fixed, never solid ink and never pencil.
      expect(host.querySelectorAll(".fund-book-ghost")).toHaveLength(3);
      expect(host.querySelector(".fund-book-ghost.is-projected")).toBeNull();
    } finally { await unmount(); }
  });

  it("is already open with no travel under reduced motion, and opens after the first frame otherwise", async () => {
    const household = demo();
    document.documentElement.dataset.motion = "reduced";
    const { host, root, unmount } = mount();
    try {
      await render(root, { household, memberId: BIANCA, today: TODAY, presentation: "desk", selected: "level", onSelect: () => {} });
      expect(host.querySelector(".fund-book")?.getAttribute("data-fund-book-open")).toBe("true");
      const clasp = host.querySelector<HTMLButtonElement>(".fund-book-clasp")!;
      expect(clasp.getAttribute("aria-pressed")).toBe("false");
      await act(async () => clasp.click());
      expect(host.querySelector(".fund-book")?.getAttribute("data-fund-book-open")).toBe("false");
      // A bookmark opens the book as well as selecting the chapter.
      await act(async () => tabs(host)[1]!.click());
      expect(host.querySelector(".fund-book")?.getAttribute("data-fund-book-open")).toBe("true");
    } finally { await unmount(); }
    delete document.documentElement.dataset.motion;
    const second = mount();
    try {
      await act(async () => second.root.render(createElement(FundStandingBook, { household, memberId: BIANCA, today: TODAY, presentation: "desk", selected: "level", onSelect: () => {} })));
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 40)); });
      expect(second.host.querySelector(".fund-book")?.getAttribute("data-fund-book-open")).toBe("true");
    } finally { await second.unmount(); }
  });

  it("on the phone shows one wall and the floor, with real buttons to cross the corner", async () => {
    const household = demo();
    const { host, root, unmount } = mount();
    try {
      await render(root, { household, memberId: BIANCA, today: TODAY, presentation: "phone", selected: "level", onSelect: () => {} });
      expect(host.querySelector<HTMLElement>(".fund-book-leaf.is-left")?.hidden).toBe(false);
      expect(host.querySelector<HTMLElement>(".fund-book-leaf.is-right")?.hidden).toBe(true);
      // The running head stays intact on the one wall: level and state together.
      expect(host.querySelector(".fund-book-leaf.is-left .fund-book-head-level")).not.toBeNull();
      expect(host.querySelector(".fund-book-leaf.is-left .fund-book-head-state")).not.toBeNull();
      const cross = [...host.querySelectorAll<HTMLButtonElement>(".fund-book-cross-button")];
      expect(cross).toHaveLength(2);
      await act(async () => cross[1]!.click());
      expect(host.querySelector<HTMLElement>(".fund-book-leaf.is-left")?.hidden).toBe(true);
      expect(host.querySelector<HTMLElement>(".fund-book-leaf.is-right")?.hidden).toBe(false);
      expect(host.querySelector(".fund-book")?.getAttribute("data-fund-book-face")).toBe("right");
      expect(host.querySelector(".fund-book-floor")).not.toBeNull();
      await render(root, { household, memberId: BIANCA, today: TODAY, presentation: "desk", selected: "level", onSelect: () => {} });
      expect(host.querySelector(".fund-book-cross")).toBeNull();
    } finally { await unmount(); }
  });

  it("gives every rail slot a mechanism from its own plate, and a bare floor where the plate is empty", async () => {
    const household = demo();
    const models = fundPlates({ household, memberId: BIANCA, today: TODAY });
    const { host, root, unmount } = mount();
    try {
      for (const plate of models) {
        const id = plate.id === "fund-level" ? "level" : plate.id === "saving" ? "shelf" : plate.id;
        await render(root, { household, memberId: BIANCA, today: TODAY, presentation: "desk", selected: id as FundWidgetId, onSelect: () => {}, plates: models });
        expect(host.querySelector(".fund-book-chapter")?.textContent).toBe(plate.kicker);
        expect(host.querySelector(".fund-book-figure")?.textContent).toBe(plate.glance);
        if (plate.empty) {
          expect(host.querySelector(".fund-book-floor-note")?.textContent).toBe(plate.empty);
          expect(host.querySelector(".fund-book-stand svg")).toBeNull();
        } else {
          expect(host.querySelector(".fund-book-stand")?.getAttribute("data-plate-primitive")).toBe(plate.figure.primitive);
          expect(host.querySelector(".fund-book-stand svg, .fund-book-stand .fund-book-gate-view")).not.toBeNull();
        }
      }
    } finally { await unmount(); }
  });

  it("leaves the old board in place when the flag is off, and stands the book when it is on", async () => {
    Object.defineProperty(window, "innerWidth", { value: 390, configurable: true });
    const household = demo();
    const props = { household, today: TODAY, view: "household" as const, memberId: BIANCA, busy: false, onOpen: () => {}, onKitchen: () => {}, onOpenAccount: () => {} };
    const open = async (host: HTMLElement) => {
      await act(async () => host.querySelector<HTMLButtonElement>(".fund-ledge-grip")!.click());
      await act(async () => document.querySelector<HTMLButtonElement>(".is-sheet-grip")!.click());
    };
    vi.stubEnv("VITE_FUND_STANDING_BOOK", "0");
    const off = mount();
    try {
      await act(async () => off.root.render(createElement(FundLedge, props)));
      await open(off.host);
      expect(document.querySelector(".fund-board.is-phone")).not.toBeNull();
      expect(document.querySelector(".fund-book")).toBeNull();
      await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    } finally { await off.unmount(); }
    vi.stubEnv("VITE_FUND_STANDING_BOOK", "1");
    const on = mount();
    try {
      await act(async () => on.root.render(createElement(FundLedge, props)));
      await open(on.host);
      expect(document.querySelector(".fund-board.is-phone")).toBeNull();
      expect(document.querySelector(".fund-book.is-phone [role='tablist']")).not.toBeNull();
      expect(document.querySelectorAll(".fund-book [role='tab']")).toHaveLength(6);
      await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    } finally { await on.unmount(); sessionStorage.clear(); }
  });
});

// @vitest-environment jsdom
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FundStandingBook, popupCaption } from "../src/FundStandingBook.tsx";
import { FundBoard } from "../src/FundBoard.tsx";
import {
  accountRegister,
  accountRowAmount,
  accountRowEdge,
  accountRowVerdict,
  accountRows,
  booksPresentationFloor,
  categoryRowVerdict,
  categoryShape,
  compileHousehold,
  formatCad,
  formatDateLabel,
  fundPlates,
  phoneRail,
  railFor,
  registerStrip,
  sectionIsPaged,
  seedDemoHousehold,
  type DeskPlateModel,
  type FundWidgetId,
  type Household,
} from "../src/core/index.ts";
import { FUND_WIDGET_CARD } from "../src/FundDrawer.tsx";

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

function stickies(host: HTMLElement) {
  return [...host.querySelectorAll<HTMLButtonElement>(".fund-book-sticky")];
}

/** The seed plus one personal account and, when asked, one duplicate Visa line the journal will not count. */
function seeded({ duplicate = false }: { duplicate?: boolean } = {}): Household {
  const household = demo();
  const visa = household.accounts.find((account) => account.id === "ACC-VISA")!;
  household.accounts.push({ ...visa, id: "ACC-PERSONAL", name: "A private card", scope: "personal", ownerMemberId: "MEM-002", credit: null, kind: "chequing" });
  if (duplicate) {
    const posted = household.transactions.find((tx) => tx.accountId === "ACC-VISA" && tx.type === "expense" && tx.visibility !== "personal")!;
    household.transactions.push({ ...posted, id: "TXN-TWICE", note: "Posted twice", isDuplicate: true });
  }
  return household;
}

/** What the Books page's household table would print for this account. */
function booksLines(household: Household, accountId: string) {
  const books = compileHousehold(booksPresentationFloor(household, BIANCA, "household"));
  return {
    ink: accountRegister(books, accountId),
    pencil: accountRegister(books, accountId, { recognizedOnly: false }).filter((row) => !row.recognized),
  };
}

function cells(host: HTMLElement, tone: "ink" | "pencil") {
  return [...host.querySelectorAll<HTMLTableRowElement>(`[data-ledger-row="${tone}"]`)].map((tr) => [...tr.cells].map((cell) => cell.textContent));
}

/** The dividers: the fore-edge tablist's tabs, never the flags'. The rail's lead; the rest of the library follows. */
function tabs(host: HTMLElement) {
  return [...host.querySelectorAll<HTMLElement>('.fund-book-edge [role="tab"]')];
}
function railTabs(host: HTMLElement) {
  return [...host.querySelectorAll<HTMLElement>('.fund-book-edge [role="tab"][data-divider="rail"]')];
}
function libraryTabs(host: HTMLElement) {
  return [...host.querySelectorAll<HTMLElement>('.fund-book-edge [role="tab"][data-divider="library"]')];
}

/** The page flags' tablist, if the open section has one. */
function flagList(host: HTMLElement) {
  return host.querySelector<HTMLElement>('.fund-book-flags[role="tablist"]');
}

function flags(host: HTMLElement) {
  return [...host.querySelectorAll<HTMLButtonElement>('.fund-book-flags [role="tab"]')];
}

function selectedFlag(host: HTMLElement) {
  return host.querySelector<HTMLButtonElement>('.fund-book-flags [role="tab"][aria-selected="true"]');
}

const key = (target: HTMLElement, key: string) => act(async () => { target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true })); });

/** The fore-edge contract, read the same way off the book and off the board: the board's tabs, and the book's rail dividers. */
function tabContract(host: HTMLElement) {
  return [...host.querySelectorAll<HTMLElement>('[role="tablist"][aria-label="Fund board"] [role="tab"]:not([data-divider="library"])')].map((tab) => ({
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
        expect(railTabs(host)).toHaveLength(presentation === "phone" ? 6 : 8);
        // Every permitted section is bound in after the rail: fifteen for the custodian, whom the Ask never joins.
        expect(tabs(host)).toHaveLength(15);
        expect(libraryTabs(host)).toHaveLength(presentation === "phone" ? 9 : 7);
        expect(tabs(host).slice(0, presentation === "phone" ? 6 : 8)).toEqual(railTabs(host));
        expect(host.querySelectorAll('.fund-book-edge [aria-selected="true"]')).toHaveLength(1);
        // The Level is one reading: no page flags, so the only tablist on the page is the fore-edge.
        expect(host.querySelectorAll('[role="tablist"]')).toHaveLength(1);
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
        // A library divider follows the same id pattern, controls the book's own page, and is never selected while the host's section shows.
        for (const tab of libraryTabs(host)) {
          expect(tab.id).toBe(presentation === "desk" ? `fund-rail-tab-${tab.getAttribute("data-plate-id") ?? tab.getAttribute("data-fund-widget")}` : `fund-stage-panel-tab-${tab.getAttribute("data-fund-widget")}`);
          expect(tab.getAttribute("aria-controls")).toBe(host.querySelector(".fund-book-room")?.id);
          expect(tab.getAttribute("aria-selected")).toBe("false");
          expect(tab.tabIndex).toBe(-1);
        }
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

  it("gives every rail slot a mechanism from its own plate, a bare floor where the plate is empty, and its first page where the section is paged", async () => {
    const household = demo();
    const models = fundPlates({ household, memberId: BIANCA, today: TODAY });
    const { host, root, unmount } = mount();
    try {
      for (const plate of models) {
        const id = (plate.id === "fund-level" ? "level" : plate.id === "saving" ? "shelf" : plate.id) as FundWidgetId;
        await render(root, { household, memberId: BIANCA, today: TODAY, presentation: "desk", selected: id, onSelect: () => {}, plates: models });
        const first = flags(host)[0] ?? null;
        if (first) {
          // A paged section opens on its first page: the chapter is the first flag's item, not the plate's reading.
          expect(sectionIsPaged(id)).toBe(true);
          expect(host.querySelector(".fund-book-chapter")?.textContent).toContain(first.querySelector(".fund-book-sticky-name")?.textContent);
          expect(host.querySelector(".fund-book")?.getAttribute("data-fund-book-spread")).toBe(id === "accounts" ? "account" : "page");
          continue;
        }
        expect(host.querySelector(".fund-book-chapter")?.textContent).toBe(plate.kicker);
        expect(host.querySelector(".fund-book-figure")?.textContent).toBe(plate.glance);
        expect(host.querySelector(".fund-book")?.getAttribute("data-fund-book-spread")).toBe("chapter");
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

  it("stands one divider per rail slot in rail order, wide and labelled, each with its slot and its place in the sequence", async () => {
    const household = demo();
    const { host, root, unmount } = mount();
    try {
      for (const presentation of ["phone", "desk"] as const) {
        await render(root, { household, memberId: BIANCA, today: TODAY, presentation, selected: "level", onSelect: () => {} });
        const rail = railFor(household, BIANCA, presentation);
        const slots = presentation === "phone" ? phoneRail(rail) : rail;
        const marks = tabs(host);
        expect(railTabs(host).map((mark) => mark.getAttribute("data-fund-widget"))).toEqual(slots);
        const rest = ["level", "swipe", "contribute", "waiting", "next-out", "spoken-for", "week", "shape", "streams", "seven-days", "shelf", "record", "minutes", "ask", "accounts", "settle"]
          .filter((id) => !slots.includes(id as FundWidgetId) && id !== "ask");
        expect(libraryTabs(host).map((mark) => mark.getAttribute("data-fund-widget"))).toEqual(rest);
        marks.forEach((mark, index) => {
          const id = mark.getAttribute("data-fund-widget") as FundWidgetId;
          expect(mark.querySelector(".fund-book-mark-name")?.textContent).toBe(FUND_WIDGET_CARD[id].name);
          // The band is the slot: the stylesheet gives each divider its own band down the edge from it.
          expect((mark as HTMLElement).style.getPropertyValue("--fund-book-slot")).toBe(String(index));
          expect(mark.getAttribute("data-hue")).toBe(String((index % 6) + 1));
          expect(mark.querySelector(".fund-book-mark-name")?.children).toHaveLength(0);
        });
        // The rail is never written by the book.
        expect(JSON.stringify(household.members.find((member) => member.id === BIANCA)?.fundRail ?? null)).toBe(JSON.stringify(seedDemoHousehold({ today: TODAY, environment: "development" }).members.find((member) => member.id === BIANCA)?.fundRail ?? null));
      }
    } finally { await unmount(); }
  });

  it("shows page flags only for the open section and only where that section has items; a section with no items renders no strip", async () => {
    const household = seeded();
    const before = JSON.stringify(household);
    const rows = accountRows(household, BIANCA, TODAY);
    const shape = categoryShape(household, "2026-09", TODAY);
    const models = fundPlates({ household, memberId: BIANCA, today: TODAY });
    const nextOut = models.find((plate) => plate.id === "next-out")!;
    expect(nextOut.figure.primitive).toBe("track");
    const marks = nextOut.figure.primitive === "track" ? nextOut.figure.marks : [];
    expect(marks.length).toBeGreaterThan(1);
    const { host, root, unmount } = mount();
    try {
      const expected: Partial<Record<FundWidgetId, { names: string[]; ids: string[] }>> = {
        accounts: { names: rows.map((row) => row.name), ids: rows.map((row) => row.accountId) },
        "next-out": { names: marks.map((mark) => mark.label), ids: marks.map((_, index) => `mark-${index}`) },
        shape: { names: shape.map((row) => row.label), ids: shape.map((row) => row.subcategoryId) },
      };
      for (const id of ["level", "waiting", "settle", "next-out", "spoken-for", "week", "accounts", "shape", "shelf", "streams"] as FundWidgetId[]) {
        await render(root, { household, memberId: BIANCA, today: TODAY, presentation: "desk", selected: id, onSelect: () => {}, plates: models });
        const want = expected[id];
        const list = flagList(host);
        if (!want) {
          // The seed's waiting plate counts nothing, so it is paged by name and has no pages; every other section here is one reading.
          expect(list).toBeNull();
          expect(host.querySelector(".fund-book-flags-shelf")).toBeNull();
          expect(host.querySelectorAll('[role="tablist"]')).toHaveLength(1);
          if (id === "waiting") expect(host.querySelector(".fund-book-leaf.is-left .fund-book-pencil-note")?.textContent).toBe("Nothing on this section's list yet, so it has no pages.");
          continue;
        }
        expect(list?.getAttribute("aria-label")).toBe(`Pages in ${FUND_WIDGET_CARD[id].name}`);
        const all = flags(host);
        expect(all.map((flag) => flag.querySelector(".fund-book-sticky-name")?.textContent)).toEqual(want.names);
        expect(all.map((flag) => flag.getAttribute("data-flag-id"))).toEqual(want.ids);
        expect(all.every((flag) => flag.tagName === "BUTTON" && flag.getAttribute("type") === "button")).toBe(true);
        // Two tablists, siblings: neither contains the other, and each has exactly one selected tab and one in the tab order.
        expect(host.querySelectorAll('[role="tablist"]')).toHaveLength(2);
        expect(host.querySelector('[role="tablist"] [role="tablist"]')).toBeNull();
        expect(host.querySelector('.fund-book-edge .fund-book-sticky')).toBeNull();
        expect(all.filter((flag) => flag.getAttribute("aria-selected") === "true")).toHaveLength(1);
        expect(all.filter((flag) => flag.tabIndex === 0)).toHaveLength(1);
        expect(all[0]!.getAttribute("aria-selected")).toBe("true");
        // The divider for the open section is the selected one, whether it leads on the rail or follows from the library.
        const selectedDividers = tabs(host).filter((tab) => tab.getAttribute("aria-selected") === "true");
        expect(selectedDividers.map((tab) => tab.getAttribute("data-fund-widget"))).toEqual([id]);
        expect(selectedDividers[0]!.getAttribute("data-divider")).toBe(railFor(household, BIANCA, "desk").includes(id) ? "rail" : "library");
        // The flags control the page: a real tabpanel labelled by the open flag.
        const page = document.getElementById(all[0]!.getAttribute("aria-controls")!)!;
        expect(page.classList.contains("fund-book-room")).toBe(true);
        expect(page.getAttribute("role")).toBe("tabpanel");
        expect(page.getAttribute("aria-labelledby")).toBe(all[0]!.id);
        // Colour is position in the sequence; state is the item's own rule and nothing else.
        all.forEach((flag, index) => expect(flag.getAttribute("data-hue")).toBe(String((index % 6) + 1)));
        if (id === "accounts") {
          expect(all.some((flag) => flag.getAttribute("data-account-id") === "ACC-PERSONAL")).toBe(false);
          for (const row of rows) {
            const flag = all.find((item) => item.getAttribute("data-account-id") === row.accountId)!;
            expect(flag.getAttribute("data-sticky-state")).toBe(accountRowEdge(row));
            expect(flag.getAttribute("aria-label")).toContain(row.accessibilityName);
            expect(flag.textContent).not.toContain("$");
          }
          expect(host.querySelector('[data-account-id="ACC-VISA"]')?.getAttribute("data-sticky-state")).toBe("attention");
          expect(host.querySelector('[data-account-id="ACC-MC"]')?.getAttribute("data-sticky-state")).toBe("clear");
          const fund = rows.filter((row) => row.isFundCard);
          expect(fund).toHaveLength(1);
          expect(all.filter((flag) => flag.classList.contains("is-fund-card")).map((flag) => flag.getAttribute("data-account-id"))).toEqual(fund.map((row) => row.accountId));
        }
        if (id === "shape") {
          shape.forEach((row, index) => expect(all[index]!.getAttribute("data-sticky-state")).toBe(row.verdict === "above" ? "attention" : "clear"));
          expect(all.filter((flag) => flag.getAttribute("data-sticky-state") === "attention")).toHaveLength(shape.filter((row) => row.verdict === "above").length);
        }
        if (id === "next-out") {
          // A mark carries no rule of its own, so its flag carries no state — never a borrowed or invented one.
          expect(all.every((flag) => flag.getAttribute("data-sticky-state") === null)).toBe(true);
        }
      }
      // A waiting plate that counts cards offers one flag per card; an uncountable tally offers none.
      const three = TEN.map((id) => id === "waiting" ? plateWith(id, "attention", { primitive: "tally", count: 3 }) : plateWith(id, "clear"));
      await render(root, { household, memberId: BIANCA, today: TODAY, presentation: "desk", selected: "waiting", onSelect: () => {}, plates: three });
      expect(flags(host).map((flag) => flag.querySelector(".fund-book-sticky-name")?.textContent)).toEqual(["Card 1 of 3", "Card 2 of 3", "Card 3 of 3"]);
      expect(host.querySelectorAll(".fund-book-pocket-svg .fund-book-card")).toHaveLength(3);
      expect(host.querySelectorAll(".fund-book-pocket-svg .fund-book-card.is-drawn")).toHaveLength(1);
      const many = TEN.map((id) => id === "waiting" ? plateWith(id, "attention", { primitive: "tally", count: 40 }) : plateWith(id, "clear"));
      await render(root, { household, memberId: BIANCA, today: TODAY, presentation: "desk", selected: "waiting", onSelect: () => {}, plates: many });
      expect(flagList(host)).toBeNull();
      // A section that is one reading never grows a strip, whatever its figure counts.
      const tallies = TEN.map((id) => id === "settle" ? plateWith(id, "live", { primitive: "tally", count: 4 }) : id === "week" ? plateWith(id, "live", { primitive: "track", days: 7, room: 28, marks: [{ day: 2, cents: 100, label: "Hydro" }, { day: 5, cents: 200, label: "Rent" }] }) : plateWith(id, "clear"));
      for (const id of ["settle", "week", "streams"] as FundWidgetId[]) {
        await render(root, { household, memberId: BIANCA, today: TODAY, presentation: "desk", selected: id, onSelect: () => {}, plates: tallies });
        expect(flagList(host)).toBeNull();
      }
      // The phone shows the same flags for the same section, one row.
      await render(root, { household, memberId: BIANCA, today: TODAY, presentation: "phone", selected: "next-out", onSelect: () => {} });
      expect(host.querySelector(".fund-book.is-phone .fund-book-flags[role=\"tablist\"]")).not.toBeNull();
      expect(flags(host)).toHaveLength(marks.length);
      expect(JSON.stringify(household)).toBe(before);
    } finally { await unmount(); }
  });

  it("opens an item's own page from its flag: an account's books view, an obligation with the gate beneath it, a category against its band", async () => {
    const household = seeded();
    const before = JSON.stringify(household);
    const level = fundPlates({ household, memberId: BIANCA, today: TODAY }).find((plate) => plate.id === "fund-level")!;
    const visa = accountRows(household, BIANCA, TODAY).find((row) => row.accountId === "ACC-VISA")!;
    const seen: FundWidgetId[] = [];
    const { host, root, unmount } = mount();
    try {
      await render(root, { household, memberId: BIANCA, today: TODAY, presentation: "desk", selected: "accounts", onSelect: (id) => seen.push(id) });
      const tabsBefore = tabContract(host);
      await act(async () => host.querySelector<HTMLButtonElement>('[data-account-id="ACC-VISA"]')!.click());
      // A flag is a page inside the section, not a deep link: the host is never asked to move.
      expect(seen).toEqual([]);
      const book = host.querySelector(".fund-book")!;
      expect(book.getAttribute("data-fund-book-spread")).toBe("account");
      expect(book.getAttribute("data-fund-book-account")).toBe("ACC-VISA");
      expect(book.getAttribute("data-fund-book-page")).toBe("ACC-VISA");
      expect(selectedFlag(host)?.getAttribute("data-account-id")).toBe("ACC-VISA");
      expect(host.querySelectorAll('.fund-book-flags [aria-selected="true"]')).toHaveLength(1);
      expect(host.querySelector(".fund-book-room")?.getAttribute("aria-labelledby")).toBe(selectedFlag(host)?.id);
      // The books view: the counted register as the Books page prints it, row for row, in ink on the left wall.
      const lines = booksLines(household, "ACC-VISA");
      expect(lines.ink.length).toBeGreaterThan(2);
      expect(cells(host, "ink")).toEqual(lines.ink.map((row) => [
        formatDateLabel(row.date), row.memo, row.debitCents ? formatCad(row.debitCents) : "", row.creditCents ? formatCad(row.creditCents) : "", formatCad(row.runningCents),
      ]));
      expect(host.querySelector(".fund-book-leaf.is-left .fund-book-lines.is-ink")).not.toBeNull();
      expect(cells(host, "pencil")).toEqual([]);
      expect(host.querySelector(".fund-book-chapter")?.textContent).toBe("Visa");
      expect(host.querySelector(".fund-book-figure")?.textContent).toBe(accountRowAmount(visa));
      expect(host.querySelector(".fund-book-head-level")?.textContent).toBe(level.glance);
      expect(host.querySelector(".fund-book-plinth-footing")?.textContent).toContain("the Fund's card");
      expect(host.querySelector(".fund-book-plinth-verdict")?.textContent).toBe(accountRowVerdict(visa));
      // The fore-edge is exactly what it was.
      expect(tabContract(host)).toEqual(tabsBefore);
      // Next out: the flag and the gate are one cursor. Picking a flag stands that mark in the gate; the gate's own keys move the flag.
      await render(root, { household, memberId: BIANCA, today: TODAY, presentation: "desk", selected: "next-out", onSelect: (id) => seen.push(id) });
      const nextOut = fundPlates({ household, memberId: BIANCA, today: TODAY }).find((plate) => plate.id === "next-out")!;
      const marks = nextOut.figure.primitive === "track" ? nextOut.figure.marks : [];
      expect(host.querySelector(".fund-book")?.getAttribute("data-fund-book-spread")).toBe("page");
      expect(host.querySelector(".fund-book-chapter")?.textContent).toBe(marks[0]!.label);
      expect(host.querySelector(".fund-book-figure")?.textContent).toBe(formatCad(marks[0]!.cents));
      expect(host.querySelector(".fund-book-gate-view")).not.toBeNull();
      await act(async () => flags(host)[2]!.click());
      expect(host.querySelector(".fund-book-chapter")?.textContent).toBe(marks[2]!.label);
      expect(host.querySelector(".fund-book-figure")?.textContent).toBe(formatCad(marks[2]!.cents));
      expect(host.querySelector(".fund-book-verdict")?.textContent).toContain(`day ${marks[2]!.day}`);
      expect([...host.querySelectorAll(".fund-book-gate-mark")].map((mark) => mark.getAttribute("aria-current"))).toEqual(marks.map((_, index) => index === 2 ? "true" : null));
      expect(host.querySelector(".fund-book-gate-line")?.textContent).toContain(`${marks[2]!.label} stands in the gate`);
      expect(host.querySelector(".fund-book-plinth-footing")?.textContent).toBe(`Next out · page 3 of ${marks.length}`);
      await key(host.querySelector<HTMLElement>(".fund-book-gate-view")!, "ArrowLeft");
      expect(selectedFlag(host)?.getAttribute("data-flag-id")).toBe("mark-1");
      expect(host.querySelector(".fund-book-chapter")?.textContent).toBe(marks[1]!.label);
      await act(async () => host.querySelector<HTMLButtonElement>(".fund-book-gate-step:last-of-type")!.click());
      expect(selectedFlag(host)?.getAttribute("data-flag-id")).toBe("mark-2");
      // A mark is ghost paper: standing, never projected pencil, never a fold.
      expect(host.querySelector(".is-projected.is-standing")).toBeNull();
      expect(host.querySelectorAll(".fund-book-ghost")).toHaveLength(marks.length);
      // The shape: a category page draws the row's own band and month to date, and says the row's own verdict.
      await render(root, { household, memberId: BIANCA, today: TODAY, presentation: "desk", selected: "shape", onSelect: (id) => seen.push(id) });
      const shape = categoryShape(household, "2026-09", TODAY);
      const over = shape.findIndex((row) => row.verdict === "above");
      const unknown = shape.findIndex((row) => row.verdict === "unknown" || row.verdict === "one-off");
      expect(over).toBeGreaterThanOrEqual(0);
      expect(unknown).toBeGreaterThanOrEqual(0);
      await act(async () => flags(host)[over]!.click());
      expect(host.querySelector(".fund-book-chapter")?.textContent).toBe(shape[over]!.label);
      expect(host.querySelector(".fund-book-figure")?.textContent).toBe(`${formatCad(shape[over]!.monthToDateCents)} this month`);
      expect(host.querySelector(".fund-book-verdict")?.textContent).toBe(categoryRowVerdict(shape[over]!));
      expect(host.querySelector(".fund-book-plinth-verdict")?.textContent).toBe(categoryRowVerdict(shape[over]!));
      expect(host.querySelector(".fund-book-leaf.is-right .fund-book-pencil-note")?.textContent).toContain(formatCad(shape[over]!.bandHighCents));
      expect(host.querySelectorAll(".fund-book-stand .fund-book-panel")).toHaveLength(2);
      expect(host.querySelector(".fund-book-stand .fund-book-corner")).toBeNull();
      expect(host.querySelector(".is-projected.is-standing")).toBeNull();
      await act(async () => flags(host)[unknown]!.click());
      expect(host.querySelector(".fund-book-chapter")?.textContent).toBe(shape[unknown]!.label);
      expect(host.querySelector(".fund-book-stand svg")).toBeNull();
      expect(host.querySelector(".fund-book-floor-note")?.textContent).toContain("Not enough history yet");
      expect(host.querySelector(".fund-book-leaf.is-right .fund-book-pencil-note")?.textContent).toContain("a band would be a guess");
      expect(seen).toEqual([]);
      expect(JSON.stringify(household)).toBe(before);
    } finally { await unmount(); }
  });

  it("remembers the page each section was left on, opens a section never visited on its first, and roves each strip on its own", async () => {
    const household = seeded();
    const { host, root, unmount } = mount();
    try {
      await render(root, { household, memberId: BIANCA, today: TODAY, presentation: "desk", selected: "accounts", onSelect: () => {} });
      await act(async () => flags(host)[3]!.click());
      const third = flags(host)[3]!.getAttribute("data-flag-id");
      expect(selectedFlag(host)?.getAttribute("data-flag-id")).toBe(third);
      // The host moves to a section never visited: its first page opens, and no account flag survives on the page.
      await render(root, { household, memberId: BIANCA, today: TODAY, presentation: "desk", selected: "next-out", onSelect: () => {} });
      expect(host.querySelectorAll('.fund-book-flags [aria-selected="true"]')).toHaveLength(1);
      expect(selectedFlag(host)?.getAttribute("data-flag-id")).toBe("mark-0");
      expect(host.querySelector("[data-account-id]")).toBeNull();
      expect(host.querySelector(".fund-book")?.getAttribute("data-fund-book-account")).toBeNull();
      await act(async () => flags(host)[1]!.click());
      expect(selectedFlag(host)?.getAttribute("data-flag-id")).toBe("mark-1");
      // To a section with no pages: no strip, no selected flag anywhere, the plate's own reading.
      await render(root, { household, memberId: BIANCA, today: TODAY, presentation: "desk", selected: "level", onSelect: () => {} });
      expect(flagList(host)).toBeNull();
      expect(host.querySelector('[role="tab"][aria-selected="true"]')?.getAttribute("data-fund-widget")).toBe("level");
      expect(host.querySelector(".fund-book")?.getAttribute("data-fund-book-page")).toBeNull();
      expect(host.querySelector(".fund-book")?.getAttribute("data-fund-book-spread")).toBe("chapter");
      // Back to the accounts: the page it was left on, as a reader's binder keeps its place — and next out keeps its own.
      await render(root, { household, memberId: BIANCA, today: TODAY, presentation: "desk", selected: "accounts", onSelect: () => {} });
      expect(selectedFlag(host)?.getAttribute("data-flag-id")).toBe(third);
      expect(host.querySelector(".fund-book")?.getAttribute("data-fund-book-account")).toBe(third);
      await render(root, { household, memberId: BIANCA, today: TODAY, presentation: "desk", selected: "next-out", onSelect: () => {} });
      expect(selectedFlag(host)?.getAttribute("data-flag-id")).toBe("mark-1");
      // A section visited for the first time still opens on its first page.
      await render(root, { household, memberId: BIANCA, today: TODAY, presentation: "desk", selected: "shape", onSelect: () => {} });
      expect(selectedFlag(host)?.getAttribute("data-flag-id")).toBe(flags(host)[0]!.getAttribute("data-flag-id"));
      await render(root, { household, memberId: BIANCA, today: TODAY, presentation: "desk", selected: "accounts", onSelect: () => {} });
      expect(selectedFlag(host)?.getAttribute("data-flag-id")).toBe(third);
      // Nothing about the place is written anywhere: the household is untouched and no storage is used.
      expect(host.querySelector(".fund-book")?.getAttribute("data-fund-book-page")).toBe(third);
      // Arrows in the flag strip rove the flags and never the dividers; arrows on a divider rove the dividers and never the flags.
      const strip = flags(host);
      strip[0]!.focus();
      await key(strip[0]!, "ArrowRight");
      expect(document.activeElement).toBe(strip[1]);
      await key(strip[1]!, "End");
      expect(document.activeElement).toBe(strip[strip.length - 1]);
      await key(strip[strip.length - 1]!, "ArrowRight");
      expect(document.activeElement).toBe(strip[0]);
      await key(strip[0]!, "ArrowUp");
      expect(document.activeElement).toBe(strip[strip.length - 1]);
      await key(strip[strip.length - 1]!, "Home");
      expect(document.activeElement).toBe(strip[0]);
      // Roving is focus only: the open page is still the one remembered, as the board's own dividers behave.
      expect(selectedFlag(host)).toBe(strip[3]);
      const dividers = tabs(host);
      const selectedDivider = dividers.find((tab) => tab.tabIndex === 0)!;
      selectedDivider.focus();
      await key(selectedDivider, "ArrowRight");
      expect(dividers).toContain(document.activeElement);
      expect(strip).not.toContain(document.activeElement);
      // One tab stop per strip: the selected divider and the open flag; every other tab is reached by arrow.
      expect(dividers.filter((tab) => tab.tabIndex === 0)).toHaveLength(1);
      expect(strip.filter((flag) => flag.tabIndex === 0)).toHaveLength(1);
      expect(strip.filter((flag) => flag.tabIndex === 0)[0]).toBe(selectedFlag(host));
      // Every flag is at least a 44px hit target by rule, however thin the paper: the stylesheet says so on the button itself.
      expect(strip.every((flag) => flag.classList.contains("fund-book-sticky"))).toBe(true);
    } finally { await unmount(); }
  });

  it("lets a phone member whose rail has no accounts slot open the accounts section from a library divider and read an account's page, without moving the host", async () => {
    const household = seeded();
    const before = JSON.stringify(household);
    const seen: FundWidgetId[] = [];
    const { host, root, unmount } = mount();
    try {
      await render(root, { household, memberId: BIANCA, today: TODAY, presentation: "phone", selected: "level", onSelect: (id) => seen.push(id) });
      expect(railFor(household, BIANCA, "phone")).not.toContain("accounts");
      expect(railTabs(host).map((tab) => tab.getAttribute("data-fund-widget"))).not.toContain("accounts");
      const tabsBefore = tabContract(host);
      const accounts = host.querySelector<HTMLButtonElement>('.fund-book-edge [data-fund-widget="accounts"]')!;
      expect(accounts.getAttribute("data-divider")).toBe("library");
      await act(async () => accounts.click());
      // The book opened the section itself: the host was never asked, the rail's ids and targets are what they were,
      // and the one selected tab on the fore-edge is now the library divider, so the tablist still has exactly one.
      expect(seen).toEqual([]);
      expect(tabContract(host).map((tab) => [tab.id, tab.controls])).toEqual(tabsBefore.map((tab) => [tab.id, tab.controls]));
      expect(tabContract(host).every((tab) => tab.selected === "false" && tab.tabIndex === -1)).toBe(true);
      expect(host.querySelector(".fund-book")?.getAttribute("data-fund-book-section")).toBe("accounts");
      expect(accounts.getAttribute("aria-selected")).toBe("true");
      expect(host.querySelectorAll('.fund-book-edge [aria-selected="true"]')).toHaveLength(1);
      expect(flagList(host)?.getAttribute("aria-label")).toBe("Pages in The accounts");
      const rows = accountRows(household, BIANCA, TODAY);
      expect(flags(host)).toHaveLength(rows.length);
      // An account's page, on the phone: the counted lines as the Books page prints them, and the pop-up control.
      await act(async () => host.querySelector<HTMLButtonElement>('[data-account-id="ACC-CHEQUING"]')!.click());
      expect(host.querySelector(".fund-book")?.getAttribute("data-fund-book-account")).toBe("ACC-CHEQUING");
      const lines = booksLines(household, "ACC-CHEQUING");
      expect(lines.ink.length).toBeGreaterThan(0);
      expect(cells(host, "ink").map((row) => row[4])).toEqual(lines.ink.map((row) => formatCad(row.runningCents)));
      expect(host.querySelector(".fund-book-raise")).not.toBeNull();
      expect(seen).toEqual([]);
      // A rail divider lets the library section go through the host, as always.
      await act(async () => railTabs(host)[2]!.click());
      expect(seen).toEqual(["waiting"]);
      await render(root, { household, memberId: BIANCA, today: TODAY, presentation: "phone", selected: "waiting", onSelect: (id) => seen.push(id) });
      expect(host.querySelector(".fund-book")?.getAttribute("data-fund-book-section")).toBe("waiting");
      expect(accounts.getAttribute("aria-selected")).toBe("false");
      // Reopened from the library, the section is on the page it was left on; the host moving on lets it go again.
      await act(async () => accounts.click());
      expect(host.querySelector(".fund-book")?.getAttribute("data-fund-book-account")).toBe("ACC-CHEQUING");
      await render(root, { household, memberId: BIANCA, today: TODAY, presentation: "phone", selected: "level", onSelect: (id) => seen.push(id) });
      expect(host.querySelector(".fund-book")?.getAttribute("data-fund-book-section")).toBe("level");
      // A contributor's phone gets the Ask as well; nobody gets a section they may not open.
      await render(root, { household, memberId: "MEM-002", today: TODAY, presentation: "phone", selected: "level", onSelect: () => {} });
      expect(tabs(host)).toHaveLength(16);
      expect(tabs(host).map((tab) => tab.getAttribute("data-fund-widget"))).toContain("ask");
      expect(JSON.stringify(household)).toBe(before);
    } finally { await unmount(); }
  });

  it("captions the pop-up with the paper actually folded on the page, never the whole register", async () => {
    const household = seeded({ duplicate: true });
    document.documentElement.dataset.motion = "reduced";
    const { host, root, unmount } = mount();
    try {
      await render(root, { household, memberId: BIANCA, today: TODAY, presentation: "desk", selected: "accounts", onSelect: () => {} });
      for (const accountId of ["ACC-VISA", "ACC-CASH", "ACC-SAVINGS", "ACC-CLAIMS"]) {
        await act(async () => host.querySelector<HTMLButtonElement>(`[data-account-id="${accountId}"]`)!.click());
        const lines = booksLines(household, accountId);
        const strip = registerStrip(lines.ink.map((row) => row.runningCents), lines.pencil.length);
        const standing = host.querySelectorAll(".fund-book-popup .fund-book-panel.is-standing").length;
        const flat = host.querySelectorAll(".fund-book-popup .fund-book-pencil.is-projected").length;
        const caption = host.querySelector(".fund-book-popup-line, .fund-book-popup .fund-book-floor-note")?.textContent ?? "";
        expect(caption).toBe(popupCaption(strip, lines));
        if (strip.actualCount >= 2) {
          // The ink points on the page are the standing panels plus one; the caption names that number and no larger one.
          expect(standing).toBe(strip.actualCount - 1);
          expect(flat).toBe(strip.points.length - strip.actualCount);
          expect(caption).toContain(strip.actualCount < lines.ink.length ? `the last ${strip.actualCount} of ${lines.ink.length} lines` : `all ${strip.actualCount} lines`);
          if (strip.actualCount < lines.ink.length) expect(caption).not.toMatch(new RegExp(`${lines.ink.length} lines (the journal counts)? ?stand`));
          if (flat) expect(caption).toContain(`Flat in pencil: the ${flat} line`);
          else expect(caption).toContain("Nothing lies in pencil.");
        } else {
          expect(caption).toBe("One line is not a walk yet.");
          expect(standing).toBe(0);
        }
      }
      // The sentence by hand: a windowed register, a whole one, a windowed pencil, and a single line.
      const row = (runningCents: number) => ({ entryId: "e", date: "2026-09-01", memo: "m", debitCents: 0, creditCents: 0, runningCents, recognized: true });
      const sixty = Array.from({ length: 60 }, (_, index) => row(index));
      expect(popupCaption(registerStrip(sixty.map((line) => line.runningCents), 1), { ink: sixty, pencil: [row(0)] }))
        .toBe("Folded here in ink: the last 23 of 60 lines the journal counts. Flat in pencil: the 1 line it does not.");
      expect(popupCaption(registerStrip([1, 2, 3], 0), { ink: [row(1), row(2), row(3)], pencil: [] }))
        .toBe("Folded here in ink: all 3 lines the journal counts. Nothing lies in pencil.");
      expect(popupCaption(registerStrip(sixty.map((line) => line.runningCents), 40), { ink: sixty, pencil: Array.from({ length: 40 }, () => row(0)) }))
        .toBe("Folded here in ink: the last 12 of 60 lines the journal counts. Flat in pencil: 12 of the 40 lines it does not.");
      expect(popupCaption(registerStrip([5], 0), { ink: [row(5)], pencil: [] })).toBe("One line is not a walk yet.");
    } finally { await unmount(); }
  });

  it("lays an uncounted row in pencil on the right wall and never stands it; the ink is still the Books page's register", async () => {
    const household = seeded({ duplicate: true });
    document.documentElement.dataset.motion = "reduced";
    const { host, root, unmount } = mount();
    try {
      await render(root, { household, memberId: BIANCA, today: TODAY, presentation: "desk", selected: "accounts", onSelect: () => {} });
      await act(async () => host.querySelector<HTMLButtonElement>('[data-account-id="ACC-VISA"]')!.click());
      const lines = booksLines(household, "ACC-VISA");
      expect(lines.pencil).toHaveLength(1);
      expect(lines.pencil[0]!.memo).toBe("Posted twice");
      // Ink: exactly the counted register. The duplicate is not among the ink lines and moves no running figure.
      expect(cells(host, "ink").map((row) => row[4])).toEqual(lines.ink.map((row) => formatCad(row.runningCents)));
      expect(cells(host, "ink").some((row) => row[1] === "Posted twice")).toBe(false);
      // Pencil: the uncounted row, on the right wall, with no running figure.
      expect(host.querySelector(".fund-book-leaf.is-right .fund-book-lines.is-pencil")).not.toBeNull();
      expect(cells(host, "pencil")).toEqual([[formatDateLabel(lines.pencil[0]!.date), "Posted twice", "", formatCad(lines.pencil[0]!.creditCents), "excluded"]]);
      // Raised (already, under reduced motion): the concertina stands the ink and lays the pencil flat, one flat panel per uncounted row.
      const strip = registerStrip(lines.ink.map((row) => row.runningCents), lines.pencil.length);
      expect(host.querySelector(".fund-book-popup")?.getAttribute("data-fund-book-popup")).toBe("raised");
      expect(host.querySelectorAll(".fund-book-popup .fund-book-panel.is-standing")).toHaveLength(strip.actualCount - 1);
      expect(host.querySelectorAll(".fund-book-popup .fund-book-pencil.is-projected")).toHaveLength(lines.pencil.length);
      expect(host.querySelector(".fund-book-popup .is-projected.is-standing")).toBeNull();
      expect(host.querySelectorAll(".fund-book-popup .fund-book-corner")).toHaveLength(1);
      expect(host.querySelector(".fund-book-popup-line")?.textContent).toBe(`Folded here in ink: the last ${strip.actualCount} of ${lines.ink.length} lines the journal counts. Flat in pencil: the 1 line it does not.`);
      // A card also gets the ruled band, at the plate's own mark.
      expect(host.querySelector(".fund-book-popup .fund-book-band")).not.toBeNull();
      expect(host.querySelector(".fund-book-popup .fund-book-band-fill.is-over")).not.toBeNull();
      // A non-card gets no band, and with nothing uncounted the right wall says so.
      await act(async () => host.querySelector<HTMLButtonElement>('[data-account-id="ACC-SAVINGS"]')!.click());
      expect(host.querySelector(".fund-book-popup .fund-book-band")).toBeNull();
      expect(host.querySelector(".fund-book-popup .fund-book-concertina")).not.toBeNull();
      expect(host.querySelector(".fund-book-popup .is-projected")).toBeNull();
      expect(host.querySelector(".fund-book-leaf.is-right .fund-book-pencil-note")?.textContent).toBe("Every line on this account is counted. Nothing lies in pencil.");
    } finally { await unmount(); }
  });

  it("raises and lays the lines by keyboard through a real button, lands raised under reduced motion, and keeps Escape to itself", async () => {
    const household = seeded();
    const { host, root, unmount } = mount();
    const escapes: Event[] = [];
    const onDocumentEscape = (event: KeyboardEvent) => { if (event.key === "Escape") escapes.push(event); };
    document.addEventListener("keydown", onDocumentEscape);
    try {
      await render(root, { household, memberId: BIANCA, today: TODAY, presentation: "desk", selected: "accounts", onSelect: () => {} });
      await act(async () => host.querySelector<HTMLButtonElement>('[data-account-id="ACC-CHEQUING"]')!.click());
      const raise = host.querySelector<HTMLButtonElement>(".fund-book-raise")!;
      expect(raise.tagName).toBe("BUTTON");
      expect(raise.tabIndex).toBe(0);
      expect(raise.getAttribute("aria-expanded")).toBe("false");
      const stand = document.getElementById(raise.getAttribute("aria-controls")!)!;
      expect(stand.hidden).toBe(true);
      expect(host.querySelector(".fund-book-popup")?.getAttribute("data-fund-book-popup")).toBe("flat");
      expect(host.querySelector(".fund-book-lines.is-ink")).not.toBeNull();
      // Enter or Space on a focused button is a click: raise, then lay flat.
      raise.focus();
      expect(document.activeElement).toBe(raise);
      await act(async () => raise.click());
      expect(raise.getAttribute("aria-expanded")).toBe("true");
      expect(stand.hidden).toBe(false);
      expect(host.querySelector(".fund-book-popup .fund-book-concertina")).not.toBeNull();
      expect(host.querySelector(".fund-book-popup .fund-book-band")).toBeNull();
      await act(async () => raise.click());
      expect(raise.getAttribute("aria-expanded")).toBe("false");
      expect(stand.hidden).toBe(true);
      // Escape on the control lays a raised pop-up flat and stops there; a flat one lets Escape pass to the ledge.
      await act(async () => raise.click());
      await act(async () => { raise.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
      expect(raise.getAttribute("aria-expanded")).toBe("false");
      expect(escapes).toHaveLength(0);
      await act(async () => { raise.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
      expect(escapes).toHaveLength(1);
      // The lines stay on the wall whether the pop-up stands or lies.
      expect(host.querySelector(".fund-book-lines.is-ink")).not.toBeNull();
    } finally { document.removeEventListener("keydown", onDocumentEscape); await unmount(); }
    document.documentElement.dataset.motion = "reduced";
    const second = mount();
    try {
      await act(async () => second.root.render(createElement(FundStandingBook, { household, memberId: BIANCA, today: TODAY, presentation: "phone", selected: "accounts", onSelect: () => {} })));
      await act(async () => second.host.querySelector<HTMLButtonElement>('[data-account-id="ACC-CHEQUING"]')!.click());
      expect(second.host.querySelector(".fund-book-popup")?.getAttribute("data-fund-book-popup")).toBe("raised");
      expect(second.host.querySelector(".fund-book-raise")?.getAttribute("aria-expanded")).toBe("true");
      await act(async () => second.host.querySelector<HTMLButtonElement>(".fund-book-raise")!.click());
      expect(second.host.querySelector(".fund-book-popup")?.getAttribute("data-fund-book-popup")).toBe("flat");
      // On the phone the flags are still a tablist of real buttons above the room.
      expect(second.host.querySelector(".fund-book.is-phone .fund-book-flags[role=\"tablist\"]")).not.toBeNull();
      expect(stickies(second.host).length).toBeGreaterThan(0);
    } finally { await second.unmount(); }
  });

  it("shows an honest empty for an account with no line in the journal, never a zero figure", async () => {
    const household = seeded();
    const rows = accountRows(household, BIANCA, TODAY);
    const empty = rows.filter((row) => { const lines = booksLines(household, row.accountId); return !lines.ink.length && !lines.pencil.length; });
    expect(empty.length).toBeGreaterThan(0);
    const { host, root, unmount } = mount();
    try {
      await render(root, { household, memberId: BIANCA, today: TODAY, presentation: "desk", selected: "accounts", onSelect: () => {} });
      for (const row of empty) {
        const sticky = host.querySelector<HTMLButtonElement>(`[data-account-id="${row.accountId}"]`)!;
        expect(sticky.getAttribute("aria-label")).toContain("No postings yet");
        expect(sticky.getAttribute("aria-label")).not.toContain("$");
        expect(sticky.textContent).not.toContain("$");
        await act(async () => sticky.click());
        expect(host.querySelector(".fund-book-figure")?.textContent).toBe("No postings yet");
        expect(host.querySelector(".fund-book-leaf.is-left .fund-book-lines")).toBeNull();
        expect(host.querySelector(".fund-book-leaf.is-left .fund-book-pencil-note")?.textContent).toBe("No postings yet.");
        expect(host.querySelector(".fund-book-raise")).toBeNull();
        expect(host.querySelector(".fund-book-floor-note")?.textContent).toBe("No postings yet. Nothing to raise.");
        expect(host.querySelector(".fund-book-plinth-verdict")?.textContent).toBe("No postings yet.");
        expect(host.querySelector(".fund-book-floor")?.textContent).not.toContain("$0.00");
      }
      // A posted account with a real figure still says it, in the flag's spoken name and on the page.
      const posted = rows.find((row) => booksLines(household, row.accountId).ink.length > 0)!;
      expect(host.querySelector(`[data-account-id="${posted.accountId}"]`)?.getAttribute("aria-label")).toContain(accountRowAmount(posted));
      await act(async () => host.querySelector<HTMLButtonElement>(`[data-account-id="${posted.accountId}"]`)!.click());
      expect(host.querySelector(".fund-book-figure")?.textContent).toBe(accountRowAmount(posted));
    } finally { await unmount(); }
  });

  // K1 (Tool Atlas §7): the phone Fund ledge that hosted the board is retired; the Office host keeps the flag (test/fund-standing-book.test.ts).
});

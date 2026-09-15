// @vitest-environment jsdom
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FundStandingBook } from "../src/FundStandingBook.tsx";
import { FundBoard } from "../src/FundBoard.tsx";
import { FundLedge } from "../src/FundLedge.tsx";
import {
  accountRegister,
  accountRowAmount,
  accountRowVerdict,
  accountRows,
  booksPresentationFloor,
  compileHousehold,
  formatCad,
  formatDateLabel,
  fundPlates,
  registerStrip,
  seedDemoHousehold,
  type DeskPlateModel,
  type FundWidgetId,
  type Household,
} from "../src/core/index.ts";

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

  it("stands one sticky per shared account on the head, none for a personal one, marks the Fund's card, and keeps the tablist as it was", async () => {
    const household = seeded();
    const before = JSON.stringify(household);
    const rows = accountRows(household, BIANCA, TODAY);
    const { host, root, unmount } = mount();
    try {
      for (const presentation of ["phone", "desk"] as const) {
        await render(root, { household, memberId: BIANCA, today: TODAY, presentation, selected: "level", onSelect: () => {} });
        const group = host.querySelector('.fund-book-head-edge[role="group"]');
        expect(group?.getAttribute("aria-label")).toBe("Accounts linked to the Fund");
        const all = stickies(host);
        expect(all).toHaveLength(rows.length);
        expect(all.map((sticky) => sticky.getAttribute("data-account-id"))).toEqual(rows.map((row) => row.accountId));
        expect(all.some((sticky) => sticky.getAttribute("data-account-id") === "ACC-PERSONAL")).toBe(false);
        expect(all.every((sticky) => sticky.tagName === "BUTTON" && sticky.getAttribute("type") === "button")).toBe(true);
        // A separate control group: never a tab, never selected, never inside the tablist.
        expect(all.every((sticky) => sticky.getAttribute("role") === null && sticky.getAttribute("aria-selected") === null)).toBe(true);
        expect(host.querySelector('[role="tablist"] .fund-book-sticky')).toBeNull();
        expect(tabs(host)).toHaveLength(presentation === "phone" ? 6 : 8);
        expect(host.querySelectorAll('[aria-selected="true"]')).toHaveLength(1);
        // The Fund's backing card is the one marked sticky.
        const fund = rows.filter((row) => row.isFundCard);
        expect(fund).toHaveLength(1);
        const marked = all.filter((sticky) => sticky.classList.contains("is-fund-card"));
        expect(marked.map((sticky) => sticky.getAttribute("data-account-id"))).toEqual(fund.map((row) => row.accountId));
        expect(marked[0]!.getAttribute("aria-label")).toContain("The Fund's card");
        // Each sticky says the figure the accounts plate says, and its state is the plate's test.
        for (const row of rows) {
          const sticky = all.find((item) => item.getAttribute("data-account-id") === row.accountId)!;
          const lines = booksLines(household, row.accountId);
          if (lines.ink.length || lines.pencil.length) {
            expect(sticky.querySelector(".fund-book-sticky-figure")?.textContent).toBe(accountRowAmount(row));
          }
          const attention = (row.utilization ?? 0) > 0.3 || (row.kind !== "credit" && row.balanceCents < 0);
          expect(sticky.getAttribute("data-sticky-state")).toBe(attention ? "attention" : "clear");
        }
        expect(host.querySelector('[data-account-id="ACC-VISA"]')?.getAttribute("data-sticky-state")).toBe("attention");
        expect(host.querySelector('[data-account-id="ACC-MC"]')?.getAttribute("data-sticky-state")).toBe("clear");
      }
      // A member with no personal Fund card sees every shared sticky and no mark.
      await render(root, { household, memberId: "MEM-002", today: TODAY, presentation: "desk", selected: "level", onSelect: () => {} });
      expect(stickies(host)).toHaveLength(accountRows(household, "MEM-002", TODAY).length);
      expect(host.querySelector(".fund-book-sticky.is-fund-card")).toBeNull();
      expect(JSON.stringify(household)).toBe(before);
    } finally { await unmount(); }
  });

  it("picks a sticky as a deep link: onSelect(\"accounts\") fires, the account is focused, and the spread becomes its books view", async () => {
    const household = seeded();
    const before = JSON.stringify(household);
    const level = fundPlates({ household, memberId: BIANCA, today: TODAY }).find((plate) => plate.id === "fund-level")!;
    const visa = accountRows(household, BIANCA, TODAY).find((row) => row.accountId === "ACC-VISA")!;
    const seen: FundWidgetId[] = [];
    const { host, root, unmount } = mount();
    try {
      await render(root, { household, memberId: BIANCA, today: TODAY, presentation: "desk", selected: "level", onSelect: (id) => seen.push(id) });
      expect(host.querySelector(".fund-book")?.getAttribute("data-fund-book-spread")).toBe("chapter");
      await act(async () => host.querySelector<HTMLButtonElement>('[data-account-id="ACC-VISA"]')!.click());
      expect(seen).toEqual(["accounts"]);
      // The host answers by selecting the chapter, as it does for a bookmark.
      await render(root, { household, memberId: BIANCA, today: TODAY, presentation: "desk", selected: "accounts", onSelect: (id) => seen.push(id) });
      const book = host.querySelector(".fund-book")!;
      expect(book.getAttribute("data-fund-book-spread")).toBe("account");
      expect(book.getAttribute("data-fund-book-account")).toBe("ACC-VISA");
      expect(host.querySelector('[data-account-id="ACC-VISA"]')?.getAttribute("aria-pressed")).toBe("true");
      expect(host.querySelectorAll('.fund-book-sticky[aria-pressed="true"]')).toHaveLength(1);
      expect(host.querySelector('[data-fund-widget="accounts"]')?.getAttribute("aria-selected")).toBe("true");
      // The books view: the counted register as the Books page prints it, row for row, in ink on the left wall.
      const lines = booksLines(household, "ACC-VISA");
      expect(lines.ink.length).toBeGreaterThan(2);
      expect(cells(host, "ink")).toEqual(lines.ink.map((row) => [
        formatDateLabel(row.date), row.memo, row.debitCents ? formatCad(row.debitCents) : "", row.creditCents ? formatCad(row.creditCents) : "", formatCad(row.runningCents),
      ]));
      expect(host.querySelector(".fund-book-leaf.is-left .fund-book-lines.is-ink")).not.toBeNull();
      expect(host.querySelector(".fund-book-leaf.is-right .fund-book-lines")).toBeNull();
      expect(cells(host, "pencil")).toEqual([]);
      // The chapter and figure are the account's, said the plate's way; the running head keeps the Fund's level; the plinth carries the account.
      expect(host.querySelector(".fund-book-chapter")?.textContent).toBe("Visa");
      expect(host.querySelector(".fund-book-figure")?.textContent).toBe(accountRowAmount(visa));
      expect(host.querySelector(".fund-book-head-level")?.textContent).toBe(level.glance);
      expect(host.querySelector(".fund-book-plinth-footing")?.textContent).toContain("Visa");
      expect(host.querySelector(".fund-book-plinth-footing")?.textContent).toContain("the Fund's card");
      expect(host.querySelector(".fund-book-plinth-verdict")?.textContent).toBe(accountRowVerdict(visa));
      // Nothing here is a tab; the tablist is exactly what it was.
      expect(tabs(host)).toHaveLength(8);
      expect(host.querySelectorAll('[aria-selected="true"]')).toHaveLength(1);
      // Picking the same sticky again lets go of it: the chapter shows its plate, as before.
      await act(async () => host.querySelector<HTMLButtonElement>('[data-account-id="ACC-VISA"]')!.click());
      expect(seen).toEqual(["accounts", "accounts"]);
      expect(host.querySelector(".fund-book")?.getAttribute("data-fund-book-spread")).toBe("chapter");
      expect(host.querySelector(".fund-book-chapter")?.textContent).toBe("The accounts");
      // Another chapter's bookmark leaves the account behind until the accounts chapter returns.
      await act(async () => host.querySelector<HTMLButtonElement>('[data-account-id="ACC-SAVINGS"]')!.click());
      await render(root, { household, memberId: BIANCA, today: TODAY, presentation: "desk", selected: "waiting", onSelect: (id) => seen.push(id) });
      expect(host.querySelector(".fund-book")?.getAttribute("data-fund-book-spread")).toBe("chapter");
      await render(root, { household, memberId: BIANCA, today: TODAY, presentation: "desk", selected: "accounts", onSelect: (id) => seen.push(id) });
      expect(host.querySelector(".fund-book")?.getAttribute("data-fund-book-account")).toBe("ACC-SAVINGS");
      expect(JSON.stringify(household)).toBe(before);
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
      expect(host.querySelector(".fund-book-popup-line")?.textContent).toBe(`${lines.ink.length} counted lines stand in ink; 1 not counted lie flat in pencil.`);
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
      // On the phone the head is still a group of real buttons above the room.
      expect(second.host.querySelector(".fund-book.is-phone .fund-book-head-edge[role=\"group\"]")).not.toBeNull();
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
        expect(sticky.querySelector(".fund-book-sticky-figure")?.textContent).toBe("No postings yet");
        expect(sticky.textContent).not.toContain("$");
        await act(async () => sticky.click());
        expect(host.querySelector(".fund-book-figure")?.textContent).toBe("No postings yet");
        expect(host.querySelector(".fund-book-leaf.is-left .fund-book-lines")).toBeNull();
        expect(host.querySelector(".fund-book-leaf.is-left .fund-book-pencil-note")?.textContent).toBe("No postings yet.");
        expect(host.querySelector(".fund-book-raise")).toBeNull();
        expect(host.querySelector(".fund-book-floor-note")?.textContent).toBe("No postings yet. Nothing to raise.");
        expect(host.querySelector(".fund-book-plinth-verdict")?.textContent).toBe("No postings yet.");
        expect(host.querySelector(".fund-book-floor")?.textContent).not.toContain("$0.00");
        await act(async () => sticky.click());
      }
      // A posted account with a real figure still prints it.
      const posted = rows.find((row) => booksLines(household, row.accountId).ink.length > 0)!;
      expect(host.querySelector(`[data-account-id="${posted.accountId}"] .fund-book-sticky-figure`)?.textContent).toBe(accountRowAmount(posted));
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

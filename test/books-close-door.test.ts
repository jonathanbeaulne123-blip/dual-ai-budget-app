// @vitest-environment jsdom
// Review finding 3 (Major, D3/K3): Books can no longer close the month alone. The Close pack (Ours: Tools & audit;
// Mine: its seal) is a door to the Campfire's Settle; reopening stays in Books behind its own review.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { act, createElement, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BooksPage } from "../src/Books.tsx";
import { catalogHousehold, closeBooksMonth, postEntry, type Household } from "../src/core/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let props: ComponentProps<typeof BooksPage>;
const refuse = vi.fn(() => { throw Error("This surface must not write"); });

// Fictional household: one shared row in August, August closed.
function scenario(closed: boolean): Household {
  let h = catalogHousehold();
  h.householdId = "BOOKS-CLOSE-DOOR";
  h = postEntry(h, { date: "2026-08-02", type: "income", amount: "50", accountId: "ACC-CHEQUING", subcategoryId: "SUB-INCOME-WAGES", note: "Shared income", createdBy: "MEM-001", visibility: "household", confirmDuplicate: true }).household;
  if (closed) h = closeBooksMonth(h, { monthKey: "2026-08", createdBy: "MEM-001" }).household;
  return h;
}
async function render(changes: Partial<typeof props> = {}) { props = { ...props, ...changes }; await act(async () => root.render(createElement(BooksPage, props))); }
const buttons = () => [...host.querySelectorAll<HTMLButtonElement>("button")];
const named = (text: string) => buttons().find((el) => el.textContent?.trim() === text);
async function press(el: HTMLElement | undefined) { expect(el).toBeTruthy(); await act(async () => el!.click()); }

beforeEach(() => {
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  const household = scenario(false);
  props = { household, booksHousehold: household, memberId: "MEM-001", view: "household", booksStatus: null, focusedAccountId: null, sourceFocus: null,
    onFocusAccount: () => {}, onClearSource: () => {}, onChange: refuse, onRemove: refuse, onPayAccount: refuse, onAddToAccount: refuse, onCommand: refuse };
  refuse.mockClear();
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe("Books' Close pack is a door to the Campfire", () => {
  it("in Ours: Tools & audit › Close pack names the Campfire and has no Lock", async () => {
    const onOpenCampfire = vi.fn();
    await render({ onOpenCampfire });
    await press(buttons().find((el) => el.closest("[data-books-tabs=audit]") && el.textContent === "Close pack"));
    expect(host.textContent).toContain("The month closes at the Campfire");
    expect(buttons().some((el) => /^Close \d{4}-\d{2}$/.test(el.textContent?.trim() ?? ""))).toBe(false);
    await press(named("Open the Campfire"));
    expect(onOpenCampfire).toHaveBeenCalledTimes(1);
    expect(refuse).not.toHaveBeenCalled();
  });

  it("in Mine: the Close pack seal is the same door, with no Close month", async () => {
    const onOpenCampfire = vi.fn();
    await render({ view: "personal", onOpenCampfire });
    const seals = [...host.querySelectorAll(".hearth-pane-seal")].map((el) => el.textContent);
    expect(seals).toContain("Close pack");
    expect(seals).not.toContain("Close month");
    await press([...host.querySelectorAll<HTMLButtonElement>(".hearth-pane-seal")].find((el) => el.textContent === "Close pack"));
    expect(host.textContent).toContain("The month closes at the Campfire");
    expect(buttons().some((el) => /^Close \d{4}-\d{2}$/.test(el.textContent?.trim() ?? ""))).toBe(false);
    await press(named("Open the Campfire"));
    expect(onOpenCampfire).toHaveBeenCalledTimes(1);
    expect(refuse).not.toHaveBeenCalled();
  });

  it("keeps Reopen behind its own review: disclose, then a named Reopen {month}, or Keep it closed", async () => {
    const closed = scenario(true);
    const onChange = vi.fn();
    await render({ household: closed, booksHousehold: closed, onChange, onOpenCampfire: () => {} });
    await press(buttons().find((el) => el.closest("[data-books-tabs=audit]") && el.textContent === "Close pack"));
    const reopen = host.querySelector<HTMLDetailsElement>("[data-books-reopen]")!;
    expect(reopen.querySelector("summary")?.textContent).toBe("Reopen a closed month");
    expect(reopen.textContent).toContain("one person's act");
    expect(named("Reopen")).toBeUndefined();
    await press(named("Review reopening 2026-08"));
    await press(named("Keep it closed"));
    expect(onChange).not.toHaveBeenCalled();
    await press(named("Review reopening 2026-08"));
    await press(named("Reopen 2026-08"));
    expect(onChange).toHaveBeenCalledTimes(1);
    const [next] = onChange.mock.calls[0] as [Household];
    expect(next.kitchen.books.closedMonths.map((row) => row.monthKey)).not.toContain("2026-08");
  });
});

describe("the month-close fence", () => {
  function files(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
    });
  }

  it("only the Campfire ritual's Settle calls closeBooksMonth outside core and the sync registry", () => {
    const src = join(process.cwd(), "src");
    const callers = files(src)
      .map((path) => relative(process.cwd(), path).replaceAll("\\", "/"))
      .filter((path) => !path.startsWith("src/core/") && !path.startsWith("src/ledgerSync/"))
      .filter((path) => /\bcloseBooksMonth\b/.test(readFileSync(join(process.cwd(), path), "utf8")));
    expect(callers).toEqual(["src/campfire/beats.tsx"]);
  });
});

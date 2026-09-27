// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedDemoHousehold } from "../src/core/seed.ts";
import type { Household } from "../src/core/types.ts";
import { buildHarbourReading } from "../src/harbour/data/reading.ts";
import { engravedCents } from "../src/harbour/desk/engraved.ts";
import { readSnapshot } from "../src/harbour/desk/todayModel.ts";
import { CampCard, SINCE_ANNOUNCE_MS, type CampCardProps } from "../src/harbour/glass/CampCard.tsx";
import { campCardModel, readCardLeaving, readHerculesLine, readLine3, type CampCardInput } from "../src/harbour/glass/campCardModel.ts";
import { WORDS } from "../src/harbour/glass/copy.ts";
import { stripLedger, type LedgerSpace } from "../src/harbour/glass/dayLedger.ts";

/**
 * The camp card (Tool Atlas §3.5, §4.1 "The card is three lines", A6, A22,
 * A24): line 1 Everyday · now, line 2 Leaving next, line 3 by priority, the
 * pill, the full card, and no live announcement at load. Fictional demo data.
 */
const today = "2026-09-25";
const household = seedDemoHousehold({ today });
const memberId = household.members[0]!.id;
const partner = household.members.find(member => member.id !== memberId)!;
const reading = buildHarbourReading(household, memberId, today, "current");
const ledgerFor = (h: Household, space: LedgerSpace = "ours") => stripLedger({ household: h, memberId, space, today });
const input = (extra: Partial<CampCardInput> = {}): CampCardInput => ({ household, memberId, space: "ours", today, ledger: ledgerFor(household), reading, ...extra });
/** A household with nothing waiting on this reader: no contribution to confirm, no plan to agree. */
const quiet = { ...household, fundEvents: [], planVersions: [], planBridgeDecisions: [], chapters: [] } as unknown as Household;
const withPurchases = (h: Household): Household => {
  const template = h.transactions.find(row => row.type === "expense" && row.visibility !== "personal")!;
  return { ...h, transactions: [...h.transactions, ...[1, 2, 3].map(i => ({ ...template, id: `TX-new-${i}`, createdBy: partner.id, createdAt: `2099-01-0${i + 1}T12:00:00.000Z`, amountCents: 4380 + i }))] };
};

describe("line 3, by priority", () => {
  it("puts Needs you first, with a count, and opens the first thing's door", () => {
    const line = readLine3(input());
    expect(line.kind).toBe("needs");
    if (line.kind !== "needs") return;
    expect(line.words).toMatch(/^Needs you · /);
    expect(line.items.length).toBeGreaterThan(0);
    expect(line.door).toEqual(line.items[0]!.door);
    if (line.items.length > 1) expect(line.words).toMatch(new RegExp(` · \\+${line.items.length - 1}$`));
  });

  it("then Since you were here — the partner's purchases since this viewer's last visit", () => {
    const h = withPurchases(quiet);
    const line = readLine3(input({ household: h, ledger: ledgerFor(h), reading: null, since: "2099-01-01T00:00:00.000Z" }));
    expect(line).toEqual({ kind: "since", words: `Since you were here · ${partner.name} recorded 3 purchases · $131.46`, door: { target: "books" } });
  });

  it("then the first-visit line, once — with the keyboard's own words — then a quiet line", () => {
    const base = input({ household: quiet, ledger: ledgerFor(quiet), reading: null, since: null });
    expect(readLine3({ ...base, firstVisit: true })).toEqual({ kind: "first-visit", words: "Your month runs along the bottom. Drag to look around the island, and tap a place to open it." });
    expect(readLine3({ ...base, firstVisit: true, keyboard: true })).toEqual({ kind: "first-visit", words: "Your month runs along the bottom. Drag to look around the island, and press + to look closer." });
    expect(readLine3(base)).toEqual({ kind: "quiet", words: WORDS.quiet });
  });

  it("in Mine, the couple's needs and news stay on the Ours card", () => {
    const line = readLine3(input({ space: "mine", ledger: ledgerFor(household, "mine"), since: "2000-01-01T00:00:00.000Z" }));
    expect(["first-visit", "quiet"]).toContain(line.kind);
  });
});

describe("lines 1 and 2, and Hercules's line", () => {
  it("reads Everyday · now from the Fund snapshot and Leaving next from the strip's own slips (A6)", () => {
    const model = campCardModel(input());
    expect(model.heading).toBe("Our month · September");
    expect(model.everyday!.figure).toBe(engravedCents(readSnapshot(household, memberId, "household", today)?.now ?? null));
    const leaving = readCardLeaving(ledgerFor(household));
    expect(model.leaving).toEqual(leaving);
    expect(leaving.words).toMatch(/^Leaving next · Phone \$110\.00 · Today · \+\d+ this week$/);
  });

  it("offers Shift tonight to a member with a job who has not recorded one today, else his suggestion or quiet", () => {
    const job = { id: "JOB-T", memberId, name: "Demo Bistro", active: true } as unknown as Household["workJobs"][number];
    const working = { ...household, workJobs: [job], shifts: household.shifts.filter(shift => !(shift.memberId === memberId && shift.date === today)) } as Household;
    expect(readHerculesLine(working, memberId, "ours", today)).toEqual({ kind: "record-shift", words: "Shift tonight? Record it here." });
    const idle = { ...household, workJobs: [] } as Household;
    expect(["door", "quiet"]).toContain(readHerculesLine(idle, memberId, "ours", today).kind);
  });

  it("in Mine, reads On the clock and the personal plates, seals and streak", () => {
    const model = campCardModel(input({ space: "mine", ledger: ledgerFor(household, "mine") }));
    expect(model.heading).toBe("My month · September");
    expect(model.everyday).toBeNull();
    expect(model.clock).not.toBeNull();
    expect(model.full.space).toBe("mine");
    if (model.full.space === "mine") {
      expect(model.full.plates.map(plate => plate.id)).not.toContain("month");
      expect(model.full.level?.id).toBe("month");
    }
  });
});

let host: HTMLDivElement, root: Root;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.useRealTimers(); });

function props(extra: Partial<CampCardProps> = {}, calls: string[] = []): CampCardProps {
  return {
    model: campCardModel(input()), space: "ours", onSpaceChange: space => calls.push(`space:${space}`),
    expanded: false, onExpandedChange: open => calls.push(`expanded:${open}`),
    onOpenBank: () => calls.push("bank"), onOpenCellar: () => calls.push("cellar"), onOpenCalendar: date => calls.push(`calendar:${date}`),
    onOpen: (target, object) => calls.push(`open:${target}${object ? `:${object}` : ""}`), onRecord: verb => calls.push(`record:${verb}`),
    onTalk: () => calls.push("talk"), onOpenBooks: () => calls.push("books"), onStepIn: () => calls.push("step-in"), onWhatChanged: () => calls.push("what-changed"),
    ...extra,
  };
}
const render = async (p: CampCardProps) => act(async () => root.render(createElement(CampCard, p)));
const q = <T extends Element = HTMLElement>(selector: string) => host.querySelector<T>(selector)!;
const qa = <T extends Element = HTMLElement>(selector: string) => [...host.querySelectorAll<T>(selector)];

describe("CampCard — the DOM", () => {
  it("is a named region with home's one h1, and says nothing live at load (A24)", async () => {
    await render(props());
    const region = q("section.glass-card");
    expect(document.getElementById(region.getAttribute("aria-labelledby")!)!.textContent).toBe("Our month · September");
    expect(qa("h1").map(h => h.textContent)).toEqual(["Our month · September"]);
    const live = qa("[role='status'], [aria-live]");
    expect(live).toHaveLength(1);
    expect(live[0]!.textContent).toBe("");
  });

  it("draws three lines, each one target at ≥ 44 px by class, with names that start with their visible words (A22)", async () => {
    const calls: string[] = [];
    await render(props({}, calls));
    const one = q<HTMLButtonElement>('[data-desk-pot="everyday"]');
    const two = q<HTMLButtonElement>('[data-card-line="2"]');
    const three = q<HTMLElement>('[data-card-line="3"]');
    expect(one.textContent).toMatch(/^Everyday · now /);
    expect(two.textContent).toMatch(/^Leaving next · Phone \$110\.00 · Today/);
    expect(three.textContent).toMatch(/^Needs you · .*, \d+ items?$/);
    for (const button of [one, two, three]) expect(button.hasAttribute("aria-label")).toBe(false);
    await act(async () => { one.click(); two.click(); });
    expect(calls).toEqual(["bank", "cellar"]);
  });

  it("the pill is a radio group named Whose money; choosing Mine asks the App and announces Showing Mine", async () => {
    const calls: string[] = [];
    await render(props({}, calls));
    const group = q('[role="radiogroup"]');
    expect(group.getAttribute("aria-label")).toBe("Whose money");
    const radios = qa<HTMLButtonElement>('[role="radio"]');
    expect(radios.map(r => [r.textContent, r.getAttribute("aria-checked")])).toEqual([["Ours", "true"], ["Mine", "false"]]);
    await act(async () => radios[1]!.click());
    expect(calls).toEqual(["space:mine"]);
    expect(q('[role="status"]').textContent).toBe("Showing Mine");
    await render(props({ onSpaceChange: undefined }));
    expect(host.querySelector('[role="radiogroup"]')).toBeNull();
  });

  it("is one Tab stop in the dock; ↑ / ↓ rove the rows, and the grab handle opens the full card", async () => {
    const calls: string[] = [];
    await render(props({}, calls));
    const tabbable = qa<HTMLElement>("button").filter(b => b.tabIndex >= 0);
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]!.getAttribute("aria-checked")).toBe("true");
    tabbable[0]!.focus();
    await act(async () => { document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })); });
    expect((document.activeElement as HTMLElement).dataset.deskPot).toBe("everyday");
    await act(async () => { document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true })); });
    const handle = q<HTMLButtonElement>("[data-card-handle]");
    expect(document.activeElement).toBe(handle);
    expect(handle.getAttribute("aria-expanded")).toBe("false");
    expect(handle.textContent).toBe(WORDS.openCard);
    await act(async () => handle.click());
    expect(calls).toEqual(["expanded:true"]);
    expect(qa<HTMLElement>("button").filter(b => b.tabIndex >= 0)).toHaveLength(1);
  });

  it("opens to Prepare · Protect · Build, the seals, The Level, Hercules's line as a button, Books, Step in, What changed here", async () => {
    const calls: string[] = [];
    const job = { id: "JOB-T", memberId, name: "Demo Bistro", active: true } as unknown as Household["workJobs"][number];
    const working = { ...household, workJobs: [job], shifts: household.shifts.filter(shift => !(shift.memberId === memberId && shift.date === today)) } as Household;
    await render(props({ expanded: true, model: campCardModel(input({ household: working, ledger: ledgerFor(working) })) }, calls));
    expect(qa("[data-desk-pot]").map(p => p.dataset.deskPot)).toEqual(["everyday", "prepare", "protect", "build"]);
    expect(qa("[data-desk-seal]")).toHaveLength(3);
    expect(q("[data-desk-level]")).not.toBeNull();
    const hercules = q<HTMLButtonElement>('[data-card-hercules="record-shift"]');
    expect(hercules.tagName).toBe("BUTTON");
    expect(hercules.textContent).toBe("Shift tonight? Record it here.");
    await act(async () => {
      hercules.click();
      q<HTMLButtonElement>('[data-card-door="books"]').click();
      q<HTMLButtonElement>('[data-card-door="step-in"]').click();
      q<HTMLButtonElement>('[data-card-door="what-changed"]').click();
    });
    expect(calls).toEqual(["record:shift", "books", "step-in", "what-changed"]);
    expect(qa<HTMLButtonElement>('[data-card-door]').map(b => b.textContent)).toEqual(["Books", "Step in", "What changed here"]);
  });

  it("Escape folds the open card and returns focus to the handle", async () => {
    const calls: string[] = [];
    await render(props({ expanded: true }, calls));
    q<HTMLButtonElement>('[data-card-door="books"]').focus();
    await act(async () => { document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect(calls).toEqual(["expanded:false"]);
    expect(document.activeElement).toBe(q("[data-card-handle]"));
  });

  it("announces a new Since you were here at most once every 30 s (A24)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-25T22:40:00Z"));
    const base = campCardModel(input({ household: quiet, ledger: ledgerFor(quiet), reading: null }));
    const since = (words: string) => ({ ...base, line3: { kind: "since" as const, words: `Since you were here · ${words}`, door: { target: "books" } } });
    await render(props({ model: since("Bianca recorded 1 purchase · $4.00") }));
    expect(q('[role="status"]').textContent).toBe("");
    await render(props({ model: since("Bianca recorded 2 purchases · $9.00") }));
    expect(q('[role="status"]').textContent).toBe("Since you were here: Bianca recorded 2 purchases · $9.00");
    vi.setSystemTime(new Date(Date.now() + 5_000));
    await render(props({ model: since("Bianca recorded 3 purchases · $12.00") }));
    expect(q('[role="status"]').textContent).toBe("Since you were here: Bianca recorded 2 purchases · $9.00");
    vi.setSystemTime(new Date(Date.now() + SINCE_ANNOUNCE_MS));
    await render(props({ model: since("Bianca recorded 4 purchases · $20.00") }));
    expect(q('[role="status"]').textContent).toBe("Since you were here: Bianca recorded 4 purchases · $20.00");
  });

  it("in Mine, line 1 is On the clock and line 2 opens the Calendar at its day", async () => {
    const calls: string[] = [];
    const model = campCardModel(input({ space: "mine", ledger: ledgerFor(household, "mine") }));
    await render(props({ model, space: "mine", expanded: true }, calls));
    expect(q("[data-card-clock]").textContent).toMatch(/^On the clock · /);
    expect(qa("h1").map(h => h.textContent)).toEqual(["My month · September"]);
    expect(q("[data-desk-personal-seals]")).not.toBeNull();
    await act(async () => { q<HTMLButtonElement>("[data-card-clock]").click(); q<HTMLButtonElement>('[data-card-line="2"]').click(); });
    expect(calls[0]).toBe("open:shift");
    expect(calls[1]).toMatch(/^calendar:2026-/);
  });
});

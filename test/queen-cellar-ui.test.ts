// @vitest-environment jsdom
import { act, createElement, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueenCellar } from "../src/queen/QueenCellar.tsx";
import { queenRibbons } from "../src/core/queenPresentation.ts";
import { addPotentialExpense, addRecurrence, postDueRecurrences, postEntry, recordHouseholdFundReconciliation, type CommitResult, type Household } from "../src/core/index.ts";
import { planLifeFixture } from "./fixtures/plan-life.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement, root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });

const memberId = "MEM-001";

/** The same fictional September the core test uses: a shard, a full house bill, the rent filling, a planned expense. */
function seeded(): Household {
  let h = planLifeFixture("household");
  h = recordHouseholdFundReconciliation(h, { memberId, date: "2026-09-12", bankTotal: "4000", personalRemainder: "0" }).household;
  const rent = h.recurrences.find((row) => row.note === "Fictional rent")!;
  for (const month of ["06", "07", "08"]) h = postEntry(h, { type: "expense", date: `2026-${month}-20`, amount: "900", accountId: "ACC-VISA", subcategoryId: "SUB-HOUSING-ELECTRIC", note: "Fictional rent", createdBy: memberId, visibility: "household", source: "recurring", sourceId: rent.id, confirmDuplicate: true }).household;
  h = addRecurrence(h, { cadence: "monthly", nextDate: "2026-09-08", type: "expense", amount: "16", accountId: "ACC-VISA", subcategoryId: "SUB-LIFE-FUN", note: "Fictional streaming", kind: "subscription" }).household;
  h = postDueRecurrences(h, "2026-09-08", [h.recurrences.find((row) => row.note === "Fictional streaming")!.id], { createdBy: "MEM-002" }).household;
  h = addRecurrence(h, { cadence: "monthly", nextDate: "2026-09-15", type: "expense", amount: "140", accountId: "ACC-CHEQUING", subcategoryId: "SUB-HOUSING-ELECTRIC", note: "Fictional hydro", kind: "bill" }).household;
  h = addPotentialExpense(h, { date: "2026-09-24", title: "Fictional winter tires", amount: "480", accountId: "ACC-VISA", subcategoryId: "SUB-LIFE-FUN", createdBy: memberId, visibility: "household" }).household;
  return h;
}

async function render(household: Household, today: string, overrides: Partial<{ busy: boolean; onCommand: ReturnType<typeof vi.fn>; onOpenBanks: ReturnType<typeof vi.fn> }> = {}) {
  const onCommand = overrides.onCommand ?? vi.fn(async (fn: (h: Household) => CommitResult) => fn(household));
  const onOpenBanks = overrides.onOpenBanks ?? vi.fn();
  const stairRef = createRef<HTMLButtonElement>();
  await act(async () => root.render(createElement(QueenCellar, {
    ribbons: queenRibbons(household, today), open: true, stairRef, onExit: () => {}, onOpenBanks, world: "flat",
    household, memberId, today, busy: overrides.busy ?? false, onCommand,
  })));
  return { onCommand, onOpenBanks };
}
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => host.querySelector<T>(selector)!;
const $$ = <T extends HTMLElement = HTMLElement>(selector: string) => [...host.querySelectorAll<T>(selector)];
const click = async (element: HTMLElement) => act(async () => { element.click(); });
const jar = (label: string) => $$<HTMLButtonElement>(".queen-jar--bill").find((row) => row.getAttribute("aria-label")?.startsWith(label))!;
const line = () => $(".queen-room__line").textContent ?? "";
const acts = () => $$<HTMLButtonElement>(".queen-room__acts .queen-go").map((row) => row.textContent ?? "");

describe("The cellar's bill rail — the room opens on this month, one jar a day", () => {
  it("stands every bill of the month on its day, the gate on today, and says so in words without a page scroll", async () => {
    await render(seeded(), "2026-09-12");
    expect($(".queen-cellar-rail")).not.toBeNull();
    expect($$(".queen-cellar-day")).toHaveLength(30);
    expect($$(".queen-jar--bill").map((row) => row.getAttribute("aria-label"))).toEqual([
      "Fictional streaming — subscription (Life › Fun), the smallest, Sep 8, paid",
      "Fictional hydro — house bill (Housing › Electric), small, Sep 15, full",
      "Fictional rent — house bill (Housing › Electric), the month's largest, Sep 20, filling",
      "Fictional winter tires — planned, not posted (Life › Fun), large, Sep 24, full",
    ]);
    expect($(".queen-cellar-day.is-today .queen-cellar-day__tick").textContent).toBe("12");
    expect($(".queen-room__sub").textContent).toBe("4 kitty jars on the rail");
    expect(line()).toMatch(/^Today\. No jar on this day\./);
    expect(acts()).toEqual([]);
    // No jar on the rail carries a figure; the numbers wait for the line beneath the gate.
    expect($(".queen-cellar-rail").textContent).not.toMatch(/\$\d/);
    // Every jar is a vessel the 3D room can stand behind.
    expect($$(".queen-jar--bill").every((row) => row.dataset.roomVessel?.startsWith("cellar:"))).toBe(true);
  });

  it("an early jar, full or filling, has no hammer: the water just sits there", async () => {
    await render(seeded(), "2026-09-12");
    await click(jar("Fictional hydro"));
    expect(line()).toMatch(/^Filling\. Fictional hydro · house bill · Housing › Electric · in 3 days · \$140\.00 saved, ready · water at \$[\d,.]+ after\./);
    expect($$(".queen-hammer")).toHaveLength(0);
    expect(acts()).toEqual(["Lift it out · what if not"]);
    expect(jar("Fictional hydro").className).toContain("queen-jar--none");
  });

  it("on the day and full, the hammer leans on the rail; breaking the bank posts the recurrence, by hand, behind Confirm", async () => {
    const h = seeded();
    const { onCommand } = await render(h, "2026-09-20");
    await click(jar("Fictional hydro"));
    expect(line()).toMatch(/^The hammer is out\. Fictional hydro · house bill · Housing › Electric · 5 days overdue · \$140\.00 saved, ready/);
    const hammer = $<HTMLButtonElement>(".queen-hammer");
    expect(hammer.textContent).toBe("Break the kitty jar");
    expect(hammer.className).not.toContain("queen-hammer--crack");
    await click(hammer);
    // Nothing is written until the person confirms.
    expect(onCommand).not.toHaveBeenCalled();
    const sheet = document.querySelector(".confirm-sheet") ?? document.querySelector("[role='dialog']");
    expect(sheet?.textContent).toMatch(/Break the kitty jar: Fictional hydro/);
    expect(sheet?.textContent).toMatch(/Post \$140\.00 for Fictional hydro in the books, dated Sep 15, its day\./);
    expect(sheet?.textContent).toMatch(/does not move money at your bank/);
    const confirm = [...document.querySelectorAll<HTMLButtonElement>("button")].find((row) => row.textContent?.trim() === "Break it")!;
    await click(confirm);
    expect(onCommand).toHaveBeenCalledTimes(1);
    // The command it asked for is the existing one: post that recurrence today, as this member.
    const fn = onCommand.mock.calls[0]![0] as (current: Household) => CommitResult;
    const result = fn(h);
    const hydro = h.recurrences.find((row) => row.note === "Fictional hydro")!;
    const posted = result.household.transactions.filter((tx) => tx.source === "recurring" && tx.sourceId === hydro.id);
    expect(posted).toHaveLength(1);
    expect(posted[0]!.amountCents).toBe(14000);
    // The existing command dates the payment on the bill's own day, so the shard lands where the jar stood.
    expect(posted[0]!.date).toBe("2026-09-15");
    expect(posted[0]!.createdBy).toBe(memberId);
    expect(result.household.transactions).toHaveLength(h.transactions.length + 1);
    expect($(".queen-cellar-notice").textContent).toBe("Fictional hydro paid. The shard stays on the rail.");
  });

  it("on the day and not full, the jar cracks: paying is allowed, named as paying from the cellar's water", async () => {
    await render(seeded(), "2026-09-20");
    await click(jar("Fictional rent"));
    expect(jar("Fictional rent").getAttribute("aria-label")).toBe("Fictional rent — house bill (Housing › Electric), the month's largest, Sep 20, filling. Cracked: due and not full");
    expect(line()).toMatch(/^Cracked\. Fictional rent · house bill · Housing › Electric · due today · \$[\d,.]+ saved of \$900\.00, \$[\d,.]+ to be safe/);
    const crack = $<HTMLButtonElement>(".queen-hammer--crack");
    expect(crack.textContent).toBe("Mark paid anyway · from the water"); // K13: Hearth records, it does not pay
    expect($$(".queen-hammer")).toHaveLength(1);
    await click(crack);
    const sheet = document.querySelector("[role='dialog']");
    expect(sheet?.textContent).toMatch(/Mark Fictional rent paid from the cellar's water/);
    expect(sheet?.textContent).toMatch(/the rest comes from the Fund's water and the walk shows the buffer take it/);
    expect([...document.querySelectorAll<HTMLButtonElement>("button")].some((row) => row.textContent?.trim() === "Mark paid anyway")).toBe(true);
  });

  it("a bill paid somewhere else in the app is a shard: no hammer, no crack, nothing to lift", async () => {
    await render(seeded(), "2026-09-20");
    await click(jar("Fictional streaming"));
    expect(line()).toMatch(/^A shard, kept\. Fictional streaming · subscription · Life › Fun · paid · \$16\.00 paid/);
    expect($$(".queen-hammer")).toHaveLength(0);
    expect(acts()).toEqual([]);
    expect(jar("Fictional streaming").querySelector(".queen-billjar.is-shard")).not.toBeNull();
  });

  it("a planned expense has no hammer here even when due and full: it is paid where it is paid", async () => {
    const { onOpenBanks } = await render(seeded(), "2026-09-27");
    await click(jar("Fictional winter tires"));
    expect($$(".queen-hammer")).toHaveLength(0);
    expect(acts()).toEqual(["Open it in the banks"]);
    await click($<HTMLButtonElement>(".queen-room__acts .queen-go"));
    expect(onOpenBanks).toHaveBeenCalledTimes(1);
  });

  it("lifting a jar out is a rehearsal: the water beneath changes, nothing is written, and it sets back", async () => {
    const { onCommand } = await render(seeded(), "2026-09-12");
    await click(jar("Fictional rent"));
    const before = $<HTMLElement>(".queen-water").style.height;
    const lift = $$<HTMLButtonElement>(".queen-room__acts .queen-go").find((row) => row.textContent?.startsWith("Lift it out"))!;
    await click(lift);
    expect(jar("Fictional rent").className).toContain("is-held");
    expect(line()).toMatch(/Lifted out — a rehearsal; nothing is written\.$/);
    // The gate is on the rent's day; with the rent lifted, the water there stands higher.
    expect(Number.parseInt($<HTMLElement>(".queen-water").style.height, 10)).toBeGreaterThan(Number.parseInt(before, 10));
    expect(onCommand).not.toHaveBeenCalled();
    await click($$<HTMLButtonElement>(".queen-room__acts .queen-go").find((row) => row.textContent === "Set it back")!);
    expect(jar("Fictional rent").className).not.toContain("is-held");
    expect($<HTMLElement>(".queen-water").style.height).toBe(before);
  });

  it("the rail scrubs by keyboard and slider, and the months view is one step in for the jar in the gate", async () => {
    await render(seeded(), "2026-09-12");
    const rail = $<HTMLDivElement>(".queen-cellar-rail");
    expect(rail.tabIndex).toBe(0);
    await act(async () => { rail.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })); });
    expect($<HTMLInputElement>(".queen-scrub input").value).toBe("12");
    await act(async () => { rail.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true })); });
    expect($<HTMLInputElement>(".queen-scrub input").value).toBe("29");
    await click(jar("Fictional rent"));
    expect($<HTMLInputElement>(".queen-scrub input").value).toBe("19");
    const pills = $$<HTMLButtonElement>(".queen-cellar-views .queen-pick");
    expect(pills.map((row) => row.textContent)).toEqual(["This month", "Fictional rent · months"]);
    await click(pills[1]!);
    expect($$(".queen-jar-seat").length).toBeGreaterThan(0);
    expect($(".queen-cellar-rail")).toBeNull();
    expect(line()).toMatch(/Every jar is the same jar\./);
    await click($$<HTMLButtonElement>(".queen-cellar-views .queen-pick")[0]!);
    expect($(".queen-cellar-rail")).not.toBeNull();
  });

  it("busy disables the hammer, and an empty month says so", async () => {
    await render(seeded(), "2026-09-20", { busy: true });
    await click(jar("Fictional hydro"));
    expect($<HTMLButtonElement>(".queen-hammer").disabled).toBe(true);
    await act(async () => root.unmount());
    root = createRoot(host);
    let h = planLifeFixture("household");
    h = { ...h, recurrences: [], potentialExpenses: [] };
    await render(h, "2026-09-12");
    expect($(".queen-room__sub").textContent).toBe("No kitty jars on the rail");
    expect($$(".queen-jar--bill")).toHaveLength(0);
    expect($$(".queen-cellar-day")).toHaveLength(30);
  });

  it("tells each jar apart three ways — a body per purpose, a tint per group, a finish per line, a size band per due — and says so", async () => {
    let h = seeded();
    h = addRecurrence(h, { cadence: "monthly", nextDate: "2026-09-18", type: "expense", amount: "128", accountId: "ACC-CHEQUING", subcategoryId: "SUB-TRANSPORT-TRANSIT", note: "Fictional transit pass", kind: "other" }).household;
    await render(h, "2026-09-12");
    const cat = (label: string) => jar(label).querySelector<SVGElement>(".queen-bank-flat")!;
    const glyph = (label: string) => jar(label).querySelector<HTMLElement>(".queen-billjar")!;
    expect(cat("Fictional streaming").dataset.form).toBe("subscription");
    expect(cat("Fictional hydro").dataset.form).toBe("bill");
    expect(cat("Fictional transit pass").dataset.form).toBe("recurring");
    expect(cat("Fictional winter tires").dataset.form).toBe("planned");
    expect(glyph("Fictional hydro").dataset.hue).toBe("housing");
    expect(glyph("Fictional transit pass").dataset.hue).toBe("transport");
    expect(glyph("Fictional streaming").dataset.hue).toBe("life");
    // Electric is the second Housing line: speckled. Transit is the second Transport line: speckled too — the tint tells them apart, the finish tells lines of one group apart.
    expect(glyph("Fictional hydro").dataset.finish).toBe("speckle");
    expect(cat("Fictional hydro").querySelector(".queen-bank-flat__finish-coat")).not.toBeNull();
    expect(cat("Fictional hydro").style.getPropertyValue("--bank-tint")).toBe("var(--queen-hue-housing)");
    expect(glyph("Fictional rent").className).toContain("queen-billjar--size-5");
    expect(glyph("Fictional streaming").className).toContain("queen-billjar--size-1");
    expect(glyph("Fictional winter tires").className).toContain("queen-billjar--size-4");
    // A planned expense is frosted glass (not an empty outline) and wears no finish coat; a paid one is fired to the crown, with its crack.
    expect(cat("Fictional winter tires").dataset.frosted).toBe("true");
    expect(cat("Fictional winter tires").dataset.hollow).toBe("false");
    expect(cat("Fictional winter tires").querySelector(".queen-bank-flat__finish-coat")).toBeNull();
    expect(cat("Fictional streaming").dataset.hollow).toBe("false");
    expect(cat("Fictional streaming").dataset.fired).toBe("true");
    // The kiln: the rent is glazed to its fill line and no further; the full hydro is fired to the crown; a paid jar keeps its shard.
    expect(cat("Fictional rent").dataset.fired).toBe("false");
    expect(cat("Fictional rent").querySelector(".queen-bank-flat__glaze")).not.toBeNull();
    expect(cat("Fictional hydro").dataset.fired).toBe("true");
    expect(glyph("Fictional streaming").className).toContain("is-shard");
  });

  it("a press on a kitty jar opens its card — what it holds, its kiln state, what pays it, the water after; Escape closes it and focus returns", async () => {
    await render(seeded(), "2026-09-12");
    expect($(".queen-jar-card")).toBeNull();
    expect(jar("Fictional rent").getAttribute("aria-expanded")).toBe("false");
    await click(jar("Fictional rent"));
    const card = $(".queen-jar-card");
    expect(card).not.toBeNull();
    expect(jar("Fictional rent").getAttribute("aria-expanded")).toBe("true");
    expect(card.getAttribute("aria-label")).toBe("Fictional rent — the kitty jar's card");
    expect($(".queen-jar-card__kicker").textContent).toBe("house bill, wearing a postman's cap and an envelope");
    const facts = Object.fromEntries($$(".queen-jar-card__facts > div").map((row) => [row.querySelector("dt")!.textContent, row.querySelector("dd")!.textContent]));
    expect(facts["Filed under"]).toBe("Housing › Electric");
    expect(facts["Its day"]).toBe("20 of the month · in 8 days · every month");
    expect(facts["The jar holds"]).toBe("$760.00 of $900.00");
    expect(facts["In the kiln"]).toBe("glazed to 8 of 10 — the rest still bisque");
    expect(facts["Still to go"]).toBe("$140.00");
    expect(facts["Paid from"]).toBe("the Household Fund's water, landing in Visa");
    expect(facts["The water after"]).toMatch(/^\$[\d,.]+$/);
    expect(facts["The strike"]).toBe("none yet — nothing before its day");
    // The one line still stands inside the card, and the acts stand once, below it.
    expect(line()).toMatch(/^Filling\. Fictional rent · house bill/);
    expect($$(".queen-room__acts")).toHaveLength(1);
    expect(acts()).toEqual(["Lift it out · what if not"]);
    expect($$(".queen-jar-card__more .queen-go").map((row) => row.textContent)).toEqual(["Its months"]);
    // Press it again: the card closes. Open, then Escape: closed, and the jar has focus again.
    await click(jar("Fictional rent"));
    expect($(".queen-jar-card")).toBeNull();
    await click(jar("Fictional rent"));
    await act(async () => { $(".queen-jar-card").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect($(".queen-jar-card")).toBeNull();
    await act(async () => { await new Promise((resolve) => requestAnimationFrame(() => resolve(null))); });
    expect(document.activeElement).toBe(jar("Fictional rent"));
    // A paid jar's card says so, and a planned one says where it posts from.
    await click(jar("Fictional streaming"));
    const paid = Object.fromEntries($$(".queen-jar-card__facts > div").map((row) => [row.querySelector("dt")!.textContent, row.querySelector("dd")!.textContent]));
    expect(paid["The jar holds"]).toBe("$16.00 · paid");
    expect(paid["In the kiln"]).toBe("fired to the crown");
    expect(paid["The strike"]).toBe("a shard — paid elsewhere in the books");
    await click(jar("Fictional winter tires"));
    const planned = Object.fromEntries($$(".queen-jar-card__facts > div").map((row) => [row.querySelector("dt")!.textContent, row.querySelector("dd")!.textContent]));
    expect(planned["In the kiln"]).toBe("frosted glass — a plan, not posted");
    expect(planned["Paid from"]).toBe("nowhere yet — it has not posted");
    expect($$(".queen-jar-card__more .queen-go").map((row) => row.textContent)).toEqual(["Open it in the banks"]);
  });
});

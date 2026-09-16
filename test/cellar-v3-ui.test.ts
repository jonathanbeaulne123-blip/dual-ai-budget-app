// @vitest-environment jsdom
import { act, createElement, createRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueenCellar } from "../src/queen/QueenCellar.tsx";
import { queenRibbons } from "../src/core/queenPresentation.ts";
import { addGoal, addRecurrence, postDueRecurrences, recordBillPayment, recordHouseholdFundReconciliation, type CommitResult, type Household } from "../src/core/index.ts";
import { projectHouseholdFund } from "../src/core/householdFund.ts";
import { CELLAR_OWN_PAY_KEY } from "../src/queen/QueenCellarExtras.tsx";
import { missingSubscriptions, offerMissingRoll } from "../src/core/missingSubscriptions.ts";
import { planLifeFixture } from "./fixtures/plan-life.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Fictional books: Alex (MEM-001) holds the Fund, Sam (MEM-002) is the partner. */
const ALEX = "MEM-001", SAM = "MEM-002";
const TODAY = "2026-09-16";

let host: HTMLDivElement, root: Root, books: Household, calls: number, mounts = 0;
beforeEach(() => { vi.stubEnv("VITE_CELLAR_V3", "1"); host = document.createElement("div"); document.body.append(host); root = createRoot(host); calls = 0; try { localStorage.removeItem(CELLAR_OWN_PAY_KEY); } catch { /* jsdom */ } });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });

function seeded(): Household {
  let h = planLifeFixture("household");
  h = recordHouseholdFundReconciliation(h, { memberId: ALEX, date: "2026-09-12", bankTotal: "4000", personalRemainder: "0" }).household;
  h = addGoal(h, { name: "Fictional beach weekend", target: "600", shared: true, ownerMemberId: SAM }).household;
  const sub = addRecurrence(h, { cadence: "monthly", nextDate: "2026-08-12", type: "expense", amount: "16", accountId: "ACC-VISA", subcategoryId: "SUB-LIFE-FUN", note: "Fictional streaming", kind: "subscription" });
  h = postDueRecurrences(sub.household, "2026-08-12", [sub.postedIds[0]!], { createdBy: ALEX }).household;
  const income = h.categories.find((row) => row.recordType === "category" && row.transactionType === "income")!.id;
  h = addRecurrence(h, { cadence: "monthly", nextDate: "2026-09-25", type: "income", amount: "1800", accountId: "ACC-CHEQUING", subcategoryId: income, note: "Fictional pay", splits: [{ party: ALEX, amountCents: 180000 }] }).household;
  h = addRecurrence(h, { cadence: "monthly", nextDate: "2026-09-10", type: "income", amount: "1500", accountId: "ACC-CHEQUING", subcategoryId: income, note: "Fictional pay two", splits: [{ party: SAM, amountCents: 150000 }] }).household;
  return h;
}

/** Each person is their own phone: switching people mounts a fresh cellar over the same shared books. */
function Phone({ memberId, today }: { memberId: string; today: string }) {
  const [household, setHousehold] = useState(books);
  const onCommand = async (fn: (current: Household) => CommitResult) => {
    calls += 1;
    const result = fn(books);
    books = result.household;
    setHousehold(books);
    return { ...result, ok: true };
  };
  return createElement(QueenCellar, {
    ribbons: queenRibbons(household, today), open: true, stairRef: createRef<HTMLButtonElement>(), onExit: () => {}, onOpenBanks: () => {}, world: "flat",
    household, memberId, today, busy: false, onCommand,
  });
}
async function show(memberId: string, today = TODAY) {
  mounts += 1;
  await act(async () => root.render(createElement(Phone, { key: `${memberId}:${today}:${mounts}`, memberId, today })));
}
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => host.querySelector<T>(selector);
const $$ = <T extends HTMLElement = HTMLElement>(selector: string) => [...host.querySelectorAll<T>(selector)];
const click = async (element: HTMLElement | null | undefined) => { expect(element).toBeTruthy(); await act(async () => { element!.click(); }); };
const button = (text: string | RegExp) => [...document.querySelectorAll<HTMLButtonElement>("button")].find((row) => typeof text === "string" ? row.textContent?.trim() === text : text.test(row.textContent ?? ""));
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
const extra = (kind: string) => $$<HTMLButtonElement>(`.queen-jar--extra[data-kind="${kind}"]`);

describe("Cellar v3 — pay in glass, contribution banks, missing subscriptions", () => {
  it("stands the glass pay jar ahead, the contribution bank behind, and the missing mark in place of the overdue jar — no figure on the rail", async () => {
    books = seeded();
    await show(ALEX);
    expect(extra("income").map((row) => row.getAttribute("aria-label"))).toEqual(["Your pay, Sep 25 — glass: if all of it came in. Not money in the Fund."]);
    expect(extra("contribution").map((row) => row.getAttribute("aria-label"))).toEqual(["Sam (fictional)'s contributions since pay day, Sep 10 — a kitty bank of what actually came in"]);
    expect(extra("missing").map((row) => row.getAttribute("aria-label"))).toEqual(["Fictional streaming — missing: not charged, Sep 12"]);
    // The ordinary overdue streaming jar steps aside for the mark.
    expect($$(".queen-jar--bill").some((row) => row.getAttribute("aria-label")?.startsWith("Fictional streaming"))).toBe(false);
    expect($(".queen-cellar-rail")!.textContent).not.toMatch(/\$\d/);
    expect($(".queen-room__sub")!.textContent).toMatch(/· 1 of pay, in glass · 1 missing$/);
    // Every extra jar is on the rail's one dollar scale.
    expect(extra("income")[0]!.style.getPropertyValue("--jar-px")).toMatch(/px$/);
  });

  it("the glass card says it is hypothetical, and a member can hide their own pay on both phones and bring it back", async () => {
    books = seeded();
    await show(ALEX);
    await click(extra("income")[0]);
    const card = $(".queen-jar-card--hypothetical")!;
    expect(card.textContent).toMatch(/If all of your pay came in — about \$1800\.00 — the Fund could stand at \$[\d.]+\. Only a contribution moves money\./);
    expect(card.textContent).toMatch(/Pay isn't linked to the Fund/);
    await click(button("Hide my pay from the jars"));
    expect(calls).toBe(1);
    expect(extra("income")).toHaveLength(0);
    // Sam's phone no longer shows Alex's glass either, and says why.
    await show(SAM);
    expect(extra("income")).toHaveLength(0);
    expect($(".queen-room__line")!.textContent).toMatch(/Alex \(fictional\) keeps their pay out of the jars\./);
    expect(button("Show my pay in the jars")).toBeUndefined();
    await show(ALEX);
    expect($(".queen-room__line")!.textContent).toMatch(/Your pay is hidden from the jars\./);
    await click(button("Show my pay in the jars"));
    expect(extra("income")).toHaveLength(1);
  });

  it("the private-pay opt-in is this phone's own choice and is offered only on your own glass", async () => {
    books = seeded();
    await show(SAM);
    // Sam's own pay day (the 10th) has passed; Alex's glass is household-visible, but its card offers Sam no pay controls.
    expect(extra("income").map((row) => row.getAttribute("aria-label"))).toEqual(["Alex (fictional)'s pay, Sep 25 — glass: if all of it came in. Not money in the Fund."]);
    await click(extra("income")[0]);
    expect(button(/private pay/)).toBeUndefined();
    expect(button("Hide my pay from the jars")).toBeUndefined();
    await show(ALEX);
    await click(extra("income")[0]);
    const toggle = button("Include my private pay · this phone")!;
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    await click(toggle);
    expect(localStorage.getItem(CELLAR_OWN_PAY_KEY)).toBe("1");
    expect(button("Private pay included · this phone")!.getAttribute("aria-pressed")).toBe("true");
    expect(calls).toBe(0); // nothing written to the books
  });

  it("missing: the custodian offers, the partner says yes, the custodian rolls it behind Confirm — once", async () => {
    books = seeded();
    const start = projectHouseholdFund(books, TODAY).kittyCents;
    await show(ALEX);
    await click(extra("missing")[0]);
    const card = $(".queen-jar-card--missing")!;
    expect(card.querySelector(".queen-cellar-cheer")?.getAttribute("aria-hidden")).toBe("true");
    expect(card.querySelectorAll(".queen-cellar-cheer i")).toHaveLength(10);
    expect(card.textContent).toMatch(/Fictional streaming wasn't charged for Sep 12 — \$16\.00 stayed in the water\./);
    expect(card.textContent).toMatch(/Roll the whole \$16\.00 into a goal kitty bank\? Sam \(fictional\) confirms first\./);
    const select = card.querySelector<HTMLSelectElement>("select")!;
    const beach = [...select.options].find((row) => row.textContent === "Fictional beach weekend")!;
    await act(async () => { select.value = beach.value; select.dispatchEvent(new Event("change", { bubbles: true })); });
    await click(button("Offer to roll $16.00"));
    expect(calls).toBe(1);
    expect(books.fundEvents).toHaveLength(seeded().fundEvents!.length); // an offer moves nothing
    expect($(".queen-jar-card--missing")!.textContent).toMatch(/You offered to roll \$16\.00 into Fictional beach weekend\. Waiting on Sam \(fictional\)\./);
    expect(button("Roll $16.00 into Fictional beach weekend")).toBeUndefined();

    // Sam's phone: the offer waits; Sam says yes.
    await show(SAM);
    expect(extra("missing")[0]!.getAttribute("aria-label")).toMatch(/an offer is waiting$/);
    await click(extra("missing")[0]);
    expect($(".queen-jar-card--missing")!.textContent).toMatch(/Alex \(fictional\) offers to roll \$16\.00 into Fictional beach weekend\./);
    expect(button("Offer to roll $16.00")).toBeUndefined();
    await click(button("Yes, roll it"));
    expect(calls).toBe(2);
    expect($(".queen-jar-card--missing")!.textContent).toMatch(/You said yes\. Alex \(fictional\) rolls \$16\.00 into Fictional beach weekend\./);
    expect(button(/^Roll \$/)).toBeUndefined();

    // Alex's phone: roll it, behind Confirm.
    await show(ALEX);
    await click(extra("missing")[0]);
    await click(button("Roll $16.00 into Fictional beach weekend"));
    expect(calls).toBe(2); // nothing until Confirm
    const sheet = document.querySelector("[role='dialog']")!;
    expect(sheet.textContent).toMatch(/reserves \$16\.00 of the Fund's safe surplus for Fictional beach weekend, once/);
    expect(sheet.textContent).toMatch(/does not move money at your bank/);
    await click(button("Roll $16.00"));
    await settle();
    // The roll, then Alex's own spent offer is taken back automatically.
    expect(projectHouseholdFund(books, TODAY).kittyCents - start).toBe(1600);
    expect($(".queen-jar-card--missing")!.textContent).toMatch(/Rolled \$16\.00 into Fictional beach weekend through the Fund's rollover\. It won't roll again\./);
    expect(extra("missing")[0]!.querySelector(".queen-extrajar__mark")!.textContent).toBe("✓");
    expect(button(/^Roll \$16\.00/)).toBeUndefined();
    const cellarRows = (books.planBridgeDecisions ?? []).filter((row) => row.label.endsWith("— from the cellar"));
    expect(cellarRows.find((row) => row.offeredByMemberId === ALEX)!.state).toBe("withdrawn");
    // Sam's phone tidies Sam's own spent yes the same way.
    await show(SAM);
    await settle();
    expect((books.planBridgeDecisions ?? []).filter((row) => row.label.endsWith("— from the cellar")).every((row) => row.state === "withdrawn")).toBe(true);
    expect(projectHouseholdFund(books, TODAY).kittyCents - start).toBe(1600);
  });

  it("a late charge clears the mark and takes back the waiting offer", async () => {
    books = seeded();
    await show(ALEX);
    await click(extra("missing")[0]);
    await click(button("Offer to roll $16.00"));
    const subId = books.recurrences.find((row) => row.note === "Fictional streaming")!.id;
    books = recordBillPayment(books, { recurrenceId: subId, occurrenceDate: "2026-09-12", paymentDate: "2026-09-17", amount: "16", accountId: "ACC-VISA", createdBy: ALEX }).household;
    const before = calls;
    await show(ALEX, "2026-09-17");
    expect(extra("missing")).toHaveLength(0);
    expect($(".queen-jar-card--missing")).toBeNull();
    expect(calls).toBe(before + 1);
    expect((books.planBridgeDecisions ?? []).filter((row) => row.label.endsWith("— from the cellar")).map((row) => row.state)).toEqual(["withdrawn"]);
  });

  it("a partner sees no offer button — only the custodian offers", async () => {
    books = seeded();
    await show(SAM);
    await click(extra("missing")[0]);
    expect($(".queen-jar-card--missing")!.textContent).toMatch(/Alex \(fictional\) holds the Fund, so they can offer to roll \$16\.00 into a goal; you confirm it\./);
    expect(button(/^Offer to roll/)).toBeUndefined();
    expect(button("Yes, roll it")).toBeUndefined();
    // Escape closes the card and returns focus to the jar.
    await act(async () => { $(".queen-jar-card--missing")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    await act(async () => { await new Promise((resolve) => requestAnimationFrame(() => resolve(null))); });
    expect($(".queen-jar-card--missing")).toBeNull();
    expect(document.activeElement).toBe(extra("missing")[0]);
  });
});

describe("Cellar v3 stays off without VITE_CELLAR_V3 (D-281, review H1)", () => {
  it("draws no extra jar, offers nothing and writes nothing, even with a spent offer waiting", async () => {
    vi.stubEnv("VITE_CELLAR_V3", "0");
    books = seeded();
    const sub = books.recurrences.find((row) => row.note === "Fictional streaming")!;
    const [entry] = missingSubscriptions(books, { today: TODAY, memberId: ALEX }).open;
    const goalId = books.goals.find((row) => row.name === "Fictional beach weekend")!.id;
    books = offerMissingRoll(books, { today: TODAY, memberId: ALEX, entryId: entry!.id, goalId }).household;
    books = recordBillPayment(books, { recurrenceId: sub.id, occurrenceDate: "2026-09-12", paymentDate: "2026-09-15", amount: "16", accountId: "ACC-VISA", createdBy: ALEX }).household;
    expect(missingSubscriptions(books, { today: TODAY, memberId: ALEX }).voidRowIds).toHaveLength(1);
    const before = books;
    await show(ALEX);
    await settle();
    expect($$(".queen-jar--extra")).toHaveLength(0);
    expect(calls).toBe(0);
    expect(books).toBe(before);
    expect($(".queen-room__sub")!.textContent).not.toMatch(/glass|missing/);
  });
});

// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedDemoHousehold } from "../src/core/seed.ts";
import { buildHarbourReading, type HarbourReading } from "../src/harbour/data/reading.ts";
import { DeskShell, type DeskShellProps } from "../src/harbour/desk/DeskShell.tsx";
import { readPost } from "../src/harbour/desk/todayModel.ts";
import { readNeeds, readSince } from "../src/harbour/glass/campCardModel.ts";
import type { Household } from "../src/core/types.ts";

/**
 * SIMPLE_VIEW_DESK S8: the last of the Court's reading edition harvested onto
 * Today — the mailbox's notice (`HarbourReading.noticed`) as a paper notice
 * that opens the mailbox's own door, and the "since you were here" slip
 * (`HarbourReading.slip`) tucked in beneath it. No reading, no post: the
 * personal Desk is handed null and guesses nothing. Fictional demo data only.
 */
const today = "2026-09-20";
const household = seedDemoHousehold({ today });
const memberId = household.members[0]!.id;
const reading = buildHarbourReading(household, memberId, today, "current");

const withPost = (noticed: HarbourReading["noticed"], slip: string[]): HarbourReading => ({ ...reading, noticed, slip });
const HERCULES_NOTICE: NonNullable<HarbourReading["noticed"]> = { fact: "Groceries ran a little high this week.", next: "Review it with Hercules.", target: "hercules", source: "hercules" };

let host: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

async function mount(props: Partial<DeskShellProps> = {}) {
  const opened: Array<[string, string | undefined]> = [];
  const all: DeskShellProps = { household, memberId, scope: "household", today, reading, onOpen: (t, o) => opened.push([t, o]), ...props };
  await act(async () => root.render(createElement(DeskShell, all)));
  return { opened };
}
const q = <T extends Element = HTMLElement>(selector: string) => host.querySelector<T>(selector);

describe("readPost — the notice and the slip, read off the harbour's reading", () => {
  it("carries the reading's own notice and slip, household only", () => {
    expect(reading.noticed).not.toBeNull();
    expect(reading.slip.length).toBeGreaterThan(0);
    const post = readPost(reading, "household")!;
    expect(post.notice).toBe(reading.noticed);
    expect(post.slip).toEqual(reading.slip);
    expect(readPost(reading, "personal")).toBeNull();
  });

  it("has no post without a reading, or with neither a notice nor a slip line", () => {
    expect(readPost(null, "household")).toBeNull();
    expect(readPost(withPost(null, []), "household")).toBeNull();
    expect(readPost(withPost(null, ["  ", ""]), "household")).toBeNull();
  });

  it("tidies the slip the way the Court's slip plate does, three lines at most", () => {
    const post = readPost(withPost(null, ["  One   line ", "", "Two", "Three", "Four"]), "household")!;
    expect(post.notice).toBeNull();
    expect(post.slip).toEqual(["One line", "Two", "Three"]);
  });
});

/**
 * Tool Atlas §3.5 folds the post into the camp card: a Fund pulse notice is a
 * "Needs you" item on the third line, "since you were here" is that line's
 * second priority, and Hercules's own good news is his line on the open card.
 * The Desk's Today *is* the card in full, so it says the same.
 */
describe("Today's post, folded into the card", () => {
  const PULSE_NOTICE: NonNullable<HarbourReading["noticed"]> = { fact: "The Fund needs a look.", next: "Open the bank.", target: "queen", source: "pulse" };

  it("lists a Fund pulse notice among Needs you, behind what is waiting on this reader, with its own door", () => {
    const needs = readNeeds({ household, memberId, today, reading: withPost(PULSE_NOTICE, []), space: "ours" });
    const pulse = needs.items.find(item => item.source === "pulse")!;
    expect(pulse).toEqual({ id: "pulse", words: "The Fund needs a look", door: { target: "queen" }, source: "pulse" });
    expect(needs.items.at(-1)).toBe(pulse);
    // Hercules's good news is not a need.
    expect(readNeeds({ household, memberId, today, reading: withPost(HERCULES_NOTICE, []), space: "ours" }).items.some(item => item.source === "pulse")).toBe(false);
    expect(readNeeds({ household, memberId, today, reading: withPost(PULSE_NOTICE, []), space: "mine" }).items).toEqual([]);
  });

  it("puts Needs you on the third line and opens its first door", async () => {
    const { opened } = await mount({ reading: withPost(PULSE_NOTICE, []) });
    const line = q<HTMLButtonElement>('[data-card-line="3"]')!;
    expect(line.tagName).toBe("BUTTON");
    expect(line.dataset.cardLine3).toBe("needs");
    expect(line.textContent).toMatch(/^Needs you · /);
    await act(async () => line.click());
    expect(opened.length).toBe(1);
  });

  it("with nothing waiting, says what the partner recorded since this viewer's last visit, from the shared books only", () => {
    const partner = household.members.find(member => member.id !== memberId)!;
    const quiet = { ...household, fundEvents: [], planVersions: [], planBridgeDecisions: [] } as unknown as Household;
    const since = "2099-01-01T00:00:00.000Z";
    const template = quiet.transactions.find(row => row.type === "expense" && row.visibility !== "personal")!;
    const later = [1, 2, 3].map(i => ({ ...template, id: `TX-since-${i}`, createdBy: partner.id, createdAt: `2099-01-0${i + 1}T12:00:00.000Z`, amountCents: 1000 * i, visibility: template.visibility }));
    const hidden = { ...template, id: "TX-since-private", createdBy: partner.id, createdAt: "2099-01-05T12:00:00.000Z", amountCents: 99_900, visibility: "personal" as const };
    const withSince = { ...quiet, transactions: [...quiet.transactions, ...later, hidden] } as Household;
    const read = readSince({ household: withSince, memberId, today, since, space: "ours" })!;
    expect(read.words).toBe(`${partner.name} recorded 3 purchases · $60.00`);
    expect(read.door).toEqual({ target: "books" });
    expect(readSince({ household: withSince, memberId, today, since: null, space: "ours" })?.words ?? "").not.toMatch(/recorded/);
    expect(readSince({ household: withSince, memberId, today, since, space: "mine" })).toBeNull();
  });

  it("keeps the rest of Today reading when the Desk is handed no reading", async () => {
    await mount({ reading: null });
    expect(q('[data-desk-pot="everyday"]')).not.toBeNull();
    expect(q('[data-card-line="2"]')).not.toBeNull();
    expect(q('[data-card-line="3"]')).not.toBeNull();
  });

  it("the personal Desk has no Needs you and no partner's news", async () => {
    await mount({ scope: "personal" });
    expect(q('[data-card-line="3"]')!.getAttribute("data-card-line3")).not.toMatch(/needs|since/);
  });
});

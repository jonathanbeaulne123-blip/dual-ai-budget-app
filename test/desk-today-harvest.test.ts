// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedDemoHousehold } from "../src/core/seed.ts";
import { buildHarbourReading, type HarbourReading } from "../src/harbour/data/reading.ts";
import { DeskShell, type DeskShellProps } from "../src/harbour/desk/DeskShell.tsx";
import { readPost } from "../src/harbour/desk/todayModel.ts";

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

describe("Today's post", () => {
  it("pins the mailbox's notice as a button to the mailbox's own door, with the slip tucked in beneath", async () => {
    const { opened } = await mount();
    const today = q(".desk-today")!;
    expect(today.hasAttribute("data-desk-post")).toBe(true);
    const notice = q<HTMLButtonElement>("[data-desk-notice]")!;
    expect(notice.tagName).toBe("BUTTON");
    expect(notice.type).toBe("button");
    expect(notice.dataset.deskNotice).toBe(reading.noticed!.source);
    expect(notice.textContent).toContain(reading.noticed!.fact);
    expect(notice.textContent).toContain(reading.noticed!.next);
    expect(notice.getAttribute("aria-label")).toBe(`Mailbox, flag up. ${reading.noticed!.fact} ${reading.noticed!.next}`);
    await act(async () => notice.click());
    expect(opened).toEqual([[reading.noticed!.target, undefined]]);

    const slip = q("[data-desk-slip]")!;
    expect(notice.nextElementSibling).toBe(slip);
    const heading = document.getElementById(slip.getAttribute("aria-labelledby")!)!;
    expect(heading.textContent).toBe("Since you were here");
    expect([...slip.querySelectorAll("li")].map(li => li.textContent)).toEqual(reading.slip);
  });

  it("hides the notice when the mailbox is empty and keeps the slip on its own", async () => {
    await mount({ reading: withPost(null, ["Bianca acknowledged the 2026-09 Plan."]) });
    expect(q("[data-desk-notice]")).toBeNull();
    const slip = q("[data-desk-slip]")!;
    expect(slip.textContent).toContain("Bianca acknowledged the 2026-09 Plan.");
    expect(slip.parentElement!.children.length).toBe(1);
  });

  it("shows the notice without a slip when nothing has happened since", async () => {
    await mount({ reading: withPost(reading.noticed, []) });
    expect(q("[data-desk-notice]")).not.toBeNull();
    expect(q("[data-desk-slip]")).toBeNull();
  });

  it("has no post at all with neither — the page keeps its S7 layout", async () => {
    await mount({ reading: withPost(null, []) });
    expect(q(".desk-post")).toBeNull();
    expect(q(".desk-today")!.hasAttribute("data-desk-post")).toBe(false);
  });

  it("omits the post when the Desk is handed no reading, and the rest of Today still reads", async () => {
    await mount({ reading: null });
    expect(q(".desk-post")).toBeNull();
    expect(q("[data-desk-notice]")).toBeNull();
    expect(q("[data-desk-slip]")).toBeNull();
    expect(q('[data-desk-pot="everyday"]')).not.toBeNull();
    expect(q("[data-desk-sundial]")).not.toBeNull();
  });

  it("sends Hercules's own notice to the Hercules panel, the way his corner's Talk button does", async () => {
    const onTalk = vi.fn();
    const { opened } = await mount({ reading: withPost(HERCULES_NOTICE, []), onTalk });
    const notice = q<HTMLButtonElement>("[data-desk-notice]")!;
    expect(notice.dataset.deskNotice).toBe("hercules");
    await act(async () => notice.click());
    expect(onTalk).toHaveBeenCalledTimes(1);
    expect(opened).toEqual([]);
  });

  it("with no Talk wired, Hercules's notice opens his door, exactly as the Court's mailbox did", async () => {
    const { opened } = await mount({ reading: withPost(HERCULES_NOTICE, []) });
    await act(async () => q<HTMLButtonElement>("[data-desk-notice]")!.click());
    expect(opened).toEqual([["hercules", undefined]]);
  });

  it("the personal Desk has no post, even if a reading were passed", async () => {
    await mount({ scope: "personal" });
    expect(q(".desk-post")).toBeNull();
    expect(q("[data-desk-notice]")).toBeNull();
  });
});

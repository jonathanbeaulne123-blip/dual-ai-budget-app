// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedDemoHousehold } from "../src/core/seed.ts";
import { PERSONAL_PLATE_IDS, personalPlates } from "../src/core/deskPlates.ts";
import { buildDashboard } from "../src/core/insights.ts";
import { projectLedgerExperience } from "../src/core/ledgerExperience.ts";
import { deskMonthSeals } from "../src/core/officeWide.ts";
import { formatCad } from "../src/core/money.ts";
import { shiftPostingStreak } from "../src/core/shiftStreak.ts";
import { DeskShell, deskHeaderWords, type DeskShellProps } from "../src/harbour/desk/DeskShell.tsx";
import { PERSONAL_LEVEL_PLATE, PERSONAL_PLATE_DOORS, readPersonalToday } from "../src/harbour/desk/personalModel.ts";
import { editionFlipWords } from "../src/harbour/nav/Compass.tsx";

/**
 * The personal Desk (SIMPLE_VIEW_DESK S5): the same shell, my folio's own
 * instruments. Today in personal scope reads the Office's six personal plates
 * and its "Personal income this month" seals over the personal-scope month;
 * the month plate stands in the Level's slot; every card is a door; nothing
 * posts. Fictional demo data only.
 */
const today = "2026-09-20";
const household = seedDemoHousehold({ today });
const memberId = household.members[0]!.id;

let host: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  try { window.localStorage.clear(); } catch { /* optional */ }
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

async function mount(props: Partial<DeskShellProps> = {}) {
  const opened: Array<[string, string | undefined]> = [];
  const all: DeskShellProps = { household, memberId, scope: "personal", today, reading: null, onOpen: (t, o) => opened.push([t, o]), ...props };
  await act(async () => root.render(createElement(DeskShell, all)));
  return { desk: host.querySelector<HTMLElement>("[data-desk]")!, opened };
}
const q = <T extends Element = HTMLElement>(selector: string) => host.querySelector<T>(selector)!;
const qa = <T extends Element = HTMLElement>(selector: string) => [...host.querySelectorAll<T>(selector)];

/** What the Office reads for a personal folio: its scoped household, dashboard and streak. */
function officeRead() {
  const experience = projectLedgerExperience(household, memberId, "personal", today);
  if (!experience.ok) throw new Error("demo member should read the ledger");
  const scoped = experience.scopedHousehold;
  const dashboard = buildDashboard(scoped, today);
  return { plates: personalPlates({ household: scoped, dashboard, today, memberId, streak: shiftPostingStreak(scoped, today) }), seals: deskMonthSeals(dashboard.month) };
}

describe("Today in personal scope", () => {
  it("stands the Office's six personal plates, the month plate in the Level's slot, and no household pot", async () => {
    const { desk } = await mount();
    expect(desk.dataset.deskScope).toBe("personal");
    expect(q("[data-desk-scope='personal'].desk-today")).toBeTruthy();
    expect(host.querySelector("[data-desk-pot]")).toBeNull();
    expect(host.querySelector("[data-desk-sundial]")).toBeNull();
    const office = officeRead();
    const shown = qa("[data-desk-plate]");
    expect(shown.map(plate => plate.dataset.deskPlate).sort()).toEqual([...PERSONAL_PLATE_IDS].sort());
    for (const plate of office.plates) {
      const card = q(`[data-desk-plate="${plate.id}"]`);
      expect(card.tagName).toBe("BUTTON");
      expect(card.querySelector(".desk-card__kicker")!.textContent).toBe(plate.kicker);
      expect(card.querySelector(".desk-plate-card__glance")!.textContent).toBe(plate.glance);
      expect(card.getAttribute("aria-label")).toContain(plate.verdict);
      // The live renderer draws the figure unless the plate says it is empty.
      if (plate.empty) expect(card.textContent).toContain(plate.empty);
      else expect(card.querySelector(".desk-plate-card__figure svg.desk-plate-svg")).not.toBeNull();
    }
    const level = q("[data-desk-level='personal']");
    expect(level.querySelector(`[data-desk-plate="${PERSONAL_LEVEL_PLATE}"]`)).not.toBeNull();
    expect(q("[aria-label='My instruments']").querySelector(`[data-desk-plate="${PERSONAL_LEVEL_PLATE}"]`)).toBeNull();
  });

  it("presses the Office's personal seals — Personal income this month — over the personal-scope month", async () => {
    await mount();
    const { seals } = officeRead();
    const shown = qa("[data-desk-personal-seals] [data-desk-seal]");
    expect(shown.map(seal => seal.dataset.deskSeal)).toEqual(["in", "out", "leftover"]);
    expect(shown.map(seal => seal.querySelector(".desk-seal__figure")!.textContent)).toEqual([formatCad(seals.inCents), formatCad(seals.outCents), formatCad(seals.leftoverCents)]);
    expect(shown.map(seal => seal.querySelector(".desk-seal__sub")!.textContent)).toEqual(["Personal income this month", "Personal expenses this month", "Posted in minus posted expenses"]);
    expect(shown[2]!.hasAttribute("data-seal-cracked")).toBe(seals.leftoverCents < 0);
    // Personal is not the household: the household Desk's seals read the shared month.
    const shared = projectLedgerExperience(household, memberId, "household", today);
    if (!shared.ok) throw new Error("demo member should read the shared ledger");
    expect(deskMonthSeals(buildDashboard(shared.scopedHousehold, today).month)).not.toEqual(seals);
  });

  it("reads — for someone the ledger does not know, and never $0", async () => {
    await mount({ memberId: "not-a-member" });
    expect(qa(".desk-seal__figure").map(figure => figure.textContent)).toEqual(["—", "—", "—"]);
    expect(q("[data-desk-plates='unknown']").textContent).toContain("—");
    expect(host.textContent).not.toMatch(/\$0\.00/);
    expect(readPersonalToday(household, "not-a-member", today)).toEqual({ plates: [], seals: null, monthLabel: "September" });
  });

  it("makes every plate a door, keeps Hercules's corner, and posts nothing", async () => {
    const onTalk = vi.fn();
    const { opened } = await mount({ onTalk });
    for (const id of PERSONAL_PLATE_IDS) await act(async () => q<HTMLButtonElement>(`[data-desk-plate="${id}"]`).click());
    expect(opened).toEqual(PERSONAL_PLATE_IDS.map(id => [PERSONAL_PLATE_DOORS[id].target, undefined]));
    expect(opened.map(([target]) => target)).toEqual(["shift", "shift", "shift", "books", "loft-banks", "books"]);
    await act(async () => q<HTMLButtonElement>(".desk-door--talk").click());
    expect(onTalk).toHaveBeenCalledTimes(1);
  });

  it("names my own house and my Desk in the header, and gives the App its heading id for Put it back", async () => {
    await mount({ titleId: "house-world-title", spaceSlot: createElement("span", { "data-test-space": "" }, "My Money") });
    const flip = q<HTMLButtonElement>("[data-desk-flip]");
    expect(flip.textContent).toContain("My house");
    expect(flip.getAttribute("aria-label")).toBe(deskHeaderWords("personal").flipAria);
    const heading = q<HTMLHeadingElement>("#house-world-title");
    expect(heading.textContent).toBe("My Desk");
    expect(heading.tabIndex).toBe(-1);
    expect(q("[data-desk]").getAttribute("aria-labelledby")).toBe("house-world-title");
    expect(q('[data-desk-slot="space"] [data-test-space]')).toBeTruthy();
    // The flip writes the one edition switch, whichever world it names.
    window.localStorage.setItem("hearth:motion", "flat");
    await act(async () => flip.click());
    expect(window.localStorage.getItem("hearth:motion")).toBe("");
  });

  it("keeps the household identity and a focusable return heading", async () => {
    await mount({ scope: "household" });
    expect(q("[data-desk-flip]").getAttribute("aria-label")).toBe("Harbour — flip back to the illustrated Harbour");
    expect(q(".desk__title h1").textContent).toBe("The Desk");
    expect(q(".desk__title h1").getAttribute("tabindex")).toBe("-1");
    expect(host.querySelector("[data-desk-pot='everyday']")).not.toBeNull();
    expect(host.querySelector("[data-desk-plate]")).toBeNull();
  });
});

describe("the flip's words in personal scope", () => {
  it("names the illustrated house, not a harbour personal scope does not have", () => {
    expect(editionFlipWords("flat", "house")).toEqual({ label: "My house", aria: "Switch to the illustrated house" });
    expect(editionFlipWords("illustrated", "house")).toEqual({ label: "Simple view", aria: "Switch to the simple view" });
    expect(editionFlipWords("flat")).toEqual({ label: "Harbour", aria: "Switch to the illustrated harbour" });
  });
});

describe("the App's personal Desk wiring (source)", () => {
  const app = readFileSync(join(process.cwd(), "src", "App.tsx"), "utf8");
  const harbour = readFileSync(join(process.cwd(), "src", "harbour", "HarbourWorld.tsx"), "utf8");

  it("flips with the backtick in both spaces, still behind the harbour gate", () => {
    expect(app).toMatch(/useEditionFlipKey\(HARBOUR_ENABLED && Boolean\(household && session\)\);/);
    expect(app).not.toMatch(/useEditionFlipKey\([^)]*view === "household"/);
  });

  it("stands one island for both spaces (Tool Atlas D2): the harbour mounts in Mine with the member's own source, and no personal Desk branch remains", () => {
    expect(app).not.toMatch(/personalFlat|personalDesk/);
    // The same source the personal Desk always read (never the partner's personal rows), one key for both spaces so the pill closes nothing.
    expect(app).toMatch(/<HarbourWorld key=\{`\$\{environment\}:\$\{household\.householdId\}:\$\{actorId\}`\} household=\{view==="personal"\?\(personalSource\?\?household\):household\} memberId=\{actorId\} scope=\{view\} space=\{spaceForView\(view\)\}/);
    // The flat tier's Desk inside the harbour takes the space's scope; the illustrated personal house stands only without the harbour.
    expect(app).toMatch(/\(!HARBOUR_ENABLED\|\|view==="household"\)\?<HouseWorld /);
  });

  it("threads the space switch through the harbour into the household Desk's header, one prop", () => {
    expect(app).toMatch(/<HarbourWorld [^\n]*? spaceSlot=\{spaceSwitchNode\} onQuickSheet=\{\(\)=>setQuickSheetOpen\(true\)\} fab=\{charterTakeoverVisible\?undefined:harbourBarFab\}\/><\/Suspense>/);
    expect(harbour).toMatch(/spaceSlot\?: ReactNode;/);
    expect(harbour).toMatch(/<DeskShell [^\n]*spaceSlot=\{props\.spaceSlot\} \/>/);
  });

  it("serves both spaces with one glass chrome and one All-tools sheet, and no personal bottom bar", () => {
    expect(app).not.toMatch(/<EditionFlip className="house-nav-flip"/);
    expect(app).toMatch(/HARBOUR_ENABLED\?<><Compass fab=\{harbourBarFab\}/);
    expect(app.match(/<QuickSheet /g) ?? []).toHaveLength(1);
    expect(app).toContain("space={spaceForView(view)} spaceSwitch={spaceSwitchNode}");
  });
});

// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedDemoHousehold } from "../src/core/seed.ts";
import { buildHarbourReading } from "../src/harbour/data/reading.ts";
import { campCardModel } from "../src/harbour/glass/campCardModel.ts";
import { stripLedger } from "../src/harbour/glass/dayLedger.ts";
import { Dock, type DockProps } from "../src/harbour/glass/Dock.tsx";

/**
 * The dock (Tool Atlas §4.1 "Where they sit", §4.3, §4.4, A8, A9, A16, A17,
 * A18): a camera dead zone by origin that traps nothing, solid under every
 * fallback, three dressings, the two-tone focus ring. Fictional demo data.
 */
const today = "2026-09-25";
const household = seedDemoHousehold({ today });
const memberId = household.members[0]!.id;
const reading = buildHarbourReading(household, memberId, today, "current");
const ledger = stripLedger({ household, memberId, space: "ours", today });
const model = campCardModel({ household, memberId, space: "ours", today, ledger, reading });
const noop = () => undefined;
const dockProps = (extra: Partial<DockProps> = {}): DockProps => ({
  strip: { ledger, onOpenCalendar: noop, onMonthBack: noop, onMonthForward: noop },
  card: { model, space: "ours", onSpaceChange: noop, expanded: false, onExpandedChange: noop, onOpenBank: noop, onOpenCellar: noop, onOpenCalendar: noop, onOpen: noop, onRecord: noop, onTalk: noop, onOpenBooks: noop, onStepIn: noop, onWhatChanged: noop },
  ...extra,
});

let host: HTMLDivElement, root: Root;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const render = async (p: DockProps) => act(async () => root.render(createElement(Dock, p)));
const dock = () => host.querySelector<HTMLElement>(".glass-dock")!;

describe("Dock — a dead zone that traps nothing (A8)", () => {
  it("marks its root for the camera and keeps the browser's zoom", async () => {
    await render(dockProps());
    expect(dock().hasAttribute("data-camera-deadzone")).toBe(true);
    expect(dock().style.touchAction).toBe("manipulation");
    // The strip, then the card, inside one glass.
    const glass = dock().querySelector(".glass-dock__glass")!;
    expect([...glass.children].map(el => el.className)).toEqual(["glass-strip", "glass-card glass-card--dock"]);
  });

  it("five stops at rest means two here: the strip's band and the card's one row stop (A5)", async () => {
    await render(dockProps());
    const tabbable = [...dock().querySelectorAll<HTMLElement>("button, [tabindex], a[href], input")].filter(el => el.tabIndex >= 0);
    expect(tabbable).toHaveLength(2);
    expect(tabbable[0]!.getAttribute("role")).toBe("grid");
    expect(tabbable[1]!.getAttribute("role")).toBe("radio");
  });

  it("no pointer, touch, wheel or key handler calls preventDefault", async () => {
    await render(dockProps({ card: { ...dockProps().card, expanded: true } }));
    const spy = vi.spyOn(Event.prototype, "preventDefault");
    const targets = [...dock().querySelectorAll<HTMLElement>("button, [role='grid'], [role='gridcell']")];
    await act(async () => {
      for (const el of targets) for (const type of ["pointerdown", "pointermove", "touchstart", "touchmove", "wheel"]) el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
      for (const key of ["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"]) dock().querySelector<HTMLElement>("[role='grid']")!.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    });
    expect(spy).not.toHaveBeenCalled();
    const sources = ["Dock.tsx", "StripBand.tsx", "CampCard.tsx", "CardParts.tsx", "Markers.tsx"].map(name => readFileSync(join(process.cwd(), "src/harbour/glass", name), "utf8"));
    for (const source of sources) {
      expect(source).not.toMatch(/\.preventDefault\(/);
      expect(source).not.toMatch(/setPointerCapture|touch-action:\s*none|touchAction:\s*"none"/);
    }
  });

  it("says calm, lite and night on its root for the glass to read", async () => {
    await render(dockProps({ calm: true, lite: true, night: true }));
    expect(dock().dataset).toMatchObject({ calm: "true", lite: "true", night: "true" });
    await render(dockProps());
    expect(dock().hasAttribute("data-calm")).toBe(false);
    expect(dock().hasAttribute("data-lite")).toBe(false);
  });
});

describe("glass.css — the glass, its fallbacks and its dressings", () => {
  const css = readFileSync(join(process.cwd(), "src/harbour/glass/glass.css"), "utf8");
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");

  it("tints at .80 by day and .82 at night, with blur(10px) (§4.1, §4.4)", () => {
    expect(bare).toMatch(/--glass-fill:\s*rgba\(246,\s*240,\s*228,\s*\.80\)/);
    expect(bare).toMatch(/\[data-night\][^{]*\{[^}]*--glass-fill:\s*rgba\(246,\s*240,\s*228,\s*\.82\)/);
    expect(bare).toMatch(/--glass-blur:\s*blur\(10px\)/);
  });

  it("turns solid — #F6F0E4, no blur, a 1 px #8A7A69 line — under every fallback (A9, A17)", () => {
    for (const query of ["prefers-reduced-transparency: reduce", "prefers-reduced-motion: reduce", "prefers-contrast: more", "forced-colors: active"]) {
      const at = bare.indexOf(`@media (${query})`);
      expect(at, query).toBeGreaterThan(-1);
      const block = bare.slice(at, bare.indexOf("\n}\n", at));
      expect(block, query).toMatch(/backdrop-filter:\s*none/);
    }
    for (const flag of ["data-calm", "data-lite"]) expect(bare).toMatch(new RegExp(`\\.glass-dock\\[${flag}\\] \\.glass-dock__glass[^{]*\\{[^}]*background:\\s*var\\(--glass-solid\\)[^}]*backdrop-filter:\\s*none[^}]*outline:\\s*1px solid var\\(--glass-stroke\\)`));
    expect(bare).toMatch(/--glass-solid:\s*#F6F0E4/);
    expect(bare).toMatch(/--glass-stroke:\s*#8A7A69/);
    expect(bare).toMatch(/forced-colors: active\)[\s\S]*border:\s*1px solid transparent/);
  });

  it("never sets #8A7A69 as a text colour; secondary text is #5A4A3C (A16)", () => {
    expect(bare).not.toMatch(/(^|[^-])color:\s*#8A7A69/im);
    expect(bare).not.toMatch(/(^|[^-])color:\s*var\(--glass-stroke\)/m);
    expect(bare).toMatch(/--glass-ink-2:\s*#5A4A3C/);
    expect(bare).not.toMatch(/#716456/i);
  });

  it("draws the two-tone focus ring with outline (A18)", () => {
    expect(bare).toMatch(/:focus-visible\s*\{\s*outline:\s*2px solid #1A1714;\s*outline-offset:\s*2px;\s*box-shadow:\s*0 0 0 4px #fff;/);
  });

  it("authors all three dressings on :root[data-theme]", () => {
    expect(bare).toMatch(/:root\[data-theme="taylor"\] \.glass-dock \{[^}]*--glass-ink:\s*#49323D/);
    expect(bare).toMatch(/:root\[data-theme="taylor"\] \.glass-dock__glass::before \{[^}]*232, 166, 189/);
    expect(bare).toMatch(/:root\[data-theme="newfoundland"\] \.glass-dock \{[^}]*--glass-ink:\s*#273E41/);
    expect(bare).toMatch(/:root\[data-theme="newfoundland"\] \.glass-dock__glass \{[^}]*border:\s*1\.5px solid #f5f3ea/);
    expect(bare).toMatch(/\.glass-dock \{[^}]*--glass-ink:\s*#2E241B/);
  });

  it("keeps the dock 216 px at rest, a 300 px right column on a landscape phone, 360 px on desktop (§6)", () => {
    expect(bare).toMatch(/height:\s*calc\(216px \+ env\(safe-area-inset-bottom, 0px\)\)/);
    expect(bare).toMatch(/@media \(orientation: landscape\) and \(max-height: 500px\) \{[\s\S]*?width:\s*300px/);
    expect(bare).toMatch(/@media \(min-width: 1100px\) \{[\s\S]*?width:\s*360px/);
    expect(bare).toMatch(/\.glass-dock \{[^}]*touch-action:\s*manipulation/);
  });
});

// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fabActionsFor } from "../src/core/fabActions.ts";
import { Bubble, BLUR_RESTORE_MS, LONG_PRESS_MS, type BubbleProps } from "../src/harbour/bubbles/Bubble.tsx";
import { GlassChrome, flipWords } from "../src/harbour/bubbles/GlassChrome.tsx";
import { withinMargin } from "../src/harbour/bubbles/deadzone.ts";
import { QUIET_ENVIRONMENT, glassMode, labelAtRest } from "../src/harbour/bubbles/glassMode.ts";
import { countUse, readRecentTools, readUsedCount, rememberRecentTool, usedKey } from "../src/harbour/bubbles/usage.ts";
import { publishEditionAvailability } from "../src/harbour/nav/editionAvailability.ts";

/**
 * The glass bubble (Tool Atlas brief §4.1–§4.4, A9, A11, A17, A22, A23): the
 * label rule, the solid fallbacks, blur while the camera moves, disabled
 * reasons, the dead margin, and the three dressings in the stylesheet.
 */
let host: HTMLDivElement, root: Root;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); window.localStorage.clear(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); window.localStorage.clear(); publishEditionAvailability({ flat: false, reason: null }); });

function memoryStorage(): Pick<Storage, "getItem" | "setItem"> {
  const rows = new Map<string, string>();
  return { getItem: (key) => rows.get(key) ?? null, setItem: (key, value) => { rows.set(key, value); } };
}
const bubble = (overrides: Partial<BubbleProps> = {}) => createElement(Bubble, { kind: "tools", label: "All tools", icon: createElement("svg"), memberId: "m-jonathan", storage: memoryStorage(), environment: QUIET_ENVIRONMENT, ...overrides });
const anchor = () => host.querySelector<HTMLElement>("[data-glass-bubble]")!;
const button = () => anchor().querySelector<HTMLButtonElement>("button")!;

describe("the label rule (A11)", () => {
  it("shows the pill until five uses by this person, then only on demand", () => {
    expect(labelAtRest({ usedCount: 0 })).toBe(true);
    expect(labelAtRest({ usedCount: 4 })).toBe(true);
    expect(labelAtRest({ usedCount: 5 })).toBe(false);
    expect(labelAtRest({ usedCount: 9, alwaysShowLabels: true })).toBe(true);
    expect(labelAtRest({ usedCount: 9, calm: true })).toBe(true);
    expect(labelAtRest({ usedCount: 9, env: { contrastMore: true, largeText: false } })).toBe(true);
    expect(labelAtRest({ usedCount: 9, env: { contrastMore: false, largeText: true } })).toBe(true);
  });

  it("counts per member and per bubble, and keeps the last three tools", () => {
    const storage = memoryStorage();
    expect(usedKey("m-bianca", "record")).toBe("hearth:atlas:used:m-bianca:record");
    for (let i = 0; i < 5; i += 1) countUse("m-bianca", "record", storage);
    expect(readUsedCount("m-bianca", "record", storage)).toBe(5);
    expect(readUsedCount("m-jonathan", "record", storage)).toBe(0);
    for (const id of ["books", "calendar", "books", "fund-bank", "steps"]) rememberRecentTool("m-bianca", id, storage);
    expect(readRecentTools("m-bianca", storage)).toEqual(["steps", "fund-bank", "books"]);
  });

  it("goes icon-only after the fifth use without changing the accessible name", async () => {
    const storage = memoryStorage();
    let taps = 0;
    await act(async () => root.render(bubble({ storage, onActivate: () => { taps += 1; } })));
    expect(anchor().dataset.glassLabel).toBe("pill");
    for (let i = 0; i < 5; i += 1) await act(async () => button().click());
    expect(taps).toBe(5);
    expect(anchor().dataset.glassLabel).toBe("tip");
    expect(button().textContent).toContain("All tools");
    expect(anchor().querySelector(".glass-bubble__label--tip")).not.toBeNull();
    // Focus brings the word back as a tooltip; Escape dismisses it.
    await act(async () => { button().focus(); });
    expect(anchor().dataset.glassTip).toBe("on");
    await act(async () => { button().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect(anchor().dataset.glassTip).toBeUndefined();
  });

  it("keeps the pill with Always show labels and in calm view", async () => {
    await act(async () => root.render(bubble({ usedCount: 12, alwaysShowLabels: true })));
    expect(anchor().dataset.glassLabel).toBe("pill");
    await act(async () => root.render(bubble({ usedCount: 12, calm: true })));
    expect(anchor().dataset.glassLabel).toBe("pill");
  });

  it("shows the word on a 350 ms long press and never activates", async () => {
    vi.useFakeTimers();
    let taps = 0;
    await act(async () => root.render(bubble({ usedCount: 9, onActivate: () => { taps += 1; } })));
    await act(async () => { anchor().dispatchEvent(new Event("pointerdown", { bubbles: true })); });
    await act(async () => { vi.advanceTimersByTime(LONG_PRESS_MS + 10); });
    expect(anchor().dataset.glassTip).toBe("on");
    await act(async () => { anchor().dispatchEvent(new Event("pointerup", { bubbles: true })); button().click(); });
    expect(taps).toBe(0);
    // A short press still activates.
    await act(async () => { anchor().dispatchEvent(new Event("pointerdown", { bubbles: true })); anchor().dispatchEvent(new Event("pointerup", { bubbles: true })); button().click(); });
    expect(taps).toBe(1);
  });

  it("a slow press on an open dial verb still records; a long press on the Record bubble itself still only shows the word (review finding 7)", async () => {
    vi.useFakeTimers();
    const picked: string[] = [];
    await act(async () => root.render(createElement(GlassChrome, {
      member: "m-jonathan", environment: QUIET_ENVIRONMENT,
      fab: { actions: fabActionsFor("household", "home"), closedLabel: "Record", onPick: (mode) => picked.push(mode) },
      onOpenTools: () => undefined,
    })));
    const record = host.querySelector<HTMLElement>("[data-glass-bubble='record']")!;
    const fab = host.querySelector<HTMLButtonElement>("button.fab")!;
    // Open the dial with an ordinary press.
    await act(async () => { fab.dispatchEvent(new Event("pointerdown", { bubbles: true })); fab.dispatchEvent(new Event("pointerup", { bubbles: true })); fab.click(); });
    const verb = host.querySelector<HTMLButtonElement>("[data-fab-action='expense']")!;
    expect(verb).toBeTruthy();
    // Hold the verb for well over 350 ms, then release: it activates (the bubble's long-press guard is not its).
    await act(async () => { verb.dispatchEvent(new Event("pointerdown", { bubbles: true })); });
    await act(async () => { vi.advanceTimersByTime(LONG_PRESS_MS + 400); });
    await act(async () => { verb.dispatchEvent(new Event("pointerup", { bubbles: true })); verb.click(); });
    expect(picked).toEqual(["expense"]);
    // A long press on the closed Record bubble itself shows the word and opens nothing.
    const closed = host.querySelector<HTMLButtonElement>("button.fab")!;
    const openBefore = closed.getAttribute("aria-expanded");
    await act(async () => { closed.dispatchEvent(new Event("pointerdown", { bubbles: true })); });
    await act(async () => { vi.advanceTimersByTime(LONG_PRESS_MS + 10); });
    expect(record.dataset.glassTip).toBe("on");
    await act(async () => { closed.dispatchEvent(new Event("pointerup", { bubbles: true })); closed.click(); });
    expect(closed.getAttribute("aria-expanded")).toBe(openBefore);
    expect(picked).toEqual(["expense"]);
  });
});

describe("the solid fallback (A9, A17)", () => {
  it("is solid under every named condition, glass otherwise", () => {
    expect(glassMode(QUIET_ENVIRONMENT)).toBe("glass");
    for (const key of ["reducedTransparency", "reducedMotion", "contrastMore", "forcedColors", "saveData"] as const) {
      expect(glassMode({ ...QUIET_ENVIRONMENT, [key]: true }), key).toBe("solid");
    }
    for (const key of ["calm", "lite", "frameOverBudget"] as const) expect(glassMode(QUIET_ENVIRONMENT, { [key]: true }), key).toBe("solid");
  });

  it("marks the bubble solid for calm, lite, a missed frame budget and reduced motion", async () => {
    await act(async () => root.render(bubble()));
    expect(anchor().classList.contains("is-solid")).toBe(false);
    expect(anchor().dataset.glass).toBe("glass");
    for (const extra of [{ calm: true }, { lite: true }, { frameOverBudget: true }, { environment: { ...QUIET_ENVIRONMENT, reducedMotion: true } }]) {
      await act(async () => root.render(bubble(extra)));
      expect(anchor().classList.contains("is-solid"), JSON.stringify(extra)).toBe(true);
      expect(anchor().dataset.glass).toBe("solid");
      expect(anchor().dataset.glassBlur).toBe("off");
    }
  });

  it("drops the blur while the camera moves and restores it 120 ms after", async () => {
    vi.useFakeTimers();
    await act(async () => root.render(bubble({ cameraMoving: true })));
    expect(anchor().classList.contains("is-blur-off")).toBe(true);
    await act(async () => root.render(bubble({ cameraMoving: false })));
    await act(async () => { vi.advanceTimersByTime(BLUR_RESTORE_MS - 20); });
    expect(anchor().dataset.glassBlur).toBe("off");
    await act(async () => { vi.advanceTimersByTime(40); });
    expect(anchor().dataset.glassBlur).toBe("on");
  });

  it("writes every fallback into the stylesheet itself, so CSS alone is enough", () => {
    const css = readFileSync(join(process.cwd(), "src", "harbour", "bubbles", "bubbles.css"), "utf8");
    for (const query of ["prefers-reduced-transparency: reduce", "prefers-reduced-motion: reduce", "prefers-contrast: more", "forced-colors: active"]) expect(css).toContain(query);
    expect(css).toMatch(/--glass-solid: #f6f0e4/);
    expect(css).toMatch(/--glass-solid-line: #8a7a69/);
    expect(css).toMatch(/border: 1px solid transparent/);
    expect(css).toMatch(/outline: 2px solid var\(--glass-focus-in\)/);
    expect(css).toMatch(/backdrop-filter: blur\(14px\) saturate\(120%\)/);
    // The three dressings: the Record accents, Taylor's vellum and washi, Newfoundland's frame and ripple.
    for (const accent of ["#b04c34", "#826789", "#2f5b63"]) expect(css).toContain(accent);
    expect(css).toContain("blur(10px)");
    expect(css).toContain("rgba(232, 166, 189, 0.2)");
    expect(css).toContain("--glass-frame: 1.5px");
    expect(css).toContain("url(#hearth-glass-ripple)");
    expect(css).toMatch(/:root\[data-theme="taylor"\]/);
    expect(css).toMatch(/:root\[data-theme="newfoundland"\]/);
    // No transform, filter or backdrop on the anchor: the dial's fixed scrim must stay the viewport's.
    const anchorRule = css.match(/\n\.glass-bubble-anchor \{[\s\S]*?\n\}/)![0];
    expect(anchorRule).not.toMatch(/transform|filter/);
  });
});

describe("disabled, dead margin and names", () => {
  it("uses aria-disabled with the reason described, and says it on activation", async () => {
    let taps = 0;
    await act(async () => root.render(bubble({ disabledReason: "Step in needs WebGL", onActivate: () => { taps += 1; } })));
    expect(button().getAttribute("aria-disabled")).toBe("true");
    expect(button().hasAttribute("disabled")).toBe(false);
    const reason = document.getElementById(button().getAttribute("aria-describedby")!.split(" ")[0]!)!;
    expect(reason.textContent).toBe("Step in needs WebGL");
    await act(async () => button().click());
    expect(taps).toBe(0);
    expect(anchor().querySelector('[role="status"]')!.textContent).toBe("Step in needs WebGL");
  });

  it("carries a 44 px camera dead margin, checked on the gesture's origin", () => {
    expect(withinMargin(10, 10, { left: 50, top: 50, right: 106, bottom: 106 }, 44)).toBe(true);
    expect(withinMargin(5, 10, { left: 50, top: 50, right: 106, bottom: 106 }, 44)).toBe(false);
  });

  it("composes Simple view, the between slot, All tools and Record — in focus order", async () => {
    const picked: string[] = [];
    await act(async () => root.render(createElement(GlassChrome, {
      member: "m-jonathan", theme: "taylor", environment: QUIET_ENVIRONMENT,
      fab: { actions: fabActionsFor("household", "home"), closedLabel: "Add money", onPick: (mode) => picked.push(mode) },
      onOpenTools: () => undefined,
      between: createElement("div", { "data-between": "" }),
    })));
    const order = [...host.querySelectorAll<HTMLElement>("[data-glass-bubble], [data-between]")].map((n) => n.dataset.glassBubble ?? "between");
    expect(order).toEqual(["flip", "between", "tools", "record"]);
    expect(host.querySelector("[data-glass-bubble='record']")!.classList.contains("is-accent")).toBe(true);
    // The closed dial is always "Record" on the glass, whatever the App's label says.
    expect(host.querySelector("button.fab")!.getAttribute("aria-label")).toBe("Record");
    expect(host.querySelector("[data-glass-bubble='tools']")!.getAttribute("data-glass-theme")).toBe("taylor");
    // One ripple filter, however many chromes stand.
    expect(host.querySelectorAll("#hearth-glass-ripple").length).toBe(1);
  });

  it("names the flip by its label, and disables going back to an island that cannot be drawn", async () => {
    expect(flipWords("island")).toEqual({ label: "Simple view", next: "flat" });
    expect(flipWords("desk")).toEqual({ label: "Island", next: "illustrated" });
    publishEditionAvailability({ flat: true, reason: "no-webgl" });
    await act(async () => root.render(createElement(GlassChrome, { environment: QUIET_ENVIRONMENT })));
    const flip = host.querySelector<HTMLButtonElement>("[data-glass-flip]")!;
    expect(flip.dataset.glassFlip).toBe("desk");
    expect(flip.querySelector(".glass-bubble__label")!.textContent).toBe("Island");
    expect(flip.getAttribute("aria-label")).toBeNull();
    expect(flip.getAttribute("aria-disabled")).toBe("true");
  });
});

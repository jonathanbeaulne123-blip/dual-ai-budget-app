// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
vi.mock("../src/kitty/KittyStage.tsx", () => ({ KittyStage: () => null }));
import { KittyBankRoom } from "../src/kitty/KittyBankRoom.tsx";
import { planLifeFixture } from "./fixtures/plan-life.ts";
import type { Household, CommitResult } from "../src/core/index.ts";
import { STUDIO_PALETTE } from "../src/kitty/studio/palette.ts";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const buttons = (name: string) => [...document.querySelectorAll<HTMLButtonElement>("button")].filter((row) => row.textContent?.trim() === name || row.getAttribute("aria-label") === name || (row.matches(".studio-benches button") && row.querySelector("span")?.textContent === name));
const button = (name: string, last = false) => { const list = buttons(name); return (last ? list[list.length - 1] : list[0])!; };
async function click(name: string, last = false) {
  const target = button(name, last);
  expect(target, name).toBeTruthy();
  await act(async () => target.click());
}
async function fixture() {
  let h = planLifeFixture("personal");
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const commands: string[] = [];
  const render = () => root.render(createElement(KittyBankRoom, {
    household: h,
    view: "personal",
    memberId: "MEM-001",
    identity: "fictional-studio",
    onClose: () => {},
    onCommand: async (fn: (h: Household) => CommitResult) => {
      const result = fn(h);
      h = result.household;
      commands.push(result.postedIds.join(","));
      render();
      return { ok: true, household: h };
    },
  }));
  await act(async () => render());
  return { get h() { return h; }, commands, close: async () => { await act(async () => root.unmount()); host.remove(); sessionStorage.clear(); } };
}
describe("Kitty Bank Studio benches", () => {
  it("throws, shapes, dips, keeps, fires and throws another through the named command only", async () => {
    sessionStorage.clear();
    const m = await fixture();
    try {
      await click("Studio");
      expect(document.body.textContent).toContain("The wheel is waiting");
      await click("Throw a piece");
      expect(document.body.textContent).toContain("Wet clay on the wheel");
      // Wheel: chips live-update the draft; the bank is untouched until Keep.
      await click("pear");
      expect(button("pear").getAttribute("aria-pressed")).toBe("true");
      expect(button("Pull the belly out")).toBeTruthy();
      expect(m.commands).toHaveLength(0);
      const stored = Object.keys(sessionStorage).find((key) => key.startsWith("hearth-kitty-studio:fictional-studio:"));
      expect(stored).toBeTruthy();
      expect(JSON.parse(sessionStorage.getItem(stored!)!).sculpt.body).toBe("pear");
      // Keyboard shortcut 2 → Paint bench.
      await act(async () => { document.querySelector(".kitty-studio")!.dispatchEvent(new KeyboardEvent("keydown", { key: "2", bubbles: true })); });
      expect(document.body.textContent).toContain("Glazes");
      expect(buttons("Marigold")).toHaveLength(1);
      expect(document.querySelectorAll(".studio-swatch")).toHaveLength(STUDIO_PALETTE.length);
      await click("Marigold");
      await click("Dip it");
      await click("Undo");
      await click("Redo");
      await click("Keep the clay");
      expect(m.commands).toHaveLength(1);
      const draft = m.h.goals[0]!.envelope!.studio!.draft!;
      expect(draft.sculpt.body).toBe("pear");
      expect(draft.paint.base).toBe(STUDIO_PALETTE.find((row) => row.id === "marigold")!.hex);
      expect(draft.firedAt).toBeNull();
      expect(m.h.goals[0]!.savedCents).toBe(30000);
      expect(sessionStorage.getItem(stored!)).toBeNull();
      // Kiln: Fire needs a visible Confirm and names the bank.
      await click("Kiln");
      await click("Fire it");
      expect(document.body.textContent).toContain("Fire Fictional seasonal reserve");
      expect(document.body.textContent).toContain("cannot be changed");
      expect(m.commands).toHaveLength(1);
      await click("Fire it", true);
      expect(m.commands).toHaveLength(2);
      const studio = m.h.goals[0]!.envelope!.studio!;
      expect(studio.draft).toBeNull();
      expect(studio.fired).toHaveLength(1);
      expect(studio.fired[0]!.firedBy).toBe("MEM-001");
      expect(document.body.textContent).toContain("Fired shelf · 1 of 6");
      expect(document.body.textContent).toContain("Fired. Your Kitty Bank came out of the kiln.");
      // The ceremony is skippable; Throw another gives fresh clay, shelf untouched, nothing saved yet.
      expect(document.body.textContent).toContain("Firing…");
      await click("Skip");
      expect(document.body.textContent).toContain("Out of the kiln");
      await click("Throw another");
      expect(document.body.textContent).toContain("Fresh clay on the wheel");
      expect(m.commands).toHaveLength(2);
      expect(m.h.goals[0]!.envelope!.studio!.fired).toHaveLength(1);
      expect(m.h.goals[0]!.envelope!.glaze).toBe("cream");
    } finally {
      await m.close();
    }
  });
  it("places and adjusts stamps from the anchor list with keyboard rotation", async () => {
    sessionStorage.clear();
    const m = await fixture();
    try {
      await click("Studio");
      await click("Throw a piece");
      await click("Paint");
      const details = document.querySelector<HTMLDetailsElement>("details.studio-stamps")!;
      await act(async () => { details.open = true; });
      await click("Initial");
      const letters = [...document.querySelectorAll("label")].find((row) => row.textContent?.includes("Letters"))!.querySelector("input")!;
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(letters, "jb");
        letters.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await click("Forehead");
      const item = document.querySelector<HTMLButtonElement>(".studio-stamp-list button")!;
      expect(item.textContent).toContain("Initial · Forehead · 0°");
      await act(async () => item.click());
      await act(async () => { item.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })); });
      expect(document.querySelector(".studio-stamp-list button")!.textContent).toContain("15°");
      await click("Keep the clay");
      const stamp = m.h.goals[0]!.envelope!.studio!.draft!.paint.stamps[0]!;
      expect(stamp).toMatchObject({ kind: "initial", anchor: "forehead", rotation: 15, text: "JB" });
      await click("Wash it off");
      await click("Yes, wash it");
      expect(document.querySelector(".studio-stamp-list")).toBeNull();
    } finally {
      await m.close();
    }
  });
});

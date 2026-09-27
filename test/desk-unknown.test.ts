// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedDemoHousehold } from "../src/core/seed.ts";

/**
 * Stone never says "$0" for an unknown (the `engravedCents` rule): when the
 * Fund's pots cannot be read — backing not linked yet — Today engraves every
 * one of them "—", Everyday included, and still leads with Everyday.
 */
vi.mock("../src/core/fundModel.ts", async (original) => {
  const real = await original<typeof import("../src/core/fundModel.ts")>();
  return {
    ...real,
    fundSnapshot: (...args: Parameters<typeof real.fundSnapshot>) => {
      const snapshot = real.fundSnapshot(...args);
      return { ...snapshot, now: null, prepare: { ...snapshot.prepare, amountCents: null }, protect: { ...snapshot.protect, amountCents: null }, build: { ...snapshot.build, amountCents: null } };
    },
  };
});

const today = "2026-09-20";
const household = seedDemoHousehold({ today });
const memberId = household.members[0]!.id;

let host: HTMLDivElement, root: Root;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

describe("Today with the pots unread", () => {
  it("engraves — on all four pots, never $0, with Everyday still leading", async () => {
    const { DeskShell } = await import("../src/harbour/desk/DeskShell.tsx");
    await act(async () => root.render(createElement(DeskShell, { household, memberId, scope: "household", today, reading: null, onOpen: () => undefined })));
    const pots = [...host.querySelectorAll<HTMLElement>("[data-desk-pot]")];
    expect(pots.map(pot => pot.dataset.deskPot)).toEqual(["everyday", "prepare", "protect", "build"]);
    expect(pots.map(pot => pot.querySelector(".desk-figure")!.textContent)).toEqual(["—", "—", "—", "—"]);
    for (const pot of pots) expect(pot.textContent).not.toMatch(/\$0(\.00)?\b/);
    // Tool Atlas A22: the name is the visible label ("Everyday · now"), then the figure.
    expect(pots[0]!.hasAttribute("aria-label")).toBe(false);
    expect(pots[0]!.textContent).toMatch(/^Everyday · now\s*—$/);
    // No reading yet: the chip's door sign is a plain line, never a throw.
    expect(host.querySelector("[data-desk-sign]")!.textContent).toBe("The Fund, this month");
  });
});

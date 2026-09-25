// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fabActionsFor, fabClosedLabel } from "../src/core/fabActions.ts";
import type { HarbourReading } from "../src/harbour/data/reading.ts";
import { ATLAS_FALLBACK } from "../src/harbour/nav/atlasFallback.ts";
import { Compass } from "../src/harbour/nav/Compass.tsx";
import { QuickSheet } from "../src/harbour/nav/QuickSheet.tsx";
import { HostPanel } from "../src/harbour/panels/HostPanel.tsx";
import type { PanelHost } from "../src/harbour/panels/panelModel.ts";
import { VillageHUD } from "../src/harbour/village/VillageHUD.tsx";

/**
 * The vocabulary fence for the glass track (Tool Atlas brief §3.2, A13): the
 * retired words never reach the screen — in source copy or in what renders.
 * Synonyms are a search index and are allowed to keep them findable.
 */
const RETIRED = [
  "Add money", "Master Planner", "Our plans", "Plan together", "Meet the Queen", "What now", "Household Fund", "Next out",
  "Scheduled to leave", "Close the month", "check-in", "Sit-down", "Hearthside", "Our Path", "Atlas nook", "Village map",
  "Quick travel", "Mountain & town", "Mountain and town", "Town square", "The Court", "Pay it", "cov.", "Village square",
];
const RETIRED_WORDS = /\b(Together|Play|pots?|Hearthside)\b/;

const OWNED = [
  "src/harbour/bubbles/Bubble.tsx", "src/harbour/bubbles/GlassChrome.tsx", "src/harbour/bubbles/icons.tsx",
  "src/harbour/panels/CompactPanel.tsx", "src/harbour/panels/HostPanel.tsx", "src/harbour/panels/panelModel.ts",
  "src/harbour/nav/QuickSheet.tsx", "src/harbour/nav/atlasFallback.ts", "src/harbour/nav/atlasSearch.ts",
  "src/harbour/village/VillageHUD.tsx", "src/harbour/HarbourEntry.tsx", "src/harbour/nav/Compass.tsx", "src/harbour/nav/barBadges.ts",
  "src/harbour/nav/worldActions.ts", "src/harbour/desk/DeskShell.tsx",
];

/** Source copy: comments out, the synonym index out. */
function copyOf(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/synonyms: \[[^\]]*\]/g, "")
    .replace(/const RECORD_SYNONYMS[\s\S]*?\}\);/, "");
}

describe("source copy", () => {
  it("carries none of the retired words", () => {
    const offences: string[] = [];
    for (const path of OWNED) {
      const copy = copyOf(path);
      for (const word of RETIRED) if (copy.includes(word)) offences.push(`${path}: ${word}`);
    }
    expect(offences).toEqual([]);
  });

  it("labels, headings and subtitles in the atlas use the one vocabulary", () => {
    const shown = ATLAS_FALLBACK.flatMap((g) => [g.heading, g.subtitle, ...g.tools.flatMap((t) => [t.label, t.subtitle ?? ""])]);
    for (const text of shown) {
      for (const word of RETIRED) expect(text, text).not.toContain(word);
      expect(text, text).not.toMatch(RETIRED_WORDS);
      // "jar" is for bills only, and even there the Cellar says "bill".
      expect(text, text).not.toMatch(/\bjars?\b/i);
    }
  });
});

let host: HTMLDivElement, root: Root;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); window.localStorage.clear(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); document.body.innerHTML = ""; });

/** Everything a person can see or hear: text, names, descriptions, placeholders. */
function spoken(): string {
  const parts = [host.textContent ?? ""];
  for (const node of host.querySelectorAll<HTMLElement>("[aria-label], [placeholder], [title]")) parts.push(node.getAttribute("aria-label") ?? "", node.getAttribute("placeholder") ?? "", node.getAttribute("title") ?? "");
  return parts.join(" \n ");
}
function expectClean(where: string) {
  const text = spoken();
  for (const word of RETIRED) expect(text, `${where}: ${word}`).not.toContain(word);
  expect(text.match(RETIRED_WORDS)?.[0], where).toBeUndefined();
}

const fab = { actions: fabActionsFor("household", "home"), closedLabel: fabClosedLabel("household"), onOpenChange: () => undefined, onPick: () => undefined, onGo: () => undefined };

describe("rendered copy", () => {
  it("the All-tools sheet, in Ours and in Mine", async () => {
    for (const space of ["ours", "mine"] as const) {
      await act(async () => root.render(createElement(QuickSheet, { open: true, space, wide: false, onClose: () => undefined, onOpen: () => undefined, onStatus: () => undefined, onHercules: () => undefined, onPick: () => undefined, onWorld: () => undefined })));
      expectClean(`sheet (${space})`);
    }
  });

  it("the island's glass, the Desk's glass and the door edition", async () => {
    await act(async () => root.render(createElement(VillageHUD, { place: "court", travelling: null, onVisit: () => undefined, fab, onQuickSheet: () => undefined, avatar: "jonathan", onAvatar: () => undefined })));
    expectClean("island");
    await act(async () => root.render(createElement(VillageHUD, { flat: true, place: "atlas", travelling: null, onVisit: () => undefined, fab, onQuickSheet: () => undefined })));
    expectClean("desk");
    await act(async () => root.render(createElement(Compass, { fab, onQuickSheet: () => undefined })));
    expectClean("door");
  });

  it("every compact panel, with an empty reading", async () => {
    for (const panelHost of ["bank", "cellar", "tower", "kitchen", "library", "glasshouse", "campfire", "boathouse", "atlas", "cottage", "hercules"] as PanelHost[]) {
      await act(async () => root.render(createElement(HostPanel, { key: panelHost, host: panelHost, reading: null as HarbourReading | null, onClose: () => undefined, onOpen: () => undefined, onRecord: () => undefined })));
      expectClean(`panel ${panelHost}`);
    }
  });
});

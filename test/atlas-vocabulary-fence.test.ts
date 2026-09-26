import { describe, expect, it } from "vitest";
import { relative } from "node:path";
import { listComponentFiles } from "../scripts/copy-budget.mjs";
import { COPY_TABLE_FILES, RETIRED_WORDS } from "../src/core/terms.ts";
import { TOOL_ATLAS, TOOL_GROUPS } from "../src/core/toolAtlas.ts";
import { FAB_VERBS, fabClosedLabel } from "../src/core/fabActions.ts";
import { renderedStrings } from "./rendered-strings.ts";

/**
 * A13 — the retired words of the Tool Atlas (§3.2) do not appear in rendered
 * copy, in `.tsx` or in the `.ts` copy tables. `src/core/toolAtlas.ts` is not
 * scanned: its synonyms keep every retired word findable by search, on purpose.
 *
 * PENDING is a ratchet, not an allowlist. It names the rendered strings that
 * still carry a retired word in files other Tool Atlas tracks (or the
 * integrator) own at the time of writing. The test fails when a NEW hit
 * appears, and also when a pending entry is gone — so each track deletes its
 * rows as it lands the rename, and the list can only shrink.
 */
const PENDING: Readonly<Record<string, readonly string[]>> = {
  // The integrator's (App.tsx is the integration mutex).
  "src/App.tsx": ["Together", "Our Path"],
  // The harbour / bar tracks (src/harbour/**, QuickSheet, VillageHUD).
  // Books, the Fund and the Campfire (K1, K3, §1.3 rows): whoever lands the Campfire / Fund bank slices.
  "src/Books.tsx": ["Household Fund", "Close the month"],
  "src/FundDrawer.tsx": ["Next out"],
  "src/NextOutStage.tsx": ["Next out"],
  "src/queen/QueenCellar.tsx": ["Pay it"],
  "src/queen/QueenHome.tsx": ["Together"],
  "src/plan-v3/CheckIn.tsx": ["check-in"],
  "src/plan-v3/PlanStudioV3.tsx": ["check-in"],
  "src/plan-v3/RestScreen.tsx": ["check-in"],
  "src/PlanStudio.tsx": ["Our Path", "Together"],
  "src/PlanLensWorkbench.tsx": ["Together"],
  // The Boathouse rename (K13: "Together" / "Hearthside" / "Play" → the Boathouse; "Our Path" → the Atlas).
  "src/DuplicatePrise.tsx": ["Together"],
  "src/Hercules.tsx": ["Play"],
  "src/HerculesSetup.tsx": ["Play"],
  "src/HouseholdHome.tsx": ["Our Path", "Together"],
  "src/HouseholdLife.tsx": ["Plan together", "Our Path", "Together"],
  "src/hearthside/CollaborativeStudio.tsx": ["Hearthside"],
  "src/hearthside/ExperienceBankEntry.tsx": ["Hearthside"],
  "src/hearthside/GuestVisits.tsx": ["Hearthside"],
  "src/hearthside/Hearthside.tsx": ["Hearthside"],
  "src/hearthside/HouseShell.tsx": ["Together", "Master Planner", "Our Path", "Hearthside"],
  "src/hearthside/PlanNextSteps.tsx": ["Together"],
  "src/hearthside/StreetEntry.tsx": ["Hearthside"],
  "src/hearthside/WinMemoryReview.tsx": ["Hearthside"],
  "src/hearthside/workspaceSurface.tsx": ["Hearthside"],
  "src/path/OurPathWorld.tsx": ["Together", "Our Path", "Play"],
  "src/path/mini/JourneyMini.tsx": ["Our Path"],
};

function hitsNow(): Map<string, Set<string>> {
  const hits = new Map<string, Set<string>>();
  for (const file of [...listComponentFiles("src"), ...COPY_TABLE_FILES]) {
    const rel = relative(process.cwd(), file).replace(/\\/g, "/");
    if (rel === "src/core/toolAtlas.ts") continue;
    for (const { text } of renderedStrings(file)) {
      for (const rule of RETIRED_WORDS) {
        if (!rule.pattern.test(text)) continue;
        if (!hits.has(rel)) hits.set(rel, new Set());
        hits.get(rel)!.add(rule.word);
      }
    }
  }
  return hits;
}

describe("the Tool Atlas vocabulary fence (A13)", () => {
  const hits = hitsNow();

  it("adds no retired word to rendered copy", () => {
    const fresh: string[] = [];
    for (const [file, words] of hits) for (const word of words) if (!PENDING[file]?.includes(word)) fresh.push(`${file}: "${word}" → say "${RETIRED_WORDS.find((rule) => rule.word === word)!.use}"`);
    expect(fresh).toEqual([]);
  });

  it("only shrinks: a pending row whose word is gone must be deleted", () => {
    const stale: string[] = [];
    for (const [file, words] of Object.entries(PENDING)) for (const word of words) if (!hits.get(file)?.has(word)) stale.push(`${file}: "${word}" is gone — delete it from PENDING`);
    expect(stale).toEqual([]);
  });

  it("keeps the atlas's own screen words clean: labels, subtitles, headings, the dial", () => {
    const words = [
      ...TOOL_ATLAS.flatMap((row) => [row.label, row.subtitle]),
      ...TOOL_GROUPS.flatMap((group) => [group.heading, group.subtitle]),
      ...FAB_VERBS.flatMap((verb) => [verb.label, verb.aria]),
      fabClosedLabel("household"),
      fabClosedLabel("personal"),
    ];
    const found = words.filter((text) => RETIRED_WORDS.some((rule) => rule.pattern.test(text)));
    expect(found).toEqual([]);
  });

  it("says Record as a verb, pots for Prepare · Protect · Build, and steps for the Glasshouse", () => {
    expect(TOOL_ATLAS.find((row) => row.id === "steps")!.label).toBe("Steps");
    expect(TOOL_ATLAS.some((row) => /\bpots?\b/i.test(`${row.label} ${row.subtitle}`) && row.group === "plans" && row.id === "steps")).toBe(false);
    expect(TOOL_ATLAS.filter((row) => /\bjars?\b/i.test(`${row.label} ${row.subtitle}`))).toEqual([]);
  });
});

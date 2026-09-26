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
 * PENDING is a ratchet, not an allowlist. Wave 2b (K13) cleaned every file it
 * could; what is left is named here with the reason it stays. The test fails
 * when a NEW hit appears, and also when a pending entry is gone — so the list
 * can only shrink.
 */
const PENDING: Readonly<Record<string, { words: readonly string[]; why: string }>> = {
  "src/App.tsx": { words: ["Together", "Our Path"], why: "the legacy tab bar and house-rooms nav (HARBOUR off: kitchenPrimaryNav, houseNavigationActive) and the classic 'Back to Together' chip (!HOUSE_WORLD_ENABLED) — Appendix A legacy chrome, out of Wave 2b's scope; five-boards-entry-app pins the legacy bar" },
  "src/HouseholdHome.tsx": { words: ["Together"], why: "the legacy panels composition's door to the practical board (HEARTHSIDE_FLAGS.presentation off); with presentation on it already says HEARTHSIDE_LABEL, now 'The Boathouse'" },
  "src/queen/QueenHome.tsx": { words: ["Together"], why: "the legacy Queen's-world Home (Appendix A); its 'Together' door is the practical board that K10 retires, not the Boathouse, so a rename would mislabel it" },
  "src/DuplicatePrise.tsx": { words: ["Together"], why: "not a tab: the duplicate prise's slider end label (the two halves together / apart)" },
  "src/plan-v3/CheckIn.tsx": { words: ["check-in"], why: "Plan Studio v3 is flag-off (VITE_PLAN_STUDIO_V3 unset, Appendix A); its check-in is K3's to retire with the module" },
  "src/plan-v3/PlanStudioV3.tsx": { words: ["check-in"], why: "as CheckIn.tsx (flag-off Plan Studio v3)" },
  "src/plan-v3/RestScreen.tsx": { words: ["check-in"], why: "as CheckIn.tsx (flag-off Plan Studio v3)" },
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
    for (const [file, words] of hits) for (const word of words) if (!PENDING[file]?.words.includes(word)) fresh.push(`${file}: "${word}" → say "${RETIRED_WORDS.find((rule) => rule.word === word)!.use}"`);
    expect(fresh).toEqual([]);
  });

  it("only shrinks: a pending row whose word is gone must be deleted", () => {
    const stale: string[] = [];
    for (const [file, { words }] of Object.entries(PENDING)) for (const word of words) if (!hits.get(file)?.has(word)) stale.push(`${file}: "${word}" is gone — delete it from PENDING`);
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

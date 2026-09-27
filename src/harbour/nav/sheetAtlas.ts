/**
 * The All-tools sheet's view of the one list (Tool Atlas brief §3.2, §3.4).
 *
 * The rows, words, groups, spaces and hosts come from `src/core/toolAtlas.ts`
 * (track A) and nowhere else; this file only turns each row's structured
 * `target` into the string address the sheet dispatches (it replaced the
 * glass track's local `atlasFallback.ts`, which had the same groups but its
 * own copy of the rows):
 *
 *  - a `TARGET_NAMES` id (`src/house/navigation.ts`) → `onOpen(id, object?)`;
 *  - `place:<HarbourPlaceId>` → the host's compact panel and the camera (`onPlace`);
 *  - `settings` / `settings:<section>` → Settings (`onSettings`, else `onStatus`);
 *  - `world:<action>` → a world experience behind Step in (`onWorld`, or what the island offers);
 *  - `edition` → the sheet's own Simple view switch;
 *  - anything else (`books:<pane>`, `tab:<tab>`, `leaving`, …) → `onTarget(target, object)`.
 *
 * Pure data. Imports nothing that writes.
 */
import { TOOL_ATLAS, TOOL_GROUPS, type AtlasGroupId as CoreGroupId, type AtlasRecordMode, type AtlasTarget } from "../../core/toolAtlas.ts";
import { FAB_VERBS } from "../../core/fabActions.ts";
import type { HarbourPlaceId } from "../flag.ts";

export type { AtlasRecordMode } from "../../core/toolAtlas.ts";
export type AtlasSpace = "ours" | "mine";
/** The sheet's groups: the atlas's, less the Record chip row (the sheet draws the chips itself). */
export type AtlasGroupId = Exclude<CoreGroupId, "record">;

export type AtlasTool = {
  id: string;
  label: string;
  subtitle?: string;
  group: AtlasGroupId;
  /** The map's host whose compact panel carries this tool. */
  host?: HarbourPlaceId;
  target: string;
  /** The object inside a house target (a bank, a bill), when the atlas names one. */
  object?: string;
  synonyms: string[];
  spaces: readonly AtlasSpace[];
};

export type AtlasGroup = {
  id: AtlasGroupId;
  heading: string;
  subtitle: string;
  tools: AtlasTool[];
};

export type AtlasRecordVerb = { mode: AtlasRecordMode; label: string; aria: string };
/** The five Record verbs, nearest the thumb first — the dial's own list (`core/fabActions.ts`). */
export const ATLAS_RECORD_VERBS: readonly AtlasRecordVerb[] = Object.freeze(FAB_VERBS.map((verb) => ({ mode: verb.mode, label: verb.label, aria: verb.aria })));

const SPACES: Readonly<Record<"both" | "ours" | "mine", readonly AtlasSpace[]>> = Object.freeze({ both: ["ours", "mine"], ours: ["ours"], mine: ["mine"] });

/** Pure: the string address the sheet dispatches for one atlas target. */
export function sheetTarget(target: AtlasTarget): { target: string; object?: string } {
  switch (target.kind) {
    case "record": return { target: `record:${target.mode}` };
    case "house": return target.object ? { target: target.target, object: target.object } : { target: target.target };
    case "books": return { target: `books:${target.pane}` };
    case "tab":
      if (target.tab === "more") return { target: target.section ? `settings:${target.section}` : "settings" };
      return target.section ? { target: `tab:${target.tab}`, object: target.section } : { target: `tab:${target.tab}` };
    case "place": return { target: `place:${target.place}` };
    case "action":
      switch (target.action) {
        case "simple-view": return { target: "edition" };
        case "step-in": case "skate": case "arrange": case "wander": return { target: `world:${target.action}` };
        case "character": case "presence": case "sign-out": return { target: `settings:${target.action}` };
        case "leaving": return { target: "leaving" };
      }
  }
}

/** §3.2, in order: six jobs, then Places, then Settings; Hercules is the footer. Rows by score (`toolsInGroup`'s order). */
export const SHEET_ATLAS: readonly AtlasGroup[] = Object.freeze(TOOL_GROUPS.filter((group) => group.id !== "record").map((group) => {
  const rows = TOOL_ATLAS.map((row, index) => ({ row, index })).filter(({ row }) => row.group === group.id)
    .sort((a, b) => b.row.score - a.row.score || a.index - b.index).map(({ row }) => row);
  return {
    id: group.id as AtlasGroupId,
    heading: group.heading,
    subtitle: group.subtitle,
    tools: rows.map((row): AtlasTool => ({
      id: row.id,
      label: row.label,
      subtitle: row.subtitle,
      group: group.id as AtlasGroupId,
      ...(row.host ? { host: row.host } : {}),
      ...sheetTarget(row.target),
      synonyms: [...row.synonyms],
      spaces: SPACES[row.spaces],
    })),
  };
}));

/** The six job headings, in order — the Desk drawer renders the same sheet, so the same sequence (A4b). */
export const ATLAS_JOB_GROUPS: readonly AtlasGroupId[] = Object.freeze(["bills-dates", "fund", "kitty-banks", "books", "plans", "boathouse"]);

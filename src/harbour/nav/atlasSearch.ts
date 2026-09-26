/**
 * All tools' search (brief §3.4): a tool's name, its synonyms, and the
 * household's own words — bill names, account names, Kitty Bank names, people.
 * Ranked name > synonym > household word; every result carries its group so
 * the sheet can say where it lives. A word that means two things lists both.
 *
 * Pure. Reads the atlas and the words it is handed; writes nothing.
 */
import { ATLAS_RECORD_VERBS, type AtlasGroup, type AtlasGroupId, type AtlasRecordMode, type AtlasSpace, type AtlasTool } from "./sheetAtlas.ts";

/** A word from the household's own books, and where it opens. */
export type HouseholdWord = {
  /** Stable key, e.g. `bill:<recurrenceId>`, `account:<id>`, `bank:<goalId>`, `member:<id>`. */
  id: string;
  word: string;
  kind: "bill" | "account" | "bank" | "member";
  /** Dispatched like a tool's target (see `sheetAtlas.ts`). */
  target: string;
  /** The object inside the target: the jar, the account row, the bank. */
  object?: string;
  group: AtlasGroupId;
  /** Where it lands, in words ("the Cellar", "the Fund bank's accounts"). */
  where?: string;
};

export type AtlasMatch = "name" | "synonym" | "household";
export type AtlasResult =
  | { kind: "tool"; key: string; tool: AtlasTool; label: string; groupHeading: string; match: AtlasMatch; score: number }
  | { kind: "record"; key: string; mode: AtlasRecordMode; label: string; aria: string; groupHeading: string; match: AtlasMatch; score: number }
  | { kind: "word"; key: string; word: HouseholdWord; label: string; groupHeading: string; match: AtlasMatch; score: number };

/** Lowercase, no accents, no apostrophes, single spaces. */
export function normalizeAtlasText(text: string): string {
  return text
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’'`]/g, "")
    .replace(/[^a-z0-9&$]+/g, " ")
    .trim();
}

/** How well `query` fits `text`: 4 exact, 3 prefix, 2 a word starts with it, 1 inside, 0 not at all. */
export function fit(text: string, query: string): number {
  const t = normalizeAtlasText(text), q = normalizeAtlasText(query);
  if (!q || !t) return 0;
  if (t === q) return 4;
  if (t.startsWith(q)) return 3;
  const words = t.split(" ");
  if (words.some((_, i) => words.slice(i).join(" ").startsWith(q))) return 2;
  return q.length >= 3 && t.includes(q) ? 1 : 0;
}

/** Strip a leading "the"/"a"/"my"/"our" so "Fund bank" finds "The Fund bank" as a prefix. */
const bare = (label: string) => label.replace(/^(the|a|an|my|our)\s+/i, "");

const RECORD_SYNONYMS: Readonly<Record<AtlasRecordMode, string[]>> = Object.freeze({
  expense: ["expense", "spend", "spent", "receipt", "buy", "swipe", "till", "add money"],
  shift: ["clock in", "clock out", "tips", "work", "open shifts"],
  income: ["paycheque", "paycheck", "salary", "deposit", "came in"],
  bill: ["bill paid", "paid a bill", "pay it"],
  transfer: ["transfer", "move"],
});

/** Bands: any name fit outranks any synonym fit, which outranks any household word. */
const BAND: Readonly<Record<AtlasMatch, number>> = Object.freeze({ name: 300, synonym: 200, household: 100 });

function bestOf(texts: readonly string[], query: string): number {
  let best = 0;
  for (const text of texts) best = Math.max(best, fit(text, query));
  return best;
}

export type AtlasSearchOptions = {
  space?: AtlasSpace;
  householdWords?: readonly HouseholdWord[];
  /** Record verbs this member has (Shift only with a job). Defaults to all five. */
  recordModes?: readonly AtlasRecordMode[];
  /** Leave out tools whose target the sheet cannot dispatch here. */
  canDispatch?: (target: string) => boolean;
  limit?: number;
};

/**
 * Rank everything that fits `query`. Ties keep the atlas's own order (groups
 * in §3.2 order, tools by score), so the same word always lists the same way.
 */
export function searchAtlas(query: string, groups: readonly AtlasGroup[], options: AtlasSearchOptions = {}): AtlasResult[] {
  const q = normalizeAtlasText(query);
  if (!q) return [];
  const space = options.space ?? "ours";
  const results: (AtlasResult & { order: number })[] = [];
  let order = 0;
  const headingOf = new Map(groups.map((g) => [g.id, g.heading] as const));

  const modes = options.recordModes ?? ATLAS_RECORD_VERBS.map((verb) => verb.mode);
  for (const verb of ATLAS_RECORD_VERBS) {
    order += 1;
    if (!modes.includes(verb.mode)) continue;
    const byName = fit(verb.label, q);
    const bySynonym = bestOf(RECORD_SYNONYMS[verb.mode], q);
    const match: AtlasMatch | null = byName ? "name" : bySynonym ? "synonym" : null;
    if (!match) continue;
    results.push({ kind: "record", key: `record:${verb.mode}`, mode: verb.mode, label: verb.label, aria: verb.aria, groupHeading: "Record", match, score: BAND[match] + (byName || bySynonym) * 10, order });
  }

  for (const group of groups) {
    for (const tool of group.tools) {
      order += 1;
      if (!tool.spaces.includes(space)) continue;
      if (options.canDispatch && !options.canDispatch(tool.target)) continue;
      const byName = Math.max(fit(tool.label, q), fit(bare(tool.label), q));
      const bySynonym = bestOf(tool.synonyms, q);
      const match: AtlasMatch | null = byName ? "name" : bySynonym ? "synonym" : null;
      if (!match) continue;
      results.push({ kind: "tool", key: `tool:${tool.id}`, tool, label: tool.label, groupHeading: group.heading, match, score: BAND[match] + (byName || bySynonym) * 10, order });
    }
  }

  for (const word of options.householdWords ?? []) {
    order += 1;
    const byWord = fit(word.word, q);
    if (!byWord) continue;
    results.push({ kind: "word", key: `word:${word.id}`, word, label: word.word, groupHeading: headingOf.get(word.group) ?? word.group, match: "household", score: BAND.household + byWord * 10, order });
  }

  results.sort((a, b) => b.score - a.score || a.order - b.order);
  const limit = options.limit ?? 24;
  return results.slice(0, limit).map((row) => {
    const { order, ...rest } = row;
    void order;
    return rest as AtlasResult;
  });
}

/** Every tool once, in order, as the sheet lists them. */
export function atlasTools(groups: readonly AtlasGroup[]): AtlasTool[] {
  return groups.flatMap((g) => g.tools);
}

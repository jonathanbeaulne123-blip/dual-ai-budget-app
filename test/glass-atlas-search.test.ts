import { describe, expect, it } from "vitest";
import { SHEET_ATLAS as ATLAS_FALLBACK, ATLAS_JOB_GROUPS, ATLAS_RECORD_VERBS } from "../src/harbour/nav/sheetAtlas.ts";
import { atlasTools, fit, normalizeAtlasText, searchAtlas, type HouseholdWord } from "../src/harbour/nav/atlasSearch.ts";

/**
 * All tools' search (Tool Atlas brief §3.4, A3): name > synonym > the
 * household's own words; every tool in the top three for its name and every
 * synonym, with its group shown; every household word resolves.
 */
const WORDS: HouseholdWord[] = [
  { id: "bill:r-hydro", word: "Hydro", kind: "bill", target: "cellar-bills", object: "recurrence:r-hydro", group: "bills-dates", where: "the Cellar" },
  { id: "account:visa", word: "Visa ••4417", kind: "account", target: "accounts", object: "account:visa", group: "fund" },
  { id: "bank:g-lisbon", word: "Lisbon trip", kind: "bank", target: "loft-banks", object: "goal:g-lisbon", group: "kitty-banks" },
  { id: "member:bianca", word: "Bianca", kind: "member", target: "queen", object: "contributions:bianca", group: "fund" },
  { id: "bill:r-books", word: "Books club", kind: "bill", target: "cellar-bills", object: "recurrence:r-books", group: "bills-dates" },
];

describe("the sheet's atlas (src/core/toolAtlas.ts, as the sheet dispatches it)", () => {
  it("keeps the brief's §3.2 order: six jobs, Places, Settings, Hercules", () => {
    expect(ATLAS_FALLBACK.map((g) => g.id)).toEqual(["bills-dates", "fund", "kitty-banks", "books", "plans", "boathouse", "places", "settings", "hercules"]);
    expect(ATLAS_JOB_GROUPS).toEqual(["bills-dates", "fund", "kitty-banks", "books", "plans", "boathouse"]);
    expect(ATLAS_FALLBACK.slice(0, 6).map((g) => g.heading)).toEqual(["Bills and dates", "The Fund", "Kitty Banks", "Books", "Plans", "The Boathouse"]);
  });

  it("gives every tool a unique id, its group, a space and a target", () => {
    const tools = atlasTools(ATLAS_FALLBACK);
    expect(new Set(tools.map((t) => t.id)).size).toBe(tools.length);
    for (const group of ATLAS_FALLBACK) for (const tool of group.tools) {
      expect(tool.group).toBe(group.id);
      expect(tool.spaces.length).toBeGreaterThan(0);
      expect(tool.target.length).toBeGreaterThan(0);
    }
    expect(tools.find((t) => t.id === "private-folio")!.spaces).toEqual(["mine"]);
  });

  it("names the five Record verbs in order, nearest the thumb first", () => {
    expect(ATLAS_RECORD_VERBS.map((v) => v.label)).toEqual(["Purchase", "Shift", "Income", "Bill paid", "Move money"]);
    for (const verb of ATLAS_RECORD_VERBS) expect(verb.aria.startsWith(verb.label)).toBe(true);
  });
});

describe("matching", () => {
  it("normalizes case, accents and apostrophes", () => {
    expect(normalizeAtlasText("Who’s  Carrying")).toBe("whos carrying");
    expect(fit("Hercules's Cottage", "hercules")).toBe(3);
    expect(normalizeAtlasText("Café")).toBe("cafe");
    expect(fit("Books", "books")).toBe(4);
    expect(fit("Books club", "books")).toBe(3);
    expect(fit("The Fund bank", "fund")).toBe(2);
    expect(fit("Standing Book", "anding")).toBe(1);
    expect(fit("Books", "zz")).toBe(0);
  });

  it("ranks name above synonym above a household word", () => {
    const hits = searchAtlas("books", ATLAS_FALLBACK, { householdWords: WORDS });
    expect(hits[0]!.kind).toBe("tool");
    expect(hits[0]!.label).toBe("Books");
    expect(hits[0]!.match).toBe("name");
    const word = hits.findIndex((h) => h.kind === "word");
    expect(word).toBeGreaterThan(0);
    for (const hit of hits.slice(0, word)) expect(hit.match).not.toBe("household");
    const synonym = searchAtlas("ledger", ATLAS_FALLBACK)[0]!;
    expect(synonym).toMatchObject({ kind: "tool", label: "Books", match: "synonym", groupHeading: "Books" });
  });

  it("puts every tool in the top three for its name and every synonym, with its group (A3)", () => {
    const misses: string[] = [];
    for (const space of ["ours", "mine"] as const) {
      for (const group of ATLAS_FALLBACK) for (const tool of group.tools) {
        if (!tool.spaces.includes(space)) continue;
        for (const query of [tool.label, ...tool.synonyms]) {
          const top = searchAtlas(query, ATLAS_FALLBACK, { space }).slice(0, 3);
          const hit = top.find((h) => h.kind === "tool" && h.tool.id === tool.id);
          if (!hit) misses.push(`${space} · "${query}" → ${tool.id} (top: ${top.map((h) => h.key).join(", ")})`);
          else expect(hit.groupHeading).toBe(group.heading);
        }
      }
    }
    expect(misses).toEqual([]);
  });

  it("resolves every household word to its place, and lists both meanings of a shared word", () => {
    for (const word of WORDS) {
      const hit = searchAtlas(word.word, ATLAS_FALLBACK, { householdWords: WORDS }).find((h) => h.kind === "word" && h.word.id === word.id);
      expect(hit, word.word).toBeTruthy();
    }
    const hydro = searchAtlas("hydro", ATLAS_FALLBACK, { householdWords: WORDS })[0]!;
    expect(hydro).toMatchObject({ kind: "word", groupHeading: "Bills and dates" });
    const visa = searchAtlas("visa", ATLAS_FALLBACK, { householdWords: WORDS }).map((h) => h.key);
    expect(visa.slice(0, 2)).toEqual(["tool:accounts", "word:account:visa"]);
  });

  it("keeps Mine's private folio out of Ours, and Ours-only tools out of Mine", () => {
    expect(searchAtlas("private", ATLAS_FALLBACK, { space: "ours" }).some((h) => h.key === "tool:private-folio")).toBe(false);
    expect(searchAtlas("private", ATLAS_FALLBACK, { space: "mine" })[0]!.key).toBe("tool:private-folio");
    // The Fund bank is the shared Fund in both spaces (D2); the Boathouse's shared wishes are Ours only.
    expect(searchAtlas("wishes", ATLAS_FALLBACK, { space: "mine" }).some((h) => h.key === "tool:wishes")).toBe(false);
    expect(searchAtlas("wishes", ATLAS_FALLBACK, { space: "ours" }).some((h) => h.key === "tool:wishes")).toBe(true);
  });

  it("finds the Record verbs and hides Shift for a member without a job", () => {
    expect(searchAtlas("purchase", ATLAS_FALLBACK)[0]!.key).toBe("record:expense");
    expect(searchAtlas("swipe", ATLAS_FALLBACK)[0]!.key).toBe("record:expense");
    expect(searchAtlas("shift", ATLAS_FALLBACK, { recordModes: ["expense", "income", "bill", "transfer"] }).some((h) => h.key === "record:shift")).toBe(false);
  });

  it("drops rows the sheet cannot dispatch, and returns nothing for an empty query", () => {
    expect(searchAtlas("skate", ATLAS_FALLBACK, { canDispatch: (t) => !t.startsWith("world:") }).some((h) => h.key === "tool:skate")).toBe(false);
    expect(searchAtlas("   ", ATLAS_FALLBACK)).toEqual([]);
  });
});

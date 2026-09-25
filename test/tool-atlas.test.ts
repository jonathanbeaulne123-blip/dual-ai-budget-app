import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  RETIRED_WORDS,
  TOOL_ATLAS,
  TOOL_GROUPS,
  atlasHeadings,
  normalizeAtlasQuery,
  searchAtlas,
  toolsInGroup,
  type AtlasGroupId,
  type AtlasHouseholdName,
} from "../src/core/toolAtlas.ts";
import { TARGET_NAMES, houseToolPlace } from "../src/house/navigation.ts";
import { HARBOUR_PLACE_NAMES } from "../src/harbour/flag.ts";

/**
 * §3.4's table, verbatim: each word must find a tool of that group in the top
 * three. "Simple view / Places" lists chrome that §3.2 files under Places and
 * Settings (character, presence), so that row accepts both.
 */
const SECTION_3_4: readonly { groups: readonly AtlasGroupId[]; words: string }[] = [
  { groups: ["bills-dates"], words: "bills, leaving, next out, scheduled, due, jars, cellar, prepare, obligation, commitment, recurring, subscription, paid" },
  { groups: ["bills-dates"], words: "calendar, week, dates, appointments, potential, planned, strip, time machine, replay, sitdown" },
  { groups: ["fund"], words: "fund, everyday, now, queen, bank, balance, shared money, household fund, contribution, custodian, surplus, protect, accounts, wallet, visa, statements" },
  { groups: ["kitty-banks"], words: "goals, kitty, banks, build, envelope, save, reserve, loft, rollover, jug, pottery, studio, kiln" },
  { groups: ["books"], words: "books, ledger, register, journal, standing book, library, audit, activity, import, paper trail, record, reconcile, close pack" },
  { groups: ["plans"], words: "plan, planner, plan studio, recipe, card, kitchen, table, wizard, scenario, bridge, draft, folio, conversation" },
  { groups: ["plans"], words: "steps, tasks, to-do, glasshouse, rituals, moves, who's carrying, board, ask" },
  { groups: ["plans"], words: "chapter, month, close, campfire, seal, check-in, rehearsal, sitdown" },
  { groups: ["boathouse"], words: "together, hearthside, boathouse, wishes, memories, letters, projector, play, private" },
  { groups: ["boathouse"], words: "journey, our path, atlas, island, era, map, horizon, recipes, name" },
  { groups: ["hercules"], words: "hercules, talk, suggestion, cottage, dressing room, wardrobe, looks, companion" },
  { groups: ["places", "settings"], words: "simple view, reading, flat, desk, illustrated, step in, look around, walk, skate, arrange, character, avatar, quick travel, village, town, square, mountain, harbour" },
  { groups: ["settings"], words: "status, settings, health, sync, appearance, theme, comfort, quiet, export, backup, undo, restore, invite, pair, charter, sign out, labels" },
];

const top3 = (query: string, householdNames?: readonly AtlasHouseholdName[]) => searchAtlas(query, { householdNames }).slice(0, 3);

describe("the Tool Atlas — one list", () => {
  it("gives every tool a unique id and a known group", () => {
    const ids = TOOL_ATLAS.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
    const groups = new Set(TOOL_GROUPS.map((group) => group.id));
    for (const row of TOOL_ATLAS) expect(groups.has(row.group), row.id).toBe(true);
    for (const group of TOOL_GROUPS) expect(toolsInGroup(group.id).length, group.id).toBeGreaterThan(0);
  });

  it("orders the groups exactly as §3.2: the Record row, six jobs, Places, Settings, the Hercules footer", () => {
    expect(TOOL_GROUPS.map((group) => group.id)).toEqual(["record", "bills-dates", "fund", "kitty-banks", "books", "plans", "boathouse", "places", "settings", "hercules"]);
    expect(atlasHeadings()).toEqual(["Record", "Bills and dates", "The Fund", "Kitty Banks", "Books", "Plans", "The Boathouse", "Places", "Settings", "Hercules"]);
    expect(TOOL_GROUPS[0]!.placement).toBe("chips");
    expect(TOOL_GROUPS.at(-1)!.placement).toBe("footer");
    expect(TOOL_GROUPS.find((group) => group.id === "plans")!.subtitle).toContain("recipe card");
  });

  it("keeps the Record chips in the dial's order and every other group by score", () => {
    expect(toolsInGroup("record").map((row) => row.label)).toEqual(["Purchase", "Shift", "Income", "Bill paid", "Move money"]);
    for (const group of TOOL_GROUPS.filter((row) => row.id !== "record")) {
      const scores = toolsInGroup(group.id).map((row) => row.score);
      expect([...scores].sort((a, b) => b - a), group.id).toEqual(scores);
    }
    expect(toolsInGroup("books").map((row) => row.id).slice(0, 2)).toEqual(["shifts", "activity"]);
  });

  it("lists the private folio only in Mine and the jug only in Ours", () => {
    expect(toolsInGroup("boathouse", "ours").some((row) => row.id === "private-folio")).toBe(false);
    expect(toolsInGroup("boathouse", "mine").some((row) => row.id === "private-folio")).toBe(true);
    expect(searchAtlas("private", { space: "ours" }).some((row) => row.id === "private-folio")).toBe(false);
    expect(searchAtlas("jug", { space: "mine" }).some((row) => row.id === "jug")).toBe(false);
  });

  it("addresses only hosts that exist and house targets the router knows", () => {
    const places = new Set(Object.keys(HARBOUR_PLACE_NAMES));
    const targets = new Set([...Object.keys(TARGET_NAMES), "fund"]);
    const probe = { householdId: "probe", room: "home", level: "middle" } as const;
    for (const row of TOOL_ATLAS) {
      if (row.host) expect(places.has(row.host), `${row.id} host`).toBe(true);
      if (row.target.kind === "place") expect(places.has(row.target.place), `${row.id} place`).toBe(true);
      if (row.target.kind === "house" && !targets.has(row.target.target)) {
        // A HOUSE_TARGET_PLACES id that is not in TARGET_NAMES still has a room of its own.
        expect(houseToolPlace({ ...probe, surface: row.target.target }), row.id).not.toEqual({ room: "home", level: "middle" });
      }
      if (row.target.kind === "record") expect(row.group).toBe("record");
    }
  });

  it("finds every tool by its own name and every synonym it carries, in the top three", () => {
    const misses: string[] = [];
    for (const row of TOOL_ATLAS) {
      for (const word of [row.label, ...row.synonyms]) {
        if (!top3(word).some((result) => result.id === row.id)) misses.push(`${row.id} ← "${word}" got ${top3(word).map((result) => result.id).join(", ")}`);
      }
    }
    expect(misses).toEqual([]);
  });

  it("finds every §3.4 word in its group, in the top three", () => {
    const misses: string[] = [];
    for (const row of SECTION_3_4) {
      for (const word of row.words.split(",").map((part) => part.trim())) {
        const carriers = TOOL_ATLAS.filter((tool) => tool.synonyms.some((synonym) => normalizeAtlasQuery(synonym) === normalizeAtlasQuery(word)) || normalizeAtlasQuery(tool.label) === normalizeAtlasQuery(word));
        if (!carriers.some((tool) => row.groups.includes(tool.group))) misses.push(`"${word}" is filed under no ${row.groups.join("/")} tool`);
        const found = top3(word);
        if (!found.some((result) => row.groups.includes(result.group))) misses.push(`"${word}" → ${found.map((result) => result.id).join(", ")}`);
      }
    }
    expect(misses).toEqual([]);
  });

  it("returns both meanings of an ambiguous word, ranked, with their groups", () => {
    const sitdown = top3("sitdown").map((result) => result.id);
    expect(sitdown).toContain("sitdown");
    expect(sitdown).toContain("campfire");
    const planner = top3("planner").map((result) => `${result.id}:${result.group}`);
    expect(planner).toEqual(expect.arrayContaining(["recipe-card:plans", "steps:plans"]));
    const record = searchAtlas("record").map((result) => result.id);
    expect(record.slice(0, 3)).toEqual(expect.arrayContaining(["books", "purchase"]));
    for (const result of searchAtlas("bank")) expect(result.groupHeading).toBeTruthy();
  });

  it("ranks name above synonym above the household's own words", () => {
    const names: AtlasHouseholdName[] = [
      { label: "Hydro", kind: "bill", target: { kind: "house", target: "cellar-bills", object: "bill/rec-hydro" } },
      { label: "Visa", kind: "account", target: { kind: "books", pane: "wallet" } },
      { label: "Bianca", kind: "member", target: { kind: "house", target: "fund" } },
      { label: "Lisbon trip", kind: "kitty-bank", target: { kind: "house", target: "loft-banks", object: "bank/goal-lisbon" } },
    ];
    const hydro = searchAtlas("Hydro", { householdNames: names });
    expect(hydro[0]).toMatchObject({ label: "Hydro", match: "household", group: "bills-dates", groupHeading: "Bills and dates" });
    expect(hydro[0]!.target).toEqual({ kind: "house", target: "cellar-bills", object: "bill/rec-hydro" });
    const visa = searchAtlas("visa", { householdNames: names });
    expect(visa[0]!.id).toBe("accounts");
    expect(visa.some((result) => result.match === "household" && result.label === "Visa")).toBe(true);
    expect(searchAtlas("bianca", { householdNames: names })[0]).toMatchObject({ label: "Bianca", group: "fund" });
    expect(searchAtlas("lisbon", { householdNames: names })[0]).toMatchObject({ label: "Lisbon trip", group: "kitty-banks" });
    const accounts = searchAtlas("accounts", { householdNames: [{ label: "Accounts receivable", kind: "account", target: { kind: "books", pane: "wallet" } }] });
    expect(accounts[0]!.match).toBe("name");
    expect(accounts.at(-1)!.match).toBe("household");
  });

  it("returns at most eight, and nothing for an empty query", () => {
    expect(searchAtlas("")).toEqual([]);
    expect(searchAtlas("   ")).toEqual([]);
    expect(searchAtlas("the").length).toBeLessThanOrEqual(8);
    expect(searchAtlas("a").length).toBeLessThanOrEqual(8);
  });

  it("keeps every retired word findable by search", () => {
    for (const retired of RETIRED_WORDS) {
      const word = retired.word.replace(/\.$/, "");
      if (word === "cov") continue;
      expect(searchAtlas(word).length, retired.word).toBeGreaterThan(0);
    }
  });

  it("imports nothing that writes (A12)", () => {
    const source = readFileSync(new URL("../src/core/toolAtlas.ts", import.meta.url), "utf8");
    const imports = [...source.matchAll(/^import[^;]+from\s+"([^"]+)"/gm)].map((match) => match[1]);
    expect(imports).toEqual(["./ledgerExperience.ts"]);
    expect(source).not.toMatch(/captureCommand|commands\.ts/);
  });
});

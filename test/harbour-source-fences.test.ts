import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Little Harbour source fences (BUILD_PLAN §0 #4, §8). The Court reads existing
 * selectors and opens existing doors; it never reaches the books, the kitchen,
 * storage, continuity or the network, and it reads the environment in one
 * file. The App seams stay behind `HARBOUR_ENABLED` / `harbourOwnsRoute`.
 */
const root = process.cwd();
const harbour = join(root, "src", "harbour");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const files = walk(harbour);
const importsOf = (source: string): string[] => [...source.matchAll(/(?:from|import\()\s*["']([^"']+)["']/g)].map((m) => m[1]!);

const FORBIDDEN: { name: string; test: (specifier: string) => boolean }[] = [
  { name: "core/commands", test: (s) => /\/core\/commands(\.ts)?$/.test(s) || /\/core\/commands\//.test(s) },
  { name: "core/index (the command surface)", test: (s) => /\/core\/index\.ts$/.test(s) || /\/core$/.test(s) },
  { name: "kitchenCommand", test: (s) => /kitchenCommand/.test(s) },
  { name: "ledger/", test: (s) => /\/ledger\//.test(s) || /\/ledger\.ts$/.test(s) },
  { name: "ledgerSync/", test: (s) => /\/ledgerSync\//.test(s) },
  { name: "storage", test: (s) => /\/storage(\.ts)?$/.test(s) },
  { name: "continuity", test: (s) => /\/continuity(\.ts)?$/.test(s) },
  { name: "api", test: (s) => /\/api(\.ts)?$/.test(s) },
  { name: "supabase", test: (s) => /supabase/i.test(s) },
];

describe("src/harbour source fences", () => {
  it("has the module skeleton the plan names", () => {
    const names = files.map((f) => relative(harbour, f).replace(/\\/g, "/"));
    for (const expected of ["flag.ts", "HarbourWorld.tsx", "nav/arrival.ts", "nav/Compass.tsx", "nav/QuickSheet.tsx", "scene/place.ts", "scene/runtime.ts", "court/CourtScene.ts", "court/CourtTwins.tsx", "flat/PlaceFlat.tsx", "flat/DoorSign.tsx", "desk/engraved.ts", "data/reading.ts"]) expect(names).toContain(expected);
  });

  it("keeps the flat directory to the light frame once the Desk is the flat world (SIMPLE_VIEW_DESK S6)", () => {
    // `CourtFlat`, `VillageFlat` and the per-place editions retired: the Desk
    // stands at rest in every place, and `engravedCents` / `sundialAngle` live
    // in `desk/engraved.ts`. What is left is the Suspense / loading frame and
    // the door sign it carries — no selector of its own, no door.
    const flat = files.map((f) => relative(harbour, f).replace(/\\/g, "/")).filter((name) => name.startsWith("flat/")).sort();
    expect(flat).toEqual(["flat/DoorSign.tsx", "flat/PlaceFlat.tsx"]);
    for (const name of flat) {
      const source = readFileSync(join(harbour, name), "utf8");
      expect(importsOf(source).filter((specifier) => /\/core\//.test(specifier)), `${name} reads a selector`).toEqual([]);
    }
    expect(files.some((file) => /flat\/CourtFlat/.test(readFileSync(file, "utf8")))).toBe(false);
  });

  it("loads the Bank, Loft and Cellar in their own chunks", () => {
    const names = files.map((f) => relative(harbour, f).replace(/\\/g, "/"));
    for (const expected of ["scene/travel.ts", "village/BankScene.ts", "village/LoftScene.ts", "cellar/CellarScene.ts", "flat/PlaceFlat.tsx"]) expect(names).toContain(expected);
    const shell = readFileSync(join(harbour, "HarbourWorld.tsx"), "utf8");
    // Lazy, one import each: standing in the Court downloads neither the tower nor the cellar.
    expect(shell).toMatch(/import\("\.\/village\/LoftScene\.ts"\)/);
    expect(shell).toMatch(/import\("\.\/village\/BankScene\.ts"\)/);
    expect(shell).toMatch(/import\("\.\/cellar\/CellarScene\.ts"\)/);
    expect(shell).not.toMatch(/^import (?!type ).*(village|cellar)\/.*Scene\.ts/m);
  });

  it("keeps every place's directory inside the same fences", () => {
    // `body` is the character the reader walks; `presence` is the partner's
    // body and the seam the live-position lane installs itself into. Like every
    // other directory here, neither reaches anything outside the harbour, which
    // the import fence below is what proves.
    const dirs = ["court", "tower", "cellar", "glasshouse", "kitchen", "boathouse", "library", "cottage", "kiln", "campfire", "atlas", "scene", "flat", "nav", "data", "camera", "assets", "body", "presence", "interiors", "village", "skate", "mountain", "desk"];
    const seen = new Set(files.map((f) => relative(harbour, f).replace(/\\/g, "/").split("/")[0]).filter((part) => part && !part.endsWith(".ts") && !part.endsWith(".tsx")));
    for (const dir of ["court", "tower", "cellar", "glasshouse", "kitchen", "boathouse", "library", "cottage", "kiln", "campfire", "atlas", "scene", "flat"]) expect([...seen]).toContain(dir);
    for (const name of [...seen]) expect(dirs).toContain(name);
  });

  it("never imports commands, the kitchen, the ledger, storage, continuity or the api", () => {
    const offences: string[] = [];
    for (const file of files) {
      for (const specifier of importsOf(readFileSync(file, "utf8"))) {
        for (const rule of FORBIDDEN) if (rule.test(specifier)) offences.push(`${relative(root, file)} → ${specifier} (${rule.name})`);
      }
    }
    expect(offences).toEqual([]);
  });

  it("reads import.meta.env in flag.ts only", () => {
    const readers = files.filter((file) => /import\.meta\.env/.test(readFileSync(file, "utf8"))).map((file) => relative(harbour, file).replace(/\\/g, "/"));
    expect(readers).toEqual(["flag.ts"]);
  });

  it("never touches fetch, localStorage or the books outside the loaders and the shell's return records", () => {
    // `desk/flip.ts` writes the same `hearth:motion` preference the quick sheet's edition switch writes (SIMPLE_VIEW_DESK).
    const allowed = new Set(["assets/loadGlb.ts", "court/queenPlace.ts", "scene/quality.ts", "nav/QuickSheet.tsx", "nav/arrival.ts", "HarbourWorld.tsx", "desk/flip.ts"]);
    const offences: string[] = [];
    for (const file of files) {
      const name = relative(harbour, file).replace(/\\/g, "/");
      const source = readFileSync(file, "utf8");
      if (allowed.has(name)) continue;
      if (/\bfetch\(/.test(source)) offences.push(`${name} fetches`);
      if (/localStorage|sessionStorage|indexedDB/.test(source)) offences.push(`${name} reads storage`);
    }
    expect(offences).toEqual([]);
    const money = files.filter((file) => /postEntry|postShift|postVisit|acceptHouseholdWrite|allocateHouseholdFundSurplus|commitCommand/.test(readFileSync(file, "utf8")));
    expect(money).toEqual([]);
    // Scrubbing the cellar's rail is a reading: no place may write a hypothetical back to the books.
    const writers = files.filter((file) => /fundWalkWith\s*\(|deferObligation|hypothetical:/.test(readFileSync(file, "utf8")));
    expect(writers).toEqual([]);
  });

  it("keeps the App seams behind the flag", () => {
    const app = readFileSync(join(root, "src", "App.tsx"), "utf8");
    expect(app).toMatch(/harbourOwnsRoute\(activeHouseRoute,view\)\?<Suspense fallback=\{<HarbourFlat place=\{harbourPlaceFor\(activeHouseRoute,view,true\)\?\?"court"\}/);
    expect(app).toMatch(/data-harbour-court=\{harbourOwnsRoute\(activeHouseRoute,view\)&&!activeHouseRoute\.surface\|\|undefined\}/);
    expect(app).toMatch(/HARBOUR_ENABLED&&view==="household"\?<><Compass/);
    expect(app).toMatch(/harbourArrivalRoute\(\{saved:saved\?\.route,scope:session\.view/);
    expect(app).toMatch(/const HarbourWorld = lazy\(\(\) => import\("\.\/harbour\/HarbourWorld\.tsx"\)\)/);
    expect(app).toMatch(/onJourney=\{\(\)=>goTab\("plan",undefined,\{route:\{householdId:household\.householdId,scope:"household",room:"kitchen-table",level:"above",surface:"journey",object:"harbour-return",time:harbourJourneyAnchor\(household,today\)\.date\}/);
    expect(app).toMatch(/onExitJourney=\{\(\) => navigateHouseSurface\(\{householdId:household\.householdId,scope:"household",room:"home",level:"middle",village:\{place:"court"\}\}\)\}/);
  });
});

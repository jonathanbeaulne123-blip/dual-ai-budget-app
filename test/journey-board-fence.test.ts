import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The Journey Board source fence (PLAN §B T6, DIRECTION non-negotiable 3; mirrors test/harbour-source-fences.test.ts).
 *
 * `src/journey/**` is presentation over the Household snapshot: it reads pure selectors and opens existing surfaces
 * through the App's callbacks. It never reaches the command surface, the kitchen, the ledger, storage, continuity,
 * the api or Supabase; never imports a captured command or an App-level writer; never reaches the Our Path spiral
 * (`src/path`), the Horizon runtime, movers, weather or the fleet; fetches in `land/load.ts` only; touches browser
 * storage in `ui/viewState.ts` only; never reads `import.meta.env`; and its pure model imports no three / react and
 * creates no clock (`today` is the App's).
 */
const root = process.cwd();
const journey = join(root, "src", "journey");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const files = walk(journey);
const nameOf = (file: string) => relative(journey, file).replace(/\\/g, "/");
const importsOf = (source: string): string[] => [...source.matchAll(/(?:from|import\()\s*["']([^"']+)["']/g)].map((m) => m[1]!);
/** A relative specifier resolved to a repo path ("src/core/index.ts"); a package specifier as written. */
const resolved = (file: string, specifier: string): string =>
  specifier.startsWith(".") ? relative(root, resolve(dirname(file), specifier)).replace(/\\/g, "/") : specifier;
/**
 * Source without comments, for the name checks (a comment naming a writer is documentation, not a call). A linear
 * scan that keeps string and template literals whole, so "https://…" is never read as a comment.
 */
function code(source: string): string {
  let out = "";
  let quote: string | null = null;
  for (let i = 0; i < source.length; i += 1) {
    const c = source[i]!, next = source[i + 1];
    if (quote) {
      out += c;
      if (c === "\\") { out += next ?? ""; i += 1; } else if (c === quote) quote = null;
      continue;
    }
    if (c === "/" && next === "/") { while (i < source.length && source[i] !== "\n") i += 1; out += "\n"; continue; }
    if (c === "/" && next === "*") { const end = source.indexOf("*/", i + 2); i = end < 0 ? source.length : end + 1; out += " "; continue; }
    if (c === '"' || c === "'" || c === "`") quote = c;
    out += c;
  }
  return out;
}
const codeCache = new Map<string, string>();
const codeOf = (file: string) => { let body = codeCache.get(file); if (body === undefined) { body = code(readFileSync(file, "utf8")); codeCache.set(file, body); } return body; };

const FORBIDDEN: { name: string; test: (specifier: string, path: string) => boolean }[] = [
  { name: "core/commands", test: (s, p) => /\/core\/commands(\.ts)?$/.test(s) || /\/core\/commands\//.test(s) || /^src\/core\/commands(\.ts|\/)/.test(p) },
  { name: "core/index (the command surface)", test: (s, p) => /\/core\/index\.ts$/.test(s) || /\/core$/.test(s) || p === "src/core/index.ts" || p === "src/core" },
  { name: "kitchenCommand", test: (s) => /kitchenCommand/.test(s) },
  { name: "ledger/", test: (s, p) => /\/ledger\//.test(s) || /\/ledger\.ts$/.test(s) || /^src\/ledger(\/|\.ts$)/.test(p) },
  { name: "ledgerSync/", test: (s) => /\/ledgerSync\//.test(s) },
  // The books' store is src/storage.ts; nothing else named storage exists under src/journey's reach.
  { name: "storage", test: (s, p) => /\/storage(\.ts)?$/.test(s) || /^src\/storage(\.ts)?$/.test(p) },
  { name: "continuity", test: (s) => /\/continuity(\.ts)?$/.test(s) },
  { name: "api", test: (s) => /\/api(\.ts)?$/.test(s) },
  { name: "supabase", test: (s) => /supabase/i.test(s) },
  // Journey-specific fences.
  { name: "src/path (the Our Path spiral)", test: (_s, p) => /^src\/path(\/|$)/.test(p) },
  { name: "harbour/horizon/runtime", test: (s, p) => /\/harbour\/horizon\/runtime(\/|\.ts$|$)/.test(s) || /^src\/harbour\/horizon\/runtime(\/|$)/.test(p) },
  { name: "movers", test: (s) => /(^|\/)movers?(\/|\.ts$|$)/i.test(s) || /moverHook|moverInput/.test(s) },
  { name: "weather", test: (s) => /weather/i.test(s) },
  { name: "fleet", test: (s) => /fleet/i.test(s) },
];

/** App-level writer modules (the harbour fence's list) plus the hearthside / personal-life command modules. */
const WRITER_MODULES = /\/(ChapterTaskControls|ChapterPanel|SitDownGuide|PlanStudio|Books|AddSlideshow|campfire\/(beats|CampfireRitual|WeeklySitdown|useCampfireWrite)|hearthside\/commands|hearthside\/personalLifeCommands)(\.tsx?)?$/;
/** Names that post, move or commit money / household state. None may appear in journey code. */
const WRITERS = /\b(postEntry|postShift|commitCommand|acceptHouseholdWrite|fundWalkWith|deferObligation|postOneRecurrence|commitPersonalLife|commitHome|postVisit|allocateHouseholdFundSurplus|commitHearthside|runKitchen)\b/;

describe("src/journey source fence", () => {
  it("has the module skeleton the plan names (so the fence walks real files)", () => {
    const names = files.map(nameOf);
    for (const expected of ["contracts.ts", "model/index.ts", "land/load.ts", "land/index.ts", "board/index.ts", "ui/JourneyBoard.tsx", "ui/viewState.ts"]) expect(names).toContain(expected);
    expect(files.length).toBeGreaterThan(40);
  });

  it("never imports commands, the kitchen, the ledger, storage, continuity, the api, Supabase, src/path, the Horizon runtime, movers, weather or the fleet", () => {
    const offences: string[] = [];
    for (const file of files) {
      for (const specifier of importsOf(readFileSync(file, "utf8"))) {
        const path = resolved(file, specifier);
        for (const rule of FORBIDDEN) if (rule.test(specifier, path)) offences.push(`${relative(root, file)} → ${specifier} (${rule.name})`);
      }
    }
    expect(offences).toEqual([]);
  });

  it("imports no captured command from any core module, and no App-level writer", () => {
    // Same discovery as the harbour fence: every name exported as `captureCommand(…)` anywhere in core is forbidden,
    // whichever module it is imported from (core/chapters.ts, core/tasks.ts and core/pathEras.ts mix selectors the
    // board reads with commands it must not import).
    const coreDir = join(root, "src", "core");
    const commands = new Set(walk(coreDir).flatMap((file) => [...readFileSync(file, "utf8").matchAll(/export const (\w+)\s*=\s*captureCommand\(/g)].map((m) => m[1]!)));
    expect(commands.has("closeChapter")).toBe(true);
    expect(commands.has("openChapter")).toBe(true);
    const offences: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["']([^"']+)["']/g)) {
        const [, names, specifier] = match;
        for (const raw of names!.split(",")) {
          const name = raw.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]!.trim();
          if (name && (commands.has(name) || name === "captureCommand")) offences.push(`${relative(root, file)} → ${name} from ${specifier} (a captured command)`);
        }
      }
      for (const specifier of importsOf(source)) if (WRITER_MODULES.test(specifier)) offences.push(`${relative(root, file)} → ${specifier} (an App-level writer)`);
    }
    expect(offences).toEqual([]);
  });

  it("names no writer: nothing posts, commits, walks the Fund with a hypothetical or defers an obligation", () => {
    const offences = files.flatMap((file) => {
      const match = codeOf(file).match(WRITERS);
      return match ? [`${nameOf(file)} names ${match[1]}`] : [];
    });
    expect(offences).toEqual([]);
    // A hypothetical written back is a writer even without a named function.
    expect(files.filter((file) => /hypothetical:/.test(codeOf(file))).map(nameOf)).toEqual([]);
  });

  it("fetches in land/load.ts only, touches browser storage in ui/viewState.ts only, and never reads import.meta.env", () => {
    const fetchers = files.filter((file) => /\bfetch\(/.test(codeOf(file))).map(nameOf);
    expect(fetchers).toEqual(["land/load.ts"]);
    const storage = files.filter((file) => /localStorage|sessionStorage|indexedDB/.test(readFileSync(file, "utf8"))).map(nameOf);
    expect(storage).toEqual(["ui/viewState.ts"]);
    const env = files.filter((file) => /import\.meta\.env/.test(readFileSync(file, "utf8"))).map(nameOf);
    expect(env).toEqual([]);
  });

  it("keeps model/** pure: no three, no react, no clock", () => {
    const model = files.filter((file) => nameOf(file).startsWith("model/"));
    expect(model.length).toBeGreaterThan(10);
    const offences: string[] = [];
    for (const file of model) {
      const source = readFileSync(file, "utf8");
      for (const specifier of importsOf(source)) if (/^(three|react|react-dom)(\/|$)/.test(specifier) || /\.tsx$/.test(specifier)) offences.push(`${nameOf(file)} → ${specifier}`);
      // One clock: `today` is passed in. Parsing a given date string (`new Date(value)`) is not a clock; reading
      // the wall clock (`Date.now()`, a bare `new Date()`, `performance.now()`) is.
      const body = code(source);
      for (const clock of [/\bDate\.now\s*\(/, /\bnew Date\s*\(\s*\)/, /\bnew Date\b(?!\s*\()/, /\bperformance\.now\s*\(/]) if (clock.test(body)) offences.push(`${nameOf(file)} reads the clock (${clock.source})`);
    }
    expect(offences).toEqual([]);
  });

  it("reaches outside src/journey only through the README's \"may import\" table (trust minor 8)", () => {
    // Per layer: the non-journey modules it may import. Anything else outside src/journey is an offence, so a new
    // reach (a writer hiding in a "constants" module) has to be added here and to the README table on purpose.
    const ALLOWED: Record<string, RegExp[]> = {
      "contracts.ts": [/^src\/core\/(calendar|chapters|fabActions|types)\.ts$/, /^src\/harbour\/horizon\/(world\/definition|land\/interfaces)\.ts$/, /^src\/home\/model\.ts$/, /^src\/theme\/scenes\.ts$/],
      model: [/^src\/core\/\w+\.ts$/, /^src\/harbour\/glass\/(dayLedger|campCardModel)\.ts$/, /^src\/campfire\/model\.ts$/, /^src\/home\/(progression|model|site|catalogue)\.ts$/, /^src\/hearthside\/(contracts|winMemory)\.ts$/],
      land: [/^src\/house\/world\/horizonAssets\.ts$/, /^src\/harbour\/horizon\/land\/(terrain\/asset|interfaces|corridor\/types)\.ts$/, /^src\/harbour\/horizon\/world\/definition\.ts$/, /^src\/home\/(geometry|site)\.ts$/, /^src\/worldGeography\.ts$/],
      board: [/^src\/house\/world\/rendererOwner\.ts$/, /^src\/harbour\/scene\/quality\.ts$/],
      // ui: the theme, the Horizon flag and quality tier (read-only), the world revision, the motion key (constants
      // only: `harbour/nav/motionKey.ts`; `motionEdition.ts` for MOTION_KEY alone until the ui switches) and the
      // local diagnostics inspector (device-only: no fetch, no upload; an export is a file the person saves).
      ui: [/^src\/theme\/\w+\.tsx?$/, /^src\/harbour\/flag\.ts$/, /^src\/harbour\/scene\/quality\.ts$/, /^src\/harbour\/nav\/(motionKey|motionEdition)\.ts$/, /^src\/worldGeography\.ts$/, /^src\/diagnostics\/inspectorCore\.ts$/],
    };
    const offences: string[] = [];
    for (const file of files) {
      const name = nameOf(file);
      const layer = name === "contracts.ts" ? name : name.split("/")[0]!;
      const allowed = ALLOWED[layer];
      if (!allowed) continue;
      const source = readFileSync(file, "utf8");
      for (const specifier of importsOf(source)) {
        if (!specifier.startsWith(".")) continue;
        const path = resolved(file, specifier);
        if (path.startsWith("src/journey/")) continue;
        if (!allowed.some((rule) => rule.test(path))) offences.push(`${name} → ${path}`);
      }
      // From the edition module, only the key and its type: never its storage reader or writer.
      for (const match of source.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["'][^"']*harbour\/nav\/motionEdition\.ts["']/g)) {
        for (const raw of match[1]!.split(",")) {
          const imported = raw.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]!.trim();
          if (imported && imported !== "MOTION_KEY" && imported !== "MotionEdition") offences.push(`${name} → motionEdition.${imported} (a storage reader/writer)`);
        }
      }
    }
    expect(offences).toEqual([]);
    // The key module itself holds constants only.
    const key = code(readFileSync(join(root, "src", "harbour", "nav", "motionKey.ts"), "utf8"));
    expect(key).not.toMatch(/localStorage|sessionStorage|function|import\s/);
  });

  it("the diagnostics inspector the ui reports to never leaves the device (trust minor 11)", () => {
    const core = code(readFileSync(join(root, "src", "diagnostics", "inspectorCore.ts"), "utf8"));
    expect(core).not.toMatch(/\bfetch\(|sendBeacon|XMLHttpRequest|WebSocket|EventSource|supabase/i);
    expect(importsOf(core)).toEqual([]);
  });

  it("keeps the frozen contracts free of a writing action: every ActionCall opens a surface", () => {
    const contracts = readFileSync(join(journey, "contracts.ts"), "utf8");
    const union = contracts.slice(contracts.indexOf("export type ActionCall ="), contracts.indexOf("export type StopAction"));
    const names = [...union.matchAll(/name: "(\w+)"/g)].map((m) => m[1]);
    // Horizon Clock's dial adds two open-only calls: "All tools" opens the quick sheet; "Simple view" picks the device's
    // flat motion edition. Neither writes.
    // "enterHorizonCentre" (trust minor 1) resolves to `enterHorizon` at the map's centre ground inside runJourneyAction.
    expect(names.sort()).toEqual(["back", "chooseSimpleView", "enterHorizon", "enterHorizonCentre", "openAllTools", "openBillPaid", "openBooks", "openCalendar", "openCampfire", "openDueReview", "openEraPlanner", "openHomeBook", "openKitty", "openPlace", "openRecord", "openWeeklySitdown"]);
  });
});

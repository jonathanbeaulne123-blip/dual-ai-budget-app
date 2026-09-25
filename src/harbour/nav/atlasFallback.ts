/**
 * The Tool Atlas, local copy (brief `docs/briefs/tool-atlas-2026-09-25.md` §3.2, §3.4).
 *
 * Track A writes the one list at `src/core/toolAtlas.ts`. Until it lands the
 * All-tools sheet renders from this fallback, typed with the same shape, so
 * the integrator swaps it by changing one import in `QuickSheet.tsx`.
 *
 * One vocabulary: headings are plain jobs, the place is in the subtitle.
 * Synonyms are a search index, never rendered — they keep every retired word
 * findable ("quick travel", "together", "master planner" …) without showing it.
 *
 * `target` is what the sheet dispatches:
 *  - a `TARGET_NAMES` id (`src/house/navigation.ts`) → `onOpen(id)`;
 *  - `place:<HarbourPlaceId>` → the host's compact panel and the camera (`onPlace`);
 *  - `settings` / `settings:<section>` → Settings (`onSettings`, else `onStatus`);
 *  - `world:<action>` → a world experience behind Step in (`onWorld`; hidden without it);
 *  - anything else (`accounts`, `activity`, `import`, `audit`, `campfire`,
 *    `leaving`, `sitdown`) → `onTarget` when given, else `onOpen(target)`.
 * Pure data. No imports from core: reading this file can never write.
 */
import type { HarbourPlaceId } from "../flag.ts";

export type AtlasSpace = "ours" | "mine";
export type AtlasGroupId = "bills" | "fund" | "kitty" | "books" | "plans" | "boathouse" | "places" | "settings" | "hercules";

export type AtlasTool = {
  id: string;
  label: string;
  subtitle?: string;
  group: AtlasGroupId;
  /** The map's host whose compact panel carries this tool (`SCALES` §4.3). */
  host?: HarbourPlaceId;
  target: string;
  synonyms: string[];
  spaces: readonly AtlasSpace[];
};

export type AtlasGroup = {
  id: AtlasGroupId;
  heading: string;
  subtitle: string;
  tools: AtlasTool[];
};

/** The five Record verbs (§3.3), nearest the thumb first. Never icon-only. */
export type AtlasRecordMode = "expense" | "shift" | "income" | "bill" | "transfer";
export type AtlasRecordVerb = { mode: AtlasRecordMode; label: string; aria: string };
export const ATLAS_RECORD_VERBS: readonly AtlasRecordVerb[] = Object.freeze([
  { mode: "expense", label: "Purchase", aria: "Purchase: record one" },
  { mode: "shift", label: "Shift", aria: "Shift: clock in, clock out, or record one" },
  { mode: "income", label: "Income", aria: "Income: record it" },
  { mode: "bill", label: "Bill paid", aria: "Bill paid: record a bill as paid" },
  { mode: "transfer", label: "Move money", aria: "Move money between accounts" },
]);

const BOTH: readonly AtlasSpace[] = Object.freeze(["ours", "mine"]);
const OURS: readonly AtlasSpace[] = Object.freeze(["ours"]);
const MINE: readonly AtlasSpace[] = Object.freeze(["mine"]);

type Row = Omit<AtlasTool, "group" | "spaces"> & { spaces?: readonly AtlasSpace[] };
const group = (id: AtlasGroupId, heading: string, subtitle: string, rows: Row[]): AtlasGroup => ({
  id, heading, subtitle, tools: rows.map((row) => ({ ...row, group: id, spaces: row.spaces ?? BOTH })),
});

/** §3.2, in order: six jobs, then Places, then Settings; Hercules is the footer. Rows by score. */
export const ATLAS_FALLBACK: readonly AtlasGroup[] = Object.freeze([
  group("bills", "Bills and dates", "what's leaving and when, in the Cellar and on the Calendar", [
    { id: "calendar", label: "Calendar", subtitle: "every date this month", target: "calendar", synonyms: ["calendar", "week", "dates", "appointments", "potential", "planned", "strip", "time machine", "replay"] },
    { id: "leaving", label: "Leaving", subtitle: "what goes out this week", target: "leaving", synonyms: ["leaving next", "next out", "scheduled to leave", "spoken for"] },
    { id: "bills", label: "Bills", subtitle: "in the Cellar", host: "cellar", target: "cellar-bills", synonyms: ["bill", "cellar", "due", "jars", "prepare", "obligation", "commitment", "recurring", "subscription", "paid", "scheduled", "mark paid"] },
    { id: "weekly-sitdown", label: "The weekly Sitdown", subtitle: "two chairs at the flagstone", target: "sitdown", synonyms: ["sitdown", "weekly", "sit-down", "sit down", "check in"] },
  ]),
  group("fund", "The Fund", "Everyday · now, what we each put in, and every account", [
    { id: "fund-bank", label: "The Fund bank", subtitle: "Everyday · now and what we each put in", host: "bank", target: "queen", synonyms: ["fund", "everyday", "now", "queen", "balance", "shared money", "household fund", "contribution", "custodian", "surplus", "protect", "meet the queen"], spaces: OURS },
    { id: "accounts", label: "Accounts", subtitle: "the Wallet: every account and card", host: "bank", target: "accounts", synonyms: ["account", "wallet", "visa", "statements", "card", "chequing", "savings"] },
  ]),
  group("kitty", "Kitty Banks", "in the Loft, what we're saving toward", [
    { id: "kitty-banks", label: "Kitty Banks", subtitle: "the Loft", host: "tower", target: "loft-banks", synonyms: ["kitty", "goals", "build", "envelope", "save", "loft", "banks"] },
    { id: "bank-room", label: "A Kitty Bank's room", subtitle: "one bank: its plan, money and studio", host: "tower", target: "loft-banks", synonyms: ["goal", "reserve", "rollover", "add to this bank"] },
    { id: "pottery", label: "Pottery", subtitle: "a bank's studio, fired in the Kiln", host: "kiln", target: "pottery", synonyms: ["pottery", "studio", "kiln", "shape", "paint", "fire"] },
    { id: "jug", label: "The jug", subtitle: "move the Fund's surplus to Kitty Banks", host: "tower", target: "loft-banks", synonyms: ["jug", "money gun", "surplus to kitty"], spaces: OURS },
  ]),
  group("books", "Books", "the Standing Book in the Library: every entry, imports, the paper trail", [
    { id: "books", label: "Books", subtitle: "the Standing Book", host: "library", target: "books", synonyms: ["ledger", "journal", "standing book", "library", "paper trail", "record", "close pack"] },
    { id: "activity", label: "All activity", subtitle: "the register, every entry", host: "library", target: "activity", synonyms: ["activity", "register", "entries", "search activity", "duplicates"] },
    { id: "import", label: "Import", subtitle: "statements and photos into the inbox", host: "library", target: "import", synonyms: ["import", "qfx", "ofx", "upload", "inbox", "flinks"] },
    { id: "audit", label: "Tools & audit", subtitle: "journal, trial balance, statements, reconcile", host: "library", target: "audit", synonyms: ["audit", "reconcile", "trial balance", "audit office"] },
  ]),
  group("plans", "Plans", "the recipe card at the kitchen table, the Campfire, and steps in the Glasshouse", [
    { id: "steps", label: "Steps", subtitle: "in the Glasshouse", host: "glasshouse", target: "planner", synonyms: ["steps", "tasks", "to-do", "todo", "glasshouse", "rituals", "moves", "who's carrying", "board", "ask", "master planner", "our plans", "plan together", "sit together"] },
    { id: "campfire", label: "The Campfire", subtitle: "the Chapter, in five beats", host: "campfire", target: "campfire", synonyms: ["chapter", "month", "close", "campfire", "seal", "check-in", "rehearsal", "monthly sitdown", "close the month"] },
    { id: "recipe-card", label: "The recipe card", subtitle: "this month's plan at the kitchen table", host: "kitchen", target: "plan-studio", synonyms: ["plan", "planner", "plan studio", "recipe", "kitchen", "table", "wizard", "scenario", "kitchen table"] },
    { id: "drawer", label: "The drawer", subtitle: "the kitchen table's plan tools", host: "kitchen", target: "plan-studio", synonyms: ["bridge", "draft", "lenses", "assumptions", "plan tools"] },
    { id: "folio", label: "Our folio", subtitle: "the two of you talking, at the kitchen table", host: "kitchen", target: "conversation", synonyms: ["folio", "conversation", "intention", "talk together"] },
  ]),
  group("boathouse", "The Boathouse", "wishes, memories and letters, and the Atlas of our island", [
    { id: "wishes", label: "Wishes", subtitle: "tend a wish", host: "boathouse", target: "wishes", synonyms: ["wish", "together", "hearthside", "boathouse", "possibility", "conservatory", "play"], spaces: OURS },
    { id: "memories", label: "Memories", subtitle: "keep an ordinary day", host: "boathouse", target: "memories", synonyms: ["memory", "theatre", "projector", "choose three memories", "film"], spaces: OURS },
    { id: "letters", label: "Letters", subtitle: "the writing desk", host: "boathouse", target: "letters", synonyms: ["letter", "writing desk", "capsule", "voice note", "note"], spaces: OURS },
    { id: "atlas", label: "The Atlas", subtitle: "eras, recipes and the island's name", host: "atlas", target: "journey", synonyms: ["journey", "our path", "island", "era", "map", "horizon", "recipes", "name", "atlas nook", "journey map"] },
    { id: "private-folio", label: "My private folio", subtitle: "a private wish, memory or note", host: "boathouse", target: "wishes", synonyms: ["private", "personal conservatory", "my wishes"], spaces: MINE },
  ]),
  group("places", "Places", "go anywhere on the island", [
    { id: "place-square", label: "The square", subtitle: "the middle of the village", host: "court", target: "place:court", synonyms: ["square", "village", "town", "town square", "court", "quick travel", "go to"] },
    { id: "place-bank", label: "The Fund bank", subtitle: "the Queen and the vault", host: "bank", target: "place:bank", synonyms: ["fund bank"] },
    { id: "place-kitchen", label: "The Kitchen", subtitle: "Our home", host: "kitchen", target: "place:kitchen", synonyms: ["our home", "house", "home"] },
    { id: "place-loft", label: "The Loft", subtitle: "Our home, upstairs", host: "tower", target: "place:tower", synonyms: ["tower", "upstairs", "rack"] },
    { id: "place-cellar", label: "The Cellar", subtitle: "Our home, downstairs", host: "cellar", target: "place:cellar", synonyms: ["downstairs", "rail"] },
    { id: "place-atlas", label: "The Atlas room", subtitle: "Our home, up the kitchen stair", host: "atlas", target: "place:atlas", synonyms: ["stair"] },
    { id: "place-library", label: "The Library", subtitle: "the Standing Book", host: "library", target: "place:library", synonyms: ["lectern", "bindery"] },
    { id: "place-glasshouse", label: "The Glasshouse", subtitle: "steps, week by week", host: "glasshouse", target: "place:glasshouse", synonyms: ["greenhouse", "benches"] },
    { id: "place-kiln", label: "The Kiln", subtitle: "shape, paint and fire", host: "kiln", target: "place:kiln", synonyms: ["pottery studio", "firing"] },
    { id: "place-cottage", label: "Hercules's Cottage", subtitle: "his looks and keepsakes", host: "cottage", target: "place:cottage", synonyms: ["cottage", "cat house"] },
    { id: "place-boathouse", label: "The Boathouse", subtitle: "wishes, memories and letters", host: "boathouse", target: "place:boathouse", synonyms: ["shore", "waterfront"] },
    { id: "place-campfire", label: "The Campfire", subtitle: "by the water", host: "campfire", target: "place:campfire", synonyms: ["fire", "ring", "stones"] },
    { id: "step-in", label: "Step in", subtitle: "walk inside the place you're looking at", target: "world:step-in", synonyms: ["step in", "look around", "walk", "illustrated", "character", "avatar", "mountain"] },
    { id: "skate", label: "Skate", subtitle: "the island's Skate Club", target: "world:skate", synonyms: ["skate", "board", "routes", "spots", "race"] },
    { id: "arrange", label: "Arrange room", subtitle: "move what stands in this room", target: "world:arrange", synonyms: ["arrange", "decorate", "furniture"] },
  ]),
  group("settings", "Settings", "household, privacy, appearance, help", [
    { id: "status", label: "Status", subtitle: "the household, sync and help", target: "settings", synonyms: ["settings", "health", "sync", "export", "backup", "undo", "restore", "invite", "pair", "help"] },
    { id: "appearance", label: "Appearance and comfort", subtitle: "theme, quiet, always show labels", target: "settings:appearance", synonyms: ["appearance", "theme", "comfort", "quiet", "labels", "always show labels", "text size", "record on the left"] },
    { id: "charter", label: "The charter", subtitle: "what we agreed to", target: "settings:charter", synonyms: ["charter", "permissions", "agreement"], spaces: OURS },
    { id: "presence", label: "Character and presence", subtitle: "who you walk as, and walking together", target: "settings:presence", synonyms: ["presence", "walk together", "hide me", "partner"] },
    { id: "hercules-pro", label: "Hercules Pro", subtitle: "the companion's plan", target: "settings:hercules-pro", synonyms: ["pro", "subscription plan"] },
    { id: "sign-out", label: "Sign out", subtitle: "this device", target: "settings:sign-out", synonyms: ["sign out", "log out", "logout"] },
  ]),
  group("hercules", "Hercules", "talk with him, or visit his Cottage", [
    { id: "hercules", label: "Talk with Hercules", subtitle: "suggestions and a chat", target: "hercules", synonyms: ["hercules", "talk", "suggestion", "companion", "cat", "workspace", "discovery"] },
    { id: "cottage", label: "Visit his Cottage", subtitle: "his looks and wardrobe", host: "cottage", target: "wardrobe", synonyms: ["dressing room", "wardrobe", "looks", "keepsakes"] },
  ]),
]) as readonly AtlasGroup[];

/** The six job headings, in order — the Desk drawer must render the same sequence (A4b). */
export const ATLAS_JOB_GROUPS: readonly AtlasGroupId[] = Object.freeze(["bills", "fund", "kitty", "books", "plans", "boathouse"]);

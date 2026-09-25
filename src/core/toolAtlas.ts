/**
 * The Tool Atlas — the one list (docs/briefs/tool-atlas-2026-09-25.md §3.2–§3.4).
 *
 * Every tool a person can reach, in one vocabulary, with its job group, the
 * map host that shows it, how deep it sits (its outcome), the words people
 * actually use for it, and the address the App dispatches when it is picked.
 * The All-tools sheet, the Desk drawer and the map's host panels all read this
 * file, so the grouping is the same on phone and desktop, island and flat.
 *
 * Pure data and pure functions. It imports nothing that writes: picking a row
 * returns an address; the App routes it (A12). A Record row opens an Add flow,
 * which still ends at Final Confirm.
 */
import type { AppTab } from "./ledgerExperience.ts";

/** The dial's five verbs (§3.3). Kept here as a literal so the atlas stays free of UI imports. */
export type AtlasRecordMode = "expense" | "shift" | "income" | "bill" | "transfer";

/** Six job headings, the Record chip row above them, then Places, Settings and the Hercules footer (§3.2). */
export type AtlasGroupId =
  | "record"
  | "bills-dates"
  | "fund"
  | "kitty-banks"
  | "books"
  | "plans"
  | "boathouse"
  | "places"
  | "settings"
  | "hercules";

export type AtlasGroup = {
  id: AtlasGroupId;
  heading: string;
  subtitle: string;
  /** "chips": the Record row, not a heading; "heading": a job or Places/Settings; "footer": Hercules. */
  placement: "chips" | "heading" | "footer";
};

/** In order. The sheet and the Desk drawer render exactly this sequence (A4b). */
export const TOOL_GROUPS: readonly AtlasGroup[] = [
  { id: "record", heading: "Record", subtitle: "a purchase, a shift, income, a bill paid, or money moved", placement: "chips" },
  { id: "bills-dates", heading: "Bills and dates", subtitle: "what's leaving and when, in the Cellar and on the Calendar", placement: "heading" },
  { id: "fund", heading: "The Fund", subtitle: "Everyday · now, what we each put in, and every account", placement: "heading" },
  { id: "kitty-banks", heading: "Kitty Banks", subtitle: "in the Loft, what we're saving toward", placement: "heading" },
  { id: "books", heading: "Books", subtitle: "the Standing Book in the Library: every entry, imports, the paper trail", placement: "heading" },
  { id: "plans", heading: "Plans", subtitle: "the recipe card at the kitchen table, the Campfire, and steps in the Glasshouse", placement: "heading" },
  { id: "boathouse", heading: "The Boathouse", subtitle: "wishes, memories and letters, and the Atlas of our island", placement: "heading" },
  { id: "places", heading: "Places", subtitle: "go anywhere on the island", placement: "heading" },
  { id: "settings", heading: "Settings", subtitle: "household, privacy, appearance, help", placement: "heading" },
  { id: "hercules", heading: "Hercules", subtitle: "talk with him, or visit his Cottage", placement: "footer" },
];

/**
 * A map host (§3.2 last column). The same ids as `HarbourPlaceId` in
 * `src/harbour/flag.ts` (the test holds them equal); declared here so the
 * atlas stays free of scene imports.
 */
export type AtlasHost = "court" | "bank" | "tower" | "cellar" | "glasshouse" | "kitchen" | "boathouse" | "library" | "cottage" | "kiln" | "campfire" | "atlas";

/** `house/navigation.ts` `TARGET_NAMES` / `HOUSE_TARGET_PLACES` ids, plus App's `fund` alias (`openHouseObject("fund")`). */
export type AtlasHouseTarget =
  | "queen" | "loft-banks" | "cellar-bills" | "books" | "planner" | "calendar" | "journey" | "conversation"
  | "plan-studio" | "wishes" | "pottery" | "memories" | "letters" | "projector" | "hercules" | "wardrobe"
  | "shift" | "personal-experience" | "fund";

/** The Books pane App already knows how to request (`booksPaneRequest`). */
export type AtlasBooksPane = "fund" | "fund-register" | "wallet" | "opening" | "register";

/**
 * Where a row goes. The integrator dispatches it:
 * - `record` → `openAddFor(null, mode)` (the dial's verb; Final Confirm still posts)
 * - `house` → `openHouseObject(target, object)`
 * - `books` → `setBooksPaneRequest(pane)` then `goTab("ledger")`
 * - `tab` → `goTab(tab)` (Settings uses `more`, with `section` naming the Status fold)
 * - `place` → the QuickSheet's place walk (`onGo` / `HARBOUR_GO_EVENT`) and the host's compact panel
 * - `action` → a chrome action the App already owns (the edition flip, Step in, sign-out, …)
 */
export type AtlasTarget =
  | { kind: "record"; mode: AtlasRecordMode }
  | { kind: "house"; target: AtlasHouseTarget; object?: string }
  | { kind: "books"; pane: AtlasBooksPane }
  | { kind: "tab"; tab: AppTab; section?: string }
  | { kind: "place"; place: AtlasHost }
  | { kind: "action"; action: "simple-view" | "step-in" | "skate" | "arrange" | "wander" | "character" | "presence" | "sign-out" | "leaving" };

/** §2.4: Surface (on the glass at rest) · one tap · two taps · buried (All tools / search, ≤ 3). */
export type AtlasOutcome = "surface" | "one" | "two" | "buried";
/** Which space lists the tool: both, Ours (household) only, or Mine (personal) only. */
export type AtlasSpaces = "both" | "ours" | "mine";

export type AtlasTool = {
  id: string;
  /** The deck word, as the sheet shows it. */
  label: string;
  subtitle: string;
  group: AtlasGroupId;
  host: AtlasHost | null;
  outcome: AtlasOutcome;
  /** Every word §3.4 files under this tool, retired words included, so search still finds them. Lowercase. */
  synonyms: readonly string[];
  target: AtlasTarget;
  spaces: AtlasSpaces;
  /** The brief's mean score (§2.2); orders rows inside a group. Merged rows carry their parent's. */
  score: number;
  /** Canonical-table rows this tool covers (T-ids, §1.1). */
  covers: readonly string[];
};

const tool = (row: AtlasTool): AtlasTool => row;

/** Every tool, once. Ordered by group, then by score inside the group (`toolsInGroup` sorts; this order is for reading). */
export const TOOL_ATLAS: readonly AtlasTool[] = [
  // Record — the dial's verbs (§3.3), nearest the thumb first.
  tool({ id: "purchase", label: "Purchase", subtitle: "Record one: amount, category, account", group: "record", host: null, outcome: "one",
    synonyms: ["expense", "spend", "spending", "record an expense", "add money", "till", "swipe", "receipt", "bought"],
    target: { kind: "record", mode: "expense" }, spaces: "both", score: 12.8, covers: ["T02", "T07"] }),
  tool({ id: "shift", label: "Shift", subtitle: "Clock in, clock out, or record one", group: "record", host: null, outcome: "one",
    synonyms: ["add a shift", "log shift", "clock in", "clock out", "sign out", "tips", "wages", "hours"],
    target: { kind: "record", mode: "shift" }, spaces: "both", score: 13.6, covers: ["T05"] }),
  tool({ id: "income", label: "Income", subtitle: "Record money that came in", group: "record", host: null, outcome: "one",
    synonyms: ["add income", "paycheque", "paycheck", "payday", "deposit", "came in"],
    target: { kind: "record", mode: "income" }, spaces: "both", score: 7.8, covers: ["T03"] }),
  tool({ id: "bill-paid", label: "Bill paid", subtitle: "Record a bill as paid", group: "record", host: null, outcome: "one",
    synonyms: ["mark paid", "pay it", "reminder", "reminders", "due preview"],
    target: { kind: "record", mode: "bill" }, spaces: "both", score: 8.1, covers: ["T09"] }),
  tool({ id: "move-money", label: "Move money", subtitle: "Between our own accounts", group: "record", host: null, outcome: "one",
    synonyms: ["transfer", "pay the card", "card payment", "move"],
    target: { kind: "record", mode: "transfer" }, spaces: "both", score: 7.8, covers: ["T04"] }),

  // 1 · Bills and dates
  tool({ id: "calendar", label: "Calendar", subtitle: "This month and the next seven days", group: "bills-dates", host: null, outcome: "one",
    synonyms: ["calendar", "week", "dates", "appointments", "potential", "planned", "strip", "time machine", "replay"],
    target: { kind: "house", target: "calendar" }, spaces: "both", score: 11.0, covers: ["T33", "T34", "T26"] }),
  tool({ id: "leaving", label: "Leaving", subtitle: "What leaves next, and what is spoken for", group: "bills-dates", host: "cellar", outcome: "one",
    synonyms: ["next to leave", "spoken for"],
    target: { kind: "action", action: "leaving" }, spaces: "both", score: 9.6, covers: ["T10"] }),
  tool({ id: "cellar", label: "The Cellar", subtitle: "Every bill, its months, and Post all due", group: "bills-dates", host: "cellar", outcome: "one",
    synonyms: ["bills", "bill", "leaving", "next out", "scheduled", "scheduled to leave", "due", "jars", "bill jars", "cellar", "prepare", "obligation", "commitment", "recurring", "subscription", "paid"],
    target: { kind: "house", target: "cellar-bills" }, spaces: "both", score: 7.8, covers: ["T08"] }),
  tool({ id: "sitdown", label: "The weekly Sitdown", subtitle: "Two chairs at the flagstone, once a week", group: "bills-dates", host: null, outcome: "two",
    synonyms: ["sitdown", "sit-down", "weekly sitdown", "our check-in"],
    target: { kind: "house", target: "calendar" }, spaces: "both", score: 4.2, covers: ["T29"] }),

  // 2 · The Fund
  tool({ id: "fund-bank", label: "The Fund bank", subtitle: "Everyday · now, contributions, and what needs you", group: "fund", host: "bank", outcome: "one",
    synonyms: ["fund", "everyday", "now", "queen", "meet the queen", "bank", "balance", "shared money", "household fund", "contribution", "contributions", "custodian", "surplus", "protect", "what now", "fund ledge"],
    target: { kind: "house", target: "fund" }, spaces: "both", score: 9.4, covers: ["T17", "T18", "T13"] }),
  tool({ id: "accounts", label: "Accounts", subtitle: "Every account, card interest, and the Wallet", group: "fund", host: "bank", outcome: "two",
    synonyms: ["accounts", "account", "wallet", "visa", "statements", "cards", "chequing", "savings"],
    target: { kind: "books", pane: "wallet" }, spaces: "both", score: 8.0, covers: ["T22", "T21"] }),

  // 3 · Kitty Banks
  tool({ id: "kitty-bank-room", label: "A Kitty Bank's room", subtitle: "One bank: its plan, money, studio and history", group: "kitty-banks", host: "tower", outcome: "two",
    synonyms: ["envelope", "pottery", "studio", "kiln", "add to this bank", "fund this bank"],
    target: { kind: "house", target: "loft-banks" }, spaces: "both", score: 8.0, covers: ["T12", "T50"] }),
  tool({ id: "loft", label: "Kitty Banks", subtitle: "The Loft: what we're saving toward", group: "kitty-banks", host: "tower", outcome: "two",
    synonyms: ["goals", "goal", "kitty", "banks", "build", "save", "saving", "reserve", "reserves", "loft", "our goals"],
    target: { kind: "house", target: "loft-banks" }, spaces: "both", score: 6.8, covers: ["T11"] }),
  tool({ id: "jug", label: "Move to Kitty Banks", subtitle: "Share a safe surplus into the banks", group: "kitty-banks", host: "tower", outcome: "two",
    synonyms: ["jug", "rollover", "money gun", "gun"],
    target: { kind: "house", target: "loft-banks" }, spaces: "ours", score: 6.8, covers: ["T11"] }),

  // 4 · Books
  tool({ id: "activity", label: "All activity", subtitle: "Every entry, searchable, with duplicates to review", group: "books", host: "library", outcome: "two",
    synonyms: ["register", "activity", "search activity", "duplicates", "entries", "transactions"],
    target: { kind: "books", pane: "register" }, spaces: "both", score: 8.3, covers: ["T23"] }),
  tool({ id: "books", label: "Books", subtitle: "The Standing Book in the Library", group: "books", host: "library", outcome: "two",
    synonyms: ["books", "ledger", "standing book", "library", "paper trail", "record", "the fund tab"],
    target: { kind: "house", target: "books" }, spaces: "both", score: 8.0, covers: ["T19", "T20"] }),
  tool({ id: "import", label: "Import", subtitle: "Bank files and photos, reviewed before Confirm", group: "books", host: "library", outcome: "two",
    synonyms: ["import", "qfx", "ofx", "flinks", "bank file", "photos"],
    target: { kind: "books", pane: "opening" }, spaces: "both", score: 6.1, covers: ["T24"] }),
  tool({ id: "shifts", label: "Shifts", subtitle: "The work page: today, reports, jobs, evidence", group: "books", host: null, outcome: "two",
    synonyms: ["work", "jobs", "timesheet", "on the clock", "open shifts"],
    target: { kind: "house", target: "shift" }, spaces: "both", score: 9.0, covers: ["T06"] }),
  tool({ id: "audit", label: "Tools & audit", subtitle: "Journal, trial balance, statements, reconcile", group: "books", host: "library", outcome: "buried",
    synonyms: ["audit", "journal", "trial balance", "reconcile", "close pack", "audit office"],
    target: { kind: "tab", tab: "ledger", section: "audit" }, spaces: "both", score: 3.0, covers: ["T25"] }),

  // 5 · Plans
  tool({ id: "steps", label: "Steps", subtitle: "The Glasshouse: who's carrying what", group: "plans", host: "glasshouse", outcome: "two",
    synonyms: ["steps", "tasks", "to-do", "todo", "glasshouse", "rituals", "moves", "who's carrying", "board", "ask", "master planner", "our plans", "sit together"],
    target: { kind: "house", target: "planner" }, spaces: "both", score: 5.7, covers: ["T35", "T43"] }),
  tool({ id: "campfire", label: "The Campfire", subtitle: "The Chapter closes here, in five beats", group: "plans", host: "campfire", outcome: "two",
    synonyms: ["chapter", "month", "close", "close the month", "campfire", "seal", "check-in", "rehearsal", "sitdown", "chapter room"],
    target: { kind: "place", place: "campfire" }, spaces: "ours", score: 4.8, covers: ["T29", "T30", "T31"] }),
  tool({ id: "recipe-card", label: "The recipe card", subtitle: "This month's plan at the kitchen table", group: "plans", host: "kitchen", outcome: "two",
    synonyms: ["plan", "planner", "plan studio", "recipe", "card", "kitchen", "table", "kitchen table", "wizard", "folio", "conversation", "plan together"],
    target: { kind: "house", target: "plan-studio" }, spaces: "both", score: 4.4, covers: ["T27", "T44"] }),
  tool({ id: "drawer", label: "The drawer", subtitle: "Scenarios, assumptions and the bridge", group: "plans", host: "kitchen", outcome: "two",
    synonyms: ["scenario", "scenarios", "bridge", "draft", "assumptions", "plan tools"],
    target: { kind: "house", target: "plan-studio" }, spaces: "both", score: 3.8, covers: ["T28"] }),

  // 6 · The Boathouse
  tool({ id: "wishes", label: "Wishes", subtitle: "Give an idea a little light", group: "boathouse", host: "boathouse", outcome: "two",
    synonyms: ["wishes", "wish", "together", "hearthside", "boathouse", "play", "possibility"],
    target: { kind: "house", target: "wishes" }, spaces: "ours", score: 6.1, covers: ["T38"] }),
  tool({ id: "memories", label: "Memories", subtitle: "Keep an ordinary day", group: "boathouse", host: "boathouse", outcome: "buried",
    synonyms: ["memories", "memory", "projector", "theatre", "choose three memories"],
    target: { kind: "house", target: "memories" }, spaces: "ours", score: 3.9, covers: ["T39", "T41"] }),
  tool({ id: "atlas", label: "The Atlas", subtitle: "Eras, recipes and the name of our island", group: "boathouse", host: "atlas", outcome: "buried",
    synonyms: ["journey", "our path", "atlas", "island", "era", "eras", "map", "horizon", "recipes", "name", "atlas nook"],
    target: { kind: "house", target: "journey" }, spaces: "ours", score: 3.0, covers: ["T36"] }),
  tool({ id: "letters", label: "Letters", subtitle: "The writing desk: letters, voice, capsules", group: "boathouse", host: "boathouse", outcome: "buried",
    synonyms: ["letters", "letter", "writing desk", "capsule"],
    target: { kind: "house", target: "letters" }, spaces: "ours", score: 1.5, covers: ["T40"] }),
  tool({ id: "private-folio", label: "Private folio", subtitle: "A folio for what is yours", group: "boathouse", host: "boathouse", outcome: "buried",
    synonyms: ["private", "private folio", "private wish", "personal conservatory"],
    target: { kind: "house", target: "personal-experience" }, spaces: "mine", score: 5.5, covers: ["T45"] }),

  // 7 · Places
  tool({ id: "simple-view", label: "Simple view", subtitle: "The Desk: the same money, flat", group: "places", host: null, outcome: "surface",
    synonyms: ["simple view", "reading", "reading edition", "flat", "desk", "illustrated", "island view", "edition"],
    target: { kind: "action", action: "simple-view" }, spaces: "both", score: 6.2, covers: ["T57"] }),
  tool({ id: "step-in", label: "Step in", subtitle: "Walk into the place you are looking at", group: "places", host: null, outcome: "buried",
    synonyms: ["step in", "look around", "look"],
    target: { kind: "action", action: "step-in" }, spaces: "both", score: 1.3, covers: ["T55"] }),
  tool({ id: "place-square", label: "The square", subtitle: "Paths, gardens and neighbours", group: "places", host: "court", outcome: "buried",
    synonyms: ["square", "village", "town", "town square", "the court", "village map", "quick travel", "harbour", "mountain", "mountain & town"],
    target: { kind: "place", place: "court" }, spaces: "both", score: 3.2, covers: ["T60", "T61"] }),
  tool({ id: "place-bank", label: "The Fund bank", subtitle: "The Queen, the vault and the accounts", group: "places", host: "bank", outcome: "one",
    synonyms: ["fund bank"], target: { kind: "place", place: "bank" }, spaces: "both", score: 3.2, covers: ["T13"] }),
  tool({ id: "place-cellar", label: "The Cellar", subtitle: "Bills downstairs", group: "places", host: "cellar", outcome: "one",
    synonyms: [], target: { kind: "place", place: "cellar" }, spaces: "both", score: 3.2, covers: [] }),
  tool({ id: "place-loft", label: "The Loft", subtitle: "Kitty Banks upstairs", group: "places", host: "tower", outcome: "two",
    synonyms: [], target: { kind: "place", place: "tower" }, spaces: "both", score: 3.2, covers: [] }),
  tool({ id: "place-library", label: "The Library", subtitle: "The Standing Book", group: "places", host: "library", outcome: "two",
    synonyms: [], target: { kind: "place", place: "library" }, spaces: "both", score: 3.2, covers: [] }),
  tool({ id: "place-kitchen", label: "The Kitchen", subtitle: "The kitchen table and the recipe card", group: "places", host: "kitchen", outcome: "two",
    synonyms: [], target: { kind: "place", place: "kitchen" }, spaces: "both", score: 3.2, covers: [] }),
  tool({ id: "place-glasshouse", label: "The Glasshouse", subtitle: "Steps, by state", group: "places", host: "glasshouse", outcome: "two",
    synonyms: [], target: { kind: "place", place: "glasshouse" }, spaces: "both", score: 3.2, covers: [] }),
  tool({ id: "place-campfire", label: "The Campfire", subtitle: "Where the Chapter closes", group: "places", host: "campfire", outcome: "two",
    synonyms: [], target: { kind: "place", place: "campfire" }, spaces: "both", score: 3.2, covers: [] }),
  tool({ id: "place-boathouse", label: "The Boathouse", subtitle: "Wishes, memories and letters", group: "places", host: "boathouse", outcome: "two",
    synonyms: [], target: { kind: "place", place: "boathouse" }, spaces: "both", score: 3.2, covers: [] }),
  tool({ id: "place-atlas", label: "The Atlas", subtitle: "Eras of our island", group: "places", host: "atlas", outcome: "buried",
    synonyms: [], target: { kind: "place", place: "atlas" }, spaces: "both", score: 3.2, covers: [] }),
  tool({ id: "place-kiln", label: "The Kiln", subtitle: "Fire the pieces you shaped", group: "places", host: "kiln", outcome: "buried",
    synonyms: [], target: { kind: "place", place: "kiln" }, spaces: "both", score: 3.2, covers: [] }),
  tool({ id: "place-cottage", label: "Hercules's Cottage", subtitle: "His wardrobe and keepsakes", group: "places", host: "cottage", outcome: "buried",
    synonyms: [], target: { kind: "place", place: "cottage" }, spaces: "both", score: 3.2, covers: [] }),
  tool({ id: "skate", label: "Skate the island", subtitle: "The Skate Club: goals, routes and spots", group: "places", host: null, outcome: "buried",
    synonyms: ["skate", "skate club", "skateboard"],
    target: { kind: "action", action: "skate" }, spaces: "ours", score: 1.8, covers: ["T52"] }),
  tool({ id: "arrange", label: "Arrange room", subtitle: "Move the furniture of the place you are in", group: "places", host: null, outcome: "buried",
    synonyms: ["arrange", "furniture", "decorate"],
    target: { kind: "action", action: "arrange" }, spaces: "ours", score: 1.3, covers: ["T51"] }),
  tool({ id: "wander", label: "A wander", subtitle: "A short walk to somewhere quiet", group: "places", host: null, outcome: "buried",
    synonyms: ["walk", "wander", "walking"],
    target: { kind: "action", action: "wander" }, spaces: "ours", score: 1.3, covers: ["T56"] }),

  // 8 · Settings
  tool({ id: "status", label: "Status", subtitle: "Household, sync, appearance, comfort, privacy", group: "settings", host: null, outcome: "two",
    synonyms: ["status", "settings", "health", "sync", "appearance", "theme", "comfort", "quiet", "export", "backup", "undo", "restore", "invite", "pair", "labels", "queen's look", "record on the left", "always show labels"],
    target: { kind: "tab", tab: "more" }, spaces: "both", score: 6.6, covers: ["T64", "T14", "T62"] }),
  tool({ id: "sign-out", label: "Sign out", subtitle: "Or switch household", group: "settings", host: null, outcome: "buried",
    synonyms: ["sign out", "log out", "switch household", "sign in"],
    target: { kind: "action", action: "sign-out" }, spaces: "both", score: 2.9, covers: ["T65"] }),
  tool({ id: "charter", label: "The charter", subtitle: "What we agreed, and who may do what", group: "settings", host: null, outcome: "buried",
    synonyms: ["charter", "permissions", "founding"],
    target: { kind: "tab", tab: "more", section: "household" }, spaces: "ours", score: 1.8, covers: ["T32"] }),
  tool({ id: "character", label: "Character", subtitle: "Who walks for you on the island", group: "settings", host: null, outcome: "buried",
    synonyms: ["character", "avatar", "choose character"],
    target: { kind: "action", action: "character" }, spaces: "ours", score: 1.4, covers: ["T53"] }),
  tool({ id: "presence", label: "Walk together", subtitle: "Whether your partner sees you on the island", group: "settings", host: null, outcome: "buried",
    synonyms: ["presence", "walk together", "hide me"],
    target: { kind: "action", action: "presence" }, spaces: "ours", score: 1.1, covers: ["T54"] }),

  // Footer · Hercules
  tool({ id: "hercules", label: "Hercules", subtitle: "Talk with him, and his suggestions", group: "hercules", host: null, outcome: "one",
    synonyms: ["hercules", "talk", "suggestion", "suggestions", "companion", "cat", "ask hercules", "workspace"],
    target: { kind: "house", target: "hercules" }, spaces: "both", score: 8.9, covers: ["T46", "T47", "T48"] }),
  tool({ id: "cottage", label: "His Cottage", subtitle: "Wardrobe, looks and keepsakes", group: "hercules", host: "cottage", outcome: "buried",
    synonyms: ["cottage", "dressing room", "wardrobe", "looks", "keepsakes"],
    target: { kind: "house", target: "wardrobe" }, spaces: "ours", score: 1.7, covers: ["T49"] }),
];

const GROUP_BY_ID = new Map(TOOL_GROUPS.map((group) => [group.id, group]));
export const atlasGroup = (id: AtlasGroupId): AtlasGroup => GROUP_BY_ID.get(id)!;

/** Does this tool belong in the space being shown? */
export function atlasToolInSpace(tool: AtlasTool, space: "ours" | "mine"): boolean {
  return tool.spaces === "both" || tool.spaces === space;
}

/** A group's rows, highest score first (§3.2 "rows inside a group are ordered by score"). */
export function toolsInGroup(group: AtlasGroupId, space?: "ours" | "mine"): AtlasTool[] {
  const rows = TOOL_ATLAS.filter((row) => row.group === group && (!space || atlasToolInSpace(row, space)));
  // The Record chips keep the dial's order (nearest the thumb first), never score order.
  if (group === "record") return rows;
  return rows.map((row, index) => ({ row, index })).sort((a, b) => b.row.score - a.row.score || a.index - b.index).map(({ row }) => row);
}

/** The headings the sheet and the Desk drawer render, in order (A4b). */
export function atlasHeadings(): string[] {
  return TOOL_GROUPS.map((group) => group.heading);
}

/** One of the household's own words: a bill, account, Kitty Bank or member name (§3.4). */
export type AtlasHouseholdName = {
  label: string;
  target: AtlasTarget;
  /** Which kind of word it is; picks the group the result shows. */
  kind?: "bill" | "account" | "kitty-bank" | "member";
};

export type AtlasResult = {
  /** Tool id, or `household:<label>` for a household word. */
  id: string;
  label: string;
  subtitle: string;
  group: AtlasGroupId;
  groupHeading: string;
  target: AtlasTarget;
  match: "name" | "synonym" | "household";
  /** Higher is better. Exposed for tests and for a stable tie-break across renders. */
  rank: number;
  tool?: AtlasTool;
};

const HOUSEHOLD_GROUP: Record<NonNullable<AtlasHouseholdName["kind"]>, AtlasGroupId> = {
  bill: "bills-dates",
  account: "fund",
  "kitty-bank": "kitty-banks",
  member: "fund",
};
const HOUSEHOLD_SUBTITLE: Record<NonNullable<AtlasHouseholdName["kind"]>, string> = {
  bill: "A bill, in the Cellar",
  account: "An account, in the Fund bank",
  "kitty-bank": "A Kitty Bank, in the Loft",
  member: "Their contributions, in the Fund bank",
};

/** Lowercase, straight apostrophes, one space, no leading "the ". */
export function normalizeAtlasQuery(value: string): string {
  return value
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^\p{L}\p{N}'&\- ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^the /, "");
}

/**
 * How well one phrase answers the query. 3 exact · 2 the phrase or one of its
 * words starts with it · 1 contains it (three letters or more) · 0 no match.
 */
function phraseMatch(phrase: string, query: string): number {
  const text = normalizeAtlasQuery(phrase);
  if (!text || !query) return 0;
  if (text === query) return 3;
  if (text.startsWith(query) || text.split(" ").some((word) => word.startsWith(query))) return 2;
  if (query.length >= 3 && text.includes(query)) return 1;
  return 0;
}

/**
 * Rank buckets. Name beats synonym beats household word (§3.4) at the same
 * strength; a mere "contains" match is weaker than any exact or prefix match.
 */
const BUCKET = {
  name: { 3: 900, 2: 800, 1: 300 },
  synonym: { 3: 700, 2: 600, 1: 200 },
  household: { 3: 500, 2: 400, 1: 100 },
} as const;

/**
 * Search the atlas by a tool's name, its synonyms, and the household's own
 * words. Returns up to eight results, best first, each with its group. A word
 * that means two things returns both, ranked (A3 asserts the top three).
 */
export function searchAtlas(
  query: string,
  options: { householdNames?: readonly AtlasHouseholdName[]; space?: "ours" | "mine"; limit?: number } = {},
): AtlasResult[] {
  const q = normalizeAtlasQuery(query);
  if (!q) return [];
  const results: AtlasResult[] = [];
  TOOL_ATLAS.forEach((row, index) => {
    if (options.space && !atlasToolInSpace(row, options.space)) return;
    const name = phraseMatch(row.label, q) as 0 | 1 | 2 | 3;
    const synonym = Math.max(0, ...row.synonyms.map((word) => phraseMatch(word, q))) as 0 | 1 | 2 | 3;
    const byName = name ? BUCKET.name[name] : 0;
    const bySynonym = synonym ? BUCKET.synonym[synonym] : 0;
    if (!byName && !bySynonym) return;
    const match = byName >= bySynonym ? "name" : "synonym";
    // The tool's score orders ties inside a bucket; the table index keeps it stable.
    const rank = Math.max(byName, bySynonym) + row.score - index / 1000;
    results.push({ id: row.id, label: row.label, subtitle: row.subtitle, group: row.group, groupHeading: atlasGroup(row.group).heading, target: row.target, match, rank, tool: row });
  });
  const seen = new Set<string>();
  for (const word of options.householdNames ?? []) {
    const strength = phraseMatch(word.label, q) as 0 | 1 | 2 | 3;
    const id = `household:${word.kind ?? "word"}:${word.label}`;
    if (!strength || seen.has(id)) continue;
    seen.add(id);
    const group = word.kind ? HOUSEHOLD_GROUP[word.kind] : "places";
    results.push({ id, label: word.label, subtitle: word.kind ? HOUSEHOLD_SUBTITLE[word.kind] : "", group, groupHeading: atlasGroup(group).heading, target: word.target, match: "household", rank: BUCKET.household[strength] });
  }
  return results.sort((a, b) => b.rank - a.rank).slice(0, options.limit ?? 8);
}

/**
 * Words that retire from screens with §3.2 (and the BUILD-BRIEF's list). The
 * fence test (test/atlas-vocabulary-fence.test.ts) holds rendered copy to it.
 * `pattern` is matched against one rendered string; contextual words ("Together"
 * as a tab, "Play" as a tab, "Household Fund" as a label, "What now" as the
 * figure's name) only match when they are the whole string.
 * Search still finds every one of them through `TOOL_ATLAS` synonyms.
 */
export const RETIRED_WORDS: readonly { word: string; pattern: RegExp; use: string }[] = [
  { word: "Master Planner", pattern: /\bMaster Planner\b/i, use: "Glasshouse · steps" },
  { word: "Our plans", pattern: /\bOur plans\b/, use: "steps" },
  { word: "Plan together", pattern: /\bPlan together\b/, use: "the kitchen table" },
  { word: "Meet the Queen", pattern: /\bMeet the Queen\b/i, use: "the Fund bank" },
  { word: "Add money", pattern: /\bAdd money\b/i, use: "Record" },
  { word: "What now", pattern: /^\s*What now\s*$/, use: "Everyday · now" },
  { word: "Household Fund", pattern: /^\s*Household Fund\s*$/, use: "the Fund" },
  { word: "Next out", pattern: /\bNext out\b/i, use: "Leaving next" },
  { word: "Scheduled to leave", pattern: /\bScheduled to leave\b/i, use: "Leaving" },
  { word: "Close the month", pattern: /\bClose the month\b/i, use: "the Campfire" },
  { word: "check-in", pattern: /\bcheck-in\b/i, use: "the Campfire" },
  { word: "Sit-down", pattern: /\bsit-down\b/i, use: "Sitdown" },
  { word: "Together", pattern: /^\s*Together\s*$/, use: "the Boathouse" },
  { word: "Hearthside", pattern: /\bHearthside\b/, use: "the Boathouse" },
  { word: "Play", pattern: /^\s*Play\s*$/, use: "the Boathouse" },
  { word: "Our Path", pattern: /\bOur Path\b/i, use: "the Atlas / the Journey map" },
  { word: "Atlas nook", pattern: /\bAtlas nook\b/i, use: "the Atlas" },
  { word: "Village map", pattern: /\bVillage map\b/i, use: "Places" },
  { word: "Quick travel", pattern: /\bQuick travel\b/i, use: "Places" },
  { word: "Mountain & town", pattern: /\bMountain (&|and) town\b/i, use: "Places" },
  { word: "Town square", pattern: /\bTown square\b/i, use: "the square" },
  { word: "The Court", pattern: /\bThe Court\b/, use: "the square" },
  { word: "Pay it", pattern: /\bPay it\b/, use: "Mark paid" },
  { word: "cov.", pattern: /\bcov\./, use: "Covered to" },
];

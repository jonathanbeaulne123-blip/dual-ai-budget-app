import { addDays, isValidDateKey, type DateKey } from "./calendar.ts";
import type {
  ChalkNote,
  CosmeticSlot,
  Environment,
  HerculesDesk,
  HerculesLedgerTurn,
  HerculesMemory,
  HerculesMemoryKind,
  HerculesTalkSource,
  HouseholdCompanion,
  HouseholdKitchen,
  Tombstone,
  AccountReconciliation,
  ClosedPeriod,
} from "./types.ts";
import { hasChalkInk, shapeChalkInk } from "./chalkLetters.ts";
import { mergeOpenShift, shapeOpenShift } from "./shiftClock.ts";
import { mergeGames, shapeGames } from "./deskGames.ts";

export const MAX_CHALK_NOTES = 12;
export const MAX_CHALK_CHARS = 160;
export const MAX_COMPANION_NAME = 24;
export const MAX_HERCULES_CHATS = 80;
export const MAX_HERCULES_CHAT_CHARS = 400;
export const MAX_HERCULES_MEMORIES = 24;
export const MAX_HERCULES_MEMORY_CHARS = 160;
export const MAX_HERCULES_MEMORY_LABEL = 48;

export const EMPTY_HERCULES: HerculesDesk = {
  chats: [],
  memories: [],
};

export const EMPTY_COMPANION: HouseholdCompanion = {
  name: "Hercules",
  species: "maine-coon",
  equipped: { hat: null, chain: null, house: null, collar: null },
  updatedAt: "",
};

export const EMPTY_KITCHEN: HouseholdKitchen = {
  chalkboard: [],
  companion: { ...EMPTY_COMPANION },
  books: { reconciliations: [], closedMonths: [] },
  hercules: { ...EMPTY_HERCULES, chats: [], memories: [] },
  openShift: null,
  games: shapeGames(),
};

export function closedPeriodId(monthKey: string): string {
  return `CLOSE-${monthKey}`;
}

const CHALK_PROMPTS = [
  "Leftover chili — do not order in",
  "Hide the good chocolate from future us",
  "Oat milk is not a personality",
  "Jonathan owes the dishwasher a turn",
  "Pizza night is allowed. Twice is a pattern",
  "Text Bianca we already have eggs",
  "Coffee still counts when it is cute",
  "Hydro is due. Be boring on purpose",
  "The good olive oil is for guests. We are the guests",
  "If it is on the porch it is already ours",
  "Do not buy another candle. Light one",
  "Tip-out night: cash the envelope before the treat",
];

function asSlotValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isChalkNote(value: unknown): value is ChalkNote {
  if (!value || typeof value !== "object") return false;
  const note = value as ChalkNote;
  if (!note.id || typeof note.author !== "string") return false;
  if (typeof note.text !== "string") return false;
  return note.text.length > 0 || hasChalkInk(shapeChalkInk(note.ink));
}

function isReconciliation(value: unknown): value is AccountReconciliation {
  if (!value || typeof value !== "object") return false;
  const row = value as AccountReconciliation;
  return Boolean(
    row.id &&
    row.accountId &&
    isValidDateKey(String(row.statementDate || "")) &&
    Number.isFinite(row.statementCents) &&
    Number.isFinite(row.bookCents),
  );
}

function isClosedPeriod(value: unknown): value is ClosedPeriod {
  if (!value || typeof value !== "object") return false;
  const row = value as ClosedPeriod;
  return Boolean(row.monthKey && /^\d{4}-\d{2}$/.test(row.monthKey) && row.closedAt);
}

function isTalkSource(value: unknown): value is HerculesTalkSource {
  return value === "journal" || value === "memory" || value === "local" || value === "ai";
}

function isMemoryKind(value: unknown): value is HerculesMemoryKind {
  return value === "note" || value === "payday" || value === "bill" || value === "habit" || value === "preference";
}

function isHerculesTurn(value: unknown): value is HerculesLedgerTurn {
  if (!value || typeof value !== "object") return false;
  const row = value as HerculesLedgerTurn;
  return Boolean(row.id && (row.role === "user" || row.role === "hercules") && typeof row.text === "string");
}

function isHerculesMemory(value: unknown): value is HerculesMemory {
  if (!value || typeof value !== "object") return false;
  const row = value as HerculesMemory;
  return Boolean(row.id && typeof row.text === "string" && typeof row.label === "string" && isMemoryKind(row.kind));
}

function shapeHerculesDesk(input?: Partial<HerculesDesk> | null): HerculesDesk {
  const chats = Array.isArray(input?.chats)
    ? input.chats.filter(isHerculesTurn).map((row) => ({
      id: row.id,
      role: row.role === "user" ? "user" as const : "hercules" as const,
      text: String(row.text).slice(0, MAX_HERCULES_CHAT_CHARS),
      source: isTalkSource(row.source) ? row.source : "local" as const,
      createdAt: row.createdAt || "",
      createdBy: row.createdBy || "",
    })).slice(-MAX_HERCULES_CHATS)
    : [];
  const memories = Array.isArray(input?.memories)
    ? input.memories.filter(isHerculesMemory).map((row) => ({
      id: row.id,
      kind: row.kind,
      text: String(row.text).slice(0, MAX_HERCULES_MEMORY_CHARS),
      label: String(row.label).slice(0, MAX_HERCULES_MEMORY_LABEL),
      sourceTurnId: row.sourceTurnId || null,
      createdAt: row.createdAt || row.updatedAt || "",
      updatedAt: row.updatedAt || row.createdAt || "",
      createdBy: row.createdBy || "",
    })).slice(-MAX_HERCULES_MEMORIES)
    : [];
  return { chats, memories };
}

export function shapeKitchen(input?: Partial<HouseholdKitchen> | null): HouseholdKitchen {
  const chalkboard = Array.isArray(input?.chalkboard)
    ? input.chalkboard.filter(isChalkNote).map((note) => ({
      id: note.id,
      text: String(note.text).slice(0, MAX_CHALK_CHARS),
      author: note.author,
      createdAt: note.createdAt || note.updatedAt || "",
      updatedAt: note.updatedAt || note.createdAt || "",
      ink: shapeChalkInk(note.ink),
    })).slice(-MAX_CHALK_NOTES)
    : [];
  const equipped = input?.companion?.equipped;
  const rawName = (input?.companion?.name || "").trim().slice(0, MAX_COMPANION_NAME);
  const fromFlame = !input?.companion?.species || input.companion.species === "ember";
  const name = !rawName || (rawName === "Ember" && fromFlame) ? "Hercules" : rawName;
  const reconciliations = Array.isArray(input?.books?.reconciliations)
    ? input.books.reconciliations.filter(isReconciliation).map((row) => ({
      id: row.id,
      accountId: row.accountId,
      statementDate: row.statementDate,
      statementCents: Math.round(row.statementCents),
      bookCents: Math.round(row.bookCents),
      differenceCents: Math.round(row.differenceCents),
      status: row.status === "tied" ? "tied" as const : "open" as const,
      createdAt: row.createdAt || "",
      createdBy: row.createdBy || "",
    })).slice(-24)
    : [];
  const closedMap = new Map<string, ClosedPeriod>();
  if (Array.isArray(input?.books?.closedMonths)) {
    for (const row of input.books.closedMonths.filter(isClosedPeriod)) {
      closedMap.set(row.monthKey, {
        id: row.id || closedPeriodId(row.monthKey),
        monthKey: row.monthKey,
        closedAt: row.closedAt,
        closedBy: row.closedBy || "",
      });
    }
  }
  return {
    chalkboard,
    companion: {
      name,
      species: "maine-coon",
      equipped: {
        hat: asSlotValue(equipped?.hat),
        chain: asSlotValue(equipped?.chain),
        house: asSlotValue(equipped?.house),
        collar: asSlotValue(equipped?.collar),
      },
      updatedAt: input?.companion?.updatedAt || "",
    },
    books: {
      reconciliations,
      closedMonths: [...closedMap.values()].sort((left, right) => left.monthKey.localeCompare(right.monthKey)),
    },
    hercules: shapeHerculesDesk(input?.hercules),
    openShift: shapeOpenShift(input?.openShift),
    games: shapeGames(input?.games),
  };
}

export function mergeKitchen(
  server: HouseholdKitchen | undefined,
  client: HouseholdKitchen | undefined,
  tombstones: Tombstone[],
): HouseholdKitchen {
  const left = shapeKitchen(server);
  const right = shapeKitchen(client);
  const dead = new Set(tombstones.map((tombstone) => tombstone.id));
  const map = new Map<string, ChalkNote>();
  for (const note of [...left.chalkboard, ...right.chalkboard]) {
    if (dead.has(note.id)) continue;
    const existing = map.get(note.id);
    if (!existing || note.updatedAt >= existing.updatedAt) map.set(note.id, note);
  }
  const chalkboard = [...map.values()]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(-MAX_CHALK_NOTES);
  const companion = (right.companion.updatedAt || "") >= (left.companion.updatedAt || "")
    ? right.companion
    : left.companion;
  const recMap = new Map<string, AccountReconciliation>();
  for (const row of [...left.books.reconciliations, ...right.books.reconciliations]) {
    if (dead.has(row.id)) continue;
    const existing = recMap.get(row.id);
    if (!existing || row.createdAt >= existing.createdAt) recMap.set(row.id, row);
  }
  const closedMap = new Map<string, ClosedPeriod>();
  for (const row of [...left.books.closedMonths, ...right.books.closedMonths]) {
    if (dead.has(row.id) || dead.has(closedPeriodId(row.monthKey))) continue;
    const existing = closedMap.get(row.monthKey);
    if (!existing || row.closedAt >= existing.closedAt) closedMap.set(row.monthKey, row);
  }
  const chatMap = new Map<string, HerculesLedgerTurn>();
  for (const row of [...left.hercules.chats, ...right.hercules.chats]) {
    if (dead.has(row.id)) continue;
    const existing = chatMap.get(row.id);
    if (!existing || row.createdAt >= existing.createdAt) chatMap.set(row.id, row);
  }
  const memoMap = new Map<string, HerculesMemory>();
  for (const row of [...left.hercules.memories, ...right.hercules.memories]) {
    if (dead.has(row.id)) continue;
    const existing = memoMap.get(row.id);
    if (!existing || row.updatedAt >= existing.updatedAt) memoMap.set(row.id, row);
  }
  return {
    chalkboard,
    companion,
    books: {
      reconciliations: [...recMap.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-24),
      closedMonths: [...closedMap.values()].sort((a, b) => a.monthKey.localeCompare(b.monthKey)),
    },
    hercules: {
      chats: [...chatMap.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-MAX_HERCULES_CHATS),
      memories: [...memoMap.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-MAX_HERCULES_MEMORIES),
    },
    openShift: mergeOpenShift(left.openShift, right.openShift),
    games: mergeGames(left.games, right.games),
  };
}

export function chalkboardPrompts(today: DateKey): string[] {
  const seed = Number(today.replace(/-/g, "")) || 1;
  const start = seed % CHALK_PROMPTS.length;
  return [0, 1, 2].map((offset) => CHALK_PROMPTS[(start + offset) % CHALK_PROMPTS.length]!);
}

export function dailyDare(today: DateKey): string {
  return chalkboardPrompts(today)[0]!;
}

export type VisitSpark = {
  days: number;
  lastYmd: DateKey | null;
  justCheckedIn: boolean;
};

function visitKey(environment: Environment): string {
  return `hearth:v1:visit:${environment}`;
}

function memory(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function readVisitSpark(environment: Environment): VisitSpark {
  const raw = memory()?.getItem(visitKey(environment));
  if (!raw) return { days: 0, lastYmd: null, justCheckedIn: false };
  try {
    const parsed = JSON.parse(raw) as { days?: number; lastYmd?: string };
    return {
      days: Number(parsed.days) || 0,
      lastYmd: parsed.lastYmd || null,
      justCheckedIn: false,
    };
  } catch {
    return { days: 0, lastYmd: null, justCheckedIn: false };
  }
}

/** Phone-local. Never written into the household snapshot, so Sync cannot spam it. */
export function touchVisitSpark(environment: Environment, today: DateKey): VisitSpark {
  const current = readVisitSpark(environment);
  if (current.lastYmd === today) {
    return { ...current, justCheckedIn: false };
  }
  const consecutive = current.lastYmd === addDays(today, -1) ? current.days + 1 : 1;
  const next: VisitSpark = { days: consecutive, lastYmd: today, justCheckedIn: true };
  memory()?.setItem(visitKey(environment), JSON.stringify({ days: next.days, lastYmd: next.lastYmd }));
  return next;
}

function prefKey(environment: Environment, name: string): string {
  return `hearth:v1:${name}:${environment}`;
}

/** Optional save clink. Off by default. Phone-local, never a household row. */
export function readClinkOn(environment: Environment): boolean {
  return memory()?.getItem(prefKey(environment, "clink")) === "on";
}

export function writeClinkOn(environment: Environment, on: boolean): void {
  memory()?.setItem(prefKey(environment, "clink"), on ? "on" : "off");
}

export function recapSeen(environment: Environment, sunday: DateKey): boolean {
  return memory()?.getItem(prefKey(environment, `recap:${sunday}`)) === "1";
}

export function markRecapSeen(environment: Environment, sunday: DateKey): void {
  memory()?.setItem(prefKey(environment, `recap:${sunday}`), "1");
}

export function duePreviewDismissed(environment: Environment, today: DateKey): boolean {
  return memory()?.getItem(prefKey(environment, `duePreview:${today}`)) === "1";
}

export function dismissDuePreview(environment: Environment, today: DateKey): void {
  memory()?.setItem(prefKey(environment, `duePreview:${today}`), "1");
}

export function isCosmeticSlot(value: string): value is CosmeticSlot {
  return value === "hat" || value === "chain" || value === "house" || value === "collar";
}

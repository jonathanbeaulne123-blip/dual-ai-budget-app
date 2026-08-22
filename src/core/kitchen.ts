import { addDays, type DateKey } from "./calendar.ts";
import type {
  ChalkNote,
  CosmeticSlot,
  Environment,
  HouseholdCompanion,
  HouseholdKitchen,
  Tombstone,
} from "./types.ts";

export const MAX_CHALK_NOTES = 12;
export const MAX_CHALK_CHARS = 80;
export const MAX_COMPANION_NAME = 24;

export const EMPTY_COMPANION: HouseholdCompanion = {
  name: "Ember",
  species: "ember",
  equipped: { hat: null, chain: null, house: null },
  updatedAt: "",
};

export const EMPTY_KITCHEN: HouseholdKitchen = {
  chalkboard: [],
  companion: { ...EMPTY_COMPANION, equipped: { hat: null, chain: null, house: null } },
};

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
  return Boolean(note.id && typeof note.text === "string" && typeof note.author === "string");
}

export function shapeKitchen(input?: Partial<HouseholdKitchen> | null): HouseholdKitchen {
  const chalkboard = Array.isArray(input?.chalkboard)
    ? input.chalkboard.filter(isChalkNote).map((note) => ({
      id: note.id,
      text: String(note.text).slice(0, MAX_CHALK_CHARS),
      author: note.author,
      createdAt: note.createdAt || note.updatedAt || "",
      updatedAt: note.updatedAt || note.createdAt || "",
    })).slice(-MAX_CHALK_NOTES)
    : [];
  const equipped = input?.companion?.equipped;
  return {
    chalkboard,
    companion: {
      name: (input?.companion?.name || "Ember").trim().slice(0, MAX_COMPANION_NAME) || "Ember",
      species: "ember",
      equipped: {
        hat: asSlotValue(equipped?.hat),
        chain: asSlotValue(equipped?.chain),
        house: asSlotValue(equipped?.house),
      },
      updatedAt: input?.companion?.updatedAt || "",
    },
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
  return { chalkboard, companion };
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

export function isCosmeticSlot(value: string): value is CosmeticSlot {
  return value === "hat" || value === "chain" || value === "house";
}

import { askHercules } from "./hercules.ts";
import { talkHercules, type HerculesTalk } from "./herculesTalk.ts";
import {
  HERCULES_REFUSE_SHAME,
  HERCULES_REFUSE_SQL,
  HERCULES_REFUSE_WRITE,
} from "./herculesPersonality.ts";
import {
  MAX_HERCULES_MEMORY_CHARS,
  MAX_HERCULES_MEMORY_LABEL,
} from "./kitchen.ts";
import type { DateKey } from "./calendar.ts";
import type { HearthTab } from "./hercules.ts";
import type {
  HerculesMemory,
  HerculesMemoryKind,
  HerculesTalkSource,
  Household,
} from "./types.ts";

const SQL_WRITE = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE)\b/i;
const SHAME = /\b(who spent (more|less)|bianca (spent|wasted)|jonathan (spent|wasted))\b/i;
/** Topics answered from the books. Default talk topic "ask" is unmatched — that may hit a vendor model. */
const JOURNAL_TOPICS = new Set([
  "identity",
  "opinion",
  "wallet",
  "health",
  "bills",
  "forecast",
  "cook",
  "postcard",
  "recap",
  "fieldwork",
  "high-five",
  "coach",
  "why",
  "notice",
]);

export type HerculesDraft = {
  kind: "expense" | "income" | "shift" | "transfer";
  note: string;
  subcategoryId?: string;
};

export type ExtractedMemory = {
  kind: HerculesMemoryKind;
  text: string;
  label: string;
};

export type HerculesMemoryView = {
  kind: HerculesMemoryKind;
  label: string;
};

export type HerculesPlan = {
  talk: HerculesTalk;
  source: HerculesTalkSource;
  memory: ExtractedMemory | null;
  draft: HerculesDraft | null;
  skipModel: boolean;
};

export function ledgerChats(household: Household) {
  return household.kitchen.hercules?.chats ?? [];
}

export function ledgerMemories(household: Household): HerculesMemory[] {
  return household.kitchen.hercules?.memories ?? [];
}

/** Labels only. Dollar amounts become "CAD" so a model cannot harvest a second ledger. */
export function memoryLabelForModel(text: string): string {
  return text
    .replace(/\$[\d,]+(?:\.\d{2})?/g, "CAD")
    .replace(/\b\d+\.\d{2}\b/g, "CAD")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_HERCULES_MEMORY_LABEL);
}

export function memoryLabelsForModel(household: Household): string[] {
  return memoriesForModel(household).map((row) => row.label);
}

export function memoriesForModel(household: Household): HerculesMemoryView[] {
  return ledgerMemories(household)
    .slice(-12)
    .map((row) => ({ kind: row.kind, label: row.label }))
    .filter((row) => row.label);
}

export function formatMemoriesForModel(memories: HerculesMemoryView[]): string {
  if (!memories.length) return "(none)";
  return memories.map((row) => `${row.kind}: ${row.label}`).join("\n");
}

const MEMORY_KIND_BY_TOPIC: Record<string, HerculesMemoryKind[]> = {
  bills: ["bill", "payday", "habit", "preference", "note"],
  calendar: ["bill", "payday", "habit", "preference", "note"],
  mail: ["bill", "payday", "habit", "preference", "note"],
  forecast: ["payday", "habit", "bill", "preference", "note"],
  shift: ["payday", "habit", "bill", "preference", "note"],
  cook: ["habit", "preference", "note", "payday", "bill"],
  morning: ["habit", "preference", "note", "payday", "bill"],
};

/** On-device consumer: surface the most relevant kitchen memory for a talk topic. */
export function topicUsesKitchenMemories(topic: string): boolean {
  return topic in MEMORY_KIND_BY_TOPIC;
}

export function memoryFactForTopic(
  household: Household,
  topic: string,
): { label: string; value: string } | null {
  const mems = ledgerMemories(household);
  if (!mems.length) return null;
  const kindOrder = MEMORY_KIND_BY_TOPIC[topic] ?? ["note", "payday", "bill", "habit", "preference"];
  for (const kind of kindOrder) {
    const row = [...mems].reverse().find((item) => item.kind === kind);
    if (row) return { label: row.kind, value: row.label };
  }
  return null;
}

export function extractHerculesMemory(message: string): ExtractedMemory | null {
  const raw = message.trim();
  if (!raw || SQL_WRITE.test(raw) || SHAME.test(raw.toLowerCase())) return null;
  const match = raw.match(/^(?:remember(?: that| this)?|don't forget|dont forget|keep in mind)\s*[:\-–]?\s*(.+)$/i);
  if (!match?.[1]) return null;
  const text = match[1].trim().slice(0, MAX_HERCULES_MEMORY_CHARS);
  if (text.length < 3) return null;
  const lower = text.toLowerCase();
  const kind: HerculesMemoryKind = /\b(payday|paid thursday|get paid)\b/.test(lower)
    ? "payday"
    : /\b(bill|due|hydro|rent)\b/.test(lower)
      ? "bill"
      : /\b(habit|every|usually)\b/.test(lower)
        ? "habit"
        : /\b(prefer|don't like|dont like)\b/.test(lower)
          ? "preference"
          : "note";
  return { kind, text, label: memoryLabelForModel(text) };
}

function proposeDraft(message: string): HerculesDraft | null {
  const q = message.trim().toLowerCase().replace(/['’]/g, "");
  if (SQL_WRITE.test(q) || /\bpay it for me\b/.test(q)) return null;
  if (!/\b(add|post|log|buy)\b/.test(q)) return null;
  if (/\b(milk|grocer)/.test(q)) {
    return { kind: "expense", note: "Milk", subcategoryId: "SUB-FOOD-GROCERIES" };
  }
  if (/\bcoffee\b/.test(q)) {
    return { kind: "expense", note: "Coffee", subcategoryId: "SUB-FOOD-COFFEE" };
  }
  if (/\bshift\b/.test(q)) return { kind: "shift", note: "" };
  return null;
}

function isRecall(message: string): boolean {
  const q = message.trim().toLowerCase().replace(/['’]/g, "");
  return /\b(what did i (tell|ask)|what do you remember|your (notes|memories)|did i (say|tell you)|remember what)\b/.test(q);
}

function lineTalk(spoken: string, lesson: string, topic: string, replies: string[]): HerculesTalk {
  return {
    spoken,
    lesson,
    fact: null,
    replies,
    pose: "loaf",
    topic,
    attention: false,
  };
}

export function planHerculesTurn(
  household: Household,
  question: string,
  today: DateKey,
  tab: HearthTab = "home",
  lastTopic = "",
): HerculesPlan {
  const q = question.trim();
  const extracted = extractHerculesMemory(q);
  if (extracted) {
    return {
      talk: lineTalk(
        `Kept in the kitchen ledger. Same door as the milk. "${extracted.label}"`,
        "I remember on the books, not at a model shop.",
        "memory",
        ["What do you remember?", "We good?"],
      ),
      source: "memory",
      memory: extracted,
      draft: null,
      skipModel: true,
    };
  }

  const lower = q.toLowerCase().replace(/['’]/g, "");
  if (SQL_WRITE.test(q)) {
    return {
      talk: lineTalk(HERCULES_REFUSE_SQL, "I read. You write SQL you meant.", "ask", ["We good?"]),
      source: "local",
      memory: null,
      draft: null,
      skipModel: true,
    };
  }
  if (SHAME.test(lower)) {
    return {
      talk: lineTalk(HERCULES_REFUSE_SHAME, "Household totals only.", "ask", ["We good?", "What's on the Visa?"]),
      source: "local",
      memory: null,
      draft: null,
      skipModel: true,
    };
  }

  const draft = proposeDraft(q);
  if (draft) {
    return {
      talk: lineTalk(
        HERCULES_REFUSE_WRITE,
        "Safe write: I open Add. Confirm still posts. I never call postEntry.",
        "add",
        ["Milk", "We good?"],
      ),
      source: "journal",
      memory: null,
      draft,
      skipModel: true,
    };
  }

  if (isRecall(q)) {
    const mems = ledgerMemories(household);
    const spoken = mems.length
      ? `I kept ${mems.length} note${mems.length === 1 ? "" : "s"} in the kitchen ledger: ${mems.map((row) => row.label).slice(-3).join("; ")}.`
      : "Empty notebook. Say “remember …” and I’ll keep it next to the milk.";
    return {
      talk: {
        ...lineTalk(spoken, "Notes live in the snapshot. Same sync, same tombstones, same door.", "memory", ["Remember payday is Thursday", "We good?"]),
        fact: mems[0] ? { label: mems[0].kind, value: mems[0].label } : null,
      },
      source: "memory",
      memory: null,
      draft: null,
      skipModel: true,
    };
  }

  const talk = talkHercules(household, q, today, tab, lastTopic);
  const ask = askHercules(household, q, today);
  const fromBooks = ask.kind === "answer" || JOURNAL_TOPICS.has(talk.topic);
  return {
    talk,
    source: fromBooks ? "journal" : "local",
    memory: null,
    draft: null,
    // Model-first (D-104): grounded talk is the fallback, not the default exit.
    skipModel: false,
  };
}

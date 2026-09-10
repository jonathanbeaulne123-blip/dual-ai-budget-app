import { addDays, hourInToronto, monthKeyFromDateKey, type DateKey } from "./calendar.ts";
import { monthSummary } from "./budget.ts";
import { companionMood, type CompanionMood } from "./companion.ts";
import { cookOffScore, type HearthTab } from "./hercules.ts";
import { auditOpinion, liquidityWatch } from "./statements.ts";
import { householdWallet } from "./accounts.ts";
import { formatCad } from "./money.ts";
import type { Household } from "./types.ts";

export const HERCULES_REFUSE_WRITE = "I can help prepare that. Review the details and use Final Confirm before it is saved.";
export const HERCULES_REFUSE_SHAME = "Not a scoreboard. I won't name who spent.";
export const HERCULES_REFUSE_SQL = "I read. I don't write SQL you didn't mean.";

const WRITE_CLAIM =
  /\b(i(?:'ve| have)?|we)\s+(just\s+)?(posted|logged|saved|recorded|wrote|inserted|updated|deleted|paid)\b/i;
const SQL_WRITE =
  /\b(?:INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|(?:DROP|ALTER|CREATE|TRUNCATE)\s+(?:TABLE|DATABASE|SCHEMA|INDEX)|GRANT\s+\w+\s+ON|REVOKE\s+\w+\s+ON)\b/i;
const SHAME = /\b(who spent|who paid more|bianca vs|jonathan vs|(?:bianca|jonathan)\s+(spent|wasted|blew|overspent))\b/i;
const MODEL_LEAK =
  /\b(as an ai|language model|i(?:'m| am) (?:an? )?(?:ai|language model|large language|assistant))\b/gi;
/** Worker prompt labels. If the model echoes them, fall back to grounded speech. */
const PROMPT_ECHO =
  /\b(GROUNDED JOURNAL|ON-DEVICE NOTICES|HOUSEHOLD DATA|LEDGER MEMOR(?:Y|IES)|the only CAD you may speak|dollar facts)\b/i;
const FIGURES_HEADING = /^\s*FIGURES\b/i;

export function askedCardMismatch(message: string, reply: string): boolean {
  const q = String(message || "").toLowerCase();
  const r = String(reply || "").toLowerCase();
  if (!q || !r) return false;
  const visaQ = /\bvisa\b/.test(q);
  const mcQ = /\bmaster\s*card\b/.test(q);
  if (visaQ && /\bmaster\s*card\b/.test(r) && !/\bvisa\b/.test(r)) return true;
  if (mcQ && /\bvisa\b/.test(r) && !/\bmaster\s*card\b/.test(r)) return true;
  return false;
}

const LOCAL_FLAVOR = ["mrrp.", "prrrp.", "from the counter:", "listen.", "tail flick."];

export type HerculesBriefing = {
  name: string;
  page: HearthTab;
  mood: CompanionMood;
  netCad: string;
  monthInCad: string;
  monthOutCad: string;
  healthFindings: number;
  billsDueSoon: string[];
  groceryToday: boolean;
  cookOff: "kitchen" | "takeout" | "tie";
  torontoHour: number;
  opinion: string;
  trialInBalance: boolean;
  equationHolds: boolean;
  goingConcern: string;
  workingCapitalCad: string;
  chequingCad: string;
  cardsOwedCad: string;
  hottestUtilizationPct: number | null;
};

export type HerculesGrounded = {
  spoken: string;
  lesson?: string | null;
  fact?: { label: string; value: string } | null;
};

function groceryPostedToday(household: Household, today: DateKey): boolean {
  return household.transactions.some(
    (tx) =>
      !tx.isDuplicate &&
      tx.date === today &&
      tx.type === "expense" &&
      tx.subcategoryId === "SUB-FOOD-GROCERIES",
  );
}

function billsDueSoon(household: Household, today: DateKey): string[] {
  const until = addDays(today, 3);
  return household.recurrences
    .filter((item) => item.active && item.type === "expense" && item.nextDate <= until)
    .sort((left, right) => left.nextDate.localeCompare(right.nextDate))
    .slice(0, 3)
    .map((item) => item.note?.trim() || "a bill");
}

export function herculesBriefing(
  household: Household,
  page: HearthTab,
  today: DateKey,
  now = new Date(),
): HerculesBriefing {
  const name = household.kitchen.companion.name || "Hercules";
  const { mood } = companionMood(household, today, name);
  const month = monthSummary(household, monthKeyFromDateKey(today));
  const opinion = auditOpinion(household);
  const liq = liquidityWatch(household, today);
  const wallet = householdWallet(household, today);
  const chequing = wallet.tiles.find((tile) => tile.kind === "chequing");
  return {
    name,
    page,
    mood,
    netCad: formatCad(month.netActualCents),
    monthInCad: formatCad(month.incomeActualCents),
    monthOutCad: formatCad(month.expenseActualCents),
    healthFindings: opinion.healthFindings,
    billsDueSoon: billsDueSoon(household, today),
    groceryToday: groceryPostedToday(household, today),
    cookOff: cookOffScore(household, today).winner,
    torontoHour: hourInToronto(now),
    opinion: opinion.kind,
    trialInBalance: opinion.trialInBalance,
    equationHolds: opinion.equationHolds,
    goingConcern: liq.goingConcern,
    workingCapitalCad: formatCad(liq.workingCapital.workingCapitalCents),
    chequingCad: formatCad(chequing?.balanceCents ?? wallet.cashCents),
    cardsOwedCad: formatCad(wallet.owedCents),
    hottestUtilizationPct: wallet.hottestCard?.utilization == null ? null : Math.round(wallet.hottestCard.utilization * 100),
  };
}

/** Compact aggregates for the model. No transaction dump, no tokens, no who-spent. */
export function formatHerculesBriefing(briefing: HerculesBriefing, memories: Array<{ kind: string; label: string }> = []): string {
  const bills = briefing.billsDueSoon.length ? briefing.billsDueSoon.join(", ") : "none";
  const lines = [
    `${briefing.name}. Toronto kitchen. CAD. America/Toronto.`,
    `page: ${briefing.page}`,
    `mood: ${briefing.mood}`,
    `net this month: ${briefing.netCad}`,
    `in: ${briefing.monthInCad}`,
    `out: ${briefing.monthOutCad}`,
    `health findings: ${briefing.healthFindings}`,
    `bills due soon: ${bills}`,
    `grocery posted today: ${briefing.groceryToday ? "yes" : "no"}`,
    `cook-off: ${briefing.cookOff}`,
    `hour: ${briefing.torontoHour}`,
    `opinion: ${briefing.opinion}`,
    `trial in balance: ${briefing.trialInBalance ? "yes" : "no"}`,
    `equation A=L+E: ${briefing.equationHolds ? "yes" : "no"}`,
    `going-concern watch: ${briefing.goingConcern}`,
    `working capital: ${briefing.workingCapitalCad}`,
    `chequing: ${briefing.chequingCad}`,
    `cards owed: ${briefing.cardsOwedCad}`,
    `hottest utilization: ${briefing.hottestUtilizationPct == null ? "n/a" : `${briefing.hottestUtilizationPct}%`}`,
  ];
  if (memories.length) {
    lines.push(`kitchen memories: ${memories.map((row) => `${row.kind}: ${row.label}`).join("; ")}`);
  }
  return lines.join("\n");
}

function clipReply(text: string, max = 6000): string {
  const trimmed = text.replace(/[^\S\n]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max - 1);
  const sentence = [...cut.matchAll(/[.!?](?=\s|$)/g)].at(-1)?.index;
  if (sentence !== undefined && sentence > 80) return cut.slice(0, sentence + 1);
  const space = cut.lastIndexOf(" ");
  return `${cut.slice(0, space > 80 ? space : max - 1).replace(/[,:;.–-]$/, "")}…`;
}

export function sanitizeHerculesReply(
  text: string,
  groundedSpeak = "",
  allowedFigures: string[] = [],
  asked = "",
): string {
  let reply = String(text || "").replace(/[^\S\n]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (!reply) {
    return clipReply(groundedSpeak) || "What would you like help with?";
  }
  if (SQL_WRITE.test(reply) || /```/.test(reply) || /\bSELECT\b.+\bFROM\b/i.test(reply)) {
    return HERCULES_REFUSE_SQL;
  }
  if (SHAME.test(reply) || (/\bwho spent more\b/i.test(reply) && /\b(bianca|jonathan)\b/i.test(reply))) {
    return HERCULES_REFUSE_SHAME;
  }
  if (WRITE_CLAIM.test(reply)) {
    return groundedSpeak
      ? clipReply(`I can prepare a change for your review. ${groundedSpeak}`)
      : HERCULES_REFUSE_WRITE;
  }
  reply = reply.replace(MODEL_LEAK, "I'm a cat");
  reply = reply.replace(/\bI(?:'ll| will) (post|log|save|record|write) (it|that|this|them)\b/gi, "I can prepare that for your review");
  if (PROMPT_ECHO.test(reply) || FIGURES_HEADING.test(reply) || askedCardMismatch(asked, reply)) {
    return clipReply(groundedSpeak) || "mrrp. I only quote the books.";
  }
  if (allowedFigures.length) {
    const allowed = new Set(allowedFigures);
    const found = [...reply.matchAll(/\$\d[\d,]*(?:\.\d{2})?/g)].map((match) => match[0]);
    if (found.some((figure) => !allowed.has(figure))) {
      return clipReply(groundedSpeak) || "mrrp. I only quote the books.";
    }
  } else if (/\$\d/.test(reply)) {
    return clipReply(groundedSpeak) || "mrrp. I only quote the books.";
  }
  return clipReply(reply);
}

/** Keep a model's grounded tool narration from adding a new numeric fact. */
export function sanitizeGroundedNumerals(text: string, fallback: string, ...groundedParts: string[]): string {
  const numerals = (value: string) => [...String(value || "").matchAll(/\b\d+(?:[.,]\d+)?%?/g)].map((match) => match[0]);
  const allowed = new Set(numerals([fallback, ...groundedParts].join(" ")));
  if (numerals(text).some((value) => !allowed.has(value))) return clipReply(fallback);
  return text;
}

function flavorIndex(text: string, n: number): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return hash % n;
}

export function localHerculesChat(
  message: string,
  briefing: HerculesBriefing,
  grounded: HerculesGrounded,
  preferences: readonly { key: string; value: unknown }[] = [],
  context: readonly { role: string; text: string }[] = [],
): string {
  const preference = (key: string) => preferences.find(row => row.key === key)?.value;
  const format = (text: string) => {
    if (preference("answerLength") === "concise") return text.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");
    if (preference("explanationStyle") === "step-by-step") { const parts = text.split(/(?<=[.!?])\s+/); if (parts.length > 1) return parts.map((part, i) => `${i + 1}. ${part}`).join("\n"); }
    return text;
  };
  const quietHumour = preferences.some(row => row.key === "humour" && row.value === "off");
  const q = message.trim().toLowerCase().replace(/['’]/g, "");
  if (/\b(post (it|this|that)|log this|write it|insert into|pay it for me|save this (expense|row))\b/.test(q)) {
    return HERCULES_REFUSE_WRITE;
  }
  if (/\bwho spent\b/.test(q) || /\bwho paid more\b/.test(q) || /\b(bianca|jonathan) (spent|wasted)\b/.test(q)) {
    return HERCULES_REFUSE_SHAME;
  }
  if (/\b(stressed|overwhelmed|scared|anxious|worried)\b/.test(q)) return "We can take this one step at a time. Would it help to look at what's due first, or would you like a moment to talk?";
  const recentUser = [...context].reverse().find(turn => turn.role === "user" && !/^(why|and|what about|tell me more)\b/i.test(turn.text))?.text.toLowerCase() ?? "";
  if (/\b(privately|personal ledger|private spending)\b/.test(q) && /\b(partner|their|bianca|jonathan)\b/.test(q)) return "Their Personal ledger belongs to them. I can help with the shared records you can see here.";
  if (/\b(definitely spend|safe to spend|spend all)\b/.test(q)) return "A plan is a projection, not a guarantee. We can review recorded bills and what may be missing before you decide.";
  if (/\b(finished setting up|what now)\b/.test(q)) return "Welcome in. We can enter a grocery, look at upcoming bills, or explore your plan. Pick one under How can I help? and I’ll walk with you.";
  if (/\b(havent opened|been away|long time)\b/.test(q)) return "There you are. Make yourself comfortable. We can start with what’s useful today; there’s no catching up with me to do.";
  if (/\b(nap|napping|windowsill|sunbeam)\b/.test(q) || (/^(why|tell me more|what about)\b/.test(q) && /\b(nap|napping|windowsill|sunbeam)\b/.test(recentUser))) return format(/^why\b/.test(q) ? (quietHumour ? "The windowsill is warm and quiet. A good place to rest." : "Warmth, a view, and absolutely no meetings. The windowsill has excellent management.") : /(?:what about|rain|cold)/.test(q) ? "Then I’d choose a soft blanket near you. The weather can make its own arrangements." : "A warm windowsill, with a soft blanket nearby. I like to keep my options luxurious.");
  if (/\b(glasses|cape|keep that look)\b/.test(q) && /\b(outfit|dress|wardrobe|cape)\b/.test(recentUser)) return "The glasses would suit the cape beautifully. Try the pieces in Hercules outfits; use Wear this there when you’re happy. We haven’t saved a look from this conversation.";
  if (/\b(ridiculous|love it)\b/.test(q) && (/\b(you look|outfit|cape|glasses|dress)\b/.test(q) || (/^(?:ridiculous[.! ]*|(?:i )?love it[.! ]*)$/.test(q) && /\b(outfit|cape|glasses|dress)\b/.test(recentUser)))) return quietHumour ? "I’m glad you like it. We can keep exploring looks." : "Ridiculous? I prefer magnificently overdressed. I’m delighted you approve.";
  if (/^(hi|hey|hello)( hercules)?[!. ]*$/.test(q)) return quietHumour ? "There you are. What's on your mind?" : "There you are. I was keeping your seat warm. What's on your mind?";
  if (/\b(dont know what to do|how can you help|what can you do)\b/.test(q)) return "Come sit with me. You can ask me to explain a number, look at what's due, or talk through a plan. Or we can just chat. My schedule is mostly naps.";
  if (/\b(outfit|dress|dressed|wardrobe|closet|cape|glasses)\b/.test(q)) return "Finally. An appointment that respects my talents. You'll find my wardrobe in More on this desk, under Hercules outfits.";
  if (/\b(thank you|thanks)\b/.test(q)) return quietHumour ? "Any time. I’m here when you need me." : "Any time. I'll be here, looking indispensable.";
  if (/\b(dont understand|explain this page|lost on this page)\b/.test(q)) return `Let’s find your bearings. You’re on ${briefing.page === "ledger" ? "Books" : briefing.page}. Open How can I help? and choose Explain this page for a tour of its main actions.`;
  if (/\b(help me enter|enter groceries|record groceries)\b/.test(q)) return "Let’s start a grocery entry. Choose an entry under How can I help?, then Expense. You’ll review the amount and account before Confirm records anything.";
  if (/\b(pay this card|pay .*for me)\b/.test(q)) return "I can help you prepare a transfer record, but I cannot pay the bank. Choose an entry under How can I help?, then Transfer, and review the details before Confirm.";
  if (/\b(before payday)\b/.test(q)) return "What date is payday? In Shared, open Calendar to review recorded bills. If Choose payday is available under How can I help?, enter the date there so we can use the right window.";
  if (/\b(other one|other card)\b/.test(q)) return "Which account do you mean? Choose it under How can I help? so we can look at the right source.";
  if (/\b(can you still help)\b/.test(q)) return "Yes. We can use the records on this device and the choices under How can I help? Conversation saving has its own status below; a local reply does not mean it has synced.";
  const spoken = grounded.spoken?.trim() || "I'm here. Scratch — say hi — or ask a number.";
  if (/^(mrrp|prrrp|from the counter|listen|tail flick)/i.test(spoken)) {
    return sanitizeHerculesReply(spoken, spoken);
  }
  if (spoken === "Hercules reads. He doesn't write. Ask a number.") return "I’m here. Tell me a little more, or pick something under How can I help? We can work through it together.";
  const purr = LOCAL_FLAVOR[flavorIndex(`${q}|${briefing.mood}|${briefing.page}`, LOCAL_FLAVOR.length)]!;
  const answer = sanitizeHerculesReply(!quietHumour && flavorIndex(q, 5) === 0 ? `${purr} ${spoken}` : spoken, spoken);
  return format(preference("answerLength") === "detailed" && grounded.lesson && !answer.includes(grounded.lesson) ? `${answer}\n\n${grounded.lesson}` : answer);
}

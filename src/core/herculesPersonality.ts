import { addDays, hourInToronto, monthKeyFromDateKey, type DateKey } from "./calendar.ts";
import { monthSummary } from "./budget.ts";
import { companionMood, type CompanionMood } from "./companion.ts";
import { cookOffScore, type HearthTab } from "./hercules.ts";
import { auditOpinion, liquidityWatch } from "./statements.ts";
import { householdWallet } from "./accounts.ts";
import { formatCad } from "./money.ts";
import type { Household } from "./types.ts";

export const HERCULES_REFUSE_WRITE = "I don't write the books. Tell the kitchen what to post.";
export const HERCULES_REFUSE_SHAME = "Not a scoreboard. I won't name who spent.";
export const HERCULES_REFUSE_SQL = "I read. I don't write SQL you didn't mean.";

const WRITE_CLAIM =
  /\b(i(?:'ve| have)?|we)\s+(just\s+)?(posted|logged|saved|recorded|wrote|inserted|updated|deleted|paid)\b/i;
const SQL_WRITE =
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE)\b/i;
const SHAME = /\b(bianca|jonathan)\s+(spent|wasted|blew|overspent)\b/i;
const MODEL_LEAK =
  /\b(as an ai|language model|i(?:'m| am) (?:an? )?(?:ai|language model|large language|assistant))\b/gi;

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

function clipReply(text: string, max = 360): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${cut.slice(0, space > 80 ? space : max - 1).replace(/[,:;.–-]$/, "")}…`;
}

export function sanitizeHerculesReply(text: string, groundedSpeak = "", allowedFigures: string[] = []): string {
  let reply = String(text || "").replace(/\s+/g, " ").trim();
  if (!reply) {
    return clipReply(groundedSpeak) || "mrrp. Ask a number. I don't write.";
  }
  if (SQL_WRITE.test(reply) || /```/.test(reply) || /\bSELECT\b.+\bFROM\b/i.test(reply)) {
    return HERCULES_REFUSE_SQL;
  }
  if (SHAME.test(reply) || (/\bwho spent more\b/i.test(reply) && /\b(bianca|jonathan)\b/i.test(reply))) {
    return HERCULES_REFUSE_SHAME;
  }
  if (WRITE_CLAIM.test(reply)) {
    return groundedSpeak
      ? clipReply(`I don't post. ${groundedSpeak}`)
      : HERCULES_REFUSE_WRITE;
  }
  reply = reply.replace(MODEL_LEAK, "I'm a cat");
  reply = reply.replace(/\bI(?:'ll| will) (post|log|save|record|write) (it|that|this|them)\b/gi, "I don't write");
  if (allowedFigures.length) {
    const allowed = new Set(allowedFigures);
    const found = [...reply.matchAll(/\$\d[\d,]*(?:\.\d{2})?/g)].map((match) => match[0]);
    if (found.some((figure) => !allowed.has(figure))) {
      return clipReply(groundedSpeak) || "mrrp. I only quote the books.";
    }
  }
  return clipReply(reply);
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
): string {
  const q = message.trim().toLowerCase().replace(/['’]/g, "");
  if (/\b(post (it|this|that)|log this|write it|insert into|pay it for me|save this (expense|row))\b/.test(q)) {
    return HERCULES_REFUSE_WRITE;
  }
  if (/\bwho spent (more|less)\b/.test(q) || /\b(bianca|jonathan) (spent|wasted)\b/.test(q)) {
    return HERCULES_REFUSE_SHAME;
  }
  const spoken = grounded.spoken?.trim() || "I'm here. Scratch me or ask a number.";
  if (/^(mrrp|prrrp|from the counter|listen|tail flick)/i.test(spoken)) {
    return sanitizeHerculesReply(spoken, spoken);
  }
  const purr = LOCAL_FLAVOR[flavorIndex(`${q}|${briefing.mood}|${briefing.page}`, LOCAL_FLAVOR.length)]!;
  return sanitizeHerculesReply(`${purr} ${spoken}`, spoken);
}

import { monthKeyFromDateKey, type DateKey } from "./calendar.ts";
import { monthSummary } from "./budget.ts";
import { formatCad } from "./money.ts";
import {
  appointmentPublicTitle,
  claimPublicLabel,
} from "./appointments.ts";
import { composeNotices, type HerculesNotice } from "./notices.ts";
import type { HerculesBriefing, HerculesGrounded } from "./herculesPersonality.ts";
import { formatHerculesBriefing } from "./herculesPersonality.ts";
import type { Appointment, Claim, Household, Transaction } from "./types.ts";

const RECENT_TX_LIMIT = 36;
const CATEGORY_LIMIT = 12;
const CLAIM_LIMIT = 8;
const VISIT_LIMIT = 6;
const NOTICE_LIMIT = 8;

export type QuietSecrets = {
  titles: string[];
  practitioners: string[];
  places: string[];
  appointmentIds: Set<string>;
  claimIds: Set<string>;
};

export type HerculesLedgerExcerpt = {
  recent: Array<{ date: string; type: string; amount: string; note: string; place: string; category: string }>;
  monthByCategory: Array<{ name: string; amount: string; type: string }>;
  claims: Array<{ label: string; status: string; expected: string; ageDays: number }>;
  visits: Array<{ title: string; nextDate: string; typical: string }>;
};

export type HerculesNoticeView = {
  key: string;
  kind: HerculesNotice["kind"];
  spoken: string;
  cad: string | null;
  action: HerculesNotice["action"];
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function quietSecrets(household: Household): QuietSecrets {
  const titles: string[] = [];
  const practitioners: string[] = [];
  const places: string[] = [];
  const appointmentIds = new Set<string>();
  const claimIds = new Set<string>();
  for (const appointment of household.appointments ?? []) {
    if (appointment.sensitivity !== "quiet") continue;
    appointmentIds.add(appointment.id);
    if (appointment.title.trim()) titles.push(appointment.title.trim());
    if (appointment.practitioner.trim()) practitioners.push(appointment.practitioner.trim());
    if (appointment.place.trim()) places.push(appointment.place.trim());
  }
  for (const claim of household.claims ?? []) {
    if (!claim.appointmentId || !appointmentIds.has(claim.appointmentId)) continue;
    claimIds.add(claim.id);
    if (claim.label.trim()) titles.push(claim.label.trim());
  }
  return { titles, practitioners, places, appointmentIds, claimIds };
}

export function scrubQuietText(text: string, secrets: QuietSecrets): string {
  const needles = [...secrets.titles, ...secrets.practitioners, ...secrets.places]
    .map((item) => item.trim())
    .filter((item) => item.length >= 3)
    .sort((left, right) => right.length - left.length);
  let out = String(text || "");
  for (const needle of needles) {
    out = out.replace(new RegExp(escapeRegExp(needle), "gi"), "");
  }
  return out.replace(/\s+/g, " ").trim();
}

function quietLinkedTx(tx: Transaction, secrets: QuietSecrets): boolean {
  if (tx.source === "visit" && tx.sourceId && (secrets.appointmentIds.has(tx.sourceId) || secrets.claimIds.has(tx.sourceId))) {
    return true;
  }
  const hay = `${tx.note} ${tx.place}`.toLowerCase();
  return secrets.titles.some((title) => title.length >= 3 && hay.includes(title.toLowerCase()));
}

function publicVisitTitle(appointment: Appointment): string {
  return appointmentPublicTitle(appointment, "hercules");
}

function categoryLabel(household: Household, subcategoryId: string | null, secrets: QuietSecrets): string {
  const category = household.categories.find((item) => item.id === subcategoryId);
  const name = category?.name ?? "";
  const scrubbed = scrubQuietText(name, secrets);
  return scrubbed || (category?.parentId === "CAT-HEALTH" ? "Health" : "category");
}

export function cadFiguresIn(text: string): string[] {
  return [...String(text || "").matchAll(/\$\d[\d,]*(?:\.\d{2})?/g)].map((match) => match[0]);
}

export function collectAllowedFigures(...parts: Array<string | null | undefined>): string[] {
  const found = new Set<string>();
  for (const part of parts) {
    for (const figure of cadFiguresIn(part ?? "")) found.add(figure);
  }
  return [...found];
}

function redactedNote(household: Household, tx: Transaction, secrets: QuietSecrets): string {
  if (quietLinkedTx(tx, secrets)) {
    const claim = tx.sourceId ? household.claims.find((row) => row.id === tx.sourceId) : undefined;
    const appointmentId = claim?.appointmentId ?? (tx.sourceId && secrets.appointmentIds.has(tx.sourceId) ? tx.sourceId : null);
    const appointment = appointmentId ? household.appointments.find((row) => row.id === appointmentId) : undefined;
    if (appointment) return publicVisitTitle(appointment);
    return "the visit";
  }
  return scrubQuietText(tx.note, secrets) || tx.type;
}

export function buildLedgerExcerpt(household: Household, today: DateKey): HerculesLedgerExcerpt {
  const secrets = quietSecrets(household);
  const recent = [...household.transactions]
    .filter((tx) => !tx.isDuplicate)
    .sort((left, right) => right.date.localeCompare(left.date) || right.createdAt.localeCompare(left.createdAt))
    .slice(0, RECENT_TX_LIMIT)
    .map((tx) => ({
      date: tx.date,
      type: tx.type,
      amount: formatCad(tx.amountCents),
      note: redactedNote(household, tx, secrets),
      place: quietLinkedTx(tx, secrets) ? "" : scrubQuietText(tx.place, secrets),
      category: categoryLabel(household, tx.subcategoryId, secrets),
    }));

  const month = monthSummary(household, monthKeyFromDateKey(today));
  const monthByCategory = [...month.categories]
    .filter((row) => row.actualCents !== 0)
    .sort((left, right) => Math.abs(right.actualCents) - Math.abs(left.actualCents))
    .slice(0, CATEGORY_LIMIT)
    .map((row) => ({
      name: scrubQuietText(row.name, secrets) || (row.groupName === "Health" ? "Health" : "category"),
      amount: formatCad(row.actualCents),
      type: row.type,
    }));

  const claims = (household.claims ?? [])
    .filter((claim: Claim) => claim.status !== "settled" && claim.status !== "denied")
    .slice(0, CLAIM_LIMIT)
    .map((claim) => {
      const expense = household.transactions.find((tx) => tx.id === claim.expenseTransactionId);
      const start = expense?.date ?? claim.createdAt.slice(0, 10);
      return {
        label: scrubQuietText(claimPublicLabel(household, claim, "hercules"), secrets) || "a claim",
        status: claim.status,
        expected: formatCad(claim.expectedCents),
        ageDays: Math.max(0, (Date.parse(`${today}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86400000),
      };
    });

  const visits = [...(household.appointments ?? [])]
    .filter((item) => item.active)
    .sort((left, right) => left.nextDate.localeCompare(right.nextDate))
    .slice(0, VISIT_LIMIT)
    .map((item) => ({
      title: publicVisitTitle(item),
      nextDate: item.nextDate,
      typical: formatCad(item.typicalCostCents),
    }));

  return { recent, monthByCategory, claims, visits };
}

export function noticeViews(household: Household, today: DateKey): HerculesNoticeView[] {
  return composeNotices(household, today)
    .slice(0, NOTICE_LIMIT)
    .map((item) => ({
      key: item.key,
      kind: item.kind,
      spoken: item.spoken,
      cad: item.cad,
      action: item.action,
    }));
}

export function composeHerculesChatRequest(
  household: Household,
  message: string,
  briefing: HerculesBriefing,
  grounded: HerculesGrounded,
  today: DateKey,
): {
  message: string;
  briefing: HerculesBriefing;
  grounded: HerculesGrounded;
  householdId: string;
  memories: string[];
  notices: HerculesNoticeView[];
  ledger: HerculesLedgerExcerpt;
  figures: string[];
} {
  const secrets = quietSecrets(household);
  const ledger = buildLedgerExcerpt(household, today);
  const notices = noticeViews(household, today);
  const briefingText = formatHerculesBriefing(briefing);
  const figures = collectAllowedFigures(
    briefingText,
    grounded.spoken,
    grounded.lesson,
    grounded.fact?.value,
    ...notices.map((item) => item.cad),
    ...notices.map((item) => item.spoken),
    ...ledger.recent.map((row) => row.amount),
    ...ledger.monthByCategory.map((row) => row.amount),
    ...ledger.claims.map((row) => row.expected),
    ...ledger.visits.map((row) => row.typical),
  );
  return {
    message: scrubQuietText(message, secrets) || message.trim(),
    householdId: household.householdId,
    briefing,
    grounded: {
      spoken: scrubQuietText(grounded.spoken, secrets) || grounded.spoken,
      lesson: grounded.lesson ? scrubQuietText(grounded.lesson, secrets) || grounded.lesson : grounded.lesson,
      fact: grounded.fact
        ? {
            label: scrubQuietText(grounded.fact.label, secrets) || grounded.fact.label,
            value: grounded.fact.value,
          }
        : grounded.fact,
    },
    memories: (household.kitchen.hercules?.memories ?? [])
      .map((row) => row.label)
      .filter(Boolean)
      .slice(-12)
      .map((label) => scrubQuietText(label, secrets) || label),
    notices,
    ledger,
    figures,
  };
}

export function payloadContainsQuietSecret(payload: string, household: Household): boolean {
  const secrets = quietSecrets(household);
  const hay = payload.toLowerCase();
  return [...secrets.titles, ...secrets.practitioners, ...secrets.places]
    .filter((item) => item.trim().length >= 3)
    .some((item) => hay.includes(item.toLowerCase()));
}

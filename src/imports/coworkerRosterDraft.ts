import { normalizeCoworkerName } from "../core/coworkers.ts";
import type { EvidenceDerivedDetail } from "./evidenceClient.ts";

export type CoworkerRosterDraftRow = {
  displayName: string;
  roleLabel?: string;
  sourceIdentityKey: string | null;
  source: "seven-shifts-roster" | "seven-shifts-schedule";
  scheduledWindows?: Array<{
    sourceScheduleKey: string;
    date: string;
    scheduledStart: string | null;
    scheduledEnd: string | null;
    observedAt: string;
  }>;
};

export type CoworkerRosterImportDraft = {
  jobId: string;
  locationName: string;
  rows: CoworkerRosterDraftRow[];
  /** Present only after the member says this capture is complete for the range. */
  replaceScheduleRange?: { fromDate: string; toDate: string };
};

/** Reduces owner-read Evidence observations to a bounded roster review draft. */
export function coworkerRosterDraft(detail: EvidenceDerivedDetail | null | undefined): CoworkerRosterDraftRow[] {
  if (!detail) return [];
  const derivativeByCanonical = new Map(detail.derivatives.map((item) => {
    const facts = item.facts && typeof item.facts === "object" ? item.facts as {
      bundleFacts?: { providerResourceKind?: unknown; providerSubjectKey?: unknown; startedAt?: unknown; endedAt?: unknown; observedAt?: unknown };
    } : {};
    const kind = facts.bundleFacts?.providerResourceKind;
    const source = kind === "coworker-roster"
      ? "seven-shifts-roster"
      : kind === "coworker-schedule" ? "seven-shifts-schedule" : null;
    const subject = typeof facts.bundleFacts?.providerSubjectKey === "string"
      && !facts.bundleFacts.providerSubjectKey.startsWith("s7subject_unbound_")
      ? facts.bundleFacts.providerSubjectKey
      : null;
    const startedAt = typeof facts.bundleFacts?.startedAt === "string" && Number.isFinite(Date.parse(facts.bundleFacts.startedAt))
      ? new Date(facts.bundleFacts.startedAt).toISOString() : null;
    const endedAt = typeof facts.bundleFacts?.endedAt === "string" && Number.isFinite(Date.parse(facts.bundleFacts.endedAt))
      ? new Date(facts.bundleFacts.endedAt).toISOString() : null;
    const observedAt = typeof facts.bundleFacts?.observedAt === "string" && Number.isFinite(Date.parse(facts.bundleFacts.observedAt))
      ? new Date(facts.bundleFacts.observedAt).toISOString() : item.createdAt;
    return [item.canonicalShiftKey, { source, sourceIdentityKey: subject, startedAt, endedAt, observedAt }] as const;
  }));
  const byCanonical = new Map<string, { displayName?: string; roleLabel?: string; date?: string }>();
  for (const item of detail.observations.slice(0, 10_000)) {
    if (!item.canonicalShiftKey || !derivativeByCanonical.get(item.canonicalShiftKey)?.source
      || !["coworkerName", "observedRole", "date"].includes(item.field)) continue;
    const value = typeof item.value === "string" ? item.value.replace(/\s+/g, " ").trim().slice(0, 80) : "";
    if (!value) continue;
    const row = byCanonical.get(item.canonicalShiftKey) ?? {};
    if (item.field === "coworkerName") row.displayName = value;
    if (item.field === "observedRole") row.roleLabel = value;
    if (item.field === "date" && /^\d{4}-\d{2}-\d{2}$/.test(value)) row.date = value;
    byCanonical.set(item.canonicalShiftKey, row);
  }
  const result = new Map<string, CoworkerRosterDraftRow>();
  for (const [canonicalShiftKey, row] of byCanonical) {
    if (!row.displayName) continue;
    const derivative = derivativeByCanonical.get(canonicalShiftKey)!;
    const key = derivative.sourceIdentityKey
      ? `${derivative.sourceIdentityKey}:${normalizeCoworkerName(row.displayName)}`
      : `unbound:${derivative.source}:${normalizeCoworkerName(row.displayName)}`;
    if (!key) continue;
    const existing = result.get(key);
    const next = existing ?? {
      displayName: row.displayName,
      ...(row.roleLabel ? { roleLabel: row.roleLabel } : {}),
      sourceIdentityKey: derivative.sourceIdentityKey,
      source: derivative.source!,
      scheduledWindows: [],
    };
    if (derivative.source === "seven-shifts-schedule" && /^s7shift_[A-Za-z0-9_-]{20,112}$/.test(canonicalShiftKey)) {
      const date = row.date ?? "";
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) next.scheduledWindows = [
        ...(next.scheduledWindows ?? []),
        {
          sourceScheduleKey: canonicalShiftKey,
          date,
          scheduledStart: derivative.startedAt,
          scheduledEnd: derivative.endedAt,
          observedAt: derivative.observedAt,
        },
      ].slice(0, 366);
    }
    result.set(key, next);
    if (result.size >= 500) break;
  }
  return [...result.values()].sort((left, right) => left.displayName.localeCompare(right.displayName)
    || String(left.sourceIdentityKey).localeCompare(String(right.sourceIdentityKey)));
}

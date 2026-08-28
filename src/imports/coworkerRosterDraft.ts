import { normalizeCoworkerName } from "../core/coworkers.ts";
import type { EvidenceDerivedDetail } from "./evidenceClient.ts";

export type CoworkerRosterDraftRow = {
  displayName: string;
  roleLabel?: string;
  sourceIdentityKey: string | null;
  source: "seven-shifts-roster" | "seven-shifts-schedule";
};

/** Reduces owner-read Evidence observations to a bounded roster review draft. */
export function coworkerRosterDraft(detail: EvidenceDerivedDetail | null | undefined): CoworkerRosterDraftRow[] {
  if (!detail) return [];
  const derivativeByCanonical = new Map(detail.derivatives.map((item) => {
    const facts = item.facts && typeof item.facts === "object" ? item.facts as {
      bundleFacts?: { providerResourceKind?: unknown; providerSubjectKey?: unknown };
    } : {};
    const kind = facts.bundleFacts?.providerResourceKind;
    const source = kind === "coworker-roster"
      ? "seven-shifts-roster"
      : kind === "coworker-schedule" ? "seven-shifts-schedule" : null;
    const subject = typeof facts.bundleFacts?.providerSubjectKey === "string"
      && !facts.bundleFacts.providerSubjectKey.startsWith("s7subject_unbound_")
      ? facts.bundleFacts.providerSubjectKey
      : null;
    return [item.canonicalShiftKey, { source, sourceIdentityKey: subject }] as const;
  }));
  const byCanonical = new Map<string, { displayName?: string; roleLabel?: string }>();
  for (const item of detail.observations.slice(0, 10_000)) {
    if (!item.canonicalShiftKey || !derivativeByCanonical.get(item.canonicalShiftKey)?.source
      || !["coworkerName", "observedRole"].includes(item.field)) continue;
    const value = typeof item.value === "string" ? item.value.replace(/\s+/g, " ").trim().slice(0, 80) : "";
    if (!value) continue;
    const row = byCanonical.get(item.canonicalShiftKey) ?? {};
    if (item.field === "coworkerName") row.displayName = value;
    if (item.field === "observedRole") row.roleLabel = value;
    byCanonical.set(item.canonicalShiftKey, row);
  }
  const seen = new Set<string>();
  const result: CoworkerRosterDraftRow[] = [];
  for (const [canonicalShiftKey, row] of byCanonical) {
    if (!row.displayName) continue;
    const derivative = derivativeByCanonical.get(canonicalShiftKey)!;
    const key = derivative.sourceIdentityKey
      ? `${derivative.sourceIdentityKey}:${normalizeCoworkerName(row.displayName)}`
      : `unbound:${derivative.source}:${normalizeCoworkerName(row.displayName)}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push({
      displayName: row.displayName,
      ...(row.roleLabel ? { roleLabel: row.roleLabel } : {}),
      sourceIdentityKey: derivative.sourceIdentityKey,
      source: derivative.source!,
    });
    if (result.length >= 500) break;
  }
  return result.sort((left, right) => left.displayName.localeCompare(right.displayName)
    || String(left.sourceIdentityKey).localeCompare(String(right.sourceIdentityKey)));
}

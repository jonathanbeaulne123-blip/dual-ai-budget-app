import type { ReactNode } from "react";
import { formatZoneDateTime, relativeTimeAgo } from "./core/calendar.ts";
import type { DiscoveredHousehold } from "./ledger/supabase.ts";
import type { HouseholdReplicaSummary } from "./storage.ts";

export type HouseholdEntryCardModel = {
  householdId: string;
  memberId: string | null;
  householdName: string;
  memberName: string | null;
  lastEditedIso: string | null;
  lastEditedRelative: string;
  lastEditedExact: string;
};

export type HouseholdEntryTarget = Pick<HouseholdEntryCardModel, "householdId" | "memberId">;

export function discoveredHouseholdForTarget(
  found: DiscoveredHousehold[],
  target: HouseholdEntryTarget,
): DiscoveredHousehold | null {
  if (!target.householdId || !target.memberId) return null;
  return found.find((row) => (
    row.household.householdId === target.householdId
    && row.memberId === target.memberId
  )) ?? null;
}

export type InviteFlowState =
  | "idle"
  | "awaiting-google"
  | "redeeming"
  | "refreshing"
  | "ready"
  | "error";

function validEditTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

export function formatHouseholdEditedAt(
  value: string | null | undefined,
  now: Date,
  timeZone: string,
): Pick<HouseholdEntryCardModel, "lastEditedIso" | "lastEditedRelative" | "lastEditedExact"> {
  const time = validEditTime(value);
  if (time === null) {
    return {
      lastEditedIso: null,
      lastEditedRelative: "No edits yet",
      lastEditedExact: "No accepted household edit has been recorded.",
    };
  }
  const date = new Date(time);
  return {
    lastEditedIso: date.toISOString(),
    lastEditedRelative: `Edited ${relativeTimeAgo(date.toISOString(), now)}`,
    lastEditedExact: formatZoneDateTime(date, timeZone),
  };
}

function compareModels(left: HouseholdEntryCardModel, right: HouseholdEntryCardModel): number {
  const leftTime = validEditTime(left.lastEditedIso) ?? Number.NEGATIVE_INFINITY;
  const rightTime = validEditTime(right.lastEditedIso) ?? Number.NEGATIVE_INFINITY;
  if (leftTime !== rightTime) return rightTime - leftTime;
  return left.householdName.localeCompare(right.householdName);
}

export function discoveredHouseholdCardModels(
  found: DiscoveredHousehold[],
  now: Date,
  timeZone: string,
): HouseholdEntryCardModel[] {
  const byHousehold = new Map<string, HouseholdEntryCardModel>();
  for (const row of found) {
    const member = row.household.members.find((item) => item.id === row.memberId);
    byHousehold.set(row.household.householdId, {
      householdId: row.household.householdId,
      memberId: row.memberId,
      householdName: row.household.name,
      memberName: member?.name ?? "Member",
      ...formatHouseholdEditedAt(row.household.lastCommittedAt, now, timeZone),
    });
  }
  return [...byHousehold.values()].sort(compareModels);
}

export function replicaHouseholdCardModels(
  replicas: HouseholdReplicaSummary[],
  now: Date,
  timeZone: string,
): HouseholdEntryCardModel[] {
  return replicas.map((replica) => ({
    householdId: replica.householdId,
    memberId: null,
    householdName: replica.name,
    memberName: null,
    ...formatHouseholdEditedAt(replica.updatedAt, now, timeZone),
  })).sort(compareModels);
}

export function inviteFlowMessage(state: InviteFlowState): string {
  switch (state) {
    case "awaiting-google":
      return "Continue with Google to accept this invitation.";
    case "redeeming":
      return "Accepting your invitation…";
    case "refreshing":
      return "Invitation accepted. Refreshing your households…";
    case "ready":
      return "Invitation accepted. Your household is ready to open.";
    case "error":
      return "The invitation needs attention. Your existing books were not changed.";
    default:
      return "Paste the Google invitation link you received, or scan its QR code.";
  }
}

export function HouseholdEntryCard({
  model,
  busy,
  current = false,
  highlighted = false,
  onOpen,
  actions,
}: {
  model: HouseholdEntryCardModel;
  busy: boolean;
  current?: boolean;
  highlighted?: boolean;
  onOpen: (target: HouseholdEntryTarget) => void;
  actions?: ReactNode;
}) {
  const safeId = model.householdId.replace(/[^a-zA-Z0-9_-]/g, "-");
  const timeId = `household-edited-${safeId}`;
  const openLabel = current ? "Current household" : `Open ${model.householdName}`;
  return (
    <article className={`household-entry-card${highlighted ? " household-entry-card--highlighted" : ""}${current ? " household-entry-card--current" : ""}`}>
      {highlighted && <p className="household-entry-card__ready" role="status">Invitation accepted · ready to open</p>}
      <button
        type="button"
        className="household-entry-card__open"
        disabled={busy || current}
        autoFocus={highlighted}
        aria-describedby={timeId}
        aria-label={openLabel}
        data-household-id={model.householdId}
        data-member-id={model.memberId ?? undefined}
        onClick={() => onOpen({ householdId: model.householdId, memberId: model.memberId })}
      >
        <span className="household-entry-card__name">{model.householdName}</span>
        {model.memberName && <span className="household-entry-card__member">{model.memberName}</span>}
        <span className="household-entry-card__relative">
          {model.lastEditedIso ? <time dateTime={model.lastEditedIso}>{model.lastEditedRelative}</time> : model.lastEditedRelative}
        </span>
        <span id={timeId} className="household-entry-card__exact">
          {model.lastEditedIso ? <time dateTime={model.lastEditedIso}>{model.lastEditedExact}</time> : model.lastEditedExact}
        </span>
        <span className="household-entry-card__action">{openLabel}</span>
      </button>
      {actions && <div className="household-entry-card__actions">{actions}</div>}
    </article>
  );
}

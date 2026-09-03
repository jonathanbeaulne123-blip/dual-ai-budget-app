import type { Environment, Household, Member } from "../types.ts";
import { ONBOARDING_REGISTRY_VERSION } from "./registry.ts";

export const HANDSHAKE_WINDOW_MINUTES = 15;

export const ONBOARDING_MODE_COPY = {
  "invite.explain": "This puts both of us in setup mode until we finish or stop. Three sittings, about an hour all in — we can stop between any of them.",
  "invite.waiting": "Waiting for {name} to say yes on their device.",
  "invite.expired": "That invitation expired. Start it again whenever you're both ready.",
  "stop.recorded": "Setup stopped. Nothing was marked done — we can pick it up whenever.",
} as const;

export type OnboardingModeState =
  | "inactive"
  | "offered"
  | "handshake-pending"
  | "active"
  | "paused-safe"
  | "waiting-member"
  | "blocked"
  | "adopting"
  | "stopped-incomplete"
  | "complete"
  | "repair";

export type HouseholdOnboarding = {
  id: string;
  environment: Environment;
  householdId: string;
  registryVersion: number;
  state: OnboardingModeState;
  proposedByMemberId: string | null;
  proposedAt: string | null;
  handshakeExpiresAt: string | null;
  confirmedByMemberIds: string[];
  startedAt: string | null;
  stoppedAt: string | null;
  stoppedByMemberIds: string[];
  stoppedSolo: boolean;
  forcedUnlock: boolean;
  completedAt: string | null;
  completionDigest: string | null;
  createdAt: string;
  updatedAt: string;
};

const MODE_STATES = new Set<OnboardingModeState>([
  "inactive",
  "offered",
  "handshake-pending",
  "active",
  "paused-safe",
  "waiting-member",
  "blocked",
  "adopting",
  "stopped-incomplete",
  "complete",
  "repair",
]);

function isoOrNull(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim() || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function uniqueIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === "string" && Boolean(id.trim())).map((id) => id.trim()))].sort();
}

function laterIso(left: string | null, right: string | null): string | null {
  if (!left) return right;
  if (!right) return left;
  return left >= right ? left : right;
}

function earlierIso(left: string | null, right: string | null): string | null {
  if (!left) return right;
  if (!right) return left;
  return left <= right ? left : right;
}

function activeMemberIds(members: readonly Member[]): string[] {
  return [...new Set(members.filter((member) => member.active).map((member) => member.id))].sort();
}

function containsEveryActiveMember(memberIds: readonly string[], members: readonly Member[]): boolean {
  const required = activeMemberIds(members);
  const present = new Set(memberIds);
  return required.length >= 2 && required.every((memberId) => present.has(memberId));
}

export function shapeHouseholdOnboarding(value: unknown): HouseholdOnboarding | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<HouseholdOnboarding> & { state?: unknown };
  if (typeof row.id !== "string" || !row.id.trim()) return null;
  if (row.environment !== "development" && row.environment !== "production") return null;
  if (typeof row.householdId !== "string" || !row.householdId.trim()) return null;

  const registryVersion = Number.isInteger(row.registryVersion) && Number(row.registryVersion) >= 0
    ? Number(row.registryVersion)
    : 0;
  const rawState = MODE_STATES.has(row.state as OnboardingModeState)
    ? row.state as OnboardingModeState
    : "blocked";
  const state = registryVersion === ONBOARDING_REGISTRY_VERSION ? rawState : "repair";
  const createdAt = isoOrNull(row.createdAt) ?? "1970-01-01T00:00:00.000Z";

  return {
    id: row.id.trim(),
    environment: row.environment,
    householdId: row.householdId.trim(),
    registryVersion,
    state,
    proposedByMemberId: typeof row.proposedByMemberId === "string" && row.proposedByMemberId.trim()
      ? row.proposedByMemberId.trim()
      : null,
    proposedAt: isoOrNull(row.proposedAt),
    handshakeExpiresAt: isoOrNull(row.handshakeExpiresAt),
    confirmedByMemberIds: uniqueIds(row.confirmedByMemberIds),
    startedAt: isoOrNull(row.startedAt),
    stoppedAt: isoOrNull(row.stoppedAt),
    stoppedByMemberIds: uniqueIds(row.stoppedByMemberIds),
    stoppedSolo: row.stoppedSolo === true,
    forcedUnlock: row.forcedUnlock === true,
    completedAt: isoOrNull(row.completedAt),
    completionDigest: typeof row.completionDigest === "string" && row.completionDigest.trim()
      ? row.completionDigest.trim()
      : null,
    createdAt,
    updatedAt: isoOrNull(row.updatedAt) ?? createdAt,
  };
}

export function acceptedHouseholdOnboarding(household: Pick<Household, "environment" | "householdId" | "householdOnboarding">): HouseholdOnboarding | null {
  const row = shapeHouseholdOnboarding(household.householdOnboarding);
  if (!row || row.environment !== household.environment || row.householdId !== household.householdId) return null;
  return row;
}

export function onboardingIsActive(household: Household): boolean {
  const row = acceptedHouseholdOnboarding(household);
  return row?.state === "active" && !row.forcedUnlock;
}

export function ordinaryHerculesAvailable(household: Household): boolean {
  const row = acceptedHouseholdOnboarding(household);
  if (!row || row.forcedUnlock) return true;
  return !new Set<OnboardingModeState>(["active", "paused-safe", "waiting-member", "blocked", "adopting", "repair"]).has(row.state);
}

export function handshakeExpired(row: HouseholdOnboarding, nowIso: string): boolean {
  const expiresAt = isoOrNull(row.handshakeExpiresAt);
  const now = isoOrNull(nowIso);
  if (!expiresAt || !now) return true;
  return now >= expiresAt;
}

export function onboardingRecordId(household: Pick<Household, "environment" | "householdId">): string {
  return `ONBOARDING-${household.environment}-${household.householdId}`;
}

type OnboardingMergeContext = Pick<Household, "environment" | "householdId"> & { members: readonly Member[] };

function rowForContext(value: unknown, context: OnboardingMergeContext): HouseholdOnboarding | null {
  const row = shapeHouseholdOnboarding(value);
  if (!row || row.environment !== context.environment || row.householdId !== context.householdId) return null;
  return row;
}

function proposalKey(row: HouseholdOnboarding): string {
  return `${row.proposedAt ?? ""}|${row.handshakeExpiresAt ?? ""}|${row.proposedByMemberId ?? ""}`;
}

export function mergeHouseholdOnboarding(
  serverValue: unknown,
  clientValue: unknown,
  context: OnboardingMergeContext,
): HouseholdOnboarding | null {
  const server = rowForContext(serverValue, context);
  const client = rowForContext(clientValue, context);
  if (!server) return client;
  if (!client) return server;
  if (server.id !== client.id || proposalKey(server) !== proposalKey(client)) {
    const serverKey = `${server.proposedAt ?? ""}|${server.updatedAt}|${server.id}`;
    const clientKey = `${client.proposedAt ?? ""}|${client.updatedAt}|${client.id}`;
    return clientKey >= serverKey ? client : server;
  }

  const newer = client.updatedAt >= server.updatedAt ? client : server;
  const confirmedByMemberIds = uniqueIds([...server.confirmedByMemberIds, ...client.confirmedByMemberIds]);
  const stoppedByMemberIds = uniqueIds([...server.stoppedByMemberIds, ...client.stoppedByMemberIds]);
  const completedAt = laterIso(server.completedAt, client.completedAt);
  const completionDigest = newer.completionDigest ?? server.completionDigest ?? client.completionDigest;
  const stoppedAt = laterIso(server.stoppedAt, client.stoppedAt);
  const updatedAt = laterIso(server.updatedAt, client.updatedAt) ?? newer.updatedAt;
  const completed = (server.state === "complete" || client.state === "complete") && Boolean(completedAt && completionDigest);
  const forcedUnlock = server.forcedUnlock || client.forcedUnlock;
  const stoppedSolo = server.stoppedSolo || client.stoppedSolo;
  const stoppedTogether = containsEveryActiveMember(stoppedByMemberIds, context.members);
  const confirmedTogether = containsEveryActiveMember(confirmedByMemberIds, context.members);
  const existingStartedAt = earlierIso(server.startedAt, client.startedAt);

  let state: OnboardingModeState = newer.state;
  let startedAt = existingStartedAt;
  if (server.state === "repair" || client.state === "repair") state = "repair";
  else if (completed) state = "complete";
  else if (forcedUnlock || stoppedSolo || stoppedTogether) state = "stopped-incomplete";
  else if (stoppedByMemberIds.length > 0) state = "waiting-member";
  else if (confirmedTogether) {
    state = "active";
    startedAt = existingStartedAt ?? updatedAt;
  } else if (state === "active" || state === "complete" || state === "stopped-incomplete") {
    state = "blocked";
  }

  return {
    ...newer,
    state,
    confirmedByMemberIds,
    startedAt,
    stoppedAt,
    stoppedByMemberIds,
    stoppedSolo,
    forcedUnlock,
    completedAt: completed ? completedAt : null,
    completionDigest: completed ? completionDigest : null,
    createdAt: earlierIso(server.createdAt, client.createdAt) ?? newer.createdAt,
    updatedAt,
  };
}

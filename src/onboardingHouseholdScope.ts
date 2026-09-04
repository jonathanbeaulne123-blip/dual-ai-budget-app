import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { createAccountFlowGate } from "./auth/accountFlow.ts";
import {
  SUPABASE_SESSION_CHANGED_EVENT,
  authenticatedSupabaseConfig,
  ensureSupabaseSession,
  loadSupabaseSession,
  type HearthSupabaseSession,
} from "./auth/supabaseSession.ts";
import type { GoogleIdentitySelector } from "./core/google.ts";
import {
  householdScopeRef,
  type HouseholdScopeObservation,
} from "./core/onboarding/householdScope.ts";
import type { Household } from "./core/types.ts";
import {
  listHouseholdAccess,
  type HouseholdAccessResult,
} from "./ledger/householdInvites.ts";
import {
  listActiveContinuityMemberships,
  readSupabaseConfig,
  type ContinuityMembershipSummary,
  type SupabaseConfig,
} from "./ledger/supabase.ts";

export type HouseholdScopeProbeInput = {
  household: Household;
  memberId: string;
  /** Null means no household has been selected; never choose among several. */
  selectedHouseholdId?: string | null;
};

export type HouseholdScopeProbeAdapters = {
  loadSession: (environment: Household["environment"]) => HearthSupabaseSession | null;
  ensureSession: (environment: Household["environment"]) => Promise<HearthSupabaseSession | null>;
  readConfig: () => SupabaseConfig | null;
  listMemberships: (input: {
    identity: GoogleIdentitySelector;
    environment: Household["environment"];
    config: SupabaseConfig | null;
  }) => Promise<ContinuityMembershipSummary[]>;
  listAccess: (input: {
    environment: Household["environment"];
    householdId: string;
    config: SupabaseConfig | null;
  }) => Promise<HouseholdAccessResult>;
  isOnline: () => boolean;
  now: () => string;
};

const DEFAULT_ADAPTERS: HouseholdScopeProbeAdapters = {
  loadSession: loadSupabaseSession,
  ensureSession: ensureSupabaseSession,
  readConfig: readSupabaseConfig,
  listMemberships: listActiveContinuityMemberships,
  listAccess: listHouseholdAccess,
  isOnline: () => typeof navigator === "undefined" || navigator.onLine !== false,
  now: () => new Date().toISOString(),
};

function accessFailure(reason: string): "missing-auth" | "revoked-membership" | "probe-failed" {
  const normalized = reason.toLowerCase();
  if (normalized.includes("unauth") || normalized.includes("session-not-live")) return "missing-auth";
  if (
    normalized.includes("revok")
    || normalized.includes("not-member")
    || normalized.includes("device-not-found")
    || normalized.includes("device-not-authorized")
  ) return "revoked-membership";
  return "probe-failed";
}

/**
 * Perform the Chapter 2 live read and return only sanitized facts. Tokens,
 * email, sibling household ids, device ids, and audit rows never cross this
 * boundary.
 */
export async function probeHouseholdScope(
  input: HouseholdScopeProbeInput,
  adapters: HouseholdScopeProbeAdapters = DEFAULT_ADAPTERS,
  isCurrent: () => boolean = () => true,
): Promise<HouseholdScopeObservation> {
  const selectedHouseholdId = input.selectedHouseholdId === undefined
    ? input.household.householdId
    : input.selectedHouseholdId;
  const initialScope = householdScopeRef(input.household, input.memberId, selectedHouseholdId);
  const blocked = (reason: Extract<HouseholdScopeObservation, { kind: "blocked" }>["reason"]): HouseholdScopeObservation => ({
    kind: "blocked",
    scope: initialScope,
    reason,
  });

  const cached = adapters.loadSession(input.household.environment);
  if (!cached) return blocked("missing-auth");
  if (!adapters.isOnline()) return blocked("offline-cached-identity");

  try {
    const session = await adapters.ensureSession(input.household.environment);
    if (!isCurrent()) return blocked("scope-changed");
    if (!session) return blocked("missing-auth");

    const identity = { subject: session.googleSubject, email: session.email };
    const config = authenticatedSupabaseConfig(adapters.readConfig(), session);
    if (!config?.accessToken) return blocked("missing-auth");

    const memberships = await adapters.listMemberships({
      identity,
      environment: input.household.environment,
      config,
    });
    if (!isCurrent()) return blocked("scope-changed");
    if (!adapters.isOnline()) return blocked("offline-cached-identity");

    const resolvedHouseholdId = selectedHouseholdId
      ?? (memberships.length === 1 ? memberships[0]!.householdId : null);
    if (!resolvedHouseholdId) return blocked("ambiguous-household-scope");
    if (resolvedHouseholdId !== input.household.householdId) return blocked("scope-changed");

    const membership = memberships.find((row) => row.householdId === resolvedHouseholdId);
    if (!membership || membership.memberId !== input.memberId) return blocked("revoked-membership");

    const access = await adapters.listAccess({
      environment: input.household.environment,
      householdId: resolvedHouseholdId,
      config,
    });
    if (!isCurrent()) return blocked("scope-changed");
    if (!adapters.isOnline()) return blocked("offline-cached-identity");
    if (!access.ok) return blocked(accessFailure(access.reason));
    if (access.access.currentMemberId !== input.memberId) return blocked("revoked-membership");
    const expectedSeats = [...new Set(input.household.members
      .filter((member) => member.active)
      .map((member) => member.id))].sort();
    const liveSeats = [...new Set(access.access.members.map((member) => member.memberId))].sort();
    if (
      expectedSeats.length !== 2
      || liveSeats.length !== 2
      || expectedSeats.some((memberId, index) => memberId !== liveSeats[index])
    ) {
      return blocked("missing-partner-membership");
    }

    return {
      kind: "resolved",
      scope: {
        environment: input.household.environment,
        householdId: resolvedHouseholdId,
        memberId: input.memberId,
      },
      currentMemberId: access.access.currentMemberId,
      seatMemberIds: liveSeats,
      observedAt: adapters.now(),
    };
  } catch {
    return blocked(adapters.isOnline() ? "probe-failed" : "offline-cached-identity");
  }
}

export type HouseholdScopeProbeControl = {
  observation: HouseholdScopeObservation | null;
  retry: () => void;
};

export function useHouseholdScopeProbe(
  input: HouseholdScopeProbeInput & { active: boolean },
  adapters: HouseholdScopeProbeAdapters = DEFAULT_ADAPTERS,
): HouseholdScopeProbeControl {
  const gate = useRef(createAccountFlowGate());
  const [retryRevision, refresh] = useReducer((value: number) => value + 1, 0);
  const retry = useCallback(() => refresh(), []);
  const selectedHouseholdId = input.selectedHouseholdId === undefined
    ? input.household.householdId
    : input.selectedHouseholdId;
  const scopeKey = `${input.household.environment}:${selectedHouseholdId ?? "unselected"}:${input.memberId}`;
  const scope = useMemo(
    () => householdScopeRef(input.household, input.memberId, selectedHouseholdId),
    [scopeKey],
  );
  const [observation, setObservation] = useState<HouseholdScopeObservation | null>(
    input.active ? { kind: "checking", scope } : null,
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    window.addEventListener("online", retry);
    window.addEventListener(SUPABASE_SESSION_CHANGED_EVENT, retry);
    return () => {
      window.removeEventListener("online", retry);
      window.removeEventListener(SUPABASE_SESSION_CHANGED_EVENT, retry);
    };
  }, [retry]);

  useEffect(() => {
    if (!input.active) {
      gate.current.cancel();
      setObservation(null);
      return undefined;
    }
    const run = gate.current.begin();
    setObservation({ kind: "checking", scope });
    void probeHouseholdScope(input, adapters, run.isCurrent).then((next) => {
      if (run.isCurrent()) setObservation(next);
    });
    return () => gate.current.cancel();
  }, [adapters, input.active, scopeKey, input.household.revision, retryRevision]);

  return { observation, retry };
}

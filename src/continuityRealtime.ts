import { createClient } from "@supabase/supabase-js";
import type { Environment } from "./core/types.ts";

/** Supabase Realtime channel status — poll runs when this is not SUBSCRIBED. */
export type ContinuityRealtimeStatus =
  | "SUBSCRIBED"
  | "TIMED_OUT"
  | "CLOSED"
  | "CHANNEL_ERROR"
  | "JOINING";

export function continuityRealtimeEnabled(): boolean {
  return String(import.meta.env.VITE_CONTINUITY_REALTIME || "") === "1";
}

/** True when the 4 s REST poll should run (feature off or Realtime disconnected). */
export function shouldUsePollFallback(
  status: ContinuityRealtimeStatus | null,
  enabled = continuityRealtimeEnabled(),
): boolean {
  if (!enabled) return true;
  return status !== "SUBSCRIBED";
}

export function canAttachContinuityRealtime(input: {
  enabled?: boolean;
  authSessionPresent: boolean;
  membershipResolved: boolean;
  hostedAllowed: boolean;
  hasHousehold: boolean;
}): boolean {
  const enabled = input.enabled ?? continuityRealtimeEnabled();
  return enabled
    && input.authSessionPresent
    && input.membershipResolved
    && input.hostedAllowed
    && input.hasHousehold;
}

export type AttachContinuityRealtimeInput = {
  supabaseUrl: string;
  publishableKey: string;
  accessToken: string;
  householdId: string;
  memberId: string;
  environment: Environment;
  /** Revision-only trigger — must call existing pull/reconcile, never merge websocket payload. */
  onSnapshotSignal: () => void;
  onStatusChange?: (status: ContinuityRealtimeStatus) => void;
};

type RealtimeChannelHandle = {
  on: (
    type: "postgres_changes",
    filter: Record<string, string>,
    callback: () => void,
  ) => RealtimeChannelHandle;
  subscribe: (callback: (status: string) => void) => RealtimeChannelHandle;
};

type RealtimeClientHandle = {
  channel: (name: string) => RealtimeChannelHandle;
  removeChannel: (channel: RealtimeChannelHandle) => Promise<"ok" | "timed out" | "error">;
  realtime: { setAuth: (token: string | null) => void };
};

export type ContinuityRealtimeDeps = {
  createClient?: (
    supabaseUrl: string,
    supabaseKey: string,
    options?: Parameters<typeof createClient>[2],
  ) => RealtimeClientHandle;
};

/**
 * Subscribe to hosted snapshot row changes for the active household.
 * RLS-respecting JWT is required; caller must verify membership before attach.
 */
export function attachContinuityRealtime(
  input: AttachContinuityRealtimeInput,
  deps: ContinuityRealtimeDeps = {},
): () => void {
  const create: NonNullable<ContinuityRealtimeDeps["createClient"]> = deps.createClient
    ?? (createClient as unknown as NonNullable<ContinuityRealtimeDeps["createClient"]>);
  const client = create(input.supabaseUrl, input.publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        apikey: input.publishableKey,
        Authorization: `Bearer ${input.accessToken}`,
      },
    },
  });

  client.realtime.setAuth(input.accessToken);

  let disposed = false;
  const channelName = `hearth:${input.environment}:${input.householdId}:${input.memberId}`;
  const signal = () => {
    if (!disposed) input.onSnapshotSignal();
  };

  const channel = client
    .channel(channelName)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "household_snapshots",
        filter: `household_id=eq.${input.householdId}`,
      },
      signal,
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "continuity_personal_snapshots",
        filter: `household_id=eq.${input.householdId}`,
      },
      signal,
    )
    .subscribe((status) => {
      if (disposed) return;
      input.onStatusChange?.(status as ContinuityRealtimeStatus);
    });

  return () => {
    disposed = true;
    void client.removeChannel(channel);
    client.realtime.setAuth(null);
  };
}

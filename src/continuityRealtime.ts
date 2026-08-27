import { createClient } from "@supabase/supabase-js";
import type { Environment } from "./core/types.ts";
import { continuityCommandLogEnabled } from "./ledger/continuityCommandLog.ts";
import {
  parseContinuityCommandEventRow,
  type ContinuityCommandEvent,
} from "./ledger/materializeSnapshotFromEvents.ts";

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

/** Tier 1/2 Realtime matches Migration 012 — Development only until October cutover. */
export function continuityRealtimeAllowed(environment: Environment): boolean {
  return environment === "development";
}

export function canAttachContinuityRealtime(input: {
  enabled?: boolean;
  commandLogEnabled?: boolean;
  authSessionPresent: boolean;
  membershipResolved: boolean;
  hostedAllowed: boolean;
  hasHousehold: boolean;
  environment: Environment;
}): boolean {
  const snapshotRealtime = input.enabled ?? continuityRealtimeEnabled();
  const commandLog = input.commandLogEnabled ?? continuityCommandLogEnabled();
  if (!snapshotRealtime && !commandLog) return false;
  return continuityRealtimeAllowed(input.environment)
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
  /** Tier 2: apply one command event locally; caller falls back to snapshot pull on failure. */
  onCommandEvent?: (event: ContinuityCommandEvent) => void;
  commandLogEnabled?: boolean;
  onStatusChange?: (status: ContinuityRealtimeStatus) => void;
};

type RealtimeChannelHandle = {
  on: (
    type: "postgres_changes",
    filter: Record<string, string>,
    callback: (payload?: { new?: unknown }) => void,
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
  const commandLogEnabled = input.commandLogEnabled ?? continuityCommandLogEnabled();
  const snapshotRealtimeEnabled = continuityRealtimeEnabled();
  const channelName = `hearth:${input.environment}:${input.householdId}:${input.memberId}`;
  const signal = () => {
    if (!disposed) input.onSnapshotSignal();
  };
  const handleCommandInsert = (payload?: { new?: unknown }) => {
    if (disposed || !input.onCommandEvent) return;
    const event = parseContinuityCommandEventRow(payload?.new);
    if (event) input.onCommandEvent(event);
  };

  let channel = client.channel(channelName);
  if (snapshotRealtimeEnabled) {
    channel = channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "household_snapshots",
          filter: `household_id=eq.${input.householdId}`,
        },
        () => signal(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "continuity_personal_snapshots",
          filter: `household_id=eq.${input.householdId}`,
        },
        () => signal(),
      );
  }
  if (commandLogEnabled) {
    channel = channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "continuity_command_events",
        filter: `household_id=eq.${input.householdId}`,
      },
      handleCommandInsert,
    );
  }
  channel.subscribe((status) => {
    if (disposed) return;
    input.onStatusChange?.(status as ContinuityRealtimeStatus);
  });

  return () => {
    disposed = true;
    void client.removeChannel(channel);
    client.realtime.setAuth(null);
  };
}

import { createClient } from "@supabase/supabase-js";
import type { Environment } from "./core/types.ts";
import { continuityCommandLogEnabled } from "./ledger/continuityCommandLog.ts";
import {
  continuityRealtimeEnabled,
  type ContinuityRealtimeStatus,
} from "./continuityRealtimePolicy.ts";
export {
  canAttachContinuityRealtime,
  continuityRealtimeAllowed,
  continuityRealtimeEnabled,
  continuityRealtimeSelfHealEnabled,
  shouldUsePollFallback,
  type ContinuityRealtimeStatus,
} from "./continuityRealtimePolicy.ts";
import {
  parseContinuityCommandEventRow,
  type ContinuityCommandEvent,
} from "./ledger/materializeSnapshotFromEvents.ts";
import type { ContinuitySnapshotSignal } from "./continuityRealtimeRecovery.ts";
import type { ContinuityHeartbeatStatus } from "./continuityRealtimeReconnect.ts";

export type AttachContinuityRealtimeInput = {
  supabaseUrl: string;
  publishableKey: string;
  accessToken: string;
  accessTokenProvider?: () => Promise<string | null>;
  onAccessTokenChange?: () => void;
  onAccessTokenError?: (caught: unknown) => void;
  householdId: string;
  memberId: string;
  environment: Environment;
  /** Revision-only trigger — must call existing pull/reconcile, never merge websocket payload. */
  onSnapshotSignal: (signal: ContinuitySnapshotSignal) => void;
  /** Tier 2: apply one command event locally; caller falls back to snapshot pull on failure. */
  onCommandEvent?: (event: ContinuityCommandEvent) => void;
  commandLogEnabled?: boolean;
  onStatusChange?: (status: ContinuityRealtimeStatus) => void;
  onHeartbeatStatus?: (status: ContinuityHeartbeatStatus, latencyMs?: number) => void;
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

let continuityClientSequence = 0;

export function continuityRealtimeWorkerSupported(): boolean {
  return typeof window !== "undefined" && typeof window.Worker === "function";
}

/**
 * Subscribe to hosted snapshot row changes for the active household.
 * RLS-respecting JWT is required; caller must verify membership before attach.
 */
export function attachContinuityRealtime(
  input: AttachContinuityRealtimeInput,
  deps: ContinuityRealtimeDeps = {},
): () => void {
  let disposed = false;
  let currentAccessToken = input.accessToken;
  const accessToken = async (): Promise<string | null> => {
    if (disposed) return null;
    try {
      const next = input.accessTokenProvider
        ? await input.accessTokenProvider()
        : currentAccessToken;
      if (!next) throw new Error("Realtime has no authenticated access token.");
      const changed = next !== currentAccessToken;
      currentAccessToken = next;
      if (changed && !disposed) input.onAccessTokenChange?.();
      return next;
    } catch (caught) {
      if (!disposed) input.onAccessTokenError?.(caught);
      throw caught;
    }
  };
  const create: NonNullable<ContinuityRealtimeDeps["createClient"]> = deps.createClient
    ?? (createClient as unknown as NonNullable<ContinuityRealtimeDeps["createClient"]>);
  const client = create(input.supabaseUrl, input.publishableKey, {
    accessToken,
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: `hearth-continuity-ephemeral-${continuityClientSequence += 1}`,
    },
    global: {
      headers: {
        apikey: input.publishableKey,
        Authorization: `Bearer ${input.accessToken}`,
      },
    },
    realtime: {
      worker: continuityRealtimeWorkerSupported(),
      heartbeatCallback: (status, latencyMs) => {
        if (disposed) return;
        input.onHeartbeatStatus?.(status as ContinuityHeartbeatStatus, latencyMs);
      },
    },
  });

  client.realtime.setAuth(input.accessToken);

  const commandLogEnabled = input.commandLogEnabled ?? continuityCommandLogEnabled();
  const snapshotRealtimeEnabled = continuityRealtimeEnabled();
  const channelName = `hearth:${input.environment}:${input.householdId}:${input.memberId}`;
  const signal = (
    table: ContinuitySnapshotSignal["table"],
    payload?: { new?: unknown },
  ) => {
    if (disposed) return;
    const row = payload?.new;
    const rawRevision = row && typeof row === "object"
      ? (row as Record<string, unknown>).revision
      : null;
    const revision = typeof rawRevision === "number"
      && Number.isSafeInteger(rawRevision)
      && rawRevision >= 0
      ? rawRevision
      : null;
    input.onSnapshotSignal({ table, revision });
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
        (payload) => signal("household_snapshots", payload),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "continuity_personal_snapshots",
          filter: `household_id=eq.${input.householdId}`,
        },
        (payload) => signal("continuity_personal_snapshots", payload),
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

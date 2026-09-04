import { createClient } from "@supabase/supabase-js";
import type { Environment } from "./core/types.ts";
import { softPresenceRealtimeEnabled } from "./continuityRealtimePolicy.ts";
import type { SoftPresenceLiveRow } from "./softPresence.ts";

export type SoftPresenceTrackPayload = {
  memberId: string;
  deviceId: string;
  seenAt: string;
};

type PresenceChannelHandle = {
  on: (
    type: "presence",
    filter: { event: "sync" | "join" | "leave" },
    callback: () => void,
  ) => PresenceChannelHandle;
  subscribe: (callback: (status: string) => void) => PresenceChannelHandle;
  track: (payload: SoftPresenceTrackPayload) => Promise<"ok" | "timed out" | "error">;
  untrack: () => Promise<"ok" | "timed out" | "error">;
  presenceState: () => Record<string, SoftPresenceTrackPayload[] | undefined>;
};

type PresenceClientHandle = {
  channel: (name: string, opts?: { config?: { presence?: { key?: string } } }) => PresenceChannelHandle;
  removeChannel: (channel: PresenceChannelHandle) => Promise<"ok" | "timed out" | "error">;
  realtime: { setAuth: (token: string | null) => void };
};

export type SoftPresenceRealtimeDeps = {
  createClient?: (
    supabaseUrl: string,
    supabaseKey: string,
    options?: Parameters<typeof createClient>[2],
  ) => PresenceClientHandle;
};

let presenceClientSequence = 0;

export { softPresenceRealtimeEnabled } from "./continuityRealtimePolicy.ts";

function rowsFromPresenceState(state: Record<string, SoftPresenceTrackPayload[] | undefined>): SoftPresenceLiveRow[] {
  const rows: SoftPresenceLiveRow[] = [];
  for (const metas of Object.values(state)) {
    for (const meta of metas ?? []) {
      if (!meta?.memberId || !meta.deviceId || !meta.seenAt) continue;
      rows.push({
        memberId: meta.memberId,
        deviceId: meta.deviceId,
        seenAt: meta.seenAt,
      });
    }
  }
  return rows;
}

export type AttachSoftPresenceRealtimeInput = {
  supabaseUrl: string;
  publishableKey: string;
  accessToken: string;
  householdId: string;
  environment: Environment;
  track: SoftPresenceTrackPayload | null;
  onPresence: (rows: SoftPresenceLiveRow[]) => void;
};

/**
 * Ephemeral Realtime presence — memberId + deviceId + seenAt only.
 * Never carries ledger payloads. Caller must respect opt-out (pass track: null).
 */
export function attachSoftPresenceRealtime(
  input: AttachSoftPresenceRealtimeInput,
  deps: SoftPresenceRealtimeDeps = {},
): () => void {
  if (!softPresenceRealtimeEnabled(input.environment)) {
    return () => undefined;
  }

  const create: NonNullable<SoftPresenceRealtimeDeps["createClient"]> = deps.createClient
    ?? (createClient as unknown as NonNullable<SoftPresenceRealtimeDeps["createClient"]>);
  const client = create(input.supabaseUrl, input.publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: `hearth-presence-ephemeral-${presenceClientSequence += 1}`,
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
  const channelName = `hearth-presence:${input.environment}:${input.householdId}`;
  const presenceKey = input.track?.deviceId ?? `anon-${input.householdId}`;
  const channel = client.channel(channelName, {
    config: { presence: { key: presenceKey } },
  });

  const publish = () => {
    if (disposed) return;
    input.onPresence(rowsFromPresenceState(channel.presenceState()));
  };

  channel
    .on("presence", { event: "sync" }, publish)
    .on("presence", { event: "join" }, publish)
    .on("presence", { event: "leave" }, publish)
    .subscribe((status) => {
      if (disposed) return;
      if (status === "SUBSCRIBED" && input.track) {
        void channel.track(input.track).then(() => publish());
      } else if (status === "SUBSCRIBED") {
        publish();
      }
    });

  return () => {
    disposed = true;
    void channel.untrack();
    void client.removeChannel(channel);
    client.realtime.setAuth(null);
  };
}

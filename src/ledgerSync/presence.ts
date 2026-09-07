import { retryDelay } from "./wire.ts";
import type { SoftPresenceLiveRow } from "../softPresence.ts";
/** Independent socket and bounded JSON messages: ephemeral traffic never queues behind ledger frames. */
export function attachLedgerPresence(input: {
  environment: string;
  householdId: string;
  memberId: string;
  deviceId: string;
  token: () => Promise<string>;
  advertise: boolean;
  onPresence: (rows: SoftPresenceLiveRow[]) => void;
}) {
  let stopped = false,
    ws: WebSocket | undefined,
    retry: ReturnType<typeof setTimeout> | undefined,
    renew: ReturnType<typeof setTimeout> | undefined,
    heartbeat: ReturnType<typeof setInterval> | undefined,
    attempt = 0;
  const peers = new Map<string, SoftPresenceLiveRow>();
  const path = `/ledger-sync/v2/${input.environment}/${input.householdId}`;
  async function ticket() {
    const response = await fetch(`${path}/ticket`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await input.token()}` },
    });
    if (!response.ok) throw new Error("PRESENCE_AUTH");
    return ((await response.json()) as { ticket: string }).ticket;
  }
  const publish = () => {
    const now = Date.now();
    for (const [id, row] of peers)
      if (now - Date.parse(row.seenAt) > 15000) peers.delete(id);
    input.onPresence([...peers.values()]);
  };
  const pulse = () => {
    publish();
    if (
      input.advertise &&
      ws?.readyState === WebSocket.OPEN &&
      document.visibilityState === "visible"
    )
      ws.send(JSON.stringify({ type: "presence", deviceId: input.deviceId }));
  };
  async function connect() {
    try {
      const key = await ticket();
      if (stopped) return;
      const socket = new WebSocket(
        `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}${path}/socket?lane=presence`,
      );
      ws = socket;
      socket.onopen = () =>
        socket.send(JSON.stringify({ type: "auth", ticket: key }));
      socket.onmessage = (event) => {
        if (typeof event.data !== "string") return;
        const value = JSON.parse(event.data);
        if (value.type === "authenticated") {
          attempt = 0;
          pulse();
        }
        if (value.type === "presence") {
          peers.set(value.deviceId, value);
          publish();
        }
      };
      socket.onclose = () => {
        clearTimeout(renew);
        clearInterval(heartbeat);
        if (!stopped)
          retry = setTimeout(() => {
            void connect();
          }, retryDelay(attempt++));
      };
      socket.onerror = () => socket.close();
      heartbeat = setInterval(pulse, 5000);
      const refresh = async () => {
        try {
          const key = await ticket();
          if (stopped || ws !== socket) return;
          socket.send(JSON.stringify({ type: "auth", ticket: key }));
          renew = setTimeout(() => {
            void refresh();
          }, 40000);
        } catch {
          socket.close();
        }
      };
      renew = setTimeout(() => {
        void refresh();
      }, 40000);
    } catch {
      if (!stopped)
        retry = setTimeout(() => {
          void connect();
        }, retryDelay(attempt++));
    }
  }
  void connect();
  return () => {
    stopped = true;
    clearTimeout(retry);
    clearTimeout(renew);
    clearInterval(heartbeat);
    ws?.close();
    input.onPresence([]);
  };
}

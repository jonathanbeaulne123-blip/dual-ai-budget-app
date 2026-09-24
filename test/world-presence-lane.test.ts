// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { attachWorldPresence } from "../src/ledgerSync/worldPresence.ts";
import { WORLD_STEP_MS } from "../src/ledgerSync/worldPresenceWire.ts";
import { WORLD_EXPIRE_MS } from "../src/ledgerSync/worldMotion.ts";

/**
 * The browser end of the lane, with the socket and the clock replaced.
 * What is being proved here is the send-side gate: when the person has not
 * turned live position on, **nothing** is written to the socket — not a join,
 * not a step, not a keepalive.
 */

class FakeSocket {
  static OPEN = 1;
  readyState = 1;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  send(value: string) { this.sent.push(value); }
  close() { this.readyState = 3; this.onclose?.(); }
  frames() { return this.sent.map((row) => JSON.parse(row) as Record<string, any>); }
  kinds() { return this.frames().map((row) => row.type as string); }
  deliver(value: unknown) { this.onmessage?.({ data: JSON.stringify(value) }); }
}

function harness(options: { canPublish: () => boolean; visible?: () => boolean }) {
  const sockets: FakeSocket[] = [];
  const peersSeen: unknown[][] = [];
  let clock = 1_000_000;
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ ticket: "TICKET" }), { status: 200 })) as unknown as typeof fetch;
  const lane = attachWorldPresence({
    environment: "development",
    householdId: "HH-1",
    placeId: "court",
    deviceId: "DEVICE-a",
    token: async () => "local:MEM-001",
    canPublish: options.canPublish,
    visible: options.visible ?? (() => true),
    now: () => clock,
    onPeers: (peers) => peersSeen.push(peers),
    fetcher,
    connect: () => { const socket = new FakeSocket(); sockets.push(socket); return socket as unknown as WebSocket; },
  });
  return {
    lane, sockets, peersSeen, fetcher,
    tick: (ms: number) => { clock += ms; },
    now: () => clock,
    async ready() {
      await vi.waitFor(() => expect(sockets.length).toBe(1));
      sockets[0]!.onopen?.();
      sockets[0]!.deliver({ type: "authenticated" });
      return sockets[0]!;
    },
  };
}

afterEach(() => { vi.restoreAllMocks(); });

it('withholds an incompatible peer position while keeping its presence available',async()=>{
 const h=harness({canPublish:()=>true}),socket=await h.ready();
 const peer={type:'world-peer',memberId:'MEM-002',deviceId:'MEM-002:DEVICE-b',placeId:'court',seenAt:h.now()};
 socket.deliver(peer);socket.deliver({...peer,x:1,z:2,yaw:0,moving:true});
 expect(h.lane.peers()).toHaveLength(1);expect(h.lane.peers()[0]!.track.samples()).toHaveLength(0);
 socket.deliver({...peer,world:'hearth-mountain-1',x:99,y:51,z:-174,yaw:0,moving:true});
 socket.deliver(peer);expect(h.lane.peers()[0]!.track.samples()).toHaveLength(1);h.lane.close();
});

describe("the world-presence lane in the browser", () => {
  it("publishes nothing at all when live position is off", async () => {
    const h = harness({ canPublish: () => false });
    const socket = await h.ready();
    for (let i = 0; i < 20; i++) { h.tick(WORLD_STEP_MS); h.lane.step({ x: i, z: 0, yaw: 0, moving: true }); }
    // The ticket is the only thing that went anywhere; the socket carries auth and nothing else.
    expect(socket.kinds()).toEqual(["auth"]);
    expect(h.lane.state()).toBe("withheld");
    h.lane.close();
  });

  it("joins and then walks when it is on, at the lane's rate", async () => {
    let on = true;
    const h = harness({ canPublish: () => on });
    const socket = await h.ready();
    expect(socket.frames().at(-1)).toMatchObject({ type: "world-join", target: { placeId: "court", deviceId: "DEVICE-a" } });
    for (let i = 0; i < 10; i++) { h.tick(WORLD_STEP_MS); h.lane.step({ x: i * 0.3, z: 0, yaw: 0, moving: true }); }
    const steps = socket.frames().filter((row) => row.type === "world-step");
    expect(steps).toHaveLength(10);
    expect(steps[0]).toMatchObject({ version: 1, x: 0, z: 0, yaw: 0, moving: true });
    // No identity on the wire: the server decides who this is.
    for (const step of steps) expect(Object.keys(step).sort()).toEqual(["moving", "type", "version", "x", "yaw", "z"]);

    // Turned off mid-walk: a leave goes out and the walking stops on the very next frame.
    on = false;
    h.tick(WORLD_STEP_MS);
    h.lane.step({ x: 99, z: 99, yaw: 0, moving: true });
    expect(socket.frames().at(-1)).toMatchObject({ type: "world-leave" });
    h.tick(WORLD_STEP_MS);
    h.lane.step({ x: 100, z: 100, yaw: 0, moving: true });
    expect(socket.frames().filter((row) => row.type === "world-step")).toHaveLength(10);
    expect(h.lane.state()).toBe("withheld");
    h.lane.close();
  });

  it("stays quiet while the tab is in the background", async () => {
    let visible = true;
    const h = harness({ canPublish: () => true, visible: () => visible });
    const socket = await h.ready();
    visible = false;
    h.tick(WORLD_STEP_MS);
    h.lane.step({ x: 1, z: 1, yaw: 0, moving: true });
    expect(socket.frames().filter((row) => row.type === "world-step")).toHaveLength(0);
    h.lane.close();
  });

  it("keeps a peer's track, and drops the peer after seconds of silence", async () => {
    const h = harness({ canPublish: () => true });
    const socket = await h.ready();
    socket.deliver({ type: "world-peer", memberId: "MEM-002", deviceId: "MEM-002:DEVICE-b", placeId: "court", seenAt: h.now() });
    socket.deliver({ type: "world-peer", memberId: "MEM-002", deviceId: "MEM-002:DEVICE-b", placeId: "court", seenAt: h.now(), world:"hearth-mountain-1", y:51, x: 1, z: 2, yaw: 0.4, moving: true });
    h.tick(WORLD_STEP_MS);
    socket.deliver({ type: "world-peer", memberId: "MEM-002", deviceId: "MEM-002:DEVICE-b", placeId: "court", seenAt: h.now(), world:"hearth-mountain-1", y:51, x: 2, z: 2, yaw: 0.4, moving: true });
    const peer = h.lane.peers()[0]!;
    expect(peer).toMatchObject({ memberId: "MEM-002", placeId: "court" });
    expect(peer.track.samples()).toHaveLength(2);

    h.tick(WORLD_EXPIRE_MS + 1);
    h.lane.refresh();
    expect(h.lane.peers()).toHaveLength(0);
    h.lane.close();
  });

  it("drops a peer the moment it says it left", async () => {
    const h = harness({ canPublish: () => true });
    const socket = await h.ready();
    socket.deliver({ type: "world-peer", memberId: "MEM-002", deviceId: "MEM-002:DEVICE-b", placeId: "court", seenAt: h.now() });
    expect(h.lane.peers()).toHaveLength(1);
    socket.deliver({ type: "world-left", deviceId: "MEM-002:DEVICE-b" });
    expect(h.lane.peers()).toHaveLength(0);
    h.lane.close();
  });

  it("re-joins under the new place when the person walks into another one", async () => {
    const h = harness({ canPublish: () => true });
    const socket = await h.ready();
    h.lane.setPlace("kiln");
    expect(socket.frames().at(-1)).toMatchObject({ type: "world-join", target: { placeId: "kiln" } });
    h.lane.close();
  });
});

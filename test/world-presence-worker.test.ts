import { afterAll, beforeAll, expect, it } from "vitest";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { catalogHousehold } from "../src/core/index.ts";
import { MessageReader, encodeMessage } from "../src/ledgerSync/wire.ts";
import { WORLD_BOUND, WORLD_MIN_GAP_MS } from "../src/ledgerSync/worldPresenceWire.ts";
import { createWorldTrack, WORLD_RENDER_DELAY_MS } from "../src/ledgerSync/worldMotion.ts";

/**
 * The two-client proof, against the real Durable Object.
 *
 * Two authenticated members, two real WebSockets on the real `?lane=presence`
 * socket, through the real `LedgerRoom`. One walks; the other is asserted to
 * *see* the walk — not just to receive frames, but to reconstruct a smooth,
 * monotonic path out of them through the same `worldMotion.ts` track the Court
 * renders from.
 */

const PATH = "/ledger-sync/v2/development/HH-world-presence";
let mf: Miniflare;
let base = "";
const sockets: WebSocket[] = [];

type Client = {
  ws: WebSocket;
  next: (type: string, where?: (row: Record<string, any>) => boolean) => Promise<Record<string, any>>;
  messages: Record<string, any>[];
  closed: () => Promise<{ code: number; reason: string }>;
};

const post = (action: string, body: unknown, actor = "MEM-001") =>
  fetch(base + PATH + "/" + action, {
    method: "POST",
    headers: { Authorization: `Bearer local:${actor}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

async function connect(actor: string, lane: "ledger" | "presence"): Promise<Client> {
  const ticket = (await (await post("ticket", {}, actor)).json()) as { ticket: string };
  const ws = new WebSocket(base.replace(/^http/, "ws") + PATH + "/socket?lane=" + lane);
  sockets.push(ws);
  ws.binaryType = "arraybuffer";
  const messages: Record<string, any>[] = [];
  const reader = new MessageReader();
  let tail = Promise.resolve();
  let closure: { code: number; reason: string } | null = null;
  ws.addEventListener("close", (event) => { closure = { code: (event as CloseEvent).code, reason: (event as CloseEvent).reason }; });
  ws.addEventListener("message", (event) => {
    tail = tail.then(async () => {
      if (typeof event.data === "string") { messages.push(JSON.parse(event.data)); return; }
      const data = event.data as ArrayBuffer, value = await reader.accept(data);
      ws.send(JSON.stringify({ type: "credit", bytes: data.byteLength }));
      if (value) messages.push(value as Record<string, unknown>);
    });
  });
  const next = async (type: string, where: (row: Record<string, any>) => boolean = () => true) => {
    for (let i = 0; i < 400; i++) {
      await tail;
      const at = messages.findIndex((m) => m.type === type && where(m));
      if (at >= 0) return messages.splice(at, 1)[0]!;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error(`Missing ${type}: ${JSON.stringify(messages)}`);
  };
  const closed = async () => {
    for (let i = 0; i < 400; i++) { if (closure) return closure; await new Promise((r) => setTimeout(r, 10)); }
    throw new Error("socket stayed open");
  };
  await new Promise<void>((resolve, reject) => {
    ws.addEventListener("open", () => resolve(), { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  ws.send(JSON.stringify({ type: "auth", ticket: ticket.ticket }));
  await next("authenticated");
  if (lane === "ledger") {
    for (const frame of await encodeMessage({ type: "resume", sequence: 0 })) ws.send(frame);
    await next("snapshot");
    await next("ready");
  }
  return { ws, next, messages, closed };
}

const joinCourt = (client: Client, deviceId: string, placeId = "court") =>
  client.ws.send(JSON.stringify({ type: "world-join", version: 1, target: { placeId, deviceId } }));

const walkStep = (client: Client, x: number, z: number, yaw = 0, moving = true) =>
  client.ws.send(JSON.stringify({ type: "world-step", version: 1, x, z, yaw, moving }));

beforeAll(async () => {
  const bundle = await build({
    stdin: {
      resolveDir: process.cwd(),
      contents: `
        export {LedgerRoom} from './workers/ledgerRoom.ts';
        import {handleLedgerSync} from './workers/ledgerSync.ts';
        export default {fetch(request,env){return handleLedgerSync(request,env);}};
      `,
    },
    bundle: true, write: false, platform: "browser",
    external: ["cloudflare:*", "node:*"], format: "esm", target: "es2022",
  });
  mf = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    script: bundle.outputFiles[0]!.text,
    compatibilityDate: "2026-08-27",
    compatibilityFlags: ["nodejs_compat"],
    durableObjects: { LEDGER_ROOMS: { className: "LedgerRoom", useSQLite: true } },
    r2Buckets: ["LEDGER_ARCHIVE"],
    bindings: { LEDGER_SYNC_LOCAL_AUTH: "true", SUPABASE_URL: "http://127.0.0.1:1", SUPABASE_PUBLISHABLE_KEY: "synthetic" },
  }));
  base = (await mf.ready).toString().replace(/\/$/, "");
  const household = { ...catalogHousehold(), householdId: "HH-world-presence" };
  for (const actor of ["MEM-001", "MEM-002"]) expect((await post("import", household, actor)).status).toBe(200);
}, 120_000);

afterAll(async () => { for (const ws of sockets) ws.close(); await mf?.dispose(); });

it("carries one member's walk to the other, live, and the other can see it move", async () => {
  const watcher = await connect("MEM-002", "ledger");
  const a = await connect("MEM-001", "presence");
  const b = await connect("MEM-002", "presence");
  joinCourt(a, "DEVICE-a");
  joinCourt(b, "DEVICE-b");
  // Each is told the other is standing here without waiting for a heartbeat.
  expect(await a.next("world-peer")).toMatchObject({ memberId: "MEM-002", deviceId: "MEM-002:DEVICE-b", placeId: "court" });
  expect(await b.next("world-peer")).toMatchObject({ memberId: "MEM-001", deviceId: "MEM-001:DEVICE-a", placeId: "court" });

  // MEM-001 walks east along the flagstone; MEM-002 watches.
  const track = createWorldTrack();
  const seen: { x: number; at: number }[] = [];
  const deliveries: number[] = [];
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 90));
    const sent = performance.now();
    walkStep(a, i * 0.4, -2, 1.1);
    const frame = await b.next("world-peer");
    deliveries.push(performance.now() - sent);
    expect(frame).toMatchObject({ memberId: "MEM-001", deviceId: "MEM-001:DEVICE-a", placeId: "court", z: -2, moving: true });
    const at = Date.now();
    track.push({ x: frame.x, z: frame.z, yaw: frame.yaw, moving: frame.moving, at });
    seen.push({ x: frame.x, at });
  }
  expect(seen.map((s) => s.x)).toEqual(Array.from({ length: 12 }, (_, i) => Number((i * 0.4).toFixed(3))));

  // The proof that matters: the receiving side renders a smooth, monotonic
  // path out of those frames rather than twelve jumps.
  const newest = seen.at(-1)!.at;
  const path: number[] = [];
  for (let t = seen[1]!.at + WORLD_RENDER_DELAY_MS; t <= newest; t += 25) {
    const pose = track.pose(t);
    if (pose) path.push(pose.x);
  }
  expect(path.length).toBeGreaterThan(10);
  for (let i = 1; i < path.length; i++) expect(path[i]!).toBeGreaterThanOrEqual(path[i - 1]! - 1e-9);
  // Somewhere between the samples, not only on them: that is the interpolation.
  expect(path.some((x) => Math.abs(x % 0.4) > 0.02 && Math.abs((x % 0.4) - 0.4) > 0.02)).toBe(true);

  const sorted = deliveries.slice().sort((x, y) => x - y);
  const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1]!;
  expect(p95).toBeLessThan(250);

  // A ledger-lane socket never hears a word of it.
  expect(watcher.messages.some((m) => String(m.type).startsWith("world-"))).toBe(false);

  a.ws.send(JSON.stringify({ type: "world-leave", version: 1 }));
  expect(await b.next("world-left")).toMatchObject({ deviceId: "MEM-001:DEVICE-a" });
  console.log(JSON.stringify({
    fixture: "two members, two real sockets, one Durable Object",
    steps: seen.length, renderedSamples: path.length,
    deliveryP95Ms: Math.round(p95),
  }));
}, 60_000);

it("clamps a coordinate off the island instead of broadcasting it", async () => {
  const a = await connect("MEM-001", "presence");
  const b = await connect("MEM-002", "presence");
  joinCourt(a, "DEVICE-clamp-a");
  joinCourt(b, "DEVICE-clamp-b");
  await b.next("world-peer");
  await a.next("world-peer");
  walkStep(a, 5_000, -5_000, 0.2);
  // Sockets from earlier tests are still joined, so name the one that matters.
  expect(await b.next("world-peer", (m) => m.deviceId === "MEM-001:DEVICE-clamp-a" && "x" in m))
    .toMatchObject({ x: WORLD_BOUND, z: -WORLD_BOUND, placeId: "court" });
}, 60_000);

/* ── The moves, carried to the other side (walk-moves) ──────────────────── */

it("carries a jump and an emote to the partner, rebuilt server-side like everything else", async () => {
  const a = await connect("MEM-001", "presence");
  const b = await connect("MEM-002", "presence");
  joinCourt(a, "DEVICE-act-a");
  joinCourt(b, "DEVICE-act-b");
  await b.next("world-peer", (m) => m.deviceId === "MEM-001:DEVICE-act-a");
  const mine = (m: Record<string, unknown>) => m.deviceId === "MEM-001:DEVICE-act-a";
  // A jump, halfway through its arc.
  a.ws.send(JSON.stringify({ type: "world-step", version: 1, x: 1, z: 1, yaw: 0, moving: true, act: "jump", p: 0.5 }));
  expect(await b.next("world-peer", (m) => mine(m) && m.act === "jump")).toMatchObject({ act: "jump", p: 0.5, x: 1, z: 1 });
  await new Promise((r) => setTimeout(r, 70));
  // And a wave, standing still.
  a.ws.send(JSON.stringify({ type: "world-step", version: 1, x: 1, z: 1.2, yaw: 0, moving: false, act: "wave", p: 0.25 }));
  expect(await b.next("world-peer", (m) => mine(m) && m.act === "wave")).toMatchObject({ act: "wave", p: 0.25, moving: false });
}, 60_000);

it("bounds a move the way it bounds a coordinate: an unknown one closes the socket, a wild phase is pulled in", async () => {
  const a = await connect("MEM-001", "presence");
  const b = await connect("MEM-002", "presence");
  joinCourt(a, "DEVICE-actb-a");
  joinCourt(b, "DEVICE-actb-b");
  await b.next("world-peer", (m) => m.deviceId === "MEM-001:DEVICE-actb-a");
  a.ws.send(JSON.stringify({ type: "world-step", version: 1, x: 0, z: 0, yaw: 0, moving: true, act: "dance", p: 99 }));
  expect(await b.next("world-peer", (m) => m.deviceId === "MEM-001:DEVICE-actb-a" && m.act === "dance"))
    .toMatchObject({ act: "dance", p: 1 });
  // A word the lane does not have is not a move; it is a bad frame.
  const bad = await connect("MEM-001", "presence");
  joinCourt(bad, "DEVICE-actb-bad");
  await b.next("world-peer", (m) => m.deviceId === "MEM-001:DEVICE-actb-bad");
  bad.ws.send(JSON.stringify({ type: "world-step", version: 1, x: 0, z: 0, yaw: 0, moving: true, act: "withdraw", p: 0 }));
  expect(await bad.closed()).toMatchObject({ code: 4000, reason: "INVALID_WORLD_PRESENCE" });
}, 60_000);

it("rejects an absurd coordinate outright, and broadcasts nothing", async () => {
  const a = await connect("MEM-001", "presence");
  const b = await connect("MEM-002", "presence");
  joinCourt(a, "DEVICE-absurd-a");
  joinCourt(b, "DEVICE-absurd-b");
  await b.next("world-peer", (m) => m.deviceId === "MEM-001:DEVICE-absurd-a");
  b.messages.length = 0;
  walkStep(a, 1e12, 0);
  expect(await a.closed()).toMatchObject({ code: 4000, reason: "INVALID_WORLD_PRESENCE" });
  await new Promise((r) => setTimeout(r, 120));
  expect(b.messages.filter((m) => m.type === "world-peer" && m.deviceId === "MEM-001:DEVICE-absurd-a")).toHaveLength(0);
}, 60_000);

it("rejects a client that tries to name itself, and a step that never joined", async () => {
  const claimer = await connect("MEM-001", "presence");
  joinCourt(claimer, "DEVICE-claim");
  claimer.ws.send(JSON.stringify({ type: "world-step", version: 1, x: 1, z: 1, yaw: 0, moving: true, memberId: "MEM-002" }));
  expect(await claimer.closed()).toMatchObject({ code: 4000 });

  const stray = await connect("MEM-001", "presence");
  walkStep(stray, 1, 1);
  expect(await stray.closed()).toMatchObject({ code: 4000 });
}, 60_000);

it("throttles a flood to the lane's floor", async () => {
  const a = await connect("MEM-001", "presence");
  const b = await connect("MEM-002", "presence");
  joinCourt(a, "DEVICE-flood-a");
  joinCourt(b, "DEVICE-flood-b");
  await b.next("world-peer", (m) => m.deviceId === "MEM-001:DEVICE-flood-a");
  b.messages.length = 0;
  for (let i = 0; i < 40; i++) walkStep(a, i * 0.01, 0);
  await new Promise((r) => setTimeout(r, 300));
  const delivered = b.messages.filter((m) => m.type === "world-peer" && m.deviceId === "MEM-001:DEVICE-flood-a").length;
  expect(delivered).toBeGreaterThan(0);
  // Forty frames in one tick cannot become forty broadcasts.
  expect(delivered).toBeLessThanOrEqual(Math.ceil(300 / WORLD_MIN_GAP_MS) + 1);
}, 60_000);

it("only reaches peers standing in the same place", async () => {
  const a = await connect("MEM-001", "presence");
  const elsewhere = await connect("MEM-002", "presence");
  joinCourt(a, "DEVICE-scope-a", "court");
  joinCourt(elsewhere, "DEVICE-scope-b", "kiln");
  await new Promise((r) => setTimeout(r, 120));
  elsewhere.messages.length = 0;
  walkStep(a, 1, 1);
  await new Promise((r) => setTimeout(r, 200));
  expect(elsewhere.messages.filter((m) => m.type === "world-peer" && m.deviceId === "MEM-001:DEVICE-scope-a")).toHaveLength(0);
}, 60_000);

it("refuses the lane on a ledger socket", async () => {
  const wrong = await connect("MEM-001", "ledger");
  joinCourt(wrong, "DEVICE-wrong-lane");
  expect(await wrong.closed()).toMatchObject({ code: 4000, reason: "INVALID_WORLD_PRESENCE" });
}, 60_000);

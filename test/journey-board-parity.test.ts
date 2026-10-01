// @vitest-environment jsdom
/**
 * Map ↔ list parity on the REAL derived board (T6): T1's demo household → `deriveJourneyBoard` → T4's map panel and
 * T4's list, plus T3's flat twin against T3's 3D anchors. The sample-board parity lives in journey-board-ui.test.ts;
 * this one proves the same promises hold for what the App actually hands the board.
 *
 * - Every stop and crossroads id appears exactly once in the list; each row carries the SAME actions the map's panel
 *   offers for that id (pressing each one in the panel and in the list runs the same `ActionCall`, once).
 * - The list's amount / status words are the panel's amount / status words, character for character.
 * - The flat twin's marks (`BoardFlat` data-ids, and the flat UI's mark buttons) cover every 3D anchor the scene
 *   draws at each tier (Sky / Region / Stop).
 * Fictional Development data only.
 */
import { readFileSync } from "node:fs";
import { act, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot, type Root } from "react-dom/client";
import type * as THREE from "three";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { runJourneyAction, type ActionCall, type CameraTier, type JourneyBoard, type JourneyBoardActions, type JourneyLandData, type ListRow, type MarkAnchor, type RouteSpace, type Stop } from "../src/journey/contracts.ts";
import { HORIZON_INDEX_URL } from "../src/house/world/horizonAssets.ts";
import { buildJourneyLand, loadJourneyLand, resetJourneyLandCacheForTests } from "../src/journey/land/index.ts";
import { BoardFlat, boardMarks, createJourneyBoardScene, layoutRoute, type BoardSceneHandle } from "../src/journey/board/index.ts";
import { boardToList, deriveJourneyBoard } from "../src/journey/model/index.ts";
import { JourneyBoardView, type JourneyBoardViewProps } from "../src/journey/ui/JourneyBoardView.tsx";
import { journeyMarkDomId } from "../src/journey/ui/Marks.tsx";
import { journeyRowDomId } from "../src/journey/ui/JourneyList.tsx";
import { StopPanel } from "../src/journey/ui/StopPanel.tsx";
import { BIANCA, FIXTURE_TODAY, journeyDemoHousehold } from "./fixtures/journey-board-households.ts";

vi.setConfig({ testTimeout: 120_000 });
afterAll(() => vi.resetConfig());
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const toArrayBuffer = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
const INDEX_GZ = toArrayBuffer(readFileSync("public/horizon/world/horizon-geo-1.index.json.gz"));
const TERRAIN = toArrayBuffer(readFileSync("public/horizon/terrain/horizon-geo-1.bin"));

let land: JourneyLandData;
let board: JourneyBoard;
let route: RouteSpace;
let rows: ListRow[];
beforeAll(async () => {
  resetJourneyLandCacheForTests();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url === HORIZON_INDEX_URL) return new Response(INDEX_GZ.slice(0), { headers: { "content-type": "application/gzip" } });
    if (url.endsWith("/horizon-geo-1.bin")) return new Response(TERRAIN.slice(0), { headers: { "content-type": "application/octet-stream" } });
    return new Response("not found", { status: 404 });
  }));
  try { land = await loadJourneyLand(); } finally { vi.unstubAllGlobals(); }
  board = deriveJourneyBoard(journeyDemoHousehold().household, BIANCA, FIXTURE_TODAY);
  route = layoutRoute(board, land);
  rows = boardToList(board);
}, 120_000);

// ---------------------------------------------------------------------------------------------------------------
// Harness

const NAMES: (keyof JourneyBoardActions)[] = ["openRecord", "openBillPaid", "openDueReview", "openPlace", "openCampfire", "openWeeklySitdown", "openHomeBook", "openEraPlanner", "openKitty", "openCalendar", "openBooks", "enterHorizon", "back"];
type Spied = JourneyBoardActions & { spies: Record<keyof JourneyBoardActions, ReturnType<typeof vi.fn>> };
function spyActions(): Spied {
  const spies = Object.fromEntries(NAMES.map((n) => [n, vi.fn()])) as Spied["spies"];
  return { ...(spies as unknown as JourneyBoardActions), spies };
}
const recorded = (a: Spied) => Object.entries(a.spies).flatMap(([name, s]) => s.mock.calls.map((args) => [name, args] as const));
const clear = (a: Spied) => Object.values(a.spies).forEach((s) => s.mockClear());
/** What an `ActionCall` does, as [callback, args] (via the one dispatcher). */
function invocation(call: ActionCall) {
  const probe = spyActions();
  runJourneyAction(probe, call);
  return recorded(probe);
}

let reactRoot: Root | null = null;
let host: HTMLElement | null = null;
afterEach(async () => {
  if (reactRoot) await act(async () => { reactRoot!.unmount(); });
  host?.remove();
  reactRoot = null; host = null;
  vi.unstubAllGlobals();
});
async function mountView(): Promise<{ host: HTMLElement; actions: Spied }> {
  const actions = spyActions();
  const props: JourneyBoardViewProps = {
    board, actions, theme: "classic", reducedMotion: true,
    stage: { mode: "flat", status: "loading", land, landHandle: null, route, quality: "lite" },
    nameOf: (id) => (id === BIANCA ? "Bianca" : "Jonathan"),
  };
  host = document.createElement("div");
  document.body.appendChild(host);
  reactRoot = createRoot(host);
  await act(async () => { reactRoot!.render(createElement(JourneyBoardView, props)); });
  return { host, actions };
}
const click = async (el: Element | null | undefined, what: string) => {
  expect(el, what).toBeTruthy();
  await act(async () => { (el as HTMLElement).click(); });
};
const esc = (v: string) => v.replace(/["\\]/g, "\\$&");
const panelOf = (h: HTMLElement) => h.querySelector<HTMLElement>("[data-journey-panel]");
const clusterOf = (id: string) => board.clusters.find((c) => c.stopIds.includes(id))?.id ?? null;
const text = (el: Element | null | undefined) => (el?.textContent ?? "").trim();

/** Open the panel the way a person does: the stop's mark, or its cluster's mark then the stop inside it. */
async function openPanel(h: HTMLElement, id: string) {
  const cluster = clusterOf(id);
  if (cluster) {
    await click(h.querySelector(`#${journeyMarkDomId(cluster)}`), `cluster mark ${cluster}`);
    await click(panelOf(h)?.querySelector(`[data-open-stop="${esc(id)}"]`), `cluster entry ${id}`);
  } else {
    await click(h.querySelector(`#${journeyMarkDomId(id)}`), `mark ${id}`);
  }
  const panel = panelOf(h);
  expect(panel, `panel for ${id}`).toBeTruthy();
  return panel!;
}
async function closePanel(h: HTMLElement) {
  await click(panelOf(h)?.querySelector(".journey-panel__close"), "panel close");
  expect(panelOf(h)).toBeNull();
}

// ---------------------------------------------------------------------------------------------------------------

describe("the demo board's list is the map's list", () => {
  it("is a substantial board (every kind), so parity is proved on real variety", () => {
    const kinds = new Set(board.stops.map((s) => s.kind));
    expect([...kinds].sort()).toEqual(["commitment", "income", "memory", "milestone", "plan", "review"]);
    expect(board.stops.length).toBeGreaterThan(60);
    expect(board.clusters.length).toBeGreaterThan(5);
    expect(new Set(board.crossroads.map((c) => c.kind))).toEqual(new Set(["eraProposal", "homeBlueprint", "planFork"]));
    expect(board.empty).toBe(false);
  });

  it("lists every stop and crossroads id exactly once, with the stop's own actions (deep-equal calls)", () => {
    const count = new Map<string, number>();
    for (const row of rows) count.set(row.id, (count.get(row.id) ?? 0) + 1);
    const everyStop: Stop[] = [...board.stops, ...board.undatedMemories];
    for (const stop of everyStop) {
      expect(count.get(stop.id), stop.id).toBe(1);
      const row = rows.find((r) => r.id === stop.id)!;
      expect(row.level).toBe("stop");
      expect(row.actions.map((a) => a.call), stop.id).toEqual(stop.actions.map((a) => a.call));
      expect(row.actions, stop.id).toEqual(stop.actions);
    }
    for (const x of board.crossroads) {
      expect(count.get(x.id), x.id).toBe(1);
      const row = rows.find((r) => r.id === x.id)!;
      expect(row.level).toBe("crossroads");
      expect(row.actions.map((a) => a.call)).toEqual([x.confirm.call]);
    }
    // Nothing else in the list pretends to be a stop: every stop row names a real stop.
    const known = new Set(everyStop.map((s) => s.id));
    expect(rows.filter((r) => r.level === "stop" && !known.has(r.id)).map((r) => r.id)).toEqual([]);
    // No id is listed twice at all (chapters, clusters, stops, crossroads).
    expect([...count.entries()].filter(([, n]) => n > 1)).toEqual([]);
  });

  it("the map's panel and the list run the SAME calls for every stop and crossroads, and print the same amount and status words", async () => {
    const { host: h, actions } = await mountView();
    expect(h.querySelector(".journey-stage")!.getAttribute("data-stage-mode")).toBe("flat");

    type Seen = { actions: { id: string; label: string; ran: ReturnType<typeof recorded> }[]; amount: string; status: string };
    const panelSeen = new Map<string, Seen>();
    const factValue = (panel: HTMLElement, term: string) => text(panel.querySelector(`.journey-facts__row--${term} dd`));

    // 1 · the map: open every stop's panel (through its mark or its cluster) and press each of its actions.
    for (const stop of board.stops) {
      const panel = await openPanel(h, stop.id);
      const buttons = [...panel.querySelectorAll<HTMLButtonElement>(".journey-actions [data-action-id]")];
      const seen: Seen = { actions: [], amount: factValue(panel, stop.kind === "plan" ? (stop.planKind === "goal" ? "saved" : "expected-cost") : "amount"), status: factValue(panel, "status") };
      for (const button of buttons) {
        clear(actions);
        await click(button, `${stop.id} panel action`);
        seen.actions.push({ id: button.dataset.actionId!, label: text(button), ran: recorded(actions) });
      }
      panelSeen.set(stop.id, seen);
      if (panelOf(h)) await closePanel(h);
    }
    for (const x of board.crossroads) {
      const panel = await openPanel(h, x.id);
      const buttons = [...panel.querySelectorAll<HTMLButtonElement>(".journey-actions [data-action-id]")];
      const seen: Seen = { actions: [], amount: "", status: "" };
      for (const button of buttons) {
        clear(actions);
        await click(button, `${x.id} panel action`);
        seen.actions.push({ id: button.dataset.actionId!, label: text(button), ran: recorded(actions) });
      }
      panelSeen.set(x.id, seen);
      if (panelOf(h)) await closePanel(h);
    }

    // 2 · the list: the same ids, the same buttons, the same calls, the same words.
    clear(actions);
    await click(h.querySelector('[data-list-mode="list"]'), "List toggle");
    expect(recorded(actions)).toEqual([]);
    let pressed = 0;
    for (const id of [...board.stops.map((s) => s.id), ...board.crossroads.map((x) => x.id)]) {
      const rowEl = h.querySelector<HTMLElement>(`#${journeyRowDomId(id)}`);
      expect(rowEl, `list row ${id}`).toBeTruthy();
      expect(h.querySelectorAll(`[data-row-id="${esc(id)}"]`), `one row for ${id}`).toHaveLength(1);
      const listActions: Seen["actions"] = [];
      for (const button of rowEl!.querySelectorAll<HTMLButtonElement>("[data-action-id]")) {
        clear(actions);
        await click(button, `${id} list action`);
        listActions.push({ id: button.dataset.actionId!, label: text(button), ran: recorded(actions) });
        pressed += 1;
      }
      const map = panelSeen.get(id)!;
      expect(listActions, `${id}: list actions = panel actions`).toEqual(map.actions);
      // Each press ran exactly one callback, and it is the model's call.
      const model = board.stops.find((s) => s.id === id)?.actions.map((a) => a.call) ?? [board.crossroads.find((x) => x.id === id)!.confirm.call];
      expect(listActions.map((a) => a.ran), id).toEqual(model.map(invocation));
      for (const a of listActions) expect(a.ran, a.id).toHaveLength(1);
      if (id.startsWith("crossroads:")) continue;
      // Every stop states its status in words on both sides (never colour alone), and an amount when it has one.
      expect(map.status, `${id} panel status`).not.toBe("");
      const stop = board.stops.find((s) => s.id === id)!;
      if (typeof stop.amountCents === "number") expect(map.amount, `${id} panel amount`).toMatch(/\$\d/);
      expect(text(rowEl!.querySelector(".journey-row__amount")), `${id} amount words`).toBe(map.amount);
      expect(text(rowEl!.querySelector(".journey-row__status")), `${id} status words`).toBe(map.status);
    }
    expect(pressed).toBeGreaterThan(150);
    // The undated memories are list-only (never placed on a guessed day), each once.
    for (const memory of board.undatedMemories) expect(h.querySelectorAll(`[data-row-id="${esc(memory.id)}"]`)).toHaveLength(1);
  });
});

describe("the panel's words for a planning step", () => {
  it("names a task's figure its expected cost, never \"Saved\" (review MINOR 3)", () => {
    const task = { kind: "plan", planKind: "task", id: "plan:task:T-1", taskId: "T-1", status: "open", planLineId: null, date: FIXTURE_TODAY, chapterId: "2026-09", label: "Book the ferry",
      amountCents: 42000, amountBasis: "scheduled", sourceRefs: [{ kind: "task", id: "T-1" }], major: false, relation: "today", actions: [] } as Stop;
    const row: ListRow = { id: task.id, level: "stop", chapterId: "2026-09", date: FIXTURE_TODAY, kindLabel: "Plan · step", label: task.label, amountText: "$420.00 · scheduled", statusText: "Open step", actions: [], depth: 2 };
    const html = renderToStaticMarkup(createElement(StopPanel, { stop: task, row, actions: spyActions(), onClose: () => undefined, horizonLocation: null, onEnterHorizon: () => undefined }));
    expect(html).toContain("<dt>Expected cost</dt>");
    expect(html).not.toContain("<dt>Saved</dt>");
    expect(html).toContain("journey-facts__row--expected-cost");
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The flat twin covers the 3D anchors, tier by tier (the scene through the renderer lease's `rendererFactory` seam).

function fakeRenderer() {
  const canvas = document.createElement("canvas");
  return {
    domElement: canvas, render: vi.fn(), dispose: vi.fn(), forceContextLoss: vi.fn(),
    setPixelRatio: vi.fn(), setSize: vi.fn(), setClearColor: vi.fn(), setRenderTarget: vi.fn(), setScissorTest: vi.fn(),
    autoClear: true, shadowMap: { enabled: true, type: 0 }, outputColorSpace: "", toneMapping: 0,
  } as unknown as THREE.WebGLRenderer;
}

describe("flat marks ⊇ the 3D anchors at every visible tier", () => {
  it("every non-landmark anchor at Sky, Region and Stop has its BoardFlat mark and action button", async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", vi.fn((cb: FrameRequestCallback) => { frames.push(cb); return frames.length; }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const flatHtml = renderToStaticMarkup(createElement("svg", null, createElement(BoardFlat, { route, board, theme: "classic" })));
    const flatIds = new Set([...flatHtml.matchAll(/data-id="([^"]+)"/g)].map((m) => m[1]!.replace(/&amp;/g, "&")));
    const tiersOf = new Map(boardMarks(board, route).map((m) => [m.id, m.tiers] as const));

    const landHandle = buildJourneyLand(land, { theme: "classic", tier: "full", homes: board.homes });
    let last: MarkAnchor[] = [];
    let scene: BoardSceneHandle | null = null;
    try {
      scene = createJourneyBoardScene(document.createElement("div"), {
        land: landHandle, board, route, theme: "classic", tier: "full", reducedMotion: true,
        onAnchors: (a) => { last = a; }, onTier: () => undefined, onPick: () => undefined, onReady: () => undefined, onLost: () => undefined,
        rendererFactory: () => fakeRenderer(), shared: false, size: { width: 1100, height: 800 }, devicePixelRatio: 1,
      });
      // The flat UI's mark buttons (piece, months, clusters, unclustered stops, crossroads).
      const { host: h } = await mountView();
      const flatButtons = new Set([...h.querySelectorAll<HTMLElement>(".journey-mark")].map((b) => b.dataset.markId!));

      const seenVisible = new Map<CameraTier, number>();
      const targets: [CameraTier, Parameters<BoardSceneHandle["focus"]>[0]][] = [
        ["sky", "piece"], ["region", "piece"], ["stop", "piece"], ["region", { chapterId: "2026-08" }], ["region", { chapterId: "2026-11" }], ["stop", { date: "2026-09-18" }],
      ];
      for (const [tier, target] of targets) {
        scene.focus(target, tier, false);
        scene.renderNow();
        expect(scene.view().tier, `${tier} framing`).toBe(tier);
        // Bridge identities are passive labels (covered by the real flat Stage test), not
        // financial action marks. The exact button/callback parity below remains unchanged.
        const visible = last.filter((a) => a.visible && !a.bridge && !a.id.startsWith("district:") && !a.id.startsWith("preview:"));
        expect(visible.length, `${tier}: something is drawn`).toBeGreaterThan(0);
        seenVisible.set(tier, (seenVisible.get(tier) ?? 0) + visible.length);
        const missing = visible.map((a) => a.id).filter((id) => !flatIds.has(id));
        expect(missing, `${tier}: 3D anchors missing from BoardFlat`).toEqual([]);
        const wrongTier = visible.map((a) => a.id).filter((id) => !(tiersOf.get(id) ?? []).includes(tier));
        expect(wrongTier, `${tier}: 3D draws a mark the flat twin hides at this tier`).toEqual([]);
        // Every visible 3D mark that is a button in 3D (not a day space) has its button on the flat board too;
        // a clustered stop's button is its cluster's.
        const buttonless = visible.map((a) => a.id)
          .filter((id) => !/^\d{4}-\d{2}-\d{2}$/.test(id))
          .filter((id) => !flatButtons.has(id) && !(clusterOf(id) && flatButtons.has(clusterOf(id)!)));
        expect(buttonless, `${tier}: visible 3D marks with no flat button`).toEqual([]);
      }
      // All three tiers were exercised, and Region/Stop drew day spaces that Sky did not.
      expect([...seenVisible.keys()].sort()).toEqual(["region", "sky", "stop"]);
    } finally {
      scene?.dispose();
      landHandle.dispose();
    }
  });
});

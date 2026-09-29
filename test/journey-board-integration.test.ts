// @vitest-environment jsdom
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HarbourWorld, { harbourShellFor, type HarbourWorldProps } from "../src/harbour/HarbourWorld.tsx";
import HorizonWorld from "../src/harbour/horizon/HorizonWorld.tsx";
import type { HorizonStageProps } from "../src/harbour/horizon/HorizonStage.tsx";
import { JOURNEY_HOME_ROUTE, harbourArrivalRoute, markArrived, type ArrivalSession } from "../src/harbour/nav/arrival.ts";
import { harbourOwnsRoute } from "../src/harbour/flag.ts";
import { houseTabForRoute, houseToolPlace } from "../src/house/navigation.ts";
import type { HouseRoute } from "../src/hearthside/houseRoutes.ts";
import { HORIZON_GEOGRAPHY, HORIZON_PRESENCE_WORLD } from "../src/worldGeography.ts";
import { seedDemoHousehold } from "../src/core/seed.ts";

/**
 * The Journey Board integration (T5, PLAN §C): the household Journey route mounts the board, the first arrival of a
 * tab lands there, and "Enter Horizon here" is the one explicit hand-off to the detailed world — HarbourWorld picks
 * the Horizon while a request stands, and HorizonWorld starts the body at the place (no height, so
 * `restoreHorizonPosition` grounds or snaps it) or arrives at a host's door, once per request.
 */

const state = vi.hoisted(() => ({ stage: null as HorizonStageProps | null, horizonProps: null as Record<string, unknown> | null }));
vi.mock("../src/harbour/horizon/HorizonStage.tsx", () => ({ default: (props: HorizonStageProps) => { state.stage = props; return null; } }));
vi.mock("../src/harbour/presence/feed.ts", () => ({ publishLocalPose: () => () => {}, useWorldFeed: () => ({ walk: null }) }));
vi.mock("../src/softPresenceWorld.ts", () => ({ readWorldPresenceShare: () => "together" }));
// The old shell around the Horizon reads the books for its dock and panels; this file is about where the body starts.
vi.mock("../src/harbour/data/useHarbourReading.ts", () => ({ useHarbourReading: () => ({ reading: null, statusLine: null }) }));
// The Mountain never draws here: a failed mount keeps the Mountain edition on its flat fallback.
vi.mock("../src/harbour/scene/runtime.ts", () => ({ mountHarbourWorld: () => { throw new Error("no Mountain scene in this test"); }, scrubControls: () => null }));
vi.mock("../src/harbour/court/queenPlace.ts", () => ({ loadQueenPlace: () => Promise.reject(new Error("no Queen in this test")), seatGrowthAtRoots: () => undefined }));

const root = process.cwd();
const app = readFileSync(join(root, "src", "App.tsx"), "utf8");

describe("the App mounts the Journey Board on the household Journey route", () => {
  it("lazy-loads the board and branches the household plan page on kitchen-table/above only", () => {
    expect(app).toMatch(/const JourneyBoard = lazy\(\(\) => import\("\.\/journey\/ui\/JourneyBoard\.tsx"\)\);/);
    expect(app).toMatch(/const journeyBoardShown = HOUSE_WORLD_ENABLED && view === "household" && tab === "plan" && Boolean\(dashboard\) && planSystemV2Enabled\(\) && activeHouseTool\.room === "kitchen-table" && activeHouseTool\.level === "above";/);
    const branch = app.indexOf('return view === "household" ? journeyBoardShown ? (');
    expect(branch).toBeGreaterThan(0);
    const board = app.indexOf("<JourneyBoard ", branch), path = app.indexOf("<OurPathWorld ", branch), studio = app.indexOf(") : studio;", branch);
    // The board first; OurPathWorld still stands in the other arm (Plan Studio below, Work centre in the middle); Personal keeps `studio`.
    expect(board).toBeGreaterThan(branch);
    expect(path).toBeGreaterThan(board);
    expect(studio).toBeGreaterThan(path);
    expect(app.slice(path, studio)).toMatch(/houseSurface=\{\(HEARTHSIDE_FLAGS\.presentation\|\|HOUSE_WORLD_ENABLED\) && activeHouseTool\.room==="kitchen-table" \? activeHouseTool\.level==="below" \? "studio" : activeHouseTool\.level==="middle" \? "work" : "journey" : undefined\}/);
    expect(app.slice(board, path)).toMatch(/returningFromHorizon=\{activeHouseRoute\.object === "harbour-return"\}/);
    expect(app.slice(board, path)).toMatch(/onReady=\{\(\) => journeyCloud\.ready\("to-journey"\)\}/);
    // The board stands full-bleed in its frame, and the house strip is not drawn under it.
    expect(app.slice(branch, board)).toContain("<JourneyBoardFrame>");
    expect(app).toMatch(/:journeyBoardShown\?null:\(!HARBOUR_ENABLED\|\|view==="household"\)\?<HouseWorld /);
  });

  it("routes the kitchen table's three levels as before: the Journey surface is the plan tab and not a harbour place", () => {
    const journey = JOURNEY_HOME_ROUTE("HH-one");
    expect(houseToolPlace(journey)).toEqual({ room: "kitchen-table", level: "above" });
    expect(houseTabForRoute(journey)).toBe("plan");
    expect(houseToolPlace({ ...journey, surface: "plan-studio" })).toEqual({ room: "kitchen-table", level: "below" });
    expect(houseToolPlace({ ...journey, surface: "conversation" })).toEqual({ room: "kitchen-table", level: "middle" });
    expect(harbourOwnsRoute(journey, "household", true)).toBe(false);
  });

  it("wires every board action to an existing surface and adds no captured command to the App", () => {
    const start = app.indexOf("const journeyActions: Omit<JourneyBoardActions, \"openHomeBook\"> = {");
    const end = app.indexOf("function closeEraPlanner()", start);
    expect(start).toBeGreaterThan(0);
    const actions = app.slice(start, end);
    for (const name of ["openRecord", "openBillPaid", "openDueReview", "openPlace", "openCampfire", "openWeeklySitdown", "openEraPlanner", "openKitty", "openCalendar", "openBooks", "enterHorizon", "back"]) {
      expect(actions, name).toMatch(new RegExp(`\\b${name}: `));
    }
    expect(actions).toMatch(/openBillPaid: \(recurrenceId\) => openRecordFlow\("bill", undefined, undefined, recurrenceId\)/);
    // Expected recurring pay and the due reminders open the App's reviewed recurrence path (review B1 / M1)…
    expect(actions).toMatch(/openDueReview: \(recurrenceId\) => openDueReviewFromBoard\(recurrenceId\)/);
    // …which only raises the existing due review: it sets the reminder guard and the sheet, and never posts.
    const opener = app.slice(app.indexOf("function openDueReviewFromBoard("), app.indexOf("function returnDueFocus()"));
    expect(opener).toMatch(/setGuard\(\{ kind: "duePreview", rows \}\)/);
    expect(opener).toMatch(/setDueSheetOpen\(true\)/);
    expect(opener).not.toMatch(/runKitchen|\brun\(|postOne|postEntry|commit|persist\(/);
    // A passage already under way: the board is told nothing started (review MINOR 9).
    expect(actions).toMatch(/enterHorizon: \(location\) => \{\s*if \(journeyCloud\.clouds\) return false;/);
    expect(actions).toMatch(/openKitty: \(goalId\) => openHouseObject\("loft-banks", `bank\/goal:\$\{goalId\}`\)/);
    expect(actions).toMatch(/setHorizonRequest\(\{ seq: Date\.now\(\), location \}\);\s*navigateHouseSurface\(\{householdId:household\.householdId,scope:"household",room:"home",level:"middle",village:\{place:"court"\}\}\);/);
    // Opening a surface, never posting: no command runner, poster or commit inside the board's actions.
    expect(actions).not.toMatch(/runKitchen|\brun\(|postOne|postEntry|commit|persist\(/);
    // HomeBook: only the viewer's own home opens.
    expect(app).toMatch(/openHomeBook: \(memberId\) => \{ if \(memberId === actorId\) openHomeBook\(\); \}/);

    // The feature's imports: types from the frozen contracts, the HomeBook hook and one pure selector.
    expect(app).toContain('import type { BooksRef, HorizonLocation, JourneyBoardActions } from "./journey/contracts.ts";');
    expect(app).toContain('import { pathEras } from "./core/pathEras.ts";');
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => { const path = join(dir, name); return statSync(path).isDirectory() ? walk(path) : /\.tsx?$/.test(name) ? [path] : []; });
    const commands = new Set(walk(join(root, "src", "core")).flatMap((file) => [...readFileSync(file, "utf8").matchAll(/export const (\w+)\s*=\s*captureCommand\(/g)].map((m) => m[1]!)));
    expect(commands.size).toBeGreaterThan(0);
    expect(commands.has("pathEras")).toBe(false);
    // Nothing from src/journey reaches the App except the lazy board and the contracts' types.
    const journeyImports = [...app.matchAll(/(?:from|import\()\s*["'](\.\/journey\/[^"']+)["']/g)].map((m) => m[1]);
    expect(new Set(journeyImports)).toEqual(new Set(["./journey/ui/JourneyBoard.tsx", "./journey/contracts.ts"]));
  });

  it("hands the Horizon request to the harbour and spends it when the Journey route is active again", () => {
    expect(app).toMatch(/onNavigateLocation=\{navigateHouseSurface\} enterHorizonRequest=\{horizonRequest\} onHorizonArrived=\{seq=>setHorizonRequest\(current=>current&&current\.seq===seq&&!current\.arrived\?\{\.\.\.current,arrived:true\}:current\)\} onWorldReady=\{\(\)=>journeyCloud\.ready\("to-harbour"\)\}/);
    expect(app).toMatch(/useEffect\(\(\)=>\{if\(houseRoute\?\.surface==="journey"\)setHorizonRequest\(null\);\},\[houseRoute\?\.surface\]\);/);
    // All tools → a place (e.g. "The square") ends the Horizon visit: the Mountain again, on that place's route (review MINOR 1).
    const placePick = app.slice(app.indexOf("function openPlacePanel("), app.indexOf("const atlasHouseholdWords"));
    expect(placePick).toMatch(/if \(horizonRequest && household && Object\.hasOwn\(VILLAGE_ADDRESS, place\)\) \{\s*setHorizonRequest\(null\);\s*navigateHouseSurface\(\{ householdId: household\.householdId, scope: view, \.\.\.VILLAGE_ADDRESS\[place as keyof typeof VILLAGE_ADDRESS\] \}\);/);
    // The Era planner opens as a modal sheet from a crossroads (focus trap, Escape, focus return, inert behind: `useDialog`),
    // with the planner's own both-agree wiring.
    expect(app).toMatch(/const eraSheetRef = useDialog\(eraPlannerFor !== null, \(\) => closeEraPlanner\(\), \(\) => eraPlannerOpener\.current\);/);
    expect(app).toMatch(/eraPlannerFor !== null && \(\s*<div ref=\{eraSheetRef\} className="sheet journey-era-sheet" role="dialog" aria-modal="true" aria-label="Era planner">/);
    expect(app).toMatch(/<EraPlanner household=\{household\} memberId=\{actorId\} today=\{today\} busy=\{busy\} eras=\{pathEras\(household, today\)\} startEraId=\{eraPlannerFor\}/);
  });
});

describe("arrival lands on the Journey Board", () => {
  const fake = (): ArrivalSession & { store: Map<string, string> } => { const store = new Map<string, string>(); return { store, getItem: (k) => store.get(k) ?? null, setItem: (k, v) => { store.set(k, v); } }; };
  const identity = "development:HH-one:MEM-002:household";
  const saved: HouseRoute = { room: "study", level: "middle", householdId: "HH-one", scope: "household" };
  it("returns the household Journey route on a tab's first load", () => {
    const route = harbourArrivalRoute({ edition: "illustrated", saved, scope: "household", householdId: "HH-one", identity, session: fake(), enabled: true });
    expect(route).toEqual({ room: "kitchen-table", level: "above", householdId: "HH-one", scope: "household", surface: "journey" });
  });
  it("honours the saved route once the tab has arrived, and never touches Personal", () => {
    const session = fake();
    markArrived(session, identity);
    expect(harbourArrivalRoute({ edition: "illustrated", saved, scope: "household", householdId: "HH-one", identity, session, enabled: true })).toBe(saved);
    const personal: HouseRoute = { ...saved, scope: "personal" };
    expect(harbourArrivalRoute({ edition: "illustrated", saved: personal, scope: "personal", householdId: "HH-one", identity, session: fake(), enabled: true })).toBe(personal);
  });
  it("lands the reading edition on the Court, so the Desk opens as before (D65)", () => {
    const session = fake();
    expect(harbourArrivalRoute({ edition: "reading", saved, scope: "household", householdId: "HH-one", identity, session, enabled: true }))
      .toEqual({ room: "home", level: "middle", householdId: "HH-one", scope: "household" });
    expect(harbourArrivalRoute({ edition: "reading", saved, scope: "household", householdId: "HH-one", identity, session, enabled: true })).toBe(saved);
  });
  it("keeps the arrival seam in the App byte-identical, and passes the chosen edition explicitly", () => {
    expect(app).toMatch(/harbourArrivalRoute\(\{saved:saved\?\.route,scope:session\.view/);
    expect(app).toMatch(/session:tabSession\(\),edition:readMotionEdition\(\)==="flat"\?"reading":"illustrated"\}\)/);
  });
});

const identity = { environment: "development" as const, householdId: "HH-fixture-journey", memberId: "MEM-fixture-journey", scope: "household" as const };
const court: HouseRoute = { householdId: identity.householdId, scope: "household", room: "home", level: "middle" };
const baseProps = () => ({
  household: { environment: identity.environment, householdId: identity.householdId, members: [], personalLife: undefined, hearthside: undefined },
  memberId: identity.memberId, scope: identity.scope, route: court, today: "2026-09-28", ready: true, freshness: "current",
  onNavigate: () => undefined, onOpen: () => undefined, onClose: () => undefined, presence: { optedOut: true },
}) as unknown as HarbourWorldProps;

let host: HTMLDivElement, reactRoot: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  state.stage = null;
  host = document.createElement("div"); document.body.append(host); reactRoot = createRoot(host);
});
afterEach(async () => {
  await act(async () => reactRoot.unmount());
  host.remove();
  vi.unstubAllGlobals();
  try { localStorage.clear(); } catch { /* no storage */ }
});

describe("HarbourWorld picks the Horizon for an explicit request", () => {
  it("mounts the Horizon edition while `enterHorizonRequest` is set, and the Mountain without it", async () => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = (() => ({})) as unknown as typeof getContext;
    try {
      const request = { seq: 7, location: { x: 1200, y: 900 } };
      const household = seedDemoHousehold({ today: "2026-09-28" });
      const props = { ...baseProps(), household, memberId: household.members[0]!.id, route: { ...court, householdId: household.householdId }, presence: undefined } as HarbourWorldProps;
      await act(async () => reactRoot.render(createElement(HarbourWorld, { ...props, enterHorizonRequest: request })));
      await act(async () => { await new Promise((done) => setTimeout(done, 50)); });
      await vi.waitFor(() => expect(state.stage).not.toBeNull(), { timeout: 8000 });
      expect(state.stage!.initialBody).toEqual({ world: HORIZON_PRESENCE_WORLD, geo: HORIZON_GEOGRAPHY, place: "court", x: 1200, z: 900, yaw: 0 });

      state.stage = null;
      await act(async () => reactRoot.render(createElement(HarbourWorld, { ...props, enterHorizonRequest: null })));
      await act(async () => { await new Promise((done) => setTimeout(done, 50)); });
      expect(state.stage).toBeNull();
      expect(host.querySelector(".harbour-world")).not.toBeNull();
    } finally {
      HTMLCanvasElement.prototype.getContext = getContext;
    }
  });
  it("keeps the chooser's other ways into the Horizon", () => {
    const shell = readFileSync(join(root, "src", "harbour", "HarbourWorld.tsx"), "utf8");
    expect(shell).toMatch(/visit:homeBook\?\.visitRequested,request:props\.enterHorizonRequest/);
    // An unspent "Enter Horizon here" and a Home Book visit force the Horizon even from a room; a spent one does not.
    expect(harbourShellFor({ available: true, place: "bank", world: "mountain", request: { arrived: false } })).toBe("horizon");
    expect(harbourShellFor({ available: true, place: "bank", world: "horizon", request: { arrived: true } })).toBe("mountain");
    expect(harbourShellFor({ available: true, place: "court", world: "mountain", request: { arrived: true } })).toBe("horizon");
    expect(harbourShellFor({ available: true, place: "tower", world: "horizon", visit: true })).toBe("horizon");
  });
});

describe("HorizonWorld starts where the board asked", () => {
  const render = async (request: HarbourWorldProps["enterHorizonRequest"], extra: Partial<HarbourWorldProps> = {}) => {
    await act(async () => reactRoot.render(createElement(HorizonWorld, { ...baseProps(), enterHorizonRequest: request, ...extra })));
  };

  it("an {x, y} place becomes the initial body at {x, z: y} with no height, so the runtime grounds or snaps it", async () => {
    await render({ seq: 1, location: { x: 1494.5, y: 1165.25 } });
    const body = state.stage!.initialBody!;
    expect(body).toEqual({ world: HORIZON_PRESENCE_WORLD, geo: HORIZON_GEOGRAPHY, place: "court", x: 1494.5, z: 1165.25, yaw: 0 });
    expect("y" in body).toBe(false);
    // The body is already there: the ready hand-off does not move it again.
    const runtime = { arrive: vi.fn(), restore: vi.fn() };
    const ready = vi.fn();
    await render({ seq: 1, location: { x: 1494.5, y: 1165.25 } }, { onWorldReady: ready });
    act(() => { state.stage!.onRuntime!(runtime as never); state.stage!.onReady!(); });
    expect(runtime.arrive).not.toHaveBeenCalled();
    expect(runtime.restore).not.toHaveBeenCalled();
    expect(ready).toHaveBeenCalledOnce();
  });

  it("a host arrives at its door once per request, and a new request while standing moves the body", async () => {
    const ready = vi.fn();
    await render({ seq: 3, location: { host: "bank" } }, { onWorldReady: ready });
    // No saved body on this device: the stage starts where it would have; the host arrival follows the runtime.
    expect(state.stage!.initialBody).toBeUndefined();
    const runtime = { arrive: vi.fn(() => true), restore: vi.fn() };
    act(() => { state.stage!.onRuntime!(runtime as never); state.stage!.onReady!(); });
    expect(runtime.arrive).toHaveBeenCalledExactlyOnceWith("bank");
    expect(ready).toHaveBeenCalledOnce();
    act(() => { state.stage!.onReady!(); });
    expect(runtime.arrive).toHaveBeenCalledOnce();

    await render({ seq: 4, location: { x: 900, y: 700 } }, { onWorldReady: ready });
    expect(runtime.restore).toHaveBeenCalledExactlyOnceWith({ world: HORIZON_PRESENCE_WORLD, geo: HORIZON_GEOGRAPHY, place: "court", x: 900, z: 700, yaw: 0 });
    expect(runtime.restore.mock.calls[0]![0]).not.toHaveProperty("y");
  });

  it("without a request keeps the device's saved Horizon body", async () => {
    await render(null);
    expect(state.stage!.initialBody).toBeUndefined();
  });

  it("reports the arrival once per request, and a spent (arrived) request never moves a remounted body again", async () => {
    const arrived = vi.fn();
    await render({ seq: 5, location: { x: 1100, y: 800 } }, { onHorizonArrived: arrived });
    const runtime = { arrive: vi.fn(() => true), restore: vi.fn() };
    act(() => { state.stage!.onRuntime!(runtime as never); state.stage!.onReady!(); });
    expect(arrived).toHaveBeenCalledExactlyOnceWith(5);
    // The App marks it arrived; the same mount reports nothing more.
    await render({ seq: 5, location: { x: 1100, y: 800 }, arrived: true }, { onHorizonArrived: arrived });
    act(() => { state.stage!.onReady!(); });
    expect(arrived).toHaveBeenCalledOnce();

    // A remount (Books → back to the harbour) with the spent request: the device's saved body (none here), never the
    // board's entry point again, and no arrive / restore / report.
    await act(async () => reactRoot.unmount());
    reactRoot = createRoot(host);
    state.stage = null;
    await render({ seq: 5, location: { x: 1100, y: 800 }, arrived: true }, { onHorizonArrived: arrived });
    expect(state.stage!.initialBody).toBeUndefined();
    const again = { arrive: vi.fn(() => true), restore: vi.fn() };
    act(() => { state.stage!.onRuntime!(again as never); state.stage!.onReady!(); });
    expect(again.arrive).not.toHaveBeenCalled();
    expect(again.restore).not.toHaveBeenCalled();
    expect(arrived).toHaveBeenCalledOnce();
  });
});

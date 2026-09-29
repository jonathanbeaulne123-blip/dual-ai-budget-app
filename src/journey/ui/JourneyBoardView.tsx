/**
 * The Journey Board view (T4): the board, the land and the scene are INJECTED, so the whole surface is testable in
 * jsdom (flat twin) and the live entry (`JourneyBoard.tsx`) only loads and derives.
 *
 * Layout (DOM = keyboard order): summary → chapter strip (chapters → Map / List → Back to now) → zoom / Enter Horizon
 * → the stage's marks (chronological) → the panel. A live region announces what is selected.
 *
 * Invariants: selecting, hovering, zooming, moving the day, Back to now and previewing a crossroads call NO action —
 * they change the view only. An action runs only when its own button is pressed, exactly once, through
 * `runJourneyAction` (the map panel and the list share the stop's `actions[]`).
 */
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactElement } from "react";
import type {
  CameraTier, ChapterId, DateKey, HorizonLocation, JourneyBoard, JourneyBoardActions, JourneyLandData, JourneyLandHandle, JourneyViewState,
  MarkAnchor, PieceLookId, PlaceRef, RouteSpace, ThemeId,
} from "../contracts.ts";
import { DEFAULT_JOURNEY_VIEW_STATE, runJourneyAction } from "../contracts.ts";
import { boardToList } from "../model/index.ts";
import {
  boardMarks, daySpaceFor, NO_SAFE_AREA, stretchMidpoint, uncoveredRect, type BoardSceneHandle, type BoardSceneOptions, type FocusTarget, type JourneyBoardSceneExtras,
  type LabelBox, type PreviewSelection, type SafeArea,
} from "../board/index.ts";
import { BoardSummary } from "./BoardSummary.tsx";
import { ChapterStrip } from "./ChapterStrip.tsx";
import { COPY, KIND_WORDS, monthWords, shortDate } from "./copy.ts";
import { CrossroadsPanel } from "./CrossroadsPanel.tsx";
import { JourneyList, journeyListChapterDomId, journeyRowDomId } from "./JourneyList.tsx";
import { journeyMarkDomId, markEntries, Marks } from "./Marks.tsx";
import { PiecePanel } from "./PieceLook.tsx";
import { Stage, type FlatView, type StageMode, type StageSize } from "./Stage.tsx";
import { ChapterPanel, ClusterPanel, StopPanel } from "./StopPanel.tsx";
import { HORIZON_AVAILABLE } from "../../harbour/flag.ts";
import "./journey-board.css";

export type JourneyStageSource = {
  mode: StageMode;
  status: "loading" | "failed";
  land: JourneyLandData | null;
  landHandle: JourneyLandHandle | null;
  route: RouteSpace | null;
  quality: "full" | "lite";
};

export type JourneyBoardViewProps = {
  board: JourneyBoard;
  actions: JourneyBoardActions;
  theme: ThemeId;
  reducedMotion: boolean;
  stage: JourneyStageSource;
  freshnessNote?: string | null;
  nameOf?: (memberId: string) => string;
  initialViewState?: JourneyViewState;
  onViewStateChange?: (state: JourneyViewState) => void;
  /** The state about to be left for Horizon (the store flushes it before the board unmounts). */
  onBeforeEnterHorizon?: (state: JourneyViewState) => void;
  /** Returning from Horizon (`lastEnter`), or the route's `time`: frame this instead of the saved view. */
  initialFocusOverride?: { target: FocusTarget; tier: CameraTier } | null;
  sceneExtras?: JourneyBoardSceneExtras;
  createScene?: (host: HTMLElement, options: BoardSceneOptions) => BoardSceneHandle;
  onLost?: () => void;
  onReady?: () => void;
};

// ---------------------------------------------------------------------------------------------------------------
// Small pure helpers.

const TIERS: readonly CameraTier[] = ["sky", "region", "stop"];
/** Chrome that sits over the stage: no mark label may hide under it. */
const CHROME = ".journey-summary, .journey-toolbar, .journey-panel, .journey-strip";
/**
 * The chrome the camera frames clear of. Wide: the toolbar is small and floats (labels avoid it, framing does not).
 * Phone: the stage is narrow, so the toolbar's column counts too — "We are here" never opens under the zoom buttons.
 */
const FRAMING_CHROME = new Set(["journey-summary", "journey-panel", "journey-strip"]);
const PHONE_FRAMING_CHROME = new Set([...FRAMING_CHROME, "journey-toolbar"]);
/**
 * The App's bottom Compass (the door edition of the glass bar, `nav[data-harbour-bar]`, fixed, z 25). The App's own
 * `--mobile-bottom-clearance` (the 76 px `--nav`) is shorter than the bar as drawn, so the board measures the bar:
 * on phones (a full-width bar) its height becomes `--jb-compass` (the board's `--jb-bottom`); wide (a floating pill)
 * it becomes `--jb-float-bottom` (the side panel ends above it). Either way it is a label obstacle. Read-only: the
 * board never styles or moves the App's bar.
 */
const COMPASS = "[data-harbour-bar]";
export type CompassClearance = { phone: number | null; float: number | null };
/** How much of the viewport's bottom a bar rect covers: a full-width bar → phone clearance; a narrower one → float. */
export function compassClearance(bar: { left: number; right: number; top: number; bottom: number } | null, viewport: { width: number; height: number }): CompassClearance {
  if (!bar || !(bar.right - bar.left > 0) || !(bar.bottom - bar.top > 0) || bar.top >= viewport.height) return { phone: null, float: null };
  const covered = Math.ceil(Math.max(0, viewport.height - bar.top));
  return bar.right - bar.left >= viewport.width * 0.9 ? { phone: covered, float: null } : { phone: null, float: covered };
}

/**
 * Stage px covered on each side by the framing chrome: each box (clipped to the stage) becomes whichever edge band
 * costs the stage less — the wide summary card is a left band, a side panel a right band, the phone sheet a bottom band.
 */
export function safeAreaFor(boxes: readonly LabelBox[], width: number, height: number): SafeArea {
  const safe = { top: 0, right: 0, bottom: 0, left: 0 };
  if (!(width > 0 && height > 0)) return safe;
  for (const b of boxes) {
    const x0 = Math.max(0, b.x0), x1 = Math.min(width, b.x1), y0 = Math.max(0, b.y0), y1 = Math.min(height, b.y1);
    if (x1 - x0 < 1 || y1 - y0 < 1) continue;
    const band = { top: y1 / height, bottom: (height - y0) / height, left: x1 / width, right: (width - x0) / width };
    const vertical = Math.min(band.top, band.bottom), horizontal = Math.min(band.left, band.right);
    if (vertical <= horizontal) { if (band.top <= band.bottom) safe.top = Math.max(safe.top, y1); else safe.bottom = Math.max(safe.bottom, height - y0); }
    else if (band.left <= band.right) safe.left = Math.max(safe.left, x1);
    else safe.right = Math.max(safe.right, width - x0);
  }
  const r = (v: number) => Math.round(v);
  return { top: r(safe.top), right: r(safe.right), bottom: r(safe.bottom), left: r(safe.left) };
}
const utc = (date: string) => { const [y, m, d] = date.split("-").map(Number) as [number, number, number]; return Date.UTC(y, m - 1, d); };
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10) as DateKey;
export const addDays = (date: string, n: number): DateKey => iso(utc(date) + n * 86_400_000);
const daysInMonth = (month: string) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
export function addMonths(date: string, n: number): DateKey {
  const y = Number(date.slice(0, 4)), m = Number(date.slice(5, 7)) - 1 + n;
  const month = `${Math.floor(y + Math.floor(m / 12))}-${String(((m % 12) + 12) % 12 + 1).padStart(2, "0")}`;
  return `${month}-${String(Math.min(Number(date.slice(8, 10)), daysInMonth(month))).padStart(2, "0")}` as DateKey;
}
const firstDay = (month: string) => `${month}-01` as DateKey;
const lastDay = (month: string) => `${month}-${String(daysInMonth(month)).padStart(2, "0")}` as DateKey;
const clampDate = (date: DateKey, board: JourneyBoard): DateKey => {
  const lo = firstDay(board.window.from), hi = lastDay(board.window.to);
  return date < lo ? lo : date > hi ? hi : date;
};

/** Where a stop's place is, for "Enter Horizon here" (host → its own arrival; other places → their coordinates). */
export function horizonLocationFor(place: PlaceRef | undefined, land: JourneyLandData | null): HorizonLocation | null {
  if (!place) return null;
  if (place.kind === "host") return { host: place.id };
  if (!land) return null;
  const xy = (p: readonly [number, number] | undefined | null) => (p ? { x: p[0], y: p[1] } : null);
  switch (place.kind) {
    case "station": return xy(land.stations.find((s) => s.id === place.id)?.anchor);
    case "reserve": return xy(land.reserves.find((r) => r.id === place.id)?.door);
    case "homestead": return xy(land.homestead.find((h) => h.id === place.id)?.anchor);
    case "kittyPlaza": return xy(land.kittyPlaza.xy);
  }
}

function sanitize(state: JourneyViewState, board: JourneyBoard): JourneyViewState {
  const known = new Set<string>(["piece", ...board.chapters.map((c) => c.id), ...board.stops.map((s) => s.id), ...board.clusters.map((c) => c.id), ...board.crossroads.map((c) => c.id)]);
  return {
    ...state,
    selectedStopId: state.selectedStopId && known.has(state.selectedStopId) ? state.selectedStopId : null,
    expandedClusterId: state.expandedClusterId && board.clusters.some((c) => c.id === state.expandedClusterId) ? state.expandedClusterId : null,
    focusDate: state.focusDate ? clampDate(state.focusDate, board) : null,
  };
}

// ---------------------------------------------------------------------------------------------------------------

export function JourneyBoardView(props: JourneyBoardViewProps) {
  const { board, actions, theme, reducedMotion, stage } = props;
  const [vs, setVs] = useState<JourneyViewState>(() => sanitize(props.initialViewState ?? DEFAULT_JOURNEY_VIEW_STATE, board));
  const [preview, setPreviewState] = useState<PreviewSelection | null>(null);
  const [clusterReturn, setClusterReturn] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [sceneTier, setSceneTier] = useState<CameraTier>(vs.tier);
  const [scene, setScene] = useState<BoardSceneHandle | null>(null);
  const [centreOnLand, setCentreOnLand] = useState(false);
  const [obstacles, setObstacles] = useState<LabelBox[]>([]);
  const [safeArea, setSafeArea] = useState<SafeArea>(NO_SAFE_AREA);
  const [compass, setCompass] = useState<CompassClearance>({ phone: null, float: null });
  const [stageBox, setStageBox] = useState<StageSize | null>(null);
  const panelSlotId = `journey-panel-${useId().replace(/[^A-Za-z0-9-]/g, "")}`;
  const root = useRef<HTMLElement | null>(null);
  const stageSize = useRef<StageSize>({ width: 390, height: 600 });
  const origin = useRef<Element | null>(null);
  const focusPanel = useRef(false);
  const panelHeading = useRef<HTMLHeadingElement | null>(null);
  const readySent = useRef(false);
  const live = stage.mode === "live";
  /** "Enter Horizon here" is offered only where the Horizon can mount (development, or live under D15). */
  const canEnterHorizon = live && HORIZON_AVAILABLE;

  const onViewStateChange = useRef(props.onViewStateChange);
  onViewStateChange.current = props.onViewStateChange;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    onViewStateChange.current?.(vs);
  }, [vs]);
  const patch = useCallback((p: Partial<JourneyViewState>) => setVs((prev) => ({ ...prev, ...p })), []);

  // A new board (a sync, a record elsewhere): keep the selection only while it still exists.
  useEffect(() => { setVs((prev) => { const next = sanitize(prev, board); return next.selectedStopId === prev.selectedStopId && next.expandedClusterId === prev.expandedClusterId && next.focusDate === prev.focusDate ? prev : next; }); }, [board]);

  const rows = useMemo(() => boardToList(board), [board]);
  const rowsById = useMemo(() => new Map(rows.map((r) => [r.id, r] as const)), [rows]);
  const entries = useMemo(() => markEntries(board, (id) => { const r = rowsById.get(id); return r ? { amount: r.amountText, status: r.statusText } : undefined; }), [board, rowsById]);
  const sceneBoard = useMemo<JourneyBoard>(() => (board.piece.lookId === vs.pieceLook ? board : { ...board, piece: { ...board.piece, lookId: vs.pieceLook } }), [board, vs.pieceLook]);
  const stopById = useMemo(() => new Map(board.stops.map((s) => [s.id, s] as const)), [board]);
  const clusterById = useMemo(() => new Map(board.clusters.map((c) => [c.id, c] as const)), [board]);
  const clusterOfStop = useMemo(() => new Map(board.clusters.flatMap((c) => c.stopIds.map((id) => [id, c.id] as const))), [board]);
  const crossById = useMemo(() => new Map(board.crossroads.map((c) => [c.id, c] as const)), [board]);
  const chapterById = useMemo(() => new Map(board.chapters.map((c) => [c.id, c] as const)), [board]);

  // --- where things stand (for the flat twin's camera and the initial live focus) ---------------------------------
  const marks = useMemo(() => (stage.route ? boardMarks(sceneBoard, stage.route) : []), [sceneBoard, stage.route]);
  const pointOf = useCallback((target: FocusTarget): { x: number; y: number } | null => {
    const route = stage.route;
    if (!route) return null;
    if (target === "piece") { const m = marks.find((mk) => mk.kind === "piece"); return m ? { x: m.base[0], y: m.base[2] } : null; }
    if ("date" in target) { const d = daySpaceFor(route, target.date); return d ? { x: d.at[0], y: d.at[2] } : null; }
    if ("chapterId" in target) { const p = stretchMidpoint(route, target.chapterId as ChapterId); return p ? { x: p[0], y: p[2] } : null; }
    return { x: target.x, y: target.y };
  }, [stage.route, marks]);

  // The view as it was restored on mount (the scene and the flat twin open on it; later moves never re-open).
  const mounted = useRef(vs);
  const initialFocus = useMemo<{ target: FocusTarget; tier: CameraTier }>(() => {
    if (props.initialFocusOverride) return props.initialFocusOverride;
    const v = mounted.current;
    if (v.target) return { target: v.target, tier: v.tier };
    if (v.focusDate) return { target: { date: v.focusDate }, tier: v.tier };
    return { target: "piece", tier: v.tier };
  }, [props.initialFocusOverride]);

  const [flatView, setFlatView] = useState<FlatView | null>(null);
  useEffect(() => {
    if (flatView || !stage.route) return;
    const p = pointOf(initialFocus.target) ?? pointOf("piece") ?? { x: 1000, y: 900 };
    setFlatView({ ...p, tier: initialFocus.tier });
  }, [flatView, stage.route, pointOf, initialFocus]);
  const tier: CameraTier = live ? sceneTier : flatView?.tier ?? vs.tier;

  // Flat camera → view state (the live camera is saved from frames, below).
  useEffect(() => {
    if (live || !flatView) return;
    setVs((prev) => (prev.tier === flatView.tier && prev.target?.x === flatView.x && prev.target?.y === flatView.y ? prev : { ...prev, tier: flatView.tier, target: { x: flatView.x, y: flatView.y } }));
  }, [live, flatView]);

  // --- ready -----------------------------------------------------------------------------------------------------
  const sendReady = useCallback(() => {
    if (readySent.current) return;
    readySent.current = true;
    props.onReady?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    // The list is a complete board on its own: a saved "list" choice is ready as soon as it renders.
    if (vs.listMode === "list") sendReady();
    if (stage.mode === "flat" && stage.route && flatView) sendReady();
    if (stage.mode === "none" && stage.status === "failed") sendReady();
  }, [vs.listMode, stage.mode, stage.route, stage.status, flatView, sendReady]);

  // --- camera ------------------------------------------------------------------------------------------------------
  const animate = !reducedMotion;
  /**
   * The summary card, a side panel and the phone sheet sit over the stage: the scene frames every target (and the
   * whole island at Sky) inside the UNCOVERED rect (`setSafeArea`, measured with the label obstacles below), so
   * "We are here" and the island are never hidden under the card.
   */
  /**
   * The last explicit framing (the mount's, Back to now, a chapter, a revealed stop, a keyboard move) and whether the
   * person has moved the camera since (drag, wheel, pinch, zoom). Until they do, a new stage size — a rotation, a
   * resized window — frames it again inside the new uncovered rect, so "We are here" never lands off the stage.
   */
  const framing = useRef<{ target: FocusTarget; tier: CameraTier }>(initialFocus);
  const pristine = useRef(true);
  const cameraTaken = useCallback(() => { pristine.current = false; }, []);
  const frameTo = useCallback((target: FocusTarget, nextTier: CameraTier, animated = animate) => {
    framing.current = { target, tier: nextTier };
    pristine.current = true;
    if (live) { scene?.focus(target, nextTier, animated); return; }
    const p = pointOf(target);
    setFlatView((prev) => ({ ...(p ?? prev ?? { x: 1000, y: 900 }), tier: nextTier }));
  }, [live, scene, animate, pointOf]);
  // A new scene, or the chrome moved: the scene re-frames a pristine / flying view and holds any other still.
  useLayoutEffect(() => { if (live) scene?.setSafeArea?.(safeArea); }, [live, scene, safeArea]);
  /** The centre of the uncovered stage (where framing puts its target; "Enter Horizon here" reads the ground there). */
  const openCentre = useCallback(() => {
    const { width, height } = stageSize.current;
    const open = uncoveredRect(width, height, safeArea);
    return { x: open.cx, y: open.cy };
  }, [safeArea]);

  const cameraSave = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (cameraSave.current) clearTimeout(cameraSave.current); }, []);
  const onFrame = useCallback((_anchors: readonly MarkAnchor[]) => {
    if (!live || !scene) return;
    const view = scene.view();
    if (view.tier === "stop") {
      const c = openCentre();
      const at = scene.groundAt(c.x, c.y);
      setCentreOnLand(Boolean(at && (stage.landHandle ? stage.landHandle.isLand(at.x, at.y) : true)));
    }
    if (cameraSave.current) clearTimeout(cameraSave.current);
    cameraSave.current = setTimeout(() => {
      setVs((prev) => (prev.tier === view.tier && prev.target?.x === Math.round(view.x) && prev.target?.y === Math.round(view.y) ? prev : { ...prev, tier: view.tier, target: { x: Math.round(view.x), y: Math.round(view.y) } }));
    }, 300);
  }, [live, scene, stage.landHandle, openCentre]);

  const zoom = useCallback((dir: 1 | -1) => {
    cameraTaken();
    if (live) { scene?.zoomBy(dir > 0 ? 0.5 : 2, animate); return; }
    setFlatView((prev) => {
      if (!prev) return prev;
      const i = Math.min(TIERS.length - 1, Math.max(0, TIERS.indexOf(prev.tier) + dir));
      return { ...prev, tier: TIERS[i]! };
    });
  }, [live, scene, animate, cameraTaken]);

  const announce = useCallback((words: string) => setAnnouncement(words), []);

  const backToNow = useCallback(() => {
    // A clean "now" (PR #567 review): the open panel, its cluster and any preview close in the same action.
    patch({ focusDate: null, target: null, tier: "region", selectedStopId: null, expandedClusterId: null });
    setPreviewState(null);
    setClusterReturn(null);
    frameTo("piece", "region");
    announce(`${COPY.backToNow} · ${shortDate(board.today)} · ${board.summary.periodLabel}`);
  }, [patch, frameTo, announce, board]);

  const dayWords = useCallback((date: DateKey) => {
    const onDay = board.stops.filter((s) => s.date === date);
    const cross = board.crossroads.filter((c) => c.date === date);
    const things = [...onDay.map((s) => s.label), ...cross.map((c) => c.label)];
    return things.length ? `${shortDate(date)} · ${things.join(", ")}` : `${shortDate(date)} · nothing on this day`;
  }, [board]);

  const moveTo = useCallback((date: DateKey) => {
    const next = clampDate(date, board);
    patch({ focusDate: next, target: null });
    frameTo(tier === "sky" ? { chapterId: next.slice(0, 7) as ChapterId } : { date: next }, tier);
    announce(tier === "sky" ? monthWords(next.slice(0, 7)) : dayWords(next));
  }, [board, patch, frameTo, tier, announce, dayWords]);

  const onChapter = useCallback((id: string) => {
    const chapter = chapterById.get(id as ChapterId);
    if (!chapter) return;
    const date = chapter.state === "open" ? board.today : chapter.state === "past" ? lastDay(id) : firstDay(id);
    patch({ focusDate: date, target: null });
    if (vs.listMode === "list") {
      const heading = typeof document !== "undefined" ? document.getElementById(journeyListChapterDomId(id)) : null;
      heading?.scrollIntoView?.({ block: "start", behavior: reducedMotion ? "auto" : "smooth" });
      heading?.focus?.();
    } else {
      frameTo({ chapterId: id as ChapterId }, tier === "stop" ? "region" : tier === "sky" ? "region" : tier);
    }
    announce(`${chapter.label} · ${chapter.state === "open" ? "this month" : chapter.state}`);
  }, [chapterById, board.today, patch, vs.listMode, reducedMotion, frameTo, tier, announce]);

  // --- selection (inert) -----------------------------------------------------------------------------------------
  const selectionWords = useCallback((id: string): string => {
    if (id === "piece") return `${COPY.weAreHere} · ${shortDate(board.today)}`;
    const stop = stopById.get(id);
    if (stop) { const r = rowsById.get(id); return [KIND_WORDS[stop.kind], stop.label, shortDate(stop.date), r?.amountText, r?.statusText].filter(Boolean).join(" · "); }
    const cluster = clusterById.get(id);
    if (cluster) return cluster.label;
    const cross = crossById.get(id);
    if (cross) return `Crossroads · ${cross.label}`;
    const chapter = chapterById.get(id as ChapterId);
    return chapter ? `${chapter.label} · ${rowsById.get(id)?.statusText ?? ""}` : id;
  }, [board.today, stopById, rowsById, clusterById, crossById, chapterById]);

  const select = useCallback((id: string | null, opts: { fromCluster?: string | null; reveal?: boolean } = {}) => {
    if (id === null) return;
    origin.current = typeof document !== "undefined" ? document.activeElement : null;
    const cluster = clusterById.has(id) ? id : clusterOfStop.get(id) ?? null;
    patch({ selectedStopId: id, expandedClusterId: cluster });
    setClusterReturn(opts.fromCluster ?? null);
    if (!crossById.has(id)) setPreviewState(null);
    focusPanel.current = true;
    announce(`Selected · ${selectionWords(id)}`);
    const stop = stopById.get(id) ?? crossById.get(id);
    if (opts.reveal && stop && vs.listMode === "map") frameTo({ date: stop.date }, tier === "sky" ? "region" : tier);
  }, [clusterById, clusterOfStop, crossById, stopById, patch, announce, selectionWords, vs.listMode, frameTo, tier]);

  const onPick = useCallback((id: string | null) => {
    if (id === null) return;
    // A day space picks as its date: open what stands on it (cluster / stop), else nothing.
    if (/^\d{4}-\d{2}-\d{2}$/.test(id)) {
      const cluster = board.clusters.find((c) => c.date === id);
      const stop = board.stops.find((s) => s.date === id);
      if (cluster) select(cluster.id); else if (stop) select(stop.id); else { patch({ focusDate: id as DateKey }); announce(dayWords(id as DateKey)); }
      return;
    }
    select(id);
  }, [board, select, patch, announce, dayWords]);

  const setPreview = useCallback((next: PreviewSelection | null) => {
    setPreviewState(next);
    const cross = next ? crossById.get(next.crossroadsId) : undefined;
    const alt = cross?.alternatives.find((a) => a.id === next?.alternativeId);
    announce(alt ? (alt.isCurrent ? `${COPY.currentChoice}: ${alt.label}` : `${COPY.previewBanner} · ${alt.label}`) : "Returned · nothing has changed");
  }, [crossById, announce]);

  const selected = vs.selectedStopId;
  const closePanel = useCallback(() => {
    const id = selected;
    patch({ selectedStopId: null, expandedClusterId: null });
    setPreviewState(null);
    setClusterReturn(null);
    announce("Closed");
    if (!id || typeof document === "undefined") return;
    const usable = (el: Element | null): el is HTMLElement => Boolean(el && el.isConnected && !(el as HTMLElement).hidden && !(el as HTMLElement).closest?.("[data-journey-panel]"));
    const clusterId = clusterOfStop.get(id);
    const candidates = [
      origin.current,
      document.getElementById(journeyMarkDomId(id)),
      clusterId ? document.getElementById(journeyMarkDomId(clusterId)) : null,
      document.getElementById(journeyRowDomId(id)),
      root.current?.querySelector(".journey-stage") ?? null,
    ];
    const target = candidates.find(usable);
    // After React commits the closed panel.
    queueMicrotask(() => target?.focus?.());
  }, [selected, patch, announce, clusterOfStop]);

  useLayoutEffect(() => {
    if (focusPanel.current && selected && panelHeading.current) { focusPanel.current = false; panelHeading.current.focus(); }
  });

  // --- Enter Horizon (explicit only; never on flat) ----------------------------------------------------------------
  const enterHorizon = useCallback((location: HorizonLocation) => {
    const next: JourneyViewState = { ...vs, lastEnter: { location, tier, focusDate: vs.focusDate } };
    setVs(next);
    props.onBeforeEnterHorizon?.(next);
    runJourneyAction(actions, { name: "enterHorizon", location });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vs, tier, actions, props.onBeforeEnterHorizon]);
  const enterHere = useCallback(() => {
    if (!scene) return;
    const c = openCentre();
    const at = scene.groundAt(c.x, c.y);
    if (!at || (stage.landHandle && !stage.landHandle.isLand(at.x, at.y))) { announce(COPY.enterHorizonOverWater); return; }
    enterHorizon({ x: Math.round(at.x), y: Math.round(at.y) });
  }, [scene, stage.landHandle, enterHorizon, announce, openCentre]);

  // --- keyboard ----------------------------------------------------------------------------------------------------
  const onStageKey = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    const onStage = e.target === e.currentTarget;
    const current = vs.focusDate ?? board.today;
    let handled = true;
    switch (e.key) {
      case "ArrowRight": moveTo(tier === "sky" ? addMonths(current, 1) : addDays(current, 1)); break;
      case "ArrowLeft": moveTo(tier === "sky" ? addMonths(current, -1) : addDays(current, -1)); break;
      case "PageDown": moveTo(addMonths(current, 1)); break;
      case "PageUp": moveTo(addMonths(current, -1)); break;
      case "Home": backToNow(); break;
      case "+": case "=": zoom(1); break;
      case "-": case "_": zoom(-1); break;
      case "Enter":
        if (!onStage) { handled = false; break; }
        {
          const cluster = board.clusters.find((c) => c.date === current);
          const stop = board.stops.find((s) => s.date === current);
          const cross = board.crossroads.find((c) => c.date === current);
          if (cluster) select(cluster.id); else if (stop) select(stop.id); else if (cross) select(cross.id);
          else if (current === lastDay(current.slice(0, 7))) select(current.slice(0, 7));
          else announce(dayWords(current));
        }
        break;
      default: handled = false;
    }
    if (handled) e.preventDefault();
  }, [vs.focusDate, board, tier, moveTo, backToNow, zoom, select, announce, dayWords]);

  const onRootKey = useCallback((e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Escape" && selected) { e.preventDefault(); e.stopPropagation(); closePanel(); }
  }, [selected, closePanel]);

  // --- chrome that labels must avoid -------------------------------------------------------------------------------
  const measureChrome = useCallback(() => {
    const el = root.current;
    if (!el) return;
    const win = el.ownerDocument?.defaultView ?? null;
    const viewport = { width: win?.innerWidth ?? 0, height: win?.innerHeight ?? 0 };
    // The App's Compass first: it sets the board's own bottom clearance (a height change re-measures via the stage).
    const bar = el.ownerDocument?.querySelector?.(COMPASS) ?? null;
    const barRect = bar && typeof bar.getBoundingClientRect === "function" ? bar.getBoundingClientRect() : null;
    const clear = viewport.width > 0 && viewport.height > 0 ? compassClearance(barRect, viewport) : { phone: null, float: null };
    setCompass((prev) => (prev.phone === clear.phone && prev.float === clear.float ? prev : clear));
    const st = el.querySelector(".journey-stage");
    if (!st || typeof st.getBoundingClientRect !== "function") return;
    const base = st.getBoundingClientRect();
    if (!base.width) return;
    const phone = viewport.width > 0 && viewport.width < 720;
    const framingSet = phone ? PHONE_FRAMING_CHROME : FRAMING_CHROME;
    const framing: LabelBox[] = [];
    const toBox = (r: DOMRect) => ({ x0: r.left - base.left, x1: r.right - base.left, y0: r.top - base.top, y1: r.bottom - base.top });
    const onStage = (box: LabelBox) => box.x1 > 0 && box.y1 > 0 && box.x0 < base.width && box.y0 < base.height;
    const boxes = [...el.querySelectorAll(CHROME)].flatMap((node) => {
      const r = node.getBoundingClientRect();
      if (!r.width || !r.height) return [];
      const box = toBox(r);
      if (!onStage(box)) return [];
      if ([...node.classList].some((c) => framingSet.has(c))) framing.push(box);
      return [box];
    });
    // The Compass over the stage (the wide pill always; a phone bar only if the App's clearance ever falls short):
    // labels avoid it, and on phones the camera frames clear of it too.
    if (barRect && barRect.width && barRect.height) {
      const box = toBox(barRect);
      if (onStage(box)) { boxes.push(box); if (phone) framing.push(box); }
    }
    // One measurement feeds both: label obstacles (placeLabels) and the camera's safe area.
    setObstacles((prev) => (JSON.stringify(prev) === JSON.stringify(boxes) ? prev : boxes));
    const safe = safeAreaFor(framing, base.width, base.height);
    setSafeArea((prev) => (prev.top === safe.top && prev.right === safe.right && prev.bottom === safe.bottom && prev.left === safe.left ? prev : safe));
  }, []);
  /** The stage's box changed (rotation, a resized window, the Compass clearance): measure the chrome in the same batch. */
  const onStageSize = useCallback((size: StageSize) => {
    measureChrome();
    setStageBox((prev) => (prev && prev.width === size.width && prev.height === size.height ? prev : size));
  }, [measureChrome]);
  // Every commit (a panel grows when a preview shows its changes), plus any resize of the chrome itself.
  useLayoutEffect(measureChrome);
  useEffect(() => {
    const el = root.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measureChrome());
    for (const node of el.querySelectorAll(CHROME)) observer.observe(node);
    const bar = el.ownerDocument?.querySelector?.(COMPASS);
    if (bar) observer.observe(bar);
    return () => observer.disconnect();
  }, [measureChrome, selected, summaryOpen, vs.listMode, stage.mode]);
  useEffect(() => {
    const win = root.current?.ownerDocument?.defaultView;
    if (!win) return;
    const onResize = () => measureChrome();
    win.addEventListener("resize", onResize);
    return () => win.removeEventListener("resize", onResize);
  }, [measureChrome]);

  // A new stage size while the camera is still ours (nothing moved it since the last framing): frame that again, as a
  // cut, inside the new uncovered rect (after the scene has its new size and safe area — child effects run first).
  const framedSize = useRef<string | null>(null);
  useEffect(() => {
    if (!live || !scene || !stageBox) return;
    const key = `${stageBox.width}x${stageBox.height}`;
    if (framedSize.current === null) { framedSize.current = key; return; }
    if (framedSize.current === key) return;
    framedSize.current = key;
    // The scene clamps a safe area to the size it had when it arrived (the layout effect above runs before the stage's
    // resize reaches the scene): hand it over again at the new size.
    scene.setSafeArea?.(safeArea);
    if (!pristine.current) return;
    scene.focus(framing.current.target, framing.current.tier, false);
  }, [live, scene, stageBox, safeArea]);

  // --- panel -------------------------------------------------------------------------------------------------------
  const headingRef = (el: HTMLHeadingElement | null) => { panelHeading.current = el; };
  let panel: ReactElement | null = null;
  if (selected === "piece") {
    panel = <PiecePanel board={board} look={vs.pieceLook} onLook={(look: PieceLookId) => { patch({ pieceLook: look }); announce(`Piece look · ${look}`); }} onSelect={(id) => select(id)} onClose={closePanel} headingRef={headingRef} />;
  } else if (selected && stopById.has(selected)) {
    const stop = stopById.get(selected)!;
    const back = clusterReturn && clusterById.get(clusterReturn);
    panel = (
      <StopPanel
        key={stop.id}
        stop={stop}
        row={rowsById.get(stop.id)}
        actions={actions}
        onClose={closePanel}
        horizonLocation={canEnterHorizon ? horizonLocationFor(stop.placeRef, stage.land) : null}
        onEnterHorizon={enterHorizon}
        back={back ? { label: `${COPY.backToCluster} · ${back.label}`, onBack: () => select(back.id) } : null}
        nameOf={props.nameOf}
        headingRef={headingRef}
      />
    );
  } else if (selected && clusterById.has(selected)) {
    const cluster = clusterById.get(selected)!;
    panel = <ClusterPanel key={cluster.id} cluster={cluster} stops={cluster.stopIds.map((id) => stopById.get(id)).filter((s): s is NonNullable<typeof s> => Boolean(s))} rows={rowsById} onClose={closePanel} onSelectStop={(id) => select(id, { fromCluster: cluster.id })} headingRef={headingRef} />;
  } else if (selected && crossById.has(selected)) {
    panel = <CrossroadsPanel key={selected} crossroads={crossById.get(selected)!} actions={actions} preview={preview} onPreview={setPreview} onClose={closePanel} nameOf={props.nameOf} headingRef={headingRef} />;
  } else if (selected && chapterById.has(selected as ChapterId)) {
    const chapter = chapterById.get(selected as ChapterId)!;
    panel = <ChapterPanel key={chapter.id} chapter={chapter} row={rowsById.get(chapter.id)} stops={board.stops.filter((s) => s.chapterId === chapter.id)} crossroads={board.crossroads.filter((c) => c.chapterId === chapter.id)} rows={rowsById} onClose={closePanel} onSelect={(id) => select(id)} headingRef={headingRef} />;
  }

  const focusedChapter = (vs.focusDate ?? board.today).slice(0, 7);
  const previewTag = live && preview ? `preview:${preview.crossroadsId}` : null;
  const listMode = vs.listMode;
  const className = [
    "journey-board", `journey-board--${theme}`, `journey-board--${stage.mode}`, `journey-board--${listMode}`,
    reducedMotion ? "journey-board--still" : "journey-board--animated", panel ? "has-panel" : "", board.empty ? "journey-board--empty" : "",
  ].filter(Boolean).join(" ");
  // The measured Compass (see COMPASS); absent (tests, a host without the bar), the CSS falls back to the App's variable.
  const rootStyle = {
    ...(compass.phone !== null ? { "--jb-compass": `${compass.phone}px` } : {}),
    ...(compass.float !== null ? { "--jb-float-bottom": `${compass.float}px` } : {}),
  } as CSSProperties;

  return (
    <section
      ref={root} className={className} style={rootStyle} aria-label={COPY.boardLabel} data-journey-board="" data-theme={theme} data-tier={tier}
      data-safe-area={`${safeArea.top} ${safeArea.right} ${safeArea.bottom} ${safeArea.left}`} onKeyDown={onRootKey}
    >
      <BoardSummary board={board} rows={rowsById} actions={actions} onSelect={(id) => { setSummaryOpen(false); select(id, { reveal: true }); }} freshnessNote={props.freshnessNote} expanded={summaryOpen} onToggle={() => setSummaryOpen((v) => !v)} />
      <ChapterStrip chapters={board.chapters} focusedChapterId={focusedChapter} onChapter={onChapter} onBackToNow={backToNow}>
        <div className="journey-toggle" role="group" aria-label={COPY.mapOrList}>
          <button type="button" className="journey-toggle__option" aria-pressed={listMode === "map"} data-list-mode="map" onClick={() => patch({ listMode: "map" })}>{COPY.showMap}</button>
          <button type="button" className="journey-toggle__option" aria-pressed={listMode === "list"} data-list-mode="list" onClick={() => patch({ listMode: "list" })}>{COPY.showList}</button>
        </div>
      </ChapterStrip>
      {listMode === "map" ? (
        <>
          {stage.mode !== "none" ? (
            <div className="journey-toolbar" role="group" aria-label="Map view">
              <button type="button" className="journey-toolbar__zoom" aria-label={COPY.zoomOut} data-zoom="out" disabled={!live && tier === "sky"} onClick={() => zoom(-1)}><span aria-hidden="true">−</span></button>
              <button type="button" className="journey-toolbar__zoom" aria-label={COPY.zoomIn} data-zoom="in" disabled={!live && tier === "stop"} onClick={() => zoom(1)}><span aria-hidden="true">+</span></button>
              {canEnterHorizon && tier === "stop" ? (
                <button type="button" className="journey-toolbar__enter" data-enter-horizon="" disabled={!centreOnLand} title={centreOnLand ? undefined : COPY.enterHorizonOverWater} onClick={enterHere}>{COPY.enterHorizon}</button>
              ) : null}
            </div>
          ) : null}
          <Stage
            mode={stage.mode}
            status={stage.status}
            board={sceneBoard}
            land={stage.land}
            landHandle={stage.landHandle}
            route={stage.route}
            theme={theme}
            quality={stage.quality}
            reducedMotion={reducedMotion}
            selection={selected}
            preview={preview}
            flatView={flatView ?? { x: 1000, y: 900, tier: vs.tier }}
            initialFocus={initialFocus}
            sceneExtras={props.sceneExtras}
            createScene={props.createScene}
            onScene={setScene}
            onTier={(t) => setSceneTier(t)}
            onPick={onPick}
            onFrame={onFrame}
            onReady={sendReady}
            onLost={() => props.onLost?.()}
            onKeyDown={onStageKey}
            onSize={onStageSize}
            onCameraInput={cameraTaken}
            renderMarks={(anchors, size) => {
              stageSize.current = size;
              return <Marks board={sceneBoard} entries={entries} anchors={anchors} size={size} selectedId={selected} obstacles={obstacles} onSelect={(id) => select(id)} previewTag={previewTag} panelId={panelSlotId} />;
            }}
          />
        </>
      ) : (
        <JourneyList board={board} rows={rows} actions={actions} />
      )}
      {/* Always present (empty and hidden when nothing is open): the marks' `aria-controls` names it. */}
      <div id={panelSlotId} className="journey-board__panel-slot" hidden={!panel}>{panel}</div>
      <p className="journey-visually-hidden" role="status" aria-live="polite" data-journey-live="">{announcement}</p>
    </section>
  );
}

export default JourneyBoardView;

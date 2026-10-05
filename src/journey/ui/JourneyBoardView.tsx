/**
 * The Journey Map view (L4): the Horizon Clock's shell over the stage. The board, the land, the scene factory and the
 * list are INJECTED, so the whole surface is testable in jsdom (flat map, stub scene) and the entry only loads/derives.
 *
 * Shell (the approved prototype): header (i · ‹ month › · theme dot) → purse chip → stage + DOM marks → Hercules's
 * bubble → (list) → sheet → dock (level pull + Key · "+" · Map/List). A live region announces what changes.
 *
 * Invariants: selecting, picking, pulling the level, turning the chapter, opening a sheet or the list, the Key, the
 * dial, "Which one?" and About this map call NO action — they change the view only. An action runs only when its own
 * labelled button is pressed, exactly once, through `runJourneyAction` (the sheet and the list
 * share each stop's `actions[]`).
 */
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactElement } from "react";
import type {
  ChapterId, CreateJourneyMapScene, JourneyRecordMode, DateKey, HorizonLocation, JourneyBoardActions, JourneyBoard, JourneyLandData, JourneyLandHandle, JourneyLevel,
  JourneyMapSceneHandle, JourneyViewStateV2, ListScope, ListView as ListViewModel, MarkAnchor, PlaceRef, StopCluster, ThemeId,
} from "../contracts.ts";
import { DEFAULT_JOURNEY_VIEW_STATE_V2, JOURNEY_MAP_MARKS, LEVEL_T, levelForT, runJourneyAction } from "../contracts.ts";
import { boardToList, MAP_WORDS, shortDate } from "../model/index.ts";
import { AddDial } from "./AddDial.tsx";
import { addDays, COPY, firstDay, LEVEL_WORDS, lastDay, longDate, monthWords, shiftMonth } from "./copy.ts";
import { CrossroadsPanel, type PreviewSelection } from "./CrossroadsPanel.tsx";
import { Header } from "./Header.tsx";
import { ChecklistSheet, HerculesBubble } from "./HerculesBubble.tsx";
import { LevelPull } from "./LevelPull.tsx";
import { journeyRowDomId, ListView } from "./ListView.tsx";
import { mapMarks, projectFlat, type MapMark } from "./mapLayout.ts";
import { journeyMarkDomId, Marks, placeMarks } from "./Marks.tsx";
import { Purse } from "./Purse.tsx";
import { NO_SAFE_AREA, Stage, type SafeArea, type StageMode, type StageSize } from "./Stage.tsx";
import { ChapterPanel, ClusterPanel, PanelFrame, StopCard, StopPanel } from "./StopPanel.tsx";
import { WhichOne, type WhichOneOption } from "./WhichOne.tsx";
import { needChips } from "./HerculesBubble.tsx";
import { HORIZON_AVAILABLE } from "../../harbour/flag.ts";
import { HORIZON_GEOGRAPHY } from "../../worldGeography.ts";
import { recordDiagnostic, registerDiagnosticProvider } from "../../diagnostics/inspectorCore.ts";
import "./journey-board.css";

export type JourneyStageSource = {
  /** "live" only when a land handle AND a scene factory exist; otherwise the flat map (no WebGL needed). */
  mode: StageMode;
  status: "loading" | "ready" | "failed";
  land: JourneyLandData | null;
  landHandle: JourneyLandHandle | null;
  createScene: CreateJourneyMapScene | null;
  quality: "full" | "lite";
  /** True while a 3D map is still expected (the flat map is a placeholder; `onReady` waits for the first frame). */
  awaiting3d: boolean;
};

export type JourneyBoardViewProps = {
  board: JourneyBoard;
  actions: JourneyBoardActions;
  theme: ThemeId;
  reducedMotion: boolean;
  stage: JourneyStageSource;
  /** The list for a scope (`listView(household, board, scope)`), injected so the view never reads the household. */
  listOf(scope: ListScope): ListViewModel;
  freshnessNote?: string | null;
  nameOf?: (memberId: string) => string;
  dueReview?: { count: number } | null;
  onChooseTheme?: (theme: ThemeId) => void;
  initialViewState?: JourneyViewStateV2;
  onViewStateChange?: (state: JourneyViewStateV2) => void;
  /** The state about to be left for Horizon (the store flushes it before the board unmounts). */
  onBeforeEnterHorizon?: (state: JourneyViewStateV2) => void;
  onLost?: () => void;
  onReady?: () => void;
  /** The App's record modes for the "+" dial (`fabActionsFor`; TODO-merge FIX-A: `JourneyBoardProps.recordModes`). */
  recordModes?: readonly JourneyRecordMode[];
  /** The device is offline (the books shown are this device's copy): said outside About (UX #25). */
  offline?: boolean;
  /** A notice from the entry ("Enter Horizon here" is busy): spoken by the view's one live region (UX #18). */
  notice?: string;
};

// ---------------------------------------------------------------------------------------------------------------
// Small pure helpers.

/**
 * The App's bottom Compass (`nav[data-harbour-bar]`). Read-only: the board measures it so the dock ends above it; the
 * integrator hides it while the board stands, and then nothing is measured.
 */
const COMPASS = "[data-harbour-bar], nav.nav[data-ledger-nav]";
export type CompassClearance = { phone: number | null; float: number | null };
/**
 * How much of the viewport's bottom a bar rect covers: a full-width bar → phone clearance; a narrower one → float. A
 * bar in the top half (a desktop top bar) covers nothing at the bottom. With no bar the board keeps only the device's
 * safe-area inset (the dock sits at the screen's foot, as in the prototype).
 */
export function compassClearance(bar: { left: number; right: number; top: number; bottom: number } | null, viewport: { width: number; height: number }): CompassClearance {
  if (!bar || !(bar.right - bar.left > 0) || !(bar.bottom - bar.top > 0) || bar.top >= viewport.height || bar.top < viewport.height / 2) return { phone: null, float: null };
  const covered = Math.ceil(Math.max(0, viewport.height - bar.top));
  return bar.right - bar.left >= viewport.width * 0.9 ? { phone: covered, float: null } : { phone: null, float: covered };
}

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

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;
const clampDate = (date: DateKey, board: JourneyBoard): DateKey => {
  const lo = firstDay(board.window.from), hi = lastDay(board.window.to);
  return date < lo ? lo : date > hi ? hi : date;
};

function knownIds(board: JourneyBoard): Set<string> {
  return new Set<string>([
    JOURNEY_MAP_MARKS.piece, JOURNEY_MAP_MARKS.hercules, JOURNEY_MAP_MARKS.pile,
    ...board.chapters.map((c) => c.id), ...board.stops.map((s) => s.id), ...board.crossroads.map((c) => c.id),
  ]);
}
function sanitize(state: JourneyViewStateV2, board: JourneyBoard): JourneyViewStateV2 {
  const known = knownIds(board);
  const sel = state.selectedStopId;
  const okSel = sel && (known.has(sel) || (DATE.test(sel) && sel >= firstDay(board.window.from) && sel <= lastDay(board.window.to))) ? sel : null;
  return { ...state, selectedStopId: okSel, focusDate: state.focusDate ? clampDate(state.focusDate, board) : null };
}

/** The scope the list shows for what the map shows. */
export function scopeFor(level: JourneyLevel, chapterId: ChapterId): ListScope {
  return level === "week" ? { level: "week" } : level === "year" ? { level: "year" } : { level: "month", chapterId };
}

// ---------------------------------------------------------------------------------------------------------------

export function JourneyBoardView(props: JourneyBoardViewProps) {
  const { board, actions, theme, reducedMotion, stage } = props;
  const [vs, setVs] = useState<JourneyViewStateV2>(() => sanitize(props.initialViewState ?? DEFAULT_JOURNEY_VIEW_STATE_V2, board));
  const [t, setT] = useState<number>(() => LEVEL_T[vs.level]);
  const [chapterDir, setChapterDir] = useState<-1 | 0 | 1>(0);
  const [preview, setPreview] = useState<PreviewSelection | null>(null);
  const [dayReturn, setDayReturn] = useState<string | null>(null);
  const [fan, setFan] = useState<{ options: WhichOneOption[]; at: { x: number; y: number } | null } | null>(null);
  const [dialOpen, setDialOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [scene, setScene] = useState<JourneyMapSceneHandle | null>(null);
  const [safeArea, setSafeArea] = useState<SafeArea>(NO_SAFE_AREA);
  const [obstacles, setObstacles] = useState<{ x0: number; x1: number; y0: number; y1: number }[]>([]);
  const [compass, setCompass] = useState<CompassClearance>({ phone: null, float: null });
  /** Bumped on a selection, a level change or a press on the map: the header and Key popovers close (UX #11). */
  const [popClose, setPopClose] = useState(0);
  const closePops = useCallback(() => setPopClose((n) => n + 1), []);

  const sheetSlotId = `journey-sheet-${useId().replace(/[^A-Za-z0-9-]/g, "")}`;
  const root = useRef<HTMLElement | null>(null);
  const stageSize = useRef<StageSize>({ width: 390, height: 640 });
  const origin = useRef<Element | null>(null);
  const focusSheet = useRef(false);
  const sheetHeading = useRef<HTMLHeadingElement | null>(null);
  const live = stage.mode === "live";
  /** "Enter Horizon here" is offered only where the Horizon can mount (development, or live under D15). */
  const canEnterHorizon = live && HORIZON_AVAILABLE;

  const level: JourneyLevel = vs.level;
  const chapterId = ((vs.focusDate ?? board.today).slice(0, 7)) as ChapterId;
  const announce = useCallback((words: string) => setAnnouncement(words), []);

  // The one live region speaks the entry's notices and a land that failed (the notes on the map are not live).
  useEffect(() => { if (props.notice) announce(props.notice); }, [props.notice, announce]);
  useEffect(() => { if (stage.status === "failed") announce(COPY.mapUnavailable); }, [stage.status, announce]);

  // --- view state out ------------------------------------------------------------------------------------------
  const onViewStateChange = useRef(props.onViewStateChange);
  onViewStateChange.current = props.onViewStateChange;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    onViewStateChange.current?.(vs);
  }, [vs]);
  const patch = useCallback((p: Partial<JourneyViewStateV2>) => setVs((prev) => ({ ...prev, ...p })), []);
  // A new board (a sync, a record elsewhere): keep the selection only while it still exists.
  useEffect(() => { setVs((prev) => { const next = sanitize(prev, board); return next.selectedStopId === prev.selectedStopId && next.focusDate === prev.focusDate ? prev : next; }); }, [board]);

  // --- inspector (allowlisted, nothing financial) ----------------------------------------------------------------
  const inspector = useRef({ vs, stage, board, t });
  inspector.current = { vs, stage, board, t };
  useEffect(() => {
    recordDiagnostic("scene", "enter Journey map", "accepted");
    return registerDiagnosticProvider({ read: () => {
      const c = inspector.current;
      return { scene: "journey", view: c.vs.listMode, activity: c.vs.selectedStopId ? "selected stop" : "map", worldRevision: HORIZON_GEOGRAPHY, renderedRevision: c.stage.land?.revision ?? null,
        player: null, camera: null, location: c.vs.focusDate ?? c.board.today,
        movement: { controller: "map", state: "Not applicable", horizontalSpeed: null, verticalVelocity: null, grounded: null },
        interaction: { target: c.vs.selectedStopId, inputOwner: c.vs.listMode === "list" ? "Journey list" : "Journey map" },
        context: { selectedDate: c.vs.focusDate, selectedStopId: c.vs.selectedStopId, level: c.vs.level, pull: Math.round(c.t * 100) / 100, sheet: c.vs.selectedStopId ? "open" : "none", coordinateConvention: "diorama units; no player position", dataRevision: "Not instrumented" },
        rendering: { quality: c.stage.quality, stageMode: c.stage.mode, landStatus: c.stage.status }, frame: null, frameMs: null, drawCalls: null, triangles: null, idle: true, paused: false };
    } });
  }, []);

  // --- derived ---------------------------------------------------------------------------------------------------
  const rows = useMemo(() => new Map(boardToList(board).map((r) => [r.id, r] as const)), [board]);
  const stopById = useMemo(() => new Map(board.stops.map((s) => [s.id, s] as const)), [board]);
  const crossById = useMemo(() => new Map(board.crossroads.map((c) => [c.id, c] as const)), [board]);
  const chapterById = useMemo(() => new Map(board.chapters.map((c) => [c.id, c] as const)), [board]);
  const shownLevel = levelForT(t);
  const marks = useMemo(() => mapMarks(board, shownLevel, chapterId), [board, shownLevel, chapterId]);
  const listOf = props.listOf;
  const list = useMemo(() => (vs.listMode === "list" ? listOf(scopeFor(level, chapterId)) : null), [vs.listMode, listOf, level, chapterId]);

  // --- ready (once): the first 3D frame, the flat map when no 3D is coming, a failed land, or the list ---------------
  const readySent = useRef(false);
  const sendReady = useCallback(() => {
    if (readySent.current) return;
    readySent.current = true;
    props.onReady?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (vs.listMode === "list") sendReady();
    if (stage.mode === "flat" && (!stage.awaiting3d || stage.status === "failed")) sendReady();
  }, [vs.listMode, stage.mode, stage.awaiting3d, stage.status, sendReady]);

  // --- level -----------------------------------------------------------------------------------------------------
  const settleLevel = useCallback((next: JourneyLevel, words = true) => {
    setT(LEVEL_T[next]);
    setVs((prev) => {
      if (prev.level === next) return prev;
      // A new level: an open sheet belongs to the old view; it closes (nothing ran, nothing changes).
      return { ...prev, level: next, selectedStopId: null };
    });
    setFan(null);
    closePops();
    if (words) announce(`${LEVEL_WORDS[next]} · ${next === "week" ? MAP_WORDS.checklist.thisWeek : next === "year" ? COPY.theYear : monthWords(chapterId)}`);
  }, [announce, chapterId, closePops]);
  const onPull = useCallback((value: number, settle: boolean) => {
    const v = Math.min(2, Math.max(0, Number.isFinite(value) ? value : 1));
    if (settle || reducedMotion) { settleLevel(levelForT(v)); return; }
    setT(v);
  }, [reducedMotion, settleLevel]);

  // --- chapter -----------------------------------------------------------------------------------------------------
  const focusForChapter = useCallback((id: ChapterId): DateKey | null => {
    if (id === board.currentChapterId) return null;
    return id < board.currentChapterId ? lastDay(id) : firstDay(id);
  }, [board.currentChapterId]);
  const goChapter = useCallback((id: ChapterId, dir: -1 | 0 | 1) => {
    if (id < board.window.from || id > board.window.to) return;
    setChapterDir(dir);
    setPreview(null);
    setDayReturn(null);
    patch({ focusDate: focusForChapter(id), selectedStopId: null });
    const chapter = chapterById.get(id);
    announce(`${monthWords(id)} · ${chapter?.state === "open" ? COPY.now : chapter?.state === "past" ? COPY.earlier : COPY.ahead}`);
  }, [board.window, patch, focusForChapter, chapterById, announce]);
  const stepChapter = useCallback((dir: -1 | 1) => {
    const from = level === "week" ? board.currentChapterId : chapterId;
    if (level === "week") settleLevel("month", false);
    goChapter(shiftMonth(from, dir) as ChapterId, dir);
  }, [level, board.currentChapterId, chapterId, settleLevel, goChapter]);

  const backToNow = useCallback(() => {
    setPreview(null); setDayReturn(null); setFan(null);
    setChapterDir(0);
    patch({ focusDate: null, selectedStopId: null, level: level === "year" ? "month" : level });
    if (level === "year") setT(LEVEL_T.month);
    announce(`${COPY.backToNow} · ${shortDate(board.today)}`);
  }, [patch, level, announce, board.today]);

  // --- selection (inert) -------------------------------------------------------------------------------------------
  const marksFor = useCallback((lv: JourneyLevel, ch: ChapterId) => mapMarks(board, lv, ch), [board]);
  const select = useCallback((id: string, opts: { from?: Element | null; fromDay?: string | null } = {}) => {
    origin.current = opts.from ?? (typeof document !== "undefined" ? document.activeElement : null);
    setFan(null);
    setDialOpen(false);
    closePops();
    // A Year mini dives to its month (the prototype's tap); nothing opens and nothing runs.
    if (MONTH.test(id) && levelForT(t) === "year") {
      settleLevel("month", false);
      goChapter(id as ChapterId, 0);
      return;
    }
    const target = id === JOURNEY_MAP_MARKS.piece ? board.today : id;
    setDayReturn(opts.fromDay ?? null);
    if (!crossById.has(target)) setPreview(null);
    const stop = stopById.get(target) ?? crossById.get(target);
    patch({ selectedStopId: target, ...(stop ? { focusDate: stop.date === board.today ? null : stop.date } : DATE.test(target) ? { focusDate: target === board.today ? null : (target as DateKey) } : {}) });
    focusSheet.current = true;
    const words = stop ? `${stop.label} · ${shortDate(stop.date)}` : DATE.test(target) ? longDate(target as DateKey) : target === JOURNEY_MAP_MARKS.hercules ? COPY.herculesList : target === JOURNEY_MAP_MARKS.pile ? MAP_WORDS.checklist.toCheck : monthWords(target);
    announce(`Opened · ${words}`);
  }, [t, board.today, crossById, stopById, patch, announce, settleLevel, goChapter, closePops]);

  /** From the list (or the checklist): show this stop on the map with its sheet open. */
  const openOnMap = useCallback((id: string) => {
    const stop = stopById.get(id) ?? crossById.get(id);
    const lv: JourneyLevel = level === "year" ? "month" : level;
    const ch = stop ? (stop.date.slice(0, 7) as ChapterId) : chapterId;
    const keep = lv === "week" && stop && marksFor("week", ch).some((m) => m.covers.includes(id));
    const nextLevel: JourneyLevel = lv === "week" && !keep ? "month" : lv;
    setT(LEVEL_T[nextLevel]);
    patch({ listMode: "map", level: nextLevel });
    select(id);
  }, [stopById, crossById, level, chapterId, marksFor, patch, select]);

  const onPick = useCallback((ids: string[], at: { x: number; y: number } | null) => {
    if (!ids.length) { if (vs.selectedStopId) patch({ selectedStopId: null }); setFan(null); closePops(); return; }
    if (ids.length === 1) { select(ids[0]!); return; }
    const options = ids.map((id) => {
      const stop = stopById.get(id) ?? crossById.get(id);
      const n = DATE.test(id) ? board.stops.filter((s) => s.date === id).length : 0;
      const only = n === 1 ? board.stops.find((s) => s.date === id) : undefined;
      const label = stop ? `${shortDate(stop.date)} · ${stop.label}` : DATE.test(id) ? `${shortDate(id as DateKey)}${only ? ` · ${only.label}` : n ? ` · ${COPY.thingsOnDay(n).replace(" on this day", "")}` : ""}` : MONTH.test(id) ? monthWords(id) : id === JOURNEY_MAP_MARKS.pile ? MAP_WORDS.checklist.toCheck : id;
      const date = stop?.date ?? (DATE.test(id) ? id : "");
      return { id, label, date };
    }).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).map(({ id, label }) => ({ id, label }));
    setFan({ options, at });
    announce(`${COPY.whichOne} · ${options.length}`);
  }, [vs.selectedStopId, patch, select, stopById, crossById, announce, closePops, board.stops]);

  const selected = vs.selectedStopId;
  const closeSheet = useCallback(() => {
    const id = selected;
    patch({ selectedStopId: null });
    setPreview(null);
    setDayReturn(null);
    announce(COPY.close);
    if (!id || typeof document === "undefined") return;
    const usable = (el: Element | null): el is HTMLElement => Boolean(el && el.isConnected && !(el as HTMLElement).hidden && !(el as HTMLElement).closest?.("[data-journey-panel]"));
    const markOf = marks.find((m) => m.id === id || m.covers.includes(id));
    const candidates = [
      origin.current,
      markOf ? document.getElementById(journeyMarkDomId(markOf.id)) : null,
      document.getElementById(journeyRowDomId(id)),
      root.current?.querySelector(".journey-bubble") ?? null,
      root.current?.querySelector(".journey-stage") ?? null,
    ];
    const target = candidates.find(usable);
    queueMicrotask(() => target?.focus?.());
  }, [selected, patch, announce, marks]);
  useLayoutEffect(() => {
    if (focusSheet.current && selected && sheetHeading.current) { focusSheet.current = false; sheetHeading.current.focus(); }
  });

  // --- Enter Horizon (explicit only; never on the flat map) ----------------------------------------------------------
  const enterHorizon = useCallback((location: HorizonLocation) => {
    const next: JourneyViewStateV2 = { ...vs, lastEnter: { location, level, focusDate: vs.focusDate } };
    setVs(next);
    props.onBeforeEnterHorizon?.(next);
    runJourneyAction(actions, { name: "enterHorizon", location });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vs, level, actions, props.onBeforeEnterHorizon]);
  /** The island's centre ground (the scene's ground at the stage centre, else the frame centre): `resolve.centre`. */
  const centreGround = useCallback((): HorizonLocation | null => {
    if (!canEnterHorizon) return null;
    const { width, height } = stageSize.current;
    const at = scene?.groundAt(width / 2, (safeArea.top + height - safeArea.bottom) / 2) ?? null;
    const frame = stage.landHandle?.frame;
    const location = at ?? (frame ? { x: frame.centre[0], y: frame.centre[1] } : null);
    return location ? { x: Math.round(location.x), y: Math.round(location.y) } : null;
  }, [canEnterHorizon, scene, safeArea, stage.landHandle]);
  /** The dial's actions: its resolved `enterHorizonCentre` goes through the map's own Enter Horizon (it saves `lastEnter`). */
  const dialActions = useMemo<JourneyBoardActions>(() => ({ ...actions, enterHorizon: (location) => { enterHorizon(location); } }), [actions, enterHorizon]);

  // --- keyboard ----------------------------------------------------------------------------------------------------
  const moveTo = useCallback((date: DateKey) => {
    let next = clampDate(date, board);
    if (level === "week") next = next < board.week.from ? board.week.from : next > board.week.to ? board.week.to : next;
    const ch = next.slice(0, 7);
    if (ch !== chapterId) setChapterDir(ch > chapterId ? 1 : -1);
    patch({ focusDate: next === board.today ? null : next });
    const n = board.stops.filter((s) => s.date === next);
    announce(`${shortDate(next)} · ${n.length ? n.map((s) => s.label).join(", ") : MAP_WORDS.nothingOnThisDay}`);
  }, [board, level, chapterId, patch, announce]);
  const onStageKey = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    const onStage = e.target === e.currentTarget;
    const current = vs.focusDate ?? board.today;
    let handled = true;
    switch (e.key) {
      case "ArrowRight": if (level === "year") goChapter(shiftMonth(chapterId, 1) as ChapterId, 1); else moveTo(addDays(current, 1)); break;
      case "ArrowLeft": if (level === "year") goChapter(shiftMonth(chapterId, -1) as ChapterId, -1); else moveTo(addDays(current, -1)); break;
      case "PageDown": stepChapter(1); break;
      case "PageUp": stepChapter(-1); break;
      case "Home": backToNow(); break;
      case "Enter":
        if (!onStage) { handled = false; break; }
        if (level === "year") { settleLevel("month", false); goChapter(chapterId, 0); }
        else select(current === board.today ? board.today : current, { from: e.currentTarget });
        break;
      default: handled = false;
    }
    if (handled) e.preventDefault();
  }, [vs.focusDate, board.today, level, chapterId, goChapter, moveTo, stepChapter, backToNow, settleLevel, select]);
  const onRootKey = useCallback((e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== "Escape") return;
    if (fan) { e.preventDefault(); setFan(null); return; }
    if (selected) { e.preventDefault(); e.stopPropagation(); closeSheet(); }
  }, [fan, selected, closeSheet]);

  // --- chrome: what the scene frames clear of, and what callouts avoid -----------------------------------------------
  const measureChrome = useCallback(() => {
    const el = root.current;
    if (!el) return;
    const win = el.ownerDocument?.defaultView ?? null;
    const viewport = { width: win?.innerWidth ?? 0, height: win?.innerHeight ?? 0 };
    const bar = el.ownerDocument?.querySelector?.(COMPASS) ?? null;
    const barRect = bar && typeof bar.getBoundingClientRect === "function" ? bar.getBoundingClientRect() : null;
    const clear = viewport.width > 0 && viewport.height > 0 ? compassClearance(barRect, viewport) : { phone: null, float: null };
    setCompass((prev) => (prev.phone === clear.phone && prev.float === clear.float ? prev : clear));
    const st = el.querySelector(".journey-stage");
    if (!st || typeof st.getBoundingClientRect !== "function") return;
    const base = st.getBoundingClientRect();
    if (!base.width || !base.height) return;
    const box = (node: Element | null) => {
      const r = node?.getBoundingClientRect();
      return r && r.width && r.height ? { x0: r.left - base.left, x1: r.right - base.left, y0: r.top - base.top, y1: r.bottom - base.top } : null;
    };
    const header = box(el.querySelector(".journey-header"));
    const purse = box(el.querySelector(".journey-purse"));
    const pillTop = box(el.querySelector(".journey-bubble--mini"));
    const sheet = box(el.querySelector(".journey-sheet-slot > .journey-panel"));
    const wide = base.width >= 720;
    // The chrome the map frames clear of: the header (and on phones the purse and the Week pill under it) above; the
    // dock — pull, "+", Map/List — and on phones the bubble below; a docked sheet on the right (wide) or below (phone).
    const lows = [".journey-dock .journey-pull", ".journey-dock > .journey-plus", ".journey-dock > .journey-toggle", ...(wide ? [] : [".journey-bubble:not(.journey-bubble--mini)"]), ...(wide ? [".journey-purse"] : [])]
      .flatMap((sel) => [...el.querySelectorAll(sel)].map(box)).filter((b): b is NonNullable<typeof b> => Boolean(b));
    const caption = box(el.querySelector(".journey-year-caption"));
    const chips = box(el.querySelector(".journey-header__chips"));
    const highs = [header, chips, ...(wide ? [caption] : [purse, pillTop, caption])].filter((b): b is NonNullable<typeof b> => Boolean(b));
    const safe: SafeArea = {
      top: Math.round(Math.max(0, ...highs.map((b) => b.y1)) + 6),
      bottom: Math.round(Math.max(0, base.height - Math.min(base.height, ...lows.map((b) => b.y0))) + 6),
      right: wide && sheet ? Math.round(Math.max(0, base.width - sheet.x0)) : 0,
      left: 0,
    };
    // Phone: the sheet rises over the bottom of the map (the prototype); the clock keeps its size behind it.
    setSafeArea((prev) => (prev.top === safe.top && prev.bottom === safe.bottom && prev.right === safe.right && prev.left === safe.left ? prev : safe));
    const boxes = [".journey-header .journey-toy", ".journey-chapter", ".journey-header__chips > *", ".journey-purse", ".journey-bubble", ".journey-year-caption", ".journey-stage__note", ".journey-dock .journey-pull", ".journey-dock > .journey-plus", ".journey-dock > .journey-toggle", ".journey-sheet-slot > .journey-panel"]
      .flatMap((sel) => [...el.querySelectorAll(sel)].map(box).filter((b): b is NonNullable<typeof b> => Boolean(b)));
    setObstacles((prev) => (JSON.stringify(prev) === JSON.stringify(boxes) ? prev : boxes));
  }, []);
  useLayoutEffect(measureChrome);
  useEffect(() => {
    const win = root.current?.ownerDocument?.defaultView;
    if (!win) return;
    win.addEventListener("resize", measureChrome);
    return () => win.removeEventListener("resize", measureChrome);
  }, [measureChrome]);

  // --- the sheet ---------------------------------------------------------------------------------------------------
  const headingRef = (el: HTMLHeadingElement | null) => { sheetHeading.current = el; };
  const horizonFor = (place: PlaceRef | undefined) => (canEnterHorizon ? horizonLocationFor(place, stage.land) : null);
  let sheet: ReactElement | null = null;
  if (selected === JOURNEY_MAP_MARKS.hercules || selected === JOURNEY_MAP_MARKS.pile) {
    sheet = <ChecklistSheet board={board} rows={rows} actions={actions} pinned={selected === JOURNEY_MAP_MARKS.pile} dueReview={props.dueReview} onOpenStop={(id) => select(id)} onClose={closeSheet} headingRef={headingRef} />;
  } else if (selected && stopById.has(selected)) {
    const stop = stopById.get(selected)!;
    const back = dayReturn ? { label: `${COPY.clusterStops} · ${shortDate(dayReturn as DateKey)}`, onBack: () => select(dayReturn) } : null;
    sheet = <StopPanel key={stop.id} stop={stop} row={rows.get(stop.id)} actions={actions} onClose={closeSheet} horizonLocation={horizonFor(stop.placeRef)} onEnterHorizon={enterHorizon} back={back} nameOf={props.nameOf} headingRef={headingRef} level={shownLevel} />;
  } else if (selected && crossById.has(selected)) {
    sheet = <CrossroadsPanel key={selected} crossroads={crossById.get(selected)!} actions={actions} preview={preview} onPreview={setPreview} onClose={closeSheet} nameOf={props.nameOf} headingRef={headingRef} />;
  } else if (selected && chapterById.has(selected as ChapterId)) {
    const chapter = chapterById.get(selected as ChapterId)!;
    sheet = <ChapterPanel key={chapter.id} chapter={chapter} row={rows.get(chapter.id)} stops={board.stops.filter((s) => s.chapterId === chapter.id)} crossroads={board.crossroads.filter((c) => c.chapterId === chapter.id)} rows={rows} onClose={closeSheet} onSelect={(id) => select(id)} headingRef={headingRef} />;
  } else if (selected && DATE.test(selected)) {
    const date = selected as DateKey;
    const stops = board.stops.filter((s) => s.date === date);
    const cross = board.crossroads.filter((c) => c.date === date);
    const when = date === board.today ? COPY.today.toLowerCase() : date < board.today ? "before today" : COPY.ahead;
    if (stops.length === 1 && !cross.length) {
      const stop = stops[0]!;
      sheet = <StopPanel key={stop.id} stop={stop} row={rows.get(stop.id)} actions={actions} onClose={closeSheet} horizonLocation={horizonFor(stop.placeRef)} onEnterHorizon={enterHorizon} nameOf={props.nameOf} headingRef={headingRef} level={shownLevel} />;
    } else if (stops.length > 3) {
      const cluster: StopCluster = board.clusters.find((c) => c.date === date) ?? { id: `cluster:${date}`, date, chapterId: date.slice(0, 7) as ChapterId, stopIds: stops.map((s) => s.id), label: COPY.thingsOnDay(stops.length), major: false };
      sheet = (
        <ClusterPanel key={date} cluster={cluster} stops={stops} rows={rows} onClose={closeSheet} onSelectStop={(id) => select(id, { fromDay: date })} headingRef={headingRef}>
          {cross.length ? <ul className="journey-panel__stops">{cross.map((c) => <li key={c.id}><button type="button" className="journey-panel__stop" data-open-stop={c.id} onClick={() => select(c.id, { fromDay: date })}><span className="journey-panel__stop-kind">{COPY.crossroads}</span><span className="journey-panel__stop-label">{c.label}</span></button></li>)}</ul> : null}
        </ClusterPanel>
      );
    } else {
      sheet = (
        <PanelFrame key={date} kindWords={`${longDate(date)} · ${when}`} title={stops.length + cross.length ? COPY.thingsOnDay(stops.length + cross.length) : MAP_WORDS.nothingOnThisDay} onClose={closeSheet} className="journey-panel--day" headingRef={headingRef} dialog>
          {stops.map((s) => <StopCard key={s.id} stop={s} row={rows.get(s.id)} actions={actions} horizonLocation={horizonFor(s.placeRef)} onEnterHorizon={enterHorizon} level={shownLevel} named nameOf={props.nameOf} />)}
          {cross.map((c) => <button key={c.id} type="button" className="journey-panel__stop" data-open-stop={c.id} onClick={() => select(c.id, { fromDay: date })}><span className="journey-panel__stop-kind">{COPY.crossroads}</span><span className="journey-panel__stop-label">{c.label}</span></button>)}
          {!stops.length && !cross.length ? (
            <div className="journey-actions"><button type="button" className="journey-action" data-action-id={`day:${date}#calendar`} onClick={() => runJourneyAction(actions, { name: "openCalendar", date })}>Open the Calendar</button></div>
          ) : null}
          <p className="journey-panel__note">{COPY.sheetNote}</p>
        </PanelFrame>
      );
    }
  }

  // --- render ------------------------------------------------------------------------------------------------------
  const selectedMark = selected ? (marks.find((m) => m.id === selected) ?? marks.find((m) => m.covers.includes(selected)))?.id ?? null : null;
  const focusedDate = vs.focusDate ?? board.today;
  const bubbleMode = board.empty ? null : shownLevel === "week" ? "week" : shownLevel === "year" ? null : chapterId === board.currentChapterId ? "today" : "other";
  const showBubble = vs.listMode === "map" && bubbleMode !== null && !sheet && !dialOpen;
  // Year and the List have no bubble: the header carries a small count chip that opens the same checklist (trust M2 /
  // minor 7), and says reminders / waiting when they are non-zero.
  const chips = board.empty ? [] : needChips(board, props.dueReview);
  const countChip = !board.empty && !sheet && (vs.listMode === "list" || shownLevel === "year")
    ? { words: chips.map((c) => c.words).join(" · "), aria: `${COPY.herculesList} · ${chips.map((c) => c.words).join(", ")}`, onOpen: () => { if (vs.listMode === "list") patch({ listMode: "map" }); select(JOURNEY_MAP_MARKS.hercules, { from: root.current?.querySelector("[data-journey-count-chip]") }); } }
    : null;
  // Offline or stale books: said on the purse (map) and at the list's top, not only inside About (UX #25).
  const statusNote = props.offline ? COPY.offline : props.freshnessNote ?? null;
  const className = [
    "journey-board", `journey-board--${theme}`, `journey-board--${stage.mode}`, `journey-board--${vs.listMode}`, `journey-board--level-${shownLevel}`,
    reducedMotion ? "journey-board--still" : "journey-board--animated", sheet ? "has-sheet" : "", board.empty ? "journey-board--empty" : "",
    dialOpen ? "is-dial-open" : "", countChip ? "has-header-chips" : "",
  ].filter(Boolean).join(" ");
  const rootStyle = {
    ...(compass.phone !== null ? { "--jb-compass": `${compass.phone}px` } : {}),
    ...(compass.float !== null ? { "--jb-float-bottom": `${compass.float}px` } : {}),
  } as CSSProperties;
  const weekRange = `${shortDate(board.week.from)} – ${shortDate(board.week.to)}`;

  return (
    <section
      ref={root} className={className} style={rootStyle} aria-label={COPY.boardLabel} data-journey-board="" data-theme={theme} data-journey-level={level}
      data-safe-area={`${safeArea.top} ${safeArea.right} ${safeArea.bottom} ${safeArea.left}`} onKeyDown={onRootKey}
    >
      <div className="journey-board__behind" inert={dialOpen || undefined} data-journey-behind="">
      <Header
        level={shownLevel} chapterId={chapterId} currentChapterId={board.currentChapterId} weekRange={weekRange}
        canPrev={(shownLevel === "week" ? board.currentChapterId : chapterId) > board.window.from} canNext={(shownLevel === "week" ? board.currentChapterId : chapterId) < board.window.to}
        onStep={stepChapter} bakeRevision={stage.land?.revision ?? null} limitations={board.limitations} freshnessNote={props.freshnessNote}
        theme={theme} onChooseTheme={props.onChooseTheme} closeSignal={popClose} countChip={countChip}
      />
      <Purse purse={board.purse} showToday={shownLevel === "week" || (shownLevel === "month" && chapterId === board.currentChapterId)} statusNote={statusNote} />
      {shownLevel === "year" && vs.listMode === "map" && !board.empty ? (
        <p className="journey-year-caption" data-journey-year-caption="">
          {MAP_WORDS.yearCaption}
          <span className="journey-year-caption__key"><span aria-hidden="true">●</span> {MAP_WORDS.stack.solid} · <span aria-hidden="true">○</span> {MAP_WORDS.stack.seeThrough}</span>
        </p>
      ) : null}
      <Stage
        mode={stage.mode} status={stage.status} board={board} land={stage.land} landHandle={stage.landHandle} createScene={stage.createScene}
        theme={theme} quality={stage.quality} reducedMotion={reducedMotion} t={t} level={level} chapterId={chapterId} chapterDir={chapterDir}
        selection={selected} marks={marks} safeArea={safeArea}
        onScene={setScene} onAnchors={() => undefined} onPick={onPick} onLevel={onPull} onPress={closePops}
        onReady={sendReady} onLost={() => props.onLost?.()} onKeyDown={onStageKey}
        onSize={(size) => { stageSize.current = size; measureChrome(); }}
        renderMarks={(anchors: readonly MarkAnchor[] | null, size: StageSize, unit: number) => {
          stageSize.current = size;
          const placed = placeMarks(marks, anchors, (m: MapMark) => projectFlat(m.at, size, safeArea));
          // Decorative anchors: the Week tiles' faces (where each day's tag is printed) and, for the keyboard, the
          // focused day's slot when no mark stands there (UX #13).
          const decor = new Map<string, { x: number; y: number }>();
          if (anchors) for (const a of anchors) if (a.visible && (a.id.startsWith("face:") || a.id.startsWith("centre:") || a.id === vs.focusDate)) decor.set(a.id, { x: a.x, y: a.y });
          return <Marks board={board} level={shownLevel} placed={placed} rows={rows} selectedId={selectedMark} focusedDate={focusedDate} focusAnchor={vs.focusDate ? decor.get(vs.focusDate) ?? null : null} chapterId={chapterId} flat={!anchors} unit={unit} stage={size} obstacles={obstacles} decor={anchors ? decor : undefined} sheetId={sheetSlotId} onSelect={(id, from) => select(id, { from })} onPickMany={(ids, at) => onPick(ids, at)} />;
        }}
      />
      {board.empty && vs.listMode === "map" ? (
        <div className="journey-empty" data-journey-empty=""><b>{COPY.emptyTitle}</b><span>{COPY.emptyBody}</span></div>
      ) : null}
      {showBubble && bubbleMode ? (
        <HerculesBubble board={board} rows={rows} mode={bubbleMode} chapterId={chapterId} dueReview={props.dueReview} onOpen={() => select(JOURNEY_MAP_MARKS.hercules, { from: root.current?.querySelector(".journey-bubble") })} onBackToNow={backToNow} />
      ) : null}
      {list ? <ListView view={list} stops={stopById} actions={actions} onOpen={openOnMap} waitingOnYou={board.digest.waitingOnYou} dueReview={props.dueReview} statusNote={statusNote} /> : null}
      <div id={sheetSlotId} className="journey-sheet-slot" hidden={!sheet}>{sheet}</div>
      {fan ? <WhichOne options={fan.options} at={fan.at} onChoose={(id) => select(id)} onClose={() => { setFan(null); (root.current?.querySelector(".journey-stage") as HTMLElement | null)?.focus(); }} /> : null}
      </div>
      <div className={["journey-dock", dialOpen ? "is-dial-open" : ""].filter(Boolean).join(" ")} data-journey-dock="">
        <div className="journey-dock__pull" inert={dialOpen || undefined}><LevelPull t={t} onPull={onPull} flat={stage.mode === "flat"} closeSignal={popClose} /></div>
        <AddDial open={dialOpen} onToggle={setDialOpen} actions={dialActions} today={board.today} canEnterHorizon={canEnterHorizon} centre={centreGround} recordModes={props.recordModes} />
        <div className="journey-toggle" role="group" aria-label={COPY.mapOrList} inert={dialOpen || undefined}>
          <button type="button" className="journey-toggle__option" aria-pressed={vs.listMode === "map"} data-list-mode="map" onClick={() => patch({ listMode: "map" })}>{COPY.showMap}</button>
          <button type="button" className="journey-toggle__option" aria-pressed={vs.listMode === "list"} data-list-mode="list" onClick={() => { patch({ listMode: "list", selectedStopId: null }); setFan(null); }}>{COPY.showList}</button>
        </div>
      </div>
      <p className="journey-visually-hidden" role="status" aria-live="polite" data-journey-live="">{announcement}</p>
    </section>
  );
}

export default JourneyBoardView;

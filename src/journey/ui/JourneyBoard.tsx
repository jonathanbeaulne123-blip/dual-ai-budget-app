/**
 * The Journey Map — the mounted entry (L4; the App mounts it lazily on the household journey route). Default export and
 * `JourneyBoardProps` are unchanged for App.tsx; `onChooseTheme` (and the actions' optional `openAllTools` /
 * `chooseSimpleView`) light up the theme dot and the dial's chips when the App supplies them.
 *
 * Wiring: `deriveJourneyBoard` (memoised on the household snapshot + memberId + today) → the shell, the flat clock and
 * the list render at once; `loadJourneyLand` (aborted on unmount) → `buildJourneyLand` → L3's `createJourneyMapScene`
 * (inside the Stage), imported directly. The flat map (SVG, no WebGL) stands while the land loads, on the flat quality tier, after a lost
 * context, without a scene factory, and when the land fails — budgeting never waits for 3D. `onReady` fires once.
 *
 * Nothing here posts, stores (except view state through `viewState.ts`) or creates a clock: `today` is the App's.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CreateJourneyMapScene, JourneyBoardActions, JourneyBoardProps, JourneyLandData, JourneyLandHandle, JourneyViewStateV2, ListScope, LoadJourneyLand,
} from "../contracts.ts";
import { deriveJourneyBoard, listView } from "../model/index.ts";
import { buildJourneyLand, loadJourneyLand } from "../land/index.ts";
import { createJourneyMapScene } from "../board/scene.ts";
import { qualityTier, readQualityInput, type QualityTier } from "../../harbour/scene/quality.ts";
import { MOTION_KEY } from "../../harbour/nav/motionEdition.ts";
import { JourneyBoardView, type JourneyStageSource } from "./JourneyBoardView.tsx";
import { COPY } from "./copy.ts";
import { useReducedMotion } from "./motion.ts";
import { useJourneyViewStateStore } from "./viewState.ts";
import type { RecordModesProp } from "./mergeShim.ts";

/** Test seams only (the App passes plain `JourneyBoardProps`). */
export type JourneyBoardSeams = {
  quality?: QualityTier;
  /** The map scene factory (default: L3's `createJourneyMapScene`); null = the flat map only. */
  createScene?: CreateJourneyMapScene | null;
  loadLand?: LoadJourneyLand;
  buildLand?: typeof buildJourneyLand;
  storage?: Storage | null;
};

function detectQuality(): QualityTier {
  try {
    if (typeof window === "undefined") return "flat";
    return qualityTier(readQualityInput(window, window.innerWidth || 390));
  } catch {
    return "flat";
  }
}

export default function JourneyBoard(props: JourneyBoardProps & JourneyBoardSeams) {
  const { household, memberId, environment, today, theme, actions } = props;
  const identity = useMemo(() => ({ environment, householdId: household.householdId, memberId }), [environment, household.householdId, memberId]);
  const store = useJourneyViewStateStore(identity, props.storage);
  const reducedMotion = useReducedMotion();
  const [quality, setQuality] = useState<QualityTier>(() => props.quality ?? detectQuality());
  // Simple view (`hearth:motion`) can change while the board is up — follow it.
  const qualitySeam = props.quality;
  useEffect(() => {
    if (qualitySeam) return;
    const sync = () => setQuality(detectQuality());
    window.addEventListener(MOTION_KEY, sync);
    return () => window.removeEventListener(MOTION_KEY, sync);
  }, [qualitySeam]);

  // Derived on read; the household snapshot is immutable, so its identity is the revision that matters.
  const board = useMemo(() => deriveJourneyBoard(household, memberId, today), [household, memberId, today]);
  const listOf = useCallback((scope: ListScope) => listView(household, board, scope), [household, board]);

  // "Enter Horizon here" while a cloud passage is already under way does nothing: say so.
  const [notice, setNotice] = useState("");
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const boardActions = useMemo<JourneyBoardActions>(() => {
    const live = actionsRef;
    const out: JourneyBoardActions = {
      openRecord: (mode, prefill) => live.current.openRecord(mode, prefill),
      openBillPaid: (id) => live.current.openBillPaid(id),
      openDueReview: (id) => live.current.openDueReview(id),
      openPlace: (target, object) => live.current.openPlace(target, object),
      openCampfire: (id) => live.current.openCampfire(id),
      openWeeklySitdown: () => live.current.openWeeklySitdown(),
      openHomeBook: (id) => live.current.openHomeBook(id),
      openEraPlanner: (id) => live.current.openEraPlanner(id),
      openKitty: (id) => live.current.openKitty(id),
      openCalendar: (date) => live.current.openCalendar(date),
      openBooks: (ref) => live.current.openBooks(ref),
      enterHorizon: (location) => {
        const started = live.current.enterHorizon(location);
        setNotice(started === false ? COPY.enterHorizonBusy : "");
        return started;
      },
      back: () => live.current.back(),
    };
    // The dial hides a chip whose callback is absent, so only forward the ones the App supplied.
    if (actions.openAllTools) out.openAllTools = () => live.current.openAllTools?.();
    if (actions.chooseSimpleView) out.chooseSimpleView = () => live.current.chooseSimpleView?.();
    return out;
  }, [Boolean(actions.openAllTools), Boolean(actions.chooseSimpleView)]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- land ------------------------------------------------------------------------------------------------------
  const [land, setLand] = useState<{ status: "loading" | "ready" | "failed"; data: JourneyLandData | null }>({ status: "loading", data: null });
  const loader = useRef(props.loadLand ?? loadJourneyLand);
  useEffect(() => {
    const controller = new AbortController();
    loader.current(controller.signal).then(
      (data) => { if (!controller.signal.aborted) setLand({ status: "ready", data }); },
      () => { if (!controller.signal.aborted) setLand({ status: "failed", data: null }); },
    );
    return () => controller.abort();
  }, []);

  // Offline: the books shown are this device's copy — said on the purse and the list (UX #25).
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && navigator.onLine === false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => setOffline(typeof navigator !== "undefined" && navigator.onLine === false);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => { window.removeEventListener("online", sync); window.removeEventListener("offline", sync); };
  }, []);

  const createScene = props.createScene === undefined ? createJourneyMapScene : props.createScene;
  const [lost, setLost] = useState(false);
  const wants3d = quality !== "flat" && !lost && Boolean(createScene) && land.status !== "failed";
  const [landHandle, setLandHandle] = useState<JourneyLandHandle | null>(null);
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const homesRef = useRef(board.homes);
  homesRef.current = board.homes;
  const build = useRef(props.buildLand ?? buildJourneyLand);
  useEffect(() => {
    if (!wants3d || !land.data) return;
    let handle: JourneyLandHandle;
    try {
      handle = build.current(land.data, { theme: themeRef.current, tier: quality === "full" ? "full" : "lite", homes: homesRef.current });
    } catch {
      setLost(true);
      return;
    }
    setLandHandle(handle);
    return () => { setLandHandle(null); handle.dispose(); };
  }, [wants3d, land.data, quality]);
  useEffect(() => { if (landHandle) landHandle.setTheme(theme); }, [landHandle, theme]);

  const stage: JourneyStageSource = {
    mode: wants3d && landHandle ? "live" : "flat",
    status: land.status,
    land: land.data,
    landHandle: wants3d ? landHandle : null,
    createScene: wants3d ? createScene : null,
    quality: quality === "full" ? "full" : "lite",
    awaiting3d: wants3d,
  };

  // --- arrival: Horizon's "Journey" return restores `lastEnter`; a route `time` opens that date's chapter -----------
  const initial = useMemo<JourneyViewStateV2>(() => {
    const saved = store.initial;
    if (props.returningFromHorizon && saved.lastEnter) return { ...saved, level: saved.lastEnter.level, focusDate: saved.lastEnter.focusDate, listMode: "map" };
    if (props.focusDate) return { ...saved, focusDate: props.focusDate, level: saved.level === "week" ? "month" : saved.level, selectedStopId: null };
    return saved;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nameOf = useMemo(() => {
    const names = new Map(household.members.map((m) => [m.id, m.name] as const));
    return (id: string) => names.get(id) ?? "your partner";
  }, [household.members]);

  return (
    <>
      <JourneyBoardView
        board={board}
        actions={boardActions}
        theme={theme}
        reducedMotion={reducedMotion}
        stage={stage}
        listOf={listOf}
        freshnessNote={props.freshnessNote}
        nameOf={nameOf}
        dueReview={props.dueReview}
        onChooseTheme={props.onChooseTheme}
        initialViewState={initial}
        onViewStateChange={store.save}
        onBeforeEnterHorizon={(state) => { store.save(state); store.flush(); }}
        onLost={() => setLost(true)}
        onReady={props.onReady}
        notice={notice}
        offline={offline}
        recordModes={(props as JourneyBoardProps & RecordModesProp).recordModes}
      />
    </>
  );
}

/**
 * The Journey Board — the mounted entry (T4; T5 mounts it lazily on the household journey route).
 *
 * Wiring: `deriveJourneyBoard` (memoised on the household snapshot + memberId + today) → summary + list render at
 * once; `loadJourneyLand` (aborted on unmount) → `buildJourneyLand` → `layoutRoute` → `createJourneyBoardScene`
 * (inside the Stage). The flat twin (SVG, no WebGL) is used when `qualityTier(...)` is "flat", and after a lost
 * context; a failed land load leaves the summary + list (every action still works with no WebGL at all).
 * `onReady` fires once: the first 3D frame, the flat board, or a failed load with the list up.
 *
 * Nothing here posts, stores (except view state through `viewState.ts`) or creates a clock: `today` is the App's.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { AttentionItem, CameraTier, JourneyBoard as JourneyBoardModel, JourneyBoardActions, JourneyBoardProps, JourneyLandData, JourneyLandHandle, LoadJourneyLand } from "../contracts.ts";
import { deriveJourneyBoard } from "../model/index.ts";
import { buildJourneyLand, loadJourneyLand } from "../land/index.ts";
import { layoutRoute, type BoardSceneHandle, type BoardSceneOptions, type FocusTarget, type JourneyBoardSceneExtras } from "../board/index.ts";
import { qualityTier, readQualityInput, type QualityTier } from "../../harbour/scene/quality.ts";
import { MOTION_KEY } from "../../harbour/nav/motionEdition.ts";
import { JourneyBoardView, type JourneyStageSource } from "./JourneyBoardView.tsx";
import { COPY, dueReviewWords } from "./copy.ts";
import { useReducedMotion } from "./motion.ts";
import { useJourneyViewStateStore } from "./viewState.ts";

/** Test seams only (the App passes plain `JourneyBoardProps`). */
export type JourneyBoardSeams = {
  quality?: QualityTier;
  sceneExtras?: JourneyBoardSceneExtras;
  createScene?: (host: HTMLElement, options: BoardSceneOptions) => BoardSceneHandle;
  loadLand?: LoadJourneyLand;
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
  // PR #567 Codex P1: Simple view (`hearth:motion`) can change while the board is up — follow it (the App also
  // moves the reading edition to the Desk; this keeps the board itself honest either way).
  const qualitySeam = props.quality;
  useEffect(() => {
    if (qualitySeam) return;
    const sync = () => setQuality(detectQuality());
    window.addEventListener(MOTION_KEY, sync);
    return () => window.removeEventListener(MOTION_KEY, sync);
  }, [qualitySeam]);

  // Derived on read; the household snapshot is immutable, so its identity is the revision that matters.
  const derived = useMemo(() => deriveJourneyBoard(household, memberId, today), [household, memberId, today]);
  // The App's due reminders (review B1) lead "Needs attention"; the model stays pure and never sees them.
  const dueCount = props.dueReview && props.dueReview.count > 0 ? props.dueReview.count : 0;
  const board = useMemo<JourneyBoardModel>(() => {
    if (!dueCount || derived.empty) return derived;
    const due: AttentionItem = { id: "attention:due-review", words: dueReviewWords(dueCount), stopId: null, call: { name: "openDueReview" } };
    return { ...derived, summary: { ...derived.summary, attention: [due, ...derived.summary.attention] } };
  }, [derived, dueCount]);

  // "Enter Horizon here" while a cloud passage is already under way does nothing: say so (review MINOR 9).
  const [notice, setNotice] = useState("");
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const boardActions = useMemo<JourneyBoardActions>(() => {
    const live = actionsRef;
    return {
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
  }, []);

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

  const [lost, setLost] = useState(false);
  const wants3d = quality !== "flat" && !lost;
  const [landHandle, setLandHandle] = useState<JourneyLandHandle | null>(null);
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const homesRef = useRef(board.homes);
  homesRef.current = board.homes;
  useEffect(() => {
    if (!wants3d || !land.data) return;
    let handle: JourneyLandHandle;
    try {
      handle = buildJourneyLand(land.data, { theme: themeRef.current, tier: quality === "full" ? "full" : "lite", homes: homesRef.current });
    } catch {
      setLost(true);
      return;
    }
    setLandHandle(handle);
    return () => { setLandHandle(null); handle.dispose(); };
  }, [wants3d, land.data, quality]);

  const route = useMemo(() => (land.data ? layoutRoute(board, land.data) : null), [board, land.data]);

  const stage: JourneyStageSource = {
    mode: wants3d ? (landHandle && route ? "live" : "none") : land.data && route ? "flat" : "none",
    status: land.status === "failed" ? "failed" : "loading",
    land: land.data,
    landHandle: wants3d ? landHandle : null,
    route,
    quality: quality === "full" ? "full" : "lite",
  };

  // --- framing: Horizon's "Journey" return restores `lastEnter`; a route `time` frames that date ----------------
  const lastEnter = store.initial.lastEnter;
  const initialFocusOverride = useMemo<{ target: FocusTarget; tier: CameraTier } | null>(() => {
    if (props.returningFromHorizon && lastEnter) {
      const loc = lastEnter.location;
      if ("x" in loc) return { target: { x: loc.x, y: loc.y }, tier: lastEnter.tier };
      const host = land.data?.hosts.find((h) => h.id === loc.host);
      if (host) return { target: { x: host.door[0], y: host.door[1] }, tier: lastEnter.tier };
      return lastEnter.focusDate ? { target: { date: lastEnter.focusDate }, tier: lastEnter.tier } : null;
    }
    if (props.focusDate) return { target: { date: props.focusDate }, tier: "region" };
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [land.data]);

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
      freshnessNote={props.freshnessNote}
      nameOf={nameOf}
      initialViewState={props.focusDate && !props.returningFromHorizon ? { ...store.initial, focusDate: props.focusDate, target: null } : store.initial}
      onViewStateChange={store.save}
      onBeforeEnterHorizon={(state) => { store.save(state); store.flush(); }}
      initialFocusOverride={initialFocusOverride}
      sceneExtras={props.sceneExtras}
      createScene={props.createScene}
      onLost={() => setLost(true)}
      onReady={props.onReady}
    />
    <p className="journey-visually-hidden" role="status" aria-live="polite" data-journey-notice="">{notice}</p>
    </>
  );
}

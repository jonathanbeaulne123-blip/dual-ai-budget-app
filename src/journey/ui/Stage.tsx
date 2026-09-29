/**
 * The Journey stage (T4): the canvas host (live 3D board on the shared renderer lease) or the flat twin
 * (`<JourneyLandFlat>` + `<BoardFlat>` — SVG, no WebGL), with the DOM marks layer over it.
 *
 * - Live: `createJourneyBoardScene(host, …)` once per land handle; the latest board / selection / preview / theme are
 *   pushed with the handle's setters; anchors arrive per rendered frame; `onLost` hands the stage to the flat twin.
 * - Flat: the same `RouteSpace` on the SVG, framed by a viewBox per tier (the whole island at Sky, a stretch at
 *   Region, a few days at Stop); mark anchors are computed from the same `boardMarks` ids (`FLAT_UNIT` offsets).
 * - None: the land is still loading or could not be drawn — a quiet note; the summary and the list work regardless.
 * Nothing here runs an action: picking or pressing a mark only reports an id upward.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { CameraTier, JourneyBoard, JourneyLandData, JourneyLandHandle, MarkAnchor, RouteSpace, ThemeId } from "../contracts.ts";
import {
  boardMarks, BoardFlat, createJourneyBoardScene, FLAT_UNIT, type BoardSceneHandle, type BoardSceneOptions, type FocusTarget,
  type JourneyBoardSceneExtras, type PreviewSelection,
} from "../board/index.ts";
import { journeyLandFlatData, JourneyLandFlat } from "../land/index.ts";
import { COPY } from "./copy.ts";

export type StageMode = "live" | "flat" | "none";
export type FlatView = { x: number; y: number; tier: CameraTier };
export type StageSize = { width: number; height: number };

/** Ground height (concept metres) the flat twin frames at Region / Stop. Sky shows the whole island. */
export const FLAT_FRAME = { region: 560, stop: 200 } as const;
export const FALLBACK_STAGE: StageSize = { width: 390, height: 600 };

/** The flat twin's viewBox for a tier around a point, matched to the stage's aspect and kept on the island. */
export function flatViewBox(view: FlatView, extent: { w: number; h: number }, size: StageSize): [number, number, number, number] {
  if (view.tier === "sky") return [0, 0, extent.w, extent.h];
  const aspect = Math.max(0.2, size.width / Math.max(1, size.height));
  const h = FLAT_FRAME[view.tier], w = h * aspect;
  const x0 = Math.min(Math.max(view.x - w / 2, Math.min(0, extent.w - w)), Math.max(0, extent.w - w));
  const y0 = Math.min(Math.max(view.y - h / 2, Math.min(0, extent.h - h)), Math.max(0, extent.h - h));
  return [x0, y0, w, h];
}

/** Concept (x, y) → stage px under `preserveAspectRatio="xMidYMid meet"`. */
export function flatProject(x: number, y: number, box: readonly [number, number, number, number], size: StageSize): { x: number; y: number } {
  const [vx, vy, vw, vh] = box;
  const scale = Math.min(size.width / vw, size.height / vh);
  const ox = (size.width - vw * scale) / 2, oy = (size.height - vh * scale) / 2;
  return { x: ox + (x - vx) * scale, y: oy + (y - vy) * scale };
}

/** The flat twin's anchors: the same mark ids as the 3D scene, `visible` by tier and on-stage. */
export function flatAnchors(board: JourneyBoard, route: RouteSpace, box: readonly [number, number, number, number], size: StageSize, tier: CameraTier): MarkAnchor[] {
  return boardMarks(board, route).map((m) => {
    const p = flatProject(m.base[0] + m.offset[0] * FLAT_UNIT, m.base[2] + m.offset[1] * FLAT_UNIT, box, size);
    const onStage = p.x >= 0 && p.x <= size.width && p.y >= 0 && p.y <= size.height;
    return { id: m.id, x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, depth: 0, visible: onStage && m.tiers.includes(tier) };
  });
}

export type StageProps = {
  mode: StageMode;
  /** Why the stage is empty in mode "none". */
  status: "loading" | "failed";
  board: JourneyBoard;
  land: JourneyLandData | null;
  landHandle: JourneyLandHandle | null;
  route: RouteSpace | null;
  theme: ThemeId;
  quality: "full" | "lite";
  reducedMotion: boolean;
  selection: string | null;
  preview: PreviewSelection | null;
  flatView: FlatView;
  /** Where the live camera opens (read once, when the scene is created). */
  initialFocus: { target: FocusTarget; tier: CameraTier };
  sceneExtras?: JourneyBoardSceneExtras;
  createScene?: (host: HTMLElement, options: BoardSceneOptions) => BoardSceneHandle;
  onScene(handle: BoardSceneHandle | null): void;
  onTier(tier: CameraTier): void;
  onPick(id: string | null): void;
  onFrame(anchors: readonly MarkAnchor[]): void;
  onReady(): void;
  onLost(): void;
  onKeyDown(event: KeyboardEvent<HTMLDivElement>): void;
  /** The stage's laid-out box changed (reported with the same measurement the scene is resized with). */
  onSize?(size: StageSize): void;
  /** The person moved the camera by hand (a drag, a wheel, a pinch): the view is theirs now. */
  onCameraInput?(): void;
  renderMarks(anchors: readonly MarkAnchor[], size: StageSize): ReactNode;
};

export function Stage(props: StageProps) {
  const { mode, board, land, landHandle, route, theme, selection, preview } = props;
  const wrap = useRef<HTMLDivElement | null>(null);
  const host = useRef<HTMLDivElement | null>(null);
  const scene = useRef<BoardSceneHandle | null>(null);
  const [size, setSize] = useState<StageSize>(() => props.sceneExtras?.size ?? FALLBACK_STAGE);
  const [liveAnchors, setLiveAnchors] = useState<readonly MarkAnchor[]>([]);
  const latest = useRef(props);
  latest.current = props;

  // Stage size: the real layout box, or the fallback (jsdom, before layout).
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!(w > 0 && h > 0)) return;
      setSize((s) => (s.width === w && s.height === h ? s : { width: w, height: h }));
      latest.current.onSize?.({ width: w, height: h });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [mode]);

  const boardSent = useRef<{ board: JourneyBoard; route: RouteSpace } | null>(null);
  // Live scene: one per land handle. Later data arrives through the handle's setters.
  useEffect(() => {
    if (mode !== "live" || !landHandle || !route || !host.current) return;
    const p = latest.current;
    const create = p.createScene ?? createJourneyBoardScene;
    const handle = create(host.current, {
      land: landHandle, board: p.board, route, theme: p.theme, tier: p.quality, reducedMotion: p.reducedMotion,
      onAnchors: (anchors) => { setLiveAnchors(anchors); latest.current.onFrame(anchors); },
      onTier: (tier) => latest.current.onTier(tier),
      onPick: (id) => latest.current.onPick(id),
      onReady: () => latest.current.onReady(),
      onLost: () => latest.current.onLost(),
      initialFocus: p.initialFocus,
      ...p.sceneExtras,
    });
    scene.current = handle;
    boardSent.current = { board: p.board, route };
    if (p.selection) handle.setSelection(p.selection);
    if (p.preview) handle.setPreview(p.preview);
    p.onScene(handle);
    return () => {
      scene.current = null;
      latest.current.onScene(null);
      handle.dispose();
      setLiveAnchors([]);
    };
    // Created once per mode + land handle; everything else is pushed below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, landHandle, Boolean(route)]);

  useEffect(() => {
    const s = scene.current;
    if (!s || !route) return;
    if (boardSent.current && boardSent.current.board === board && boardSent.current.route === route) return;
    boardSent.current = { board, route };
    s.setBoard(board, route);
  }, [board, route]);
  useEffect(() => { scene.current?.setSelection(selection); }, [selection]);
  useEffect(() => { scene.current?.setPreview(preview); }, [preview]);
  useEffect(() => { scene.current?.setTheme(theme); }, [theme]);
  useEffect(() => { if (mode === "live") scene.current?.resize(size.width, size.height); }, [mode, size]);
  useEffect(() => {
    if (mode !== "live" || typeof document === "undefined") return;
    const onVisibility = () => (document.visibilityState === "hidden" ? scene.current?.sleep() : scene.current?.wake());
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [mode]);

  // Flat twin.
  const flatData = useMemo(() => (land ? journeyLandFlatData(land) : null), [land]);
  const box = useMemo(() => (land ? flatViewBox(props.flatView, land.extent, size) : null), [land, props.flatView, size]);
  const flatMarks = useMemo(
    () => (mode === "flat" && route && box ? flatAnchors(board, route, box, size, props.flatView.tier) : []),
    [mode, route, box, board, size, props.flatView.tier],
  );
  const flatShown = mode === "flat" && flatData && route && box;
  useEffect(() => {
    if (flatShown) latest.current.onFrame(flatMarks);
  }, [flatShown, flatMarks]);

  const anchors = mode === "live" ? liveAnchors : flatMarks;
  // A drag (past a small slop, so a tap on a mark stays a tap), a wheel or a second finger: the camera is theirs.
  const press = useRef<{ x: number; y: number } | null>(null);
  const handInput = () => latest.current.onCameraInput?.();
  return (
    <div
      ref={wrap}
      className={`journey-stage journey-stage--${mode}`}
      data-stage-mode={mode}
      role="region"
      aria-label={COPY.mapLabel}
      aria-describedby="journey-stage-help"
      tabIndex={0}
      onKeyDown={props.onKeyDown}
      onWheel={handInput}
      onPointerDown={(e) => { if (press.current && e.isPrimary === false) handInput(); press.current = { x: e.clientX, y: e.clientY }; }}
      onPointerMove={(e) => { const p = press.current; if (p && e.buttons && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 6) { press.current = null; handInput(); } }}
      onPointerUp={() => { press.current = null; }}
      onPointerCancel={() => { press.current = null; }}
    >
      <p id="journey-stage-help" className="journey-visually-hidden">{COPY.mapHelp}</p>
      {mode === "live" ? <div ref={host} className="journey-stage__canvas" aria-hidden="true" /> : null}
      {flatShown ? (
        <div className="journey-stage__flat" aria-hidden="true">
          <JourneyLandFlat data={{ ...flatData, viewBox: box }} theme={theme} showDistrictLabels={props.flatView.tier === "sky"}>
            <BoardFlat route={route} board={board} selection={selection} theme={theme} preview={preview} onPick={(id) => latest.current.onPick(id)} />
          </JourneyLandFlat>
        </div>
      ) : null}
      {mode === "none" ? (
        <p className="journey-stage__note" role="status">{props.status === "failed" ? COPY.mapUnavailable : COPY.loadingMap}</p>
      ) : null}
      {mode !== "none" ? props.renderMarks(anchors, size) : null}
    </div>
  );
}

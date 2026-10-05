/**
 * The map stage (L4): the live clay scene (L3 `createJourneyMapScene`, injected) on an aria-hidden canvas host, or the
 * flat map (SVG clock / Week trail / Year ring + the flat island from L2's `JourneyLandFlat`), with the DOM marks over
 * either. The flat map needs no WebGL and no land: a failed or slow land still draws the clock and every mark.
 *
 * - Live: the scene is created once per land handle; board / level / chapter / selection / theme / size / safe area are
 *   pushed through its setters; anchors arrive per frame; `onLost` hands the stage to the flat map.
 * - Wheel and pinch pull the level. In live mode the scene owns its canvas (it reports `onLevel`); the stage handles
 *   wheel / pinch that land on the marks layer or the flat map.
 * Nothing here runs an action: a pick only reports ids upward.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type {
  ChapterId, CreateJourneyMapScene, JourneyBoardV2, JourneyLandData, JourneyLandHandle, JourneyLevel, JourneyMapSceneHandle, MarkAnchor, ThemeId,
} from "../contracts.ts";
import { JOURNEY_DIORAMA, levelForT } from "../contracts.ts";
import { journeyLandFlatData, JourneyLandFlat } from "../land/index.ts";
import { COPY } from "./copy.ts";
import { flatIslandFrame, flatScale, projectFlat, slotAt, weekTileAt, type MapMark } from "./mapLayout.ts";

export type StageMode = "live" | "flat";
export type StageSize = { width: number; height: number };
export type SafeArea = { top: number; right: number; bottom: number; left: number };
export const NO_SAFE_AREA: SafeArea = { top: 0, right: 0, bottom: 0, left: 0 };
export const FALLBACK_STAGE: StageSize = { width: 390, height: 640 };

export type StageProps = {
  mode: StageMode;
  status: "loading" | "ready" | "failed";
  board: JourneyBoardV2;
  land: JourneyLandData | null;
  landHandle: JourneyLandHandle | null;
  createScene: CreateJourneyMapScene | null;
  theme: ThemeId;
  quality: "full" | "lite";
  reducedMotion: boolean;
  t: number;
  level: JourneyLevel;
  chapterId: ChapterId;
  /** The chapter turn's direction for the next `setChapter` (−1, 0, 1). */
  chapterDir: -1 | 0 | 1;
  selection: string | null;
  marks: readonly MapMark[];
  safeArea: SafeArea;
  onScene(handle: JourneyMapSceneHandle | null): void;
  onAnchors(anchors: readonly MarkAnchor[]): void;
  onPick(ids: string[], at: { x: number; y: number } | null): void;
  onLevel(t: number, settle: boolean): void;
  onReady(): void;
  onLost(): void;
  onKeyDown(event: KeyboardEvent<HTMLDivElement>): void;
  onSize?(size: StageSize): void;
  renderMarks(anchors: readonly MarkAnchor[] | null, size: StageSize, unit: number): ReactNode;
};

export function Stage(props: StageProps) {
  const { mode, board, landHandle, theme, selection, t, chapterId, level } = props;
  const wrap = useRef<HTMLDivElement | null>(null);
  const host = useRef<HTMLDivElement | null>(null);
  const scene = useRef<JourneyMapSceneHandle | null>(null);
  const [size, setSize] = useState<StageSize>(FALLBACK_STAGE);
  const [anchors, setAnchors] = useState<readonly MarkAnchor[]>([]);
  const latest = useRef(props);
  latest.current = props;

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

  // --- live scene: one per land handle; everything else goes through the handle's setters ---------------------------
  const sent = useRef<{ board: JourneyBoardV2; t: number; chapterId: ChapterId; selection: string | null; theme: ThemeId } | null>(null);
  useEffect(() => {
    const create = latest.current.createScene;
    if (mode !== "live" || !landHandle || !create || !host.current) return;
    const p = latest.current;
    let handle: JourneyMapSceneHandle;
    try {
      handle = create(host.current, {
        land: landHandle, board: p.board, theme: p.theme, tier: p.quality, reducedMotion: p.reducedMotion, t: p.t, chapterId: p.chapterId,
        onAnchors: (a) => { setAnchors(a); latest.current.onAnchors(a); },
        onPick: (ids) => latest.current.onPick(ids, lastPointer.current),
        onLevel: (v) => latest.current.onLevel(v, false),
        onReady: () => latest.current.onReady(),
        onLost: () => latest.current.onLost(),
      });
    } catch {
      p.onLost();
      return;
    }
    scene.current = handle;
    sent.current = { board: p.board, t: p.t, chapterId: p.chapterId, selection: null, theme: p.theme };
    if (p.selection) { handle.setSelection(p.selection); sent.current.selection = p.selection; }
    p.onScene(handle);
    return () => {
      scene.current = null;
      sent.current = null;
      latest.current.onScene(null);
      handle.dispose();
      setAnchors([]);
    };
  }, [mode, landHandle]);

  const animate = !props.reducedMotion;
  useEffect(() => { const s = scene.current, was = sent.current; if (s && was && was.board !== board) { was.board = board; s.setBoard(board); } }, [board]);
  useEffect(() => { const s = scene.current, was = sent.current; if (s && was && was.t !== t) { was.t = t; s.setLevel(t, animate); } }, [t, animate]);
  useEffect(() => {
    const s = scene.current, was = sent.current;
    if (s && was && was.chapterId !== chapterId) { was.chapterId = chapterId; s.setChapter(chapterId, latest.current.chapterDir, animate); }
  }, [chapterId, animate]);
  useEffect(() => { const s = scene.current, was = sent.current; if (s && was && was.selection !== selection) { was.selection = selection; s.setSelection(selection); } }, [selection]);
  useEffect(() => { const s = scene.current, was = sent.current; if (s && was && was.theme !== theme) { was.theme = theme; s.setTheme(theme); } }, [theme]);
  useEffect(() => { if (mode === "live") scene.current?.resize(size.width, size.height); }, [mode, size]);
  useEffect(() => { if (mode === "live") scene.current?.setSafeArea(props.safeArea); }, [mode, props.safeArea]);
  useEffect(() => {
    if (mode !== "live" || typeof document === "undefined") return;
    const onVisibility = () => (document.visibilityState === "hidden" ? scene.current?.sleep() : scene.current?.wake());
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [mode]);

  // --- wheel / pinch pull the level (outside the live canvas) -------------------------------------------------------
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; t: number } | null>(null);
  const wheelSettle = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (wheelSettle.current) clearTimeout(wheelSettle.current); }, []);
  const onCanvas = (target: EventTarget | null) => Boolean(host.current && target instanceof Node && host.current.contains(target));
  const local = (x: number, y: number) => {
    const r = wrap.current?.getBoundingClientRect();
    return r ? { x: x - r.left, y: y - r.top } : { x, y };
  };
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (onCanvas(e.target) || (e.target instanceof Element && e.target.closest(".journey-list"))) return;
      e.preventDefault();
      const next = Math.min(2, Math.max(0, latest.current.t - e.deltaY * 0.0022));
      latest.current.onLevel(next, false);
      if (wheelSettle.current) clearTimeout(wheelSettle.current);
      wheelSettle.current = setTimeout(() => latest.current.onLevel(Math.round(latest.current.t), true), latest.current.reducedMotion ? 0 : 240);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // --- flat map ---------------------------------------------------------------------------------------------------
  const inset = { top: props.safeArea.top, bottom: props.safeArea.bottom, left: props.safeArea.left, right: props.safeArea.right };
  const unit = flatScale(size, inset);
    // The flat island is decoration: a land it cannot read leaves the clock and the marks standing.
  const flatData = useMemo(() => { try { return mode === "flat" && props.land ? journeyLandFlatData(props.land) : null; } catch { return null; } }, [mode, props.land]);
  const island = useMemo(() => { try { return mode === "flat" && props.land ? flatIslandFrame(props.land) : null; } catch { return null; } }, [mode, props.land]);
  // The flat map's readiness is the view's call (it knows whether a 3D map is still on its way).
  const flatShown = mode === "flat";

  const centre = projectFlat([0, 0], size, inset);
  const { bezel, islandUnits } = JOURNEY_DIORAMA;
  const toPx = (du: number) => du * unit;
  const shownLevel = levelForT(t);

  return (
    <div
      ref={wrap}
      className={`journey-stage journey-stage--${mode} journey-stage--${shownLevel}`}
      data-stage-mode={mode}
      data-stage-level={level}
      data-land={props.status}
      role="region"
      aria-label={COPY.mapLabel}
      aria-describedby="journey-stage-help"
      tabIndex={0}
      onKeyDown={props.onKeyDown}
      onPointerDown={(e) => {
        lastPointer.current = local(e.clientX, e.clientY);
        if (onCanvas(e.target)) return;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.current.size === 2) { const [a, b] = [...pointers.current.values()]; pinch.current = { d: Math.hypot(a!.x - b!.x, a!.y - b!.y), t: latest.current.t }; }
      }}
      onPointerMove={(e) => {
        if (!pointers.current.has(e.pointerId)) return;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pinch.current && pointers.current.size === 2) {
          const [a, b] = [...pointers.current.values()];
          const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
          if (d > 0 && pinch.current.d > 0) latest.current.onLevel(Math.min(2, Math.max(0, pinch.current.t + Math.log2(d / pinch.current.d) * 0.9)), false);
        }
      }}
      onPointerUp={(e) => { pointers.current.delete(e.pointerId); if (pinch.current && pointers.current.size < 2) { pinch.current = null; latest.current.onLevel(Math.round(latest.current.t), true); } }}
      onPointerCancel={(e) => { pointers.current.delete(e.pointerId); pinch.current = null; }}
    >
      <p id="journey-stage-help" className="journey-visually-hidden">{COPY.mapHelp}</p>
      {mode === "live" ? <div ref={host} className="journey-stage__canvas" aria-hidden="true" /> : null}
      {flatShown ? (
        <div className="journey-flat" aria-hidden="true" data-flat-level={shownLevel}>
          {shownLevel === "month" ? (
            <>
              <svg className="journey-flat__clock" width={size.width} height={size.height} viewBox={`0 0 ${size.width} ${size.height}`}>
                <circle cx={centre.x} cy={centre.y} r={toPx(bezel.outer + 0.28)} className="journey-flat__plinth" />
                <circle cx={centre.x} cy={centre.y} r={toPx((bezel.outer + bezel.inner) / 2)} className="journey-flat__bezel" strokeWidth={toPx(bezel.outer - bezel.inner)} fill="none" />
                <circle cx={centre.x} cy={centre.y} r={toPx(bezel.inner - 0.05)} className="journey-flat__sea" />
                {Array.from({ length: JOURNEY_DIORAMA.slots }, (_, i) => {
                  const p = projectFlat(slotAt(i + 1), size, inset);
                  return <circle key={i} cx={p.x} cy={p.y} r={Math.max(2, toPx(0.07))} className="journey-flat__stud" />;
                })}
                {[8, 15, 22].map((d) => {
                  const s = slotAt(d), k = (bezel.outer + 0.5) / bezel.road;
                  const p = projectFlat([s[0] * k, s[1] * k], size, inset);
                  return <text key={d} x={p.x} y={p.y} className="journey-flat__numeral" textAnchor="middle" dominantBaseline="middle">{d}</text>;
                })}
              </svg>
              {flatData && island ? (
                <div className="journey-flat__island" style={{ left: centre.x - toPx(islandUnits), top: centre.y - toPx(islandUnits), width: toPx(islandUnits) * 2, height: toPx(islandUnits) * 2 }}>
                  <JourneyLandFlat data={{ ...flatData, viewBox: [island.centre[0] - island.radius, island.centre[1] - island.radius, island.radius * 2, island.radius * 2] }} theme={theme} showDistrictLabels={false} />
                </div>
              ) : null}
            </>
          ) : null}
          {shownLevel === "week" ? (
            <svg className="journey-flat__trail" width={size.width} height={size.height} viewBox={`0 0 ${size.width} ${size.height}`}>
              <path d={Array.from({ length: 7 }, (_, i) => projectFlat(weekTileAt(i), size, inset)).map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ")} className="journey-flat__lane" strokeWidth={Math.max(10, toPx(0.32))} fill="none" />
            </svg>
          ) : null}
        </div>
      ) : null}
      {props.status !== "ready" ? (
        <p className="journey-stage__note" role="status" data-land-note={props.status}>{props.status === "failed" ? COPY.mapUnavailable : COPY.loadingMap}</p>
      ) : null}
      {props.renderMarks(mode === "live" ? anchors : null, size, unit)}
    </div>
  );
}

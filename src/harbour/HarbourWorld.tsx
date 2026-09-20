import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import type { DateKey } from "../core/calendar.ts";
import type { Household, LedgerView } from "../core/types.ts";
import type { FundPulseFreshness } from "../core/fundPulse.ts";
import { isFreshPresence, type SoftPresenceDisplay } from "../softPresence.ts";
import type { HouseRoute, HouseRoom, HouseLevel } from "../hearthside/houseRoutes.ts";
import { readHouseReturn, saveHouseReturn, houseIdentity } from "../house/navigation.ts";
import { houseCameraRoute, houseComposition, sameHouseCameraRoute } from "../house/returnCache.ts";
import { livingEvidence } from "../house/interpretation.ts";
import { interpretationSourceRevision, supportedAtFor, useSupportedHouseInterpretation, type InterpretationGate } from "../house/supportedInterpretation.ts";
import { DEFAULT_QUEEN_STYLE } from "../house/queenStyle.ts";
import type { BloomEvidence } from "../house/world/bloom.ts";
import { useAppearance } from "../theme/ThemeProvider.tsx";
import type { ThemeId } from "../theme/scenes.ts";
import { useHarbourReading } from "./data/useHarbourReading.ts";
import { HarbourFlat } from "./flat/PlaceFlat.tsx";
import { HarbourTwins } from "./court/CourtTwins.tsx";
import { HARBOUR_PLACE_LEVELS, HARBOUR_PLACE_NAMES, harbourPlaceFor, harbourWayFor, type HarbourPlaceId } from "./flag.ts";
import { classifyGesture, gestureAction, spark, type QueenAction, type QueenRegion, type QueenSpark } from "./court/queenTouch.ts";
import type { QueenPlace } from "./court/queenPlace.ts";
import type { CourtHandle } from "./court/CourtScene.ts";
import type { HarbourRuntime, HarbourGesture, HarbourHit, ProjectedRect, ScrubControls } from "./scene/runtime.ts";
import { PLACES, sceneDressingFrom, type PlaceReading, type Region } from "./scene/place.ts";
import { harbourCameraSlot } from "./scene/travel.ts";
import { qualityTier, readQualityInput, type QualityTier, type RenderTier } from "./scene/quality.ts";
import "./harbour.css";

/**
 * The Court's React shell (BUILD_PLAN #2). Props are `HouseWorld`'s plus the
 * presence and the two quick-sheet nodes; the App keeps no new state for the
 * scene. The stage is full-bleed above the compass; the reading edition is
 * the loading frame, the `flat` tier and the WebGL fallback; a tool in front
 * collapses the stage to a door strip.
 */
export type HarbourWorldProps = {
  household: Household;
  memberId: string;
  scope: LedgerView;
  today: DateKey;
  route: HouseRoute;
  ready: boolean;
  freshness: string;
  interpretationGate?: InterpretationGate;
  onNavigate: (room: HouseRoom, level: HouseLevel, replace?: boolean) => void;
  onOpen: (target: string, object?: string) => void;
  onClose: () => void;
  presence?: SoftPresenceDisplay;
  partnerName?: string | null;
  /** Space, or the compass handle: the App owns the quick sheet. */
  onQuickSheet?: () => void;
  children?: ReactNode;
};

type Status = "loading" | "ready" | "fallback" | "flat";
type Lens = "living" | "growth" | "shape";
export { HARBOUR_CAMERA_SLOT_PREFIX, harbourCameraSlot } from "./scene/travel.ts";

/**
 * Each place is its own chunk: the tower and the cellar are never downloaded
 * by someone who only stands in the Court. Importing a module registers its
 * `Place` under its id (`scene/place.ts`).
 */
const PLACE_MODULES: Readonly<Record<HarbourPlaceId, () => Promise<unknown>>> = {
  court: () => import("./court/CourtScene.ts"),
  tower: () => import("./tower/TowerScene.ts"),
  cellar: () => import("./cellar/CellarScene.ts"),
};

const REDUCED = "(prefers-reduced-motion: reduce)";
const pulseFreshness = (gate: InterpretationGate | undefined): FundPulseFreshness => (gate?.freshness === "stale" || gate?.freshness === "offline" ? gate.freshness : "current");

export default function HarbourWorld(props: HarbourWorldProps) {
  const { household, memberId, scope, today, route, ready, freshness, interpretationGate, onOpen, onClose, presence, partnerName = null, onQuickSheet } = props;
  const appearance = useAppearance(), theme: ThemeId = appearance.preview ?? appearance.saved.theme;
  const host = useRef<HTMLDivElement>(null), stage = useRef<HTMLDivElement>(null);
  const runtime = useRef<HarbourRuntime | null>(null), court = useRef<CourtHandle | null>(null), queen = useRef<QueenPlace | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [tier, setTier] = useState<QualityTier>(() => decideTier(host.current?.getBoundingClientRect().width || window.innerWidth));
  const [rects, setRects] = useState<ProjectedRect[]>([]);
  const [phrase, setPhrase] = useState<string>("");
  const [sparkle, setSparkle] = useState<(QueenSpark & { x: number; y: number; at: number }) | null>(null);
  const [lens, setLens] = useState<Lens>("living");
  const [presenceScale, setPresenceScale] = useState(1);
  const [weeks, setWeeks] = useState<number | null>(null);
  /** The cellar's rail, scrubbed to a day. `null` is today. */
  const [scrub, setScrub] = useState<number | null>(null);
  const toolOpen = Boolean(route.surface);
  /** One room, three places: the route's level says which one stands (BUILD_PLAN_SLICE2 §0). */
  const place: HarbourPlaceId = harbourPlaceFor(route, scope, true) ?? "court";
  const placeName = HARBOUR_PLACE_NAMES[place];
  const identity = { environment: household.environment, householdId: household.householdId, memberId, scope };
  const routeRef = useRef(route); routeRef.current = route;
  const placeRef = useRef(place); placeRef.current = place;
  const identityRef = useRef(identity); identityRef.current = identity;

  const { reading, statusLine } = useHarbourReading({ household, memberId, today, freshness: pulseFreshness(interpretationGate), interpretationGate });
  const partner = useMemo(() => {
    const peer = presence?.peers.find(p => p.memberId !== memberId);
    if (peer) return { fresh: presence?.visible === true && isFreshPresence(peer.seenAt, Date.now()), name: peer.name };
    return partnerName ? { fresh: false, name: partnerName } : null;
  }, [presence, memberId, partnerName]);
  const placeReading: PlaceReading = useMemo(() => ({ ...reading, partner }), [reading, partner]);

  const currentEvidence = useMemo(() => livingEvidence(household, memberId, scope), [household.hearthside, household.personalLife, memberId, scope]); // eslint-disable-line react-hooks/exhaustive-deps
  const supported = useSupportedHouseInterpretation({ identity, gate: interpretationGate ?? { current: true, freshness: "current", detail: "Current local books" }, current: { bloom: currentEvidence }, fallback: { bloom: [] }, sourceRevision: interpretationSourceRevision(household, scope), supportedAt: supportedAtFor(household, today) });
  const evidence: BloomEvidence[] = supported.value.bloom;
  const evidenceSignature = JSON.stringify(evidence);
  const readingRef = useRef(placeReading); readingRef.current = placeReading;
  const onOpenRef = useRef(onOpen); onOpenRef.current = onOpen;
  const onNavigateRef = useRef(props.onNavigate); onNavigateRef.current = props.onNavigate;
  const onRailDragRef = useRef<(x: number, width: number) => void>(() => undefined);
  const evidenceRef = useRef(evidence); evidenceRef.current = evidence;

  const say = useCallback((next: QueenSpark | null, at?: { x: number; y: number }) => {
    if (!next) return;
    setPhrase(next.phrase);
    if (!window.matchMedia(REDUCED).matches && at) setSparkle({ ...next, ...at, at: Date.now() });
  }, []);
  useEffect(() => { if (!sparkle) return; const timer = setTimeout(() => setSparkle(null), sparkle.durationMs); return () => clearTimeout(timer); }, [sparkle]);

  /** The Queen's grammar, acted on (LITTLE_HARBOUR_v2 §1 "How you touch her"). Feedback is a spark and a phrase; data never changes. */
  const act = useCallback((region: QueenRegion, action: QueenAction, detail: { dx?: number; dy?: number; at?: { x: number; y: number } } = {}) => {
    const world = runtime.current, her = queen.current;
    switch (action) {
      case "growth-lens": setLens(current => (current === "living" ? "growth" : current === "growth" ? "shape" : "living")); break;
      case "botanical-presence": setPresenceScale(current => Math.max(0.6, Math.min(1.2, current - (detail.dy ?? 0) * 0.004))); break;
      case "weeks-forward": setWeeks(current => Math.min(evidence.length, (current ?? evidence.length) + 1)); break;
      case "weeks-back": setWeeks(current => Math.max(0, (current ?? evidence.length) - 1)); break;
      case "held-item": { const noticed = readingRef.current.noticed; if (noticed) onOpenRef.current(noticed.target); else setPhrase("Her hands are empty today."); break; }
      case "turn-held-item": if (her) { her.group.rotation.y += Math.PI; world?.setReading(readingRef.current); } break;
      case "portrait": world?.go(world.pose().r < 5.5 && Math.abs(world.pose().target[1] - 0.95) < 0.2 ? "court" : "object", "queen"); break;
      case "roots-view": if (her && world) { const pose = her.poses().roots; world.look({ target: pose.target, r: pose.r, theta: pose.theta, phi: pose.phi }); } break;
      case "spin": if (her) { her.group.rotation.y += (detail.dx ?? 0) * 0.01; world?.setReading(readingRef.current); } break;
      case "distance": world?.gesture({ kind: "zoom", delta: (detail.dy ?? 0) * 0.004 }); break;
    }
    say(spark(region), detail.at);
  }, [evidence.length, say]);

  const onTap = useCallback((hit: HarbourHit, at: { x: number; y: number }) => {
    // She stands in the Court; her touch grammar travels nowhere else.
    if (hit.kind === "queen") { if (placeRef.current !== "court") return; const region = hit.region as QueenRegion; const action = gestureAction(region, "tap"); if (action) act(region, action, { at }); return; }
    if (hit.kind !== "anchor") return;
    activate(hit.id, hit.anchor.door, hit.anchor.zone);
  }, [act]); // eslint-disable-line react-hooks/exhaustive-deps
  const onGesture = useCallback((gesture: HarbourGesture) => {
    if (placeRef.current !== "court") return;
    const kind = classifyGesture(gesture.samples); if (!kind) return;
    const region = gesture.region as QueenRegion; const action = gestureAction(region, kind); if (!action) return;
    const first = gesture.samples[0]!, last = gesture.samples[gesture.samples.length - 1]!;
    act(region, action, { dx: last.x - first.x, dy: last.y - first.y, at: { x: last.x, y: last.y } });
  }, [act]);

  function activate(id: string, door?: { target: string; object?: string }, zone?: string) {
    const world = runtime.current, current = readingRef.current;
    // Enter, then Open. A way walks you to another level of this room; only
    // then does a door open an HTML surface in front of the place.
    const way = harbourWayFor(id, zone);
    if (way) { onNavigateRef.current("home", HARBOUR_PLACE_LEVELS[way]); return; }
    // The rail's own controls: a day earlier, a day later, back to today. A reading, never a write.
    if (id === "scrub-back") { walk(-1); return; }
    if (id === "scrub-forward") { walk(1); return; }
    if (id === "today") { walk("today"); return; }
    if (door) { onOpenRef.current(door.target, door.object); return; }
    if (id === "flagstone") { world?.go("object", "queen"); return; }
    if (id === "sundial") { onOpenRef.current(current.next?.target ?? "cellar-bills"); return; }
    if (id === "mailbox") { onOpenRef.current(current.noticed?.target ?? "more"); return; }
    if (id === "slip" || id === "gate") { world?.go(id === "gate" ? "sky" : "object", id); return; }
    const region = id as QueenRegion; const action = gestureAction(region, "tap"); if (action) act(region, action);
  }

  // The tier is decided once per mount and again when the reading edition is chosen or the stage crosses 720.
  useEffect(() => {
    const decide = () => setTier(decideTier(host.current?.getBoundingClientRect().width || window.innerWidth));
    window.addEventListener("hearth:motion", decide); window.addEventListener("resize", decide);
    return () => { window.removeEventListener("hearth:motion", decide); window.removeEventListener("resize", decide); };
  }, []);

  // Mount the scene: renderer lease, court, then the Queen. Theme changes rebuild; scope data never does.
  useEffect(() => {
    const element = host.current; if (!element || tier === "flat") { setStatus(tier === "flat" ? "flat" : "loading"); return; }
    let cancelled = false; const abort = new AbortController(); setStatus("loading"); setRects([]);
    const renderTier: RenderTier = tier;
    const first = placeRef.current;
    void Promise.all([import("./scene/runtime.ts"), PLACE_MODULES[first](), import("./court/dressing.ts")]).then(([{ mountHarbourWorld }, , { COURT_DRESSING }]) => {
      if (cancelled) return;
      try {
        const world = mountHarbourWorld(element, theme, renderTier, {
          onReady: () => setStatus("ready"), onFailure: () => setStatus("fallback"),
          onProject: next => setRects(next), onTap, onGesture, onRailDrag: (x, width) => onRailDragRef.current(x, width),
          place: PLACES[first], reading: readingRef.current, dressing: sceneDressingFrom(COURT_DRESSING[theme]),
        });
        runtime.current = world;
        court.current = first === "court" ? world.place() as CourtHandle : null;
        world.setToolOpen(Boolean(routeRef.current.surface));
        void holdRail(world);
        const saved = readHouseReturn(localStorage, identityRef.current, harbourCameraSlot(houseComposition(element.getBoundingClientRect().width || window.innerWidth), first));
        if (saved?.camera && sameHouseCameraRoute(saved.route, routeRef.current)) world.restore(saved.camera);
        if (first !== "court") return;
        void import("./court/queenPlace.ts").then(({ loadQueenPlace }) => loadQueenPlace(renderTier, appearance.saved.queen ?? DEFAULT_QUEEN_STYLE, evidenceRef.current, abort.signal)).then(her => {
          if (cancelled || !runtime.current) { her.dispose(); return; }
          queen.current = her;
          court.current?.attachQueen(her.group, () => queenRegions(her));
          world.setReading(readingRef.current);
          if (!window.matchMedia(REDUCED).matches) { world.addAnimator(t => her.breathe(t)); world.setBreathing(true); }
        }).catch(() => { element.dataset.queen = "unavailable"; });
      } catch { setStatus("fallback"); }
    }).catch(() => setStatus("fallback"));
    return () => { cancelled = true; abort.abort(); queen.current?.dispose(); queen.current = null; court.current = null; runtime.current?.dispose(); runtime.current = null; };
    // Theme and tier rebuild the scene; everything else flows through setReading / go.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, tier]);

  useEffect(() => { runtime.current?.setReading(placeReading); }, [placeReading, status]);
  useEffect(() => { runtime.current?.setToolOpen(toolOpen); if (toolOpen) setRects([]); else runtime.current?.go("court"); }, [toolOpen]);

  /**
   * The journey between the places of this room (BUILD_PLAN_SLICE2 §1): the
   * destination's chunk is fetched, the runtime raises it beside the one you
   * are standing in, the roof or the lid moves for 900 ms (700 coming back),
   * and the place you left is disposed at the end. The Queen belongs to the
   * Court, so she is dropped on the way out and loaded again on the way in.
   */
  useEffect(() => {
    const world = runtime.current;
    if (!world || status !== "ready" || world.placeId() === place) return;
    let cancelled = false;
    const abort = new AbortController();
    const from = world.placeId();
    setRects([]); setPhrase(""); setScrub(null);
    void PLACE_MODULES[place]().then(() => {
      if (cancelled || runtime.current !== world) return;
      if (from === "court") { queen.current?.dispose(); queen.current = null; court.current = null; world.setBreathing(false); }
      world.enter(place, { from });
      court.current = place === "court" ? world.place() as CourtHandle : null;
      void holdRail(world);
      if (place !== "court" || tier === "flat") return;
      void import("./court/queenPlace.ts").then(({ loadQueenPlace }) => loadQueenPlace(tier as RenderTier, appearance.saved.queen ?? DEFAULT_QUEEN_STYLE, evidenceRef.current, abort.signal)).then(her => {
        if (cancelled || runtime.current !== world || placeRef.current !== "court") { her.dispose(); return; }
        queen.current = her;
        court.current?.attachQueen(her.group, () => queenRegions(her));
        world.setReading(readingRef.current);
        if (!window.matchMedia(REDUCED).matches) { world.addAnimator(t => her.breathe(t)); world.setBreathing(true); }
      }).catch(() => undefined);
    });
    return () => { cancelled = true; abort.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place, status]);

  /**
   * The walk along the rail (BUILD_PLAN_SLICE2 §3): a drag along the rail, the
   * ◀ ▶ twins, the arrow keys with the stage focused, and one tap back to
   * today. It moves the water and pales the jars ahead of the line, and it
   * writes nothing — the books are not touched by looking at another day.
   */
  const rail = useRef<ScrubControls | null>(null);
  const announce = useCallback(() => {
    const handle = runtime.current?.place();
    const words = handle ? (handle as { words?: () => unknown }).words?.() : null;
    const date = words && typeof words === "object" && "date" in words ? String((words as { date: unknown }).date) : null;
    if (date) setPhrase(date);
    setScrub(rail.current?.index() ?? null);
  }, []);
  const walk = useCallback((move: number | "today" | { to: number }) => {
    const controls = rail.current; if (!controls) return;
    if (move === "today") controls.today();
    else if (typeof move === "number") controls.step(move);
    else controls.to(move.to);
    announce();
  }, [announce]);
  /** Take hold of the standing place's rail, if it has one, once it is built. */
  const holdRail = useCallback(async (world: HarbourRuntime) => {
    const { scrubControls } = await import("./scene/runtime.ts");
    if (runtime.current !== world) return;
    rail.current = scrubControls(world.place(), readingRef.current.cellar.todayIndex);
    setScrub(rail.current?.index() ?? null);
  }, []);
  const onRailDrag = useCallback((x: number, width: number) => {
    const controls = rail.current, days = readingRef.current.cellar.days.length;
    if (!controls || days < 2 || width < 1) return;
    void import("./cellar/scrub.ts").then(({ scrubIndex }) => { if (rail.current === controls) { controls.to(scrubIndex(x, width, days)); announce(); } });
  }, [announce]);
  onRailDragRef.current = onRailDrag;

  // The Queen's lenses: hide her gardens for the growth and shape lenses, scale them for botanical presence, redress her history for the weeks window.
  useEffect(() => {
    const her = queen.current; if (!her) return;
    her.group.traverse(node => { if (node.userData.region === "vines") { node.visible = lens === "living"; node.scale.setScalar(presenceScale); } });
    const growth = her.group.children.find(child => child.name === "Supported history · identity anchored");
    if (growth) growth.visible = lens !== "shape";
    runtime.current?.setReading(readingRef.current);
  }, [lens, presenceScale, status, weeks]);
  useEffect(() => {
    const her = queen.current; if (!her || weeks === null) return;
    let cancelled = false;
    void import("./court/queenPlace.ts").then(({ seatGrowthAtRoots }) => import("../house/world/bloom.ts").then(({ createBloomGrowth, disposeObject }) => {
      if (cancelled || queen.current !== her) return;
      const old = her.group.children.find(child => child.name === "Supported history · identity anchored");
      if (old) { her.group.remove(old); disposeObject(old); }
      const next = createBloomGrowth(appearance.saved.queen ?? DEFAULT_QUEEN_STYLE, evidence.slice(0, weeks));
      her.group.add(next); seatGrowthAtRoots(her.group, next, her.regions());
      runtime.current?.setReading(readingRef.current);
    }));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeks, evidenceSignature]);

  // Return records: the App's `hearth:house-return` event, and the camera per composition on pagehide.
  useEffect(() => {
    const restore = (event: Event) => { const detail = (event as CustomEvent).detail; if (detail?.identity === houseIdentity(identityRef.current) && Array.isArray(detail.camera) && detail.camera.length === 3 && detail.camera.every(Number.isFinite)) runtime.current?.restore(detail.camera); };
    const remember = () => {
      const current = routeRef.current, world = runtime.current; if (!world || current.surface) return;
      const composition = houseComposition(host.current?.getBoundingClientRect().width || window.innerWidth);
      saveHouseReturn(localStorage, identityRef.current, houseCameraRoute(current), { camera: [...world.camera()] as [number, number, number], cameraComposition: composition }, harbourCameraSlot(composition, world.placeId()));
    };
    window.addEventListener("hearth:house-return", restore); window.addEventListener("pagehide", remember);
    return () => { window.removeEventListener("hearth:house-return", restore); window.removeEventListener("pagehide", remember); remember(); };
  }, [scope, memberId, household.householdId, status]);

  function onStageKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    const world = runtime.current; if (!world) return;
    const step = 40;
    const onRail = placeRef.current === "cellar" && rail.current !== null;
    if (onRail && (event.key === "Home" || event.key === "0")) walk("today");
    else if (onRail && event.key === "ArrowLeft") walk(-1);
    else if (onRail && event.key === "ArrowRight") walk(1);
    else if (event.key === "ArrowLeft") world.gesture({ kind: "orbit", dx: -step, dy: 0 });
    else if (event.key === "ArrowRight") world.gesture({ kind: "orbit", dx: step, dy: 0 });
    else if (event.key === "ArrowUp") world.gesture({ kind: "orbit", dx: 0, dy: -step });
    else if (event.key === "ArrowDown") world.gesture({ kind: "orbit", dx: 0, dy: step });
    else if (event.key === "+" || event.key === "=") world.gesture({ kind: "zoom", delta: -0.2 });
    else if (event.key === "-" || event.key === "_") world.gesture({ kind: "zoom", delta: 0.2 });
    else if (event.key === "Escape") { if (placeRef.current === "court") world.go("court"); else onNavigateRef.current("home", "middle"); }
    else if (event.key === " " && onQuickSheet) onQuickSheet();
    else return;
    event.preventDefault();
  }

  const showFlat = status === "flat" || status === "fallback" || (status === "loading" && tier === "flat");
  const flatStatus = status === "fallback" ? "fallback" : tier === "flat" ? "flat" : "loading";
  const stair = () => props.onNavigate("home", "middle");
  return <section className={`harbour-world harbour-world--${theme}${toolOpen ? " has-open-object" : ""}`} data-world-status={status} data-world-scope={scope} data-harbour-place={place} data-harbour-tier={tier} data-harbour-lens={lens} aria-label={place === "court" ? "The Queen's Court" : place === "tower" ? "The Rook's Tower" : "The Cellar"}>
    <div className="harbour-world__stage" ref={stage} tabIndex={toolOpen ? undefined : 0} aria-label={toolOpen ? undefined : `${placeName[0]!.toUpperCase()}${placeName.slice(1)}. Arrow keys orbit, plus and minus zoom, Space opens all tools, Escape steps back.`} onKeyDown={onStageKey}>
      <div className="house-world__canvas" ref={host} aria-hidden="true" />
      {(showFlat || (status === "loading" && !toolOpen)) && <HarbourFlat place={place} reading={reading} status={flatStatus} theme={theme} partnerName={partner?.name ?? null} onOpen={onOpen} onEnter={next => props.onNavigate("home", HARBOUR_PLACE_LEVELS[next])} overlay={status === "loading" && tier !== "flat"} scrub={scrub ?? undefined} onScrub={index => walk({ to: index })} onStair={place === "court" ? undefined : stair} />}
      {status === "ready" && !toolOpen && <HarbourTwins rects={rects} label={`The ${placeName.replace(/^the /, "")}`} onActivate={rect => activate(rect.id, rect.door, rect.group)} onQueenKey={(region, key) => { const found = keyAction(region as QueenRegion, key); if (found) act(region as QueenRegion, found.action, found.detail); }} />}
      {sparkle && <div className="harbour-spark" aria-hidden="true" style={{ left: `${sparkle.x}px`, top: `${sparkle.y}px`, "--spark": sparkle.color } as CSSProperties}>{Array.from({ length: sparkle.petals }, (_, i) => <span key={i} style={{ "--i": i } as CSSProperties} />)}</div>}
      <p className="harbour-world__phrase" role="status" aria-live="polite">{phrase}</p>
      {statusLine && <small className="harbour-world__supported" role="status">{statusLine}</small>}
      {!ready && status === "ready" && <small className="harbour-world__checking" role="status">Checking the books · {freshness}</small>}
      {toolOpen && <button type="button" className="harbour-world__put-back" onClick={onClose}>← Put it back in {placeName}</button>}
      {!toolOpen && status === "ready" && place !== "court" && <button type="button" className="harbour-world__stair" onClick={stair}>← Back to the Court</button>}
      {status === "fallback" && <p className="harbour-world__fallback" role="status">Reading edition · {placeName} could not be drawn; every door is a button.</p>}
    </div>
    {props.children}
  </section>;
}

/** Arrow keys on a Queen twin speak the stroke grammar: up/down on the vines are weeks, on the crown botanical presence; left/right on the rim spin her. */
function keyAction(region: QueenRegion, key: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight"): { action: QueenAction; detail: { dx: number; dy: number } } | null {
  const vertical = key === "ArrowUp" || key === "ArrowDown";
  const kinds = vertical ? [key === "ArrowUp" ? "stroke-up" : "stroke-down", "drag-y"] as const : ["drag-x"] as const;
  for (const kind of kinds) { const action = gestureAction(region, kind); if (action) return { action, detail: { dx: key === "ArrowRight" ? 40 : key === "ArrowLeft" ? -40 : 0, dy: key === "ArrowDown" ? 40 : key === "ArrowUp" ? -40 : 0 } }; }
  return null;
}

function decideTier(width: number): QualityTier {
  try { return qualityTier(readQualityInput(window, width)); } catch { return "flat"; }
}

/** Her regions as the twins see them: one box per touchable part, labelled in words. */
const QUEEN_LABELS: Record<QueenRegion, string> = { crown: "Her crown — tap for the growth lens, up or down for more or less garden", vines: "Her vines — up a week, down a week", hands: "Her hands — what she holds for you", face: "Her face — a portrait", roots: "Her roots — what feeds her", potRim: "The pot's rim — spin her, or come closer" };
function queenRegions(her: QueenPlace): Region[] {
  const boxes = her.regions();
  return (Object.keys(boxes) as QueenRegion[]).flatMap(id => { const box = boxes[id]; return box && !box.isEmpty() ? [{ id, group: "queen", label: QUEEN_LABELS[id], box }] : []; });
}

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import type { DateKey } from "../core/calendar.ts";
import type { Household, LedgerView } from "../core/types.ts";
import type { FundPulseFreshness } from "../core/fundPulse.ts";
import { isFreshPresence, memberDisplayName, type SoftPresenceDisplay } from "../softPresence.ts";
import type { HouseRoute, HouseRoom, HouseLevel } from "../hearthside/houseRoutes.ts";
import { readHouseReturn, saveHouseReturn, houseIdentity } from "../house/navigation.ts";
import { houseCameraRoute, houseComposition, sameHouseCameraRoute } from "../house/returnCache.ts";
import { livingEvidence } from "../house/interpretation.ts";
import { interpretationSourceRevision, supportedAtFor, useSupportedHouseInterpretation, type InterpretationGate } from "../house/supportedInterpretation.ts";
import { DEFAULT_QUEEN_STYLE } from "../house/queenStyle.ts";
import type { BloomEvidence } from "../house/world/bloom.ts";
import { useAppearance } from "../theme/ThemeProvider.tsx";
import { Whisper } from "../theme/Whisper.tsx";
import type { ThemeId } from "../theme/scenes.ts";
import { useHarbourReading } from "./data/useHarbourReading.ts";
import { HarbourFlat } from "./flat/PlaceFlat.tsx";
import { HarbourTwins } from "./court/CourtTwins.tsx";
import { HARBOUR_LANDMARKS, HARBOUR_PLACE_LEVELS, HARBOUR_PLACE_NAMES, HARBOUR_PLACE_ROOMS, harbourPlaceFor, harbourWayFor, type HarbourPlaceId } from "./flag.ts";
import { HARBOUR_GO_EVENT } from "./nav/QuickSheet.tsx";
import { HOUSE_LEVELS, HOUSE_ROOMS } from "../hearthside/houseRoutes.ts";
import { classifyGesture, gestureAction, spark, type QueenAction, type QueenRegion, type QueenSpark } from "./court/queenTouch.ts";
import type { QueenPlace } from "./court/queenPlace.ts";
import type { CourtHandle } from "./court/CourtScene.ts";
import type { HarbourRuntime, HarbourGesture, HarbourHit, ProjectedRect, ScrubControls } from "./scene/runtime.ts";
import { PLACES, sceneDressingFrom, type Anchor, type PlaceReading, type Region } from "./scene/place.ts";
import { publishLocalPose, useWorldFeed } from "./presence/feed.ts";
import { WalkTogether } from "./presence/WalkTogether.tsx";
import { readWorldPresenceShare, type WorldPresenceShare } from "../softPresenceWorld.ts";
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
  glasshouse: () => import("./glasshouse/GlasshouseScene.ts"),
  kitchen: () => import("./kitchen/KitchenScene.ts"),
  boathouse: () => import("./boathouse/BoathouseScene.ts"),
  library: () => import("./library/LibraryScene.ts"),
  cottage: () => import("./cottage/CottageScene.ts"),
  kiln: () => import("./kiln/KilnScene.ts"),
  campfire: () => import("./campfire/CampfireScene.ts"),
  atlas: () => import("./atlas/AtlasScene.ts"),
};

const REDUCED = "(prefers-reduced-motion: reduce)";
/**
 * Whether the hand on this thing is a thumb. It decides one thing only — the
 * words of the invitation below — because a phone has no W to press, and
 * telling somebody holding a phone to press it is the sort of thing that made
 * the keys unreachable in the first place.
 */
const TOUCH = "(pointer: coarse)";
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
  /**
   * The phone's thumb-stick (W7 b): where it was pressed, while a thumb is on
   * it. The knob itself is written straight to the DOM through `knob` so a
   * thumb sliding around does not re-render the whole stage thirty times a
   * second — the runtime is already doing the walking.
   */
  const [stick, setStick] = useState<{ x: number; y: number } | null>(null);
  const knob = useRef<HTMLDivElement | null>(null);
  /** The place's close hold (W7 a), for the stage's own word for it. */
  const [closed, setClosed] = useState(false);
  /**
   * ── The invitation (walk-focus) ──
   * Whether the stage itself is holding the keyboard, and whether there is a
   * body here to walk. Between them they decide whether the stage has to say
   * out loud how to start walking. `onFocus`/`onBlur` bubble, so both are
   * narrowed to the stage's own node: a twin focused is the stage **not**
   * focused, which is the truth — a key pressed on a twin does not walk.
   */
  const [stageHasKeys, setStageHasKeys] = useState(false);
  const [standing, setStanding] = useState(false);
  const [touch, setTouch] = useState(readTouch);
  const toolOpen = Boolean(route.surface);
  /** One room, three places: the route's level says which one stands (BUILD_PLAN_SLICE2 §0). */
  const place: HarbourPlaceId = harbourPlaceFor(route, scope, true) ?? "court";
  const placeName = HARBOUR_PLACE_NAMES[place];
  const identity = { environment: household.environment, householdId: household.householdId, memberId, scope };
  const routeRef = useRef(route); routeRef.current = route;
  const placeRef = useRef(place); placeRef.current = place;
  const identityRef = useRef(identity); identityRef.current = identity;

  const { reading, statusLine } = useHarbourReading({ household, memberId, today, freshness: pulseFreshness(interpretationGate), interpretationGate });
  const softPeer = useMemo(() => presence?.peers.find(p => p.memberId !== memberId) ?? null, [presence, memberId]);
  /**
   * The world-presence lane (`presence/usePartnerWalk.ts`): the partner's live
   * position, when they have chosen to share it. `walk` is a stable feed the
   * Court polls per frame; when it is null — sharing off, feed stale, socket
   * gone — the reading carries only `fresh`, which is the pin the app has
   * always had. State reflects the data outcome, never the sync outcome.
   */
  const [walkShare, setWalkShare] = useState<WorldPresenceShare>(() => readWorldPresenceShare(household.environment));
  useEffect(() => { setWalkShare(readWorldPresenceShare(household.environment)); }, [household.environment]);
  // Where this person is standing, put on the shelf for whoever owns a socket.
  // The harbour never reaches out for the network (`harbour-source-fences`).
  useEffect(() => publishLocalPose(() => {
    const world = runtime.current;
    if (!world) return null;
    const pose = world.pose();
    // The character, when one is standing: the partner should see where you
    // actually are, not where your camera is pointed. An interior has no
    // walker, so there the camera stays the answer.
    const at = world.body?.()?.at() ?? null;
    return { target: pose.target, theta: pose.theta, body: at ? { x: at.x, z: at.z, yaw: at.yaw } : null };
  }), []);
  const partnerWalk = useWorldFeed({
    environment: household.environment,
    householdId: household.householdId,
    memberId,
    linked: household.linked === true,
    view: scope,
    placeId: place,
    softPresenceOptedOut: presence?.optedOut === true,
    share: walkShare,
  });
  const partner = useMemo(() => {
    // The live body's name is the household's word for the member the *server*
    // named, never a name that travelled on the lane.
    const walkName = partnerWalk.memberId ? memberDisplayName(household.members, partnerWalk.memberId) : null;
    if (softPeer) return { fresh: presence?.visible === true && isFreshPresence(softPeer.seenAt, Date.now()), name: softPeer.name, walk: partnerWalk.walk };
    if (partnerWalk.walk && walkName) return { fresh: false, name: walkName, walk: partnerWalk.walk };
    return partnerName ? { fresh: false, name: partnerName, walk: partnerWalk.walk } : null;
  }, [presence, softPeer, partnerName, partnerWalk.walk, partnerWalk.memberId, household.members]);
  const placeReading: PlaceReading = useMemo(() => ({ ...reading, partner }), [reading, partner]);


  const currentEvidence = useMemo(() => livingEvidence(household, memberId, scope), [household.hearthside, household.personalLife, memberId, scope]); // eslint-disable-line react-hooks/exhaustive-deps
  const supported = useSupportedHouseInterpretation({ identity, gate: interpretationGate ?? { current: true, freshness: "current", detail: "Current local books" }, current: { bloom: currentEvidence }, fallback: { bloom: [] }, sourceRevision: interpretationSourceRevision(household, scope), supportedAt: supportedAtFor(household, today) });
  const evidence: BloomEvidence[] = supported.value.bloom;
  const evidenceSignature = JSON.stringify(evidence);
  const readingRef = useRef(placeReading); readingRef.current = placeReading;
  const onOpenRef = useRef(onOpen); onOpenRef.current = onOpen;
  const onNavigateRef = useRef(props.onNavigate); onNavigateRef.current = props.onNavigate;
  const onRailDragRef = useRef<(x: number, width: number) => void>(() => undefined);
  /**
   * The route change that is in flight because a doorway was **crossed**
   * (`scene/runtime.ts` §3) rather than because a building was tapped from
   * across the lawn. Both make the same route change — which is the point, so
   * the compass, the quick sheet and the reading edition cannot tell them
   * apart — but a crossing must not then fly the camera anywhere: you already
   * walked in.
   */
  const crossing = useRef<HarbourPlaceId | null>(null);
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
  const onThreshold = useCallback((next: HarbourPlaceId) => {
    if (placeRef.current === next) return;
    crossing.current = next;
    onNavigateRef.current(HARBOUR_PLACE_ROOMS[next], HARBOUR_PLACE_LEVELS[next]);
  }, []);
  /**
   * The body walked to this place's own way out (walk-everywhere): the Tower's
   * stair, the Cellar's stair, the Glasshouse's garden door, the footpath up
   * the shore. It goes straight through `activate` — the very function a
   * **tap** on that anchor goes through — so walking out and tapping the door
   * are one act, and there is no second table of ways to keep in step with
   * `HARBOUR_WAYS`.
   */
  const onExit = useCallback((anchor: Anchor) => {
    activate(anchor.id, anchor.door, anchor.zone);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const onStick = useCallback((next: { x: number; y: number; dx: number; dy: number } | null) => {
    if (!next) { setStick(null); return; }
    setStick(current => (current && current.x === next.x && current.y === next.y ? current : { x: next.x, y: next.y }));
    const node = knob.current;
    if (node) node.style.transform = `translate(${Math.round(next.dx)}px, ${Math.round(next.dy)}px)`;
  }, []);

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
    if (way) { onNavigateRef.current(HARBOUR_PLACE_ROOMS[way], HARBOUR_PLACE_LEVELS[way]); return; }
    // A landmark on the island is a whole room's door: tapping it walks there.
    const landmark = HARBOUR_LANDMARKS[id];
    if (landmark) { onNavigateRef.current(landmark.room, landmark.level); return; }
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

  /**
   * The quick sheet's place rows (W5 #2). The App owns the router; this shell
   * is mounted for every household route, so it is the one place that can walk
   * the sheet's row to a room × level without the App handing it a second
   * navigator. The event carries a route and nothing else — never a write, and
   * a route the house does not have is ignored rather than guessed at.
   */
  useEffect(() => {
    const walkTo = (event: Event) => {
      const detail = (event as CustomEvent<{ room?: unknown; level?: unknown }>).detail;
      const room = detail?.room, level = detail?.level;
      if (typeof room !== "string" || typeof level !== "string") return;
      if (!(HOUSE_ROOMS as readonly string[]).includes(room) || !(HOUSE_LEVELS as readonly string[]).includes(level)) return;
      onNavigateRef.current(room as HouseRoom, level as HouseLevel);
    };
    window.addEventListener(HARBOUR_GO_EVENT, walkTo);
    return () => window.removeEventListener(HARBOUR_GO_EVENT, walkTo);
  }, []);

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
          onStick, onClose: setClosed, onThreshold, onExit,
          place: PLACES[first], reading: readingRef.current, dressing: sceneDressingFrom(COURT_DRESSING[theme]),
        });
        runtime.current = world;
        court.current = first === "court" ? world.place() as CourtHandle : null;
        world.setToolOpen(Boolean(routeRef.current.surface));
        void holdRail(world);
        world.invalidate();
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

  /**
   * Warm the other places of the room once this one is standing and the frame
   * loop has gone quiet. A place is its own chunk, and the chunk is fetched
   * before `enter` can move anything — so without this the first tap on the
   * Rook is a beat of nothing, and then the whole journey at once.
   */
  useEffect(() => {
    if (status !== "ready") return;
    let cancelled = false;
    const warm = () => {
      if (cancelled) return;
      const pending = (Object.keys(PLACE_MODULES) as HarbourPlaceId[])
        .filter((id) => id !== placeRef.current)
        .map((id) => PLACE_MODULES[id]().catch(() => undefined));
      // A placed interior can only be streamed in once its chunk has landed;
      // asking the runtime again here saves it waiting for the next move.
      void Promise.all(pending).then(() => {
        if (cancelled) return;
        runtime.current?.restream();
      });
    };
    const host = window as typeof window & {
      requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const idle = typeof host.requestIdleCallback === "function" ? host.requestIdleCallback.bind(host) : null;
    const handle = idle ? idle(warm, { timeout: 2500 }) : window.setTimeout(warm, 900);
    return () => {
      cancelled = true;
      if (idle && typeof host.cancelIdleCallback === "function") host.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, [status]);

  useEffect(() => { runtime.current?.setReading(placeReading); }, [placeReading, status]);
  /**
   * A tool is open in front of the place. The stage becomes a mantel above it —
   * a wide, short strip — so the camera steps back to the place's own establishing
   * pose rather than holding a close-up that a strip cannot hold. Closing it
   * walks back into the room.
   */
  useEffect(() => {
    const world = runtime.current;
    if (!world) return;
    world.setToolOpen(toolOpen);
    // The band above the sheet is a frieze, and each place declares its own
    // (`door` in its pose table): the rack close and level, the rail at eye
    // height, her portrait in the Court.
    if (!toolOpen) { world.go("court"); return; }
    setRects([]);
    world.go("door");
    // The App focuses the tool it opened, and the browser scrolls the focus
    // into view — which can throw the sheet to the top and the room's band
    // off the screen. The door's promise is the room staying the sky, so the
    // page comes back to the top once the focus has landed.
    const settle = window.setTimeout(() => window.scrollTo({ top: 0 }), 160);
    return () => window.clearTimeout(settle);
  }, [toolOpen]);

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
    setRects([]); setPhrase(""); setScrub(null); setStick(null);
    void PLACE_MODULES[place]().then(() => {
      if (cancelled || runtime.current !== world) return;
      // The Court's group may survive the journey now (walking into a building
      // on the island keeps the island standing), so she is taken out of her
      // slot before she is disposed — a disposed geometry left in a standing
      // scene is a black hole where the Queen was.
      if (from === "court") { court.current?.detachQueen(); queen.current?.dispose(); queen.current = null; court.current = null; world.setBreathing(false); }
      const walked = crossing.current === place;
      crossing.current = null;
      world.enter(place, { from, ...(walked ? { threshold: true } : {}) });
      world.invalidate();
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
    // The water has a new level to find, and the jars ahead of the line go pale.
    runtime.current?.invalidate();
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

  /**
   * ── The body lane (world-body) ──
   * Which movement keys are down. W A S D and the arrows drive the **body**,
   * not the camera, so the stage's own promise — "W A S D walk" — is the
   * truth. A key is held, so this is a set and not an event: the runtime asks
   * for the direction every frame and the body accelerates into it.
   */
  const held = useRef<Set<string>>(new Set());
  const pushBody = useCallback(() => {
    const keys = held.current, world = runtime.current;
    const body = world?.body();
    if (!body) return;
    const forward = (keys.has("w") || keys.has("arrowup") ? 1 : 0) - (keys.has("s") || keys.has("arrowdown") ? 1 : 0);
    const strafe = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
    body.input({ forward, strafe, run: keys.has("shift") });
  }, []);
  /**
   * A key that walks, wherever a body is standing to walk it (walk-everywhere).
   *
   * The one condition this used to carry — `place === "court"` — was the whole
   * of why walking was Court-only: a body now stands in every place, so the
   * only question left is whether one is standing at all. The arrows are the
   * caller's to withhold where a surface already owns them (the Cellar's rail).
   */
  const walksBody = useCallback((key: string): boolean => {
    if (!runtime.current?.body()) return false;
    const lower = key.toLowerCase();
    if (["w", "a", "s", "d"].includes(lower)) return true;
    return ["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(lower);
  }, []);
  // A key held when the stage loses focus would walk for ever; let it go.
  useEffect(() => {
    const drop = () => { if (held.current.size) { held.current.clear(); pushBody(); } };
    window.addEventListener("blur", drop);
    return () => { window.removeEventListener("blur", drop); drop(); };
  }, [pushBody]);

  /**
   * ── The keyboard has to land somewhere (walk-focus) ──
   *
   * `onKeyDown` on a div only fires while that div — or something inside it —
   * holds the keyboard, and nothing in this file ever asked for it. So the
   * walk below was perfect and unreachable: on a fresh load W did nothing at
   * all until you happened to click the world, and the stage never said so.
   *
   * The stage takes the keyboard when it comes to the front — the place is
   * standing, or a tool has closed and the room is the whole screen again —
   * and at no other moment. It is never taken on a re-render, and never taken
   * from somebody.
   */
  const takeKeys = useCallback((): boolean => {
    const node = stage.current;
    if (!node || !node.isConnected) return false;
    // Never in front of a tool: there the stage is a strip with no tabIndex at
    // all, and the sheet is the thing that was asked for.
    if (routeRef.current.surface) return false;
    /**
     * **Never a yank.** Focus a person put somewhere on purpose is theirs: a
     * half-typed word in a field, a twin or the compass they tabbed to, a
     * tool's own heading. The only keyboard the stage takes is a keyboard
     * nobody is holding.
     */
    const active = document.activeElement;
    if (active && active !== document.body && active !== document.documentElement && active !== node) return false;
    // `preventScroll` keeps the promise the door makes above: focusing must
    // never be the thing that throws the page down the document.
    node.focus({ preventScroll: true });
    return document.activeElement === node;
  }, []);
  useEffect(() => {
    // The loading frame and the reading edition have no body to walk and their
    // own buttons are the way through; there the stage asks for nothing.
    if (status !== "ready" || toolOpen) return;
    takeKeys();
    /**
     * Putting a tool back, the App restores the focus it saved when the door
     * opened (`App.tsx` `putHouseObjectBack`), two frames later. Whoever is in
     * front holds the keyboard: if it restored something, the second attempt
     * finds that something holding focus and leaves it be; if it found nothing
     * to restore — the harbour stands no `house-world-title` — the stage fills
     * the vacuum instead of leaving the keys pointed at nowhere.
     */
    const settle = window.setTimeout(takeKeys, 220);
    return () => window.clearTimeout(settle);
  }, [status, toolOpen, takeKeys]);
  // A body stands from the runtime's first frame, in whichever place is
  // standing (`scene/runtime.ts` raises one before it hands the world back),
  // so this is asked once the place is up and again when the place changes.
  useEffect(() => { setStanding(status === "ready" && Boolean(runtime.current?.body())); }, [status, place]);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(TOUCH);
    const note = () => setTouch(query.matches);
    note();
    query.addEventListener?.("change", note);
    return () => query.removeEventListener?.("change", note);
  }, []);

  function onStageKeyUp(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    const key = event.key.toLowerCase();
    if (!held.current.delete(key)) return;
    pushBody();
    event.preventDefault();
  }

  function onStageKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    // Space opens the quick sheet wherever you are standing — including the
    // reading edition and the fallback, where there is no world to drive.
    // Everything the app can do has to be one key away even when the island
    // could not be drawn at all.
    if (event.key === " " && onQuickSheet) { onQuickSheet(); event.preventDefault(); return; }
    const world = runtime.current;
    if (!world) {
      // The reading edition still steps back out of a place the same way.
      if (event.key === "Escape" && placeRef.current !== "court") { onNavigateRef.current("home", "middle"); event.preventDefault(); }
      return;
    }
    const step = 40;
    /**
     * The Cellar's rail owns the left and right arrows (BUILD_PLAN_SLICE2 §3):
     * they walk the month a day at a time, and a scrubbing rail is a real
     * conflict, not a collision of convenience. **The body yields.** Down
     * there W A S D walks and Shift runs exactly as everywhere else; the
     * arrows stay the rail's, because there is no other way to scrub it with
     * a keyboard and there is another way to walk.
     */
    const onRail = placeRef.current === "cellar" && rail.current !== null;
    const railKey = onRail && ["ArrowLeft", "ArrowRight", "Home", "0"].includes(event.key);
    // ── The body lane (world-body → walk-everywhere) ──
    // The walk comes first, in every place. The rail's own keys are the one
    // exception, and everything below is untouched.
    if (!railKey && walksBody(event.key)) {
      held.current.add(event.key.toLowerCase());
      if (event.shiftKey) held.current.add("shift"); else held.current.delete("shift");
      pushBody();
      event.preventDefault();
      return;
    }
    if (onRail && (event.key === "Home" || event.key === "0")) walk("today");
    else if (onRail && event.key === "ArrowLeft") walk(-1);
    else if (onRail && event.key === "ArrowRight") walk(1);
    // The arrows orbit only where no body is standing to walk them — the
    // reading edition's fallback, and a place whose body could not be raised.
    else if (event.key === "ArrowLeft") world.gesture({ kind: "orbit", dx: -step, dy: 0 });
    else if (event.key === "ArrowRight") world.gesture({ kind: "orbit", dx: step, dy: 0 });
    else if (event.key === "ArrowUp") world.gesture({ kind: "orbit", dx: 0, dy: -step });
    else if (event.key === "ArrowDown") world.gesture({ kind: "orbit", dx: 0, dy: step });
    // W A S D used to be four `pan` gestures — a slide of the camera's look-at
    // target, while the stage's own label said "W A S D walk". That path is
    // **deleted**, not left as a fallback: the body walks, in every place.
    else if (event.key === "+" || event.key === "=") world.gesture({ kind: "zoom", delta: -0.2 });
    else if (event.key === "-" || event.key === "_") world.gesture({ kind: "zoom", delta: 0.2 });
    // The close hold (W7 a), on and off with the same key, like the gesture.
    else if (event.key === "c" || event.key === "C") setClosed(world.toggleClose());
    else if (event.key === "Escape") {
      // The hold comes off first: Escape is "out of this", and the thing you
      // are most immediately in is the close-up.
      // ── The body lane (world-body) ── and before either of those, the
      // follow camera: stepping out of walking is the most immediate "out".
      const body = world.body();
      if (body?.following()) { held.current.clear(); body.input({ forward: 0, strafe: 0 }); body.follow(false); }
      else if (world.closed()) setClosed(world.toggleClose(false));
      else if (placeRef.current === "court") world.go("court");
      else onNavigateRef.current("home", "middle");
    }
    else return;
    event.preventDefault();
  }

  const showFlat = status === "flat" || status === "fallback" || (status === "loading" && tier === "flat");
  /**
   * Say it, quietly, to the person who has just landed. It is shown only while
   * the stage is not holding the keyboard and there is a body here to walk,
   * and it goes the moment the stage is focused — including the moment above,
   * where the stage focuses itself. It is painted for nobody in particular:
   * `aria-hidden`, because the stage's own `aria-label` already says all of
   * this and more, and saying it twice is the over-explaining the Whisper was
   * built to stop.
   */
  const invite = status === "ready" && !toolOpen && standing && !stageHasKeys;
  const flatStatus = status === "fallback" ? "fallback" : tier === "flat" ? "flat" : "loading";
  const stair = () => props.onNavigate("home", "middle");
  return <section className={`harbour-world harbour-world--${theme}${toolOpen ? " has-open-object" : ""}`} data-world-status={status} data-world-scope={scope} data-harbour-place={place} data-harbour-tier={tier} data-harbour-lens={lens} aria-label={place === "court" ? "The Queen's Court" : place === "tower" ? "The Rook's Tower" : place === "cellar" ? "The Cellar" : place === "glasshouse" ? "The Glasshouse" : place === "kitchen" ? "The Kitchen" : place === "boathouse" ? "The Boathouse" : place === "cottage" ? "Hercules’s Cottage" : place === "kiln" ? "The Kiln" : place === "campfire" ? "The Campfire" : place === "atlas" ? "The Atlas" : "The Library"}>
    <div className="harbour-world__stage" ref={stage} tabIndex={toolOpen ? undefined : 0} aria-label={toolOpen ? undefined : stageWords(place, placeName, closed)} onKeyDown={onStageKey} onKeyUp={onStageKeyUp} onFocus={event => { if (event.target === event.currentTarget) setStageHasKeys(true); }} onBlur={event => { if (event.target === event.currentTarget) setStageHasKeys(false); }}>
      <div className="house-world__canvas" ref={host} aria-hidden="true" />
      {(showFlat || (status === "loading" && !toolOpen)) && <HarbourFlat place={place} reading={reading} status={flatStatus} theme={theme} partnerName={partner?.name ?? null} onOpen={onOpen} onEnter={next => props.onNavigate("home", HARBOUR_PLACE_LEVELS[next])} overlay={status === "loading" && tier !== "flat"} scrub={scrub ?? undefined} onScrub={index => walk({ to: index })} onStair={place === "court" ? undefined : stair} />}
      {status === "ready" && !toolOpen && <HarbourTwins rects={rects} label={`The ${placeName.replace(/^the /, "")}`} onActivate={rect => activate(rect.id, rect.door, rect.group)} onQueenKey={(region, key) => { const found = keyAction(region as QueenRegion, key); if (found) act(region as QueenRegion, found.action, found.detail); }} />}
      {invite && <div className="harbour-world__invite" data-harbour-invite={touch ? "touch" : "keys"} aria-hidden="true"><Whisper mode="line">{inviteWords(place, touch)}</Whisper></div>}
      {stick && <div className="harbour-stick" data-harbour-stick="" aria-hidden="true" style={{ left: `${stick.x}px`, top: `${stick.y}px` }}><span className="harbour-stick__ring" /><span className="harbour-stick__knob" ref={knob as unknown as React.Ref<HTMLSpanElement>} /></div>}
      {sparkle && <div className="harbour-spark" aria-hidden="true" style={{ left: `${sparkle.x}px`, top: `${sparkle.y}px`, "--spark": sparkle.color } as CSSProperties}>{Array.from({ length: sparkle.petals }, (_, i) => <span key={i} style={{ "--i": i } as CSSProperties} />)}</div>}
      <p className="harbour-world__phrase" role="status" aria-live="polite">{phrase}</p>
      {status === "ready" && !toolOpen && <WalkTogether environment={household.environment} share={walkShare} onShare={setWalkShare} walk={partnerWalk.walk} walkName={partner?.walk ? partner.name : null} soft={softPeer} here={place} placeName={placeName} softPresenceOptedOut={presence?.optedOut === true} hasPartner={Boolean(softPeer || partnerName || partnerWalk.memberId)} />}
      {statusLine && <small className="harbour-world__supported" role="status">{statusLine}</small>}
      {!ready && status === "ready" && <small className="harbour-world__checking" role="status">Checking the books · {freshness}</small>}
      {toolOpen && <button type="button" className="harbour-world__put-back" onClick={onClose}>← Put it back in {placeName}</button>}
      {!toolOpen && status === "ready" && place !== "court" && <button type="button" className="harbour-world__stair" onClick={stair}>← Back to the Court</button>}
      {status === "fallback" && <p className="harbour-world__fallback" role="status">Reading edition · {placeName} could not be drawn; every door is a button.</p>}
    </div>
    {props.children}
  </section>;
}

/**
 * What the stage says it does — and it has to be **true in every place**
 * (walk-everywhere). It used to promise "W A S D walk" in the Court and offer
 * the rooms nothing but an orbit; then the Court's own W A S D was a camera
 * pan. Both are fixed, so the words are the same words everywhere, with only
 * the ground under them changing: an island, a shore, a room.
 *
 * The Cellar is the one place that reads differently, because down there the
 * left and right arrows are the bill rail's and the body yields them.
 */
export function stageWords(place: HarbourPlaceId, placeName: string, closed: boolean): string {
  const here = `${placeName[0]!.toUpperCase()}${placeName.slice(1)}`;
  const ground = place === "court" ? "the island" : place === "campfire" ? "the fire" : "the room";
  const floor = place === "court" ? "the open ground" : place === "campfire" ? "the open sand" : "the open floor";
  const keys = place === "cellar"
    ? "W A S D walks you around the room; the left and right arrows walk the bill rail through the month"
    : `W A S D and the arrow keys walk you around ${ground}`;
  const close = closed ? "steps back from" : "comes close to";
  return `${here}. ${keys}; Shift runs; tap ${floor} to walk there; drag to look around you; plus and minus zoom; C ${close} what this place is about; Space opens all tools; Escape stops walking, then steps back. Every door here is also a button in the quick sheet.`;
}

/**
 * The one line the stage says when it is not holding the keyboard: how to
 * start. It is `stageWords` shortened to its first move — the same ground,
 * the same keys, the same voice — because a person who has just landed needs
 * one thing, not the whole grammar.
 *
 * A thumb is told the truth for a thumb. There is no W on a phone, and the
 * ground is already tappable there; so on a coarse pointer the line is about
 * tapping and dragging, and the keys are not mentioned at all.
 */
export function inviteWords(place: HarbourPlaceId, touch: boolean): string {
  const ground = place === "court" ? "the island" : place === "campfire" ? "the fire" : "the room";
  const floor = place === "court" ? "the open ground" : place === "campfire" ? "the open sand" : "the open floor";
  return touch
    ? `Tap ${floor} to walk there · drag to look around you`
    : `Click ${ground} · then W A S D walks you around it`;
}

/** A guarded read: a window with no `matchMedia` is a window with a keyboard. */
function readTouch(): boolean {
  try { return typeof window.matchMedia === "function" && window.matchMedia(TOUCH).matches; } catch { return false; }
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

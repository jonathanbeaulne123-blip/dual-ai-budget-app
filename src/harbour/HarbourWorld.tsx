import {SkateHUD} from './skate/SkateHUD.tsx';
import {readSkateProgress,saveSkateProgress,skateProgressKey,type SkateSettings} from './skate/session.ts';
import {SKATE_TRICK_BOOK,skateGesturePath,type SkateCheckpoint} from './skate/driver.ts';
import {createSkateAudio,type SkateAudio} from './skate/audio.ts';
import type {SkateHudModel,TouchZone} from './skate/hud/model.ts';
import type {SkateFrame} from './scene/runtime.ts';
import {useDesignClient} from '../hearthside/DesignProvider.tsx';
import {snapshotKittyDesignRevision} from '../hearthside/design.ts';
import type {VillageDisplayContent} from './village/displays.ts';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { DateKey } from "../core/calendar.ts";
import type { Household, LedgerView } from "../core/types.ts";
import type { FundPulseFreshness } from "../core/fundPulse.ts";
import { isFreshPresence, memberDisplayName, type SoftPresenceDisplay } from "../softPresence.ts";
import type { HouseRoute, HouseRoom, HouseLevel } from "../hearthside/houseRoutes.ts";
import { readHouseReturn, saveHouseReturn, houseIdentity, validHouseBody } from "../house/navigation.ts";
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
import { DeskShell } from "./desk/DeskShell.tsx";
import { HarbourTwins } from "./court/CourtTwins.tsx";
import { HARBOUR_LANDMARKS, HARBOUR_PLACE_NAMES, harbourPlaceFor, harbourWayFor, type HarbourPlaceId } from "./flag.ts";
import { HARBOUR_GO_EVENT } from "./nav/QuickSheet.tsx";
import { HOUSE_LEVELS, HOUSE_ROOMS } from "../hearthside/houseRoutes.ts";
import { classifyGesture, gestureAction, spark, type QueenAction, type QueenRegion, type QueenSpark } from "./court/queenTouch.ts";
import type { QueenPlace } from "./court/queenPlace.ts";
import type { QueenHost } from "./village/BankScene.ts";
import { prepareVillageInterior, type VillageInterior } from './village/interior.ts';
import { VILLAGE_ADDRESS, ROOM_PORTALS } from './village/layout.ts';
import { VillageHUD } from './village/VillageHUD.tsx';
import type { CompassFab } from './nav/Compass.tsx';
import {HARBOUR_WANDERS,type HarbourWanderId} from './village/world.ts';
import {avatarPreferenceKey,readAvatar,saveAvatar} from './body/avatarPreference.ts';
import type {PlayableAvatar} from './body/avatarDefinition.ts';
import { VillageDecorator, type VillageDecoratorCommit } from './village/VillageDecorator.tsx';
import { villageRoomConfig, villageDisplaysEligible, type VillageRoom } from './village/villageArrangement.ts';
import { decodeHearthside } from '../hearthside/contracts.ts';
import './village/village.css';
import type { HarbourRuntime, HarbourGesture, HarbourHit, ProjectedRect, ScrubControls } from "./scene/runtime.ts";
import { PLACES, sceneDressingFrom, type Anchor, placementOf, placementToWorld, type PlaceReading, type Region } from "./scene/place.ts";
import { publishLocalPose, useWorldFeed } from "./presence/feed.ts";
import { EMOTE_IDS, type EmoteId } from "./body/bodyModel.ts";
import { WalkTogether } from "./presence/WalkTogether.tsx";
import { readWorldPresenceShare, type WorldPresenceShare } from "../softPresenceWorld.ts";
import { harbourCameraSlot } from "./scene/travel.ts";
import { qualityTier, readQualityInput, type QualityTier, type RenderTier } from "./scene/quality.ts";
import "./harbour.css";
import "./interiors/interiors.css";

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
  onNavigateLocation?: (route:HouseRoute) => void;
  onArrange?: (operation:VillageDecoratorCommit)=>Promise<void>;
  onOpen: (target: string, object?: string) => void;
  onClose: () => void;
  onJourney?:()=>void;
  presence?: SoftPresenceDisplay;
  /** Undo the coarse soft-presence opt-out, offered where a person learns of it. */
  onUnhide?: () => void;
  partnerName?: string | null;
  /** Space, or the compass handle: the App owns the quick sheet. */
  onQuickSheet?: () => void;
  /** The App's + (FabSpeedDial) wiring for the one bar (S1); absent, the bar has no +. */
  fab?: CompassFab;
  /** The App's space switch, for the Desk's header (Simple View Desk S5). */
  spaceSlot?: ReactNode;
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
  court: () => import("./village/VillageCourt.ts"),
  bank: () => import("./village/BankScene.ts"),
  tower: () => import("./village/LoftScene.ts"),
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

async function loadPlace(id:HarbourPlaceId){await PLACE_MODULES[id]();if(id!=='court'&&id!=='campfire')prepareVillageInterior(id);}
const REDUCED = "(prefers-reduced-motion: reduce)";
/**
 * Whether the hand on this thing is a thumb. It decides one thing only — the
 * words of the invitation below — because a phone has no W to press, and
 * telling somebody holding a phone to press it is the sort of thing that made
 * the keys unreachable in the first place.
 */
const TOUCH = "(pointer: coarse)";
/** Keys that ride while a skate HUD button holds the focus (input/NOTES-tricks.md; B walks, P/Escape pause). */
const SKATE_KEYS: ReadonlySet<string> = new Set(['w','a','s','d','shift','arrowup','arrowdown','arrowleft','arrowright','i','j','k','l','q','e','c','x','g','m','n','o','u','y','t','r','f','h','v','p','b','escape','1','2','3','4','5','6']);
/**
 * A face for each emote, for the row of six. They are the *label*, not the
 * pose — the pose is carved (`body/figure.ts`) — and each button carries its
 * number too, so the row teaches the keys it is standing in for.
 */
const EMOTE_FACES: Readonly<Record<EmoteId, string>> = Object.freeze({
  wave: "👋", dance: "💃", sit: "🪑", cheer: "🙌", laugh: "😂", point: "👉",
});
const pulseFreshness = (gate: InterpretationGate | undefined): FundPulseFreshness => (gate?.freshness === "stale" || gate?.freshness === "offline" ? gate.freshness : "current");

export default function HarbourWorld(props: HarbourWorldProps) {
  const { household, memberId, scope, today, route, ready, freshness, interpretationGate, onOpen, onClose, presence, onUnhide, partnerName = null, onQuickSheet } = props;
  const appearance = useAppearance(), theme: ThemeId = appearance.preview ?? appearance.saved.theme;
  const host = useRef<HTMLDivElement>(null), stage = useRef<HTMLDivElement>(null);
  const runtime = useRef<HarbourRuntime | null>(null), court = useRef<QueenHost | null>(null), queen = useRef<QueenPlace | null>(null);
  const queenAnimation=useRef<(()=>void)|null>(null);
  const [arranging,setArranging]=useState(false);
  const [previewLook,setPreviewLook]=useState<ReturnType<typeof villageRoomConfig>|null>(null);
  const [travelTo,setTravelTo]=useState<HarbourPlaceId|null>(null);
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
  /**
   * ── The moves (walk-moves) ──
   * Whether the emote row is showing. It is one row of six on both a phone
   * and a desktop — `E` opens it with the keys, a thumb button opens it with
   * a thumb — because six emotes is a set you *pick from*, and a set you pick
   * from should look the same wherever you are picking it.
   */
  const [emotesOpen, setEmotesOpen] = useState(false);
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
  const avatarKey=avatarPreferenceKey(household.environment,household.householdId,memberId);
  const [avatar,setAvatar]=useState<PlayableAvatar|null>(()=>readAvatar(localStorage,avatarKey));
  const [avatarStatus,setAvatarStatus]=useState<"idle"|"loading"|"ready"|"error">(avatar?"loading":"idle");
  const avatarRef=useRef(avatar);avatarRef.current=avatar;
  const [skating,setSkating]=useState<SkateHudModel|null>(null),[skateSaveFailed,setSkateSaveFailed]=useState(false);
  /** Synthesized skate sound: created inside the click/key that asked for it (autoplay policy), owned here. */
  const skateAudio=useRef<SkateAudio|null>(null);
  const skateKey=skateProgressKey(household.environment,household.householdId,memberId);
  const skateKeyRef=useRef(skateKey);skateKeyRef.current=skateKey;
  const skateSaved=useRef(''),skateOwner=useRef<string|null>(null);
  const skateRebuild=useRef<{owner:string;checkpoint:SkateCheckpoint}|null>(null);
  const onSkate=useCallback((next:SkateFrame|null)=>{
    if(next&&skateOwner.current!==skateKeyRef.current){setSkating(null);return;}
    setSkating(next?.model??null);
    // Device-local progress, per environment/household/member: written only when it changed.
    if(next){const serialized=JSON.stringify(next.progress);if(serialized!==skateSaved.current){skateSaved.current=serialized;setSkateSaveFailed(!saveSkateProgress(localStorage,skateKeyRef.current,next.progress));}}
  },[]);
  const dropSkateAudio=()=>{runtime.current?.body()?.skate?.setAudio(null);skateAudio.current?.dispose();skateAudio.current=null;};
  /** Only ever called inside a user gesture (click / key): an AudioContext needs one. */
  const wantSkateAudio=(on:boolean)=>{
    if(!on){dropSkateAudio();return;}
    if(!skateAudio.current){try{skateAudio.current=createSkateAudio();}catch{skateAudio.current=null;}}
    runtime.current?.body()?.skate?.setAudio(skateAudio.current);
  };
  useEffect(()=>{skateOwner.current=null;skateRebuild.current=null;runtime.current?.body()?.skate?.enable(false);dropSkateAudio();setSkating(null);skateSaved.current='';setSkateSaveFailed(false);},[skateKey]);
  useEffect(()=>()=>{skateAudio.current?.dispose();skateAudio.current=null;},[]);
  const startSkating=()=>{
    skateOwner.current=skateKey;held.current.clear();pushBody();
    const progress=readSkateProgress(localStorage,skateKey);
    if(runtime.current?.body()?.skate?.enable(true,progress)&&progress.settings.sound)wantSkateAudio(true);
    setEmotesOpen(false);
  };
  const leaveSkating=()=>{skateOwner.current=null;held.current.clear();pushBody();dropSkateAudio();runtime.current?.body()?.skate?.enable(false);setSkating(null);};
  const skateSettings=(patch:Partial<SkateSettings>)=>{runtime.current?.body()?.skate?.settings(patch);if(patch.sound!==undefined)wantSkateAudio(patch.sound);};
  /** HUD touch slots → the skate input's touch handlers (pointer capture is the HUD's). */
  const skateZone=(zone:TouchZone,event:React.PointerEvent<HTMLElement>)=>{
    const input=runtime.current?.body()?.skate?.input();if(!input)return;
    const e=event.nativeEvent;
    if(event.type==='pointerdown')input.touchStart(zone,e);
    else if(event.type==='pointermove')input.touchMove(e);
    else if(event.type==='pointerup')input.touchEnd(e);
    else input.touchCancel(e);
  };
  useEffect(()=>{const selected=readAvatar(localStorage,avatarKey);avatarRef.current=selected;setAvatar(selected);setAvatarStatus(selected?"loading":"idle");runtime.current?.setAvatar(selected);},[avatarKey]);
  function chooseAvatar(next:PlayableAvatar){avatarRef.current=next;setAvatar(next);setAvatarStatus("loading");saveAvatar(localStorage,avatarKey,next);runtime.current?.setAvatar(next);}
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
    // `act` and `p` travel with the position: a jump, a slide or an emote is
    // something a partner should *see*, and it is ephemeral — nothing here is
    // written down anywhere, at either end.
    return { target: pose.target, theta: pose.theta, avatar: avatarRef.current, body: at ? { x: at.x, z: at.z, yaw: at.yaw, act: at.act, p: at.p, ...(at.act?.startsWith("skate")?{y:at.y}: {}) } : null };
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
  const onLocationRef=useRef(props.onNavigateLocation);onLocationRef.current=props.onNavigateLocation;
  const onJourneyRef=useRef(props.onJourney);onJourneyRef.current=props.onJourney;
  function openJourney(){window.dispatchEvent(new Event('hearth:house-return'));onJourneyRef.current?.();}
  function navigatePlace(next:HarbourPlaceId){
    const address=VILLAGE_ADDRESS[next];
    if(onLocationRef.current)onLocationRef.current({householdId:identityRef.current.householdId,scope:identityRef.current.scope,...address});
    else onNavigateRef.current(address.room,address.level);
    setArranging(false);setTravelTo(null);
  }
  function visit(next:HarbourPlaceId,instant=false){
    const world=runtime.current, placement=placementOf(next);
    if(!instant&&placeRef.current==='court'&&placement&&world?.body()){
      void loadPlace(next).then(()=>world.restream());
      const [x,,z]=placementToWorld(placement,[placement.door[0],0,placement.halfDepth-.6]);
      if(world.body()?.goTo(x,z)){setTravelTo(next);setPhrase(`Walking to ${HARBOUR_PLACE_NAMES[next]}.`);}
      else{setTravelTo(null);setPhrase('That path is blocked. Pick a spot nearby or use Quick travel.');}return;
    }
    navigatePlace(next);
  }
  function wanderTo(id:HarbourWanderId){
    const destination=HARBOUR_WANDERS.find(w=>w.id===id);if(!destination)return;
    if(placeRef.current!=='court'){navigatePlace('court');setPhrase('The countryside paths start in the village square.');return;}
    setTravelTo(null);
    if(runtime.current?.body()?.goTo(destination.at[0],destination.at[1]))setPhrase(`${destination.name}. ${destination.words}`);
    else setPhrase('Pick a nearby point to find a way around, or take the village path.');
  }
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
    if (!(window.matchMedia(REDUCED).matches || document.documentElement.dataset.motion === "reduced") && at) setSparkle({ ...next, ...at, at: Date.now() });
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
      case "roots-view": if (her && world) { const pose = her.poses().roots, placement=placementOf("bank"); const target=placement?placementToWorld(placement,[pose.target[0],pose.target[1]+.16,pose.target[2]+.8]):pose.target; world.look({ target, r: pose.r, theta: pose.theta+(placement?.yaw??0), phi: pose.phi }); } break;
      case "spin": if (her) { her.group.rotation.y += (detail.dx ?? 0) * 0.01; world?.setReading(readingRef.current); } break;
      case "distance": world?.gesture({ kind: "zoom", delta: (detail.dy ?? 0) * 0.004 }); break;
    }
    say(spark(region), detail.at);
  }, [evidence.length, say]);

  const onTap = useCallback((hit: HarbourHit, at: { x: number; y: number }) => {
    // She stands in the Court; her touch grammar travels nowhere else.
    if (hit.kind === "queen") { if (placeRef.current !== "bank") return; const region = hit.region as QueenRegion; const action = gestureAction(region, "tap"); if (action) act(region, action, { at }); return; }
    if (hit.kind !== "anchor") return;
    activate(hit.id, hit.anchor.door, hit.anchor.zone);
  }, [act]); // eslint-disable-line react-hooks/exhaustive-deps
  const onThreshold = useCallback((next: HarbourPlaceId) => {
    if (placeRef.current === next) return;
    crossing.current = next;
    navigatePlace(next);
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
    if (placeRef.current !== "bank") return;
    const kind = classifyGesture(gesture.samples); if (!kind) return;
    const region = gesture.region as QueenRegion; const action = gestureAction(region, kind); if (!action) return;
    const first = gesture.samples[0]!, last = gesture.samples[gesture.samples.length - 1]!;
    act(region, action, { dx: last.x - first.x, dy: last.y - first.y, at: { x: last.x, y: last.y } });
  }, [act]);

  function activate(id: string, door?: { target: string; object?: string }, zone?: string) {
    const world = runtime.current, current = readingRef.current;
    if(id.startsWith('visit:')){const target=id.slice(6) as HarbourPlaceId;if(target in VILLAGE_ADDRESS)visit(target);return;}
    if(id.startsWith('wander:')){wanderTo(id.slice(7) as HarbourWanderId);return;}
    if(id.startsWith('skate:')){startSkating();setPhrase('Board ready. Open Explore to find a line.');return;}
    if(id==='hercules'){runtime.current?.body()?.emote('wave');setPhrase('Hercules is right here with you.');return;}
    const portal=ROOM_PORTALS[placeRef.current]?.find(p=>p.id===id);
    if(portal){navigatePlace(portal.to);return;}
    if(id==='village-exit'){navigatePlace('court');return;}
    const playful=(world?.place() as VillageInterior|undefined)?.play?.(id);
    if(playful){if(id==='village-dance')world?.body()?.emote('dance');if(id==='village-bench')world?.body()?.emote('sit');setPhrase(playful);world?.invalidate();return;}
    // Enter, then Open. A way walks you to another level of this room; only
    // then does a door open an HTML surface in front of the place.
    const way = harbourWayFor(id, zone);
    if (way) { navigatePlace(way==='court'?'court':way); return; }
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
      const detail = (event as CustomEvent<{ room?: unknown; level?: unknown; place?: unknown }>).detail;
      if (typeof detail?.place === 'string' && Object.hasOwn(VILLAGE_ADDRESS, detail.place)) {
        navigatePlace(detail.place as HarbourPlaceId); return;
      }
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
    setSkating(null);
    const element = host.current; if (!element || tier === "flat") { setStatus(tier === "flat" ? "flat" : "loading"); return; }
    let cancelled = false; const abort = new AbortController(); setStatus("loading"); setRects([]);
    const renderTier: RenderTier = tier;
    const first = placeRef.current;
    void Promise.all([import("./scene/runtime.ts"), loadPlace(first), import("./court/dressing.ts"), loadPlace("court")]).then(([{ mountHarbourWorld }, , { COURT_DRESSING }]) => {
      if (cancelled) return;
      try {
        const world = mountHarbourWorld(element, theme, renderTier, {
          onSkate,
          onReady: () => setStatus("ready"), onFailure: () => setStatus("fallback"),
          onProject: next => setRects(next), onTap, onGesture, onRailDrag: (x, width) => onRailDragRef.current(x, width),
          onStick, onClose: setClosed, onThreshold, onExit,
          onAvatarStatus:(loaded,status)=>{if(avatarRef.current===loaded)setAvatarStatus(status);},
          avatar:avatarRef.current,onJourney:()=>openJourney(),
          place: PLACES[first], reading: readingRef.current, dressing: sceneDressingFrom(COURT_DRESSING[theme]),
        });
        runtime.current = world;world.go("court");
        court.current = first === "bank" ? world.place() as QueenHost : null;
        world.setToolOpen(Boolean(routeRef.current.surface));
        void holdRail(world);
        world.invalidate();
        const saved = readHouseReturn(localStorage, identityRef.current, harbourCameraSlot(houseComposition(element.getBoundingClientRect().width || window.innerWidth), first));
        if (saved?.camera && sameHouseCameraRoute(saved.route, routeRef.current)) world.restore(saved.camera);
        if(saved&&sameHouseCameraRoute(saved.route,routeRef.current)&&validHouseBody(saved.body)&&saved.body.place===first)world.body()?.place(saved.body.x,saved.body.z,saved.body.yaw);
        const resume=skateRebuild.current;skateRebuild.current=null;
        if(resume&&resume.owner===skateKeyRef.current&&first==='court'&&!routeRef.current.surface){skateOwner.current=resume.owner;world.body()?.skate?.restore(resume.checkpoint);world.body()?.skate?.setAudio(skateAudio.current);}
        if (first !== "bank") return;
        void import("./court/queenPlace.ts").then(({ loadQueenPlace }) => loadQueenPlace(renderTier, appearance.saved.queen ?? DEFAULT_QUEEN_STYLE, evidenceRef.current, abort.signal)).then(her => {
          if (cancelled || !runtime.current) { her.dispose(); return; }
          queen.current = her;
          court.current?.attachQueen(her.group, () => queenRegions(her));
          world.setReading(readingRef.current);
          if (!(window.matchMedia(REDUCED).matches || document.documentElement.dataset.motion === "reduced")) { queenAnimation.current?.();queenAnimation.current=world.addAnimator(t => her.breathe(t)); world.setBreathing(true); }
        }).catch(() => { element.dataset.queen = "unavailable"; });
      } catch { setStatus("fallback"); }
    }).catch(() => setStatus("fallback"));
    return () => { const checkpoint=runtime.current?.body()?.skate?.checkpoint();if(checkpoint&&skateOwner.current)skateRebuild.current={owner:skateOwner.current,checkpoint};cancelled = true; abort.abort(); queenAnimation.current?.();queenAnimation.current=null;queen.current?.dispose(); queen.current = null; court.current = null; runtime.current?.dispose(); runtime.current = null; };
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
        .map((id) => loadPlace(id).catch(() => undefined));
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
    if (!toolOpen) return;
    setRects([]);
    // Keep the room and the person at their chosen desk.
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
    void loadPlace(place).then(() => {
      if (cancelled || runtime.current !== world) return;
      // The Court's group may survive the journey now (walking into a building
      // on the island keeps the island standing), so she is taken out of her
      // slot before she is disposed — a disposed geometry left in a standing
      // scene is a black hole where the Queen was.
      if (from === "bank") { court.current?.detachQueen(); queenAnimation.current?.();queenAnimation.current=null;queen.current?.dispose(); queen.current = null; court.current = null; world.setBreathing(false); }
      const walked = crossing.current === place;
      crossing.current = null;
      world.enter(place, { from, reduced:true, ...(walked ? { threshold: true } : {}) });
      world.invalidate();
      court.current = place === "bank" ? world.place() as QueenHost : null;
      void holdRail(world);
      if (place !== "bank" || tier === "flat") return;
      void import("./court/queenPlace.ts").then(({ loadQueenPlace }) => loadQueenPlace(tier as RenderTier, appearance.saved.queen ?? DEFAULT_QUEEN_STYLE, evidenceRef.current, abort.signal)).then(her => {
        if (cancelled || runtime.current !== world || placeRef.current !== "bank") { her.dispose(); return; }
        queen.current = her;
        court.current?.attachQueen(her.group, () => queenRegions(her));
        world.setReading(readingRef.current);
        if (!(window.matchMedia(REDUCED).matches || document.documentElement.dataset.motion === "reduced")) { queenAnimation.current?.();queenAnimation.current=world.addAnimator(t => her.breathe(t)); world.setBreathing(true); }
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
    const restore = (event: Event) => { const detail = (event as CustomEvent).detail; if (detail?.identity === houseIdentity(identityRef.current) && Array.isArray(detail.camera) && detail.camera.length === 3 && detail.camera.every(Number.isFinite)) {runtime.current?.restore(detail.camera);if(validHouseBody(detail.body)&&detail.body.place===runtime.current?.placeId())runtime.current?.body()?.place(detail.body.x,detail.body.z,detail.body.yaw);} };
    const remember = () => {
      const current = routeRef.current, world = runtime.current; if (!world || current.surface) return;
      const composition = houseComposition(host.current?.getBoundingClientRect().width || window.innerWidth);
      saveHouseReturn(localStorage, identityRef.current, houseCameraRoute(current), { camera: [...world.camera()] as [number, number, number], cameraComposition: composition, body:world.body()?{place:world.placeId(),x:world.body()!.at().x,z:world.body()!.at().z,yaw:world.body()!.at().yaw}:undefined }, harbourCameraSlot(composition, world.placeId()));
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
   * ── The moves (walk-moves) ──
   * Jump, slide and emote, each a single call into the body. They are
   * deliberately *not* held keys: a move is an event, and a set of held keys
   * is how a walk is described, not a hop.
   *
   * **Space is not one of them.** Space opens the quick sheet, everywhere,
   * including here — that is the one key the whole app can be reached by and
   * it is not for sale. Jump is `J`, the slide beside it is `K`, and the
   * emotes are `1`…`6` with `E` for the row of them.
   */
  const doMove = useCallback((move: "jump" | "slide") => {
    const body = runtime.current?.body();
    if (!body) return false;
    if (move === "jump") body.jump(); else body.slide();
    setEmotesOpen(false);
    return true;
  }, []);
  const doEmote = useCallback((id: EmoteId | null) => {
    const body = runtime.current?.body();
    if (!body) return false;
    body.emote(id);
    return true;
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
    const drop = () => { runtime.current?.body()?.skate?.pause(true);if (held.current.size) { held.current.clear(); pushBody(); } };
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
  /**
   * True only for the instant the stage is focusing *itself* — on arrival, or
   * under a press on the ground. A focus ring is the answer to "where did my
   * keyboard go?", and neither of those asked the question: a ring round the
   * whole island on every load, or under every click, is a change to what the
   * world looks like, and this is not that. Tab here and the ring is there in
   * full, which is the case that needs it.
   */
  const arriving = useRef(false);
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
    arriving.current = true;
    node.focus({ preventScroll: true });
    arriving.current = false;
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

  /**
   * A press on the ground hands the stage the keyboard — which the browser
   * would have done by itself, and does not.
   *
   * `scene/runtime.ts` `onPointerDown` cancels the pointer's default action so
   * a drag across the island never selects text or scrolls the page. A
   * cancelled `pointerdown` also cancels the focus the browser was going to
   * give the focusable element under it, so **clicking the world never
   * focused the stage either**: on `origin/main` the only way to reach the
   * walk at all was to Tab to it. This puts back exactly the default the
   * runtime suppressed, and nothing more.
   *
   * A real control inside the stage keeps its own press — the stair, "Put it
   * back", a twin — the same list the runtime itself steps around.
   */
  function onStagePress(event: ReactPointerEvent<HTMLDivElement>) {
    if (toolOpen) return;
    const target = event.target;
    if (target instanceof Element && target.closest("button,a,input,select,textarea,[role=button]")) return;
    // Quietly, like the arrival: a press is a pointer, and a pointer has never
    // wanted a focus ring. Tab is still Tab, and Tab is still ringed.
    arriving.current = true;
    stage.current?.focus({ preventScroll: true });
    arriving.current = false;
  }

  /**
   * Skate keys pressed while a HUD button holds the focus still ride. Dialogs
   * and fields keep all their keys.
   */
  function acceptsSkateKey(event:ReactKeyboardEvent<HTMLDivElement>){
    return runtime.current?.body()?.skate?.active()&&event.target instanceof Element
      &&Boolean(event.target.closest('.skate-hud,.harbour-moves'))&&!event.target.closest('input,select,textarea,[role=dialog]')
      &&SKATE_KEYS.has(event.key.toLowerCase());
  }

  function onStageKeyUp(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget&&!acceptsSkateKey(event)) return;
    const key = event.key.toLowerCase();
    const skate=runtime.current?.body()?.skate;
    if(skate?.active()){
      if(skate.input()?.keyUp(event.nativeEvent))event.preventDefault();
      held.current.delete(key);
      return;
    }
    if (!held.current.delete(key)) return;
    pushBody();
    event.preventDefault();
  }

  function onStageKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    const skateHudSpace = event.key === " " && runtime.current?.body()?.skate?.active()
      && event.target instanceof Element && Boolean(event.target.closest('.skate-hud,.harbour-moves'))
      && !event.target.closest('input,select,textarea,[role=dialog]');
    if (event.target !== event.currentTarget&&!acceptsSkateKey(event)&&!skateHudSpace) return;
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
    const skate=world.body()?.skate;
    const skateKey=event.key.toLowerCase();
    if(skateKey==='b'&&placeRef.current==='court'&&!event.repeat){skate?.active()?leaveSkating():startSkating();event.preventDefault();return;}
    if(skate?.active()){
      const slot=EMOTE_IDS[Number(skateKey)-1];
      if(slot){if(!event.repeat)doEmote(slot);setEmotesOpen(false);event.preventDefault();return;}
      // P / Escape pause (the book opens); everything else a skater presses goes to the flick-it input.
      if(skateKey==='p'||skateKey==='escape'){if(!event.repeat){held.current.clear();pushBody();skate.pause(!skate.paused());}event.preventDefault();return;}
      if(skate.input()?.keyDown(event.nativeEvent)){event.preventDefault();return;}
    }
    // ── The moves (walk-moves) ──
    // Above the walk, because a jump asked for while W is held is still a
    // jump, and below the rail, which keeps its own keys down in the Cellar.
    const lower = event.key.toLowerCase();
    if (!railKey && runtime.current?.body()) {
      if (lower === "j" && doMove("jump")) { event.preventDefault(); return; }
      if (lower === "k" && doMove("slide")) { event.preventDefault(); return; }
      if (lower === "e") { setEmotesOpen(open => !open); event.preventDefault(); return; }
      const slot = EMOTE_IDS[Number(event.key) - 1];
      if (slot && doEmote(slot)) { setEmotesOpen(false); event.preventDefault(); return; }
    }
    // ── The body lane (world-body → walk-everywhere) ──
    // The walk comes first, in every place. The rail's own keys are the one
    // exception, and everything below is untouched.
    if (event.key === "Shift" && world.body()) {
      held.current.add("shift"); pushBody(); event.preventDefault(); return;
    }
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
      // The emote row is the most immediate "out" of all: it is a thing that
      // is open, in front of you, waiting to be picked from.
      if (emotesOpen) { setEmotesOpen(false); doEmote(null); }
      else if (body?.following()) { held.current.clear(); body.input({ forward: 0, strafe: 0 }); body.follow(false); }
      else if (world.closed()) setClosed(world.toggleClose(false));
      else if (placeRef.current === "court") world.go("court");
      else onNavigateRef.current("home", "middle");
    }
    else return;
    event.preventDefault();
  }

  const designClient=useDesignClient();
  const hearthside=useMemo(()=>decodeHearthside(household.hearthside),[household.hearthside]);
  const arrangement=hearthside.villageArrangement;
  const decorRoom:VillageRoom|null=place==='court'||place==='campfire'?null:place==='tower'?'loft':place==='kiln'?'studio':place;
  const savedRoomLook=decorRoom?villageRoomConfig(arrangement,decorRoom):null;
  const roomLook=previewLook?.room===decorRoom?{...previewLook,displays:[...previewLook.displays]}:savedRoomLook;
  if(roomLook&&!villageDisplaysEligible(household,hearthside,roomLook.displays))roomLook.displays=[];
  useEffect(()=>{(runtime.current?.place() as VillageInterior|undefined)?.decorate?.(roomLook);runtime.current?.invalidate();},[place,status,arrangement,household.hearthside,previewLook]);
  const displayKey=JSON.stringify(roomLook?.displays??[]);
  useEffect(()=>{
    const target=runtime.current?.place() as VillageInterior|undefined;target?.display?.([]);
    const refs=roomLook?.displays??[];let cancelled=false;
    void Promise.all(refs.slice(0,2).map(async (ref):Promise<VillageDisplayContent|null>=>{
      if(ref.kind==='memory'){const memory=hearthside.memories.find(m=>m.id===ref.id&&m.revision===ref.revision);return memory?{kind:'memory' as const,id:memory.id,title:memory.title}:null;}
      try{const document=await designClient?.load(ref.designId,ref.revision);
        if(!document||document.scope.ownerMemberId!==null||document.scope.environment!==household.environment||document.scope.householdId!==household.householdId)return null;
        const snapshot=snapshotKittyDesignRevision(document,ref.id,ref.revision);
        return {kind:'piece' as const,id:ref.id,designId:ref.designId,piece:snapshot.piece,appearance:snapshot.appearance};
      }catch{return null;}
    })).then(items=>{if(!cancelled&&runtime.current?.place()===target){target?.display?.(items.filter((x):x is VillageDisplayContent=>x!==null));runtime.current?.invalidate();}});
    return ()=>{cancelled=true;target?.display?.([]);};
  },[place,status,displayKey,household.environment,household.householdId,hearthside,designClient]);
  const showFlat = status === "flat" || status === "fallback" || (status === "loading" && tier === "flat");
  /** At rest in the square with no WebGL world standing, the Desk is the 2D world (SIMPLE_VIEW_DESK S2); rooms keep their flats until S6. */
  const desk = (status === "flat" || status === "fallback") && !toolOpen && place === "court";
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
  const stair = () => navigatePlace("court");
  return <section className={`harbour-world harbour-world--${theme}${skating?" is-skating":""}${toolOpen ? " has-open-object" : ""}`} data-world-status={status} data-world-scope={scope} data-harbour-place={place} data-harbour-tier={tier} data-harbour-lens={lens} aria-label={placeName}>
    <div className="harbour-world__stage" ref={stage} tabIndex={toolOpen ? undefined : 0} aria-label={toolOpen ? undefined : showFlat ? `${placeName}. Reading edition. Every destination is a button.` : skating?"Skate the Harbour. W pushes, A turns left, D turns right, S brakes. Keys 1 to 6 emote while riding. Hold the down arrow and flick up to ollie, flick to a corner to flip. Q and E grab, G locks onto rails, M manuals, R returns to your marker, P pauses, B walks. Space opens all tools.":stageWords(place, placeName, closed)} onKeyDown={onStageKey} onKeyUp={onStageKeyUp} onPointerDown={onStagePress} onFocus={event => { if (event.target !== event.currentTarget) return; setStageHasKeys(true); event.currentTarget.toggleAttribute("data-harbour-arrived", arriving.current); }} onBlur={event => { if (event.target === event.currentTarget) {setStageHasKeys(false);if(held.current.size){held.current.clear();pushBody();}if(!event.currentTarget.contains(event.relatedTarget as Node))runtime.current?.body()?.skate?.pause(true);} }}>
      <div className="house-world__canvas" ref={host} aria-hidden="true" />
      {((showFlat && !desk) || (status === "loading" && !toolOpen)) && <HarbourFlat place={place} reading={reading} status={flatStatus} theme={theme} partnerName={partner?.name ?? null} onOpen={onOpen} onEnter={next => navigatePlace(next)} overlay={status === "loading" && tier !== "flat"} scrub={scrub ?? undefined} onScrub={index => walk({ to: index })} onStair={place === "court" ? undefined : stair} />}
      {desk && <DeskShell household={household} memberId={memberId} scope={scope} today={today} reading={reading} theme={theme} status={status === "fallback" ? "fallback" : "flat"} onOpen={onOpen} onQuickSheet={onQuickSheet} spaceSlot={props.spaceSlot} />}
      {status === "ready" && !toolOpen && <HarbourTwins rects={rects} hidden={Boolean(skating)} label={`The ${placeName.replace(/^the /, "")}`} onActivate={rect => activate(rect.id, rect.door, rect.group)} onQueenKey={(region, key) => { const found = keyAction(region as QueenRegion, key); if (found) act(region as QueenRegion, found.action, found.detail); }} />}
      {(status==="ready"||(showFlat&&!desk))&&!toolOpen&&<VillageHUD fab={props.fab} onQuickSheet={onQuickSheet} place={place} travelling={travelTo} onVisit={visit} onWander={showFlat?undefined:wanderTo} avatar={avatar} avatarStatus={avatarStatus} onAvatar={showFlat?undefined:chooseAvatar} onJourney={props.onJourney?openJourney:undefined} onArrange={props.onArrange&&place!=='court'&&place!=='campfire'?()=>setArranging(open=>!open):undefined} onView={()=>{runtime.current?.body()?.follow(false);runtime.current?.go('sky');}}
        presence={status==="ready"?<WalkTogether environment={household.environment} share={walkShare} onShare={setWalkShare} walk={partnerWalk.walk} walkName={partner?.walk ? partner.name : null} soft={softPeer} here={place} placeName={placeName} softPresenceOptedOut={presence?.optedOut === true} onUnhide={onUnhide} hasPartner={Boolean(softPeer || partnerName || partnerWalk.memberId)} />:undefined}/>}
      {status==='ready'&&!toolOpen&&place==='court'&&standing&&<SkateHUD model={skating} onStart={startSkating} onWalk={leaveSkating}
        onSettings={skateSettings} onCommand={command=>runtime.current?.body()?.skate?.command(command)} onZonePointer={skateZone}
        gesturePath={skateGesturePath} trickBook={SKATE_TRICK_BOOK}
        onPause={on=>{held.current.clear();pushBody();runtime.current?.body()?.skate?.pause(on);}} onRoute={id=>runtime.current?.body()?.skate?.route(id)}
        onSpot={id=>runtime.current?.body()?.skate?.spot(id)} onDeck={id=>runtime.current?.body()?.skate?.deck(id)}
        presence={<WalkTogether environment={household.environment} share={walkShare} onShare={setWalkShare} walk={partnerWalk.walk} walkName={partner?.walk?partner.name:null} soft={softPeer} here={place} placeName={placeName} softPresenceOptedOut={presence?.optedOut===true} onUnhide={onUnhide} hasPartner={Boolean(softPeer||partnerName||partnerWalk.memberId)}/>}
        onFocus={()=>stage.current?.focus({preventScroll:true})} partnerName={partnerWalk.walk?.pose(Date.now())?.act?.startsWith('skate')?partner?.name:null} saveFailed={skateSaveFailed}/>}
      {arranging&&!showFlat&&decorRoom&&props.onArrange&&<VillageDecorator key={decorRoom} household={household} memberId={memberId} room={decorRoom} arrangement={arrangement} onCommit={props.onArrange} onPreview={setPreviewLook} onClose={()=>{setArranging(false);stage.current?.querySelector<HTMLButtonElement>('[aria-label="Arrange room"]')?.focus();}}/>}
      {invite && <div className="harbour-world__invite" data-harbour-invite={touch ? "touch" : "keys"} aria-hidden="true"><Whisper mode="line">{inviteWords(place, touch)}</Whisper></div>}
      {status === "ready" && !toolOpen && standing && <div className="harbour-moves" data-harbour-moves={emotesOpen ? "open" : "shut"}>
        {emotesOpen && <div className="harbour-moves__emotes" role="group" aria-label="Emotes">
          {EMOTE_IDS.map((id, i) => <button key={id} type="button" className="harbour-moves__emote" data-emote={id}
            onPointerDown={event => event.stopPropagation()}
            onClick={() => { doEmote(id); setEmotesOpen(false); stage.current?.focus({ preventScroll: true }); }}>{EMOTE_FACES[id]}<small>{i + 1}</small></button>)}
        </div>}
        {touch && <div className="harbour-moves__row">
          {!skating&&<button type="button" className="harbour-moves__key" onPointerDown={event => event.stopPropagation()} onClick={() => doMove("jump")}>Jump</button>}
          {!skating&&<button type="button" className="harbour-moves__key" onPointerDown={event => event.stopPropagation()} onClick={() => doMove("slide")}>Slide</button>}
          <button type="button" className="harbour-moves__key" aria-pressed={emotesOpen} onPointerDown={event => event.stopPropagation()} onClick={() => setEmotesOpen(open => !open)}>Emote</button>
        </div>}
      </div>}
      {stick && <div className="harbour-stick" data-harbour-stick="" aria-hidden="true" style={{ left: `${stick.x}px`, top: `${stick.y}px` }}><span className="harbour-stick__ring" /><span className="harbour-stick__knob" ref={knob as unknown as React.Ref<HTMLSpanElement>} /></div>}
      {sparkle && <div className="harbour-spark" aria-hidden="true" style={{ left: `${sparkle.x}px`, top: `${sparkle.y}px`, "--spark": sparkle.color } as CSSProperties}>{Array.from({ length: sparkle.petals }, (_, i) => <span key={i} style={{ "--i": i } as CSSProperties} />)}</div>}
      <p className="harbour-world__phrase" role="status" aria-live="polite">{phrase}</p>
      {statusLine && <small className="harbour-world__supported" role="status">{statusLine}</small>}
      {!ready && status === "ready" && <small className="harbour-world__checking" role="status">Checking the books · {freshness}</small>}
      {toolOpen && <button type="button" className="harbour-world__put-back" onClick={onClose}>← Put it back in {placeName}</button>}
      {!toolOpen && status === "ready" && place !== "court" && <button type="button" className="harbour-world__stair" onClick={stair}>← Village square</button>}
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
  return `${here}. ${keys}; Shift runs; J jumps and K slides out of a run; E opens the emotes and 1 to 6 play them; tap ${floor} to walk there; drag to look around you; plus and minus zoom; C ${close} what this place is about; Space opens all tools; Escape stops walking, then steps back. Every door here is also a button in the quick sheet.`;
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

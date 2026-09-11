import { availableHerculesActions } from './core/herculesActions.ts';
import { HERCULES_WORKFLOW_CATALOGUE } from "./core/herculesWorkflowCatalogue.ts";
import { HerculesActionPanel, type HerculesActionHandle } from "./HerculesActionPanel.tsx";
import type { HerculesCommandService } from "./herculesCommandService.ts";
import {trimCompanionPending} from "./core/herculesSessionDraft.ts";
import {useWornLook} from './wardrobe/Appearance.tsx';
import {fittingLayers} from './wardrobe/FittingFigure.tsx';
import { HerculesDiscovery } from "./HerculesDiscovery.tsx";
import { discoveryScope, discoverySelection, explainDiscovery, type DiscoveryDestination, type DiscoveryFund } from "./core/herculesDiscovery.ts";
import { HERCULES_CAPABILITIES } from "./core/herculesCapabilities.ts";
import { companionCueCommands } from "./core/herculesPresentation.ts";
import { resolveHerculesFollowUp } from "./core/herculesPlanner.ts";
import { CompanionMemoryControls } from "./CompanionMemoryControls.tsx";
import type { KitchenCommand } from "./kitchenCommand.ts";
import { companionFor, companionConversation, commitCompanion, explicitCompanionPreference } from "./core/herculesCompanion.ts";
import type { CompanionIntentV1, CompanionOperation, CompanionPreferenceValue, CompanionSourceReference } from "./core/herculesCompanionContracts.ts";
import { useDialog, useModalActive } from "./useDialog.ts";
import { HerculesSetup, type HerculesSetupProps } from "./HerculesSetup.tsx";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject, type PointerEvent } from "react";
import {
  attackStand,
  attackTarget,
  bubbleNotice,
  chatHercules,
  composeHerculesChatRequest,
  collectAllowedFigures,
  describeCompanion,
  emitOfficeIntent,
  furnitureUnderCat,
  groceryHighFive,
  herculesBriefing,
  herculesBubbleBox,
  widgetSnippetBubbleBox,
  herculesPageSurface,
  herculesProviderForDisplayedReply,
  herculesProviderLabel,
  herculesInstrumentSurface,
  herculesUsefulness,
  hourInToronto,
  isCurrentHerculesReply,
  kettlePhase,
  kitchenSeason,

  listFurniture,
  perchOnFurniture,
  perchTarget,
  planHerculesTurn,
  planHerculesReadTools,
  shouldPlanHerculesTools,
  executeHerculesReadToolPlan,

  sanitizeGroundedNumerals,
  requestCalendarPane,
  subscribeFurniture,
  subscribeOfficeIntent,
  walkHits,
  walkPath,
  calendarEventIntent,
  helpCommands,
  matchHelpCommand,
  openHelpState,
  isInstrumentId,
  loadPhonePlacePrefs,
  memberProgress,
  householdForHerculesContext,
  personalModuleOfferFor,
  recordPersonalModuleOffer,
  shouldShowOnboardingShell,
  copy,
  navTargetSurfaceLabel,
  onboardingNavigationTarget,
  saveReturnMessage,
  CAT,
  NAV,
  WIDE_BREAKPOINT,
  type CommitResult,
  type CompanionMood,
  type HearthTab,
  type HerculesChatTurn,
  type HerculesDraft,
  type HerculesPose,
  type HerculesReplyContext,
  type HerculesChatProvider,
  type HerculesTalk,
  type Household,
  type LedgerView,
  type HerculesNumberSource,
  type InstrumentId,
  type PersonalModuleOffer,
} from "./core/index.ts";
import { HerculesDress } from "./HerculesDress.tsx";
import { HerculesFigure } from "./HerculesFigure.tsx";
import { launchHerculesPro } from "./HerculesPro.tsx";
import { OnboardingChat } from "./OnboardingChat.tsx";
import {
  HerculesRigProvider,
  useHerculesRig,
  expandRigMacro,
  dispatchChatRigTriggers,
  dispatchHerculesRig,
  HUMAN_IDLE_FLY_CHASE_MS,
  IDLE_FLY_CAPTURE_AT_MS,
  IDLE_FLY_POUNCE_CLIP_ID,
  idleFlyPounceLanding,
  type HerculesRigPose,
} from "./herculesRig/index.ts";
import {
  HerculesFly,
  HerculesLitterBox,
  herculesInLitter,
  herculesLitterRect,
  herculesOverFly,
  keepHerculesOutOfLitter,
  wanderFly,
} from "./HerculesFly.tsx";

const HERCULES_WIDGET_PLACEHOLDER = "Ask me about this page.";

type WidgetSnippet = { role: "user" | "hercules"; text: string; placeholder?: boolean };

function dressedLook(household: Household, today: string, visorPop: boolean) {
  const view = describeCompanion(household, today);
  const season = kitchenSeason(today);
  return {
    view,
    hat: visorPop ? "visor" : view.equipped.hat || (season === "ruff" ? "ruff" : null),
    house: view.equipped.house || (season === "patio" ? "patio" : null),
    chain: view.equipped.chain,
    collar: view.equipped.collar,
  };
}

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

let personalOfferSessionSequence = 0;

function createPersonalOfferSessionId(): string {
  personalOfferSessionSequence += 1;
  return `HERCULES-${Date.now().toString(36)}-${personalOfferSessionSequence.toString(36)}`;
}

function furnitureLand(adding: boolean, mood: CompanionMood, today: string) {
  const furniture = listFurniture();
  const post = furniture.find((item) => item.id === "calculator-post");
  const phase = kettlePhase(today, hourInToronto());
  const land = perchTarget(
    furniture,
    mood,
    phase,
    adding,
    { w: window.innerWidth, h: window.innerHeight },
    post?.rect ?? null,
  );
  if (window.innerWidth < WIDE_BREAKPOINT) return land;
  return { ...land, ...keepHerculesOutOfLitter(land, { w: window.innerWidth, h: window.innerHeight }, CAT, NAV) };
}

export function HerculesPortrait({
  mood,
  hat,
  chain,
  house,
  collar,
  pose = "loaf",
  size = "live",
  flip = false,
  rigSnapshot,
  rigTransitionMs,
}: {
  mood: CompanionMood;
  hat: string | null;
  chain: string | null;
  house: string | null;
  collar: string | null;
  pose?: HerculesPose;
  size?: "stage" | "live" | number;
  flip?: boolean;
  rigSnapshot?: import("./herculesRig/types.ts").RigSnapshot;
  rigTransitionMs?: number;
}) {
  const wornLook=useWornLook();
  const px = typeof size === "number" ? size : size === "stage" ? 120 : 96;
  return (
    <div className={`hercules-stage size-${size} mood-${mood}`} aria-hidden="true">
      <HerculesFigure pose={pose} mood={mood} size={px} flip={flip} rigSnapshot={rigSnapshot} rigTransitionMs={rigTransitionMs} {...(wornLook?fittingLayers(wornLook):{})}>
        {!wornLook&&<HerculesDress hat={hat} chain={chain} house={house} collar={collar} />}
      </HerculesFigure>
      {pose === "sleep" && <span className="hercules-zzz">z</span>}
    </div>
  );
}

function HerculesRigBridge({
  mood,
  pose,
  begging,
  bagPlay,
  chatRigUntilRef,
}: {
  mood: CompanionMood;
  pose: HerculesPose;
  begging: boolean;
  bagPlay: boolean;
  chatRigUntilRef: MutableRefObject<number>;
}) {
  const { playPose, setMood } = useHerculesRig();
  const target = (bagPlay ? "bag" : begging ? "beg" : pose) as HerculesRigPose;
  useEffect(() => setMood(mood), [mood, setMood]);
  useEffect(() => {
    if (performance.now() < chatRigUntilRef.current) return;
    playPose(target);
  }, [target, playPose, chatRigUntilRef]);
  return null;
}

function HerculesLivePortrait(props: Parameters<typeof HerculesPortrait>[0]) {
  const { state } = useHerculesRig();
  return <HerculesPortrait {...props} rigSnapshot={state.parts} rigTransitionMs={state.transitionMs} />;
}

function HerculesOfficeRigBridge({ expandId }: { expandId: InstrumentId | "window" | null }) {
  const { dispatch } = useHerculesRig();
  useEffect(() => {
    if (!expandId) return;
    for (const command of expandRigMacro(expandId)) dispatch(command);
  }, [expandId, dispatch]);
  return null;
}

export function HerculesPresence({
  household,
  today,
  tab,
  adding,
  visorPop,
  spark,
  activityBlocked = false,
  memberId,
  view,
  onOpenAdd, onDiscoveryNavigate, discoveryAccountId, discoveryFund,
  onGo,
  onLedger, onCompanionCommand,
  onDraft, actionService, actionIdentity, actionHousehold,
  onPayCard,
  onAcceptPreset,
  onDismissNotice,
  onQuickPotentialExpense,
  onReviewPotentialExpense,
  onMovePotentialExpense,
  onRemovePotentialExpense,
  onOpenSource,
  onOpenCharter,
  onOpenAccounts,
  onOpenOpeningBalances,
  onOpenHouseholdFund,
  onOpenRecurrences,
  onOpenEarningCadence,
  onOpenCategories,
  onOpenEstimates,
  onOpenPlan,
  onOpenReady,
  setup,
}: {
  setup?: HerculesSetupProps;
  household: Household;
  today: string;
  tab: HearthTab;
  adding: boolean;
  visorPop?: boolean;
  spark?: boolean;
  /** Consequential sheets/palettes keep Hercules visible but pause autonomous work. */
  activityBlocked?: boolean;
  memberId: string;
  view: LedgerView;
  onDiscoveryNavigate?: (destination: DiscoveryDestination) => void;
  discoveryAccountId?: string | null;
  discoveryFund?: DiscoveryFund | null;
  onOpenAdd: (note?: string) => void;
  onGo: (tab: HearthTab) => void;
  onLedger: (fn: (current: Household) => CommitResult) => void;
  onCompanionCommand?: KitchenCommand;
  onDraft?: (draft: HerculesDraft) => void;
  actionService?: HerculesCommandService;
  actionIdentity?: string;
  actionHousehold?: Household;
  onPayCard?: () => void;
  onAcceptPreset?: (key: string, summary: string) => void;
  onDismissNotice?: (key: string) => void;
  onQuickPotentialExpense?: (planId: string) => void;
  onReviewPotentialExpense?: (planId: string) => void;
  onMovePotentialExpense?: (planId: string) => void;
  onRemovePotentialExpense?: (planId: string) => void;
  onOpenSource: (source: HerculesNumberSource) => void;
  onOpenCharter?: () => void;
  onOpenAccounts?: () => void;
  onOpenOpeningBalances?: (mode: "entry" | "correction") => void;
  onOpenHouseholdFund?: () => void;
  onOpenRecurrences?: () => void;
  onOpenEarningCadence?: () => void;
  onOpenCategories?: () => void;
  onOpenEstimates?: () => void;
  onOpenPlan?: () => void;
  onOpenReady?: () => void;
}) {
  const [setupSelected,setSetupSelected]=useState(false);
  const [documentVisible,setDocumentVisible]=useState(()=>!document.hidden);
  useEffect(()=>{const update=()=>setDocumentVisible(!document.hidden);document.addEventListener('visibilitychange',update);return()=>document.removeEventListener('visibilitychange',update);},[]);
  const contextHousehold = useMemo(
    () => householdForHerculesContext(household, memberId, view),
    [household, memberId, view],
  );
  const look = useMemo(() => dressedLook(household, today, Boolean(visorPop)), [household, today, visorPop]);
  const five = useMemo(() => groceryHighFive(household, today), [household, today]);
  const usefulness = useMemo(() => herculesUsefulness(household, today), [household, today]);

  const proposal = useMemo(() => bubbleNotice(household, today), [household, today]);
  const surface = useMemo(
    () => herculesPageSurface(adding ? "add" : tab, contextHousehold, today, new Date(), { memberId, view }),
    [adding, tab, contextHousehold, today, memberId, view],
  );
  const chatEnabled = import.meta.env.VITE_HERCULES_CHAT !== '0';
  const discoveryEnabled = import.meta.env.VITE_HERCULES_DISCOVERY !== '0';
  const [pos, setPos] = useState({ x: 12, y: 120 });
  const posRef = useRef(pos);
  posRef.current = pos;
  const [flip, setFlip] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [motion, setMotion] = useState<HerculesPose>("loaf");
  const [talk, setTalk] = useState<HerculesTalk | null>(null);
  const [open, setOpen] = useState(false);
  const [activePersonalOffer, setActivePersonalOffer] = useState<PersonalModuleOffer | null>(null);
  const [helpAsked, setHelpAsked] = useState(false);
  const [invitationDismissed, setInvitationDismissed] = useState(false);
  const [begging, setBegging] = useState(false);
  const [bagPlay, setBagPlay] = useState(false);
  const [question, setQuestion] = useState("");
  const actionRef=useRef<HerculesActionHandle>(null);
  const composerRef=useRef<HTMLTextAreaElement>(null);
  const modelPending=useRef<number|null>(null);
  const [chatExpanded,setChatExpanded]=useState(false);
  const [suggestedWorkflowIds,setSuggestedWorkflowIds]=useState<string[]>([]);
  const [shareWorkplaceRoster, setShareWorkplaceRoster] = useState(false);
  const [ephemeralWorkplaceTurn, setEphemeralWorkplaceTurn] = useState(false);
  const selectableWorkplaceCoworkerIds = useMemo(() => (household.coworkers ?? [])
    .filter((row) => row.active && row.ownerMemberId === memberId)
    .map((row) => row.id), [household.coworkers, memberId]);
  useEffect(() => {
    setShareWorkplaceRoster(false);
    setEphemeralWorkplaceTurn(false);
  }, [household.environment, household.householdId, memberId, view]);
  const [topic, setTopic] = useState("idle");
  const [purr, setPurr] = useState(false);
  const [turns, setTurns] = useState<HerculesChatTurn[]>(() =>
    companionConversation(household, memberId, view).turns.slice(-300).map((row) => ({ role: row.role, text: row.text })),
  );
  const [privateSaveStatus, setPrivateSaveStatus] = useState("");
  const [privateSaving, setPrivateSaving] = useState(false);
  const privateSavingRef = useRef(false);
  const pendingExchange = useRef<CompanionIntentV1[] | null>(null);
  const preferenceBefore = useRef(new Map<string, CompanionPreferenceValue | null>());
  const attemptedPrivate = useRef(new Set<string>());
  const privateDrafts = useRef(new Map<string, { pending: CompanionIntentV1[]; before: Map<string, CompanionPreferenceValue | null>; attempted: Set<string>; question: string }>());
  const [preferenceUndo, setPreferenceUndo] = useState<CompanionOperation | null>(null);
  const [focusedWidget, setFocusedWidget] = useState<InstrumentId | "window" | null>(null);
  const [snippets, setSnippets] = useState<WidgetSnippet[]>([]);
  const [busy, setBusy] = useState(false);
  const [replyProvider, setReplyProvider] = useState<HerculesChatProvider | null>(null);
  const [fly, setFly] = useState<{ x: number; y: number } | null>(null);
  const flyRef = useRef<{ x: number; y: number } | null>(fly);
  flyRef.current = fly;
  const [desktopFly, setDesktopFly] = useState(() => typeof window !== "undefined" && window.innerWidth >= WIDE_BREAKPOINT);
  const [mobileFocus, setMobileFocus] = useState(false);
  const phoneShell = !desktopFly;
  const [deadFlies, setDeadFlies] = useState(0);
  const [flyPouncing, setFlyPouncing] = useState(false);
  const [perchPlay, setPerchPlay] = useState(false);
  const perchPlayFor = useRef<string | null>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number; moved: boolean; lastX: number; lastY: number; caughtFly: boolean } | null>(null);


  const idleAt = useRef(0);

  const chatGen = useRef(0);
  const chatRigUntilRef = useRef(0);
  const chatRigTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conversationGeneration = companionConversation(household, memberId, view).generation;
  const chatScope = `${household.environment}\u001f${household.householdId}\u001f${memberId}\u001f${view}\u001f${conversationGeneration}`;
  const privateEpoch = useRef(0), observedPrivateScope = useRef(chatScope);
  if (observedPrivateScope.current !== chatScope) { observedPrivateScope.current = chatScope; privateEpoch.current += 1; }
  const personalOfferSessionId = useMemo(createPersonalOfferSessionId, [chatScope]);
  const activeMemberPresent = useMemo(
    () => household.members.some((member) => member.active && member.id === memberId),
    [household.members, memberId],
  );
  useEffect(() => {
    setActivePersonalOffer(null);
  }, [chatScope, activeMemberPresent]);
  const previousChatScope = useRef(chatScope);
  useEffect(() => () => { previousChatScope.current = "closed"; privateEpoch.current += 1; privateDrafts.current.clear(); chatGen.current += 1; modelPending.current=null; if (chatRigTimer.current) clearTimeout(chatRigTimer.current); }, []);
  // Receipt/replica revisions also advance for private chat saves. Compare the
  // scoped source inputs instead, without persisting or transmitting this key.
  const sourceBasis = useMemo(() => {
    const { revision, baseRevision, booksAcceptedHash, lastCommittedAt, activity, commandReceipts,
      companionProfile, companionGallery, devices, conflicts, restorePoints, sharing, google,
      herculesProPermissions, kitchen, ...sources } = contextHousehold;
    return JSON.stringify({ ...sources, kitchen: { books: kitchen.books, openShift: kitchen.openShift, openShifts: kitchen.openShifts } });
  }, [contextHousehold]);
  const replyBasis = `${today}:${tab}:${adding}:${sourceBasis}`;
  const priorReplyBasis = useRef(replyBasis);
  useEffect(() => {
    if (priorReplyBasis.current === replyBasis) return; priorReplyBasis.current = replyBasis;
    if (!busy) return;
    chatGen.current += 1; modelPending.current=null; setBusy(false); setReplyProvider(null);
    const message = "The page or books changed while I was answering. Ask again and I’ll use the current view.";
    setTalk({ ...surface, spoken: message, lesson: null, fact: null, facts: [], replies: [], pose: "loaf", topic: "updated", attention: false });
    setTurns(previous => [...previous, { role: "hercules" as const, text: message }].slice(-300));
  }, [replyBasis]);
  const activeChatIdentity = useRef<Omit<HerculesReplyContext, "requestId">>({
    environment: household.environment,
    householdId: household.householdId,
    memberId, view, conversationGeneration, basis: replyBasis,
  });
  activeChatIdentity.current = {
    environment: household.environment,
    householdId: household.householdId,
    memberId, view, conversationGeneration, basis: replyBasis,
  };
  const logRef = useRef<HTMLDivElement | null>(null);
  const perchedOn = useRef<string | null>(null);
  const lastAttack = useRef(0);
  const idlePounceAction = useRef<() => boolean>(() => false);
  const idlePounceCaptureTimer = useRef<number | null>(null);
  const idleCaptureAllowed = useRef(false);
  const lastBump = useRef<{ id: string; at: number } | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const [bubbleSize, setBubbleSize] = useState({ w: 228, h: 96 });
  const showProposal = Boolean(proposal?.potentialExpenseId && !adding && !activityBlocked && !setupSelected);
  const showWidgetSnippets = Boolean(open && !setupSelected && tab === "home" && focusedWidget && !adding && !(phoneShell && mobileFocus));
  const showTalk = Boolean(open && !setupSelected && !adding && talk && !(proposal && !open && !begging) && !showWidgetSnippets);
  const hideLiveCat = phoneShell && !mobileFocus;
  const focusShellOpen = phoneShell && mobileFocus && !adding && !setupSelected;
  const focusDialogRef = useDialog(focusShellOpen, closeChat, () => document.querySelector<HTMLButtonElement>(".hercules-pill"));
  useEffect(()=>{const input=composerRef.current;if(input){input.style.height="auto";input.style.height=`${Math.min(160,input.scrollHeight)}px`;}},[question,open,phoneShell]);
  useEffect(()=>{if(open&&!phoneShell)composerRef.current?.focus();},[open,phoneShell]);
  const [phoneViewport,setPhoneViewport]=useState<{height:number;top:number}|null>(null);
  useEffect(()=>{
    if(!focusShellOpen||!window.visualViewport){setPhoneViewport(null);return;}
    const viewport=window.visualViewport;
    const update=()=>setPhoneViewport({height:viewport.height,top:viewport.offsetTop});
    update();viewport.addEventListener('resize',update);viewport.addEventListener('scroll',update);
    return()=>{viewport.removeEventListener('resize',update);viewport.removeEventListener('scroll',update);};
  },[focusShellOpen]);
  const householdOnboardingShellActive = useMemo(
    () => activeMemberPresent && shouldShowOnboardingShell(household, memberId),
    [activeMemberPresent, household, memberId],
  );
  const personalOffer = useMemo(() => activeMemberPresent ? personalModuleOfferFor(household, memberId, {
    now: new Date().toISOString(),
    sessionId: personalOfferSessionId,
    isDesktop: desktopFly,
  }) : null, [activeMemberPresent, household, memberId, personalOfferSessionId, desktopFly]);
  const personalOfferRecorded = useMemo(() => Boolean(activeMemberPresent && activePersonalOffer && memberProgress(household, memberId)
    .personalOfferHistory.some((row) => row.sessionId === personalOfferSessionId
      && row.moduleId === activePersonalOffer.module.id)), [activeMemberPresent, activePersonalOffer, household, memberId, personalOfferSessionId]);
  const onboardingShellActive = activeMemberPresent
    && (householdOnboardingShellActive || Boolean(activePersonalOffer));
  // Slice 9: which chapter's navigate action (if any) this conductor should
  // be offered right now, and whatever return instruction this phone is
  // still carrying for this household from a previous "Open {surface}" tap.
  // Both are read fresh every render — nothing here is client state that
  // could drift from what nextChapterFor would say on a reload.
  const navTarget = useMemo(
    () => (householdOnboardingShellActive ? onboardingNavigationTarget(household, memberId) : null),
    [householdOnboardingShellActive, household, memberId],
  );
  // Desktop has no mobile-style focus-mode modal to swap into
  // (focusShellOpen requires phoneShell). "No new desktop surface" means
  // this reuses the same chat bubble desktop already opens on tap — only
  // what renders inside it changes while onboarding has the floor.
  const desktopOnboardingOpen = Boolean(!setup && !phoneShell && open && onboardingShellActive);
  const modalActive=useModalActive(focusDialogRef);
  const rigBlocked = adding || activityBlocked || modalActive;
  const autonomyBlocked = rigBlocked || focusShellOpen;
  const homeAutonomy = tab === "home" && !autonomyBlocked && documentVisible && !open && !setupSelected && !reducedMotion();
  idleCaptureAllowed.current = !(
    typeof document === "undefined"
    || document.hidden
    || !desktopFly
    || !homeAutonomy
    || pinned
    || open
    || mobileFocus
    || focusedWidget
    || showProposal
    || drag.current
    || reducedMotion()
  );

  function catchFly(expected = flyRef.current): boolean {
    const current = flyRef.current;
    if (!desktopFly || !current || !expected || current.x !== expected.x || current.y !== expected.y) return false;
    setDeadFlies((count) => count + 1);
    const viewport = { w: window.innerWidth, h: window.innerHeight };
    const next = wanderFly(viewport, NAV, Math.random, herculesLitterRect(viewport, NAV));
    flyRef.current = next;
    setFly(next);
    return true;
  }

  function automaticPoint(point: { x: number; y: number }): { x: number; y: number } {
    if (!desktopFly) return point;
    return keepHerculesOutOfLitter(point, { w: window.innerWidth, h: window.innerHeight }, CAT, NAV);
  }

  idlePounceAction.current = () => {
    const targetFly = flyRef.current;
    if (
      document.hidden
      || !desktopFly
      || !targetFly
      || !homeAutonomy
      || pinned
      || open
      || mobileFocus
      || focusedWidget
      || showProposal
      || drag.current
      || reducedMotion()
    ) return false;
    const viewport = { w: window.innerWidth, h: window.innerHeight };
    const landing = automaticPoint(idleFlyPounceLanding(pos, targetFly, viewport, CAT, NAV));
    lastAttack.current = Date.now();
    setFlyPouncing(true);
    setFlip(landing.x >= pos.x);
    setPos(landing);
    dispatchHerculesRig({ type: "playClip", clipId: IDLE_FLY_POUNCE_CLIP_ID, loop: false });
    if (idlePounceCaptureTimer.current != null) window.clearTimeout(idlePounceCaptureTimer.current);
    idlePounceCaptureTimer.current = window.setTimeout(() => {
      idlePounceCaptureTimer.current = null;
      setFlyPouncing(false);
      const currentFly = flyRef.current;
      if (!document.hidden && idleCaptureAllowed.current && currentFly && herculesOverFly(landing, currentFly, CAT)) catchFly(currentFly);
    }, IDLE_FLY_CAPTURE_AT_MS);
    return true;
  };

  useEffect(() => {
    if (!homeAutonomy || !desktopFly || reducedMotion()) return;
    let timer: number | null = null;
    let usedThisIdlePeriod = false;
    let lastPointerMoveAt = 0;
    const clear = () => {
      if (timer != null) window.clearTimeout(timer);
      timer = null;
    };
    const schedule = (delay = HUMAN_IDLE_FLY_CHASE_MS) => {
      clear();
      if (document.hidden || usedThisIdlePeriod || !desktopFly || reducedMotion()) return;
      timer = window.setTimeout(() => {
        timer = null;
        if (idlePounceAction.current()) {
          usedThisIdlePeriod = true;
          return;
        }
        schedule(1_000);
      }, delay);
    };
    const markHumanActivity = () => {
      if (idlePounceCaptureTimer.current != null) {
        window.clearTimeout(idlePounceCaptureTimer.current);
        idlePounceCaptureTimer.current = null;
        setFlyPouncing(false);
      }
      usedThisIdlePeriod = false;
      schedule();
    };
    const onPointerMove = () => {
      const now = Date.now();
      if (now - lastPointerMoveAt < 750) return;
      lastPointerMoveAt = now;
      markHumanActivity();
    };
    const onVisibility = () => {
      if (document.hidden) {
        clear();
        if (idlePounceCaptureTimer.current != null) window.clearTimeout(idlePounceCaptureTimer.current);
        idlePounceCaptureTimer.current = null;
        setFlyPouncing(false);
      } else markHumanActivity();
    };
    window.addEventListener("pointerdown", markHumanActivity, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("keydown", markHumanActivity);
    window.addEventListener("wheel", markHumanActivity, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    schedule();
    return () => {
      clear();
      if (idlePounceCaptureTimer.current != null) window.clearTimeout(idlePounceCaptureTimer.current);
      idlePounceCaptureTimer.current = null;
      window.removeEventListener("pointerdown", markHumanActivity);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("keydown", markHumanActivity);
      window.removeEventListener("wheel", markHumanActivity);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [desktopFly, homeAutonomy]);

  useLayoutEffect(() => {
    const node = bubbleRef.current;
    if (!node) return;
    const measure = () => {
      const next = { w: Math.ceil(node.offsetWidth), h: Math.ceil(node.offsetHeight) };
      setBubbleSize(prev => Math.abs(prev.w - next.w) < 2 && Math.abs(prev.h - next.h) < 2 ? prev : next);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure); observer.observe(node);
    return () => observer.disconnect();
  }, [showProposal, showTalk, showWidgetSnippets, talk?.spoken, proposal?.spoken, open, turns.length, snippets.length, busy, desktopOnboardingOpen]);

  useEffect(() => {
    const next = furnitureLand(adding, look.view.mood, today);
    perchedOn.current = next.on;
    setFlip(next.faceRight);
    setPos({ x: next.x, y: next.y });
    setMotion(adding ? "loaf" : five.yes || spark ? "jump" : next.pose === "loaf" ? "walk" : next.pose);
    setPerchPlay(false);
    perchPlayFor.current = null;
    if (reducedMotion()) {
      setMotion(adding ? "loaf" : five.yes || spark ? "celebrate" : next.pose);
      return;
    }
    const land = window.setTimeout(() => setMotion(five.yes || spark ? "celebrate" : look.view.mood === "hiding" ? "hide" : look.view.mood === "restless" ? "pace" : next.pose), 900);
    return () => window.clearTimeout(land);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hop on room change, not every pos tick
  }, [tab, adding, look.view.mood, five.yes, spark, today]);

  useEffect(() => {
    const onResize = () => {
      setDesktopFly(window.innerWidth >= WIDE_BREAKPOINT);
      // Keep the whole launcher reachable after a narrower or shorter viewport.
      setPos(current => ({
        x: Math.max(4, Math.min(window.innerWidth - CAT - 4, current.x)),
        y: Math.max(4, Math.min(window.innerHeight - CAT - NAV, current.y)),
      }));
    };
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!homeAutonomy || reducedMotion() || !desktopFly) {
      setFly(null);
      return;
    }
    const hop = () => {
      const viewport = { w: window.innerWidth, h: window.innerHeight };
      setFly(wanderFly(viewport, NAV, Math.random, herculesLitterRect(viewport, NAV)));
    };
    hop();
    const id = window.setInterval(hop, 2800);
    return () => window.clearInterval(id);
  }, [homeAutonomy, desktopFly]);

  useEffect(() => {
    if (!homeAutonomy) return;
    return subscribeOfficeIntent((intent) => {
      if (intent.type === "collapse") {
        setPerchPlay(false);
        perchPlayFor.current = null;
        setFocusedWidget(null);
        setSnippets([]);
        setOpen(false);
        setTalk(null);
        setTurns([]);
        return;
      }
      if (intent.type !== "expand" || autonomyBlocked) return;
      if (perchPlayFor.current && perchPlayFor.current !== intent.id) {
        setPerchPlay(false);
      }
      const furniture = listFurniture();
      const item = furniture.find((row) => row.id === intent.id)
        ?? (intent.id === "chalkboard" ? furniture.find((row) => row.id === "window") : null);
      if (item) {
        const land = perchOnFurniture(item, { w: window.innerWidth, h: window.innerHeight });
        perchedOn.current = land.on;
        setFlip(land.faceRight);
        setPos(automaticPoint({ x: land.x, y: land.y }));
        setPerchPlay(!reducedMotion());
        perchPlayFor.current = intent.id;
      }
      setFocusedWidget(intent.id);
      setSnippets([{ role: "hercules", text: HERCULES_WIDGET_PLACEHOLDER, placeholder: true }]);
      setOpen(false);
      setTalk(null);
      setTopic(intent.id);
      setBegging(false);
      const surface = herculesInstrumentSurface(intent.id, contextHousehold, today);
      setMotion(surface.pose);
    });
  }, [contextHousehold, today, autonomyBlocked, homeAutonomy]);

  useEffect(() => {
    if (visorPop) {
      setMotion("jump");
      const id = window.setTimeout(() => setMotion("celebrate"), 700);
      return () => window.clearTimeout(id);
    }
  }, [visorPop]);

  useEffect(() => {
    if (!homeAutonomy || open || pinned || drag.current) return;
    const pending = new Set<number>();
    const later = (callback: () => void, delay: number) => {
      const timer = window.setTimeout(() => {
        pending.delete(timer);
        callback();
      }, delay);
      pending.add(timer);
    };
    const id = window.setInterval(() => {
      idleAt.current += 1;
      const phase = idleAt.current % 6;
      const here = posRef.current;
      if (look.view.mood === "restless") {
        setMotion("pace");
        const next = furnitureLand(false, look.view.mood, today);
        perchedOn.current = next.on;
        setFlip(next.x === here.x ? next.faceRight : next.x > here.x);
        setPos({ x: next.x, y: next.y });
        return;
      }
      if (look.view.mood === "hiding") {
        const prey = attackTarget(listFurniture());
        if (prey?.id === "lamp" && Date.now() - lastAttack.current > 90_000) {
          lastAttack.current = Date.now();
          perchedOn.current = prey.id;
          const stand = attackStand(prey, here, { w: window.innerWidth, h: window.innerHeight });
          setMotion("attack");
          setFlip(stand.faceRight);
          setPos(automaticPoint({ x: stand.x, y: stand.y }));
          return;
        }
        setMotion("hide");
        return;
      }
      const prey = attackTarget(listFurniture());
      if (prey && prey.id !== "lamp" && Date.now() - lastAttack.current > 90_000) {
        lastAttack.current = Date.now();
        perchedOn.current = prey.id;
        const stand = attackStand(prey, here, { w: window.innerWidth, h: window.innerHeight });
        setMotion("attack");
        setFlip(stand.faceRight);
        setPos(automaticPoint({ x: stand.x, y: stand.y }));
        return;
      }
      if (phase === 0 || phase === 3) {
        setMotion("walk");
        const next = furnitureLand(false, look.view.mood, today);
        const path = walkPath(here, { x: next.x, y: next.y }, listFurniture());
        const hit = walkHits(here, { x: next.x, y: next.y }, listFurniture())[0];
        if (path.length > 2 && hit) emitOfficeIntent({ type: "bump", id: hit.id });
        perchedOn.current = next.on;
        setFlip(next.x === here.x ? next.faceRight : next.x > here.x);
        setPos({ x: next.x, y: next.y });
        const landing = look.view.mood === "glowing" || look.view.mood === "content"
          ? (next.on === "chalkboard" || next.on === "wallet" ? "lick" : next.pose)
          : next.pose;
        if (reducedMotion()) {
          setMotion(landing);
        } else {
          later(() => setMotion(landing), 950);
        }
      } else if (phase === 1) setMotion(look.view.mood === "glowing" || look.view.mood === "content" ? "lick" : "wash");
      else if (phase === 2) setMotion("stretch");
      else if (phase >= 4 && look.view.mood === "glowing") setMotion("sleep");
      else setMotion("perch");
    }, 9000);
    return () => {
      window.clearInterval(id);
      for (const timer of pending) window.clearTimeout(timer);
    };
  }, [homeAutonomy, open, pinned, look.view.mood, today]);

  useEffect(() => {
    if (!homeAutonomy) return;
    return subscribeFurniture(() => {
      if (pinned || autonomyBlocked || open || drag.current) return;
      const on = perchedOn.current;
      if (!on) return;
      const item = listFurniture().find((row) => row.id === on);
      if (!item) {
        const next = furnitureLand(false, look.view.mood, today);
        perchedOn.current = next.on;
        setPos({ x: next.x, y: next.y });
        setMotion(next.pose);
        return;
      }
      setPos((current) => automaticPoint({
        x: current.x,
        y: Math.max(6, item.rect.y - CAT + 12),
      }));
    });
  }, [homeAutonomy, pinned, autonomyBlocked, open, look.view.mood, today]);


  useEffect(() => {
    const log = logRef.current;
    if (typeof log?.scrollTo === "function") log.scrollTo({ top: log.scrollHeight });
  }, [turns, busy]);

  useEffect(() => {
    if (previousChatScope.current === chatScope) return;
    const prior = previousChatScope.current, identity = chatScope.split("\u001f").slice(0, 3).join("\u001f");
    if (prior.split("\u001f").slice(0, 3).join("\u001f") !== identity) privateDrafts.current.clear();
    else if (prior.split("\u001f")[3] !== view) privateDrafts.current.set(prior, { pending: pendingExchange.current ?? [], before: new Map(preferenceBefore.current), attempted: new Set(attemptedPrivate.current), question });
    for (const key of privateDrafts.current.keys()) if (key.startsWith(`${identity}\u001f${view}\u001f`) && key !== chatScope) privateDrafts.current.delete(key);
    const draft = privateDrafts.current.get(chatScope); privateDrafts.current.delete(chatScope);
    previousChatScope.current = chatScope;
    chatGen.current += 1; modelPending.current=null;
    chatRigUntilRef.current = 0;
    if (chatRigTimer.current) clearTimeout(chatRigTimer.current);
    dispatchHerculesRig({ type: "clearOverrides" });
    setBusy(false);
    setReplyProvider(null);
    setQuestion(draft?.question ?? "");
    setTalk(null);
    pendingExchange.current = draft?.pending.length ? trimCompanionPending(draft.pending) : null;
    if (!pendingExchange.current?.length) pendingExchange.current = null;
    preferenceBefore.current = draft?.before ?? new Map(); attemptedPrivate.current = draft?.attempted ?? new Set(); setPreferenceUndo(null);
    setPrivateSaving(false);
    privateSavingRef.current = false;
    setPrivateSaveStatus(pendingExchange.current ? "Your unsaved conversation is here. Retry when connected." : "");
    const restored = companionConversation(conversationHousehold(), memberId, view).turns.slice(-300).map(row => ({ role: row.role, text: row.text }));
    setTurns(restored);
    const lastReply = [...restored].reverse().find(row => row.role === "hercules");
    if (lastReply) setTalk({ spoken: lastReply.text, lesson: null, fact: null, facts: [], replies: [], pose: "loaf", topic: "conversation", attention: false });
    setSnippets(focusedWidget
      ? [{ role: "hercules", text: HERCULES_WIDGET_PLACEHOLDER, placeholder: true }]
      : []);
  }, [chatScope, focusedWidget, household]);

  useEffect(() => {
    if (busy || pendingExchange.current || ephemeralWorkplaceTurn) return;
    setTurns(companionConversation(household, memberId, view).turns.slice(-300).map((row) => ({ role: row.role, text: row.text })));
  }, [household, busy]);

  async function savePrivateExchange(_retry?: CompanionIntentV1[]) {
    if (privateSavingRef.current) return;
    const intents = trimCompanionPending(pendingExchange.current ?? []);
    pendingExchange.current = intents.length ? intents : null;
    if (!intents.length) { setPrivateSaveStatus("Older unsaved messages expired. Start a fresh conversation."); return; }
    privateSavingRef.current = true;
    let failed = false, remembered = false, discardedPreference = false, undone = false;
    const started = chatScope, epoch = privateEpoch.current;
    setPrivateSaving(true); setPrivateSaveStatus("Saving this conversation…");
    try {
      if (!onCompanionCommand) throw new Error("unavailable");
      for (const id of [...new Set(intents.map(row => row.id))]) {
        const group = intents.filter(row => row.id === id);
        const intent = group[0]!;
        let definitivelyRejected = false, recovered = false;
        const recovering = attemptedPrivate.current.has(intent.id); attemptedPrivate.current.add(intent.id);
        const outcome = await onCompanionCommand(current => {
          let result = commitCompanion(current, group[0]!);
          for (const item of group.slice(1)) result = commitCompanion(result.household, item);
          return result;
        }, { confirmationId: intent.id, recoverConfirmation: recovering, onRecoveredConfirmation: () => { recovered = true; }, onDefinitiveRejected: () => { definitivelyRejected = true; } });
        if (previousChatScope.current !== started || privateEpoch.current !== epoch) return;
        if (!recovered && (!outcome?.ok || outcome.kind !== "synchronized") && !(definitivelyRejected && (intent.operation.kind === "preference.set" || intent.operation.kind === "preference.forget"))) throw new Error("unconfirmed");
        if (outcome?.ok && outcome.kind === "synchronized" && intent.operation.kind === "preference.set" && intent.operation.origin.kind === "conversation") {
          remembered = true;
          const op = intent.operation, previous = preferenceBefore.current.get(intent.id) ?? null;
          setPreferenceUndo(previous === null ? { kind: "preference.forget", key: op.key, expectedRevision: op.expectedRevision + 1 } : { kind: "preference.set", key: op.key, value: previous, expectedRevision: op.expectedRevision + 1, origin: { kind: "manual" } });
        }
        if (definitivelyRejected && (intent.operation.kind === "preference.set" || intent.operation.kind === "preference.forget")) discardedPreference = true;
        if ((outcome?.ok || recovered) && (intent.operation.kind === "preference.forget" || (intent.operation.kind === "preference.set" && intent.operation.origin.kind === "manual"))) { undone = true; setPreferenceUndo(null); }
        attemptedPrivate.current.delete(intent.id);
        preferenceBefore.current.delete(intent.id);
        pendingExchange.current = pendingExchange.current?.filter(row => row.id !== intent.id) ?? null;
      }
      if (!pendingExchange.current?.length) pendingExchange.current = null;
      setPrivateSaveStatus(discardedPreference ? "The preference changed before saving; your last preference change was not applied. Review the current choices below." : undone ? "Preference change saved." : remembered ? "Remembered for you. You can undo this below." : "Conversation saved privately.");
    } catch {
      failed = true;
      if (previousChatScope.current === started && privateEpoch.current === epoch) setPrivateSaveStatus("This conversation's save is not confirmed. Reconnect and retry.");
    } finally {
      if (previousChatScope.current === started && privateEpoch.current === epoch) {
        privateSavingRef.current = false; setPrivateSaving(false);
        if (!failed && pendingExchange.current?.length) void savePrivateExchange();
      }
    }
  }

  function keepTalk(userText: string | undefined, herculesText: string, _source: "journal" | "memory" | "local" | "ai", _memory?: unknown, ephemeral = false, facts: HerculesTalk["facts"] = []) {
    if (!chatEnabled || ephemeral) return;
    if ((pendingExchange.current?.length ?? 0) >= 60) { setPrivateSaveStatus("The unsaved conversation is full. You can keep chatting; retry saving before keeping more messages."); return; }
    const profile = companionFor(household, memberId);
    const generation = profile.conversations.find(row => row.view === view)!.generation;
    const userId = crypto.randomUUID();
    const messages = [...(userText ? [{ id: userId, role: "user" as const, text: userText }] : []), { id: crypto.randomUUID(), role: "hercules" as const, text: herculesText }];
    const references: CompanionSourceReference[] = [];
    for (const fact of facts ?? []) {
      for (const [kind, id] of [["account", fact.source.accountId], ["transaction", fact.source.transactionId], ["goal", fact.source.goalId], ["shift", fact.source.shiftId]] as const) {
        if (id && !references.some(row => row.kind === kind && row.id === id)) references.push({ kind, id });
      }
    }
    const exchangeId = crypto.randomUUID();
    const intents: CompanionIntentV1[] = messages.map(row => ({ version: 1, id: exchangeId, scope: profile.scope,
      operation: { kind: "conversation.append", view, generation, turn: { ...row, text: row.text.slice(0, 6000), createdAt: new Date().toISOString(), sourceReferences: row.role === "hercules" ? references.slice(0, 20) : [] } } }));
    const candidate = userText && profile.remembering.enabled ? explicitCompanionPreference(userText) : null;
    const stored = candidate ? profile.preferences.find(row => row.key === candidate.key) : undefined;
    const queued = candidate ? [...(pendingExchange.current ?? [])].reverse().map(row => row.operation).find(op => (op.kind === "preference.set" || op.kind === "preference.forget") && op.key === candidate.key) : undefined;
    const existing = queued && (queued.kind === "preference.set" || queued.kind === "preference.forget") ? { revision: queued.expectedRevision + 1, value: queued.kind === "preference.set" ? queued.value : null } : stored;
    if (candidate && JSON.stringify(existing?.value) !== JSON.stringify(candidate.value)) intents.push({ version: 1, id: crypto.randomUUID(), scope: profile.scope,
      operation: { kind: "preference.set", ...candidate, expectedRevision: existing?.revision ?? 0, origin: { kind: "conversation", view, generation, rememberingRevision: profile.remembering.revision, sourceTurnId: userId } } });
    for (const intent of intents) if (intent.operation.kind === "preference.set") preferenceBefore.current.set(intent.id, existing?.value ?? null);
    pendingExchange.current = [...(pendingExchange.current ?? []), ...intents];
    void savePrivateExchange();
  }

  function conversationHousehold(): Household {
    const profile = companionFor(household, memberId);
    const partition = profile.conversations.find(row => row.view === view)!;
    const known = new Set(partition.turns.map(row => row.id));
    for (const intent of pendingExchange.current ?? []) {
      const op = intent.operation;
      if (intent.scope.environment === household.environment && intent.scope.householdId === household.householdId && intent.scope.memberId === memberId
        && op.kind === "conversation.append" && op.view === view && op.generation === partition.generation && !known.has(op.turn.id)) {
        partition.turns.push(op.turn); known.add(op.turn.id);
      }
    }
    partition.turns = partition.turns.slice(-300);
    return { ...household, companionProfile: profile };
  }

  function undoRememberedPreference() {
    if (!preferenceUndo) return;
    const intent: CompanionIntentV1 = { version: 1, id: crypto.randomUUID(), scope: companionFor(household, memberId).scope, operation: preferenceUndo };
    setPreferenceUndo(null); pendingExchange.current = [...(pendingExchange.current ?? []), intent]; void savePrivateExchange();
  }

  function preferenceTurn(text: string): boolean {
    if (!explicitCompanionPreference(text) && !/^(?:forget\b|remember\b|what (?:do you|did you) remember|what have you remembered)/i.test(text)) return false;
    const candidate = explicitCompanionPreference(text);
    if (/^forget\b/i.test(text)) {
      const priorPreference = [...turns].reverse().filter(turn => turn.role === "user").map(turn => explicitCompanionPreference(turn.text)).find(Boolean);
      const queued = [...(pendingExchange.current ?? [])].reverse().map(row => row.operation).find(op => op.kind === "preference.set" || op.kind === "preference.forget");
      const key = priorPreference?.key ?? (queued && (queued.kind === "preference.set" || queued.kind === "preference.forget") ? queued.key : undefined);
      if (key && /^forget (?:that|this)(?: preference)?[.! ]*$/i.test(text.trim())) {
        if ((pendingExchange.current?.length ?? 0) >= 60) { setPrivateSaveStatus("The unsaved conversation is full. Retry saving, then ask me to forget this preference again. I have not applied this request."); return true; }
        const profile = companionFor(household, memberId), previous = profile.preferences.find(row => row.key === key);
        const last = [...(pendingExchange.current ?? [])].reverse().map(row => row.operation).find(op => (op.kind === "preference.set" || op.kind === "preference.forget") && op.key === key);
        const expectedRevision = last && (last.kind === "preference.set" || last.kind === "preference.forget") ? last.expectedRevision + 1 : previous?.revision ?? 0;
        const answer = "I’ll ask to forget that preference. It is not forgotten until the save is confirmed.";
        applyTalk({ ...surface, spoken: answer, lesson: null, replies: [], pose: "loaf", topic: "preferences", attention: false } as HerculesTalk, text);
        keepTalk(text, answer, "local");
        pendingExchange.current = [...(pendingExchange.current ?? []), { version: 1, id: crypto.randomUUID(), scope: profile.scope, operation: { kind: "preference.forget", key, expectedRevision } }];
        setPreferenceUndo(null); setReplyProvider(null); void savePrivateExchange(); return true;
      }
    }
    const answer = /^forget\b/i.test(text) ? "You can choose exactly what to forget under ‘What Hercules remembers’ below. Use Forget beside that preference; I have not removed anything yet." : candidate
      ? "Of course. I can do that. You can review your preferences under ‘What Hercules remembers’."
      : "I remember a few helpful preferences, like how you like explanations or your favourite colour. You can choose them under ‘What Hercules remembers’.";
    const next = { ...surface, spoken: answer, lesson: null, replies: [], pose: "loaf" as const, topic: "preferences", attention: false } as HerculesTalk;
    applyTalk(next, text); keepTalk(text, answer, "local"); setReplyProvider(null); return true;
  }

  function isWideDesk(): boolean {
    return typeof window !== "undefined" && window.innerWidth >= WIDE_BREAKPOINT;
  }

  function directToCalendar(): void {
    if (isWideDesk()) {
      requestCalendarPane("board", localStorage);
      emitOfficeIntent({ type: "expand", id: "calendar" });
    }
    onGo("calendar");
  }

  function currentInstrument(): InstrumentId | "window" | null {
    if (isInstrumentId(topic) || topic === "window") return topic;
    if (perchPlayFor.current && (isInstrumentId(perchPlayFor.current) || perchPlayFor.current === "window")) {
      return perchPlayFor.current;
    }
    return null;
  }

  function applyHelpNav(command: ReturnType<typeof matchHelpCommand>): void {
    if (!command) return;
    if (command.expand) emitOfficeIntent({ type: "expand", id: command.expand });
    if (command.go === "calendar") directToCalendar();
    else if (command.go) onGo(command.go);
  }

  function closeChat() {
    setSetupSelected(false);
    chatGen.current += 1; modelPending.current=null;
    setOpen(false);
    setHelpAsked(false);
    setTalk(null);
    setBusy(false);
    setQuestion("");
    setBegging(false);
    setReplyProvider(null);
    setShareWorkplaceRoster(false);
    setEphemeralWorkplaceTurn(false);
    setActivePersonalOffer(null);
    setTurns([]);
    if (phoneShell) setMobileFocus(false);
    if (focusedWidget) {
      setSnippets([{ role: "hercules", text: HERCULES_WIDGET_PLACEHOLDER, placeholder: true }]);
    } else {
      setSnippets([]);
    }
  }

  // Slice 9: "a chapter's navigation button calls onGo(target.tab), closes
  // chat, and leaves a persistent instruction" (ONBOARDING_BUILD_MANUAL.md).
  // onGo is the existing prop this component has always had — nothing new
  // is threaded in to make this call; the only new thing is that this call
  // site now also records, phone-locally, which chapter sent the member
  // away, so activeReturnMessage can keep showing the instruction until
  // that chapter's own probe (nextChapterFor moving past it) says otherwise.
  function publishReturnMessage(record: Parameters<typeof saveReturnMessage>[0]) {
    saveReturnMessage(record);
  }

  function goToOnboardingTarget() {
    if (!navTarget) return;
    onGo(navTarget.target.tab);
    closeChat();
    publishReturnMessage({
      environment: household.environment,
      householdId: household.householdId,
      memberId,
      chapterId: navTarget.chapterId,
      tab: navTarget.target.tab,
      setAt: new Date().toISOString(),
    });
  }

  function openOnboardingCharter() {
    if (!onOpenCharter || navTarget?.chapterId !== "ch-03-charter") return;
    closeChat();
    publishReturnMessage({
      environment: household.environment,
      householdId: household.householdId,
      memberId,
      chapterId: navTarget.chapterId,
      tab: navTarget.target.tab,
      setAt: new Date().toISOString(),
    });
    onOpenCharter();
  }

  function openOnboardingAccounts() {
    if (!onOpenAccounts || navTarget?.chapterId !== "ch-04-accounts") return;
    closeChat();
    publishReturnMessage({
      environment: household.environment,
      householdId: household.householdId,
      memberId,
      chapterId: navTarget.chapterId,
      tab: navTarget.target.tab,
      setAt: new Date().toISOString(),
    });
    onOpenAccounts();
  }

  function openOnboardingOpeningBalances(mode: "entry" | "correction") {
    if (!onOpenOpeningBalances || navTarget?.chapterId !== "ch-05-opening") return;
    closeChat();
    publishReturnMessage({
      environment: household.environment,
      householdId: household.householdId,
      memberId,
      chapterId: navTarget.chapterId,
      tab: navTarget.target.tab,
      setAt: new Date().toISOString(),
    });
    onOpenOpeningBalances(mode);
  }

  function openOnboardingHouseholdFund() {
    if (!onOpenHouseholdFund || navTarget?.chapterId !== "ch-06-fund") return;
    closeChat();
    publishReturnMessage({
      environment: household.environment,
      householdId: household.householdId,
      memberId,
      chapterId: navTarget.chapterId,
      tab: navTarget.target.tab,
      setAt: new Date().toISOString(),
    });
    onOpenHouseholdFund();
  }

  function openOnboardingRecurrences() {
    if (!onOpenRecurrences || navTarget?.chapterId !== "ch-07-recurrences") return;
    closeChat();
    publishReturnMessage({
      environment: household.environment,
      householdId: household.householdId,
      memberId,
      chapterId: navTarget.chapterId,
      tab: navTarget.target.tab,
      setAt: new Date().toISOString(),
    });
    onOpenRecurrences();
  }

  function openOnboardingEarningCadence() {
    if (!onOpenEarningCadence || navTarget?.chapterId !== "ch-08-cadence") return;
    closeChat();
    publishReturnMessage({
      environment: household.environment,
      householdId: household.householdId,
      memberId,
      chapterId: navTarget.chapterId,
      tab: navTarget.target.tab,
      setAt: new Date().toISOString(),
    });
    onOpenEarningCadence();
  }

  function openOnboardingCategories() {
    if (!onOpenCategories || navTarget?.chapterId !== "ch-09-categories") return;
    closeChat();
    publishReturnMessage({
      environment: household.environment,
      householdId: household.householdId,
      memberId,
      chapterId: navTarget.chapterId,
      tab: navTarget.target.tab,
      setAt: new Date().toISOString(),
    });
    onOpenCategories();
  }

  function openOnboardingEstimates() {
    if (!onOpenEstimates || navTarget?.chapterId !== "ch-10-estimates") return;
    closeChat();
    publishReturnMessage({
      environment: household.environment,
      householdId: household.householdId,
      memberId,
      chapterId: navTarget.chapterId,
      tab: navTarget.target.tab,
      setAt: new Date().toISOString(),
    });
    onOpenEstimates();
  }

  function openOnboardingPlan() {
    if (!onOpenPlan || navTarget?.chapterId !== "ch-11-plan") return;
    closeChat();
    publishReturnMessage({
      environment: household.environment,
      householdId: household.householdId,
      memberId,
      chapterId: navTarget.chapterId,
      tab: navTarget.target.tab,
      setAt: new Date().toISOString(),
    });
    onOpenPlan();
  }

  function openOnboardingReady() {
    if (!onOpenReady || navTarget?.chapterId !== "ch-12-ready") return;
    closeChat();
    publishReturnMessage({
      environment: household.environment,
      householdId: household.householdId,
      memberId,
      chapterId: navTarget.chapterId,
      tab: navTarget.target.tab,
      setAt: new Date().toISOString(),
    });
    onOpenReady();
  }

  function openPersonalModule() {
    const target = activePersonalOffer?.module.target;
    if (target) onGo(target.tab);
    closeChat();
  }

  function openMobileFocus() {
    if (adding || phoneShell === false) return;
    setMobileFocus(true);
    if (!open && !talk) openChatFromBeg();
    else setOpen(true);
  }

  function pushSnippet(userText: string | undefined, herculesText: string) {
    const spoken = herculesText.slice(0, 160);
    setSnippets((prev) => {
      const base = prev.filter((row) => !row.placeholder);
      const add: WidgetSnippet[] = [];
      if (userText) add.push({ role: "user", text: userText.slice(0, 120) });
      add.push({ role: "hercules", text: spoken });
      return [...base, ...add].slice(-8);
    });
  }

  function sitWithBag() {
    closeChat();
    setPinned(true);
    setBegging(false);
    setOpen(false);
    setTalk(null);
    setBagPlay(true);
    setMotion("bag");
    if (!reducedMotion()) {
      window.setTimeout(() => {
        setBagPlay(false);
        setMotion("sit");
      }, 2200);
    } else {
      setBagPlay(false);
      setMotion("sit");
    }
  }

  function openChatFromBeg(helpOnly=true) {
    if (!helpOnly && setup && setup.household.householdOnboarding?.state !== 'complete') {
      setOpen(true);setSetupSelected(true);return;
    }
    setBegging(false);
    setFocusedWidget(null);
    setHelpAsked(true);
    setInvitationDismissed(true);
    if (!helpOnly && activePersonalOffer) {
      setOpen(true);
      return;
    }
    if (!helpOnly && !setup && !householdOnboardingShellActive && personalOffer) {
      const offeredAt = new Date().toISOString();
      setActivePersonalOffer(personalOffer);
      onLedger((current) => recordPersonalModuleOffer(current, {
        memberId,
        createdBy: memberId,
        moduleId: personalOffer.module.id,
        sessionId: personalOfferSessionId,
        isDesktop: desktopFly,
        at: offeredAt,
      }));
      setOpen(true);
      return;
    }
    const page = adding ? "add" : tab;
    const instrument = currentInstrument();
    const help = openHelpState({ tab: page, instrument, household: contextHousehold, today, view });
    applyTalk({
      spoken: "I can help you understand the books, pick up a task, or choose something excellent to wear. What shall we do?",
      lesson: null,
      fact: surface.fact,
      replies: discoveryEnabled && onDiscoveryNavigate ? [] : help.replies,
      pose: usefulness.light === "green" ? "celebrate" : "perch",
      topic: instrument ?? topic,
      attention: false,
    });
  }

  function showCompanionCue(presentation: import("./core/herculesCompanionContracts.ts").CompanionPresentationV2) {
    const commands = companionCueCommands(presentation, reducedMotion());
    if (!commands.length) return;
    if (chatRigTimer.current) clearTimeout(chatRigTimer.current);
    const scope = chatScope, request = chatGen.current;
    chatRigUntilRef.current = performance.now() + 1500;
    commands.forEach(command => dispatchHerculesRig(command));
    chatRigTimer.current = setTimeout(() => {
      if (previousChatScope.current !== scope || chatGen.current !== request) return;
      chatRigUntilRef.current = 0; dispatchHerculesRig({ type: "playPose", pose: "loaf" });
    }, 1500);
  }

  function reactToChatText(...texts: Array<string | undefined | null>) {
    if (reducedMotion() || texts.some(text => /\b(stress|overwhelm|scared|anxious|worried|can.t afford)\b/i.test(text ?? ""))) return;
    let fired = false;
    for (const text of texts) {
      if (text?.trim() && dispatchChatRigTriggers(text)) fired = true;
    }
    if (!fired) return;
    chatRigUntilRef.current = performance.now() + 1500;
    const rigScope = chatScope, rigRequest = chatGen.current;
    if (chatRigTimer.current) clearTimeout(chatRigTimer.current);
    chatRigTimer.current = setTimeout(() => {
      if (previousChatScope.current !== rigScope || chatGen.current !== rigRequest) return;
      chatRigUntilRef.current = 0;
      const target = (bagPlay ? "bag" : begging ? "beg" : motion) as HerculesRigPose;
      dispatchHerculesRig({ type: "playPose", pose: target === "sleep" ? "loaf" : target });
    }, 1500);
  }

  function applyTalk(next: HerculesTalk, userText?: string) {
    reactToChatText(userText, next.spoken);
    setTalk(next);
    setTopic(next.topic);
    setMotion(next.pose === "sleep" ? "loaf" : next.pose);
    setQuestion("");
    setOpen(true);
    if (focusedWidget && tab === "home") {
      pushSnippet(userText, next.spoken);
    }
    setTurns((prev) => {
      if (!userText && !prev.some((turn) => turn.role === "user")) {
        return [{ role: "hercules", text: next.spoken }];
      }
      const add: HerculesChatTurn[] = [];
      if (userText) add.push({ role: "user", text: userText });
      add.push({ role: "hercules", text: next.spoken });
      return [...prev, ...add].slice(-300);
    });
  }

  function goShortcut(raw: string): boolean {
    const text = raw.trim();
    if (/^save as preset$/i.test(text)) {
      if (proposal?.habitKey) {
        onAcceptPreset?.(proposal.habitKey, proposal.spoken);
        closeChat();
        return true;
      }
    }
    if (/^not now$/i.test(text)) {
      if (proposal?.key) {
        onDismissNotice?.(proposal.key);
        closeChat();
        return true;
      }
    }
    if (/^milk$|^post milk$|^groceries$|^post groceries$/i.test(text)) {
      closeChat();
      onOpenAdd("Groceries");
      return true;
    }
    if (/^calendar$|^which bill/i.test(text)) {
      closeChat();
      directToCalendar();
      return true;
    }
    if (/^health$|^what broke/i.test(text)) {
      closeChat();
      onGo("more");
      return true;
    }
    if (/^sit-down|^sit down|^leftover/i.test(text)) {
      emitOfficeIntent({ type: "expand", id: "postcard" });
      return false;
    }
    if (/pay the card/i.test(text)) {
      emitOfficeIntent({ type: "expand", id: "wallet" });
      onPayCard?.();
      closeChat();
      return true;
    }
    if (/what.?s on the (visa|mastercard|master card|card)/i.test(text)) {
      emitOfficeIntent({ type: "expand", id: "wallet" });
      return false;
    }
    return false;
  }

  function consumeWorkplaceRosterConsent(): string[] {
    const selected = view === "personal" && shareWorkplaceRoster
      ? selectableWorkplaceCoworkerIds
      : [];
    setShareWorkplaceRoster(false);
    return selected;
  }

  function speak(raw: string) {
    if (!chatEnabled) return;
    const text = raw.trim();
    if (!text || busy) return;
    if(actionRef.current?.send(text)){setSuggestedWorkflowIds([]);setQuestion("");return;}
    const requestedCoworkerIds = consumeWorkplaceRosterConsent();
    if (preferenceTurn(text)) return;
    const helpCmd = matchHelpCommand(
      helpCommands({ tab: adding ? "add" : tab, instrument: currentInstrument(), household, today, view }),
      text,
    );
    if (helpCmd) applyHelpNav(helpCmd);
    if (goShortcut(helpCmd?.prompt ?? text)) return;
    if (calendarEventIntent(text)) directToCalendar();
    const plan = planHerculesTurn(contextHousehold, helpCmd?.prompt ?? text, today, adding ? "add" : tab, topic, { memberId, view, conversationActions:!!actionService });
    if (plan.draft) {
      onDraft?.(plan.draft);
      keepTalk(text, plan.talk.spoken, "journal");
      closeChat();
      return;
    }
    if (plan.skipModel) {
      applyTalk(plan.talk, text);
      keepTalk(text, plan.talk.spoken, plan.source, plan.memory);
      setReplyProvider(null);
      return;
    }
    void sendChat(helpCmd?.prompt ?? text, requestedCoworkerIds);
  }

  async function sendChat(raw: string, preconsumedCoworkerIds?: string[]) {
    if (!chatEnabled) return;
    const message = raw.trim();
    if (!message || busy || modelPending.current!==null) return;
    if(actionRef.current?.send(message)){setSuggestedWorkflowIds([]);setQuestion("");return;}
    // Consume consent on every Send. `speak` passes its already-consumed value
    // so suggested local replies cannot leak consent into a later turn.
    const requestedCoworkerIds = preconsumedCoworkerIds ?? consumeWorkplaceRosterConsent();
    if (preferenceTurn(message)) return;
    setEphemeralWorkplaceTurn(false);
    const helpCmd = matchHelpCommand(
      helpCommands({ tab: adding ? "add" : tab, instrument: currentInstrument(), household, today, view }),
      message,
    );
    if (helpCmd) applyHelpNav(helpCmd);
    const text = helpCmd?.prompt ?? message;
    if (goShortcut(text)) return;
    if (calendarEventIntent(message) || calendarEventIntent(text)) directToCalendar();
    const page = adding ? "add" : tab;
    const plan = planHerculesTurn(contextHousehold, text, today, page, topic, { memberId, view, conversationActions:!!actionService });
    if (plan.draft) {
      onDraft?.(plan.draft);
      keepTalk(message, plan.talk.spoken, "journal");
      closeChat();
      return;
    }
    if (plan.skipModel) {
      applyTalk(plan.talk, message);
      keepTalk(message, plan.talk.spoken, plan.source, plan.memory);
      setReplyProvider(null);
      return;
    }
    setReplyProvider(null);
    const coworkerIdsForModel = requestedCoworkerIds;
    setEphemeralWorkplaceTurn(coworkerIdsForModel.length > 0);
    const grounded = plan.talk;
    const briefing = herculesBriefing(contextHousehold, page, today);
    const gen = chatGen.current + 1;
    chatGen.current = gen;
    modelPending.current=gen;
    const workflowFingerprint=actionRef.current?.fingerprint();
    try {
    const replyContext: HerculesReplyContext = {
      ...activeChatIdentity.current,
      requestId: gen,
    };
    setTurns((prev) => [...prev, { role: "user" as const, text: message }].slice(-300));
    reactToChatText(message);
    if (focusedWidget && tab === "home") pushSnippet(message, "Thinking…");
    setQuestion("");
    setBusy(true);
    setOpen(true);
    setTalk(grounded);
    setTopic(grounded.topic);
    setMotion("pounce");
    const disclosedContext = composeHerculesChatRequest(conversationHousehold(), text, briefing, today, memberId, topic, { view, availableActionIds: availableDiscoveryActions(), workflow: actionRef.current?.state() }).companion;
    const plannerMessage = resolveHerculesFollowUp(text, disclosedContext.context);
    const toolPlan = shouldPlanHerculesTools(plannerMessage)
      ? await planHerculesReadTools({ message: plannerMessage, page, view })
      : { calls: [] };
    if (!isCurrentHerculesReply(replyContext, {
      ...activeChatIdentity.current,
      requestId: chatGen.current,
    })) return;
    if (toolPlan.calls.length) {
      const investigation = executeHerculesReadToolPlan(household, toolPlan, today, { memberId, view });
      const groundedAnswer = investigation.talk;
      const voicedRequest = composeHerculesChatRequest(conversationHousehold(), text, briefing, today, memberId, topic, {
        currentFactIds:groundedAnswer.facts?.map(f=>f.id)??[],
        availableActionIds: availableDiscoveryActions(), workflow: actionRef.current?.state(),
        shareCoordsWithModel: loadPhonePlacePrefs(household.environment).shareCoordsWithModel,
        view,
        coworkerIdsForModel,
      });
      const voiced = await chatHercules({
        ...voicedRequest,
        grounded: {
          spoken: groundedAnswer.spoken,
          lesson: groundedAnswer.lesson,
          fact: groundedAnswer.fact ? { label: groundedAnswer.fact.label, value: groundedAnswer.fact.value } : null,
        },
        figures: collectAllowedFigures(
          groundedAnswer.spoken,
          groundedAnswer.lesson,
          ...(groundedAnswer.facts ?? []).flatMap((item) => [item.label, item.value]),
        ),
      });
      if (!isCurrentHerculesReply(replyContext, {
        ...activeChatIdentity.current,
        requestId: chatGen.current,
      })) return;
      const voicedText = sanitizeGroundedNumerals(
        voiced.text,
        groundedAnswer.spoken,
        groundedAnswer.lesson ?? "",
        ...(groundedAnswer.facts ?? []).flatMap((item) => [item.label, item.value]),
      );
      const usedModelVoice = voiced.source === "ai" && voicedText !== groundedAnswer.spoken;
      const answer = { ...groundedAnswer, spoken: voicedText };
      setTalk(answer);
      setTopic(answer.topic);
      setTurns((prev) => [...prev, { role: "hercules" as const, text: answer.spoken }].slice(-300));
      if (voiced.presentation) showCompanionCue(voiced.presentation);
      else reactToChatText(answer.spoken);
      if (focusedWidget && tab === "home") {
        setSnippets((prev) => {
          const trimmed = prev.filter((row) => row.text !== "Thinking…");
          return [...trimmed, { role: "hercules" as const, text: answer.spoken.slice(0, 160) }].slice(-8);
        });
      }
      setMotion(answer.pose);
      setBusy(false);
      if(voiced.presentation?.proposal)actionRef.current?.propose(voiced.presentation.proposal,workflowFingerprint);
      setSuggestedWorkflowIds(voiced.presentation?.actionIds.slice(0,3)??[]);
      setReplyProvider(herculesProviderForDisplayedReply(voiced, usedModelVoice));
      keepTalk(message, answer.spoken, usedModelVoice ? "ai" : "journal", null, coworkerIdsForModel.length > 0, groundedAnswer.facts);
      return;
    }
    setSuggestedWorkflowIds([]);
    const result = await chatHercules(
      composeHerculesChatRequest(conversationHousehold(), message, briefing, today, memberId, topic, {
        availableActionIds: availableDiscoveryActions(), workflow: actionRef.current?.state(),
        shareCoordsWithModel: loadPhonePlacePrefs(household.environment).shareCoordsWithModel,
        view,
        coworkerIdsForModel,
      }),
    );
    if (!isCurrentHerculesReply(replyContext, {
      ...activeChatIdentity.current,
      requestId: chatGen.current,
    })) return;
    const usedModelVoice = result.source === "ai" && result.text !== grounded.spoken;
    setTalk({ ...grounded, spoken: result.text });
    setTurns((prev) => [...prev, { role: "hercules" as const, text: result.text }].slice(-300));
    if (result.presentation) showCompanionCue(result.presentation);
    else reactToChatText(result.text);
    if (focusedWidget && tab === "home") {
      setSnippets((prev) => {
        const trimmed = prev.filter((row) => row.text !== "Thinking…");
        const next: WidgetSnippet = { role: "hercules", text: result.text.slice(0, 160) };
        return [...trimmed, next].slice(-8);
      });
    }
    setMotion(grounded.pose === "sleep" ? "loaf" : grounded.pose);
    setBusy(false);
    if(result.presentation?.proposal)actionRef.current?.propose(result.presentation.proposal,workflowFingerprint);
    setSuggestedWorkflowIds(result.presentation?.actionIds.slice(0,3)??[]);
    setReplyProvider(herculesProviderForDisplayedReply(result, usedModelVoice));
    keepTalk(message, result.text, usedModelVoice ? "ai" : "local", null, coworkerIdsForModel.length > 0, grounded.facts);
    } finally {if(modelPending.current===gen){modelPending.current=null;setBusy(false);}}
  }

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: pos.x, y: pos.y, px: event.clientX, py: event.clientY, moved: false, lastX: pos.x, lastY: pos.y, caughtFly: false };
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const start = drag.current;
    if (!start) return;
    const dx = event.clientX - start.px;
    const dy = event.clientY - start.py;
    if (Math.abs(dx) + Math.abs(dy) > 8) start.moved = true;
    if (!start.moved) return;
    setPinned(true);
    setMotion("walk");
    setFlip(dx > 0);
    const w = window.innerWidth;
    const h = window.innerHeight;
    const next = {
      x: Math.min(w - CAT - 4, Math.max(4, start.x + dx)),
      y: Math.min(h - CAT - NAV, Math.max(4, start.y + dy)),
    };
    start.lastX = next.x;
    start.lastY = next.y;
    setPos(next);
    if (desktopFly && fly && herculesOverFly(next, fly, CAT)) {
      start.caughtFly = true;
      catchFly();
    }
    if (desktopFly && deadFlies > 0 && herculesInLitter(next, { w, h }, CAT, NAV)) {
      setDeadFlies(0);
    }
    const hit = furnitureUnderCat(next, listFurniture());
    if (hit && (lastBump.current?.id !== hit.id || Date.now() - lastBump.current.at > 480)) {
      lastBump.current = { id: hit.id, at: Date.now() };
      emitOfficeIntent({ type: "bump", id: hit.id });
      setMotion("bump");
    }
  }

  function onPointerUp() {
    const start = drag.current;
    drag.current = null;
    if (!start) return;
    if (!start.moved) {
      setPurr(true);
      if (open) closeChat();
      else openChatFromBeg(true);
    } else {
      setMotion(look.view.mood === "restless" ? "pace" : pinned ? "sit" : "loaf");
    }
  }

  const perchMove = perchPlayFor.current
    ? (["hop", "wiggle", "hang"] as const)[Math.abs(perchPlayFor.current.length * 13 + perchPlayFor.current.charCodeAt(0)) % 3]
    : "hop";
  const pose = visorPop ? "jump" : motion;
  const size = adding ? 72 : CAT;
  const furnitureNow = listFurniture();
  const openInstrument = furnitureNow.find((item) => item.id === perchPlayFor.current)
    ?? furnitureNow.find((item) => item.id === topic);
  const moneyAvoid = (showProposal || open)
    ? furnitureNow
      .filter((item) => item.id === "wallet" || item.id === "blotter" || item.id === "accounts")
      .map((item) => item.rect)
    : [];
  const examinedAvoid = open && openInstrument
    ? {
      x: openInstrument.rect.x,
      y: openInstrument.rect.y + 52,
      w: openInstrument.rect.w,
      h: Math.max(40, openInstrument.rect.h - 52),
    }
    : open && tab !== "home"
      ? {
        x: 12,
        y: 64,
        w: (typeof window === "undefined" ? 390 : window.innerWidth) - 24,
        h: Math.min((typeof window === "undefined" ? 844 : window.innerHeight) * 0.4, 360),
      }
      : null;
  const avoid = examinedAvoid ? [...moneyAvoid, examinedAvoid] : moneyAvoid.length ? moneyAvoid : null;
  const widgetFurnitureId = focusedWidget === "chalkboard" ? "window" : focusedWidget;
  const widgetRect = widgetFurnitureId
    ? furnitureNow.find((item) => item.id === widgetFurnitureId)?.rect ?? null
    : null;
  const bubble = showWidgetSnippets && widgetRect
    ? widgetSnippetBubbleBox({
      widget: widgetRect,
      bubbleW: bubbleSize.w,
      bubbleH: bubbleSize.h,
      viewW: typeof window === "undefined" ? 390 : window.innerWidth,
      viewH: typeof window === "undefined" ? 844 : window.innerHeight,
    })
    : herculesBubbleBox({
      catX: pos.x,
      catY: pos.y,
      catSize: size,
      bubbleW: bubbleSize.w,
      bubbleH: bubbleSize.h,
      viewW: typeof window === "undefined" ? 390 : window.innerWidth,
      viewH: typeof window === "undefined" ? 844 : window.innerHeight,
      avoid,
    });
  const bubbleStyle = { left: bubble.left, top: bubble.top };
  const bubbleSide = bubble.side === "left" ? "left" : "right";
  const groundedFacts = talk?.facts?.length
    ? talk.facts
    : talk?.fact?.source
      ? [{ id: `fact:${talk.fact.label}:${talk.fact.value}`, label: talk.fact.label, value: talk.fact.value, source: talk.fact.source, basis: "journal" as const }]
      : [];
  const discoveryInput = { household, memberId, view, tab: adding ? "add" as const : tab, today, accountId: discoveryAccountId, fund: discoveryFund };
  const availableDiscoveryActions = () => [...(discoveryEnabled && onDiscoveryNavigate ? HERCULES_CAPABILITIES.filter(row=>discoverySelection(discoveryInput).all.some(candidate=>candidate.capabilityId===row.id)).map(row=>row.action) : []),...(actionService&&actionHousehold?availableHerculesActions({household:actionHousehold,memberId,view,today}).map(row=>`start:${row.id}`):[])];
  const discoveryPanel = () => discoveryEnabled && onDiscoveryNavigate ? <HerculesDiscovery key={discoveryScope(discoveryInput)} input={discoveryInput} onCommand={onCompanionCommand}
    blocked={adding || busy} onNavigate={destination => { if(destination.kind==="entry"&&actionRef.current){actionRef.current.send(destination.mode==="expense"?"I just bought something":destination.mode==="income"?"I received some money":"Transfer money");return;}onDiscoveryNavigate(destination); }}
    onContinueChat={chatEnabled ? () => { const input = document.querySelector<HTMLTextAreaElement>(`.hercules-focus-shell textarea[aria-label="Ask ${look.view.name}"], .hercules-bubble textarea[aria-label="Ask ${look.view.name}"]`); input?.focus(); input?.scrollIntoView({ block: "nearest" }); } : undefined} /> : null;
  const workplaceShareToggle = () => view === "personal" && selectableWorkplaceCoworkerIds.length > 0 ? (
    <label className="hercules-workplace-share">
      <input
        type="checkbox"
        checked={shareWorkplaceRoster}
        disabled={busy}
        onChange={(event) => setShareWorkplaceRoster(event.target.checked)}
      />
      <span>include my private workplace roster for this reply</span>
    </label>
  ) : null;

  function composer(){return chatEnabled ? <form className="hercules-chat-form" onSubmit={event=>{event.preventDefault();void sendChat(question);composerRef.current?.focus();}}><textarea ref={composerRef} data-autofocus aria-label={`Ask ${look.view.name}`} rows={2} value={question} placeholder="Tell me what you’d like to do…" onChange={event=>setQuestion(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.nativeEvent.isComposing&&!event.repeat){event.preventDefault();if(!busy&&question.trim())event.currentTarget.form?.requestSubmit();}}}/><button type="submit" disabled={busy||!question.trim()}>Send</button><small className="hercules-composer-help">Enter to send · Shift+Enter for a new line. Only Final Confirm posts.</small></form>:null;}
  function actionPanel(){return actionService&&actionHousehold?<><div className="hercules-replies">{suggestedWorkflowIds.filter(id=>availableDiscoveryActions().includes(id)).map(id=>{const item=HERCULES_WORKFLOW_CATALOGUE.find(r=>`start:${r.id}`===id);if(item)return <button key={id} type="button" onClick={()=>actionRef.current?.send(item.example)}>{item.title}</button>;const definition=HERCULES_CAPABILITIES.find(row=>row.action===id);return definition?<button key={id} type="button" onClick={()=>{const candidate=discoverySelection(discoveryInput).all.find(row=>row.capabilityId===definition.id);const answer=candidate&&explainDiscovery(discoveryInput,candidate.issueId);if(answer)keepTalk(definition.example,answer.text,"journal");}}>{definition.outcome}</button>:null;})}</div><HerculesActionPanel key={`${actionIdentity}:${view}:${household.companionProfile?.conversations.find(r=>r.view===view)?.generation??0}`} ref={actionRef} context={{household:actionHousehold,memberId,view,today}} service={actionService} identity={actionIdentity??memberId} onReply={(question,reply)=>{applyTalk({...surface,spoken:reply,lesson:null,replies:[],pose:"loaf",topic:"entry",attention:false} as HerculesTalk,question);keepTalk(question,reply,"journal");}}/></>:null;}
  return (
    <HerculesRigProvider
      mood={look.view.mood}
      reducedMotion={reducedMotion()}
      visibilityProfile={rigBlocked || !documentVisible || setupSelected ? "hidden" : phoneShell || tab !== "home" ? "compact" : "full"}
    >
      <HerculesRigBridge mood={look.view.mood} pose={pose} begging={begging} bagPlay={bagPlay} chatRigUntilRef={chatRigUntilRef} />
      <HerculesOfficeRigBridge expandId={tab === "home" ? focusedWidget : null} />
    <div className={`hercules-world ${hideLiveCat ? "is-phone-compact" : ""} ${focusShellOpen ? "is-focus-open" : ""} ${desktopFly && homeAutonomy ? "is-desktop-wander" : ""}`} aria-live="polite">
      {setup && activeMemberPresent && <HerculesSetup {...setup} key={`${setup.household.environment}:${setup.household.householdId}:${setup.memberId}:${setup.authUserId}`} open={open && setupSelected} onClose={closeChat} onHelp={()=>{setSetupSelected(false);openChatFromBeg(true);}} onPlay={()=>{closeChat();sitWithBag();}} />}
      {desktopFly && homeAutonomy && !reducedMotion() && (
        <HerculesLitterBox deadFlies={deadFlies} />
      )}
      <HerculesFly x={fly?.x ?? 0} y={fly?.y ?? 0} hidden={!desktopFly || !fly || !homeAutonomy || reducedMotion()} />
      {showWidgetSnippets && (
        <div
          ref={bubbleRef}
          className={`hercules-bubble hercules-widget-snippet ${bubbleSide}`}
          style={bubbleStyle}
        >
          <div className="hercules-snippet-stack">
            {snippets.map((row, index) => (
              <p
                key={`${row.role}-${index}-${row.text.slice(0, 10)}`}
                className={`hercules-snippet ${row.role === "user" ? "you" : "cat"} ${row.placeholder ? "placeholder" : ""}`}
              >
                {row.text}
              </p>
            ))}
            {busy && <p className="hercules-snippet cat">Thinking…</p>}
          </div>
          {open && <button type="button" onClick={() => { setFocusedWidget(null); setOpen(true); }}>Read full conversation</button>}
          {open && (
            <>

            {workplaceShareToggle()}
            <p role="status">{privateSaveStatus}</p>
            {preferenceUndo && <button type="button" onClick={undoRememberedPreference}>Undo remembered preference</button>}
            {pendingExchange.current && !privateSaving && <button type="button" onClick={() => { if (pendingExchange.current) void savePrivateExchange([...pendingExchange.current]); }}>Retry conversation save</button>}
            <details className="hercules-compact-tools"><summary>Memory and settings</summary><CompanionMemoryControls household={household} memberId={memberId} view={view} onCommand={onCompanionCommand} /></details>
            {composer()}
            </>
          )}
        </div>
      )}
      {phoneShell && !adding && !mobileFocus && (
        <button
          type="button"
          className="hercules-pill"
          aria-label={`Talk to ${look.view.name}. Opens focus mode.`}
          onClick={openMobileFocus}
        >
          <HerculesLivePortrait
            mood={look.view.mood}
            hat={look.hat}
            chain={look.chain}
            house={look.house}
            collar={look.collar}
            pose="loaf"
            size={40}
          />
          <span className="hercules-pill-name">How can I help?</span>{(!invitationDismissed && !autonomyBlocked && discoveryEnabled && onDiscoveryNavigate) && <span className="hercules-quiet-indicator" aria-label="Guidance available">·</span>}
        </button>
      )}
      {focusShellOpen && (
        <div ref={focusDialogRef} className="hercules-focus-shell" style={phoneViewport?{height:phoneViewport.height,top:phoneViewport.top,bottom:"auto"}:undefined} role="dialog" aria-modal="true" aria-label={`${look.view.name} focus`}>
          <button type="button" className="hercules-focus-close" onClick={closeChat} aria-label="Close focus mode">
            Close
          </button>
          {!setup && onboardingShellActive ? (
            <OnboardingChat
              household={household}
              memberId={memberId}
              today={today}
              busy={busy}
              onCommit={onLedger}
              onDismiss={closeChat}
              onOpenCharter={openOnboardingCharter}
              onOpenAccounts={openOnboardingAccounts}
              onOpenOpeningBalances={openOnboardingOpeningBalances}
              onOpenHouseholdFund={openOnboardingHouseholdFund}
              onOpenRecurrences={openOnboardingRecurrences}
              onOpenEarningCadence={openOnboardingEarningCadence}
              onOpenCategories={openOnboardingCategories}
              onOpenEstimates={openOnboardingEstimates}
              onOpenPlan={openOnboardingPlan}
              onOpenReady={openOnboardingReady}
              personalOffer={activePersonalOffer}
              personalOfferSessionId={personalOfferSessionId}
              personalOfferRecorded={personalOfferRecorded}
              onOpenPersonalModule={openPersonalModule}
            />
          ) : (
            <>
          <div className="hercules-focus-hero">
            <HerculesLivePortrait
              mood={look.view.mood}
              hat={look.hat}
              chain={look.chain}
              house={look.house}
              collar={look.collar}
              pose={pose}
              size={120}
            />
          </div>
          <div className="hercules-focus-body"><div className="hercules-conversation-content">
            {actionPanel()}
            {turns.length?<details className="hercules-compact-tools"><summary>Suggestions and help</summary>{discoveryPanel()}</details>:discoveryPanel()}
            {!chatEnabled && <p role="status">Conversation is taking a break. Your saved preferences are still available.</p>}
            {!setup && <button type="button" onClick={sitWithBag}>Play</button>}
            {<><p className="companion-save-status" role="status">{privateSaveStatus}</p>
            {preferenceUndo && <button type="button" onClick={undoRememberedPreference}>Undo remembered preference</button>}
            {pendingExchange.current && !privateSaving && <button type="button" onClick={() => { if (pendingExchange.current) void savePrivateExchange([...pendingExchange.current]); }}>Retry conversation save</button>}
            <details className="hercules-compact-tools"><summary>Memory and settings</summary><CompanionMemoryControls household={household} memberId={memberId} view={view} onCommand={onCompanionCommand} /></details></>}
            {setup && <div className="hercules-manual-actions"><button type="button" onClick={()=>setSetupSelected(true)}>Set up Hearth</button><button type="button" onClick={sitWithBag}>Play</button></div>}
            {talk ? (
              <>
            {open && turns.length > 0 ? (
              <div className="hercules-chat-log" ref={logRef}>
                {turns.map((turn, index) => (
                  <p key={`${turn.role}-${index}-${turn.text.slice(0, 12)}`} className={`hercules-turn ${turn.role === "user" ? "you" : "cat"}`}>
                    {turn.text}
                  </p>
                ))}
                {busy && <p className="hercules-typing">Thinking…</p>}
              </div>
            ) : (
              <p className="hercules-spoken">{talk.spoken}</p>
            )}
            {!busy && talk.lesson && <p className="hercules-lesson">{talk.lesson}</p>}
            {!busy && replyProvider && (
              <p className="hercules-source" aria-label={`Reply source: ${herculesProviderLabel(replyProvider)}`}>
                {herculesProviderLabel(replyProvider)}
              </p>
            )}
            {!busy && groundedFacts.length > 0 && (
              <div className="hercules-grounded-facts" aria-label="Numbers pulled from the books">
                {groundedFacts.slice(0, 5).map((fact) => (
                  <button
                    key={fact.id}
                    type="button"
                    className="hercules-grounded-fact"
                    onClick={() => {
                      closeChat();
                      onOpenSource(fact.source);
                    }}
                  >
                    <span>{fact.label}</span>
                    <strong>{fact.value}</strong>
                  </button>
                ))}
              </div>
            )}
            {!busy && (
              <div className="hercules-replies">
                {chatEnabled && talk.replies.map((item) => (
                  <button key={item} type="button" onClick={() => speak(item)}>{item}</button>
                ))}
              </div>
            )}
            {workplaceShareToggle()}

              </>
            ) : (
              <p className="hercules-spoken">Thinking…</p>
            )}
          </div>{composer()}</div>
            </>
          )}
        </div>
      )}
      {showProposal && proposal && phoneShell && !mobileFocus && (
        <div className="hercules-pill-note" role="status">
          <p>{proposal.spoken}</p>
          <div className="hercules-replies">
            {proposal.potentialExpenseId && (
              <>
                <button type="button" onClick={() => onQuickPotentialExpense?.(proposal.potentialExpenseId!)}>Quick Confirm</button>
                <button type="button" onClick={() => onReviewPotentialExpense?.(proposal.potentialExpenseId!)}>Review in Add</button>
                <button type="button" onClick={() => onMovePotentialExpense?.(proposal.potentialExpenseId!)}>Move</button>
                <button type="button" onClick={() => onRemovePotentialExpense?.(proposal.potentialExpenseId!)}>Remove</button>
              </>
            )}
            {proposal.habitKey && (
              <button type="button" onClick={() => onAcceptPreset?.(proposal.habitKey!, proposal.spoken)}>
                Save as preset
              </button>
            )}
            <button type="button" onClick={() => onDismissNotice?.(proposal.key)}>Not now</button>
          </div>
        </div>
      )}
      {showProposal && proposal && !phoneShell && (
        <div
          ref={bubbleRef}
          className={`hercules-bubble hercules-proposal ${bubbleSide}`}
          style={bubbleStyle}
        >
          <p className="hercules-spoken">{proposal.spoken}</p>
          <p className="hercules-lesson">{proposal.lesson}</p>
          <div className="hercules-replies">
            {proposal.potentialExpenseId && (
              <>
                <button type="button" onClick={() => onQuickPotentialExpense?.(proposal.potentialExpenseId!)}>Quick Confirm</button>
                <button type="button" onClick={() => onReviewPotentialExpense?.(proposal.potentialExpenseId!)}>Review in Add</button>
                <button type="button" onClick={() => onMovePotentialExpense?.(proposal.potentialExpenseId!)}>Move</button>
                <button type="button" onClick={() => onRemovePotentialExpense?.(proposal.potentialExpenseId!)}>Remove</button>
              </>
            )}
            {proposal.habitKey && (
              <button
                type="button"
                onClick={() => onAcceptPreset?.(proposal.habitKey!, proposal.spoken)}
              >
                Save as preset
              </button>
            )}
            <button type="button" onClick={() => onDismissNotice?.(proposal.key)}>Not now</button>
          </div>
        </div>
      )}
      {/* "Finish here, then open Hercules." Furniture, not an alert: no
          dismiss control and no timeout. Desktop reuses the existing status
          surface; mobile uses plate 13's bar above the nav. */}
      {(desktopOnboardingOpen || (showTalk && talk)) && !focusShellOpen && (
        <div
          ref={bubbleRef}
          className={`hercules-bubble ${bubbleSide} ${open ? "chat" : ""} ${chatExpanded ? "is-expanded" : ""}`}
          style={bubbleStyle}
        >
          {open&&<header className="hercules-chat-header"><HerculesLivePortrait mood={look.view.mood} hat={look.hat} chain={look.chain} house={look.house} collar={look.collar} pose={pose} size={44}/><strong>Hercules</strong><button type="button" aria-expanded={chatExpanded} onClick={()=>setChatExpanded(!chatExpanded)}>{chatExpanded?'Compact':'Expand'}</button></header>}
          <div className="hercules-conversation-content">{open&&actionPanel()}
          {open && setup && !setupSelected && <div className="hercules-manual-actions"><button type="button" onClick={()=>setSetupSelected(true)}>Set up Hearth</button><button type="button" onClick={sitWithBag}>Play</button></div>}
          {desktopOnboardingOpen ? (
            <>
              <OnboardingChat
                household={household}
                memberId={memberId}
                today={today}
                busy={busy}
                onCommit={onLedger}
                onDismiss={closeChat}
                onOpenCharter={openOnboardingCharter}
                onOpenAccounts={openOnboardingAccounts}
                onOpenOpeningBalances={openOnboardingOpeningBalances}
                onOpenHouseholdFund={openOnboardingHouseholdFund}
                onOpenRecurrences={openOnboardingRecurrences}
                onOpenEarningCadence={openOnboardingEarningCadence}
                onOpenCategories={openOnboardingCategories}
                onOpenEstimates={openOnboardingEstimates}
                onOpenPlan={openOnboardingPlan}
                onOpenReady={openOnboardingReady}
                personalOffer={activePersonalOffer}
                personalOfferSessionId={personalOfferSessionId}
                personalOfferRecorded={personalOfferRecorded}
                onOpenPersonalModule={openPersonalModule}
              />
              {navTarget && !["ch-03-charter", "ch-04-accounts", "ch-05-opening", "ch-06-fund", "ch-07-recurrences", "ch-08-cadence", "ch-09-categories", "ch-10-estimates", "ch-11-plan", "ch-12-ready"].includes(navTarget.chapterId) && (
                <button type="button" className="hercules-help" onClick={goToOnboardingTarget}>
                  {copy("nav.go", { surface: navTargetSurfaceLabel(navTarget.target.tab) })}
                </button>
              )}
            </>
          ) : talk ? (
          <>
          {open && !begging && (turns.length?<details className="hercules-compact-tools"><summary>Suggestions and help</summary>{discoveryPanel()}</details>:discoveryPanel())}
          {open && !chatEnabled && <p role="status">Conversation is taking a break. Your saved preferences are still available.</p>}
          {open && !setup && <button type="button" onClick={sitWithBag}>Play</button>}
          {open && !begging && turns.length > 0 ? (
            <div className="hercules-chat-log" ref={logRef}>
              {turns.map((turn, index) => (
                <p key={`${turn.role}-${index}-${turn.text.slice(0, 12)}`} className={`hercules-turn ${turn.role === "user" ? "you" : "cat"}`}>
                  {turn.text}
                </p>
              ))}
              {busy && <p className="hercules-typing">Thinking…</p>}
            </div>
          ) : (
            <p className="hercules-spoken">{talk.spoken}</p>
          )}
          {open && !busy && talk.lesson && <p className="hercules-lesson">{talk.lesson}</p>}
          {open && !busy && ephemeralWorkplaceTurn && (
            <p className="hercules-source">Private workplace roster used for this reply. This turn was not saved.</p>
          )}
          {open && !busy && replyProvider && (
            <p className="hercules-source" aria-label={`Reply source: ${herculesProviderLabel(replyProvider)}`}>
              {herculesProviderLabel(replyProvider)}
            </p>
          )}
          {open && <>
            <p className="companion-save-status" role="status">{privateSaveStatus}</p>
            {pendingExchange.current && !privateSaving && <button type="button" onClick={() => void savePrivateExchange()}>Retry conversation save</button>}
            {preferenceUndo && <button type="button" onClick={undoRememberedPreference}>Undo remembered preference</button>}
            <details className="hercules-compact-tools"><summary>Memory and settings</summary><CompanionMemoryControls household={household} memberId={memberId} view={view} onCommand={onCompanionCommand} /></details>
          </>}
          {open && !busy && groundedFacts.length > 0 && <div className="hercules-grounded-facts" aria-label="Numbers pulled from the books">{groundedFacts.slice(0, 5).map(fact => <button key={fact.id} type="button" className="hercules-grounded-fact" onClick={() => { closeChat(); onOpenSource(fact.source); }}><span>{fact.label}</span><strong>{fact.value}</strong></button>)}</div>}
          {open && !busy && groundedFacts.length === 0 && talk.fact && (
            <p className="hercules-fact"><span>{talk.fact.label}</span> {talk.fact.value}</p>
          )}
          {open && !begging && (
            <>
              {!busy && helpAsked && (
                <div className="hercules-replies">
                  {chatEnabled && talk.replies.map((item) => (
                    <button key={item} type="button" onClick={() => speak(item)}>{item}</button>
                  ))}
                </div>
              )}
              {workplaceShareToggle()}

              <button
                type="button"
                className="hercules-pro-quiet"
                onClick={launchHerculesPro}
                title="Optional ChatGPT companion. Free Hercules stays available here."
              >
                Hercules Pro
              </button>
            </>
          )}
          </>
          ) : null}
          </div>{open&&composer()}
          <button className="hercules-dismiss" type="button" onClick={closeChat}>
            ok
          </button>
        </div>
      )}
      <button
        type="button"
        className={[
          "hercules-live",
          hideLiveCat ? "is-hidden-phone" : "",
          `mood-${look.view.mood}`,
          `pose-${pose}`,
          perchPlay ? `perch-play perch-${perchMove}` : "",
          purr ? "purr" : "",
          five.yes ? "high-five" : "",
          "",
          begging ? "is-begging" : "",
          bagPlay ? "is-bag" : "",
          flyPouncing ? "is-fly-pouncing" : "",
          `useful-${usefulness.light}`,
          adding ? "loafing is-adding" : "",
          pinned ? "pinned" : "",
          reducedMotion() ? "cut-motion" : "",
        ].join(" ")}
        style={{ left: pos.x, top: pos.y, width: size, height: size, ["--herc-useful" as string]: String(usefulness.animation) }}
        aria-label={`Open ${look.view.name}${!phoneShell && !open && !adding && !activityBlocked ? " — How can I help?" : ""}`}
        onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();if(open)closeChat();else openChatFromBeg(true);}}}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { drag.current = null; }}
        onAnimationEnd={() => setPurr(false)}
        onContextMenu={(event) => {
          event.preventDefault();
          setPinned((value) => !value);
        }}
      >
        {!phoneShell && !open && !adding && !activityBlocked && <span className="hercules-help-label" aria-hidden="true">How can I help?</span>}
        <HerculesLivePortrait
          mood={look.view.mood}
          hat={look.hat}
          chain={look.chain}
          house={look.house}
          collar={look.collar}
          pose={bagPlay ? "bag" : begging ? "beg" : pose}
          size={size}
          flip={flip}
        />
        {(!invitationDismissed && !autonomyBlocked && discoveryEnabled && onDiscoveryNavigate) && <span className="hercules-quiet-indicator" aria-label="Guidance available">·</span>}
      </button>
    </div>
    </HerculesRigProvider>
  );
}

/** @deprecated presence is the product; kept so Home wardrobe can still show a still */
export function HerculesDock(props: Parameters<typeof HerculesPresence>[0]) {
  return <HerculesPresence {...props} />;
}

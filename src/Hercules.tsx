import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from "react";
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
  herculesIdle,
  herculesMutters,
  herculesNeedsCheck,
  herculesPageSurface,
  herculesInstrumentSurface,
  herculesTapIntent,
  herculesUsefulness,
  firstRunLesson,
  hourInToronto,
  isCurrentHerculesReply,
  kettlePhase,
  kitchenSeason,
  ledgerChats,
  listFurniture,
  perchOnFurniture,
  perchTarget,
  planHerculesTurn,
  planHerculesReadTools,
  shouldPlanHerculesTools,
  executeHerculesReadToolPlan,
  recordHerculesTalk,
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
  householdForHerculesContext,
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
  type HerculesTalk,
  type Household,
  type LedgerView,
  type HerculesNumberSource,
  type InstrumentId,
} from "./core/index.ts";
import { HerculesDress } from "./HerculesDress.tsx";
import { HerculesFigure } from "./HerculesFigure.tsx";
import { launchHerculesPro } from "./HerculesPro.tsx";
import {
  HerculesFly,
  HerculesLitterBox,
  herculesInLitter,
  herculesLitterRect,
  herculesOverFly,
  keepHerculesOutOfLitter,
  wanderFly,
} from "./HerculesFly.tsx";

const HERCULES_WIDGET_PLACEHOLDER = "jonathan is not creative enough to make prompts right now";

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
}: {
  mood: CompanionMood;
  hat: string | null;
  chain: string | null;
  house: string | null;
  collar: string | null;
  pose?: HerculesPose;
  size?: "stage" | "live" | number;
  flip?: boolean;
}) {
  const px = typeof size === "number" ? size : size === "stage" ? 120 : 96;
  return (
    <div className={`hercules-stage size-${size} mood-${mood}`} aria-hidden="true">
      <HerculesFigure pose={pose} mood={mood} size={px} flip={flip}>
        <HerculesDress hat={hat} chain={chain} house={house} collar={collar} />
      </HerculesFigure>
      {pose === "sleep" && <span className="hercules-zzz">z</span>}
    </div>
  );
}

export function HerculesPresence({
  household,
  today,
  tab,
  adding,
  visorPop,
  spark,
  memberId,
  view,
  onOpenAdd,
  onGo,
  onLedger,
  onDraft,
  onPayCard,
  onAcceptPreset,
  onDismissNotice,
  onOpenSource,
}: {
  household: Household;
  today: string;
  tab: HearthTab;
  adding: boolean;
  visorPop?: boolean;
  spark?: boolean;
  memberId: string;
  view: LedgerView;
  onOpenAdd: (note?: string) => void;
  onGo: (tab: HearthTab) => void;
  onLedger: (fn: (current: Household) => CommitResult) => void;
  onDraft?: (draft: HerculesDraft) => void;
  onPayCard?: () => void;
  onAcceptPreset?: (key: string, summary: string) => void;
  onDismissNotice?: (key: string) => void;
  onOpenSource: (source: HerculesNumberSource) => void;
}) {
  const contextHousehold = useMemo(
    () => householdForHerculesContext(household, memberId, view),
    [household, memberId, view],
  );
  const look = useMemo(() => dressedLook(household, today, Boolean(visorPop)), [household, today, visorPop]);
  const five = useMemo(() => groceryHighFive(household, today), [household, today]);
  const attention = useMemo(() => herculesNeedsCheck(household, today), [household, today]);
  const usefulness = useMemo(() => herculesUsefulness(household, today), [household, today]);
  const mutters = useMemo(() => herculesMutters(household, today), [household, today]);
  const proposal = useMemo(() => bubbleNotice(household, today), [household, today]);
  const surface = useMemo(
    () => herculesPageSurface(adding ? "add" : tab, contextHousehold, today, new Date(), { memberId, view }),
    [adding, tab, contextHousehold, today, memberId, view],
  );
  const [pos, setPos] = useState({ x: 12, y: 120 });
  const [flip, setFlip] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [motion, setMotion] = useState<HerculesPose>("loaf");
  const [talk, setTalk] = useState<HerculesTalk | null>(null);
  const [open, setOpen] = useState(false);
  const [begging, setBegging] = useState(false);
  const [bagPlay, setBagPlay] = useState(false);
  const [question, setQuestion] = useState("");
  const [topic, setTopic] = useState("idle");
  const [purr, setPurr] = useState(false);
  const [turns, setTurns] = useState<HerculesChatTurn[]>(() =>
    ledgerChats(household).slice(-12).map((row) => ({ role: row.role, text: row.text })),
  );
  const [focusedWidget, setFocusedWidget] = useState<InstrumentId | "window" | null>(null);
  const [snippets, setSnippets] = useState<WidgetSnippet[]>([]);
  const [busy, setBusy] = useState(false);
  const [replySource, setReplySource] = useState<"ai" | "local" | null>(null);
  const [fly, setFly] = useState<{ x: number; y: number } | null>(null);
  const [desktopFly, setDesktopFly] = useState(() => typeof window !== "undefined" && window.innerWidth >= WIDE_BREAKPOINT);
  const [mobileFocus, setMobileFocus] = useState(false);
  const phoneShell = !desktopFly;
  const [deadFlies, setDeadFlies] = useState(0);
  const [perchPlay, setPerchPlay] = useState(false);
  const perchPlayFor = useRef<string | null>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number; moved: boolean; lastX: number; lastY: number; caughtFly: boolean } | null>(null);
  const clickAt = useRef(0);
  const sitTimer = useRef<number | null>(null);
  const idleAt = useRef(0);
  const mutterAt = useRef(0);
  const chatGen = useRef(0);
  const chatScope = `${household.environment}\u001f${household.householdId}\u001f${memberId}`;
  const previousChatScope = useRef(chatScope);
  const activeChatIdentity = useRef<Omit<HerculesReplyContext, "requestId">>({
    environment: household.environment,
    householdId: household.householdId,
    memberId,
  });
  activeChatIdentity.current = {
    environment: household.environment,
    householdId: household.householdId,
    memberId,
  };
  const logRef = useRef<HTMLDivElement | null>(null);
  const perchedOn = useRef<string | null>(null);
  const lastAttack = useRef(0);
  const lastBump = useRef<{ id: string; at: number } | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const [bubbleSize, setBubbleSize] = useState({ w: 228, h: 96 });
  const showProposal = Boolean(proposal && !adding && !open && !begging && !(tab === "home" && focusedWidget) && !(phoneShell && mobileFocus));
  const showWidgetSnippets = Boolean(tab === "home" && focusedWidget && !adding && !(phoneShell && mobileFocus));
  const showTalk = Boolean((open || talk || begging) && !adding && talk && !(proposal && !open && !begging) && !showWidgetSnippets);
  const hideLiveCat = phoneShell && !mobileFocus;
  const focusShellOpen = phoneShell && mobileFocus && !adding;

  function catchFly() {
    if (!desktopFly || !fly) return;
    setFly(null);
    setDeadFlies((count) => count + 1);
    const viewport = { w: window.innerWidth, h: window.innerHeight };
    setFly(wanderFly(viewport, NAV, Math.random, herculesLitterRect(viewport, NAV)));
  }

  function automaticPoint(point: { x: number; y: number }): { x: number; y: number } {
    if (!desktopFly) return point;
    return keepHerculesOutOfLitter(point, { w: window.innerWidth, h: window.innerHeight }, CAT, NAV);
  }

  useLayoutEffect(() => {
    const node = bubbleRef.current;
    if (!node) return;
    const next = { w: Math.ceil(node.offsetWidth), h: Math.ceil(node.offsetHeight) };
    setBubbleSize((prev) => (
      Math.abs(prev.w - next.w) < 2 && Math.abs(prev.h - next.h) < 2 ? prev : next
    ));
  }, [showProposal, showTalk, showWidgetSnippets, talk?.spoken, proposal?.spoken, open, turns.length, snippets.length, busy]);

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
    const onResize = () => setDesktopFly(window.innerWidth >= WIDE_BREAKPOINT);
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!desktopFly || adding || pinned || open || mobileFocus || reducedMotion()) return;
    const hop = () => {
      const next = furnitureLand(false, look.view.mood, today);
      perchedOn.current = next.on;
      setFlip(next.faceRight);
      setPos(automaticPoint({ x: next.x, y: next.y }));
      setMotion("walk");
      window.setTimeout(() => setMotion(next.pose === "loaf" ? "loaf" : next.pose), 900);
    };
    hop();
    const id = window.setInterval(hop, 5400);
    return () => window.clearInterval(id);
  }, [desktopFly, adding, pinned, open, mobileFocus, look.view.mood, today]);

  useEffect(() => {
    if (adding || reducedMotion() || !desktopFly) {
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
  }, [adding, tab, desktopFly]);

  useEffect(() => {
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
      if (intent.type !== "expand" || adding) return;
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
  }, [contextHousehold, today, adding, tab]);

  useEffect(() => {
    if (visorPop) {
      setMotion("jump");
      const id = window.setTimeout(() => setMotion("celebrate"), 700);
      return () => window.clearTimeout(id);
    }
  }, [visorPop]);

  useEffect(() => {
    if (open || pinned || adding || drag.current) return;
    const id = window.setInterval(() => {
      idleAt.current += 1;
      const phase = idleAt.current % 6;
      const here = pos;
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
          if (!open) {
            setTalk({ spoken: "mrrp", lesson: null, fact: null, replies: [], pose: "attack", topic: "attack", attention: false });
            window.setTimeout(() => setTalk((current) => (current?.topic === "attack" ? null : current)), 1800);
          }
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
        if (!open) {
          setTalk({ spoken: "mrrp", lesson: null, fact: null, replies: [], pose: "attack", topic: "attack", attention: false });
          window.setTimeout(() => setTalk((current) => (current?.topic === "attack" ? null : current)), 1800);
        }
        return;
      }
      if (fly && !reducedMotion() && (phase === 0 || phase === 3) && Date.now() - lastAttack.current > 45_000) {
        lastAttack.current = Date.now();
        catchFly();
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
          window.setTimeout(() => setMotion(landing), 950);
        }
      } else if (phase === 1) setMotion(look.view.mood === "glowing" || look.view.mood === "content" ? "lick" : "wash");
      else if (phase === 2) setMotion("stretch");
      else if (phase >= 4 && look.view.mood === "glowing") setMotion("sleep");
      else setMotion("perch");
    }, 9000);
    return () => window.clearInterval(id);
  }, [open, pinned, adding, look.view.mood, pos.x, pos.y, today, fly]);

  useEffect(() => {
    return subscribeFurniture(() => {
      if (pinned || adding || open || drag.current) return;
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
  }, [pinned, adding, open, look.view.mood, today]);

  useEffect(() => {
    if (adding || open || !mutters || proposal || (tab === "home" && !focusedWidget)) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      if (now - mutterAt.current < 45000) return;
      mutterAt.current = now;
      const idle = herculesIdle(household, tab, today);
      setTalk(idle);
      setTopic(idle.topic);
      setMotion(idle.pose);
      window.setTimeout(() => setTalk((current) => (current === idle ? null : current)), 5000);
    }, 16000);
    return () => window.clearInterval(id);
  }, [adding, open, mutters, household, tab, today, proposal]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [turns, busy]);

  useEffect(() => {
    if (previousChatScope.current === chatScope) return;
    previousChatScope.current = chatScope;
    chatGen.current += 1;
    setBusy(false);
    setReplySource(null);
    setQuestion("");
    setTalk(null);
    setTurns(ledgerChats(household).slice(-12).map((row) => ({ role: row.role, text: row.text })));
    setSnippets(focusedWidget
      ? [{ role: "hercules", text: HERCULES_WIDGET_PLACEHOLDER, placeholder: true }]
      : []);
  }, [chatScope, focusedWidget, household]);

  useEffect(() => {
    if (busy) return;
    setTurns(ledgerChats(household).slice(-12).map((row) => ({ role: row.role, text: row.text })));
  }, [household, busy]);

  function keepTalk(userText: string | undefined, herculesText: string, source: "journal" | "memory" | "local" | "ai", memory?: { kind: "note" | "payday" | "bill" | "habit" | "preference"; text: string; label: string } | null) {
    onLedger((current) => recordHerculesTalk(current, {
      author: memberId,
      userText,
      herculesText,
      source,
      memory: memory ?? null,
    }));
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
    chatGen.current += 1;
    setOpen(false);
    setTalk(null);
    setBusy(false);
    setQuestion("");
    setBegging(false);
    setReplySource(null);
    setTurns([]);
    if (phoneShell) setMobileFocus(false);
    if (focusedWidget) {
      setSnippets([{ role: "hercules", text: HERCULES_WIDGET_PLACEHOLDER, placeholder: true }]);
    } else {
      setSnippets([]);
    }
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

  function beginBeg() {
    setBegging(true);
    setOpen(false);
    setMotion(usefulness.animation > 0.55 ? "beg" : usefulness.animation > 0.25 ? "beg" : "sit");
    setTalk({
      spoken: usefulness.spoken,
      lesson: null,
      fact: usefulness.reasons[0] ? { label: "Useful?", value: usefulness.reasons[0] } : null,
      replies: [],
      pose: "beg",
      topic: "beg",
      attention: true,
    });
  }

  function openChatFromBeg() {
    setBegging(false);
    const page = adding ? "add" : tab;
    const instrument = currentInstrument();
    const help = openHelpState({ tab: page, instrument, household: contextHousehold, today });
    const lesson = firstRunLesson(`page:${page}`, surface.lesson);
    applyTalk({
      spoken: help.spoken,
      lesson,
      fact: surface.fact,
      replies: help.replies,
      pose: usefulness.light === "green" ? "celebrate" : "perch",
      topic: instrument ?? topic,
      attention: false,
    });
  }

  function applyTalk(next: HerculesTalk, userText?: string) {
    setTalk(next);
    setTopic(next.topic);
    setMotion(next.pose === "sleep" ? "loaf" : next.pose);
    setQuestion("");
    setOpen(true);
    if (focusedWidget && tab === "home") {
      pushSnippet(userText, next.spoken);
      return;
    }
    setTurns((prev) => {
      if (!userText && !prev.some((turn) => turn.role === "user")) {
        return [{ role: "hercules", text: next.spoken }];
      }
      const add: HerculesChatTurn[] = [];
      if (userText) add.push({ role: "user", text: userText });
      add.push({ role: "hercules", text: next.spoken });
      return [...prev, ...add].slice(-12);
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

  function speak(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;
    const helpCmd = matchHelpCommand(
      helpCommands({ tab: adding ? "add" : tab, instrument: currentInstrument(), household, today }),
      text,
    );
    if (helpCmd) applyHelpNav(helpCmd);
    if (goShortcut(helpCmd?.prompt ?? text)) return;
    if (calendarEventIntent(text)) directToCalendar();
    const plan = planHerculesTurn(household, helpCmd?.prompt ?? text, today, adding ? "add" : tab, topic, { memberId, view });
    if (plan.draft) {
      onDraft?.(plan.draft);
      keepTalk(text, plan.talk.spoken, "journal");
      closeChat();
      return;
    }
    if (plan.skipModel) {
      applyTalk(plan.talk, text);
      keepTalk(text, plan.talk.spoken, plan.source, plan.memory);
      setReplySource(null);
      return;
    }
    void sendChat(helpCmd?.prompt ?? text);
  }

  async function sendChat(raw: string) {
    const message = raw.trim();
    if (!message || busy) return;
    const helpCmd = matchHelpCommand(
      helpCommands({ tab: adding ? "add" : tab, instrument: currentInstrument(), household, today }),
      message,
    );
    if (helpCmd) applyHelpNav(helpCmd);
    const text = helpCmd?.prompt ?? message;
    if (goShortcut(text)) return;
    if (calendarEventIntent(message) || calendarEventIntent(text)) directToCalendar();
    const page = adding ? "add" : tab;
    const plan = planHerculesTurn(household, text, today, page, topic, { memberId, view });
    if (plan.draft) {
      onDraft?.(plan.draft);
      keepTalk(message, plan.talk.spoken, "journal");
      closeChat();
      return;
    }
    if (plan.skipModel) {
      applyTalk(plan.talk, message);
      keepTalk(message, plan.talk.spoken, plan.source, plan.memory);
      setReplySource(null);
      return;
    }
    setReplySource(null);
    const grounded = plan.talk;
    const briefing = herculesBriefing(contextHousehold, page, today);
    const gen = chatGen.current + 1;
    chatGen.current = gen;
    const replyContext: HerculesReplyContext = {
      ...activeChatIdentity.current,
      requestId: gen,
    };
    setTurns((prev) => [...prev, { role: "user" as const, text: message }].slice(-12));
    if (focusedWidget && tab === "home") pushSnippet(message, "mrrp…");
    setQuestion("");
    setBusy(true);
    setOpen(true);
    setTalk(grounded);
    setTopic(grounded.topic);
    setMotion("pounce");
    const toolPlan = shouldPlanHerculesTools(text)
      ? await planHerculesReadTools({ message: text, page, view })
      : { calls: [] };
    if (!isCurrentHerculesReply(replyContext, {
      ...activeChatIdentity.current,
      requestId: chatGen.current,
    })) return;
    if (toolPlan.calls.length) {
      const investigation = executeHerculesReadToolPlan(household, toolPlan, today, { memberId, view });
      const groundedAnswer = investigation.talk;
      const voiced = await chatHercules({
        message: text,
        briefing,
        householdId: household.householdId,
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
      setTurns((prev) => [...prev, { role: "hercules" as const, text: answer.spoken }].slice(-12));
      if (focusedWidget && tab === "home") {
        setSnippets((prev) => {
          const trimmed = prev.filter((row) => row.text !== "mrrp…");
          return [...trimmed, { role: "hercules" as const, text: answer.spoken.slice(0, 160) }].slice(-8);
        });
      }
      setMotion(answer.pose);
      setBusy(false);
      setReplySource(usedModelVoice ? "ai" : null);
      keepTalk(message, answer.spoken, usedModelVoice ? "ai" : "journal");
      return;
    }
    const result = await chatHercules(
      composeHerculesChatRequest(household, message, briefing, today, memberId, topic, {
        shareCoordsWithModel: loadPhonePlacePrefs(household.environment).shareCoordsWithModel,
        view,
      }),
    );
    if (!isCurrentHerculesReply(replyContext, {
      ...activeChatIdentity.current,
      requestId: chatGen.current,
    })) return;
    setTalk({ ...grounded, spoken: result.text });
    setTurns((prev) => [...prev, { role: "hercules" as const, text: result.text }].slice(-12));
    if (focusedWidget && tab === "home") {
      setSnippets((prev) => {
        const trimmed = prev.filter((row) => row.text !== "mrrp…");
        const next: WidgetSnippet = { role: "hercules", text: result.text.slice(0, 160) };
        return [...trimmed, next].slice(-8);
      });
    }
    setMotion(grounded.pose === "sleep" ? "loaf" : grounded.pose);
    setBusy(false);
    setReplySource(result.source);
    keepTalk(message, result.text, result.source === "ai" ? "ai" : "local");
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
      const now = Date.now();
      const doubleSit = now - clickAt.current < 420;
      clickAt.current = now;
      if (doubleSit) {
        if (sitTimer.current) {
          window.clearTimeout(sitTimer.current);
          sitTimer.current = null;
        }
        sitWithBag();
        return;
      }
      const intent = herculesTapIntent({
        openHelpOnTap: usefulness.openHelpOnTap,
        chatOpen: open,
        begging,
      });
      if (intent === "close") {
        closeChat();
        setMotion(pinned ? "sit" : "loaf");
        return;
      }
      if (intent === "open-help" && begging) {
        openChatFromBeg();
        return;
      }
      // Delay first tap so a second immediate click can become sit instead.
      if (sitTimer.current) window.clearTimeout(sitTimer.current);
      sitTimer.current = window.setTimeout(() => {
        sitTimer.current = null;
        if (focusedWidget && tab === "home") {
          setOpen(true);
          return;
        }
        const next = herculesTapIntent({
          openHelpOnTap: usefulness.openHelpOnTap,
          chatOpen: false,
          begging: false,
        });
        if (next === "open-help") openChatFromBeg();
        else beginBeg();
      }, 280);
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

  return (
    <div className={`hercules-world ${hideLiveCat ? "is-phone-compact" : ""} ${focusShellOpen ? "is-focus-open" : ""} ${desktopFly ? "is-desktop-wander" : ""}`} aria-live="polite">
      {desktopFly && !adding && !reducedMotion() && (
        <HerculesLitterBox deadFlies={deadFlies} />
      )}
      <HerculesFly x={fly?.x ?? 0} y={fly?.y ?? 0} hidden={!desktopFly || !fly || adding || reducedMotion()} />
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
            {busy && <p className="hercules-snippet cat">mrrp…</p>}
          </div>
          {open && (
            <form
              className="hercules-chat-form"
              onSubmit={(event) => {
                event.preventDefault();
                void sendChat(question);
              }}
            >
              <input
                aria-label={`Ask ${look.view.name}`}
                value={question}
                placeholder={busy ? "mrrp…" : surface.placeholder}
                disabled={busy}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") closeChat();
                }}
              />
              <button type="submit" disabled={busy || !question.trim()}>send</button>
            </form>
          )}
        </div>
      )}
      {phoneShell && !adding && !mobileFocus && (
        <button
          type="button"
          className={`hercules-pill ${attention || begging ? "needs-you" : ""} ${showProposal ? "has-note" : ""}`}
          aria-label={`Talk to ${look.view.name}. Opens focus mode.`}
          onClick={openMobileFocus}
        >
          <HerculesPortrait
            mood={look.view.mood}
            hat={look.hat}
            chain={look.chain}
            house={look.house}
            collar={look.collar}
            pose="loaf"
            size={40}
          />
          <span className="hercules-pill-name">{look.view.name}</span>
        </button>
      )}
      {focusShellOpen && (
        <div className="hercules-focus-shell" role="dialog" aria-modal="true" aria-label={`${look.view.name} focus`}>
          <button type="button" className="hercules-focus-close" onClick={closeChat} aria-label="Close focus mode">
            Close
          </button>
          <div className="hercules-focus-hero">
            <HerculesPortrait
              mood={look.view.mood}
              hat={look.hat}
              chain={look.chain}
              house={look.house}
              collar={look.collar}
              pose={pose}
              size={120}
            />
          </div>
          <div className="hercules-focus-body">
            {talk ? (
              <>
            {open && turns.length > 0 ? (
              <div className="hercules-chat-log" ref={logRef}>
                {turns.slice(-8).map((turn, index) => (
                  <p key={`${turn.role}-${index}-${turn.text.slice(0, 12)}`} className={`hercules-turn ${turn.role === "user" ? "you" : "cat"}`}>
                    {turn.text}
                  </p>
                ))}
                {busy && <p className="hercules-typing">mrrp…</p>}
              </div>
            ) : (
              <p className="hercules-spoken">{talk.spoken}</p>
            )}
            {!busy && talk.lesson && <p className="hercules-lesson">{talk.lesson}</p>}
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
                {talk.replies.map((item) => (
                  <button key={item} type="button" onClick={() => speak(item)}>{item}</button>
                ))}
              </div>
            )}
            <form
              className="hercules-chat-form"
              onSubmit={(event) => {
                event.preventDefault();
                void sendChat(question);
              }}
            >
              <input
                aria-label={`Ask ${look.view.name}`}
                value={question}
                placeholder={busy ? "mrrp…" : surface.placeholder}
                disabled={busy}
                onChange={(event) => setQuestion(event.target.value)}
              />
              <button type="submit" disabled={busy || !question.trim()}>send</button>
            </form>
              </>
            ) : (
              <p className="hercules-spoken">mrrp…</p>
            )}
          </div>
        </div>
      )}
      {showProposal && proposal && phoneShell && !mobileFocus && (
        <div className="hercules-pill-note" role="status">
          <p>{proposal.spoken}</p>
          <div className="hercules-replies">
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
      {showTalk && talk && !focusShellOpen && (
        <div
          ref={bubbleRef}
          className={`hercules-bubble ${bubbleSide} ${open ? "chat" : ""}`}
          style={bubbleStyle}
        >
          {open && !begging && (
            <button
              type="button"
              className="hercules-help"
              onClick={() => {
                const page = adding ? "add" : tab;
                const instrument = currentInstrument();
                const help = openHelpState({ tab: page, instrument, household: contextHousehold, today });
                applyTalk({
                  spoken: help.spoken,
                  lesson: null,
                  fact: surface.fact,
                  replies: help.replies,
                  pose: "perch",
                  topic: instrument ?? topic,
                  attention: false,
                });
              }}
            >
              How can I help
            </button>
          )}
          {open && !begging && turns.length > 0 ? (
            <div className="hercules-chat-log" ref={logRef}>
              {turns.slice(-6).map((turn, index) => (
                <p key={`${turn.role}-${index}-${turn.text.slice(0, 12)}`} className={`hercules-turn ${turn.role === "user" ? "you" : "cat"}`}>
                  {turn.text}
                </p>
              ))}
              {busy && <p className="hercules-typing">mrrp…</p>}
            </div>
          ) : (
            <p className="hercules-spoken">{talk.spoken}</p>
          )}
          {!busy && talk.lesson && <p className="hercules-lesson">{talk.lesson}</p>}
          {open && !busy && replySource && (
            <p className="hercules-source">{replySource === "ai" ? "ai" : "on-device"}</p>
          )}
          {open && !busy && !replySource && turns.some((turn) => turn.role === "user") && (
            <p className="hercules-source">Kept in the kitchen ledger. Same door as the books.</p>
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
                  aria-label={`${fact.label}: ${fact.value}. ${fact.source.label}`}
                >
                  <span>{fact.label}</span>
                  <strong>{fact.value}</strong>
                  <small>{fact.basis === "projection" ? "calculated" : "from books"} · open</small>
                </button>
              ))}
            </div>
          )}
          {!busy && groundedFacts.length === 0 && talk.fact && (
            <p className="hercules-fact"><span>{talk.fact.label}</span> {talk.fact.value}</p>
          )}
          {open && !begging && (
            <>
              <button
                type="button"
                className="hercules-pro-launch"
                onClick={launchHerculesPro}
                title="Optional ChatGPT companion. Free Hercules stays available here."
              >
                Use Hercules Pro ↗
              </button>
              {!busy && (
                <div className="hercules-replies">
                  {talk.replies.map((item) => (
                    <button key={item} type="button" onClick={() => speak(item)}>{item}</button>
                  ))}
                </div>
              )}
              <form
                className="hercules-chat-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void sendChat(question);
                }}
              >
                <input
                  aria-label={`Ask ${look.view.name}`}
                  value={question}
                  placeholder={busy ? "mrrp…" : surface.placeholder}
                  disabled={busy}
                  onChange={(event) => setQuestion(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") closeChat();
                  }}
                />
                <button type="submit" disabled={busy || !question.trim()}>send</button>
              </form>
            </>
          )}
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
          attention || begging ? "needs-you" : "",
          begging ? "is-begging" : "",
          bagPlay ? "is-bag" : "",
          `useful-${usefulness.light}`,
          adding ? "loafing is-adding" : "",
          pinned ? "pinned" : "",
          reducedMotion() ? "cut-motion" : "",
        ].join(" ")}
        style={{ left: pos.x, top: pos.y, width: size, height: size, ["--herc-useful" as string]: String(usefulness.animation) }}
        aria-label={
          begging
            ? `${look.view.name} is begging — tap again for help`
            : usefulness.openHelpOnTap
              ? `Talk to ${look.view.name}. Tap for How can I help. Double-tap to sit.`
              : attention
                ? `${look.view.name} wants a check-in`
                : `Talk to ${look.view.name}. Double-tap to sit.`
        }
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
        <HerculesPortrait
          mood={look.view.mood}
          hat={look.hat}
          chain={look.chain}
          house={look.house}
          collar={look.collar}
          pose={bagPlay ? "bag" : begging ? "beg" : pose}
          size={size}
          flip={flip}
        />
        <span className={`hercules-useful useful-${usefulness.light}`} aria-hidden="true">!</span>
      </button>
    </div>
  );
}

/** @deprecated presence is the product; kept so Home wardrobe can still show a still */
export function HerculesDock(props: Parameters<typeof HerculesPresence>[0]) {
  return <HerculesPresence {...props} />;
}

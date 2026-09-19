import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { addDays, daysInMonthKey, monthKeyFromDateKey, shiftMonthKey, weekdaySunday0, type DateKey } from "../../core/calendar.ts";
import type { Household, LedgerView } from "../../core/types.ts";
import { useAppearance } from "../../theme/ThemeProvider.tsx";
import type { ThemeId } from "../../theme/scenes.ts";
import { JOURNEY_LEVELS, JOURNEY_LEVEL_LABEL, type JourneyFocusApi, type JourneyLevel } from "../journeyFocus.ts";
import { flatLayout } from "./MiniFlat.tsx";
import { useMiniJourneyLoad } from "./miniJourneyLoader.ts";
import {
  MINI_LANE_LABEL,
  miniCad,
  miniDateLabel,
  miniEraFor,
  miniItemWords,
  miniMonthLabel,
  type MiniFund,
  type MiniEra,
  type MiniItem,
  type MiniJourney,
  type MiniMonth,
  type MiniMonthSummary,
} from "./miniJourneyModel.ts";
import { miniLevelWeight, type MiniFrame, type MiniQuality, type MiniSceneEra, type MiniSceneInput, type MiniWho, type MiniWorld } from "./miniWorld3d.ts";
import "./journey-mini.css";

/**
 * The journey's simple view (D-284): a small 3D model of our money through
 * time that zooms from one day's bills and to-dos out to the whole journey,
 * with the Prepare / Protect / Build lanes carrying their trackers, and a door
 * into the open world. It shares one focus with the open world
 * (`JourneyFocusApi`): moving here moves the world, and the world's moves land
 * here. Nothing here posts money or stores anything.
 */

export type JourneyMiniProps = {
  household: Household;
  memberId: string;
  today: DateKey;
  focus: JourneyFocusApi;
  onOpenWorld: () => void;
  /** A small corner minimap (inside game mode): no card chrome, tiny scale, still interactive. */
  compact?: boolean;
  /** Proof pages only; the app follows the signed-in person's appearance. */
  theme?: ThemeId;
  /** The open world's quality setting: Lite draws the flat map. */
  quality?: "full" | "lite";
  view?: LedgerView;
  /** Optional doors from a card. Only links. */
  onOpenFund?: () => void;
  onOpenPlanner?: () => void;
  /** Proof pages only: the live renderer. */
  proofWorld?: (world: MiniWorld | null) => void;
  /** The open world is on screen and this (page) copy sits hidden behind it: stop drawing, keep following the focus. */
  worldOpen?: boolean;
  /** My own private to-dos show (default true). The page turns them off at the Dim lantern, like the world's footpaths. */
  privateShown?: boolean;
};

type Card = { id: string; eyebrow: string; title: string; lines: string[]; actions: { label: string; run: () => void; primary?: boolean }[] };
type LabelDef = {
  id: string;
  anchor: string;
  pick: string;
  /** Level centres where it shows (0 Day … 4 Journey). */
  levels: number[];
  priority: number;
  className: string;
  content: ReactNode;
  aria: string;
  /** Only near the focused day (in days) at the Day/Week levels. */
  near?: { day: number; within: number };
  minWidth?: number;
  maxWidth?: number;
  below?: boolean;
};

/** The Fund's lanes before they are read: names only (the labels shimmer until the numbers land). */
const PENDING_FUND: MiniFund = {
  ready: false,
  lanes: {
    prepare: { lane: "prepare", label: MINI_LANE_LABEL.prepare, amountCents: null, targetCents: null },
    protect: { lane: "protect", label: MINI_LANE_LABEL.protect, amountCents: null, targetCents: null },
    build: { lane: "build", label: MINI_LANE_LABEL.build, amountCents: null, targetCents: null },
  },
  everyday: { lane: "everyday", label: MINI_LANE_LABEL.everyday, amountCents: null, targetCents: null },
  source: "",
};
const LEVEL_INDEX: Record<JourneyLevel, number> = { day: 0, week: 1, month: 2, era: 3, journey: 4 };
const NOTE = "Prepare, Protect and Build are a way of thinking about one Fund. Nothing on this map moves money at a bank.";
const NOTE_SHORT = "The lanes are a way of thinking. Nothing here moves money.";

function readReduced(): boolean {
  return (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches)
    || (typeof document !== "undefined" && document.documentElement.dataset.motion === "reduced");
}
function readForced(): boolean {
  return typeof matchMedia === "function" && matchMedia("(forced-colors: active)").matches;
}
const clampDate = (date: DateKey, span: { from: DateKey; to: DateKey }) => (date < span.from ? span.from : date > span.to ? span.to : date);
const dayOf = (date: DateKey) => Number(date.slice(8, 10));
const withDay = (month: string, day: number) => `${month}-${String(Math.max(1, Math.min(daysInMonthKey(month), day))).padStart(2, "0")}`;

function skeletonMonth(head: MiniMonthSummary, today: DateKey): MiniMonth {
  const dim = daysInMonthKey(head.key);
  const days = Array.from({ length: dim }, (_, i) => {
    const date = withDay(head.key, i + 1);
    return { date, day: i + 1, weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][weekdaySunday0(date)]!, today: date === today, past: date < today, items: [], billCents: 0, inCents: 0 };
  });
  const weeks = days.filter((d) => d.day === 1 || weekdaySunday0(d.date) === 0).map((d) => {
    let end = d.date;
    while (end < days[dim - 1]!.date && weekdaySunday0(addDays(end, 1)) !== 0) end = addDays(end, 1);
    return { start: d.date, end, label: `${miniDateLabel(d.date, false)}–${dayOf(end)}`, billCents: 0, inCents: 0, tasks: 0, hasToday: today >= d.date && today <= end };
  });
  return { ...head, days, weeks, billCents: 0, inCents: 0, bills: 0, contributions: 0, tasks: 0, fundReady: false };
}

export function JourneyMini(props: JourneyMiniProps) {
  const { household, memberId, today, focus, onOpenWorld, compact = false, view = "household" } = props;
  const appearance = useAppearance();
  const theme: ThemeId = props.theme ?? appearance.scene.theme;
  const [reduced] = useState(readReduced);
  const [forced] = useState(readForced);

  // ------------------------------------------------------------------ the model (staged, off the main thread, shared per household)
  const load = useMiniJourneyLoad(household, { memberId, view, today });
  const { base, month: nowMonthDetail, fund: loadedFund } = load.state;
  const journey: MiniJourney | null = useMemo(() => {
    if (!base) return null;
    const head = base.months.find((m) => m.key === base.nowMonth);
    return {
      ...base,
      month: nowMonthDetail ?? (head ? skeletonMonth(head, today) : skeletonMonth({ key: base.nowMonth, label: miniMonthLabel(base.nowMonth), shortLabel: miniMonthLabel(base.nowMonth, false), worldIndex: null, worldId: null, eraId: null, lap: 0, status: "open", sitdown: "none", booksClosed: false, current: true, chapter: null }, today)),
      fund: loadedFund ?? PENDING_FUND,
    };
  }, [base, nowMonthDetail, loadedFund, today]);
  const fundPending = Boolean(base && !loadedFund);

  // ------------------------------------------------------------------ focus (shared with the world)
  const [level, setLevelState] = useState<number>(() => LEVEL_INDEX[focus.focus.level] ?? 1);
  const [date, setDateState] = useState<DateKey>(() => focus.focus.date || today);
  const [card, setCard] = useState<Card | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [live, setLive] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [announce, setAnnounce] = useState("");
  const levelRef = useRef(level);
  levelRef.current = level;
  const dateRef = useRef(date);
  dateRef.current = date;
  const focusRef = useRef(focus);
  focusRef.current = focus;
  const lastSeq = useRef(-1);
  const pendingSelect = useRef<string | null>(null);

  // Two copies can be mounted (the page and the open world's corner) and both speak as "mini": a copy skips only
  // its own echo (a change it shared a moment ago), and follows the other copy's moves.
  const sharedAt = useRef(-Infinity);
  const share = useCallback((change: { level?: number; date?: DateKey; selected?: string | null }) => {
    sharedAt.current = typeof performance !== "undefined" ? performance.now() : Date.now();
    const next: Parameters<JourneyFocusApi["set"]>[0] = {};
    if (change.level !== undefined) next.level = JOURNEY_LEVELS[change.level]!;
    if (change.date !== undefined) next.date = change.date;
    if (change.selected !== undefined) next.selected = change.selected;
    focusRef.current.set(next, "mini");
  }, []);

  const span = journey?.span ?? { from: `${shiftMonthKey(monthKeyFromDateKey(today), -12)}-01`, to: `${shiftMonthKey(monthKeyFromDateKey(today), 12)}-28` };
  const setLevel = useCallback((next: number, opts: { silent?: boolean } = {}) => {
    const value = Math.max(0, Math.min(4, Math.round(next)));
    setLevelState(value);
    if (!opts.silent) share({ level: value });
  }, [share]);
  const setDate = useCallback((next: DateKey, opts: { silent?: boolean } = {}) => {
    setDateState(next);
    if (!opts.silent) share({ date: next });
  }, [share]);

  // The world (or the page) moved: follow it.
  useEffect(() => {
    const f = focus.focus;
    if (f.seq === lastSeq.current) return;
    lastSeq.current = f.seq;
    if (f.source === "mini" && (typeof performance !== "undefined" ? performance.now() : Date.now()) - sharedAt.current < 400) return;
    const nextLevel = LEVEL_INDEX[f.level] ?? levelRef.current;
    if (nextLevel !== levelRef.current) setLevelState(nextLevel);
    if (f.date && f.date !== dateRef.current) setDateState(f.date);
    if (f.selected) pendingSelect.current = f.selected;
    else if (f.source === "world") setCard(null);
  }, [focus.focus]);

  const monthKey = monthKeyFromDateKey(clampDate(date, span));
  const monthHead = useMemo<MiniMonthSummary>(() => journey?.months.find((m) => m.key === monthKey) ?? {
    key: monthKey, label: miniMonthLabel(monthKey), shortLabel: miniMonthLabel(monthKey, false), worldIndex: null, worldId: null, eraId: null, lap: 0,
    status: monthKey > monthKeyFromDateKey(today) ? "ahead" : monthKey === monthKeyFromDateKey(today) ? "open" : "open", sitdown: "none", booksClosed: false, current: monthKey === monthKeyFromDateKey(today), chapter: null,
  }, [journey, monthKey, today]);
  const cachedMonth = journey ? (monthKey === journey.nowMonth ? nowMonthDetail : load.month(monthKey)) : null;
  const skeleton = useMemo(() => skeletonMonth(monthHead, today), [monthHead, today]);
  const privateShown = props.privateShown !== false;
  const month: MiniMonth = useMemo(() => {
    const m = cachedMonth ?? skeleton;
    if (privateShown || !m.days.some((d) => d.items.some((i) => i.kind === "task" && i.private))) return m;
    const days = m.days.map((d) => ({ ...d, items: d.items.filter((i) => !(i.kind === "task" && i.private)) }));
    const hidden = m.days.reduce((n, d) => n + d.items.filter((i) => i.kind === "task" && i.private).length, 0);
    const weeks = m.weeks.map((w) => ({ ...w, tasks: days.filter((d) => d.date >= w.start && d.date <= w.end).reduce((n, d) => n + d.items.filter((i) => i.kind === "task").length, 0) }));
    return { ...m, days, weeks, tasks: m.tasks - hidden };
  }, [cachedMonth, skeleton, privateShown]);
  const monthLoading = Boolean(journey && !cachedMonth);
  const requestMonth = load.request;
  useEffect(() => {
    if (!journey || cachedMonth || monthKey === journey.nowMonth) return;
    // A short pause: scrubbing through months only reads the one it stops on.
    const timer = setTimeout(() => requestMonth(monthKey), 90);
    return () => clearTimeout(timer);
  }, [journey, cachedMonth, monthKey, requestMonth]);

  // Eras: the focused era, or the one we are in. A household without a journey reads as one open era.
  const eras: MiniEra[] = useMemo(() => {
    if (!journey) return [];
    if (journey.eras.length) return journey.eras;
    const nowMonth = journey.nowMonth;
    const months = journey.months.filter((m) => m.key <= shiftMonthKey(nowMonth, 6)).slice(-24);
    return [{
      id: "path", worldId: "era-home", order: 1, name: "Our path so far", finishLine: "", state: "current", from: months[0]?.key ?? nowMonth, to: months.at(-1)?.key ?? nowMonth,
      openEnded: true, home: "flat", homeLabel: "home", months: months.map((m, i) => ({ ...m, lap: i })), monthCount: months.length, finishKind: "agree", banks: [], banksFull: 0,
      finishMet: false, finishWhy: "", plans: [],
    }];
  }, [journey]);
  const focusEra = (journey && (miniEraFor({ eras }, monthKey) ?? eras.find((e) => e.state === "current") ?? eras[0])) || null;
  const eraIndex = focusEra ? eras.indexOf(focusEra) : -1;
  const currentEraIndex = eras.findIndex((e) => e.state === "current");
  const lapIndex = focusEra ? Math.max(0, focusEra.months.findIndex((m) => m.key === monthKey) >= 0 ? focusEra.months.findIndex((m) => m.key === monthKey) : monthHead.lap) : 0;

  const members = useMemo(() => household.members.filter((m) => m.active).map((m) => m.id), [household.members]);
  const whoOf = useCallback((id: string | null): MiniWho => (id && id === members[0] ? "a" : id && id === members[1] ? "b" : "both"), [members]);

  const sceneEras: MiniSceneEra[] = useMemo(() => eras.map((era) => ({
    id: era.id, state: era.state, home: era.home, laps: era.monthCount,
    plans: era.plans.map((plan) => ({ kind: plan.kind, fill: plan.bank ? plan.bank.fill : null })),
  })), [eras]);
  const sceneInput: MiniSceneInput | null = useMemo(() => {
    if (!journey) return null;
    return {
      theme,
      monthKey,
      anchorDay: Math.min(dayOf(today), daysInMonthKey(monthKey)),
      gate: month.status === "closed" ? "closed" : month.status === "ahead" ? "ahead" : "open",
      startGate: (() => { const prev = journey.months.find((m) => m.key === shiftMonthKey(monthKey, -1)); return prev ? (prev.status === "closed" ? "closed" : prev.status === "ahead" ? "ahead" : "open") : null; })(),
      days: month.days.map((d) => ({
        date: d.date, day: d.day, today: d.today, past: d.past,
        bills: d.items.flatMap((i) => (i.kind === "bill" ? [i.lane] : [])),
        contributions: d.items.flatMap((i) => (i.kind === "contribution" ? [{ expected: i.expected, split: i.split }] : [])),
        tasks: d.items.flatMap((i) => (i.kind === "task" ? [{ who: whoOf(i.whoId), done: i.done }] : [])),
      })),
      eraIndex: Math.max(0, eraIndex),
      laps: (focusEra?.months ?? []).map((m) => ({ key: m.key, status: m.status, current: m.current })),
      lap: lapIndex,
      banks: (focusEra?.banks ?? []).map((b) => ({ id: b.goalId, fill: b.fill, full: b.full, bought: b.bought })),
      eras: sceneEras,
      currentEra: currentEraIndex,
    };
  }, [journey, theme, monthKey, today, month, eraIndex, focusEra, lapIndex, sceneEras, currentEraIndex, whoOf]);

  // ------------------------------------------------------------------ the renderer
  const qualityProp = props.quality ?? "full";
  const flat = qualityProp === "lite" || forced || !live;
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const world = useRef<MiniWorld | null>(null);
  const labelEls = useRef(new Map<string, HTMLButtonElement>());
  const labelDefs = useRef<LabelDef[]>([]);
  const sizes = useRef(new Map<string, { w: number; h: number; key: string }>());
  const zNow = useRef(level);
  const proofRef = useRef(props.proofWorld);
  proofRef.current = props.proofWorld;

  const applyFrame = useCallback((frame: MiniFrame) => {
    zNow.current = frame.z;
    const byId = new Map(frame.anchors.map((a) => [a.id, a]));
    const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
    // The stage's own controls (Where we are, the corner caption) are obstacles labels keep clear of.
    for (const el of stage.current?.querySelectorAll<HTMLElement>("[data-obstacle]") ?? []) {
      if (el.offsetParent === null) continue;
      placed.push({ x0: el.offsetLeft, x1: el.offsetLeft + el.offsetWidth, y0: el.offsetTop, y1: el.offsetTop + el.offsetHeight });
    }
    const defs = [...labelDefs.current].sort((a, b) => a.priority - b.priority);
    const laneBoxes: { x0: number; x1: number; y0: number; y1: number }[] = [];
    const railLeft = compact ? 0 : frame.width >= 540 ? 84 : 0;
    for (const def of defs) {
      const el = labelEls.current.get(def.id);
      if (!el) continue;
      let w = def.levels.reduce((best, c) => Math.max(best, miniLevelWeight(frame.z, c, 0.22, 0.48)), 0);
      if (def.near && frame.z < 1.6) w *= 1 - Math.max(0, Math.min(1, (Math.abs(def.near.day - frame.day) - def.near.within) / 1.2));
      if (def.minWidth && frame.width < def.minWidth) w = 0;
      if (def.maxWidth && frame.width >= def.maxWidth) w = 0;
      const a = byId.get(def.anchor);
      if (!a || !a.visible) w = 0;
      let visible = w > 0.04;
      if (visible && a) {
        const key = `${el.textContent ?? ""}|${frame.width}`;
        let size = sizes.current.get(def.id);
        const paper = el.firstElementChild as HTMLElement | null;
        if (!size || size.key !== key) {
          // Measure while laid out (a hidden label measures 0).
          const wasHidden = el.hidden;
          if (wasHidden) { el.style.visibility = "hidden"; el.hidden = false; }
          size = { w: paper?.offsetWidth || el.offsetWidth || 90, h: paper?.offsetHeight || 24, key };
          if (wasHidden) { el.hidden = true; el.style.visibility = ""; }
          sizes.current.set(def.id, size);
        }
        const lane = def.id.startsWith("lane:");
        let x0 = lane ? Math.max(a.x, railLeft + 4) : a.x - size.w / 2;
        let y0 = lane ? a.y - size.h / 2 : def.below ? a.y + 6 : a.y - size.h;
        // An important label nudges itself back inside the stage rather than disappearing at the edge.
        const nudge = def.priority <= 2 && !lane;
        if (nudge) {
          x0 = Math.max(railLeft + 4, Math.min(frame.width - size.w - 4, x0));
          y0 = Math.max(4, Math.min(frame.height - size.h - 4, y0));
        }
        const pad = lane ? 0 : 2;
        // Lanes sit close together: a lane label that would touch the one above steps along its lane instead.
        if (lane) for (const other of laneBoxes) if (y0 < other.y1 && y0 + size.h > other.y0 && x0 < other.x1 + 6) x0 = other.x1 + 8;
        const box = { x0: x0 - pad, x1: x0 + size.w + pad, y0: y0 - pad, y1: y0 + size.h + pad };
        if (lane) laneBoxes.push(box);
        const off = box.x0 < railLeft - 8 || box.x1 > frame.width - 1 || box.y0 < -4 || box.y1 > frame.height + 4;
        const hit = placed.some((p) => box.x0 < p.x1 && box.x1 > p.x0 && box.y0 < p.y1 && box.y1 > p.y0);
        if ((off && def.priority > 0) || (hit && w > 0.5)) visible = false;
        else if (w > 0.5) placed.push(box);
        // The button is a 44px target; its paper sits at the bottom (or middle, for a lane) of it.
        const bx = lane ? x0 : x0 + size.w / 2 - Math.max(size.w, 44) / 2;
        const by = lane ? a.y - 22 : def.below ? y0 : y0 + size.h - 44;
        if (visible) el.style.transform = `translate(${bx.toFixed(1)}px, ${by.toFixed(1)}px)`;
      }
      el.hidden = !visible;
      if (visible) {
        el.style.opacity = Math.min(1, w * 1.15).toFixed(2);
        const active = w > 0.5;
        el.tabIndex = active ? 0 : -1;
        el.style.pointerEvents = active ? "auto" : "none";
      }
    }
  }, [compact]);

  useEffect(() => {
    if (qualityProp === "lite" || forced) { setLive(false); return; }
    const element = host.current;
    if (!element) return;
    let dead = false;
    let created: MiniWorld | null = null;
    let observer: ResizeObserver | null = null;
    import("./miniWorld3d.ts")
      .then(({ createMiniWorld }) => {
        if (dead) return;
        try {
          created = createMiniWorld(element, {
            reducedMotion: reduced,
            compact,
            quality: (compact ? "low" : "full") as MiniQuality,
            onFrame: applyFrame,
            onLost: () => { created?.dispose(); world.current = null; if (!dead) { setLive(false); setEpoch((n) => n + 1); } },
            onSettle: (z, day) => settleRef.current(z, day),
          });
        } catch {
          if (!dead) setLive(false);
          return;
        }
        world.current = created;
        proofRef.current?.(created);
        const size = () => created?.resize(element.clientWidth, element.clientHeight, !compact && element.clientWidth >= 540 ? 82 : 0);
        size();
        if (typeof ResizeObserver === "function") { observer = new ResizeObserver(size); observer.observe(element); }
        setLive(true);
      })
      .catch(() => { if (!dead) setLive(false); });
    return () => { dead = true; observer?.disconnect(); if (created) proofRef.current?.(null); created?.dispose(); world.current = null; };
  }, [qualityProp, forced, reduced, compact, applyFrame, epoch]);

  // Behind the open world the page copy stops drawing (it keeps following the focus, so it is ready on minimize).
  const paused = Boolean(props.worldOpen) && !compact;
  useEffect(() => { world.current?.setPaused?.(paused); }, [paused, live]);

  // Scene and view follow the state.
  const viewDay = Math.min(dayOf(clampDate(date, span)), daysInMonthKey(monthKey));
  const lastView = useRef<{ month: string; level: number } | null>(null);
  useEffect(() => {
    const w = world.current;
    if (!live || !w || !sceneInput) return;
    w.setScene(sceneInput);
    const prev = lastView.current;
    // Moving into another month rebuilds the path: land there without gliding across the old one.
    const jump = !prev || prev.month !== monthKey;
    const levelFor = level === 1 ? viewDay : viewDay;
    w.setView({ z: level, day: levelFor }, jump && prev?.level === level && level <= 1 ? true : !prev);
    if (jump && prev && level <= 1) w.setView({ day: levelFor }, true);
    lastView.current = { month: monthKey, level };
  }, [live, sceneInput, level, viewDay, monthKey]);

  // ------------------------------------------------------------------ cards
  const monthWords = (m: MiniMonthSummary) => m.status === "closed" ? "Closed at its Sitdown" : m.status === "ahead" ? "Ahead · not open yet"
    : m.current ? (m.sitdown === "closed" ? "Open · this month's Sitdown is done" : "Open until the Sitdown") : "Never closed at a Sitdown";
  const openWorldAt = useCallback((selected: string | null, lv: number, at?: DateKey) => {
    share({ selected, level: lv, ...(at ? { date: at } : {}) });
    onOpenWorld();
  }, [share, onOpenWorld]);
  const eraById = useCallback((id: string) => eras.find((e) => e.id === id) ?? null, [eras]);
  const eraDate = useCallback((era: MiniEra) => (era.state === "current" && journey ? journey.today : `${era.from}-01`), [journey]);

  const buildCard = useCallback((id: string): Card | null => {
    if (!journey) return null;
    const monthLink = (m: MiniMonthSummary) => ({ label: "Open this month in the world", primary: true, run: () => openWorldAt(m.worldId, 2, `${m.key}-${m.current ? journey.today.slice(8, 10) : "01"}`) });
    if (id.startsWith("day:") || id === "today") {
      const d = id === "today" ? month.days.find((x) => x.today) : month.days.find((x) => x.date === id.slice(4));
      if (!d) return null;
      const lines = [...(d.today ? ["Hercules is sitting here. This is where we are."] : []), ...(d.items.length ? d.items.map(miniItemWords) : ["Nothing planned. Everyday money only."])];
      if (d.today) {
        const next = month.days.filter((x) => x.date > d.date).flatMap((x) => x.items).find((i) => i.kind !== "task" || !i.done);
        if (next) lines.push(`Next: ${miniItemWords(next)} on ${miniDateLabel(next.date, false)}.`);
      }
      return {
        id, eyebrow: d.today ? "Today" : d.past ? "A day behind us" : "A day ahead", title: `${miniDateLabel(d.date)}${d.today ? " · today" : ""}`, lines,
        actions: [
          ...(levelRef.current > 0 ? [{ label: "Zoom to this day", run: () => { setDate(d.date); setLevel(0); setCard(null); } }] : []),
          monthLink(month),
        ],
      };
    }
    if (id.startsWith("week:")) {
      const wk = month.weeks.find((x) => x.start === id.slice(5));
      if (!wk) return null;
      return {
        id, eyebrow: "A week", title: `Week of ${wk.label}`,
        lines: [`Bills ${miniCad(-wk.billCents)} planned from Prepare`, `Money in ${miniCad(wk.inCents, true)}`, `${wk.tasks} to-do${wk.tasks === 1 ? "" : "s"}`],
        actions: [{ label: "Zoom to this week", run: () => { setDate(wk.hasToday ? journey.today : wk.start); setLevel(1); setCard(null); } }, monthLink(month)],
      };
    }
    if (id === "chapter" || id === "gate" || id.startsWith("lap:")) {
      const m: MiniMonthSummary = id.startsWith("lap:") ? journey.months.find((x) => x.key === id.slice(4)) ?? month : month;
      const full = m.key === month.key ? month : null;
      const lines = [
        `${m.chapter ? `Chapter “${m.chapter.title}”` : "No Chapter open"} · ${monthWords(m)}`,
        ...(full && full.fundReady ? [`Money in ${miniCad(full.inCents, true)} · bills ${miniCad(-full.billCents)} planned from Prepare`] : []),
        ...(full ? [`${full.tasks} to-do${full.tasks === 1 ? "" : "s"} this month`] : []),
      ];
      if (id === "gate") {
        return {
          id, eyebrow: "The Sitdown gate", title: `${m.label} ends here`,
          lines: [m.status === "closed" ? "We closed this month together at the Sitdown." : m.status === "ahead" ? "This month's Sitdown is still ahead." : m.sitdown === "closed" ? "This month's Sitdown is done; the month is still running." : "The monthly Sitdown closes this Chapter.", ...lines.slice(1)],
          actions: [monthLink(m)],
        };
      }
      return {
        id, eyebrow: m.current ? "This month" : m.status === "ahead" ? "A month ahead" : "A month behind us", title: m.label, lines,
        actions: [
          ...(id.startsWith("lap:") ? [{ label: "Go to this month", run: () => { setDate(withDay(m.key, m.current ? dayOf(journey.today) : 1)); setLevel(2); setCard(null); } }] : [{ label: "See its weeks", run: () => { setLevel(1); setCard(null); } }]),
          monthLink(m),
        ],
      };
    }
    if (id.startsWith("lane:")) {
      const lane = id.slice(5) as "prepare" | "protect" | "build" | "everyday";
      const t = lane === "everyday" ? journey.fund.everyday : journey.fund.lanes[lane];
      const meaning = { prepare: "Costs coming around: the month's bills are planned from here.", protect: "The Fund’s Protect amount, as shown in Plan.", build: "Dreams we are growing: the Kitty Banks.", everyday: "Day-to-day choices: the water the path crosses." }[lane];
      return {
        id, eyebrow: "A lane of the Fund", title: t.label,
        lines: [t.targetCents ? `${miniCad(t.amountCents)} of ${miniCad(t.targetCents)}` : miniCad(t.amountCents), meaning, "A way of thinking about one Fund, not a bank account."],
        actions: props.onOpenFund ? [{ label: "Open the Fund", run: () => props.onOpenFund?.() }] : [],
      };
    }
    if (id.startsWith("bank:") || id.startsWith("goal:")) {
      const goalId = id.slice(5);
      const bank = eras.flatMap((e) => [...e.banks, ...e.plans.flatMap((p) => (p.bank ? [p.bank] : []))]).find((b) => b.goalId === goalId);
      if (!bank) return null;
      return {
        id, eyebrow: "A Kitty Bank on the finish line", title: bank.name,
        lines: [bank.bought ? "Bought. It stays on the finish line." : bank.full ? "Full: every step is backed." : bank.step === null ? "Backing unavailable" : `${bank.step} of 10 steps backed`, "The steps are the same ones the open world shows."],
        actions: [{ label: "Show it in the world", primary: true, run: () => openWorldAt(bank.worldId, 3) }],
      };
    }
    if (id === "finish") {
      const era = focusEra;
      if (!era) return null;
      return {
        id, eyebrow: "The finish line", title: era.finishLine || `${era.name}: the finish line`,
        lines: [era.finishWhy || `${era.banksFull} of ${era.banks.length} Kitty Banks full`, ...era.banks.map((b) => `${b.name}: ${b.bought ? "bought" : b.full ? "full" : b.step === null ? "backing unavailable" : `${b.step} of 10 steps`}`)],
        actions: [{ label: "Open this era in the world", primary: true, run: () => openWorldAt(era.worldId, 3) }],
      };
    }
    if (id.startsWith("era:") || id === "era-home" || id === "here") {
      const era = id === "here" ? eras[currentEraIndex] ?? null : id === "era-home" ? eras.find((e) => e.state === "current") ?? null : eraById(id.slice(4));
      if (!era) return null;
      const range = `${miniMonthLabel(era.from, false)} – ${era.openEnded ? "open-ended" : miniMonthLabel(era.to, false)}`;
      const state = { crossed: "Crossed", current: "We are here", future: "Planned", sketched: "Suggested" }[era.state];
      const closed = era.months.filter((m) => m.status === "closed").length;
      return {
        id, eyebrow: `Era ${era.order} · ${state}`, title: era.name,
        lines: [
          range,
          ...(era.finishLine ? [`Finish line: ${era.finishLine}`] : []),
          ...(era.finishKind === "banks" ? [`${era.banksFull} of ${era.banks.length} Kitty Banks full`] : era.finishWhy ? [era.finishWhy] : []),
          ...(era.state !== "future" ? [`${closed} of ${era.monthCount} Chapters closed at their Sitdowns`] : [`${era.monthCount} months planned · ${era.homeLabel}`]),
          ...era.plans.filter((p) => p.kind !== "bank" || era.finishKind !== "banks").slice(0, 4).map((p) => `${p.label}${p.bank ? ` · ${p.bank.bought ? "bought" : p.bank.step === null ? "backing unavailable" : `${p.bank.step} of 10 steps`}` : ""}${p.sketched ? " · suggested" : ""}`),
        ],
        actions: [
          { label: "Go to this era", run: () => { setDate(eraDate(era)); setLevel(3); setCard(null); } },
          { label: "Open this era in the world", primary: true, run: () => openWorldAt(era.worldId, 3, eraDate(era)) },
        ],
      };
    }
    return null;
  }, [journey, month, eras, focusEra, currentEraIndex, eraById, eraDate, openWorldAt, setDate, setLevel, props]);

  const opener = useRef<HTMLElement | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const select = useCallback((id: string, opts: { share?: boolean } = {}) => {
    const active = typeof document !== "undefined" ? document.activeElement : null;
    if (active instanceof HTMLElement && !active.closest(".journey-mini__card")) opener.current = active;
    // The shared pick: the world's own ids where one exists; a day hands over its first item (the world focuses its month).
    let shared: string | null = null;
    if (id.startsWith("day:") || id === "today") {
      const d = id === "today" ? month.days.find((x) => x.today) : month.days.find((x) => x.date === id.slice(4));
      shared = d?.items[0]?.id ?? month.worldId;
      if (d && d.date !== dateRef.current) setDate(d.date, { silent: true });
    } else if (id.startsWith("bank:")) shared = `goal:${id.slice(5)}`;
    else if (id.startsWith("lap:")) shared = journey?.months.find((m) => m.key === id.slice(4))?.worldId ?? null;
    else if (id === "chapter" || id === "gate" || id.startsWith("week:")) shared = month.worldId;
    else if (id.startsWith("era:")) shared = eraById(id.slice(4))?.worldId ?? id;
    else if (id === "here") shared = "era-home";
    else if (id === "finish") shared = focusEra?.worldId ?? null;
    if (opts.share !== false && shared !== null) share({ selected: shared, ...(id.startsWith("day:") ? { date: id.slice(4) } : {}) });
    if (compact) return;
    const next = buildCard(id);
    if (next) setCard(next);
  }, [month, journey, eraById, focusEra, share, compact, buildCard]);
  const selectRef = useRef(select);
  selectRef.current = select;

  // A pick arriving from the world opens the matching card here.
  useEffect(() => {
    const id = pendingSelect.current;
    if (!id || !journey) return;
    let local: string | null = null;
    if (id.startsWith("month:")) {
      const m = journey.months.find((x) => x.worldId === id);
      if (m) { if (m.key !== monthKey) { setDateState(withDay(m.key, m.current ? dayOf(journey.today) : 1)); return; } local = "chapter"; }
    } else if (id.startsWith("goal:")) local = `bank:${id.slice(5)}`;
    else if (id === "era-home") local = eras[currentEraIndex] ? `era:${eras[currentEraIndex]!.id}` : null;
    else if (/^era:[^:]+$/.test(id)) local = id;
    else if (/^(bill|contribution):/.test(id)) {
      const at = id.split("@")[1];
      if (at && monthKeyFromDateKey(at) !== monthKey) { setDateState(at); return; }
      if (at) local = `day:${at}`;
    } else if (id.startsWith("task:")) {
      const d = month.days.find((x) => x.items.some((i) => i.id === id));
      if (d) local = `day:${d.date}`;
    }
    pendingSelect.current = null;
    if (local && !compact) { const next = buildCard(local); if (next) setCard(next); }
  }, [focus.focus, journey, monthKey, month, eras, currentEraIndex, buildCard, compact]);

  // Keep an open card's words fresh when the books change.
  useEffect(() => { setCard((c) => (c ? buildCard(c.id) ?? null : c)); }, [buildCard]);
  const closeCard = useCallback(() => { setCard(null); (opener.current ?? stage.current)?.focus?.(); }, []);
  useEffect(() => { if (card && opener.current?.matches?.(":focus-visible")) cardRef.current?.focus(); }, [card]);

  // ------------------------------------------------------------------ moving through time
  const step = useCallback((dir: -1 | 1) => {
    const lv = levelRef.current;
    const at = clampDate(dateRef.current, span);
    let next = at;
    if (lv === 0) next = addDays(at, dir);
    else if (lv === 1) next = addDays(at, dir * 7);
    else if (lv === 2) { const m = shiftMonthKey(monthKeyFromDateKey(at), dir); next = withDay(m, dayOf(at)); }
    else {
      const i = Math.max(0, eraIndex) + dir;
      const era = eras[i];
      if (!era) return;
      next = eraDate(era);
    }
    next = clampDate(next, span);
    if (next !== at) { setDate(next); setCard(null); }
  }, [span, eraIndex, eras, eraDate, setDate]);
  const toToday = useCallback(() => {
    setCard(null);
    setDateState(today);
    setLevelState(0);
    focusRef.current.toToday("mini", "day");
  }, [today]);

  // Wheel and pinch zoom through the levels on the same model; a drag slides along time.
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zTarget = useRef<number>(level);
  useEffect(() => { zTarget.current = level; }, [level]);
  const scheduleSnap = useCallback(() => {
    if (snapTimer.current) clearTimeout(snapTimer.current);
    snapTimer.current = setTimeout(() => {
      // A gesture that moved a quarter of the way commits to the next level in its direction.
      const base = levelRef.current;
      const diff = zTarget.current - base;
      const next = Math.max(0, Math.min(4, Math.abs(diff) < 0.22 ? base : base + Math.sign(diff) * Math.max(1, Math.round(Math.abs(diff)))));
      zTarget.current = next;
      world.current?.setView({ z: next });
      if (next !== base) { setLevel(next); setCard(null); }
    }, reduced ? 60 : 260);
  }, [reduced, setLevel]);
  useEffect(() => () => { if (snapTimer.current) clearTimeout(snapTimer.current); }, []);
  const lastStep = useRef(0);
  const stepLevel = useCallback((dir: number) => {
    const now = Date.now();
    if (now - lastStep.current < 220) return;
    lastStep.current = now;
    if (snapTimer.current) clearTimeout(snapTimer.current);
    const next = Math.max(0, Math.min(4, levelRef.current + Math.sign(dir)));
    zTarget.current = next;
    if (next !== levelRef.current) { setLevel(next); setCard(null); }
  }, [setLevel]);
  const zoomBy = useCallback((delta: number) => {
    if (flat || listOpen) {
      zTarget.current += delta;
      if (Math.abs(zTarget.current - levelRef.current) < 0.3) return;
      stepLevel(zTarget.current - levelRef.current);
      zTarget.current = levelRef.current;
      return;
    }
    zTarget.current = Math.max(0, Math.min(4, zTarget.current + delta));
    world.current?.nudge({ z: zTarget.current });
    scheduleSnap();
  }, [flat, listOpen, stepLevel, scheduleSnap]);
  const settleRef = useRef((_z: number, _day: number) => {});
  settleRef.current = () => { /* snapping is timer-driven; nothing else to do */ };

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      if ((event.target as HTMLElement).closest?.(".journey-mini__card, .journey-mini__list")) return;
      event.preventDefault();
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY) * 1.5 && !event.ctrlKey) { dragTime(event.deltaX * 0.6); return; }
      // A mouse wheel notch (or a line-mode delta) is one level; a trackpad's stream of small deltas (and its
      // ctrl+wheel pinch) glides the same model continuously and settles on the nearest level.
      const notch = !event.ctrlKey && (event.deltaMode === 1 || Math.abs(event.deltaY) >= 40);
      if (notch) { stepLevel(event.deltaY); return; }
      zoomBy(Math.max(-0.5, Math.min(0.5, event.deltaY * (event.ctrlKey ? 0.012 : 0.006))));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ moved: 0, pinch: 0, zPinch: 0, acc: 0, startX: 0, startY: 0 });
  const dragTime = (dx: number) => {
    const lv = levelRef.current;
    const w = world.current;
    if (lv <= 1 && w && !flat) {
      const v = w.view();
      let next = v.dayTarget + dx * w.daysPerPixel();
      if (next < 0.55 || next > v.days + 0.45) {
        const at = clampDate(dateRef.current, span);
        const m = shiftMonthKey(monthKeyFromDateKey(at), next < 0.55 ? -1 : 1);
        const landing = next < 0.55 ? withDay(m, 31) : withDay(m, 1);
        if (clampDate(landing, span) === landing) setDate(landing);
        return;
      }
      next = Math.max(0.5, Math.min(v.days + 0.5, next));
      w.nudge({ day: next });
      const snapped = Math.round(Math.max(1, Math.min(v.days, next)));
      const nextDate = withDay(monthKeyFromDateKey(dateRef.current), snapped);
      if (nextDate !== dateRef.current) { dateRef.current = nextDate; setDateState(nextDate); dragDirty.current = true; }
      return;
    }
    gesture.current.acc += dx;
    const threshold = lv <= 1 ? 60 : 90;
    while (Math.abs(gesture.current.acc) >= threshold) {
      const dir = gesture.current.acc > 0 ? 1 : -1;
      gesture.current.acc -= dir * threshold;
      step(dir as 1 | -1);
    }
  };
  const dragDirty = useRef(false);
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button, input, a, .journey-mini__card, .journey-mini__list")) return;
    if (event.button !== 0 && event.pointerType === "mouse") return;
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* jsdom */ }
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const g = gesture.current;
    g.moved = 0; g.acc = 0; g.startX = event.clientX; g.startY = event.clientY;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      g.pinch = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      g.zPinch = zTarget.current;
    }
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const p = pointers.current.get(event.pointerId);
    if (!p) return;
    const dx = event.clientX - p.x, dy = event.clientY - p.y;
    p.x = event.clientX; p.y = event.clientY;
    const g = gesture.current;
    g.moved += Math.abs(dx) + Math.abs(dy);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      if (g.pinch > 0) {
        const target = Math.max(0, Math.min(4, g.zPinch - Math.log2(d / g.pinch) * 1.4));
        zoomBy(target - zTarget.current);
      }
      return;
    }
    if (g.moved > 6) dragTime(-dx);
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.delete(event.pointerId);
    if (pointers.current.size) return;
    const g = gesture.current;
    if (g.moved < 8) {
      const id = !flat ? world.current?.pick(event.clientX, event.clientY) ?? null : null;
      if (id) select(id);
      else if (card) setCard(null);
      return;
    }
    if (dragDirty.current) {
      dragDirty.current = false;
      const w = world.current;
      if (w) w.setView({ day: dayOf(dateRef.current) });
      share({ date: dateRef.current });
    }
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest(".journey-mini__card") && event.key !== "Escape") return;
    if (target.closest("input, .journey-mini__list") && event.key !== "Escape") return;
    const onStage = target === stage.current;
    let used = true;
    if (event.key === "+" || event.key === "=" || (event.key === "ArrowUp" && onStage)) { setLevel(levelRef.current - 1); setCard(null); }
    else if (event.key === "-" || event.key === "_" || (event.key === "ArrowDown" && onStage)) { setLevel(levelRef.current + 1); setCard(null); }
    else if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && (onStage || target.closest(".journey-mini__labels"))) step(event.key === "ArrowLeft" ? -1 : 1);
    else if ((event.key === "h" || event.key === "H" || event.key === "Home") && !target.closest("input")) toToday();
    else if (event.key === "Escape" && card) closeCard();
    else if (event.key === "Enter" && onStage) select(levelRef.current <= 1 ? `day:${clampDate(dateRef.current, span)}` : levelRef.current === 2 ? "chapter" : focusEra ? `era:${focusEra.id}` : "here");
    else used = false;
    if (used) event.preventDefault();
  };

  // ------------------------------------------------------------------ labels
  const fund = journey?.fund;
  const labels: LabelDef[] = useMemo(() => {
    if (!journey) return [];
    const out: LabelDef[] = [];
    const focusDay = viewDay;
    for (const d of month.days) {
      out.push({
        id: `name:${d.date}`, anchor: `base:${d.date}`, pick: `day:${d.date}`, levels: [0], priority: 9, className: `journey-mini__dayname${d.today ? " is-today" : ""}`, below: true,
        near: { day: d.day, within: compact ? 1.2 : 3.2 },
        aria: `${miniDateLabel(d.date)}${d.today ? ", today" : ""}${d.items.length ? `, ${d.items.length} thing${d.items.length === 1 ? "" : "s"}` : ", nothing planned"}`,
        content: <>{d.weekday} {d.day}</>,
      });
      const money = d.items.filter((i) => i.kind !== "task");
      const tasks = d.items.filter((i): i is Extract<MiniItem, { kind: "task" }> => i.kind === "task");
      if (d.items.length) {
        out.push({
          id: `day:${d.date}`, anchor: `day:${d.date}`, pick: `day:${d.date}`, levels: [0], priority: d.today ? 2 : 4 + Math.abs(d.day - focusDay) * 0.1,
          className: "journey-mini__tag", near: { day: d.day, within: compact ? 1.2 : 2.6 },
          aria: `${miniDateLabel(d.date)}: ${d.items.map(miniItemWords).join("; ")}`,
          content: <>
            {money.slice(0, 2).map((i) => i.kind === "bill"
              ? <span key={i.id} className="journey-mini__tag-row journey-mini__tag-row--bill"><b>{i.label}</b><span>{miniCad(-i.amountCents)}</span></span>
              : i.kind === "contribution" ? <span key={i.id} className={`journey-mini__tag-row journey-mini__tag-row--in${i.expected ? " is-expected" : ""}`}><b>{i.who}</b><span>{miniCad(i.amountCents)}{i.expected ? " expected" : i.split ? " divided" : " confirmed"}</span></span> : null)}
            {money.length > 2 && <span className="journey-mini__tag-more">+{money.length - 2} more</span>}
            {tasks.slice(0, 1).map((t) => <span key={t.id} className={`journey-mini__tag-row journey-mini__tag-row--task${t.done ? " is-done" : ""}`}><b><span aria-hidden="true">⚑ </span>{t.title}</b><span>{t.who}{t.private ? " · only you" : ""}</span></span>)}
          </>,
        });
      }
      if (money.length) {
        const bills = money.reduce((s, i) => s + (i.kind === "bill" ? i.amountCents : 0), 0);
        const ins = money.reduce((s, i) => s + (i.kind === "contribution" ? i.amountCents : 0), 0);
        out.push({
          id: `chip:${d.date}`, anchor: `day:${d.date}`, pick: `day:${d.date}`, levels: [1], priority: 8, className: "journey-mini__chip", near: { day: d.day, within: 9 }, minWidth: 560,
          aria: `${miniDateLabel(d.date)}: ${ins ? `${miniCad(ins, true)} in` : ""} ${bills ? `${miniCad(-bills)} bills` : ""}`,
          content: <>{ins > 0 && <span className="is-in">{miniCad(ins, true)}</span>}{bills > 0 && <span className="is-bill">{miniCad(-bills)}</span>}</>,
        });
      }
    }
    const t = month.days.find((d) => d.today);
    if (t) out.push({ id: "today", anchor: "today", pick: "today", levels: [0, 1], priority: 1, className: "journey-mini__tag journey-mini__tag--today", aria: `Today, ${miniDateLabel(t.date)}. Hercules is here.`, content: <><b>Today</b><span>{miniDateLabel(t.date)}</span></> });
    if (fund) {
      for (const lane of ["everyday", "prepare", "protect", "build"] as const) {
        const tr = lane === "everyday" ? fund.everyday : fund.lanes[lane];
        const amount = fund.ready ? `${miniCad(tr.amountCents)}${tr.targetCents ? ` of ${miniCad(tr.targetCents)}` : ""}` : "";
        out.push({
          id: `lane:${lane}`, anchor: `lane:${lane}`, pick: `lane:${lane}`, levels: [0, 1], priority: 0.5, className: `journey-mini__lane journey-mini__lane--${lane}`,
          aria: `${tr.label}${amount ? ` · ${amount}` : fundPending ? " · reading" : ""}`,
          content: <><b>{tr.label}</b>{amount ? <span> · {amount}</span> : fundPending ? <span className="journey-mini__shimmer journey-mini__shimmer--amount" aria-hidden="true" /> : null}</>,
        });
      }
    }
    for (const wk of month.weeks) {
      out.push({
        id: `week:${wk.start}`, anchor: `week:${wk.start}`, pick: `week:${wk.start}`, levels: [1], priority: 3, className: "journey-mini__chip journey-mini__chip--week", below: true,
        near: { day: dayOf(wk.start) + 3, within: compact ? 3 : 10 },
        aria: `Week of ${wk.label}: bills ${miniCad(-wk.billCents)}, money in ${miniCad(wk.inCents, true)}, ${wk.tasks} to-dos`,
        content: <><b>{wk.label}</b>{wk.billCents > 0 && <span className="is-bill">{miniCad(-wk.billCents)}</span>}{wk.inCents > 0 && <span className="is-in">{miniCad(wk.inCents, true)}</span>}</>,
      });
    }
    out.push({
      id: "chapter", anchor: "chapter", pick: "chapter", levels: [2], priority: 1, className: "journey-mini__tag journey-mini__tag--big",
      aria: `${month.label}. ${month.chapter ? `Chapter ${month.chapter.title}.` : ""} ${monthWords(month)}.`,
      content: <><b>{month.label}</b>{month.chapter && <span>“{month.chapter.title}”</span>}
        {month.fundReady && <span><span className="is-in">In {miniCad(month.inCents)}</span> · <span className="is-bill">bills {miniCad(-month.billCents)}</span></span>}
        <span className={`journey-mini__status journey-mini__status--${month.status}`}>{monthWords(month)}</span></>,
    });
    out.push({
      id: "gate", anchor: "gate", pick: "gate", levels: [0, 2], priority: 2.5, className: "journey-mini__tag", near: { day: month.days.length + 0.5, within: 2.6 },
      aria: `Sitdown gate, ${month.label}`,
      content: <><b>Sitdown gate</b><span>{miniDateLabel(month.days.at(-1)!.date, false)} · {month.status === "closed" ? "closed" : month.status === "ahead" ? "ahead" : "open"}</span></>,
    });
    if (focusEra) {
      out.push({
        id: "era-title", anchor: `era:${focusEra.id}`, pick: `era:${focusEra.id}`, levels: [3], priority: 1, className: "journey-mini__tag journey-mini__tag--big", minWidth: 560,
        aria: `Era ${focusEra.order}, ${focusEra.name}`,
        content: <><b>Era {focusEra.order} · {focusEra.name}</b><span>{miniMonthLabel(focusEra.from, false)} – {focusEra.openEnded ? "open-ended" : miniMonthLabel(focusEra.to, false)} · {month.label}</span></>,
      });
      if (focusEra.banks.length) {
        out.push({
          id: "finish", anchor: "finish", pick: "finish", levels: [3], priority: 2, className: "journey-mini__tag",
          aria: `Finish line: ${focusEra.banksFull} of ${focusEra.banks.length} Kitty Banks full`,
          content: <><b>Finish line</b><span>{focusEra.banksFull} of {focusEra.banks.length} Kitty Banks full</span></>,
        });
        for (const b of focusEra.banks) {
          out.push({
            id: `bank:${b.goalId}`, anchor: `bank:${b.goalId}`, pick: `bank:${b.goalId}`, levels: [3], priority: 6, className: "journey-mini__chip journey-mini__chip--bank", minWidth: 700,
            aria: `${b.name}: ${b.bought ? "bought" : b.full ? "full" : b.step === null ? "backing unavailable" : `${b.step} of 10 steps`}`,
            content: <><b>{b.name}</b><span>{b.bought ? "bought" : b.full ? "full" : b.step === null ? "backing unavailable" : `${b.step}/10`}</span></>,
          });
        }
      }
    }
    if (currentEraIndex >= 0) {
      out.push({ id: "here", anchor: "here", pick: "here", levels: [3], priority: 0.8, className: "journey-mini__tag journey-mini__tag--today", aria: "We are here", content: <b>We are here</b> });
    }
    eras.forEach((era, i) => {
      const state = { crossed: "crossed", current: "now", future: "planned", sketched: "suggested" }[era.state];
      const here = era.state === "current";
      out.push({
        id: `era:${era.id}`, anchor: here ? "here" : `era:${era.id}`, pick: `era:${era.id}`, levels: [4], priority: here ? 0.8 : 2 + Math.abs(i - Math.max(0, currentEraIndex)) * 0.1,
        className: `journey-mini__tag journey-mini__tag--era is-${era.state}`,
        aria: `Era ${era.order}, ${era.name}, ${here ? "we are here" : state}`,
        content: <><b>{compact ? `Era ${era.order}` : <>Era {era.order}<span className="journey-mini__era-name"> · {era.name}</span></>}</b><span>{here ? "We are here" : state}</span></>,
      });
    });
    return out;
  }, [journey, month, fund, fundPending, focusEra, eras, currentEraIndex, viewDay, compact]);
  labelDefs.current = labels;
  useEffect(() => { world.current?.refresh(); }, [labels, live]);

  // ------------------------------------------------------------------ flat layout
  const [stageSize, setStageSize] = useState({ w: 390, h: 280 });
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => { if (el.clientWidth && el.clientHeight) setStageSize((s) => (s.w === el.clientWidth && s.h === el.clientHeight ? s : { w: el.clientWidth, h: el.clientHeight })); };
    measure();
    if (typeof ResizeObserver !== "function") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const flatView = useMemo(() => (flat && journey ? flatLayout({ level, theme, aspect: stageSize.w / Math.max(1, stageSize.h), journey, month, focusDate: clampDate(date, span), era: focusEra, eraIndex, sceneEras, whoOf }) : null), [flat, journey, level, theme, stageSize, month, date, span, focusEra, eraIndex, sceneEras, whoOf]);

  // ------------------------------------------------------------------ words
  const levelName = JOURNEY_LEVEL_LABEL[JOURNEY_LEVELS[level]!];
  const focusDate = clampDate(date, span);
  const week = month.weeks.find((w) => focusDate >= w.start && focusDate <= w.end) ?? null;
  const head = (() => {
    if (!journey) return { title: "Money through the month", fig: "", sub: "Reading our journey…" };
    if (level === 0) return { title: "Money through the month", fig: month.fundReady ? `In ${miniCad(month.inCents)}` : "", sub: `${miniDateLabel(focusDate)}${focusDate === today ? " · today" : ""}` };
    if (level === 1) return { title: "Money through the month", fig: week && month.fundReady ? [week.inCents ? `In ${miniCad(week.inCents)}` : "", week.billCents ? `Bills ${miniCad(-week.billCents)}` : ""].filter(Boolean).join(" · ") : "", sub: week ? `Week of ${week.label}` : month.label };
    if (level === 2) return { title: `${miniMonthLabel(month.key).split(" ")[0]}${month.chapter ? ` · ${month.chapter.title}` : ""}`, fig: month.fundReady ? `In ${miniCad(month.inCents)}` : "", sub: `${month.label} · ${month.status === "closed" ? "closed at its Sitdown" : month.status === "ahead" ? "ahead" : month.current && month.sitdown === "closed" ? "open · Sitdown done" : "open"}` };
    if (level === 3 && focusEra) return { title: `Era ${focusEra.order} · ${focusEra.name}`, fig: focusEra.banks.length ? `${focusEra.banksFull} of ${focusEra.banks.length} full` : "", sub: `${miniMonthLabel(focusEra.from, false)} – ${focusEra.openEnded ? "open-ended" : miniMonthLabel(focusEra.to, false)}${focusEra.state === "current" ? " · the finish line is filling" : ""}` };
    const cur = eras[currentEraIndex];
    return { title: "Our journey", fig: cur ? `Era ${cur.order} of ${eras.length}` : "", sub: eras.map((e) => e.name).join(" → ") };
  })();
  useEffect(() => { if (journey) setAnnounce(`${levelName} level. ${head.sub}`); }, [levelName, head.sub, journey]);

  const compactCaption = level <= 1 ? `${levelName} · ${level === 0 ? miniDateLabel(focusDate, false) : week?.label ?? ""}` : level === 2 ? month.shortLabel : level === 3 && focusEra ? `Era ${focusEra.order} · ${focusEra.name}` : "Our journey";
  const scrub = (() => {
    if (!journey) return { min: 0, max: 0, value: 0, step: 1, text: "" };
    if (level <= 1) {
      const total = Math.round((Date.parse(`${span.to}T12:00:00Z`) - Date.parse(`${span.from}T12:00:00Z`)) / 86400000);
      const value = Math.round((Date.parse(`${focusDate}T12:00:00Z`) - Date.parse(`${span.from}T12:00:00Z`)) / 86400000);
      return { min: 0, max: total, value, step: level === 0 ? 1 : 7, text: level === 0 ? miniDateLabel(focusDate) : `Week of ${week?.label ?? ""}` };
    }
    if (level === 2) return { min: 0, max: journey.months.length - 1, value: Math.max(0, journey.months.findIndex((m) => m.key === monthKey)), step: 1, text: month.label };
    return { min: 0, max: Math.max(0, eras.length - 1), value: Math.max(0, eraIndex), step: 1, text: focusEra ? `Era ${focusEra.order} · ${focusEra.name}` : "" };
  })();
  const onScrub = (value: number) => {
    if (!journey) return;
    setCard(null);
    if (level <= 1) setDate(addDays(span.from, value));
    else if (level === 2) { const m = journey.months[value]; if (m) setDate(withDay(m.key, m.current ? dayOf(today) : dayOf(focusDate))); }
    else { const era = eras[value]; if (era) setDate(eraDate(era)); }
  };

  // ------------------------------------------------------------------ render
  const labelLayer = (
    <div className="journey-mini__labels" aria-label={`${levelName} level places`} role="group">
      {labels.map((def) => {
        const spot = flatView?.spots.get(def.anchor);
        const flatVisible = flatView && spot && def.levels.includes(level) && (!def.minWidth || stageSize.w >= def.minWidth) && (!def.near || def.levels[0]! > 0 || Math.abs(def.near.day - viewDay) <= (stageSize.w > 520 ? 3.5 : 2.5));
        const style = flatView
          ? { left: `${(spot?.x ?? 0) / flatView.width * 100}%`, top: `${(spot?.y ?? 0) / flatView.height * 100}%` }
          : undefined;
        return (
          <button
            key={def.id}
            type="button"
            ref={(el) => { if (el) labelEls.current.set(def.id, el); else labelEls.current.delete(def.id); }}
            className={`journey-mini__label${def.id.startsWith("lane:") ? " is-lane" : ""}${flatView ? " is-flat" : ""}${def.below ? " is-below" : ""}`}
            aria-label={def.aria}
            hidden={flatView ? !flatVisible : true}
            style={style}
            data-place={def.pick}
            onClick={(event) => { event.stopPropagation(); select(def.pick); }}
          ><span className={`journey-mini__paper ${def.className}`}>{def.content}</span></button>
        );
      })}
    </div>
  );

  const list = listOpen && journey ? <MiniOutline level={level} journey={journey} month={month} week={week} era={focusEra} eras={eras} onPick={select} monthWords={monthWords} /> : null;

  const cardEl = card && !compact ? (
    <div className="journey-mini__card" role="dialog" aria-modal="false" aria-labelledby="journey-mini-card-title" tabIndex={-1} ref={cardRef}
      onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); closeCard(); } }}>
      <p className="journey-mini__eyebrow">{card.eyebrow}</p>
      <h3 id="journey-mini-card-title">{card.title}</h3>
      <ul>{card.lines.map((line, i) => <li key={i}>{line}</li>)}</ul>
      {card.actions.length > 0 && <div className="journey-mini__card-actions">
        {card.actions.map((a) => <button key={a.label} type="button" className={a.primary ? "is-primary" : undefined} onClick={a.run}>{a.label}</button>)}
      </div>}
      <button type="button" className="journey-mini__close" aria-label="Close card" onClick={closeCard}>×</button>
    </div>
  ) : null;

  const zoomScale = (
    <div className={`journey-mini__scale${compact ? " is-compact" : ""}`} role="group" aria-label="Zoom level">
      <button type="button" className="journey-mini__zoom" aria-label="Zoom in" disabled={level === 0} onClick={() => { setLevel(level - 1); setCard(null); }}>+</button>
      <div className="journey-mini__levels">
        {JOURNEY_LEVELS.map((lv, i) => (
          <button key={lv} type="button" aria-pressed={level === i} aria-label={compact ? JOURNEY_LEVEL_LABEL[lv] : undefined} onClick={() => { setLevel(i); setCard(null); }}>
            {compact ? <span aria-hidden="true">{JOURNEY_LEVEL_LABEL[lv][0]}</span> : JOURNEY_LEVEL_LABEL[lv]}
          </button>
        ))}
        <span className="journey-mini__thumb" aria-hidden="true" style={{ ["--z" as string]: String(level) }} />
      </div>
      <button type="button" className="journey-mini__zoom" aria-label="Zoom out" disabled={level === 4} onClick={() => { setLevel(level + 1); setCard(null); }}>−</button>
    </div>
  );

  const stageEl = (
    <div
      ref={stage}
      className="journey-mini__stage"
      tabIndex={0}
      role="application"
      aria-roledescription="zoomable journey map"
      aria-label={`${compact ? "Journey minimap" : "Journey map"}. ${levelName} level: ${head.sub}. Plus and minus zoom from Day to Journey; left and right arrows move through time; H returns to today.`}
      aria-describedby={compact ? undefined : "journey-mini-note"}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      data-busy={monthLoading ? "true" : undefined}
    >
      <div ref={host} className="journey-mini__host" hidden={flat} />
      {flatView && <div className="journey-mini__flat">{flatView.svg}</div>}
      {!list && labelLayer}
      {list}
      {load.state.failed ? <div className="journey-mini__loading" role="status"><p>We could not read this journey. Your books have not changed.</p><button type="button" onClick={load.retry}>Try reading again</button></div> : !journey && <p className="journey-mini__loading">Reading our journey…</p>}
      {compact ? zoomScale : null}
      {!compact && <button type="button" className="journey-mini__here" data-obstacle="" aria-label="Where we are" onClick={toToday}><span className="journey-mini__here-icon" aria-hidden="true" /><span className="journey-mini__here-text">Where we are</span></button>}
      {cardEl}
    </div>
  );

  if (compact) {
    return (
      <section className="journey-mini journey-mini--compact" data-mini-theme={theme} data-level={level} data-flat={flat ? "true" : "false"} aria-label="Journey minimap">
        <div className="journey-mini__frame">
          {stageEl}
          <p className="journey-mini__compact-caption" aria-hidden="true" data-obstacle="">{compactCaption}</p>
          <p className="journey-mini__sr" aria-live="polite">{announce}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="journey-mini" data-mini-theme={theme} data-level={level} data-flat={flat ? "true" : "false"} aria-labelledby="journey-mini-title">
      <div className="journey-mini__frame">
      <header className="journey-mini__head">
        <div>
          <h2 id="journey-mini-title">{head.title}</h2>
          <p className="journey-mini__sub" title={head.sub}>{head.sub.split(/(\S+–\S+)/).map((part, i) => (i % 2 ? <span key={i} className="journey-mini__nowrap">{part}</span> : part))}{head.fig && <span className="journey-mini__fig-inline"> · {head.fig}</span>}{monthLoading && level <= 2 ? " · reading…" : ""}</p>
        </div>
        {head.fig && <p className="journey-mini__fig">{head.fig}</p>}
        <button type="button" className="journey-mini__list-toggle" aria-pressed={listOpen} onClick={() => setListOpen((v) => !v)}>{listOpen ? "Map" : "List"}</button>
      </header>
      <ul className="journey-mini__legend" aria-label="Legend">
        <li><i className="is-queen" aria-hidden="true" />contribution</li>
        <li><i className="is-prepare" aria-hidden="true" />Prepare</li>
        <li><i className="is-protect" aria-hidden="true" />Protect</li>
        <li><i className="is-build" aria-hidden="true" />Build</li>
        <li><i className="is-everyday" aria-hidden="true" />Everyday</li>
      </ul>
      {stageEl}
      {zoomScale}
      <div className="journey-mini__row">
        <label className="journey-mini__scrub">
          <span>{scrub.text}</span>
          <input type="range" min={scrub.min} max={scrub.max} step={scrub.step} value={scrub.value} disabled={!journey}
            aria-label={`Move through time, one ${levelName.toLowerCase()} at a time`} aria-valuetext={scrub.text}
            onChange={(e) => onScrub(Number(e.currentTarget.value))} />
        </label>
        <button type="button" className="journey-mini__open" onClick={() => { share({ level, date: focusDate }); onOpenWorld(); }}>
          <span aria-hidden="true" className="journey-mini__open-icon" />Open the world
        </button>
      </div>
      <p className="journey-mini__note" id="journey-mini-note"><span className="journey-mini__note-long">{NOTE}</span><span className="journey-mini__note-short">{NOTE_SHORT}</span></p>
      <p className="journey-mini__sr" aria-live="polite">{announce}</p>
      </div>
    </section>
  );
}

/** The outline: the same places as the map, as a list, at every level. */
function MiniOutline({ level, journey, month, week, era, eras, onPick, monthWords }: {
  level: number; journey: MiniJourney; month: MiniMonth; week: MiniMonth["weeks"][number] | null; era: MiniEra | null; eras: MiniEra[];
  onPick: (id: string) => void; monthWords: (m: MiniMonthSummary) => string;
}) {
  const f = journey.fund;
  const lanes = f.ready ? (
    <ul className="journey-mini__list-lanes">
      <li><button type="button" onClick={() => onPick("lane:prepare")}>Prepare · {miniCad(f.lanes.prepare.amountCents)}</button></li>
      <li><button type="button" onClick={() => onPick("lane:protect")}>Protect · {miniCad(f.lanes.protect.amountCents)}{f.lanes.protect.targetCents ? ` of ${miniCad(f.lanes.protect.targetCents)}` : ""}</button></li>
      <li><button type="button" onClick={() => onPick("lane:build")}>Build · {miniCad(f.lanes.build.amountCents)}</button></li>
      <li><button type="button" onClick={() => onPick("lane:everyday")}>Everyday · {miniCad(f.everyday.amountCents)}</button></li>
    </ul>
  ) : null;
  const dayRow = (d: MiniMonth["days"][number]) => (
    <li key={d.date}>
      <button type="button" onClick={() => onPick(`day:${d.date}`)}>
        <b>{miniDateLabel(d.date)}{d.today ? " · today" : ""}</b>
        <span>{d.items.length ? d.items.map(miniItemWords).join("; ") : "Nothing planned"}</span>
      </button>
    </li>
  );
  let body: ReactNode;
  if (level <= 1) {
    const days = level === 0
      ? month.days.filter((d) => Math.abs(d.day - (week ? Number(week.start.slice(8, 10)) + 3 : 1)) <= 10 && (d.items.length || d.today)).slice(0, 12)
      : month.days.filter((d) => week && d.date >= week.start && d.date <= week.end);
    body = <>
      <h3>{level === 0 ? `Days around ${week?.label ?? month.label}` : `Week of ${week?.label ?? ""}`}</h3>
      {lanes}
      <ul>{days.length ? days.map(dayRow) : <li>Nothing planned these days.</li>}</ul>
    </>;
  } else if (level === 2) {
    body = <>
      <h3><button type="button" onClick={() => onPick("chapter")}>{month.label}{month.chapter ? ` · “${month.chapter.title}”` : ""}</button></h3>
      <p>{monthWords(month)}{month.fundReady ? ` · in ${miniCad(month.inCents)} · bills ${miniCad(month.billCents)} planned from Prepare` : ""}</p>
      {lanes}
      {month.weeks.map((wk) => (
        <div key={wk.start}>
          <h4><button type="button" onClick={() => onPick(`week:${wk.start}`)}>{wk.label}</button></h4>
          <ul>{month.days.filter((d) => d.date >= wk.start && d.date <= wk.end && (d.items.length || d.today)).map(dayRow)}</ul>
        </div>
      ))}
    </>;
  } else if (level === 3 && era) {
    body = <>
      <h3><button type="button" onClick={() => onPick(`era:${era.id}`)}>Era {era.order} · {era.name}</button></h3>
      <h4>Chapters</h4>
      <ul>{era.months.map((m) => <li key={m.key}><button type="button" onClick={() => onPick(`lap:${m.key}`)}><b>{m.label}{m.chapter ? ` · ${m.chapter.title}` : ""}</b><span>{monthWords(m)}</span></button></li>)}</ul>
      {era.monthCount > era.months.length && <p>{era.monthCount} months in all; the map shows {era.months.length}.</p>}
      {era.banks.length > 0 && <>
        <h4><button type="button" onClick={() => onPick("finish")}>Finish line · {era.banksFull} of {era.banks.length} full</button></h4>
        <ul>{era.banks.map((b) => <li key={b.goalId}><button type="button" onClick={() => onPick(`bank:${b.goalId}`)}>{b.name}: {b.bought ? "bought" : b.full ? "full" : b.step === null ? "backing unavailable" : `${b.step} of 10 steps`}</button></li>)}</ul>
      </>}
    </>;
  } else {
    body = <>
      <h3>Our journey</h3>
      <ul>{eras.map((e) => <li key={e.id}><button type="button" onClick={() => onPick(`era:${e.id}`)}><b>Era {e.order} · {e.name}</b><span>{({ crossed: "crossed", current: "we are here", future: "planned", sketched: "suggested" })[e.state]} · {miniMonthLabel(e.from, false)} – {e.openEnded ? "open-ended" : miniMonthLabel(e.to, false)}</span></button></li>)}</ul>
    </>;
  }
  return <div className="journey-mini__list" role="region" aria-label={`${JOURNEY_LEVEL_LABEL[JOURNEY_LEVELS[level]!]} as a list`}>{body}</div>;
}

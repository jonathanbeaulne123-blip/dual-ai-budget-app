import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { DateKey } from "../core/calendar.ts";
import { monthKeyFromDateKey } from "../core/calendar.ts";
import { completeMove, memories, movesForChapter, nextMove, openChapterFor, ourRhythm, respondToMove } from "../core/chapters.ts";
import { kittyBankBackingStep, kittyBanksInView } from "../core/kittyBanks.ts";
import { displayedKittyPiece } from "../core/kittyStudio.ts";
import { formatCad } from "../core/money.ts";
import { monthObligations } from "../core/monthObligations.ts";
import { pathMonthCharacter, pathMonths, type PathMonth } from "../core/pathSignals.ts";
import {
  PATH_BASE_RECIPES,
  PATH_BRUSHES,
  PATH_BRUSH_LABELS,
  PATH_CATEGORY_SIGNALS,
  PATH_NAME_ID,
  PATH_SIGNALS,
  PATH_SIGNAL_LABELS,
  agreePathProposal,
  declinePathProposal,
  effectivePathRecipes,
  herculesPathSuggestion,
  pathCategoryMappings,
  pathIslandName,
  pendingPathProposals,
  proposePathName,
  proposePathRecipe,
  setPathCategorySignal,
  shapePathWorld,
  type PathCategorySignal,
  type PathRecipe,
  type PathRecipeRow,
  type PathRecipeSpec,
  type PathSignal,
} from "../core/pathWorld.ts";
import type { CommitResult, Household } from "../core/types.ts";
import { useAppearance } from "../theme/ThemeProvider.tsx";
import { growIsland, type Piece } from "./grow.ts";
import type { PathAnchor, PathCharacter, PathLevel, PathWorld, PathWorldInput } from "./world/pathWorld3d.ts";
import "./our-path-world.css";

/**
 * Our Path as a world (D-262). The island is grown from the household's shared
 * months; the Chapter, its Moves, Rituals, Wins and Kitty Banks stand on it;
 * the tent opens today's Our Path (Chapter room and Plan Studio) unchanged.
 * Everything you can open is a real button. The canvas only draws.
 */

type Run = (fn: (current: Household) => CommitResult) => Promise<unknown>;
type Lantern = 0 | 1 | 2;
type Mark = {
  id: string;
  label: string;
  sub?: string;
  kind: "month" | "now" | "fire" | "goal" | "piece" | "move" | "bill" | "memory" | "tent" | "unknown" | "name" | "cove" | "lamp";
  minLevel: PathLevel;
  lantern: Lantern;
};
type Detail = { eyebrow: string; title: string; lines: [Lantern, string][]; actions?: ReactNode };

const LEVELS: { level: PathLevel; label: string }[] = [
  { level: 0, label: "Sky" }, { level: 1, label: "Region" }, { level: 2, label: "Stop" }, { level: 3, label: "Up close" },
];
const LANTERNS: { value: Lantern; label: string }[] = [{ value: 0, label: "Dim" }, { value: 1, label: "Warm" }, { value: 2, label: "Bright" }];
const CHARACTER_LABEL: Record<PathCharacter, string> = {
  steady: "Steady", bloom: "Bloom", milestone: "Milestone", uphill: "Lean · uphill", storm: "Storm", paused: "Paused",
};
const PIECE_LABEL: Record<Piece["kind"], string> = {
  grove: "Habit grove", cottage: "A cottage", observatory: "The observatory", monument: "A milestone", bench: "We paused here",
  lanterns: "Lanterns", giftTree: "The ribbon tree", loop: "A running loop", cafe: "String lights", rows: "Garden rows", pond: "A still pond",
  star: "A first", firstFire: "Our first campfire", dogMeadow: "Pet days", kiln: "The kiln", workshop: "A little workshop", creek: "A storm we weathered",
};
const LANTERN_KEY = "hearth:pathWorld:lantern";
const MARK_PRIORITY: Record<Mark["kind"], number> = {
  now: 0, move: 1, unknown: 2, fire: 3, tent: 4, goal: 5, bill: 6, name: 7, memory: 8, cove: 9, lamp: 10, piece: 11, month: 12,
};

function monthName(key: string, long = true): string {
  const [y, m] = key.split("-").map(Number) as [number, number];
  return new Date(y, m - 1, 1).toLocaleDateString("en-CA", long ? { month: "long", year: "numeric" } : { month: "short" });
}
function readLantern(): Lantern {
  try { const raw = window.localStorage.getItem(LANTERN_KEY); return raw === "0" ? 0 : raw === "2" ? 2 : 1; } catch { return 1; }
}
function commandOk(outcome: unknown): boolean {
  return Boolean(outcome && typeof outcome === "object" && "ok" in outcome && (outcome as { ok: unknown }).ok === true);
}
function monthIndexOf(months: PathMonth[], iso: string | null | undefined): number {
  if (!iso) return -1;
  return months.findIndex((m) => m.key === iso.slice(0, 7));
}

export function OurPathWorld({ household, memberId, today, busy, onCommand, onOpenFund, classicRoom, theme: themeOverride, openTentFor }: {
  household: Household;
  memberId: string;
  today: DateKey;
  busy: boolean;
  onCommand: Run;
  onOpenFund?: () => void;
  /** Today's Our Path, kept mounted so drafts survive a trip into the tent. */
  classicRoom: ReactNode;
  /** Proof pages only; the app follows the signed-in person's appearance. */
  theme?: import("../theme/scenes.ts").ThemeId;
  /** A Hercules source link aimed at today's Our Path: open the tent so the focus lands where people can see it. */
  openTentFor?: unknown;
}) {
  const appearance = useAppearance();
  const theme = themeOverride ?? appearance.scene.theme;
  const reduced = (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches)
    || (typeof document !== "undefined" && document.documentElement.dataset.motion === "reduced");
  const wanted = typeof matchMedia !== "function" || !matchMedia("(forced-colors: active)").matches;

  const months = useMemo(() => pathMonths(household, today), [household, today]);
  const recipes = useMemo(() => effectivePathRecipes(household), [household]);
  const [cur, setCur] = useState(() => months.length - 1);
  const [followNow, setFollowNow] = useState(true);
  useEffect(() => { if (followNow) setCur(months.length - 1); }, [months.length, followNow]);
  const last = months.length - 1;
  const shown = Math.max(0, Math.min(cur, last));
  const atNow = shown === last;
  const island = useMemo(() => growIsland(months, recipes, shown), [months, recipes, shown]);
  const characters = useMemo(() => months.map(pathMonthCharacter), [months]);
  const islandName = pathIslandName(household);
  const proposals = useMemo(() => pendingPathProposals(household), [household]);
  const [lantern, setLantern] = useState<Lantern>(() => readLantern());
  const [level, setLevel] = useState<PathLevel>(0);
  const [layers, setLayers] = useState({ weather: true, story: true, rhythm: true });
  const [selected, setSelected] = useState<string | null>(null);
  const [tentOpen, setTentOpen] = useState(false);
  const [live, setLive] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [naming, setNaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [notice, setNotice] = useState("");
  const tentButton = useRef<HTMLButtonElement>(null);
  const backButton = useRef<HTMLButtonElement>(null);
  const tentMoved = useRef(false);
  useEffect(() => {
    if (!tentMoved.current) return;
    (tentOpen ? backButton : tentButton).current?.focus();
  }, [tentOpen]);
  const openTent = useCallback((next: boolean) => { tentMoved.current = true; setTentOpen(next); }, []);
  useEffect(() => { if (openTentFor) { tentMoved.current = false; setTentOpen(true); } }, [openTentFor]);

  // ------------------------------------------------------------ the pieces standing on the island
  const chapter = openChapterFor(household);
  const activeMembers = household.members.filter((m) => m.active);
  const nameOf = (id: string | null | undefined) => household.members.find((m) => m.id === id)?.name ?? "Either of us";
  const next = nextMove(household, memberId);
  const moves = useMemo(() => (chapter && atNow ? movesForChapter(household, chapter.id).filter((m) => m.state !== "declined") : []), [household, chapter, atNow]);
  const goals = useMemo(() => kittyBanksInView(household, "household", memberId), [household, memberId]);
  const rhythm = useMemo(() => ourRhythm(household), [household]);
  const kept = useMemo(() => memories(household), [household]);
  const bills = useMemo(() => {
    if (!atNow) return [];
    try {
      const rows = monthObligations(household, monthKeyFromDateKey(today), today).rows.filter((row) => row.date >= today).slice(0, 4);
      const total = rows.reduce((sum, row) => sum + row.amountCents, 0) || 1;
      return rows.map((row) => ({ ...row, big: row.amountCents / total > 0.4 }));
    } catch { return []; }
  }, [household, today, atNow]);

  const unknown = useMemo(() => {
    const out: { id: string; month: number; spec: PathRecipeSpec; label: string }[] = [];
    const pendingNames = new Set(proposals.flatMap((row) => (row.kind === "recipe" && row.pending ? [JSON.stringify(row.pending.when)] : [])));
    const covered = (when: PathRecipeSpec["when"]) => recipes.some((r) => JSON.stringify(r.when) === JSON.stringify(when) || ("signal" in r.when && "signal" in when && r.when.signal === when.signal)) || pendingNames.has(JSON.stringify(when));
    for (let m = 0; m <= shown && m < months.length; m++) {
      const month = months[m]!;
      for (const signal of ["pets", "creative"] as PathSignal[]) {
        if (month.scores[signal] >= 0.4 && !out.some((u) => u.id === `unknown:${signal}`)) {
          const spec = herculesPathSuggestion({ signal });
          if (!covered(spec.when)) out.push({ id: `unknown:${signal}`, month: m, spec, label: PATH_SIGNAL_LABELS[signal].label });
        }
      }
      for (const category of month.unmappedCategories) {
        const id = `unknown:category:${category.id}`;
        if (out.some((u) => u.id === id)) continue;
        const spec = herculesPathSuggestion({ categoryId: category.id, categoryName: category.name });
        if (!covered(spec.when)) out.push({ id, month: m, spec, label: category.name });
      }
    }
    return out.slice(0, 4);
  }, [months, shown, recipes, proposals]);

  const worldInput = useMemo<PathWorldInput>(() => ({
    island,
    theme,
    characters,
    campfires: (household.chapters ?? []).map((row) => ({ id: `fire:${row.id}`, month: monthIndexOf(months, row.openedAt), lit: row.state === "open" && atNow, state: row.state })),
    moves: moves.map((move) => ({
      id: `move:${move.id}`,
      state: move.state === "done" ? "done" as const
        : move.needsAcknowledgment && move.acknowledgedByMemberIds.length < activeMembers.length ? "waiting" as const
          : move.id === next?.id ? "next" as const : "open" as const,
    })),
    goals: goals.slice(0, 6).map((goal) => {
      const piece = displayedKittyPiece(goal.envelope?.studio);
      return { id: `goal:${goal.id}`, step: kittyBankBackingStep(household, goal, today), piece, fired: Boolean(piece?.firedAt) };
    }),
    lamps: rhythm.map((row) => ({ id: `lamp:${row.id}`, month: Math.max(0, monthIndexOf(months, row.heldOn.at(-1) ?? row.updatedAt)) })),
    memories: kept.map((row) => ({ id: `memory:${row.id}`, month: Math.max(0, monthIndexOf(months, row.shownAt)) })).filter((row) => row.month <= shown),
    weather: bills.map((row) => ({ id: `bill:${row.id}`, big: row.big })),
    unknown: unknown.map((row) => ({ id: row.id, month: row.month })),
    name: islandName,
    layers,
  }), [island, theme, characters, household, months, atNow, moves, activeMembers.length, next, goals, today, rhythm, kept, shown, bills, unknown, islandName, layers]);

  // ------------------------------------------------------------ marks: the real buttons over the canvas
  const marks = useMemo(() => {
    const list: Mark[] = [];
    months.forEach((month, m) => {
      if (m > shown) return;
      if (m === shown) list.push({ id: `month:${m}`, label: atNow ? "We are here" : monthName(month.key), sub: CHARACTER_LABEL[characters[m]!], kind: "now", minLevel: 0, lantern: 0 });
      else list.push({ id: `month:${m}`, label: monthName(month.key, false), sub: CHARACTER_LABEL[characters[m]!], kind: "month", minLevel: 1, lantern: 1 });
    });
    for (const row of household.chapters ?? []) if (monthIndexOf(months, row.openedAt) <= shown && monthIndexOf(months, row.openedAt) >= 0) list.push({ id: `fire:${row.id}`, label: row.title, sub: row.state === "open" ? "this Chapter" : row.state.replace("-", " "), kind: "fire", minLevel: 1, lantern: 0 });
    for (const row of moves) list.push({ id: `move:${row.id}`, label: row.text, sub: row.state === "done" ? `done · ${nameOf(row.completedByMemberId)}` : nameOf(row.ownerMemberId), kind: "move", minLevel: 3, lantern: 0 });
    goals.slice(0, 6).forEach((goal) => list.push({ id: `goal:${goal.id}`, label: goal.name, sub: `${kittyBankBackingStep(household, goal, today)} of 10 steps`, kind: "goal", minLevel: 0, lantern: 0 }));
    island.pieces.forEach((piece, i) => list.push({ id: `piece:${i}`, label: piece.kind === "observatory" ? `Observatory · ${piece.floors} floor${piece.floors === 1 ? "" : "s"}` : PIECE_LABEL[piece.kind], kind: "piece", minLevel: 2, lantern: 1 }));
    island.coves.forEach((cove, i) => {
      list.push({ id: `cove:${i}`, label: cove.name, sub: cove.visits.length > 1 ? `${cove.visits.length} visits` : undefined, kind: "cove", minLevel: 1, lantern: 1 });
      if (cove.type === "sea" && island.cur >= cove.month + 12) list.push({ id: `bottle:${i}`, label: "A message in a bottle", kind: "cove", minLevel: 2, lantern: 1 });
    });
    for (const row of rhythm) list.push({ id: `lamp:${row.id}`, label: row.title, sub: "Our Rhythm", kind: "lamp", minLevel: 2, lantern: 1 });
    for (const row of kept) if (Math.max(0, monthIndexOf(months, row.shownAt)) <= shown) list.push({ id: `memory:${row.id}`, label: row.title || "A Memory", kind: "memory", minLevel: 2, lantern: 1 });
    for (const row of bills) list.push({ id: `bill:${row.id}`, label: row.label, sub: lantern === 2 ? `${formatCad(row.amountCents)} · ${row.date.slice(5)}` : row.date.slice(5), kind: "bill", minLevel: 2, lantern: 1 });
    for (const row of unknown) list.push({ id: row.id, label: "Something new", sub: row.label, kind: "unknown", minLevel: 1, lantern: 0 });
    if (atNow && chapter) list.push({ id: "tent", label: "Plan Studio", sub: "today's Our Path", kind: "tent", minLevel: 1, lantern: 0 });
    if (islandName) list.push({ id: "name", label: islandName, kind: "name", minLevel: 1, lantern: 0 });
    return list;
  }, [months, shown, atNow, characters, household, moves, goals, today, island, rhythm, kept, bills, lantern, unknown, chapter, islandName]);

  // ------------------------------------------------------------ the world host
  const host = useRef<HTMLDivElement>(null);
  const world = useRef<PathWorld | null>(null);
  const markRefs = useRef(new Map<string, HTMLButtonElement>());
  const labelSizes = useRef(new Map<string, { w: number; h: number }>());
  useEffect(() => { labelSizes.current.clear(); }, [lantern, marks]);
  const view = useRef({ level: 0 as PathLevel, lantern, marks });
  view.current = { level, lantern, marks };
  const latestInput = useRef(worldInput);
  latestInput.current = worldInput;
  const selectRef = useRef<(id: string) => void>(() => {});

  const applyAnchors = useCallback((anchors: PathAnchor[]) => {
    const { level: lv, lantern: ln, marks: list } = view.current;
    const byId = new Map(list.map((m) => [m.id, m]));
    const near = [150, 150, 90, 46][lv]!;
    // Most important first; a label that would sit on top of one already placed waits until you move closer.
    const candidates = anchors.flatMap((a) => {
      const mark = byId.get(a.id);
      const el = markRefs.current.get(a.id);
      if (!el || !mark) return [];
      const show = a.visible && lv >= mark.minLevel && ln >= mark.lantern && (mark.kind === "now" || mark.kind === "goal" || lv < 2 || a.depth < near);
      return [{ a, el, mark, show }];
    }).sort((x, y) => (MARK_PRIORITY[x.mark.kind] - MARK_PRIORITY[y.mark.kind]) || (x.a.depth - y.a.depth));
    const reported = new Set(anchors.map((a) => a.id));
    for (const [id, el] of markRefs.current) if (!reported.has(id) && !el.hidden) el.hidden = true;
    const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
    for (const { a, el, mark, show } of candidates) {
      let visible = show;
      if (visible) {
        let size = labelSizes.current.get(mark.id);
        if (!size || size.w === 0) {
          size = { w: el.offsetWidth || mark.label.length * 8 + 20, h: el.offsetHeight || 30 };
          if (el.offsetWidth) labelSizes.current.set(mark.id, size);
        }
        const box = { x0: a.x - size.w / 2 - 2, x1: a.x + size.w / 2 + 2, y0: a.y - size.h - 2, y1: a.y + 2 };
        if (mark.kind !== "now" && placed.some((p) => box.x0 < p.x1 && box.x1 > p.x0 && box.y0 < p.y1 && box.y1 > p.y0)) visible = false;
        else placed.push(box);
      }
      if (el.hidden === visible) el.hidden = !visible;
      if (visible) {
        el.style.transform = `translate(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px)`;
        el.style.zIndex = String(1000 - Math.round(a.depth));
      }
    }
  }, []);

  useEffect(() => {
    const element = host.current;
    if (!element || !wanted || tentOpen) { setLive(false); return; }
    let dead = false;
    let created: PathWorld | null = null;
    let observer: ResizeObserver | null = null;
    import("./world/pathWorld3d.ts")
      .then(({ createPathWorld }) => {
        if (dead) return;
        try {
          created = createPathWorld(element, {
            reducedMotion: reduced,
            onLost: () => { created?.dispose(); world.current = null; if (!dead) setLive(false); },
            onAnchors: applyAnchors,
            onLevel: (lv) => { if (!dead) setLevel(lv); },
            onPick: (id) => selectRef.current(id),
          });
        } catch {
          if (!dead) setLive(false);
          return;
        }
        world.current = created;
        const size = () => created?.resize(element.clientWidth, element.clientHeight);
        size();
        if (typeof ResizeObserver === "function") { observer = new ResizeObserver(size); observer.observe(element); }
        setLive(true);
      })
      .catch(() => { if (!dead) setLive(false); });
    return () => { dead = true; observer?.disconnect(); created?.dispose(); world.current = null; };
    // The world is created once per mount/theme gate; scene changes arrive below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, reduced, tentOpen, applyAnchors]);

  const lastShown = useRef(shown);
  useEffect(() => {
    if (!live) return;
    const grew = shown === lastShown.current + 1;
    lastShown.current = shown;
    world.current?.setScene(worldInput, months[shown]?.key, grew);
  }, [worldInput, live, shown, months]);
  useEffect(() => { world.current?.refresh(); }, [lantern, marks, level, live]);
  useEffect(() => { world.current?.setAmbient(!appearance.paused && !playing); }, [appearance.paused, live, playing]);
  useEffect(() => { try { window.localStorage.setItem(LANTERN_KEY, String(lantern)); } catch { /* per-device convenience only */ } }, [lantern]);

  // Replay: grow the island month by month.
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setCur((value) => {
        if (value >= last) { setPlaying(false); setFollowNow(true); return value; }
        return value + 1;
      });
    }, reduced ? 900 : 1300);
    return () => window.clearInterval(timer);
  }, [playing, last, reduced]);

  const select = useCallback((id: string) => {
    if (id === "tent") { openTent(true); return; }
    setSelected(id);
    world.current?.focus(id, id.startsWith("month:") ? 2 : 3);
  }, [openTent]);
  selectRef.current = select;

  // ------------------------------------------------------------ details (the card grows with the lantern)
  const run = async (fn: (current: Household) => CommitResult, done: string) => {
    const outcome = await onCommand(fn);
    if (commandOk(outcome) || outcome === undefined) setNotice(done);
  };
  function detailFor(id: string): Detail | null {
    if (id.startsWith("month:")) {
      const m = Number(id.slice(6));
      const month = months[m];
      if (!month) return null;
      const top = PATH_SIGNALS.filter((s) => month.scores[s] > 0).sort((a, b) => month.scores[b] - month.scores[a]);
      const grew = recipes.filter((r) => island.fired[r.id]?.includes(m)).map((r) => r.name);
      return {
        eyebrow: `${monthName(month.key)} · ${CHARACTER_LABEL[characters[m]!]}`,
        title: m === last ? "This month, so far" : `How ${monthName(month.key, false)} grew`,
        lines: [
          [0, grew.length ? `What grew: ${grew.join(" · ")}` : "The land rested. Healthy is quiet."],
          ...top.slice(0, 5).map((s): [Lantern, string] => [1, `${PATH_SIGNAL_LABELS[s].label}${month.why[s] ? ` — ${month.why[s]}` : ""}`]),
          ...top.slice(0, 5).map((s): [Lantern, string] => [2, `${PATH_SIGNAL_LABELS[s].label} score ${month.scores[s].toFixed(2)}`]),
          ...(month.why.milestone ? [[0, `Milestone: ${month.why.milestone}`] as [Lantern, string]] : []),
        ],
      };
    }
    if (id.startsWith("fire:")) {
      const row = (household.chapters ?? []).find((c) => `fire:${c.id}` === id);
      if (!row) return null;
      return {
        eyebrow: row.state === "open" ? "This Chapter" : "A past Chapter",
        title: row.title,
        lines: [[0, row.meaning || "A Sitdown-to-Sitdown month."], [1, `Opened ${row.openedAt.slice(0, 10)}${row.closedAt ? ` · closed ${row.closedAt.slice(0, 10)}` : ""}`], [1, row.state === "open" ? "Still being lived" : `Closed as ${row.state.replace("-", " ")}`], ...(row.carryForward ? [[2, `Carried forward: ${row.carryForward}`] as [Lantern, string]] : [])],
        actions: row.state === "open" ? <button type="button" className="primary" onClick={() => openTent(true)}>Open the Chapter room</button> : undefined,
      };
    }
    if (id.startsWith("move:")) {
      const move = moves.find((m) => `move:${m.id}` === id);
      if (!move) return null;
      const acked = move.acknowledgedByMemberIds.includes(memberId);
      return {
        eyebrow: "A Move · this Chapter",
        title: move.text,
        lines: [
          [0, move.state === "done" ? `Done by ${nameOf(move.completedByMemberId)}` : move.ownerMemberId ? `${nameOf(move.ownerMemberId)} owns it` : "Either of us can take it"],
          ...(move.needsAcknowledgment ? [[1, `Acknowledged by ${move.acknowledgedByMemberIds.length} of ${activeMembers.length}`] as [Lantern, string]] : []),
          ...(move.completedAt ? [[2, `Finished ${move.completedAt.slice(0, 10)}`] as [Lantern, string]] : []),
        ],
        actions: move.state === "done" ? undefined : (
          <>
            {move.needsAcknowledgment && !acked && <button type="button" className="primary" disabled={busy} onClick={() => void run((h) => respondToMove(h, { memberId, moveId: move.id, response: "acknowledge" }), "Acknowledged. The stone knows.")}>Acknowledge</button>}
            <button type="button" disabled={busy || (move.needsAcknowledgment && move.acknowledgedByMemberIds.length < activeMembers.length)} onClick={() => void run((h) => completeMove(h, { memberId, moveId: move.id }), "Done. The stone is lit.")}>Mark done</button>
          </>
        ),
      };
    }
    if (id.startsWith("goal:")) {
      const goal = goals.find((g) => `goal:${g.id}` === id);
      if (!goal) return null;
      const step = kittyBankBackingStep(household, goal, today);
      return {
        eyebrow: "A landmark · Kitty Bank",
        title: goal.name,
        lines: [[0, step >= 10 ? "Full." : step >= 5 ? "Past halfway." : "Growing."], [1, `${step} of 10 steps, from money actually set aside`], [2, goal.arrivalDate ? `Hoping for ${goal.arrivalDate}` : "No end date"]],
        actions: <button type="button" className="primary" onClick={() => openTent(true)}>Open Kitty Banks</button>,
      };
    }
    if (id.startsWith("piece:")) {
      const piece = island.pieces[Number(id.slice(6))];
      if (!piece) return null;
      return {
        eyebrow: "Why this is here",
        title: piece.kind === "observatory" ? `Observatory · ${piece.floors} floors` : PIECE_LABEL[piece.kind],
        lines: [...piece.why.slice(0, 1).map((w): [Lantern, string] => [0, w]), ...piece.why.slice(1).map((w): [Lantern, string] => [1, w]), ...(piece.kind === "grove" ? [[1, `${piece.age} month${piece.age === 1 ? "" : "s"} old. A small plate reads “together”.`] as [Lantern, string]] : [])],
      };
    }
    if (id.startsWith("cove:") || id.startsWith("bottle:")) {
      const cove = island.coves[Number(id.split(":")[1])];
      if (!cove) return null;
      return {
        eyebrow: id.startsWith("bottle:") ? "A message in a bottle" : "The coast a trip shaped",
        title: cove.name,
        lines: [[0, cove.visits.length > 1 ? `You went ${cove.visits.length} times. Each return widened this ${cove.type === "mountain" ? "headland" : "cove"}.` : "Go back to the same place and this spot deepens instead of a new one forming."], ...cove.why.map((w): [Lantern, string] => [1, w]), ...(id.startsWith("bottle:") ? [[0, "A year on, the sea brought something back."] as [Lantern, string]] : [])],
      };
    }
    if (id.startsWith("lamp:")) {
      const row = rhythm.find((r) => `lamp:${r.id}` === id);
      return row ? { eyebrow: "Our Rhythm", title: row.title, lines: [[0, "A habit that settled in. It lights on its day."], [1, `Held ${row.heldOn.length} times`], [2, `${nameOf(row.ownerMemberId)} owns it`]] } : null;
    }
    if (id.startsWith("memory:")) {
      const row = kept.find((r) => `memory:${r.id}` === id);
      return row ? { eyebrow: "Our Story", title: row.title || "A Memory", lines: [[0, row.authoredNote || "Kept by both of you."], [1, `Kept ${row.shownAt.slice(0, 10)}`]] } : null;
    }
    if (id.startsWith("bill:")) {
      const row = bills.find((b) => `bill:${b.id}` === id);
      return row ? {
        eyebrow: "Weather ahead", title: row.label,
        lines: [[0, `Rolling in ${row.date}`], [1, formatCad(row.amountCents)], [2, "Bigger clouds are bigger bills. The full timeline lives in the Fund."]],
        actions: onOpenFund ? <button type="button" onClick={onOpenFund}>Open the Fund</button> : undefined,
      } : null;
    }
    if (id.startsWith("unknown:")) {
      const row = unknown.find((u) => u.id === id);
      if (!row) return null;
      return {
        eyebrow: "Hercules suggests",
        title: row.spec.name,
        lines: [[0, `Hearth hasn't seen “${row.label}” on the island yet.`], [0, `Hercules would grow ${PATH_BRUSH_LABELS[row.spec.brush]}.`], [1, "It joins once you both agree."]],
        actions: <button type="button" className="primary" disabled={busy} onClick={() => void run((h) => proposePathRecipe(h, { memberId, spec: row.spec, proposedBy: "hercules" }), "Suggested. It grows once you both agree.")}>Suggest this to both of us</button>,
      };
    }
    if (id === "name" && islandName) return { eyebrow: "Our island", title: islandName, lines: [[0, "Named together. The sign stands by your first month."]] };
    return null;
  }
  const detail = selected ? detailFor(selected) : null;

  // ------------------------------------------------------------ render
  const nowMonth = months[shown];
  const recipeRows = shapePathWorld(household.pathWorld).filter((row): row is PathRecipeRow => row.kind === "recipe");
  return (
    <div className={`path-world path-world--${theme}`} data-level={level} data-lantern={lantern}>
      <section className="path-world__island" hidden={tentOpen} aria-labelledby="path-world-title">
        <header className="path-world__head">
          <p className="kicker">Our Path</p>
          <h2 id="path-world-title">{islandName ?? "Where we are going"}</h2>
          <p className="path-world__lede">The land grows from your shared months. Move closer to see more.</p>
          <button type="button" className="path-world__link" aria-expanded={naming} onClick={() => { setNaming((v) => !v); setNameDraft(islandName ?? ""); }}>{islandName ? "Rename together" : "Name our island together"}</button>
          {naming && (
            <form className="path-world__namer" onSubmit={(e) => { e.preventDefault(); void run((h) => proposePathName(h, { memberId, name: nameDraft }), "Suggested. The name sticks once you both agree.").then(() => setNaming(false)); }}>
              <label htmlFor="path-world-name">What should our island be called?</label>
              <input id="path-world-name" value={nameDraft} maxLength={40} onChange={(e) => setNameDraft(e.target.value)} />
              <button type="submit" className="primary" disabled={busy || !nameDraft.trim()}>Suggest this name</button>
            </form>
          )}
        </header>

        <div className="path-world__stage">
          <div ref={host} className="path-world__host" data-live={live} />
          {!live && (
            <div className="path-world__flat" aria-hidden="true">
              <svg viewBox="-60 -60 120 120" role="presentation">
                {months.slice(0, shown + 1).map((month, m) => {
                  const p = island.spot(m), k = 54 / Math.max(20, Math.hypot(island.spot(last).x, island.spot(last).z));
                  return <circle key={month.key} cx={p.x * k} cy={p.z * k} r={m === shown ? 3.4 : 2.4} className={`path-world__dot path-world__dot--${characters[m]}`} />;
                })}
              </svg>
            </div>
          )}
          <div className="path-world__marks" hidden={!live}>
            {marks.map((mark) => (
              <button
                key={mark.id}
                type="button"
                hidden
                ref={(el) => { if (el) markRefs.current.set(mark.id, el); else markRefs.current.delete(mark.id); }}
                className={`path-mark path-mark--${mark.kind}`}
                aria-label={`${mark.label}${mark.sub ? `, ${mark.sub}` : ""}`}
                onClick={() => select(mark.id)}
              >
                <span className="path-mark__label">{mark.label}</span>
                {mark.sub && lantern > 0 && <span className="path-mark__sub">{mark.sub}</span>}
              </button>
            ))}
          </div>

          <div className="path-world__controls">
            <div className="path-world__lantern" role="group" aria-label="How much detail to show">
              {LANTERNS.map((l) => <button key={l.value} type="button" aria-pressed={lantern === l.value} onClick={() => setLantern(l.value)}><i aria-hidden="true" />{l.label}</button>)}
            </div>
            <div className="path-world__layers" role="group" aria-label="Layers">
              {(["weather", "story", "rhythm"] as const).map((key) => (
                <button key={key} type="button" aria-pressed={layers[key]} onClick={() => setLayers((v) => ({ ...v, [key]: !v[key] }))}>{key === "weather" ? "Weather" : key === "story" ? "Story" : "Rhythm"}</button>
              ))}
            </div>
          </div>
          <div className="path-world__rail" role="group" aria-label="Distance">
            {LEVELS.map((l) => <button key={l.level} type="button" aria-current={level === l.level} onClick={() => world.current?.setLevel(l.level)} disabled={!live}>{l.label}</button>)}
            <button type="button" aria-label="Move closer" onClick={() => world.current?.zoom(0.72)} disabled={!live}>+</button>
            <button type="button" aria-label="Move away" onClick={() => world.current?.zoom(1.38)} disabled={!live}>−</button>
          </div>
          <div className="path-world__now">
            <button type="button" className="path-world__compass" onClick={() => { setFollowNow(true); setCur(last); setSelected(null); window.setTimeout(() => world.current?.focus("now", 2), 0); }}>Where we are</button>
            {next && atNow && <button type="button" className="path-world__next" onClick={() => select(`move:${next.id}`)}><span>Next Move</span>{next.text}</button>}
            <button ref={tentButton} type="button" className="primary path-world__tent" onClick={() => openTent(true)}>Open the Plan Studio tent</button>
          </div>

          {detail && (
            <aside className="path-world__card" aria-live="polite" aria-labelledby="path-world-card-title">
              <button type="button" className="path-world__close" aria-label="Close" onClick={() => setSelected(null)}>×</button>
              <p className="kicker">{detail.eyebrow}</p>
              <h3 id="path-world-card-title">{detail.title}</h3>
              <ul>{detail.lines.filter(([min]) => lantern >= min).map(([, text], i) => <li key={i}>{text}</li>)}</ul>
              {lantern < 2 && detail.lines.some(([min]) => min > lantern) && <p className="muted">Turn the lantern up for more.</p>}
              {detail.actions && <div className="path-world__actions">{detail.actions}</div>}
            </aside>
          )}
        </div>

        <div className="path-world__grow">
          <button type="button" className="path-world__play" aria-label={playing ? "Pause the replay" : "Replay the island growing"} aria-pressed={playing} disabled={months.length < 2} onClick={() => { if (playing) { setPlaying(false); return; } setFollowNow(false); setCur(0); setPlaying(true); }}>{playing ? "Pause" : "Replay"}</button>
          <div className="path-world__when">
            <strong>{nowMonth ? monthName(nowMonth.key) : ""}</strong>
            {nowMonth && <span className={`path-chip path-chip--${characters[shown]}`}>{CHARACTER_LABEL[characters[shown]!]}</span>}
          </div>
          <label className="path-world__slider">
            <span className="sr-only">Grow through the months</span>
            <input type="range" min={0} max={Math.max(0, last)} step={1} value={shown} disabled={months.length < 2}
              aria-valuetext={nowMonth ? `${monthName(nowMonth.key)}, ${CHARACTER_LABEL[characters[shown]!]}` : undefined}
              onChange={(e) => { setPlaying(false); const v = Number(e.target.value); setFollowNow(v === last); setCur(v); }} />
          </label>
          <ol className="path-world__ticks" aria-hidden="true">
            {months.map((month, m) => <li key={month.key} className={`path-chip--${characters[m]}`} data-current={m === shown} />)}
          </ol>
        </div>
        {notice && <p className="path-world__notice" role="status">{notice}</p>}

        <div className="path-world__panels">
          {proposals.length > 0 && (
            <section className="path-world__panel path-world__proposals" aria-labelledby="path-world-waiting">
              <h3 id="path-world-waiting">Waiting for both of you</h3>
              <ul>
                {proposals.map((row) => {
                  const mine = row.agreedByMemberIds.includes(memberId);
                  const title = row.kind === "name" ? `Call the island “${row.pending}”` : `${(row.pending as PathRecipeSpec).name} — grows ${PATH_BRUSH_LABELS[(row.pending as PathRecipeSpec).brush]}`;
                  return (
                    <li key={row.id}>
                      <p><strong>{title}</strong></p>
                      <p className="muted">{row.kind === "recipe" && row.proposedBy === "hercules" ? "Hercules suggested it. " : ""}Agreed: {row.agreedByMemberIds.map(nameOf).join(", ") || "nobody yet"}.</p>
                      <div className="path-world__actions">
                        {!mine && <button type="button" className="primary" disabled={busy} onClick={() => void run((h) => agreePathProposal(h, { memberId, rowId: row.id, revision: row.pendingRevision }), row.id === PATH_NAME_ID ? "Agreed." : "Agreed. The island will regrow.")}>I agree</button>}
                        <button type="button" disabled={busy} onClick={() => void run((h) => declinePathProposal(h, { memberId, rowId: row.id, revision: row.pendingRevision }), "Set aside.")}>{mine ? "Withdraw" : "Not now"}</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <details className="path-world__panel">
            <summary>What grows, and when</summary>
            <p className="muted">These rules turn your months into land. Changing one needs both of you; nobody changes the app's code.</p>
            <ul className="path-recipes">
              {recipes.map((recipe) => <RecipeRow key={recipe.id} recipe={recipe} row={recipeRows.find((r) => r.baseId === recipe.id || r.id === recipe.id) ?? null} fired={island.fired[recipe.id]?.length ?? 0} busy={busy} onPropose={(spec) => void run((h) => proposePathRecipe(h, { memberId, spec, ...(PATH_BASE_RECIPES.some((b) => b.id === recipe.id) ? { baseId: recipe.id } : { rowId: recipe.id }) }), "Suggested. It changes once you both agree.")} />)}
            </ul>
          </details>

          <details className="path-world__panel">
            <summary>How our categories show</summary>
            <p className="muted">Hearth guesses from each category's name. Fix any guess; it only changes decoration.</p>
            <CategoryList household={household} busy={busy} onSet={(categoryId, signal) => void run((h) => setPathCategorySignal(h, { memberId, categoryId, signal }), "Updated.")} />
          </details>

          <details className="path-world__panel path-world__outline">
            <summary>Everything on the island</summary>
            <ul>
              {marks.map((mark) => <li key={mark.id}><button type="button" onClick={() => select(mark.id)}>{mark.label}{mark.sub ? ` · ${mark.sub}` : ""}</button></li>)}
            </ul>
          </details>
        </div>
      </section>

      <section className="path-world__room" hidden={!tentOpen} aria-label="Plan Studio tent">
        <button ref={backButton} type="button" className="path-world__back" onClick={() => openTent(false)}>Back to the island</button>
        {classicRoom}
      </section>
    </div>
  );
}

function RecipeRow({ recipe, row, fired, busy, onPropose }: { recipe: PathRecipe; row: PathRecipeRow | null; fired: number; busy: boolean; onPropose: (spec: PathRecipeSpec) => void }) {
  const [draft, setDraft] = useState<PathRecipeSpec>({ name: recipe.name, when: recipe.when, brush: recipe.brush, on: recipe.on });
  const recipeKey = JSON.stringify([recipe.name, recipe.when, recipe.brush, recipe.on]);
  // Reset only when the agreed recipe itself changes, not whenever a sync hands back new objects.
  useEffect(() => { setDraft({ name: recipe.name, when: recipe.when, brush: recipe.brush, on: recipe.on }); }, [recipeKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const changed = JSON.stringify(draft) !== JSON.stringify({ name: recipe.name, when: recipe.when, brush: recipe.brush, on: recipe.on });
  const id = `path-recipe-${recipe.id}`;
  return (
    <li className={`path-recipe${recipe.on ? "" : " is-off"}`}>
      <div className="path-recipe__top">
        <strong>{recipe.name}</strong>
        <span className="path-recipe__fired" title="Months this grew something">×{fired}</span>
      </div>
      <div className="path-recipe__rule">
        <label htmlFor={`${id}-on`}><input id={`${id}-on`} type="checkbox" checked={draft.on} onChange={(e) => setDraft({ ...draft, on: e.target.checked })} /> On</label>
        {"signal" in draft.when ? (
          <>
            <label htmlFor={`${id}-signal`} className="sr-only">Score</label>
            <select id={`${id}-signal`} value={draft.when.signal} onChange={(e) => setDraft({ ...draft, when: { ...(draft.when as { signal: PathSignal; min: number }), signal: e.target.value as PathSignal } })}>
              {PATH_SIGNALS.map((s) => <option key={s} value={s}>{PATH_SIGNAL_LABELS[s].label}</option>)}
            </select>
            {"max" in draft.when && draft.when.max !== undefined ? <span>at most {draft.when.max.toFixed(2)}</span> : (
              <>
                <label htmlFor={`${id}-min`} className="sr-only">At least</label>
                <input id={`${id}-min`} type="range" min={0.1} max={0.95} step={0.05} value={(draft.when as { min: number }).min} onChange={(e) => setDraft({ ...draft, when: { ...(draft.when as { signal: PathSignal; min: number }), min: Number(e.target.value) } })} />
                <span>≥ {(draft.when as { min: number }).min.toFixed(2)}</span>
              </>
            )}
          </>
        ) : <span>{"tag" in draft.when ? `when a month is marked “${draft.when.tag}”` : "when that category has spending"}</span>}
      </div>
      <div className="path-recipe__rule">
        <label htmlFor={`${id}-brush`}>grows</label>
        <select id={`${id}-brush`} value={draft.brush} onChange={(e) => setDraft({ ...draft, brush: e.target.value as PathRecipeSpec["brush"] })}>
          {PATH_BRUSHES.map((b) => <option key={b} value={b}>{PATH_BRUSH_LABELS[b]}</option>)}
        </select>
      </div>
      <p className="muted path-recipe__by">{recipe.by === "hearth" ? "Hearth's recipe" : recipe.by === "hercules" ? "Hercules suggested · agreed by both" : "Changed together"}{row?.pending ? " · a change is waiting" : ""}</p>
      {changed && <button type="button" className="primary" disabled={busy} onClick={() => onPropose(draft)}>Suggest this change</button>}
    </li>
  );
}

function CategoryList({ household, busy, onSet }: { household: Household; busy: boolean; onSet: (categoryId: string, signal: PathCategorySignal | "none") => void }) {
  const rows = pathCategoryMappings(household);
  return (
    <ul className="path-categories">
      {rows.map(({ category, signal, source }) => (
        <li key={category.id}>
          <label htmlFor={`path-cat-${category.id}`}>{category.name}<span className="muted">{source === "guess" ? " · Hearth's guess" : source === "fixed" ? " · set by you" : ""}</span></label>
          <select id={`path-cat-${category.id}`} value={signal ?? "none"} disabled={busy} onChange={(e) => onSet(category.id, e.target.value as PathCategorySignal | "none")}>
            <option value="none">Nothing on the island</option>
            {PATH_CATEGORY_SIGNALS.map((s) => <option key={s} value={s}>{PATH_SIGNAL_LABELS[s].label}</option>)}
          </select>
        </li>
      ))}
    </ul>
  );
}

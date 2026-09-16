import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import type { CommitResult, Household } from "../core/types.ts";
import { formatDayLabel, monthKeyFromDateKey, type DateKey } from "../core/calendar.ts";
import { formatCad } from "../core/money.ts";
import { monthObligations } from "../core/monthObligations.ts";
import { duePotentialExpenses, potentialExpensesForView } from "../core/potentialExpenses.ts";
import { deriveFundPulseInput, fundPulse, presenceLines, type FundPulseFreshness } from "../core/fundPulse.ts";
import { completeMove, nextMove, openChapterFor, respondToMove } from "../core/chapters.ts";
import { projectKittyNest, NEST_CATEGORY_LABELS } from "../core/kittyNest.ts";
import { fundDisplayName } from "../core/spaceNames.ts";
import {
  queenBankWords,
  queenBanks, queenBody, queenBuds, queenCrown, queenFeet, queenHands, queenHem, queenLine, queenRibbons, queenSeams, queenShelf, queenShelfOrder, QUEEN_SHELF_BANK_KEY, queenStill, queenTrace, queenVine,
  type QueenBankId,
} from "../core/queenPresentation.ts";
import { useEasyRead } from "../useEasyRead.ts";
import { QueenFigure } from "./QueenFigure.tsx";
import { QueenWorld, type QueenWorldMode } from "./QueenWorld.tsx";
import { queenSceneryKind } from "./world/queenScenery.ts";
import { QueenSceneryFlat } from "./QueenSceneryFlat.tsx";
import { useAppearance } from "../theme/ThemeProvider.tsx";
import { guardQueenDesignSave, queenBankFired, queenBankGlaze, queenBankPiece, queenForm, queenGlazeAxis, queenLook, queenPortraits, queenModelStill, queenPose, queenWheel, queenWorldStill, queenWornCharms, type QueenPaintablePart } from "./world/queenAuthoring.ts";
import { queenFormProfile, queenPortraitDue, queenPortraitOf, queenRingCount, type QueenFormHandles, type QueenPortraitV1, type QueenWheelV1 } from "../core/queenForm.ts";
import { localHour, queenLight } from "../core/queenLight.ts";
import { QueenWheel } from "./QueenWheel.tsx";
import { QueenPortraits } from "./QueenPortraits.tsx";
import type { QueenForm } from "./world/queenCharmSurface.ts";
import type { WorldBankInput, WorldPick, WorldQueenInput, WorldStats } from "./world/queenWorld.ts";
import { queenCharmKindsEarned, queenCharmLabel, queenCharmsEarned, type QueenCharmKind, type QueenCharmV1 } from "../core/queenCharms.ts";
import { queenCharmFlatPick, queenCharmFreeSeat, queenCharmSettle, QUEEN_CHARM_KEYBOARD_SEATS } from "./world/queenCharmSurface.ts";
import { QueenCharmTool, queenCharmSeatWords } from "./QueenCharmTool.tsx";
import { STUDIO_PALETTE } from "../kitty/studio/palette.ts";
import { KittyFlat } from "../kitty/studio/flat.tsx";
import { QueenHouseRail } from "./QueenHouseRail.tsx";
import { houseStep, type HouseMove, type HousePlace } from "./queenHouse.ts";
import { useHouseAxis } from "./useHouseAxis.ts";
import { saveKittyNestDesign } from "../core/kittyNestDesigns.ts";
import { rackSettled, type QueenRackV1 } from "../core/queenRack.ts";
import { projectHouseholdFund } from "../core/householdFund.ts";
import { allocateHouseholdFundSurplus } from "../core/commands.ts";
import { KITTY_GLAZES } from "../core/goalEnvelopes.ts";
import { formatDateLabel } from "../core/calendar.ts";
import type { KittyGlaze, KittyPaintV1, KittyStampKind } from "../core/types.ts";
import { QueenCellar } from "./QueenCellar.tsx";
import { QueenLoft } from "./QueenLoft.tsx";
import { useHeldSave } from "./useHeldSave.ts";
import { useOutsideClose } from "../useOutsideClose.ts";
import { PathMiniMap } from "../path/PathMiniMap.tsx";
import { pathMonths } from "../core/pathSignals.ts";
import { pathIslandName } from "../core/pathWorld.ts";
import "./queen-home.css";
import "./queen-glass.css";

type Run = (fn: (current: Household) => CommitResult) => Promise<unknown>;

export type QueenHomeProps = {
  household: Household;
  memberId: string;
  today: DateKey;
  freshness: FundPulseFreshness;
  busy: boolean;
  onCommand: Run;
  onGo: (tab: "ledger" | "plan" | "together" | "calendar" | "more") => void;
  onOpenSetup: (destination: "charter" | "fund") => void;
  /** Opens the existing nest gallery at a goal or a category bank — the reviewed command and Final Confirm boundary. */
  onOpenBank: (request: { goalId?: string; bankId?: string }) => void;
  identityArt?: ReactNode;
  /** The world: `auto` tries WebGL and degrades silently; `flat` keeps the drawn figure; `3d` insists (evidence only). */
  world?: QueenWorldMode;
  /** The local clock as a fractional hour, for the living light. Absent, the device clock. Evidence only. */
  clock?: number;
  /** The App's shell readings her world takes off the page (Vision v2 §4.2: nothing but her, the tabs and the nav). Kept behind the Status door, never dropped. */
  shell?: QueenShell;
};

/**
 * What the App's top bar, sync line and household switcher used to say on Home. In her world those surfaces are
 * gone from the page, so their readings live here: the Status door wears the attention label, and the Status panel
 * carries the person, the household, the device time, the environment, the transport, the revision, the freshness,
 * the recovery action, the household switcher and the office door. Nothing here posts money.
 */
export type QueenShell = {
  member: string;
  household: string;
  time: string;
  timeIso: string;
  environment: "development" | "production";
  onSwitchEnvironment?: () => void;
  sync: {
    visible: boolean;
    transportPrimary: string;
    revisionLine: string | null;
    updatedLine: string | null;
    tone: "neutral" | "warning" | "danger";
    /** The App's "Needs attention": books validation, sync freshness, integrity findings or the desk. */
    attentionLabel: string | null;
    attentionDetail: string | null;
    actionLabel: string | null;
    onAction?: () => void;
    /** Opens the Status Centre at the sync help — the same route the sync line offered. */
    onOpenDetails: () => void;
  };
  /** The household switcher, when more than one household is on this device. */
  households?: ReactNode;
  /** The office (instruments and boards) now lives at the Status Centre; this opens it there. */
  onOpenOffice?: () => void;
};

/** Doors: the two field doors carry everything that is not money; the three bank doors are the money hierarchy. */
type Door = "together" | "status" | QueenBankId;
/** The three floors of the house, and the only axis the shared home has. */
type Scene = HousePlace;
const ROOM_FOR: Partial<Record<Door, Scene>> = { protect: "cellar", build: "loft" };
/** The glass panel slides in from the edge opposite its door, so the door you came through stays visible and is the way deeper. */
const PANEL_SIDE: Record<Door, "left" | "right"> = { together: "right", protect: "right", whatnow: "right", build: "left", status: "left" };
const REVEAL_MS = 1800;
const sentence = (text: string) => text.trim().replace(/[.!?]+$/, "");
const PULL_THRESHOLD = 80;

/** Posture is the pose: a static scale and lean per state. */
const POSTURE: Record<ReturnType<typeof queenStill>["posture"], { scale: number; lean: number }> = {
  upright: { scale: 1, lean: 0 },
  "leaning-in": { scale: 0.97, lean: -1.5 },
  attentive: { scale: 0.98, lean: 0 },
  tilted: { scale: 0.9, lean: 3 },
  depleted: { scale: 0.82, lean: 2 },
  matte: { scale: 0.95, lean: 0 },
};

const WIDE_QUERY = "(min-width: 720px)";
function subscribeWide(callback: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const media = window.matchMedia(WIDE_QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
function readWide(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(WIDE_QUERY).matches;
}

/**
 * The Still Queen: Household Home as one figure in a field of nothing.
 *
 * At rest the whole inventory is her, one quiet line beneath her and — only
 * when one exists — the Move at her hands. Her body carries state and no text.
 * Navigation lives elsewhere: two near-invisible doors in the field (Together,
 * Status) that breathe in when the empty field is tapped, and the expand —
 * tapping her opens her into three banks (Protect · What Now · Build) with a
 * button above each. Panels peek; the cellar and the loft are the rooms, and
 * she does not follow you in.
 */
export function QueenHome({ household, memberId, today, freshness, busy, onCommand, onGo, onOpenSetup, onOpenBank, identityArt, world = "auto", clock, shell }: QueenHomeProps) {
  const wide = useSyncExternalStore(subscribeWide, readWide, () => false);
  const [easyRead] = useEasyRead(`${household.environment}:${household.householdId}:${memberId}`);
  const ids = useId();
  const panelId = `${ids}-panel`;

  // ---- what she shows: pure selectors over shipped projections ----
  const monthKey = monthKeyFromDateKey(today);
  const chapter = openChapterFor(household);
  const move = nextMove(household, memberId);
  const pulse = fundPulse(deriveFundPulseInput(household, { memberId, today, freshness, activeChapter: Boolean(chapter) }));
  const still = queenStill(pulse, freshness);
  const presence = presenceLines(household, { memberId, today });
  const crown = queenCrown(presence);
  const nest = useMemo(() => projectKittyNest(household, memberId, "household", today), [household, memberId, today]);
  const banks = queenBanks(nest);
  // Money model (D-271): the words follow the rules that produced the numbers.
  const { labels: QUEEN_BANK_LABELS, meanings: QUEEN_BANK_MEANINGS, lowerTitle, lowerRoom, lowerBankKey } = queenBankWords(nest.mode ?? 1);
  const buds = queenBuds(nest, 4);
  const vine = queenVine(household, chapter, today);
  const hands = queenHands(household, memberId, chapter, move);
  const body = queenBody(nest, freshness, queenSeams(household, today));
  const trace = queenTrace(household, memberId, today);
  const obligations = monthObligations(household, monthKey, today).rows;
  const planned = duePotentialExpenses(potentialExpensesForView(household.potentialExpenses, memberId, "household"), today);
  const stones = queenHem(obligations, planned, today, 4);
  const feet = queenFeet(stones);
  const line = queenLine(chapter, still);
  const fundName = fundDisplayName(household);
  const ribbons = useMemo(() => queenRibbons(household, today), [household, today]);
  // The ledge, in the order the household put it in: one list of design keys on the Build plan bank's own row.
  const shelfOrder = useMemo(() => queenShelfOrder(household.kittyNestDesigns), [household.kittyNestDesigns]);
  const shelf = useMemo(() => queenShelf(nest, household, shelfOrder), [nest, household, shelfOrder]);
  /** The loft's rack, settled to the banks the shelf has. Absent a stored rack, one shelf in the old order. */
  const keptRack = useMemo(() => rackSettled(household.kittyNestDesigns?.find((row) => row.bankKey === QUEEN_SHELF_BANK_KEY && row.visibility === "household")?.rack, shelf.map((item) => item.designKey), shelfOrder), [household.kittyNestDesigns, shelf, shelfOrder]);
  /** Moving a bank, a weight, a pin or a divider writes the whole rack once (and the old order from it). The last save wins, as it does everywhere else here. */
  const sendRack = useCallback((next: QueenRackV1) => {
    return onCommand((current) => {
      const design = current.kittyNestDesigns?.find((row) => row.bankKey === QUEEN_SHELF_BANK_KEY && row.visibility === "household");
      return saveKittyNestDesign(current, {
        memberId, view: "household", bankKey: QUEEN_SHELF_BANK_KEY, expectedRevision: design?.revision ?? 0,
        name: design?.name ?? "Build", glaze: design?.glaze ?? "cream", category: design?.category ?? null,
        ...(design?.studio ? { studio: design.studio } : {}), rack: next,
      });
    });
  }, [memberId, onCommand]);
  /** The rack is held while the hand is on it and sent once: on Done, on leaving the loft, or when the page goes (useHeldSave). */
  const heldRack = useHeldSave<QueenRackV1>(sendRack);
  const rack = useMemo(() => heldRack.draft ? rackSettled(heldRack.draft, shelf.map((item) => item.designKey), shelfOrder) : keptRack, [heldRack.draft, keptRack, shelf, shelfOrder]);
  const keepRack = heldRack.hold;
  /** The jug: the Fund's safe surplus, poured by its custodian through the month-end rollover, behind Confirm. */
  const loftPour = useMemo(() => {
    const fund = household.householdFund;
    if (!fund) return undefined;
    const projection = projectHouseholdFund(household, today);
    return {
      safeCents: Math.max(0, projection.safeRolloverCents),
      custodian: fund.custodianMemberId === memberId,
      custodianName: household.members.find((row) => row.id === fund.custodianMemberId)?.name ?? "The custodian",
      onPour: (allocations: Array<{ goalId: string; amountCents: number }>, _pouredCents: number, note?: string) => onCommand((current) => allocateHouseholdFundSurplus(current, {
        memberId, date: today, note: note ?? "Poured over the loft's rack", allocations: allocations.map((row) => ({ goalId: row.goalId, amount: (row.amountCents / 100).toFixed(2) })),
      })),
    };
  }, [household, memberId, today, onCommand]);
  const freshBud = trace && trace.region.startsWith("bud:") ? buds.findIndex((bud) => `bud:${bud.goalId}` === trace.region) : -1;
  const pose = POSTURE[still.posture];

  // ---- the world: her look, her banks as studio sculptures ----
  const kingDesign = nest.king.design;
  const [lookDraft, setLookDraft] = useState<{ base: KittyGlaze; stamp: KittyStampKind | null; part: QueenPaintablePart | "all" } | null>(null);
  const look = useMemo(() => queenLook(kingDesign), [kingDesign]);
  const paint = useMemo<KittyPaintV1>(() => lookDraft ? draftPaint(look.paint, lookDraft) : look.paint, [look, lookDraft]);
  // ---- her charms: the couple's, earned by acts, drafted here and kept as they go ----
  const worn = useMemo(() => queenWornCharms(kingDesign), [kingDesign]);
  const earnings = useMemo(() => queenCharmsEarned(household), [household]);
  const [charmDraft, setCharmDraft] = useState<QueenCharmV1[] | null>(null);
  const [selectedCharm, setSelectedCharm] = useState<string | null>(null);
  const committed = useRef<string | null>(null);
  const charms = charmDraft ?? worn;
  // The draft yields to the record once the record says the same thing.
  useEffect(() => { if (committed.current && JSON.stringify(worn) === committed.current) { committed.current = null; setCharmDraft(null); } }, [worn]);
  // ---- her form: thrown on the wheel, ringed by closed Chapters; her underside; the living light ----
  const keptForm = useMemo(() => queenForm(kingDesign, household), [kingDesign, household]);
  const [formDraft, setFormDraft] = useState<QueenFormHandles | null>(null);
  const form = useMemo<QueenForm>(() => (formDraft ? { handles: formDraft, rings: keptForm.rings } : keptForm), [formDraft, keptForm]);
  const wheel = useMemo(() => queenWheel(kingDesign), [kingDesign]);
  const portraits = useMemo(() => queenPortraits(kingDesign), [kingDesign]);
  const [tipped, setTipped] = useState(false);
  const marks = useMemo(() => {
    const makers = household.members.filter((row) => row.active).slice(0, 2);
    const initials = makers.map((row) => row.name.trim().charAt(0).toUpperCase() || "·");
    const worked = kingDesign?.updatedAt ?? kingDesign?.studio?.draft?.createdAt ?? null;
    return { initials, date: worked ? formatDateLabel(worked.slice(0, 10)) : "not yet worked", names: makers.map((row) => row.name) };
  }, [household.members, kingDesign]);
  const [hour, setHour] = useState(() => clock ?? localHour());
  useEffect(() => {
    if (clock !== undefined) { setHour(clock); return; }
    // The light follows the clock across hours: read again every quarter hour, never on a frame.
    const tick = setInterval(() => setHour(localHour()), 15 * 60_000);
    return () => clearInterval(tick);
  }, [clock]);
  const light = useMemo(() => queenLight(today, hour), [today, hour]);
  const worldQueen = useMemo<WorldQueenInput>(() => ({
    pose: queenPose(still),
    fill: body.level,
    axis: queenGlazeAxis(still.glaze),
    crown: crown.light === "both",
    seams: body.seams,
    vine: { chapter: Boolean(vine.chapter), growth: vine.growth, buds: buds.length },
    feet: feet.nearness,
    paint,
    charms,
    form,
    tipped,
    marks: { initials: marks.initials, date: marks.date },
    light,
  }), [still, body.level, body.seams, crown.light, vine.chapter, vine.growth, buds.length, feet.nearness, paint, charms, form, tipped, marks, light]);
  const bankPieces = useMemo(() => {
    const protectBank = nest.categories.find((bank) => bank.category === "protect")!;
    const buildBank = nest.categories.find((bank) => bank.category === "build")!;
    const rows = [
      { id: "protect", bank: protectBank, step: banks.protect.share },
      { id: "build", bank: buildBank, step: banks.build.share },
      ...shelf.filter((item) => item.goalId).slice(0, 3).map((item) => ({ id: `goal:${item.goalId}`, bank: item.bank, step: item.bank.targetCents > 0 ? Math.max(0, Math.min(10, Math.floor((item.bank.amountCents / item.bank.targetCents) * 10))) : 0 })),
    ];
    return rows.map((row) => { const piece = queenBankPiece(row.bank); return { id: row.id, piece, fired: queenBankFired(piece), glaze: queenBankGlaze(row.bank), step: row.step, name: row.bank.name }; });
  }, [nest, banks.protect.share, banks.build.share, shelf]);
  const worldBanks = useMemo<WorldBankInput[]>(() => bankPieces.map(({ id, piece, fired, step }) => ({ id, piece, fired, step })), [bankPieces]);
  const [worldLive, setWorldLive] = useState(false);
  const [worldModel, setWorldModel] = useState<"model" | "drawn">("drawn");
  const worldStats = useRef<(() => WorldStats) | null>(null);
  const worldPick = useRef<WorldPick | null>(null);
  const onWorldLive = useCallback((live: boolean, stats?: () => WorldStats, pick?: WorldPick) => {
    setWorldLive(live);
    worldStats.current = stats ?? null;
    worldPick.current = pick ?? null;
    // Evidence hook only: the proof page reads frame timings from here. Never present in a production bundle.
    if (import.meta.env.DEV && typeof window !== "undefined") (window as unknown as { __queenWorldStats?: (() => WorldStats) | null }).__queenWorldStats = stats ?? null;
  }, []);

  // ---- where you are: rest · expanded · a peek · a room ----
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState<Door | null>(null);
  const [scene, setScene] = useState<Scene>("home");
  // The place she is in: shared home resolves to exactly three scenes, and each
  // has a world. `paused` already carries reduced motion, a hidden tab, a field
  // being typed in and the atmosphere switch. A host that writes the scene
  // tokens without mounting the provider (the proof harness) is read from the
  // same datasets the provider itself writes — the same truth, not a second one.
  const appearance = useAppearance();
  const providerMounted = Boolean(appearance.store);
  const placeId = providerMounted ? appearance.scene.id : (typeof document !== "undefined" ? document.documentElement.dataset.scene ?? appearance.scene.id : appearance.scene.id);
  const atmospherePaused = providerMounted ? appearance.paused : (typeof document === "undefined" || document.documentElement.dataset.atmosphere !== "playing");
  const world3d = useMemo(() => queenSceneryKind(placeId), [placeId]);
  const worldPaper = useMemo(() => {
    if (providerMounted) return appearance.scene.palette.paper;
    if (typeof getComputedStyle !== "function" || typeof document === "undefined") return undefined;
    return getComputedStyle(document.documentElement).getPropertyValue("--paper").trim() || undefined;
  }, [providerMounted, appearance.scene.palette.paper, placeId]);
  const [revealed, setRevealed] = useState(false);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const queenRef = useRef<HTMLButtonElement>(null);
  const bankRefs = useRef<Record<QueenBankId, HTMLButtonElement | null>>({ protect: null, whatnow: null, build: null });
  const cellarStair = useRef<HTMLButtonElement>(null);
  const loftStair = useRef<HTMLButtonElement>(null);
  const pull = useRef<{ y: number } | null>(null);

  // Home does not scroll: the composition takes exactly the height left between the chrome above it and the chrome
  // under it. Both are measured, never reserved — the Stage 1 `--queen-under` constant stood in for the App's real
  // page and was wrong by about five times. In the App's world-home frame (`.app[data-world-home]`, fixed and
  // edge to edge) what survives under her is the fixed nav with its safe-area inset; whatever the App puts above
  // her (the two-space tabs, a transient books or sync banner) moves her top and is re-measured as it appears.
  useLayoutEffect(() => {
    const element = root.current;
    if (!element || typeof window === "undefined") return;
    const app = element.closest<HTMLElement>('.app[data-world-home="true"]');
    const nav = app?.querySelector<HTMLElement>("nav.nav") ?? null;
    const tabs = app?.querySelector<HTMLElement>(".view-switch") ?? null;
    const measure = () => {
      const top = Math.max(0, Math.round(element.getBoundingClientRect().top + window.scrollY));
      element.style.setProperty("--queen-top", `${top}px`);
      if (!app) { element.style.removeProperty("--queen-below"); delete element.dataset.frameNav; delete element.dataset.frameTabs; return; }
      const below = nav ? Math.ceil(nav.getBoundingClientRect().height) : 0;
      element.style.setProperty("--queen-below", `${below}px`);
      element.dataset.frameNav = String(below);
      element.dataset.frameTabs = String(tabs ? Math.ceil(tabs.getBoundingClientRect().height) : 0);
    };
    measure();
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    const sizes = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    for (const watched of [nav, tabs]) if (watched) sizes?.observe(watched);
    const shellNode = app?.querySelector<HTMLElement>(".app-shell") ?? null;
    const children = shellNode && typeof MutationObserver !== "undefined" ? new MutationObserver(measure) : null;
    // Subtree, because a transient banner (books validation, a sync notice) can grow inside a wrapper the shell already had; her top moves with it.
    if (shellNode) children?.observe(shellNode, { childList: true, subtree: true });
    return () => {
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      sizes?.disconnect();
      children?.disconnect();
    };
  }, [wide]);

  useEffect(() => () => { if (revealTimer.current) clearTimeout(revealTimer.current); }, []);

  // ---- the one write path for her look and her charms: the household King, through the guard ----
  const keepDesign = useCallback((next: { paint?: KittyPaintV1; base?: KittyGlaze; charms?: QueenCharmV1[]; handles?: QueenFormHandles; wheel?: QueenWheelV1; portrait?: QueenPortraitV1 }) => {
    return onCommand((current) => {
      const design = current.kittyNestDesigns?.find((row) => row.bankKey === "king" && row.visibility === "household");
      const draft = design?.studio?.draft;
      const sculpt = draft?.sculpt ?? defaultQueenSculpt();
      const kept = queenPortraits(design);
      return saveKittyNestDesign(current, guardQueenDesignSave({
        memberId, view: "household", bankKey: "king", expectedRevision: design?.revision ?? 0,
        name: design?.name ?? "Our Queen", glaze: next.base ?? design?.glaze ?? "terracotta", category: null,
        studio: {
          version: 1,
          draft: {
            id: draft?.id ?? "queen", createdAt: draft?.createdAt ?? new Date().toISOString(), firedAt: null,
            sculpt: next.handles ? { ...sculpt, profile: queenFormProfile(next.handles) } : sculpt,
            paint: next.paint ?? queenLook(design).paint, charms: next.charms ?? queenWornCharms(design),
            ...(next.wheel ?? draft?.wheel ? { wheel: next.wheel ?? draft?.wheel } : {}),
            ...(next.portrait || kept.length ? { portraits: [...kept, ...(next.portrait ? [next.portrait] : [])] } : {}),
          },
          fired: design?.studio?.fired ?? [],
          ...(design?.studio?.displayId ? { displayId: design.studio.displayId } : {}),
        },
      }, { earned: queenCharmKindsEarned(current), rings: queenRingCount(current), kept }));
    });
  }, [memberId, onCommand]);
  // A year that closed without a portrait is sealed the first time Home opens after it, once.
  const sealing = useRef<number | null>(null);
  useEffect(() => {
    const draft = kingDesign?.studio?.draft;
    if (!draft || busy) return;
    const due = queenPortraitDue({ createdAt: draft.createdAt, portraits }, today);
    if (due === null || sealing.current === due) return;
    sealing.current = due;
    void keepDesign({ portrait: queenPortraitOf({ year: due, at: new Date().toISOString(), by: memberId, profile: draft.sculpt?.profile, household, paint: look.paint, charms: worn }) });
  }, [kingDesign, portraits, today, busy, keepDesign, memberId, household, look.paint, worn]);
  const keepWheel = useCallback((handles: QueenFormHandles, kept: QueenWheelV1) => { setFormDraft(null); void keepDesign({ handles, wheel: kept }); }, [keepDesign]);
  // ---- tipping her over: a pull down on her, or ArrowDown on her; ArrowUp, Escape or a press rights her ----
  const tipPull = useRef<{ y: number; done: boolean } | null>(null);
  const onTipStart = useCallback((event: PointerEvent<HTMLButtonElement>) => { if (event.pointerType === "mouse" && event.button !== 0) return; tipPull.current = { y: event.clientY, done: false }; }, []);
  const onTipMove = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    const pull = tipPull.current;
    if (!pull || pull.done || !event.buttons) return;
    if (event.clientY - pull.y > PULL_THRESHOLD) { pull.done = true; setTipped(true); }
  }, []);
  const onTipEnd = useCallback(() => { const pull = tipPull.current; tipPull.current = null; return Boolean(pull?.done); }, []);
  /** Charms are held while she is being dressed and kept once: when the charm is put down, the tool closes, the page goes, or Done is pressed. */
  const heldCharms = useHeldSave<QueenCharmV1[]>((next) => { committed.current = JSON.stringify(next); return keepDesign({ charms: next }); });
  const draftCharms = useCallback((next: QueenCharmV1[]) => { setCharmDraft(next); heldCharms.hold(next); }, [heldCharms.hold]);
  const addCharm = useCallback((kind: QueenCharmKind) => {
    const seat = queenCharmFreeSeat(charms, form);
    const id = `ch-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
    const color = STUDIO_PALETTE[(charms.length * 7 + 5) % STUDIO_PALETTE.length]!.hex;
    draftCharms([...charms, { id, kind, ...seat, spin: 0, tilt: 0, scale: 1, color, by: memberId }]);
    setSelectedCharm(id);
  }, [charms, draftCharms, memberId, form]);
  const changeCharm = useCallback((charm: QueenCharmV1) => draftCharms(charms.map((row) => (row.id === charm.id ? charm : row))), [charms, draftCharms]);
  const removeCharm = useCallback((id: string) => { draftCharms(charms.filter((row) => row.id !== id)); setSelectedCharm((current) => (current === id ? null : current)); }, [charms, draftCharms]);
  const selected = charms.find((row) => row.id === selectedCharm) ?? null;
  // One send, when the work is put down: leaving the loft sends the rack; putting a charm down, closing her panel or leaving Home sends the charms.
  const flushRack = heldRack.flush, flushCharms = heldCharms.flush;
  useEffect(() => { if (scene !== "loft") flushRack(); }, [scene, flushRack]);
  useEffect(() => { if (!selectedCharm || !open || scene !== "home") flushCharms(); }, [selectedCharm, open, scene, flushCharms]);
  /** A press on her: the world's ray when it is live, the drawn figure's own geometry when it is not. The seat settles; a refused seat is not taken. */
  const pressCharm = useCallback((clientX: number, clientY: number, target: HTMLElement) => {
    if (!selected) return;
    let pick = worldPick.current?.(clientX, clientY) ?? null;
    if (!pick) {
      const rect = target.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      // Undo the figure's posture transform (rotate + scale about the hem) before reading the viewBox.
      const ox = 120, oy = 302, k = pose.scale || 1, a = (-pose.lean * Math.PI) / 180;
      const vx = ((clientX - rect.x) / rect.width) * 240 - ox, vy = ((clientY - rect.y) / rect.height) * 340 - oy;
      const ux = (vx * Math.cos(a) - vy * Math.sin(a)) / k, uy = (vx * Math.sin(a) + vy * Math.cos(a)) / k;
      pick = queenCharmFlatPick(ux + ox, uy + oy, form);
    }
    if (!pick) return;
    const settled = queenCharmSettle(pick.part, pick.u, pick.v, form);
    if (!settled) return;
    changeCharm({ ...selected, part: pick.part, ...settled });
  }, [selected, changeCharm, pose.scale, pose.lean, form]);
  const nextSeat = useCallback(() => {
    if (!selected) return;
    const others = charms.filter((row) => row.id !== selected.id);
    const at = QUEEN_CHARM_KEYBOARD_SEATS.findIndex((seat) => seat.part === selected.part && Math.abs(seat.u - selected.u) < 0.03 && Math.abs(seat.v - selected.v) < 0.03);
    const order = [...QUEEN_CHARM_KEYBOARD_SEATS.slice(at + 1), ...QUEEN_CHARM_KEYBOARD_SEATS.slice(0, at + 1)];
    const free = order.find((seat) => others.every((row) => !(row.part === seat.part && Math.abs(row.u - seat.u) < 0.03 && Math.abs(row.v - seat.v) < 0.03))) ?? queenCharmFreeSeat(others, form);
    const settled = queenCharmSettle(free.part, free.u, free.v, form);
    if (settled) changeCharm({ ...selected, part: free.part, ...settled });
  }, [selected, charms, changeCharm, form]);

  const reveal = useCallback(() => {
    setRevealed(true);
    if (revealTimer.current) clearTimeout(revealTimer.current);
    revealTimer.current = setTimeout(() => setRevealed(false), REVEAL_MS);
  }, []);

  const closePanel = useCallback(() => {
    setOpen((current) => {
      if (current === null) return current;
      const back = returnTo.current;
      returnTo.current = null;
      if (back) requestAnimationFrame(() => back.focus({ preventScroll: true }));
      return null;
    });
  }, []);

  const enterRoom = useCallback((room: Scene) => {
    returnTo.current = null;
    setOpen(null);
    setRevealed(false);
    setScene(room);
    requestAnimationFrame(() => (room === "cellar" ? cellarStair : loftStair).current?.focus({ preventScroll: true }));
  }, []);

  const exitRoom = useCallback(() => {
    const from = scene;
    setScene("home");
    setExpanded(true);
    const bank: QueenBankId = from === "cellar" ? "protect" : "build";
    requestAnimationFrame(() => bankRefs.current[bank]?.focus({ preventScroll: true }));
  }, [scene]);

  /**
   * One axis, one rule: **up goes up.** A swipe, a haul with the mouse or
   * ArrowUp climbs a floor; down descends. The rail does the same thing with a
   * button, so no floor is reachable only by gesture.
   */
  const travel = useCallback((to: Scene) => {
    setSelectedCharm(null);
    if (to === "home") { if (scene !== "home") exitRoom(); return; }
    if (to !== scene) enterRoom(to);
  }, [scene, exitRoom, enterRoom]);
  const moveFloor = useCallback((move: HouseMove) => {
    const next = houseStep(scene, move);
    if (next !== scene) travel(next);
  }, [scene, travel]);
  /** Across Home: her three banks, in the order the eye reads them. */
  const turnHome = useCallback((turn: -1 | 1) => {
    if (scene !== "home" || !expanded) return;
    const order: QueenBankId[] = ["protect", "whatnow", "build"];
    const at = order.findIndex((bank) => bankRefs.current[bank] === document.activeElement);
    const next = order[Math.max(0, Math.min(order.length - 1, (at < 0 ? (turn < 0 ? 1 : -1) : at) + turn))];
    if (next) bankRefs.current[next]?.focus({ preventScroll: true });
  }, [scene, expanded]);

  /** One gesture, two depths: the first tap opens the peek; the same door again from inside the peek goes in. */
  const openDoor = useCallback((door: Door, from: HTMLElement | null) => {
    setRevealed(false);
    if (open === door) {
      const room = ROOM_FOR[door];
      if (room) enterRoom(room); else closePanel();
      return;
    }
    returnTo.current = from;
    setOpen(door);
    requestAnimationFrame(() => closeRef.current?.focus({ preventScroll: true }));
  }, [open, enterRoom, closePanel]);

  // A tap anywhere off her panel — the rooms, the tabs, the nav — puts it away; her doors toggle it themselves.
  useOutsideClose([panelRef], open !== null, closePanel, { keep: ".queen-bank__button, [aria-controls], .queen-field" });

  const onFieldClick = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button, a, [role=dialog]")) return;
    if (selectedCharm) { setSelectedCharm(null); return; }
    if (open) { closePanel(); return; }
    reveal();
  };

  const toggleQueen = () => {
    if (open) closePanel();
    setExpanded((current) => !current);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (scene !== "home") { exitRoom(); return; }
      if (open) { closePanel(); return; }
      if (selectedCharm) { setSelectedCharm(null); return; }
      if (expanded) { setExpanded(false); queenRef.current?.focus({ preventScroll: true }); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [scene, open, expanded, exitRoom, closePanel, selectedCharm]);

  // The sheet: keep pulling past a threshold and you are in the room.
  const onPullStart = (event: PointerEvent<HTMLDivElement>) => {
    pull.current = { y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    panelRef.current?.classList.add("is-pulling");
  };
  const onPullMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!pull.current || !panelRef.current) return;
    const dy = Math.min(0, event.clientY - pull.current.y);
    panelRef.current.style.setProperty("--queen-pull", `${dy}px`);
  };
  const onPullEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (!pull.current) return;
    const dy = event.clientY - pull.current.y;
    pull.current = null;
    panelRef.current?.classList.remove("is-pulling");
    panelRef.current?.style.removeProperty("--queen-pull");
    const room = open ? ROOM_FOR[open] : undefined;
    if (dy < -PULL_THRESHOLD && room) enterRoom(room);
  };

  // ---- the Move: one act, from the Together peek ----
  const onMoveAct = () => {
    if (hands.kind !== "move") return;
    if (hands.act === "setup") { onOpenSetup(household.charter ? "fund" : "charter"); return; }
    if (hands.act === "waiting") { onGo("plan"); return; }
    if (hands.act === "acknowledge") { void onCommand((current) => respondToMove(current, { memberId, moveId: hands.move.id, response: "acknowledge" })); return; }
    void onCommand((current) => completeMove(current, { memberId, moveId: hands.move.id }));
  };
  const moveVerb = hands.kind !== "move" ? null : hands.act === "done" ? "Done" : hands.act === "acknowledge" ? "I acknowledge this" : hands.act === "setup" ? (household.charter ? "Set up the Fund" : "Create our Charter") : "Waiting on both of us";

  // ---- words for the still: pose is the data, so every channel has a sentence ----
  const glazeWords = still.glaze === "glazed" ? "Glazed: the evidence is fresh." : still.glaze === "offline" ? "Unglazed: this device is offline." : "Matte: the evidence is not certain yet, so she claims nothing.";
  const bodyWords = `${body.fullness === "empty" ? "Empty" : body.fullness === "low" ? "Low" : body.fullness === "half" ? "Half full" : body.fullness === "full" ? "Full" : "Holding"}; ${formatCad(body.amountCents)} in ${fundName}.`;
  const crownWords = crown.light === "both" ? "Crown lit: both of you are here." : crown.light === "waiting-me" ? "Crown unlit; something waits for you." : crown.light === "waiting-partner" ? "Crown unlit; something waits on your partner." : "Crown unlit; one of you is here.";
  const seamWords = body.seams === 0 ? "No gold seams this month." : `${body.seams} gold ${body.seams === 1 ? "seam" : "seams"}: ${body.seams === 1 ? "a correction" : "corrections"} mended and left visible.`;
  const vineWords = vine.chapter ? `The vine is ${vine.title}, week ${vine.week}, grown by ${vine.acts} ${vine.acts === 1 ? "act" : "acts"}.` : "No Chapter is open; the vine is short.";
  const budWords = buds.length === 0 ? "No buds: nothing is growing yet." : `${buds.length} ${buds.length === 1 ? "bud" : "buds"}: ${buds.map((bud) => bud.name).join(", ")}.`;
  const feetWords = feet.count === 0 ? "Nothing dated is at her feet." : `${feet.count} dated ${feet.count === 1 ? "obligation" : "obligations"} at her feet; the nearest is ${feet.nearness[0] === "near" ? "within the week" : feet.nearness[0] === "soon" ? "within two weeks" : "later this month"}.`;
  const handsWords = hands.kind === "move" ? `At her hands, one Move: ${sentence(hands.move.text)}.` : "Her hands are empty. Nothing needs doing.";
  const charmWords = charms.length === 0 ? "" : worldLive && worldModel === "model" ? ` ${charms.length} ${charms.length === 1 ? "charm is" : "charms are"} kept for her drawn figure; her sculpted figure wears none.` : ` She wears ${charms.length} ${charms.length === 1 ? "charm" : "charms"}: ${charms.map((charm) => `${queenCharmLabel(charm.kind).toLowerCase()} on ${queenCharmSeatWords(charm)}`).join(", ")}.`;
  const ringWords = form.rings === 0 ? " No growth rings yet: no Chapter has closed." : ` ${form.rings} growth ${form.rings === 1 ? "ring" : "rings"}: one for each closed Chapter, permanent.`;
  const formWords = wheel ? ` Thrown on the wheel: form pulled by ${household.members.find((row) => row.id === wheel.pull.by)?.name ?? "one of you"}, rim opened by ${household.members.find((row) => row.id === wheel.rim.by)?.name ?? "one of you"}.` : " Not yet thrown on the wheel.";
  const tipWords = tipped ? ` Tipped over: her underside shows the makers' marks ${marks.initials.join(" and ")} and the date she was last worked on, ${marks.date}.` : "";
  const lightWords = ` ${light.words}`;
  const sculpted = worldLive && worldModel === "model";
  const stillWords = `${sculpted ? queenModelStill(still) : worldLive ? queenWorldStill(still) : still.description} ${glazeWords} ${bodyWords} ${crownWords} ${seamWords} ${vineWords} ${budWords} ${feetWords} ${handsWords}${charmWords}${ringWords}${formWords}${tipWords}${lightWords}`;
  const bankWords = (id: QueenBankId) => banks[id].banks.map((bank) => `${NEST_CATEGORY_LABELS[bank.category!]} ${formatCad(bank.amountCents)}`).join(", ");
  const waiting = presence.filter((row) => row.waitingOn).length + (hands.kind === "move" ? 1 : 0);

  const mode = wide ? "panel" : "sheet";
  const inRoom = scene !== "home";
  // The whole house answers the hand: the field and both rooms sit inside this
  // root, so one grab carries wherever you are standing. A panel being open, a
  // charm being placed or her being tipped over all borrow the gesture, so the
  // house lets go while any of them is true. Under a paused atmosphere (which
  // already carries reduced motion) the stairs still work; the house just does
  // not slide under the hand.
  const house = useHouseAxis({
    place: scene,
    onMove: moveFloor,
    onTurn: turnHome,
    enabled: !open && !tipped && !selectedCharm,
    feedback: !atmospherePaused,
  });

  return (
    <div
      ref={root}
      className={`queen-home${wide ? " queen-home--wide" : " queen-home--phone"}${expanded ? " is-expanded" : ""}${open ? " is-open" : ""}${revealed ? " is-revealed" : ""}`}
      data-pulse={still.state}
      data-posture={still.posture}
      data-eyes={still.eyes}
      data-gaze={still.gaze}
      data-brow={still.brow}
      data-glaze={still.glaze}
      data-grave={still.grave ? "true" : "false"}
      data-crown={crown.light}
      data-hands={hands.kind}
      data-mode={mode}
      data-scene={scene}
      data-open={open ?? "none"}
      data-side={open ? PANEL_SIDE[open] : "right"}
      data-easy-read={easyRead ? "true" : "false"}
      data-world={worldLive ? "3d" : "flat"} data-queen-model={worldLive ? worldModel : undefined}
      data-charms={charms.length}
      data-charm-selected={selected ? "true" : "false"}
      data-rings={form.rings}
      data-thrown={wheel ? "true" : "false"}
      data-tipped={tipped ? "true" : "false"}
      data-portraits={portraits.length}
      data-hauling={house.hauling ? "true" : "false"}
      style={{ "--queen-scale": String(pose.scale), "--queen-lean": `${pose.lean}deg`, "--queen-light-level": String(light.level), "--queen-light-warmth": String(light.warmth), "--queen-haul": `${house.haul}px` } as CSSProperties}
      {...house.bind}
    >
      {identityArt ? <div className="queen-identity-art" aria-hidden="true">{identityArt}</div> : null}
      <h1 className="sr-only">{household.name} — Our Home</h1>

      <div className="queen-field" onClick={onFieldClick} inert={inRoom}>
        <QueenSceneryFlat kind={world3d} />
        <div className="queen-rings" aria-hidden="true" />
        <QueenWorld root={root} queen={worldQueen} banks={worldBanks} expanded={expanded} breathing={scene === "home" && !expanded && !open} scenery={world3d} sceneryPaper={worldPaper} ambient={!atmospherePaused} mode={world} onLive={onWorldLive} onModel={setWorldModel} />

        <button type="button" className="queen-door queen-door--together" aria-label={`Together — decisions waiting on both of you${waiting ? `: ${waiting} waiting` : ""}`}
          aria-expanded={open === "together"} aria-controls={panelId} onClick={(event) => openDoor("together", event.currentTarget)}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="7.5" cy="10" r="4.5" /><circle cx="12.5" cy="10" r="4.5" /></svg>
          <span className="queen-door__label">Together</span>
        </button>

        <div className="queen-centre">
          <div className="queen-banks">
            <div className="queen-bank queen-bank--protect" inert={!expanded}>
              <button ref={(node) => { bankRefs.current.protect = node; }} type="button" className="queen-bank__button" aria-expanded={open === "protect"} aria-controls={panelId}
                aria-label={`${QUEEN_BANK_LABELS.protect} — ${QUEEN_BANK_MEANINGS.protect} ${bankWords("protect")}. Opens a peek; again for the cellar`} onClick={(event) => openDoor("protect", event.currentTarget)}>{QUEEN_BANK_LABELS.protect}</button>
              <BankPortrait row={bankPieces[0]!} />
            </div>

            <div className="queen-bank queen-bank--queen">
              {expanded && (
                <button ref={(node) => { bankRefs.current.whatnow = node; }} type="button" className="queen-bank__button" aria-expanded={open === "whatnow"} aria-controls={panelId}
                  aria-label={`${QUEEN_BANK_LABELS.whatnow} — ${QUEEN_BANK_MEANINGS.whatnow} ${bankWords("whatnow")}. Opens a peek`} onClick={(event) => openDoor("whatnow", event.currentTarget)}>{QUEEN_BANK_LABELS.whatnow}</button>
              )}
              <div className="queen-mount">
                <button ref={queenRef} type="button" className="queen-figure" data-house-hold="down" aria-expanded={expanded} aria-describedby={`${ids}-still`}
                  aria-label={tipped ? `The Queen, tipped over — her underside: marks ${marks.initials.join(" and ")}, last worked ${marks.date}. Rights her` : `The Queen — ${line.word}. ${expanded ? "Closes her banks" : "Opens her into her banks"}. Pull her down or press ArrowDown to see her underside`}
                  onPointerDown={onTipStart} onPointerMove={onTipMove} onPointerUp={onTipEnd} onPointerCancel={onTipEnd}
                  onKeyDown={(event) => { if (event.key === "ArrowDown" && !tipped) { event.preventDefault(); setTipped(true); } else if ((event.key === "ArrowUp" || event.key === "Escape") && tipped) { event.preventDefault(); event.stopPropagation(); setTipped(false); } }}
                  onClick={() => { if (tipPull.current?.done) return; if (tipped) { setTipped(false); return; } toggleQueen(); }}>
                  <QueenFigure still={still} body={body} crown={crown.light} vine={vine} buds={buds.length} feet={feet} freshBud={freshBud >= 0 ? freshBud : null} charms={charms} form={form} tipped={tipped} marks={{ initials: marks.initials, date: marks.date }} />
                </button>
                {selected && (
                  <button type="button" className="queen-charm-target" aria-label={`Press to move ${queenCharmLabel(selected.kind).toLowerCase()} here; Enter moves it to the next free seat`}
                    onPointerDown={(event) => { event.preventDefault(); if (typeof event.currentTarget.setPointerCapture === "function") { try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* not a pointer */ } } pressCharm(event.clientX, event.clientY, event.currentTarget); }}
                    onPointerMove={(event) => { if (event.buttons) pressCharm(event.clientX, event.clientY, event.currentTarget); }}
                    onClick={(event) => { if (event.detail === 0) nextSeat(); }} />
                )}
                {hands.kind === "move" && (
                  <button type="button" className="queen-move" aria-label={`A Move is waiting: ${sentence(hands.move.text)}. ${hands.ownerLine}. Opens Together`}
                    aria-controls={panelId} aria-expanded={open === "together"} onClick={(event) => openDoor("together", event.currentTarget)}>
                    <svg viewBox="0 0 40 40" aria-hidden="true"><circle className="queen-move__glow" cx="20" cy="20" r="17" /><path className="queen-move__object" d="M20 9 l10 11 l-10 11 l-10 -11 Z" /></svg>
                  </button>
                )}
              </div>
              <p id={`${ids}-still`} className="sr-only">{stillWords}</p>
            </div>

            <div className="queen-bank queen-bank--build" inert={!expanded}>
              <button ref={(node) => { bankRefs.current.build = node; }} type="button" className="queen-bank__button" aria-expanded={open === "build"} aria-controls={panelId}
                aria-label={`Build — ${QUEEN_BANK_MEANINGS.build} ${bankWords("build")}${shelf.some((item) => item.goalId) ? `. Goals: ${shelf.filter((item) => item.goalId).map((item) => item.name).join(", ")}` : ""}. Opens a peek; again for the loft`} onClick={(event) => openDoor("build", event.currentTarget)}>Build</button>
              <BankPortrait row={bankPieces[1]!} />
              {expanded && bankPieces.length > 2 && (
                <span className="queen-goalrow" aria-hidden="true">{bankPieces.slice(2).map((row) => <BankPortrait key={row.id} row={row} small />)}</span>
              )}
            </div>
          </div>

          <p className="queen-line">
            <span className="queen-line__chapter">{line.chapter ?? fundName}</span>
            <span className="queen-line__dot" aria-hidden="true">·</span>
            <em className="queen-line__word">{line.word}</em>
          </p>
        </div>

        <button type="button" className="queen-door queen-door--status" aria-label={`Status — freshness, sources, settings.${shell?.sync.attentionLabel ? ` ${shell.sync.attentionLabel}.` : ""} ${glazeWords}`}
          data-attention={shell?.sync.attentionLabel ? "true" : undefined}
          aria-expanded={open === "status"} aria-controls={panelId} onClick={(event) => openDoor("status", event.currentTarget)}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.5" /><circle cx="10" cy="10" r="1.4" fill="currentColor" /></svg>
          <span className="queen-door__label">Status</span>
          {shell?.sync.attentionLabel ? <span className="queen-door__badge">{shell.sync.attentionLabel}</span> : null}
        </button>
      </div>

      <div className="queen-dim" onClick={closePanel} aria-hidden="true" />

      <aside ref={panelRef} id={panelId} className="queen-panel" role="dialog" aria-modal={mode === "sheet"} aria-labelledby={`${ids}-panel-title`} inert={!open}>
        <div className="queen-panel__handle" aria-hidden="true" onPointerDown={onPullStart} onPointerMove={onPullMove} onPointerUp={onPullEnd} onPointerCancel={onPullEnd} />
        <button ref={closeRef} type="button" className="queen-panel__close" aria-label="Close" onClick={closePanel}>×</button>
        {open === "together" && (
          <>
            <p className="queen-eyebrow">Together</p>
            <h2 id={`${ids}-panel-title`} className="queen-panel__title">Waiting on both of you</h2>
            <p className="queen-panel__sub">Decisions neither of you makes alone.</p>
            <p>{crown.light === "both" ? <><b>Both of you are here.</b> The crown is lit.</> : <><b>{crown.light === "unlit" ? "Quiet for now." : "One of you is here."}</b> The crown lights when you are both in the kitchen.</>}</p>
            {hands.kind === "move" && (
              <div className="queen-decision">
                <p><b>{hands.move.text}</b></p>
                <p className="queen-panel__muted">{hands.ownerLine}</p>
                <div className="queen-acts">
                  <button type="button" className="queen-act queen-act--primary" disabled={busy || hands.act === "waiting"} onClick={onMoveAct}>{moveVerb}</button>
                  <button type="button" className="queen-act" onClick={closePanel}>Not yet</button>
                </div>
              </div>
            )}
            {presence.length > 0 ? (
              <ul className="queen-rows">{presence.map((row) => <li key={row.id} className={row.waitingOn ? `queen-row is-waiting-${row.waitingOn}` : "queen-row"}>{row.text}</li>)}</ul>
            ) : hands.kind !== "move" ? <p className="queen-panel__muted">Nothing waiting on the two of you. Healthy is quiet.</p> : null}
            <button type="button" className="queen-go" onClick={() => onGo("together")}>Go to Together</button>
          </>
        )}
        {open === "status" && (
          <>
            <p className="queen-eyebrow">Status</p>
            <h2 id={`${ids}-panel-title`} className="queen-panel__title">{pulse.headline}</h2>
            <p className="queen-panel__sub">{pulse.detail}</p>
            {shell && (
              <section className={`queen-shell queen-shell--${shell.sync.tone}`} aria-labelledby={`${ids}-shell`} data-attention={shell.sync.attentionLabel ? "true" : "false"}>
                <p id={`${ids}-shell`} className="queen-eyebrow">This device</p>
                {shell.sync.attentionLabel && (
                  <div className="queen-shell__attention" role="status">
                    <p><b>{shell.sync.attentionLabel}.</b>{shell.sync.attentionDetail ? ` ${shell.sync.attentionDetail}` : ""}</p>
                    {shell.sync.actionLabel && shell.sync.onAction ? <button type="button" className="queen-act queen-act--primary" disabled={busy} onClick={shell.sync.onAction}>{shell.sync.actionLabel}</button> : null}
                  </div>
                )}
                <ul className="queen-rows queen-rows--key">
                  <li className="queen-row"><span>Who</span><span>{shell.member} · {shell.household}</span></li>
                  <li className="queen-row"><span>When</span><time dateTime={shell.timeIso}>{shell.time}</time></li>
                  <li className="queen-row"><span>Books</span><span>{shell.sync.visible ? shell.sync.transportPrimary : "Local books"}{shell.sync.revisionLine ? ` · ${shell.sync.revisionLine}` : ""}{shell.sync.updatedLine ? ` · ${shell.sync.updatedLine}` : ""}</span></li>
                  <li className="queen-row"><span>Env</span><span>{shell.environment === "production" ? "Production" : "Development"}{shell.onSwitchEnvironment ? <> · <button type="button" className="queen-link" disabled={busy} onClick={shell.onSwitchEnvironment}>Switch environment</button></> : null}</span></li>
                </ul>
                {shell.households}
                <div className="queen-acts">
                  <button type="button" className="queen-act" onClick={shell.sync.onOpenDetails}>Sync help</button>
                  {shell.onOpenOffice ? <button type="button" className="queen-act queen-shell__office" onClick={shell.onOpenOffice}>The office · instruments and boards</button> : null}
                </div>
              </section>
            )}
            <ul className="queen-rows queen-rows--key">
              <li className="queen-row"><span>Glaze</span><span>{glazeWords}</span></li>
              <li className="queen-row"><span>Seams</span><span>{seamWords}</span></li>
              <li className="queen-row"><span>Feet</span><span>{feetWords}</span></li>
            </ul>
            <section className="queen-look" aria-labelledby={`${ids}-look`}>
              <p id={`${ids}-look`} className="queen-eyebrow">Her look</p>
              <p className="queen-panel__muted">{kingDesign ? `Kept ${formatDateLabel(kingDesign.updatedAt.slice(0, 10))}. Both of you author her; a kept look is visible to both.` : "Not yet dressed. Both of you author her; a kept look is visible to both."} She is never fired: her surface follows the evidence, not a kiln.</p>
              <div className="queen-look__row" role="group" aria-label="Where the clay goes">
                {QUEEN_LOOK_PARTS.map((part) => (
                  <button key={part.id} type="button" className="queen-pick" aria-pressed={(lookDraft?.part ?? "all") === part.id}
                    onClick={() => setLookDraft({ base: lookDraft?.base ?? (look.base as KittyGlaze), stamp: lookDraft?.stamp ?? null, part: part.id })}>{part.label}</button>
                ))}
              </div>
              <div className="queen-look__row" role="group" aria-label="Her clay">
                {(Object.keys(KITTY_GLAZES) as KittyGlaze[]).map((glaze) => (
                  <button key={glaze} type="button" className="queen-swatch" style={{ "--swatch": KITTY_GLAZES[glaze] } as CSSProperties} aria-pressed={(lookDraft?.base ?? look.base) === glaze} aria-label={`Clay: ${glaze.replace("-", " ")}`}
                    onClick={() => setLookDraft({ base: glaze, stamp: lookDraft?.stamp ?? null, part: lookDraft?.part ?? "all" })} />
                ))}
              </div>
              <div className="queen-look__row" role="group" aria-label="A mark on her belly">
                {(["none", "heart", "star", "flower", "leaf", "moon", "sun"] as const).map((kind) => (
                  <button key={kind} type="button" className="queen-pick" aria-pressed={(lookDraft?.stamp ?? null) === (kind === "none" ? null : kind)}
                    onClick={() => setLookDraft({ base: lookDraft?.base ?? (look.base as KittyGlaze), stamp: kind === "none" ? null : kind, part: lookDraft?.part ?? "all" })}>{kind}</button>
                ))}
              </div>
              <div className="queen-acts">
                <button type="button" className="queen-act queen-act--primary" disabled={busy || !lookDraft} onClick={() => {
                  if (!lookDraft) return;
                  void keepDesign({ base: lookDraft.base, paint: draftPaint(look.paint, lookDraft) });
                  setLookDraft(null);
                }}>Keep her look</button>
                {lookDraft && <button type="button" className="queen-act" onClick={() => setLookDraft(null)}>Undo</button>}
              </div>
            </section>
            <QueenWheel memberId={memberId} members={household.members} handles={keptForm.handles} rings={keptForm.rings} wheel={wheel} busy={busy} onDraft={setFormDraft} onKeep={keepWheel} />
            <section className="queen-marks" aria-labelledby={`${ids}-marks`}>
              <p id={`${ids}-marks`} className="queen-eyebrow">Her underside</p>
              <p className="queen-panel__muted">The makers' marks — {marks.names.length ? marks.names.join(" and ") : "both of you"} — and the date she was last worked on, {marks.date}. Never painted; no charm sits there.{ringWords}</p>
              <div className="queen-acts"><button type="button" className="queen-act" aria-pressed={tipped} onClick={() => { setTipped((current) => !current); if (mode === "sheet") closePanel(); }}>{tipped ? "Right her" : "Tip her over"}</button></div>
            </section>
            <QueenWindow household={household} today={today} onWalk={() => onGo("plan")} />
            <QueenPortraits portraits={portraits} members={household.members} />
            <QueenCharmTool earnings={earnings} charms={charms} selectedId={selectedCharm} members={household.members} busy={busy} form={form}
              keptLine={heldCharms.dirty ? "Not saved yet — kept when you press Done or put her down." : worn.length ? `${worn.length} ${worn.length === 1 ? "charm" : "charms"} kept; each says who pressed it on.` : "Kept when you're done; each charm says who pressed it on."}
              dirty={heldCharms.dirty} onDone={() => { heldCharms.flush(); setSelectedCharm(null); }}
              onAdd={addCharm} onSelect={setSelectedCharm} onChange={changeCharm} onRemove={removeCharm} />
            <button type="button" className="queen-go" onClick={() => onGo("more")}>Open the Status Centre</button>
          </>
        )}
        {(open === "protect" || open === "build" || open === "whatnow") && (
          <>
            <p className="queen-eyebrow">{QUEEN_BANK_LABELS[open]}</p>
            <h2 id={`${ids}-panel-title`} className="queen-panel__title">{open === "protect" ? lowerTitle : open === "build" ? "What we chose" : QUEEN_BANK_LABELS.whatnow}</h2>
            <p className="queen-panel__sub">{QUEEN_BANK_MEANINGS[open]}</p>
            <ul className="queen-rows">
              {banks[open].banks.map((bank) => <li key={bank.id} className="queen-row"><span>{NEST_CATEGORY_LABELS[bank.category!]}</span><span className="queen-amount">{formatCad(bank.amountCents)}</span></li>)}
            </ul>
            {open === "protect" && (
              <ul className="queen-rows queen-rows--dated">
                {stones.map((stone) => <li key={stone.id} className="queen-row"><span>{stone.label}<small>{formatDayLabel(stone.date)}{stone.kind === "planned" ? " · planned, not posted" : ""}</small></span><span className="queen-amount">{formatCad(stone.amountCents)}</span></li>)}
                {stones.length === 0 && <li className="queen-row queen-panel__muted">Nothing dated is ahead this month.</li>}
              </ul>
            )}
            {open === "build" && (
              <ul className="queen-rows queen-rows--dated">
                {shelf.slice(0, 5).map((item) => <li key={item.id} className="queen-row"><span>{item.name}<small>{item.mouth === "open" ? "open-mouthed" : "lidded"}{item.date ? ` · ${formatDayLabel(item.date)}` : ""}</small></span><span className="queen-amount">{formatCad(item.bank.amountCents)}</span></li>)}
                {shelf.length === 0 && <li className="queen-row queen-panel__muted">Nothing chosen yet. A goal would grow a bud on her vine.</li>}
              </ul>
            )}
            {open === "whatnow" && <p>{pulse.detail}</p>}
            <div className="queen-acts">
              {ROOM_FOR[open] && (
                <button type="button" className="queen-go queen-go--primary" data-door={open} onClick={() => enterRoom(ROOM_FOR[open]!)}>
                  {open === "protect" ? lowerRoom : "Build · up to the loft"}
                </button>
              )}
              <button type="button" className="queen-go" onClick={() => onOpenBank({ bankId: open === "protect" ? lowerBankKey : `plan:${open === "whatnow" ? "everyday" : open}` })}>Open {QUEEN_BANK_LABELS[open]} in the banks</button>
              {open === "whatnow" && <button type="button" className="queen-go" onClick={() => onGo("ledger")}>Open {fundName}</button>}
            </div>
            {ROOM_FOR[open] && mode === "sheet" && <p className="queen-panel__hint">Keep pulling up to go {open === "protect" ? "down to the cellar" : "up to the loft"}.</p>}
          </>
        )}
      </aside>

      <QueenHouseRail place={scene} onGo={travel} />

      <QueenCellar ribbons={ribbons} open={scene === "cellar"} stairRef={cellarStair} onExit={exitRoom} onOpenBanks={() => onOpenBank({ bankId: lowerBankKey })} world={world} household={household} memberId={memberId} today={today} busy={busy} onCommand={onCommand} />
      <QueenLoft shelf={shelf} rack={rack} open={scene === "loft"} busy={busy} stairRef={loftStair} onExit={exitRoom} onOpenGoal={(goalId) => onOpenBank({ goalId })} onOpenBanks={() => onOpenBank({ bankId: "plan:build" })} onRack={keepRack} dirty={heldRack.dirty} onDone={heldRack.flush} pour={loftPour} world={world} />
    </div>
  );
}

/** A bank in the flat path: the studio's own 2D twin of the piece its owner authored. Fired reads fired. */
function BankPortrait({ row, small = false }: { row: { id: string; piece: import("../core/types.ts").KittyPieceV1; fired: boolean; glaze: string; step: number; name: string }; small?: boolean }) {
  return (
    <span className={`queen-bank-portrait${small ? " queen-bank-portrait--small" : ""}`} data-world-bank={row.id} data-fired={row.fired ? "true" : "false"} aria-hidden="true">
      <KittyFlat piece={row.piece} glaze={row.glaze} step={row.step} fired={row.fired} className="queen-bank-flat" />
    </span>
  );
}

/**
 * Her look as a draft: a clay dip on one of her six parts or on all of her,
 * and one mark on her belly. A dip on a part is exactly what the studio's own
 * part dip is, so what is kept here reads the same in the studio.
 */
function draftPaint(base: KittyPaintV1, draft: { base: KittyGlaze; stamp: KittyStampKind | null; part: QueenPaintablePart | "all" }): KittyPaintV1 {
  const stamps = base.stamps.filter((stamp) => stamp.id !== "queen-belly");
  if (draft.stamp) stamps.push({ id: "queen-belly", anchor: "belly", part: "body", u: 0.5, v: 0.62, kind: draft.stamp, color: "#2b2926", size: 0.22, rotation: 0 });
  // All of her: the dip becomes her clay and no part holds a colour of its own any more.
  if (draft.part === "all") return { ...base, base: draft.base, parts: {}, stamps };
  return { ...base, parts: { ...base.parts, [draft.part]: KITTY_GLAZES[draft.base] }, stamps };
}
/** Her six parts as the panel offers them, in the order a person meets them. */
const QUEEN_LOOK_PARTS: readonly { id: QueenPaintablePart | "all"; label: string }[] = [
  { id: "all", label: "All of her" },
  { id: "body", label: "Body" },
  { id: "head", label: "Head" },
  { id: "earL", label: "Left ear" },
  { id: "earR", label: "Right ear" },
  { id: "tail", label: "Tail" },
  { id: "paws", label: "Paws" },
];

/**
 * A window onto the island (Our Path, step 11): the island in miniature, its
 * name and how many shared months it holds, and a door that walks you there.
 * A link, not a merge: the flat map is decoration, the door is the control.
 */
function QueenWindow({ household, today, onWalk }: { household: Household; today: DateKey; onWalk: () => void }) {
  const id = useId();
  const months = useMemo(() => pathMonths(household, today).length, [household, today]);
  const name = pathIslandName(household) ?? "Where we are going";
  return (
    <section className="queen-window" aria-labelledby={`${id}-window`}>
      <p id={`${id}-window`} className="queen-eyebrow">The window</p>
      <div className="queen-window__pane">
        <PathMiniMap household={household} today={today} />
      </div>
      <p className="queen-window__caption">{name} · {months} {months === 1 ? "month" : "months"}</p>
      <div className="queen-acts"><button type="button" className="queen-act queen-window__door" onClick={onWalk}>Walk the island</button></div>
    </section>
  );
}

function defaultQueenSculpt() {
  // Her sculpt agrees with her model: pointed ears, a tail that wraps her base, long whiskers, eyes closed and serene.
  return { body: "round" as const, profile: [1, 1, 1, 1] as [number, number, number, number], head: "round" as const, ears: "pointed" as const, eyes: "closed" as const, mouth: "serene" as const, whiskers: "long" as const, tail: "wrap" as const, nose: "tiny" as const };
}

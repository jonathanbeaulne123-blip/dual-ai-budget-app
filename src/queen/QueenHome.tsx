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
  QUEEN_BANK_LABELS, QUEEN_BANK_MEANINGS,
  queenBanks, queenBody, queenBuds, queenCrown, queenFeet, queenHands, queenHem, queenLine, queenRibbons, queenSeams, queenShelf, queenStill, queenTrace, queenVine,
  type QueenBankId,
} from "../core/queenPresentation.ts";
import { useEasyRead } from "../useEasyRead.ts";
import { QueenFigure } from "./QueenFigure.tsx";
import { QueenWorld, type QueenWorldMode } from "./QueenWorld.tsx";
import { guardQueenDesignSave, queenBankFired, queenBankGlaze, queenBankPiece, queenGlazeAxis, queenLook, queenPose, queenWorldStill } from "./world/queenAuthoring.ts";
import type { WorldBankInput, WorldQueenInput, WorldStats } from "./world/queenWorld.ts";
import { KittyFlat } from "../kitty/studio/flat.tsx";
import { saveKittyNestDesign } from "../core/kittyNestDesigns.ts";
import { KITTY_GLAZES } from "../core/goalEnvelopes.ts";
import { formatDateLabel } from "../core/calendar.ts";
import type { KittyGlaze, KittyPaintV1, KittyStampKind } from "../core/types.ts";
import { QueenCellar } from "./QueenCellar.tsx";
import { QueenLoft } from "./QueenLoft.tsx";
import "./queen-home.css";

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
};

/** Doors: the two field doors carry everything that is not money; the three bank doors are the money hierarchy. */
type Door = "together" | "status" | QueenBankId;
type Scene = "home" | "cellar" | "loft";
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
export function QueenHome({ household, memberId, today, freshness, busy, onCommand, onGo, onOpenSetup, onOpenBank, identityArt, world = "auto" }: QueenHomeProps) {
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
  const shelf = useMemo(() => queenShelf(nest, household), [nest, household]);
  const freshBud = trace && trace.region.startsWith("bud:") ? buds.findIndex((bud) => `bud:${bud.goalId}` === trace.region) : -1;
  const pose = POSTURE[still.posture];

  // ---- the world: her look, her banks as studio sculptures ----
  const kingDesign = nest.king.design;
  const [lookDraft, setLookDraft] = useState<{ base: KittyGlaze; stamp: KittyStampKind | null } | null>(null);
  const look = useMemo(() => queenLook(kingDesign), [kingDesign]);
  const paint = useMemo<KittyPaintV1>(() => lookDraft ? draftPaint(look.paint, lookDraft) : look.paint, [look, lookDraft]);
  const worldQueen = useMemo<WorldQueenInput>(() => ({
    pose: queenPose(still),
    fill: body.level,
    axis: queenGlazeAxis(still.glaze),
    crown: crown.light === "both",
    seams: body.seams,
    vine: { chapter: Boolean(vine.chapter), growth: vine.growth, buds: buds.length },
    feet: feet.nearness,
    paint,
  }), [still, body.level, body.seams, crown.light, vine.chapter, vine.growth, buds.length, feet.nearness, paint]);
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
  const worldStats = useRef<(() => WorldStats) | null>(null);
  const onWorldLive = useCallback((live: boolean, stats?: () => WorldStats) => {
    setWorldLive(live);
    worldStats.current = stats ?? null;
    // Evidence hook only: the proof page reads frame timings from here. Never present in a production bundle.
    if (import.meta.env.DEV && typeof window !== "undefined") (window as unknown as { __queenWorldStats?: (() => WorldStats) | null }).__queenWorldStats = stats ?? null;
  }, []);

  // ---- where you are: rest · expanded · a peek · a room ----
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState<Door | null>(null);
  const [scene, setScene] = useState<Scene>("home");
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

  // Home does not scroll: the composition takes exactly the height left under the chrome above it.
  useLayoutEffect(() => {
    const element = root.current;
    if (!element || typeof window === "undefined") return;
    const measure = () => {
      const top = Math.max(0, Math.round(element.getBoundingClientRect().top + window.scrollY));
      element.style.setProperty("--queen-top", `${top}px`);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [wide]);

  useEffect(() => () => { if (revealTimer.current) clearTimeout(revealTimer.current); }, []);

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

  const onFieldClick = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button, a, [role=dialog]")) return;
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
      if (expanded) { setExpanded(false); queenRef.current?.focus({ preventScroll: true }); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [scene, open, expanded, exitRoom, closePanel]);

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
  const stillWords = `${worldLive ? queenWorldStill(still) : still.description} ${glazeWords} ${bodyWords} ${crownWords} ${seamWords} ${vineWords} ${budWords} ${feetWords} ${handsWords}`;
  const bankWords = (id: QueenBankId) => banks[id].banks.map((bank) => `${NEST_CATEGORY_LABELS[bank.category!]} ${formatCad(bank.amountCents)}`).join(", ");
  const waiting = presence.filter((row) => row.waitingOn).length + (hands.kind === "move" ? 1 : 0);

  const mode = wide ? "panel" : "sheet";
  const inRoom = scene !== "home";

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
      data-world={worldLive ? "3d" : "flat"}
      style={{ "--queen-scale": String(pose.scale), "--queen-lean": `${pose.lean}deg` } as CSSProperties}
    >
      {identityArt ? <div className="queen-identity-art" aria-hidden="true">{identityArt}</div> : null}
      <h1 className="sr-only">{household.name} — Our Home</h1>

      <div className="queen-field" onClick={onFieldClick} inert={inRoom}>
        <div className="queen-rings" aria-hidden="true" />
        <QueenWorld root={root} queen={worldQueen} banks={worldBanks} expanded={expanded} breathing={scene === "home" && !expanded && !open} mode={world} onLive={onWorldLive} />

        <button type="button" className="queen-door queen-door--together" aria-label={`Together — decisions waiting on both of you${waiting ? `: ${waiting} waiting` : ""}`}
          aria-expanded={open === "together"} aria-controls={panelId} onClick={(event) => openDoor("together", event.currentTarget)}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="7.5" cy="10" r="4.5" /><circle cx="12.5" cy="10" r="4.5" /></svg>
          <span className="queen-door__label">Together</span>
        </button>

        <div className="queen-centre">
          <div className="queen-banks">
            <div className="queen-bank queen-bank--protect" inert={!expanded}>
              <button ref={(node) => { bankRefs.current.protect = node; }} type="button" className="queen-bank__button" aria-expanded={open === "protect"} aria-controls={panelId}
                aria-label={`Protect — ${QUEEN_BANK_MEANINGS.protect} ${bankWords("protect")}. Opens a peek; again for the cellar`} onClick={(event) => openDoor("protect", event.currentTarget)}>Protect</button>
              <BankPortrait row={bankPieces[0]!} />
            </div>

            <div className="queen-bank queen-bank--queen">
              {expanded && (
                <button ref={(node) => { bankRefs.current.whatnow = node; }} type="button" className="queen-bank__button" aria-expanded={open === "whatnow"} aria-controls={panelId}
                  aria-label={`What now — ${QUEEN_BANK_MEANINGS.whatnow} ${bankWords("whatnow")}. Opens a peek`} onClick={(event) => openDoor("whatnow", event.currentTarget)}>What now</button>
              )}
              <div className="queen-mount">
                <button ref={queenRef} type="button" className="queen-figure" aria-expanded={expanded} aria-describedby={`${ids}-still`}
                  aria-label={`The Queen — ${line.word}. ${expanded ? "Closes her banks" : "Opens her into her banks"}`} onClick={toggleQueen}>
                  <QueenFigure still={still} body={body} crown={crown.light} vine={vine} buds={buds.length} feet={feet} freshBud={freshBud >= 0 ? freshBud : null} />
                </button>
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

        <button type="button" className="queen-door queen-door--status" aria-label={`Status — freshness, sources, settings. ${glazeWords}`}
          aria-expanded={open === "status"} aria-controls={panelId} onClick={(event) => openDoor("status", event.currentTarget)}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.5" /><circle cx="10" cy="10" r="1.4" fill="currentColor" /></svg>
          <span className="queen-door__label">Status</span>
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
            <ul className="queen-rows queen-rows--key">
              <li className="queen-row"><span>Glaze</span><span>{glazeWords}</span></li>
              <li className="queen-row"><span>Seams</span><span>{seamWords}</span></li>
              <li className="queen-row"><span>Feet</span><span>{feetWords}</span></li>
            </ul>
            <section className="queen-look" aria-labelledby={`${ids}-look`}>
              <p id={`${ids}-look`} className="queen-eyebrow">Her look</p>
              <p className="queen-panel__muted">{kingDesign ? `Kept ${formatDateLabel(kingDesign.updatedAt.slice(0, 10))}. Both of you author her; a kept look is visible to both.` : "Not yet dressed. Both of you author her; a kept look is visible to both."} She is never fired: her surface follows the evidence, not a kiln.</p>
              <div className="queen-look__row" role="group" aria-label="Her clay">
                {(Object.keys(KITTY_GLAZES) as KittyGlaze[]).map((glaze) => (
                  <button key={glaze} type="button" className="queen-swatch" style={{ "--swatch": KITTY_GLAZES[glaze] } as CSSProperties} aria-pressed={(lookDraft?.base ?? look.base) === glaze} aria-label={`Clay: ${glaze.replace("-", " ")}`}
                    onClick={() => setLookDraft({ base: glaze, stamp: lookDraft?.stamp ?? null })} />
                ))}
              </div>
              <div className="queen-look__row" role="group" aria-label="A mark on her belly">
                {(["none", "heart", "star", "flower", "leaf", "moon", "sun"] as const).map((kind) => (
                  <button key={kind} type="button" className="queen-pick" aria-pressed={(lookDraft?.stamp ?? null) === (kind === "none" ? null : kind)}
                    onClick={() => setLookDraft({ base: lookDraft?.base ?? (look.base as KittyGlaze), stamp: kind === "none" ? null : kind })}>{kind}</button>
                ))}
              </div>
              <div className="queen-acts">
                <button type="button" className="queen-act queen-act--primary" disabled={busy || !lookDraft} onClick={() => {
                  if (!lookDraft) return;
                  const draft = lookDraft;
                  void onCommand((current) => saveKittyNestDesign(current, guardQueenDesignSave({
                    memberId, view: "household", bankKey: "king", expectedRevision: current.kittyNestDesigns?.find((row) => row.id === kingDesign?.id)?.revision ?? kingDesign?.revision ?? 0,
                    name: kingDesign?.name ?? "Our Queen", glaze: draft.base, category: null,
                    studio: { version: 1, draft: { id: kingDesign?.studio?.draft?.id ?? "queen", createdAt: kingDesign?.studio?.draft?.createdAt ?? new Date().toISOString(), firedAt: null, sculpt: kingDesign?.studio?.draft?.sculpt ?? defaultQueenSculpt(), paint: draftPaint(look.paint, draft) }, fired: kingDesign?.studio?.fired ?? [], ...(kingDesign?.studio?.displayId ? { displayId: kingDesign.studio.displayId } : {}) },
                  })));
                  setLookDraft(null);
                }}>Keep her look</button>
                {lookDraft && <button type="button" className="queen-act" onClick={() => setLookDraft(null)}>Undo</button>}
              </div>
            </section>
            <button type="button" className="queen-go" onClick={() => onGo("more")}>Open the Status Centre</button>
          </>
        )}
        {(open === "protect" || open === "build" || open === "whatnow") && (
          <>
            <p className="queen-eyebrow">{QUEEN_BANK_LABELS[open]}</p>
            <h2 id={`${ids}-panel-title`} className="queen-panel__title">{open === "protect" ? "What arrives" : open === "build" ? "What we chose" : "What now"}</h2>
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
                  {open === "protect" ? "Protect · down to the cellar" : "Build · up to the loft"}
                </button>
              )}
              <button type="button" className="queen-go" onClick={() => onOpenBank({ bankId: `plan:${open === "whatnow" ? "everyday" : open}` })}>Open {QUEEN_BANK_LABELS[open]} in the banks</button>
              {open === "whatnow" && <button type="button" className="queen-go" onClick={() => onGo("ledger")}>Open {fundName}</button>}
            </div>
            {ROOM_FOR[open] && mode === "sheet" && <p className="queen-panel__hint">Keep pulling up to go {open === "protect" ? "down to the cellar" : "up to the loft"}.</p>}
          </>
        )}
      </aside>

      <QueenCellar ribbons={ribbons} open={scene === "cellar"} stairRef={cellarStair} onExit={exitRoom} onOpenBanks={() => onOpenBank({ bankId: "plan:protect" })} />
      <QueenLoft shelf={shelf} open={scene === "loft"} stairRef={loftStair} onExit={exitRoom} onOpenGoal={(goalId) => onOpenBank({ goalId })} onOpenBanks={() => onOpenBank({ bankId: "plan:build" })} />
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

function draftPaint(base: KittyPaintV1, draft: { base: KittyGlaze; stamp: KittyStampKind | null }): KittyPaintV1 {
  const stamps = base.stamps.filter((stamp) => stamp.id !== "queen-belly");
  if (draft.stamp) stamps.push({ id: "queen-belly", anchor: "belly", part: "body", u: 0.5, v: 0.62, kind: draft.stamp, color: "#2b2926", size: 0.22, rotation: 0 });
  return { ...base, base: draft.base, stamps };
}

function defaultQueenSculpt() {
  return { body: "round" as const, profile: [1, 1, 1, 1] as [number, number, number, number], head: "round" as const, ears: "none" as const, eyes: "closed" as const, mouth: "serene" as const, whiskers: "none" as const, tail: "none" as const, nose: "tiny" as const };
}

import { useId, useLayoutEffect, useMemo, useRef, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import type { CommitResult, Household } from "../core/types.ts";
import { formatDayLabel, monthKeyFromDateKey, type DateKey } from "../core/calendar.ts";
import { formatCad } from "../core/money.ts";
import { monthObligations } from "../core/monthObligations.ts";
import { duePotentialExpenses, potentialExpensesForView } from "../core/potentialExpenses.ts";
import { deriveFundPulseInput, fundPulse, presenceLines, type FundPulseFreshness } from "../core/fundPulse.ts";
import { completeMove, keepWinAsMemory, nextMove, openChapterFor, recentWin, respondToMove } from "../core/chapters.ts";
import { projectKittyNest, NEST_CATEGORY_LABELS } from "../core/kittyNest.ts";
import { fundDisplayName } from "../core/spaceNames.ts";
import {
  queenBloom, queenBody, queenBuds, queenCrown, queenHands, queenHem, queenLimits, queenNestDoors, queenSeams, queenStill, queenTrace, queenVine,
  type QueenRegionId, type QueenStill,
} from "../core/queenPresentation.ts";
import { useEasyRead } from "../useEasyRead.ts";
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
  /** Opens the existing nest gallery at a goal or a category bank. */
  onOpenBank: (request: { goalId?: string; bankId?: string }) => void;
  identityArt?: ReactNode;
};

/** The figure's drawing space. Overlay controls are placed in the same coordinates so they never drift from the art. */
const VIEW_W = 240;
const VIEW_H = 330;

/** Posture is the pose: a static scale and lean per state. The drawing and its overlay controls share these numbers. */
const POSTURE: Record<QueenStill["posture"], { scale: number; lean: number }> = {
  upright: { scale: 1, lean: 0 },
  "leaning-in": { scale: 0.97, lean: -1.5 },
  attentive: { scale: 0.98, lean: 0 },
  tilted: { scale: 0.88, lean: 3 },
  depleted: { scale: 0.8, lean: 2 },
  matte: { scale: 0.94, lean: 0 },
};

/** Place a control over a drawn region, following the body's scale about her feet so the control never drifts from the art. */
function place(x: number, y: number, w: number, h: number, scale = 1): CSSProperties {
  const left = VIEW_W / 2 + (x - VIEW_W / 2) * scale;
  const top = VIEW_H + (y - VIEW_H) * scale;
  return { left: `${(left / VIEW_W) * 100}%`, top: `${(top / VIEW_H) * 100}%`, width: `${((w * scale) / VIEW_W) * 100}%`, height: `${((h * scale) / VIEW_H) * 100}%` };
}

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

/** The pupils turn toward the region that needs the household. Offsets in drawing units. */
const GAZE: Record<QueenRegionId | "rest", { dx: number; dy: number }> = {
  rest: { dx: 0, dy: 0 },
  crown: { dx: 0, dy: -3 },
  vine: { dx: -2, dy: -3 },
  face: { dx: 0, dy: 0 },
  hands: { dx: 0, dy: 3 },
  body: { dx: 0, dy: 3.5 },
  belly: { dx: 0, dy: 3.5 },
  hem: { dx: 0, dy: 4 },
};

const MOUTH: Record<QueenStill["mouth"], string> = {
  serene: "M111 132 q9 6 18 0",
  level: "M111 133 q9 2 18 0",
  set: "M111 135 q9 -3 18 0",
};

/**
 * The Queen's Nest, Stage 1: Household Home as one body.
 *
 * Crown · vine and buds · face · hands · body and belly · hem. Every region is
 * a real control that leads to an existing destination; the pose is the data
 * and motion is garnish. Amounts are confirmation inside accessible names and
 * small labels, never the opening line. She shows; Hercules says (not here).
 */
export function QueenHome({ household, memberId, today, freshness, busy, onCommand, onGo, onOpenSetup, onOpenBank, identityArt }: QueenHomeProps) {
  const wide = useSyncExternalStore(subscribeWide, readWide, () => false);
  const [easyRead] = useEasyRead(`${household.environment}:${household.householdId}:${memberId}`);
  const limits = queenLimits(wide);
  const monthKey = monthKeyFromDateKey(today);
  const chapter = openChapterFor(household);
  const move = nextMove(household, memberId);
  const pulse = fundPulse(deriveFundPulseInput(household, { memberId, today, freshness, activeChapter: Boolean(chapter) }));
  const still = queenStill(pulse, freshness);
  const crown = queenCrown(presenceLines(household, { memberId, today }), limits.presence);
  const nest = useMemo(() => projectKittyNest(household, memberId, "household", today), [household, memberId, today]);
  const doors = queenNestDoors(nest);
  const buds = queenBuds(nest, limits.buds);
  const vine = queenVine(household, chapter, today);
  const hands = queenHands(household, memberId, chapter, move);
  const body = queenBody(nest, freshness, queenSeams(household, today));
  const trace = queenTrace(household, memberId, today);
  const stones = queenHem(
    monthObligations(household, monthKey, today).rows,
    duePotentialExpenses(potentialExpensesForView(household.potentialExpenses, memberId, "household"), today),
    today,
    limits.stones,
  );
  const activeMemberIds = household.members.filter((row) => row.active).map((row) => row.id);
  const bloom = queenBloom(recentWin(household), memberId, activeMemberIds);
  const fundName = fundDisplayName(household);
  const destinationTab = pulse.destination === "fund" ? "ledger" : pulse.destination === "path" ? "plan" : pulse.destination === "together" ? "together" : "more";
  const ids = useId();
  const root = useRef<HTMLDivElement>(null);
  const figure = useRef<HTMLDivElement>(null);

  // Home does not scroll: the composition takes the height left under the chrome above it.
  useLayoutEffect(() => {
    const element = root.current;
    if (!element || typeof window === "undefined") return;
    const measure = () => {
      const top = Math.max(0, Math.round(element.getBoundingClientRect().top + window.scrollY));
      element.style.setProperty("--queen-top", `${top}px`);
    };
    measure();
    window.addEventListener("resize", measure);
    // The office holds the Move in her hands: the pill follows the drawn figure's height.
    const drawn = figure.current;
    const observer = drawn && typeof ResizeObserver === "function"
      ? new ResizeObserver((entries) => { for (const entry of entries) element.style.setProperty("--queen-figure-h", `${Math.round(entry.contentRect.height)}px`); })
      : null;
    if (drawn) observer?.observe(drawn);
    return () => { window.removeEventListener("resize", measure); observer?.disconnect(); };
  }, [wide]);

  const gaze = GAZE[still.eyes === "open" ? still.gaze : "rest"];
  const pose = POSTURE[still.posture];
  const at = (x: number, y: number, w: number, h: number) => place(x, y, w, h, pose.scale);
  const fillTop = 302 - (body.level / 10) * 118;
  const vineScale = vine.chapter ? 0.72 + vine.growth * 0.09 : 0.55;
  const leaves = vine.chapter ? 1 + vine.growth : 0;
  const bodyName = `${body.fullness === "empty" ? "Empty" : body.fullness === "low" ? "Low" : body.fullness === "half" ? "Half full" : body.fullness === "full" ? "Full" : "Holding"}; ${body.glaze === "glazed" ? "fresh glaze" : body.glaze === "offline" ? "offline, unglazed" : "matte, evidence not current"}${body.seams ? `; ${body.seams} mended ${body.seams === 1 ? "correction" : "corrections"} left visible` : ""}`;
  const protectBanks = doors.protect.map((bank) => `${NEST_CATEGORY_LABELS[bank.category!]} ${formatCad(bank.amountCents)}`).join(", ");
  const buildBanks = doors.build.map((bank) => `${NEST_CATEGORY_LABELS[bank.category!]} ${formatCad(bank.amountCents)}`).join(", ");
  const bellyBanks = doors.belly.map((bank) => `${NEST_CATEGORY_LABELS[bank.category!]} ${formatCad(bank.amountCents)}`).join(", ");

  const onHands = () => {
    if (hands.kind !== "move") { onGo("plan"); return; }
    const request = hands;
    if (request.act === "setup") { onOpenSetup(household.charter ? "fund" : "charter"); return; }
    if (request.act === "waiting") { onGo("plan"); return; }
    if (request.act === "acknowledge") { void onCommand((current) => respondToMove(current, { memberId, moveId: request.move.id, response: "acknowledge" })); return; }
    void onCommand((current) => completeMove(current, { memberId, moveId: request.move.id }));
  };
  const handsVerb = hands.kind !== "move" ? null : hands.act === "done" ? "Done" : hands.act === "acknowledge" ? "I acknowledge this" : hands.act === "setup" ? (household.charter ? "Set up the Fund" : "Create our Charter") : "Waiting on both of us";

  return (
    <div
      ref={root}
      className={`queen-home${wide ? " queen-home--wide" : " queen-home--phone"}`}
      data-pulse={still.state}
      data-posture={still.posture}
      data-eyes={still.eyes}
      data-gaze={still.gaze}
      data-brow={still.brow}
      data-glaze={body.glaze}
      data-grave={still.grave ? "true" : "false"}
      data-crown={crown.light}
      data-hands={hands.kind}
      data-easy-read={easyRead ? "true" : "false"}
      style={{ "--queen-scale": String(pose.scale), "--queen-lean": `${pose.lean}deg` } as CSSProperties}
    >
      <header className="queen-identity">
        {identityArt}
        <p className="kicker">Our Home</p>
        <h1>{household.name}</h1>
      </header>

      {wide && (
        <aside className="queen-aside queen-aside--left" aria-label="Who is here and this Chapter">
          <p className="kicker">Who is here</p>
          {crown.lines.length > 0 ? (
            <ul className="queen-presence">{crown.lines.map((line) => <li key={line.id} className={line.waitingOn ? `is-waiting-${line.waitingOn}` : ""}>{line.text}</li>)}</ul>
          ) : <p className="muted">Quiet for now.</p>}
          <p className="kicker">This Chapter</p>
          {vine.chapter ? <p><strong>{vine.title}</strong><br /><span className="muted">week {vine.week} · grown by {vine.acts} {vine.acts === 1 ? "act" : "acts"}</span></p> : <p className="muted">No Chapter is open. Open one from Our Path.</p>}
        </aside>
      )}

      <div className="queen-stage">
        <ul className="queen-buds" aria-label="What is growing">
          {bloom && (
            <li>
              <button
                type="button"
                className={`queen-bloom${bloom.complete ? " is-kept" : ""}`}
                disabled={busy || bloom.complete || bloom.keptByMe}
                aria-label={`${bloom.label} — ${bloom.win.title}. ${bloom.complete ? "Kept as a Memory." : bloom.keptByMe ? "Kept by you. Shared when your partner agrees." : "Keep as a Memory."}`}
                onClick={() => void onCommand((current) => keepWinAsMemory(current, { memberId, winId: bloom.win.id }))}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="queen-bloom__flower"><circle cx="12" cy="12" r="3.2" /><circle cx="12" cy="5" r="3.4" /><circle cx="18.1" cy="8.5" r="3.4" /><circle cx="18.1" cy="15.5" r="3.4" /><circle cx="12" cy="19" r="3.4" /><circle cx="5.9" cy="15.5" r="3.4" /><circle cx="5.9" cy="8.5" r="3.4" /></svg>
                <span className="queen-bud__name">{bloom.win.title}</span>
              </button>
            </li>
          )}
          {buds.map((bud) => {
            const fresh = trace?.region === `bud:${bud.goalId}`;
            return (
              <li key={bud.id}>
                <button
                  type="button"
                  className={`queen-bud queen-bud--${bud.size}${fresh ? " is-fresh" : ""}`}
                  data-bank-id={bud.bank.id}
                  aria-label={`${bud.name} — growing. Opens this goal. ${formatCad(bud.bank.amountCents)} set aside${fresh && trace ? `. ${trace.who} touched this recently` : ""}`}
                  onClick={() => onOpenBank({ goalId: bud.goalId })}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="queen-bud__dot"><circle cx="12" cy="12" r="9" />{fresh && <circle className="queen-trace" cx="9" cy="9" r="2.6" />}</svg>
                  <span className="queen-bud__name">{bud.name}</span>
                </button>
              </li>
            );
          })}
          {buds.length === 0 && !bloom && <li className="queen-buds__empty muted">Nothing is growing yet.</li>}
        </ul>

        <div className="queen-figure" ref={figure} data-trace={trace?.region ?? "none"}>
          <svg className="queen-svg" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} aria-hidden="true" focusable="false">
            <defs>
              <clipPath id={`${ids}-vessel`}>
                <path d="M34 302 C24 250 40 196 76 180 C92 172 148 172 164 180 C200 196 216 250 206 302 Z" />
              </clipPath>
            </defs>
            <ellipse className="queen-foot" cx="120" cy="306" rx="96" ry="12" />
            <g className="queen-body">
              {/* Body */}
              <path className="queen-vessel" d="M34 302 C24 250 40 196 76 180 C92 172 148 172 164 180 C200 196 216 250 206 302 Z" />
              <rect className="queen-fill" clipPath={`url(#${ids}-vessel)`} x="34" y={fillTop} width="172" height={302 - fillTop} />
              <path className="queen-shade" d="M156 180 C194 198 212 252 206 302 L180 302 C187 252 176 202 150 184 Z" />
              <path className="queen-glaze" d="M56 290 C46 246 60 204 86 188 C64 210 56 252 62 290 Z" />
              {body.seams >= 1 && <path className="queen-seam" d="M74 302 L88 248 L76 214 L90 186" />}
              {body.seams >= 2 && <path className="queen-seam" d="M176 298 L164 254 L174 226" />}
              {body.seams >= 3 && <path className="queen-seam" d="M120 300 L126 268 L116 246" />}
              {trace?.region === "body" && <ellipse className="queen-trace" cx="150" cy="236" rx="7" ry="4" />}
              {/* Shoulders */}
              <path className="queen-vessel" d="M80 182 C80 146 96 126 120 126 C144 126 160 146 160 182 Z" />
              {/* Hands */}
              <path className="queen-vessel queen-hands-shape" d="M88 214 C88 198 104 190 120 190 C136 190 152 198 152 214 C140 222 100 222 88 214 Z" />
              {hands.kind === "move" && <><circle className="queen-move-glow" cx="120" cy="196" r="17" /><path className="queen-move-object" d="M120 182 l9 10 l-9 10 l-9 -10 Z" /></>}
              {/* Face */}
              <ellipse className="queen-vessel" cx="120" cy="112" rx="40" ry="39" />
              <path className="queen-shade" d="M142 84 C158 94 162 124 150 142 C162 120 158 94 142 84 Z" />
              <path className="queen-brow" d="M98 100 q9 -5 18 -1" />
              <path className="queen-brow" d="M124 99 q9 -4 18 1" />
              {still.eyes === "open" ? (
                <>
                  <circle className="queen-pupil" cx={106 + gaze.dx} cy={114 + gaze.dy} r="3.6" />
                  <circle className="queen-pupil" cx={134 + gaze.dx} cy={114 + gaze.dy} r="3.6" />
                  <ellipse className="queen-eye-open" cx="106" cy="114" rx="8" ry="5.5" />
                  <ellipse className="queen-eye-open" cx="134" cy="114" rx="8" ry="5.5" />
                </>
              ) : (
                <>
                  <path className="queen-eye" d="M98 114 q8 6 16 0" />
                  <path className="queen-eye" d="M126 114 q8 6 16 0" />
                </>
              )}
              <path className="queen-mouth" d={MOUTH[still.mouth]} />
              {/* Crown */}
              <path className="queen-crown" d="M90 78 L97 60 L109 72 L120 52 L131 72 L143 60 L150 78" />
              {crown.light === "both" && <><circle className="queen-crown-point" cx="97" cy="60" r="2.4" /><circle className="queen-crown-point" cx="120" cy="52" r="2.8" /><circle className="queen-crown-point" cx="143" cy="60" r="2.4" /></>}
              {crown.light === "waiting-me" && <path className="queen-crown-mark" d="M120 46 l5 6 l-5 6 l-5 -6 Z" />}
              {/* Vine */}
              <g className="queen-vine" style={{ transform: `scale(${vineScale})` }}>
                <path className="queen-stem" d="M120 72 C120 46 104 30 84 20" />
                <path className="queen-stem" d="M120 72 C124 44 142 30 162 22" />
                {leaves >= 1 && <ellipse className="queen-leaf" cx="104" cy="50" rx="9" ry="4.4" transform="rotate(-20 104 50)" />}
                {leaves >= 2 && <ellipse className="queen-leaf" cx="94" cy="34" rx="11" ry="5.4" transform="rotate(-36 94 34)" />}
                {leaves >= 3 && <ellipse className="queen-leaf" cx="148" cy="36" rx="11" ry="5.4" transform="rotate(34 148 36)" />}
                {leaves >= 4 && <ellipse className="queen-leaf" cx="136" cy="52" rx="8" ry="4" transform="rotate(30 136 52)" />}
                {leaves >= 5 && <ellipse className="queen-leaf" cx="158" cy="24" rx="7" ry="3.6" transform="rotate(20 158 24)" />}
              </g>
            </g>
            {trace?.region === "hem" && <ellipse className="queen-trace" cx="160" cy="304" rx="8" ry="3.5" />}
          </svg>

          {/* Regions — real controls placed in the drawing's own coordinates, in reading order: who is here · what is growing · how we are · what to do · what is held · the doors. Stacking is explicit in CSS. */}
          <button type="button" className="queen-region queen-region--crown" style={at(84, 44, 72, 34)} aria-label={`Crown — ${crown.light === "both" ? "both of you are here" : crown.light === "waiting-me" ? "something is waiting for you" : crown.light === "waiting-partner" ? "something is waiting on your partner" : "quiet"}${crown.lines.length ? `. ${crown.lines.map((line) => line.text).join(" ")}` : ""}. Opens Together`} onClick={() => onGo("together")} />
          <button type="button" className="queen-region queen-region--vine" style={at(70, 8, 100, 46)} aria-label={vine.chapter ? `Vine — ${vine.title}, week ${vine.week}, grown by ${vine.acts} ${vine.acts === 1 ? "act" : "acts"}. Opens Our Path` : "Vine — no Chapter is open. Opens Our Path"} onClick={() => onGo("plan")} />
          <button type="button" className="queen-region queen-region--face" style={at(78, 70, 84, 84)} aria-label={`Face — ${pulse.headline}`} aria-describedby={`${ids}-still`} onClick={() => onGo(destinationTab)} />
          <button type="button" className="queen-region queen-region--hands" style={at(82, 176, 76, 50)} aria-label={hands.kind === "move" ? `Hands — the next Move: ${hands.move.text}. ${hands.ownerLine}. Opens Our Path` : "Hands — empty. Nothing needs doing. Opens Our Path"} onClick={() => onGo("plan")} />
          <button type="button" className="queen-region queen-region--body" style={at(34, 176, 172, 60)} aria-label={`Body — what is held. ${bodyName}. ${formatCad(body.amountCents)} in ${fundName}. Opens ${fundName}`} onClick={() => onGo("ledger")} />
          <button type="button" className="queen-region queen-region--belly" style={at(82, 232, 76, 70)} data-bank-id="plan:everyday" aria-label={`Belly — What Now: day-to-day choices. ${bellyBanks}. Opens the Everyday bank`} onClick={() => onOpenBank({ bankId: "plan:everyday" })}>
            <span className="queen-door__label" aria-hidden="true">What now</span>
          </button>
          <button type="button" className="queen-region queen-region--door queen-region--protect" style={at(30, 232, 52, 72)} data-bank-id="plan:protect" aria-label={`Protect — the future we did not choose: bills, breathing room and costs coming around. ${protectBanks}. Opens the Protect bank`} onClick={() => onOpenBank({ bankId: "plan:protect" })}>
            <span className="queen-door__label" aria-hidden="true">Protect</span>
          </button>
          <button type="button" className="queen-region queen-region--door queen-region--build" style={at(158, 232, 52, 72)} data-bank-id="plan:build" aria-label={`Build — the future we chose. ${buildBanks}. Opens the Build bank`} onClick={() => onOpenBank({ bankId: "plan:build" })}>
            <span className="queen-door__label" aria-hidden="true">Build</span>
          </button>
          <p id={`${ids}-still`} className="sr-only">{still.description} {pulse.detail}</p>
        </div>

        {hands.kind === "move" ? (
          <p className="queen-held" data-act={hands.act}>
            <button type="button" className="queen-move" disabled={busy || hands.act === "waiting"} aria-label={`${handsVerb} — ${hands.move.text}. ${hands.ownerLine}`} onClick={onHands}>
              <span className="queen-move__text">{hands.move.text}</span>
              <span className="queen-move__verb">{handsVerb}</span>
            </button>
          </p>
        ) : null}

        <div className="queen-floor">
        <p className="queen-caption" aria-hidden="true"><span className="queen-caption__glyph">{pulse.glyph}</span> {pulse.headline}</p>

        <ul className="queen-hem" aria-label="Hem — what is coming">
          {stones.map((stone) => (
            <li key={stone.id}>
              <button
                type="button"
                className={`queen-stone queen-stone--${stone.size}${stone.kind === "planned" ? " is-planned" : ""}`}
                aria-label={`${stone.label}, ${formatDayLabel(stone.date)}${stone.kind === "planned" ? ", planned, not posted" : ""}. ${formatCad(stone.amountCents)}. Opens the Calendar`}
                onClick={() => onGo("calendar")}
              >
                <svg viewBox="0 0 28 20" aria-hidden="true" className="queen-stone__shape"><ellipse cx="14" cy="11" rx="12" ry="8" /></svg>
                <span className="queen-stone__label"><span className="queen-stone__name">{stone.label}</span><span className="queen-stone__date">{formatDayLabel(stone.date)}</span>{wide && <span className="queen-stone__amount">{formatCad(stone.amountCents)}</span>}</span>
              </button>
            </li>
          ))}
          {stones.length === 0 && <li className="queen-hem__empty"><button type="button" className="queen-stone queen-stone--later is-empty" aria-label="Nothing dated is near her feet. Opens the Calendar" onClick={() => onGo("calendar")}><span className="queen-stone__label"><span className="queen-stone__name muted">Nothing dated is near</span></span></button></li>}
        </ul>
        </div>
      </div>

      {wide && (
        <aside className="queen-aside queen-aside--right" aria-label="What is held">
          <p className="kicker">{fundName}</p>
          <p className="queen-aside__still">{still.description}</p>
          <dl className="queen-doors-list">
            <div><dt>Protect</dt><dd>{doors.protect.map((bank) => <span key={bank.id}>{NEST_CATEGORY_LABELS[bank.category!]} <b>{formatCad(bank.amountCents)}</b></span>)}</dd></div>
            <div><dt>What now</dt><dd>{doors.belly.map((bank) => <span key={bank.id}>{NEST_CATEGORY_LABELS[bank.category!]} <b>{formatCad(bank.amountCents)}</b></span>)}</dd></div>
            <div><dt>Build</dt><dd>{doors.build.map((bank) => <span key={bank.id}>{NEST_CATEGORY_LABELS[bank.category!]} <b>{formatCad(bank.amountCents)}</b></span>)}</dd></div>
          </dl>
        </aside>
      )}
    </div>
  );
}

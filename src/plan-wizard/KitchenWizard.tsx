import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  currentPlanVersion, formatCad, lockPersonalPlan, parseWholeCents, proposeHouseholdPlan, savePlanDraft,
  type CommitResult, type DateKey, type Household, type LedgerView, type PlanLine,
} from "../core/index.ts";
import { FUND_LABELS } from "../core/fundRules.ts";
import { Whisper } from "../theme/Whisper.tsx";
import { Linkage } from "./Linkage.tsx";
import {
  POT_CHOICES, WIZARD_STEPS, abandonCard, cardReading, currentStep, emptyWizardState, jarReading, laidLines,
  layLine, pinKindFor, pinReason, protectHint, stepBack, suggestPot, wizardBase, wizardCadence, wizardComplete, wizardDraftInput, wizardMonth,
  type WizardAnswers, type WizardLineKey, type WizardState,
} from "./wizard.ts";
import "./kitchen-wizard.css";

/**
 * The Kitchen's front door (K2) — "One pull raises it".
 *
 * Five questions, one at a time, Hercules asking across the table. Each answer
 * writes one line of the recipe card **in component state only** and fits one
 * cut-paper rank to the linkage. The pull raises the whole card and writes
 * nothing. Two deliberate acts follow, each one of the app's own commands:
 *
 *   1. *Write it on the card* → `savePlanDraft` — private to you, no money moves.
 *   2. *Pin it to the wall*   → `proposeHouseholdPlan` (Shared) or
 *                               `lockPersonalPlan` (Personal).
 *
 * Nothing on this screen says a card was written, kept or pinned until the
 * command that would do it has come back accepted. A refusal says so and keeps
 * every answer. "Not now" puts the card in the drawer, never the bin.
 */

export type KitchenWizardProps = {
  household: Household;
  view: LedgerView;
  memberId: string;
  today: DateKey;
  busy: boolean;
  onCommand: (fn: (current: Household) => CommitResult) => Promise<unknown>;
  /** The drawer under the table: today's Plan Studio and its seven tools. */
  onOpenDrawer?: () => void;
};

type Outcome = { ok: boolean; message: string };

const uuid = (): string =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `PLAN-LINE-${Math.random().toString(36).slice(2)}-${Date.now()}`;

function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const shortDate = (date: DateKey): string => new Date(`${date}T12:00:00`).toLocaleDateString("en-CA", { month: "long", day: "numeric" });

export default function KitchenWizard({ household, view, memberId, today, busy, onCommand, onOpenDrawer }: KitchenWizardProps) {
  const [phase, setPhase] = useState<"table" | "asking">("table");
  const [state, setState] = useState<WizardState>(emptyWizardState);
  const [pull, setPull] = useState(0.62);
  const [lineId, setLineId] = useState(uuid);
  const [saving, setSaving] = useState(false);
  const [written, setWritten] = useState<Outcome | null>(null);
  const [pinned, setPinned] = useState<Outcome | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [error, setError] = useState("");
  const reduce = useMemo(prefersReducedMotion, []);
  const frame = useRef(0);

  const month = wizardMonth(today);
  const me = household.members.find((row) => row.id === memberId);
  const partner = household.members.find((row) => row.id !== memberId && row.active !== false);
  const names = { mine: me?.name ?? "You", partner: partner?.name ?? "Your partner" };
  const complete = wizardComplete(state);
  const fitted = laidLines(state);
  const step = currentStep(state);
  const locked = busy || saving;
  const base = useMemo(() => wizardBase(household, { memberId, view, today }), [household, memberId, view, today]);
  const wall = useMemo(() => currentPlanVersion(household, view, month, memberId)?.lines ?? [], [household, view, month, memberId]);

  useEffect(() => () => { if (frame.current) cancelAnimationFrame(frame.current); }, []);

  /** The pull, tweened — or, with reduced motion, cut straight to the end. */
  const raise = useCallback((to: number, ms = 1200) => {
    if (frame.current) cancelAnimationFrame(frame.current);
    if (reduce) { setPull(to); return; }
    const from = pull, start = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      const eased = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      setPull(from + (to - from) * eased);
      if (k < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, [pull, reduce]);

  const run = useCallback(async (command: (current: Household) => CommitResult): Promise<Outcome> => {
    setSaving(true); setError("");
    try {
      const result = await onCommand(command) as { ok?: boolean; userMessage?: string; household?: Household } | null;
      if (!result || result.ok === false || !result.household) {
        const message = result?.userMessage || "That was refused. Nothing was written; every answer is still here.";
        setError(message);
        return { ok: false, message };
      }
      return { ok: true, message: "" };
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "That was refused. Nothing was written; every answer is still here.";
      setError(message);
      return { ok: false, message };
    } finally { setSaving(false); }
  }, [onCommand]);

  const fresh = () => {
    setState(emptyWizardState()); setPhase("asking"); setPull(0); setLineId(uuid());
    setWritten(null); setPinned(null); setDrawer(false); setError("");
  };

  const lay = <K extends keyof WizardAnswers>(key: K, value: NonNullable<WizardAnswers[K]>) => {
    const next = layLine(state, key as never, value as never);
    if (next === state) return;
    setState(next);
    // A small test-pull once a rank is fitted: the first frame shows the mechanism working.
    if (!reduce) { setPull(0.30 + 0.09 * laidLines(next).length); window.setTimeout(() => setPull(0), 420); }
  };

  const writeIt = async () => {
    const outcome = await run((current) => savePlanDraft(current, wizardDraftInput(current, { memberId, view, today }, state.answers, lineId)));
    setWritten(outcome);
  };

  const pinIt = async () => {
    const reason = pinReason(state.answers, view);
    const outcome = await run((current) => {
      const draft = wizardBase(current, { memberId, view, today }).draft;
      if (!draft) throw new Error("That private draft is no longer here. Write the card again before pinning it.");
      return pinKindFor(view) === "propose"
        ? proposeHouseholdPlan(current, { memberId, draftId: draft.id, reason, createdBy: memberId })
        : lockPersonalPlan(current, { memberId, draftId: draft.id, reason, createdBy: memberId });
    });
    setPinned(outcome);
  };

  const abandoned = abandonCard(state);

  // ── the front of the room ────────────────────────────────────────────────
  if (phase === "table") {
    const last = wall[wall.length - 1] ?? null;
    return (
      <main className={`kw kw--${view}`} aria-label="The kitchen table">
        <CookbookWall lines={wall} month={month} />
        <TableStage last={last} pull={pull} onPull={setPull} names={names} reduce={reduce} />
        <div className="kw-below">
          <Hercules
            stepno={wall.length ? "On the table" : "A clear table"}
            ask={last ? "That’s a card you already wrote. Pull the tab and watch it stand up." : "Nothing is on the wall yet. Shall we write the first card?"}
            why="Five questions, one card. Each answer lays one line and fits one rank; at the end one pull raises the whole plan."
          />
          <div className="kw-acts">
            <button type="button" className="kw-btn kw-btn--lamp" onClick={fresh}>Lay a fresh card flat</button>
            {onOpenDrawer && <button type="button" className="kw-btn kw-btn--ghost" onClick={onOpenDrawer}>Open the drawer — the seven tools</button>}
          </div>
          <Whisper mode="line" id="kw.table">Writing a card changes nothing on its own. Money only moves when you post it in the books.</Whisper>
        </div>
      </main>
    );
  }

  // ── the five questions, then the pull ────────────────────────────────────
  const lines = cardReading(state.answers);
  return (
    <main className={`kw kw--${view}`} aria-label="Five questions, one card">
      <CookbookWall lines={wall} month={month} pinned={pinned?.ok ? state.answers : null} />
      <Linkage answers={state.answers} fitted={fitted} pull={pull} onPull={(next) => { if (frame.current) cancelAnimationFrame(frame.current); setPull(next); }}
        locked={!complete} reduceMotion={reduce} names={names} />

      <div className="kw-below">
        <div className="kw-column">
          <Hercules
            stepno={step ? `Question ${state.index + 1} of 5 · rank ${state.index + 1}` : "All five ranks fitted"}
            ask={step ? step.ask : "Now pull it."}
            why={step ? step.why : "One bar, five rods. The front rank rises first and the back one last, because each rod has a little more slack than the one in front of it."}
          />

          {step ? (
            <Slip key={step.key} step={step} answers={state.answers} view={view} names={names} today={today} onLay={lay} />
          ) : (
            <Finale
              view={view} names={names} month={month} answers={state.answers} base={base} pull={pull}
              saving={saving} locked={locked} written={written} pinned={pinned} drawer={drawer} abandoned={abandoned}
              onRaise={() => raise(1, reduce ? 0 : 1400)} onWrite={writeIt} onPin={pinIt} onDrawer={() => setDrawer(true)} />
          )}

          {error && <p className="kw-error" role="alert">{error}<button type="button" className="kw-btn kw-btn--ghost" onClick={() => setError("")}>Dismiss</button></p>}

          <div className="kw-acts kw-acts--quiet">
            {state.index > 0 && !!step && <button type="button" className="kw-btn kw-btn--ghost" onClick={() => setState(stepBack)}>Back one question</button>}
            <button type="button" className="kw-btn kw-btn--ghost" onClick={fresh}>Lay a fresh card flat</button>
            {onOpenDrawer && <button type="button" className="kw-btn kw-btn--ghost" onClick={onOpenDrawer}>Open the drawer — the seven tools</button>}
          </div>
        </div>

        <ReadingCopy lines={lines} asking={step?.key ?? null} month={month} />
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------

function CookbookWall({ lines, month, pinned }: { lines: readonly PlanLine[]; month: string; pinned?: WizardAnswers | null }) {
  return (
    <section className="kw-wall" aria-label="The cookbook wall">
      <p className="kw-wall-kicker">The cookbook wall · {month}</p>
      <ul>
        {lines.length === 0 && !pinned && <li className="kw-wall-empty">Nothing pinned here yet.</li>}
        {lines.slice(-8).map((line) => (
          <li key={line.id} className="kw-pinned" data-fund={line.lens}>
            <b>{line.labelSnapshot}</b><span>{formatCad(line.decision?.targetCents ?? line.amountCents)}</span><span>{FUND_LABELS[line.lens]}</span>
          </li>
        ))}
        {pinned && (
          <li className="kw-pinned is-fresh" data-fund={pinned.pot?.fund}>
            <b>{pinned.what?.text}</b><span>{pinned.much?.text}</span><span>{pinned.when?.text}</span>
          </li>
        )}
      </ul>
    </section>
  );
}

/** The front still frame: a card already written, shown on the mechanism. */
function TableStage({ last, pull, onPull, names, reduce }: { last: PlanLine | null; pull: number; onPull: (next: number) => void; names: { mine: string; partner: string }; reduce: boolean }) {
  const answers: WizardAnswers = last
    ? {
        what: { text: last.labelSnapshot },
        much: { text: formatCad(last.decision?.targetCents ?? last.amountCents), cents: last.decision?.targetCents ?? last.amountCents },
        when: { text: last.decision?.deadline ?? last.dueDate ? shortDate((last.decision?.deadline ?? last.dueDate) as DateKey) : "Not fixed yet", date: (last.decision?.deadline ?? last.dueDate ?? null) as DateKey | null },
        pot: { text: FUND_LABELS[last.lens], fund: last.lens, suggested: false },
        who: { text: last.responsibility?.kind === "joint" ? "Both of us" : "Just me", choice: last.responsibility?.kind === "joint" ? "both" : "mine" },
      }
    : {};
  const fitted: WizardLineKey[] = last ? ["what", "much", "when", "pot", "who"] : [];
  return <Linkage answers={answers} fitted={fitted} pull={last ? pull : 0} onPull={onPull} locked={!last} reduceMotion={reduce} names={names} />;
}

const Hercules = (() => {
  function HerculesSay({ stepno, ask, why }: { stepno: string; ask: string; why: string }) {
    return (
      <div className="kw-across">
        <svg className="kw-herc" viewBox="0 0 220 152" aria-hidden="true">
          <path d="M18 152 Q22 106 62 96 L158 96 Q198 106 202 152 Z" className="kw-cat-lo" />
          <path d="M30 152 Q34 112 68 103 L152 103 Q186 112 190 152 Z" className="kw-cat" />
          <path d="M62 50 L50 8 L92 30 Z" className="kw-cat" /><path d="M158 50 L170 8 L128 30 Z" className="kw-cat" />
          <ellipse cx="110" cy="64" rx="57" ry="47" className="kw-cat" />
          <ellipse cx="110" cy="84" rx="28" ry="17" className="kw-cat-hi" opacity=".5" />
          <ellipse cx="89" cy="60" rx="10" ry="12" className="kw-cat-eye" /><ellipse cx="131" cy="60" rx="10" ry="12" className="kw-cat-eye" />
          <path d="M104 77 L116 77 L110 84 Z" className="kw-cat-nose" />
        </svg>
        <div className="kw-say">
          <span className="kw-stepno">{stepno}</span>
          <q className="kw-ask">{ask}</q>
          <p className="kw-why">{why}</p>
        </div>
      </div>
    );
  }
  return HerculesSay;
})();

function ReadingCopy({ lines, asking, month }: { lines: { key: string; label: string; value: string }[]; asking: string | null; month: string }) {
  return (
    <section className="kw-leafcard" aria-label="The card, as it reads">
      <div className="kw-copy">
        <p className="kw-copyhead"><span>Reading copy</span><span>{month}</span></p>
        <ol className="kw-lines">
          {lines.map((line, index) => (
            <li key={line.key} className="kw-line" data-line={line.key} data-state={line.value ? "done" : asking === line.key ? "asking" : "waiting"}>
              <span className="kw-n">{index + 1}</span>
              <span className="kw-lbl">{line.label}</span>
              <span className="kw-val">{line.value}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// The question slips. Each one lays exactly one line.

type LayFn = <K extends keyof WizardAnswers>(key: K, value: NonNullable<WizardAnswers[K]>) => void;

function Slip({ step, answers, view, names, today, onLay }: {
  step: (typeof WIZARD_STEPS)[number]; answers: WizardAnswers; view: LedgerView; names: { mine: string; partner: string }; today: DateKey; onLay: LayFn;
}) {
  return (
    <section className="kw-slip" aria-label={step.ask}>
      <span className="kw-slip-lbl">{step.slip}</span>
      {step.key === "what" && <WhatSlip onLay={onLay} initial={answers.what?.text ?? ""} />}
      {step.key === "much" && <MuchSlip onLay={onLay} initial={answers.much?.cents ?? null} />}
      {step.key === "when" && <WhenSlip onLay={onLay} today={today} initial={answers.when ?? null} />}
      {step.key === "pot" && <PotSlip onLay={onLay} what={answers.what?.text ?? ""} initial={answers.pot?.fund ?? null} />}
      {step.key === "who" && <WhoSlip onLay={onLay} view={view} names={names} />}
    </section>
  );
}

function WhatSlip({ onLay, initial }: { onLay: LayFn; initial: string }) {
  const [text, setText] = useState(initial);
  const fit = (value: string) => { const name = value.trim(); if (name) onLay("what", { text: name }); };
  return (
    <>
      <div className="kw-chits">
        {["Car insurance", "Christmas", "The dentist"].map((word, index) => (
          <button key={word} type="button" className="kw-chit" style={{ "--kw-tilt-chit": `${[-1.3, 0.9, -0.5][index]}deg` } as CSSProperties} onClick={() => fit(word)}>{word}</button>
        ))}
      </div>
      <div className="kw-field">
        <label className="kw-grow" htmlFor="kw-what">or write your own
          <input id="kw-what" className="kw-penfield" type="text" maxLength={60} value={text} placeholder="…"
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); fit(text); } }} />
        </label>
        <button type="button" className="kw-btn" disabled={!text.trim()} onClick={() => fit(text)}>Fit it</button>
      </div>
    </>
  );
}

function MuchSlip({ onLay, initial }: { onLay: LayFn; initial: number | null }) {
  const [text, setText] = useState(initial === null ? "" : String(Math.round(initial / 100)));
  const [problem, setProblem] = useState("");
  const parsed = (() => { try { return text.trim() ? parseWholeCents(text, "Amount", { allowZero: true }) : null; } catch { return null; } })();
  const jar = jarReading(parsed ?? 0);
  const fit = (cents: number) => {
    if (!Number.isSafeInteger(cents) || cents < 0) { setProblem("Write a whole CAD amount, like 820."); return; }
    onLay("much", { text: formatCad(cents) + (cents > 0 && jarReading(cents).over ? " · over the jar" : ""), cents });
  };
  return (
    <>
      <div className="kw-chits">
        {[60000, 82000, 100000, 240000].map((cents, index) => (
          <button key={cents} type="button" className="kw-chit" style={{ "--kw-tilt-chit": `${[-1.2, 0.8, -0.4, 1.1][index]}deg` } as CSSProperties} onClick={() => fit(cents)}>{formatCad(cents)}</button>
        ))}
      </div>
      <div className="kw-field">
        <label className="kw-grow" htmlFor="kw-much">or fill the jar by hand (CAD)
          <input id="kw-much" className="kw-penfield" inputMode="decimal" value={text} placeholder="820"
            onChange={(event) => { setText(event.target.value); setProblem(""); }}
            onKeyDown={(event) => { if (event.key === "Enter" && parsed !== null) { event.preventDefault(); fit(parsed); } }} />
        </label>
        <button type="button" className="kw-btn" disabled={parsed === null} onClick={() => parsed !== null && fit(parsed)}>Fit it</button>
      </div>
      <p className="kw-note" role="status">
        {parsed === null ? `Every coin is ${formatCad(5000)}; the jar holds ${formatCad(200000)}.` : jar.over
          ? `${formatCad(jar.spilledCents)} will not fit in the jar. Those coins sit on the lid — the card still says the whole ${formatCad(parsed)}.`
          : `${jar.coins} coin${jar.coins === 1 ? "" : "s"} in the jar.`}
      </p>
      {problem && <p className="kw-error" role="alert">{problem}</p>}
    </>
  );
}

function WhenSlip({ onLay, today, initial }: { onLay: LayFn; today: DateKey; initial: WizardAnswers["when"] | null }) {
  const [date, setDate] = useState<string>(initial?.date ?? today);
  return (
    <>
      <div className="kw-chits">
        <button type="button" className="kw-chit" style={{ "--kw-tilt-chit": "-0.5deg" } as CSSProperties}
          onClick={() => onLay("when", { text: "Not fixed yet", date: null })}>Not fixed yet</button>
      </div>
      <div className="kw-field">
        <label className="kw-grow" htmlFor="kw-when">or pick a day
          <input id="kw-when" className="kw-penfield" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <button type="button" className="kw-btn" disabled={!/^\d{4}-\d{2}-\d{2}$/.test(date)}
          onClick={() => onLay("when", { text: shortDate(date as DateKey), date: date as DateKey })}>Fit it</button>
      </div>
      <p className="kw-note">An uncut leaf is an honest answer. The card says &ldquo;not fixed yet&rdquo; rather than guessing a day.</p>
    </>
  );
}

function PotSlip({ onLay, what, initial }: { onLay: LayFn; what: string; initial: string | null }) {
  const suggestion = useMemo(() => suggestPot(what), [what]);
  const hint = useMemo(() => protectHint(what), [what]);
  const [pick, setPick] = useState<string | null>(initial ?? suggestion?.fund ?? null);
  const chosen = POT_CHOICES.find((pot) => pot.fund === pick) ?? null;
  return (
    <>
      <div className="kw-pots" role="group" aria-label="From which pot">
        {POT_CHOICES.map((pot) => (
          <button key={pot.fund} type="button" className="kw-pick" data-fund={pot.fund} aria-pressed={pick === pot.fund} onClick={() => setPick(pot.fund)}>
            <svg viewBox="0 0 64 70" aria-hidden="true">
              <rect x="3" y="12" width="58" height="11" rx="3" fill="currentColor" />
              <path d="M8 23 L56 23 L50 64 Q32 70 14 64 Z" fill="currentColor" />
              <path d="M8 23 L31 23 L31 68 Q21 67 14 64 Z" fill="#ffffff" opacity=".15" />
            </svg>
            <span>{pot.name}</span>
            <small>{pot.meaning}</small>
          </button>
        ))}
      </div>
      <p className="kw-note" role="status">
        {suggestion ? `${suggestion.why} You can put it anywhere — this is only a suggestion.` : "Nothing here suggests a pot from those words, so nothing is pre-selected."}
      </p>
      <p className="kw-note">{FUND_LABELS.protect}: {POT_CHOICES[2]!.meaning}. Nothing is ever put there by default — the buffer is chosen, never assumed.</p>
      {hint && <p className="kw-note">{hint}</p>}
      <div className="kw-field">
        <button type="button" className="kw-btn" disabled={!chosen} onClick={() => chosen && onLay("pot", { text: chosen.name, fund: chosen.fund, suggested: suggestion?.fund === chosen.fund })}>Fit it</button>
      </div>
    </>
  );
}

function WhoSlip({ onLay, view, names }: { onLay: LayFn; view: LedgerView; names: { mine: string; partner: string } }) {
  return (
    <>
      <div className="kw-chits">
        <button type="button" className="kw-chit" style={{ "--kw-tilt-chit": "-1deg" } as CSSProperties}
          onClick={() => onLay("who", { text: "Just me", choice: "mine" })}>Just me</button>
        {view === "household" && (
          <button type="button" className="kw-chit" style={{ "--kw-tilt-chit": "0.8deg" } as CSSProperties}
            onClick={() => onLay("who", { text: "Both of us", choice: "both" })}>Both of us</button>
        )}
      </div>
      <p className="kw-note">
        {view === "household"
          ? `A shared card waits on the table until ${names.partner} sits — it is not agreed until you both acknowledge it.`
          : "This is your own page. A card for both of you is written at the shared table."}
      </p>
    </>
  );
}

// ---------------------------------------------------------------------------

function Finale({ view, names, month, answers, base, pull, saving, locked, written, pinned, drawer, abandoned, onRaise, onWrite, onPin, onDrawer }: {
  view: LedgerView; names: { mine: string; partner: string }; month: string; answers: WizardAnswers;
  base: ReturnType<typeof wizardBase>; pull: number; saving: boolean; locked: boolean;
  written: Outcome | null; pinned: Outcome | null; drawer: boolean; abandoned: ReturnType<typeof abandonCard>;
  onRaise: () => void; onWrite: () => void; onPin: () => void; onDrawer: () => void;
}) {
  const raised = pull > 0.98;
  const cadence = wizardCadence(answers);
  const joins = base.from === "draft"
    ? `It joins the ${base.lines.length} decision${base.lines.length === 1 ? "" : "s"} already in your private draft for ${month}.`
    : base.from === "version"
      ? `It takes over the ${base.lines.length} decision${base.lines.length === 1 ? "" : "s"} standing for ${month} as your own private draft first.`
      : `It is the first decision in your private draft for ${month}.`;
  return (
    <section className="kw-finale" aria-label="Raise it, then pin it">
      <h3>{pinned?.ok ? `Pinned. ${answers.what?.text} is on the wall.` : written?.ok ? "Written. Now, where does it go?" : "Raise it, then write it."}</h3>
      <p>Pull the tab all the way and the plan stands up as one piece.</p>
      <Whisper mode="aside" id="kw.pull">Scrub the tab back and the card folds flat again &mdash; it is the same card either way, and pulling it writes nothing.</Whisper>

      <dl className="kw-exact">
        <div><dt>Amount</dt><dd>{answers.much?.text}</dd></div>
        <div><dt>Pot</dt><dd>{answers.pot?.text}</dd></div>
        <div><dt>When</dt><dd>{answers.when?.text}</dd></div>
        <div><dt>Repeats</dt><dd>{cadence === "one-time" ? "One time, on that day" : "Every month, no day fixed"}</dd></div>
        <div><dt>Who</dt><dd>{answers.who?.choice === "both" ? `${names.mine} and ${names.partner}` : names.mine}</dd></div>
      </dl>

      {!written?.ok && (
        <>
          <div className="kw-acts">
            {!raised && <button type="button" className="kw-btn kw-btn--lamp" onClick={onRaise}>Play the pull</button>}
            <button type="button" className="kw-btn kw-btn--lamp" disabled={locked || !raised} onClick={onWrite}>{saving ? "Writing…" : "Write it on the card"}</button>
          </div>
          <p className="kw-status" role="status">
            {saving ? "Writing… nothing is written until this comes back."
              : written && !written.ok ? `Nothing was written. ${written.message}`
              : raised ? `Nothing is written yet. Writing it saves a private draft for ${month} — it shares nothing and moves no money. ${joins}`
              : "Nothing is written yet. Raise the card first."}
          </p>
        </>
      )}

      {written?.ok && !pinned?.ok && (
        <>
          <p className="kw-status kw-status--good" role="status">Written to your private draft for {month}. Nothing was shared and no money moved.</p>
          <div className="kw-acts">
            <button type="button" className="kw-btn kw-btn--lamp" disabled={locked} onClick={onPin}>
              {saving ? "Pinning…" : view === "household" ? "Pin it to the wall for both of us" : "Keep it as my plan"}
            </button>
            <button type="button" className="kw-btn kw-btn--ghost" onClick={onDrawer}>Not now</button>
          </div>
          <p className="kw-status" role="status">
            {saving ? "Pinning… nothing is on the wall until this comes back."
              : pinned && !pinned.ok ? `Not pinned. ${pinned.message}`
              : view === "household"
                ? `Pinning proposes this exact ${month} plan to both of you. It waits on the table until ${names.partner} acknowledges it; until then nothing is agreed.`
                : `Keeping it locks this exact ${month} plan as yours. It stays private and moves no money.`}
          </p>
        </>
      )}

      {pinned?.ok && (
        <p className="kw-status kw-status--good" role="status">
          {view === "household"
            ? `On the wall as a proposal. The second chair stays pulled out until ${names.partner} sits — nothing is agreed until you both acknowledge this exact version.`
            : `Kept as your Personal Plan for ${month}.`}
        </p>
      )}

      {drawer && !pinned?.ok && (
        <div className="kw-drawer" role="status">
          <div className="kw-drawer-card"><b>{answers.what?.text}</b><span>{answers.much?.text}</span><span>{answers.when?.text}</span></div>
          <p>{abandoned.words} {written?.ok ? "It is written in your private draft and nothing is shared." : "It is not written anywhere yet."}</p>
        </div>
      )}
    </section>
  );
}

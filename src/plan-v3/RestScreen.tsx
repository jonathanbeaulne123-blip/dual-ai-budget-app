import type { DateKey } from "../core/calendar.ts";
import type { CommitResult, Household, LedgerView } from "../core/types.ts";
import { DivideCard } from "./FundProposals.tsx";
import { PathMiniMap } from "../path/PathMiniMap.tsx";
import { usePathTent } from "../path/tentContext.ts";
import { FlowPanel, type FlowHighlight } from "./FlowPanel.tsx";
import { FundFigure, Paw, QueenNowFigure } from "./figures.tsx";
import { dayWords, moneyWords, type FundKey, type PlanStudioV3Model } from "./model.ts";
import { STEPS } from "./steps.ts";

export const FUND_WORDS: Record<FundKey | "everyday", { name: string; who: string }> = {
  prepare: { name: "Prepare", who: "Has to leave" },
  protect: { name: "Protect", who: "Our backup" },
  build: { name: "Build", who: "We want it to leave" },
  everyday: { name: "Everyday", who: "The here and now" },
};

export type RestAction = { label: string; sub?: string; run: () => void } | null;

/** The one primary action the rest screen offers, from real state only. */
export function restAction(model: PlanStudioV3Model, go: { checkIn: (step?: number) => void; afford: () => void }): RestAction {
  const { agreement, session, snapshot } = model;
  const household = model.view === "household";
  if (snapshot.undividedContributions.length) return null;
  if (model.firstVisit) return { label: household ? "Make our first plan" : "Make my first plan", run: () => go.checkIn(0) };
  if (session.state === "active") { const step = Math.min(session.stage, STEPS.length - 1); return { label: "Continue where we left off", sub: `${STEPS[step]!.title} · step ${step + 1} of ${STEPS.length}`, run: () => go.checkIn(step) }; }
  if (snapshot.flow?.shortFrom) return { label: `Look at ${snapshot.flow.shortFrom.label} together`, sub: `Short from ${dayWords(snapshot.flow.shortFrom.date)}`, run: () => go.checkIn(STEPS.findIndex(step => step.id === "prepare")) };
  if (agreement.kind === "waiting-me") return { label: "Read it and agree", sub: "Agreeing is your own step", run: () => go.checkIn(STEPS.findIndex(step => step.id === "together")) };
  if (agreement.kind === "none" || agreement.kind === "draft") return { label: `Start the ${model.monthLabel} check-in`, run: () => go.checkIn(0) };
  if (household && agreement.kind === "agreed" && !model.monthSet) return { label: `Close ${model.chapter?.monthLabel ?? model.monthLabel}'s Chapter together`, sub: "The Sitdown closes it and opens the next", run: () => go.checkIn(STEPS.findIndex(step => step.id === "sitdown")) };
  return { label: "Can we afford something?", run: go.afford };
}

/**
 * The plan at rest (Round 1F): the Queen with Everyday's "Now", her three
 * funds each with one honest line, the month's flow, and one primary action.
 */
export function RestScreen({ household, memberId, view, today, model, highlight, onHighlight, onFund, action, divide }: {
  household: Household; memberId: string; view: LedgerView; today: DateKey;
  model: PlanStudioV3Model;
  highlight: FlowHighlight;
  onHighlight: (key: FlowHighlight) => void;
  onFund: (key: FundKey | "everyday", from: HTMLElement) => void;
  action: RestAction;
  /** The money model's split flow (D-281). Without it, the moment only reads "not divided yet". */
  divide?: { busy: boolean; run: (fn: (current: Household) => CommitResult) => Promise<{ household?: Household } | null> };
}) {
  const { snapshot, agreement } = model;
  const tent = usePathTent();
  const grave = Boolean(snapshot.flow?.shortFrom);
  const agreedBoth = agreement.paws.length > 0 && agreement.paws.every(paw => paw.agreed);
  const nowAmount = snapshot.now.amountCents;
  const undivided = snapshot.undividedContributions[0] ?? null;
  const chipTone = grave ? "warn" : agreement.kind === "waiting-partner" || agreement.kind === "waiting-me" || undivided ? "wait" : "";
  const chipLabel = undivided ? `${agreement.label} · ${snapshot.undividedContributions.length} to divide` : grave ? "Needs a look" : agreement.label;
  // The loaf only when it is true: the walk has bills and none goes uncovered.
  const pose = grave ? "hide" : agreedBoth && snapshot.flow && !snapshot.flow.shortFrom ? "loaf" : "sit";
  return (
    <div className="pv3-rest">
      <p className="pv3-kicker">{view === "household" ? "Our plan" : "My plan"}</p>
      <div className="pv3-top">
        <h1 tabIndex={-1} id="pv3-rest-heading">{model.monthLabel}</h1>
        <p className={`pv3-chip${chipTone ? ` pv3-chip--${chipTone}` : ""}`}>
          {!model.firstVisit && <span className="pv3-chip__paws" aria-hidden="true">{agreement.paws.map((paw, i) => <Paw key={paw.memberId} on={paw.agreed} tone={i ? "b" : "a"} />)}</span>}
          <span>{model.firstVisit ? "No plan yet" : chipLabel}</span>
          {!model.firstVisit && <span className="pv3-sr">. {agreement.paws.map(paw => `${paw.name} ${paw.agreed ? "agreed" : "not yet"}`).join(", ")}.</span>}
        </p>
      </div>
      <p className={`pv3-sent${model.sentenceTone === "attention" ? " is-bad" : ""}`} role="status">{model.sentence}</p>
      {agreement.draftChanges && <p className="pv3-note">Showing the agreed plan. Your private draft has changes only you can see.</p>}

      <div className="pv3-cols">
        <section className="pv3-court" aria-labelledby="pv3-court-h">
          <h2 id="pv3-court-h" className="pv3-sr">The Queen and her three funds</h2>
          <button type="button" className={`pv3-queenbtn${highlight === "everyday" ? " is-on" : ""}`} data-fund="everyday"
            aria-label={nowAmount === null ? "Everyday, the Queen. Nothing to read yet. Show lines and highlight in the month." : `Everyday, the Queen: ${moneyWords(nowAmount)} ${snapshot.now.line ?? ""}${undivided ? (snapshot.mode === 2 ? `. ${moneyWords(undivided.amountCents)} landed and is not divided yet` : `, plus ${moneyWords(undivided.amountCents)} not divided yet`) : ""}. Show lines and highlight in the month.`}
            onClick={event => { onHighlight("everyday"); onFund("everyday", event.currentTarget); }}>
            <span className="pv3-queenfig"><QueenNowFigure household={household} memberId={memberId} view={view} today={today} grave={grave} agreed={agreedBoth} /></span>
            <span className="pv3-qread">
              <b className="pv3-qread__name">Everyday</b>
              <span className="pv3-amt pv3-qread__big">{nowAmount === null || model.firstVisit ? "—" : moneyWords(nowAmount)}</span>
              {snapshot.now.line && <small>{model.firstVisit ? "Contributions land here first" : snapshot.now.line}</small>}
              {/* The money model already counts a confirmed contribution in the funds (a division is a record only), so it is never added on top. */}
              {undivided && <span className="pv3-pill">{snapshot.mode === 2 ? `${moneyWords(undivided.amountCents)} landed · not divided yet` : `+${moneyWords(undivided.amountCents)} not divided yet`}</span>}
            </span>
          </button>
          {undivided && (divide && snapshot.mode === 2
            ? <DivideCard row={undivided} memberId={memberId} busy={divide.busy} run={divide.run} />
            : (
            <div className="pv3-divide" role="region" aria-labelledby="pv3-divide-h">
              <p className="pv3-kicker">{undivided.memberName}'s contribution · {dayWords(undivided.date)}</p>
              <h2 id="pv3-divide-h" tabIndex={-1}>Divide {moneyWords(undivided.amountCents)}</h2>
              {undivided.suggestion ? <>
                <p className="pv3-note">Hercules suggests:</p>
                <ul className="pv3-split" aria-label="Suggested split">
                  {(["prepare", "protect", "build", "everyday"] as const).filter(key => undivided.suggestion![key] > 0).map(key => <li key={key}>{FUND_WORDS[key].name} <span>+{moneyWords(undivided.suggestion![key])}</span></li>)}
                </ul>
              </> : <p className="pv3-note">Not divided yet. It counts once you both confirm a split.</p>}
              <p className="pv3-note">Dividing opens with the new money model; until then it stays “not divided yet”.</p>
            </div>
          ))}
          <svg className="pv3-vine" viewBox="0 0 300 22" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M150 0 V8 M150 8 Q150 14 50 16 V22 M150 8 V22 M150 8 Q150 14 250 16 V22" /></svg>
          <div className="pv3-three">
            {(["prepare", "protect", "build"] as const).map(key => {
              const reading = snapshot[key];
              const amount = reading.amountCents;
              const bad = reading.tone === "attention";
              const meter = key === "protect" && reading.targetCents && amount !== null ? Math.max(0, Math.min(100, amount / reading.targetCents * 100)) : null;
              return (
                <button key={key} type="button" className={`pv3-fund pv3-fund--${key}${highlight === key ? " is-on" : ""}`} data-fund={key}
                  aria-label={`${FUND_WORDS[key].name}, ${FUND_WORDS[key].who.toLowerCase()}. ${model.firstVisit || amount === null ? "Not set up yet" : `${moneyWords(amount)}${reading.line ? `. ${reading.line}` : ""}`}. Show lines and highlight in the month.`}
                  onClick={event => { onHighlight(key); onFund(key, event.currentTarget); }}>
                  <span className="pv3-fund__figrow">
                    <FundFigure household={household} memberId={memberId} view={view} today={today} fund={key} />
                    {meter !== null && <span className="pv3-meter" aria-hidden="true"><i style={{ height: `${meter}%` }} /></span>}
                  </span>
                  <b className="pv3-fund__name">{FUND_WORDS[key].name}</b>
                  <span className="pv3-amt pv3-fund__amt">{model.firstVisit || amount === null ? "—" : moneyWords(amount)}</span>
                  <span className={`pv3-fund__line${bad ? " is-bad" : ""}`}>{model.firstVisit ? "Not set up" : reading.line ?? FUND_WORDS[key].who}</span>
                </button>
              );
            })}
          </div>
          {view === "household" && (
            <div className="pv3-island">
              <span className="pv3-island__map" aria-hidden="true"><PathMiniMap household={household} today={today} size={64} /></span>
              <p><b>{model.chapter?.monthLabel ?? model.monthLabel} Chapter</b>{model.chapter ? <small>{model.chapter.title}</small> : null}<small>{model.monthSet ? "Set on our island" : "Growing on our island"}</small>{model.chapter?.reminder && <small className="pv3-reminder" role="note">{model.chapter.reminder}</small>}</p>
              {tent && <button type="button" className="pv3-link" onClick={tent.leaveTent}>See it on our island</button>}
            </div>
          )}
        </section>

        <FlowPanel flow={snapshot.flow} highlight={highlight} onClearHighlight={() => onHighlight(null)} pose={pose} />

        {action && <button type="button" className="pv3-btn pv3-cta" onClick={action.run}>{action.label}{action.sub && <small>{action.sub}</small>}</button>}
      </div>
    </div>
  );
}

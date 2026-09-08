import { ReachLevel, SharedReachLevel } from "./ReachLevel.tsx";
import { prepareFundHorizon } from "./core/fundHorizon.ts";
import { addDays } from "./core/calendar.ts";
import { fundWalk } from "./core/fundWalk.ts";
import type { Household, LedgerView } from "./core/types.ts";
import { useEffect, useMemo, useState, type Ref } from "react";
import { fundTrustReading, fundTrustStorageKey, storedFundTrust, type FundTrustLevel, type FundTrustResult, type TrustScenario } from "./core/fundTrust.ts";
import type { FundHorizon } from "./core/fundHorizon.ts";
import { formatCad } from "./core/money.ts";
import "./fund-trust.css";
import "./reach.css";
const LEVELS = ["confirmed", "observed", "estimated"] as const;
const LABELS = { confirmed: "Confirmed", observed: "+ Observed", estimated: "+ Estimated" };
const shortDate = (date: string) => new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
export function useFundTrust(key: string, horizon: FundHorizon | null, scenario?: TrustScenario | null) {
  const readings = useMemo(() => Object.fromEntries(LEVELS.map(level => [level, horizon ? fundTrustReading(horizon, level, scenario) : { kind: "unavailable", reason: "The accepted forward reading is not available yet.", caption: "Needs books" }])) as Record<FundTrustLevel, FundTrustResult>, [horizon, scenario?.scenario, scenario?.currentBasis]);
  const initial = () => storedFundTrust(key);
  const [choice, setChoice] = useState<{ key: string; level: FundTrustLevel }>(() => ({ key, level: initial() }));
  const requested = choice.key === key ? choice.level : initial();
  const level = readings[requested].kind === "trust-reading" ? requested : "confirmed";
  const reading = readings[level];
  const notice = level !== requested ? `${LABELS[requested]} is unavailable. Showing confirmed contributions and scheduled obligations.` : "";
  useEffect(() => { try { sessionStorage.setItem(key, requested); } catch { /* Preference storage never blocks a reading. */ } }, [key, requested]);
  return { level, reading, readings, notice, select: (next: FundTrustLevel) => {
    if (readings[next].kind === "trust-reading") setChoice({ key, level: next });
  } };
}
export type FundTrustControl = ReturnType<typeof useFundTrust>;
export function FundTrustControls({ control, disabled = false }: { control: FundTrustControl; disabled?: boolean }) {
  return <div className="trust-stops" role="group" aria-label="How far to trust">
    {LEVELS.map(level => { const reading = control.readings[level]; return <button key={level} type="button" className="trust-stop"
      aria-pressed={control.level === level} disabled={disabled || reading.kind === "unavailable"}
      aria-label={`${LABELS[level]}. ${reading.kind === "trust-reading" ? `Last included source ${reading.lastSourceDate}` : reading.reason}`}
      onClick={() => control.select(level)}>
      <span className="trust-title">{LABELS[level]}</span>
      <span className="trust-date">{reading.kind === "trust-reading" ? shortDate(reading.lastSourceDate) : reading.caption}</span>
    </button>; })}
  </div>;
}
export function FundTrustFacts({ control }: { control: FundTrustControl }) {
  const { reading } = control;
  if (reading.kind === "unavailable") return <p className="trust-note" role="status">{reading.reason}</p>;
  return <>
    <p className="trust-note">{reading.level === "confirmed" ? "Confirmed contributions + scheduled obligations." : reading.level === "observed" ? "Adds observed contribution estimates; these are not promises." : "Your reviewed contribution scenario."}</p>
    <dl className="reach-readings trust-facts">
      <dt>Last included source</dt><dd>{shortDate(reading.lastSourceDate)}</dd>
      <dt>Model range at end</dt><dd>{reading.endWidthCents === null ? "Not modelled" : reading.endWidthCents === 0 ? "Coincident endpoints" : formatCad(reading.endWidthCents)}</dd>
    </dl>
    <p className="trust-note">Scheduled obligations stay included. This window ends {shortDate(reading.windowThrough)}; the wall does not rule out later costs.</p>
    {LEVELS.some(level => control.readings[level].kind === "unavailable") && <details className="trust-limits"><summary>Unavailable choices</summary>
      {LEVELS.map(level => { const result = control.readings[level]; return result.kind === "unavailable" ? <p className="trust-note" key={level}>{LABELS[level]} · {result.reason}</p> : null; })}
    </details>}
    {control.notice && <p className="trust-note" role="status">{control.notice}</p>}
  </>;
}

/** Shared projection choices never require or expose another member's Personal sources. */
export function SharedFundTrust({ household, memberId, view, today, headline = false, headingRef }: {
  household: Household; memberId: string; view: LedgerView; today: string; headline?: boolean; headingRef?: Ref<HTMLHeadingElement>;
}) {
  const through = addDays(today, 30);
  const horizon = useMemo(() => prepareFundHorizon(household, today, through), [household, today, through]);
  const control = useFundTrust(fundTrustStorageKey(household.environment, household.householdId, memberId, view, today), horizon.kind === "horizon" ? horizon : null);
  const reading = control.reading.kind === "trust-reading" ? control.reading : null;
  return <section className={headline ? "level is-phone" : "trust-shared"}>
    {headline && <><p className="desk-plate-kicker">The Household Fund</p><h2 ref={headingRef} tabIndex={-1} className="reach-figure">{formatCad(fundWalk(household, today.slice(0,7), today).todayBalanceCents)}</h2></>}
    {horizon.kind === "horizon" ? <ReachLevel horizon={horizon} scenario={null} capacityCents={0} reading={reading} /> : <SharedReachLevel household={household} today={today} through={through} />}
    <FundTrustControls control={control} />
    <div className="trust-paperbox"><span className="reach-pill">{control.level === "observed" ? "Projection · observed sources" : "Projection · confirmed contributions"}</span><FundTrustFacts control={control} />{reading && <p className="trust-note">Projected end deficit · {formatCad(reading.lower.terminalDeficitCents)}</p>}</div>
  </section>;
}

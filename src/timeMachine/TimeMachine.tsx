import { useEffect, useMemo, useRef, useState } from "react";
import {
  compareMonths,
  formatCad,
  formatDayLabel,
  monthForecast,
  monthKeyFromDateKey,
  monthKeysBetween,
  monthView,
  shiftMonthKey,
  thisTimeLastYear,
  timelineBeads,
  timelineRange,
  yearShape,
  type Household,
  type LedgerView,
  type MonthState,
  type TimelineBead,
} from "../core/index.ts";
import "./time-machine.css";

/**
 * The time machine (feedback row 8): see any month of your life together,
 * behind you or ahead of you.
 *
 * Two rules hold this page up. **One period per page** — the ribbon moves and
 * everything below it moves with it, so no two figures on screen can belong to
 * different months. And **a month ahead is never postable** — this surface
 * carries no commands at all: it reads, and every door out of it lands on the
 * ordinary flow with its ordinary Final Confirm.
 */
export type TimeMachineProps = {
  household: Household;
  memberId: string;
  view: LedgerView;
  today: string;
  /** Open the books on the month being looked at. Reading only; nothing posts from here. */
  onOpenBooks?: (monthKey: string) => void;
};

type Pane = "month" | "compare" | "ahead" | "year";

const PANES: { id: Pane; label: string }[] = [
  { id: "month", label: "The month" },
  { id: "compare", label: "Compare" },
  { id: "ahead", label: "Ahead" },
  { id: "year", label: "The year" },
];

const STATE_WORD: Record<MonthState, string> = { behind: "Behind you", now: "Now", ahead: "Ahead" };

/** A bead's height is how much the month moved, floored so a quiet month is still a bead. */
function beadHeight(bead: TimelineBead, peakCents: number): number {
  const moved = Math.max(bead.expenseCents, bead.incomeCents);
  if (!peakCents) return 12;
  return Math.round(12 + (moved / peakCents) * 30);
}

function signCad(cents: number): string {
  return `${cents < 0 ? "−" : "+"}${formatCad(Math.abs(cents))}`;
}

export function TimeMachine({ household, memberId, view, today, onOpenBooks }: TimeMachineProps) {
  const active = household.members.some((member) => member.id === memberId && member.active);
  const currentMonth = monthKeyFromDateKey(today);
  const [period, setPeriod] = useState(currentMonth);
  const [pane, setPane] = useState<Pane>("month");
  const [against, setAgainst] = useState(() => shiftMonthKey(currentMonth, -1));
  const ribbon = useRef<HTMLDivElement | null>(null);

  const range = useMemo(() => timelineRange(household, today), [household, today]);
  const beads = useMemo(() => timelineBeads(household, today, range), [household, today, range]);
  const month = useMemo(() => monthView(household, period, today), [household, period, today]);
  const comparison = useMemo(() => (pane === "compare" ? compareMonths(household, against, period) : null), [pane, household, against, period]);
  const forecast = useMemo(() => (pane === "ahead" ? monthForecast(household, today, 6) : null), [pane, household, today]);
  const lastYear = useMemo(() => thisTimeLastYear(household, today), [household, today]);
  const peakCents = beads.reduce((peak, bead) => Math.max(peak, bead.expenseCents, bead.incomeCents), 0);

  // The selected bead stays in view when the month changes from anywhere —
  // a keyboard step, a year cell, or a comparison.
  useEffect(() => {
    const selected = ribbon.current?.querySelector<HTMLElement>('[aria-current="true"]');
    selected?.scrollIntoView?.({ block: "nearest", inline: "center" });
  }, [period]);

  if (!active) {
    return <main className="time-machine"><p className="time-machine__unavailable">The time machine is available to active household members.</p></main>;
  }

  const step = (offset: number) => {
    const next = shiftMonthKey(period, offset);
    if (next < range.from || next > range.to) return;
    setPeriod(next);
  };

  return <main className="time-machine" data-time-machine-state={month.state} aria-labelledby="time-machine-title">
    <header className="time-machine__head">
      <div>
        <h2 id="time-machine-title">{month.label}</h2>
        <p className="time-machine__scope">{view === "personal" ? "Your own money, month by month." : "Your money together, month by month."}</p>
        <p className="time-machine__state">
          <span className="time-machine__chip" data-state={month.state}>{STATE_WORD[month.state]}</span>
          {month.closed ? <span className="time-machine__chip" data-state="closed">Closed</span> : null}
          <span>{month.stateLine}</span>
        </p>
      </div>
      {period === currentMonth ? null : (
        <button type="button" className="time-machine__today" onClick={() => setPeriod(currentMonth)}>Back to now</button>
      )}
    </header>

    <div className="time-machine__ribbon-row">
      <button type="button" className="time-machine__step" onClick={() => step(-1)} aria-label="Previous month" disabled={shiftMonthKey(period, -1) < range.from}>‹</button>
      <div
        className="time-machine__ribbon"
        ref={ribbon}
        role="radiogroup"
        aria-label="Months"
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") { event.preventDefault(); step(-1); }
          if (event.key === "ArrowRight") { event.preventDefault(); step(1); }
        }}
      >
        {beads.map((bead) => (
          <button
            key={bead.monthKey}
            type="button"
            role="radio"
            aria-checked={bead.monthKey === period}
            aria-current={bead.monthKey === period ? "true" : undefined}
            tabIndex={bead.monthKey === period ? 0 : -1}
            className="time-machine__bead"
            data-signal={bead.signal}
            data-state={bead.state}
            onClick={() => setPeriod(bead.monthKey)}
            title={`${bead.label} · ${formatCad(bead.expenseCents)} out`}
          >
            <span className="time-machine__bead-bar" style={{ height: `${beadHeight(bead, peakCents)}px` }} aria-hidden="true" />
            <span className="time-machine__bead-label">{bead.shortLabel}</span>
            <span className="time-machine__sr">
              {bead.label}: {bead.state === "ahead" ? "planned" : `${formatCad(bead.expenseCents)} out, ${formatCad(bead.incomeCents)} in`}
              {bead.memoryCount ? `, ${bead.memoryCount} things worth remembering` : ""}
            </span>
          </button>
        ))}
      </div>
      <button type="button" className="time-machine__step" onClick={() => step(1)} aria-label="Next month" disabled={shiftMonthKey(period, 1) > range.to}>›</button>
    </div>

    <nav className="time-machine__panes" aria-label="Time machine views">
      {PANES.map((item) => (
        <button
          key={item.id}
          type="button"
          className="time-machine__pane-tab"
          aria-current={pane === item.id ? "page" : undefined}
          onClick={() => setPane(item.id)}
        >{item.label}</button>
      ))}
    </nav>

    {pane === "month" ? (
      <section className="time-machine__month" aria-label={`${month.label} in full`}>
        <div className="time-machine__figures">
          <p><span>In</span><strong>{formatCad(month.summary.incomeActualCents)}</strong></p>
          <p><span>Out</span><strong>{formatCad(month.summary.expenseActualCents)}</strong></p>
          <p data-tone={month.summary.netActualCents < 0 ? "warn" : "good"}><span>Left</span><strong>{signCad(month.summary.netActualCents)}</strong></p>
        </div>

        {month.fundConfigured ? (
          <article className="time-machine__card">
            <h3>The Fund</h3>
            <p className="time-machine__big">{formatCad(month.fund.operatingBalanceCents)}</p>
            <p className="time-machine__muted">
              {month.state === "behind"
                ? `Where the Fund stood when ${month.label} ended.`
                : month.state === "ahead"
                  ? `Carried into ${month.label}, before anything in it happens.`
                  : "Where the Fund stands today."}
            </p>
            {month.fund.upcomingReserveCents ? (
              <p className="time-machine__muted">{formatCad(month.fund.upcomingReserveCents)} still reserved for this month's bills.</p>
            ) : null}
          </article>
        ) : null}

        {month.goals.length ? (
          <article className="time-machine__card">
            <h3>Banks</h3>
            <ul className="time-machine__list">
              {month.goals.map((goal) => (
                <li key={goal.goalId}>
                  <span>{goal.name}</span>
                  <span className="time-machine__amount">
                    {goal.addedCents ? `+${formatCad(goal.addedCents)}` : ""}
                    {goal.spentCents ? ` −${formatCad(goal.spentCents)}` : ""}
                    <em>{formatCad(goal.balanceCents)}</em>
                  </span>
                </li>
              ))}
            </ul>
          </article>
        ) : null}

        <article className="time-machine__card time-machine__memories">
          <h3>{month.state === "ahead" ? "Nothing has happened yet" : "What happened"}</h3>
          {month.memories.length ? (
            <ol className="time-machine__list">
              {month.memories.map((memory) => (
                <li key={memory.id} data-memory={memory.kind}>
                  <span><strong>{memory.title}</strong> — {memory.detail}</span>
                  <span className="time-machine__muted">{formatDayLabel(memory.date)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="time-machine__muted">
              {month.state === "ahead"
                ? "This month is still a plan. Everything here is expected, not posted."
                : "A quiet month. That counts as a good one."}
            </p>
          )}
        </article>

        {onOpenBooks && month.state !== "ahead" ? (
          <button type="button" className="time-machine__door" onClick={() => onOpenBooks(period)}>Open the books for {month.label}</button>
        ) : null}

        {lastYear && period === currentMonth ? (
          <article className="time-machine__card time-machine__lastyear">
            <h3>This time last year</h3>
            <p>{lastYear.lastYearLabel} cost {formatCad(lastYear.expenseThenCents)}. So far {lastYear.label} is {formatCad(lastYear.expenseNowCents)}.</p>
            <ul className="time-machine__list">
              {lastYear.lines.map((line) => (
                <li key={line.id}>
                  <span>{line.name}</span>
                  <span className="time-machine__amount">{formatCad(line.thenCents)} <em>{formatCad(line.nowCents)}</em></span>
                </li>
              ))}
            </ul>
          </article>
        ) : null}
      </section>
    ) : null}

    {pane === "compare" && comparison ? (
      <section className="time-machine__compare" aria-label="Two months side by side">
        <label className="time-machine__against">
          Against
          <select value={against} onChange={(event) => setAgainst(event.target.value)}>
            {monthKeysBetween(range.from, range.to).filter((key) => key !== period).map((key) => (
              <option key={key} value={key}>{key}</option>
            ))}
          </select>
        </label>
        <div className="time-machine__figures">
          <p><span>In</span><strong>{signCad(comparison.incomeDeltaCents)}</strong></p>
          <p><span>Out</span><strong>{signCad(comparison.expenseDeltaCents)}</strong></p>
          <p data-tone={comparison.netDeltaCents < 0 ? "warn" : "good"}><span>Left</span><strong>{signCad(comparison.netDeltaCents)}</strong></p>
        </div>
        {comparison.headlines.length ? (
          <p className="time-machine__headline">
            {comparison.headlines.map((line) => `${line.name} ${line.change === "new" ? "is new" : line.change === "stopped" ? "stopped" : `${signCad(line.deltaCents)}`}`).join(" · ")}
          </p>
        ) : null}
        <table className="time-machine__table">
          <caption className="time-machine__sr">{comparison.leftLabel} compared with {comparison.rightLabel}</caption>
          <thead>
            <tr><th scope="col">Where</th><th scope="col">{comparison.leftLabel}</th><th scope="col">{comparison.rightLabel}</th><th scope="col">Change</th></tr>
          </thead>
          <tbody>
            {comparison.lines.map((line) => (
              <tr key={line.id} data-change={line.change}>
                <th scope="row">{line.name}</th>
                <td>{formatCad(line.leftCents)}</td>
                <td>{formatCad(line.rightCents)}</td>
                <td>{line.change === "new" ? "new" : line.change === "stopped" ? "stopped" : line.change === "same" ? "—" : signCad(line.deltaCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    ) : null}

    {pane === "ahead" && forecast ? (
      <section className="time-machine__ahead" aria-label="What is known about the months ahead">
        {forecast.kind === "forecast" ? <>
          <p className="time-machine__big">
            {forecast.shortFrom
              ? `Covered through ${formatDayLabel(forecast.coveredThrough ?? today)}.`
              : `Covered through ${formatDayLabel(forecast.through)} on what's known today.`}
          </p>
          {forecast.shortFrom ? (
            <p className="time-machine__warn">The Fund runs short on {formatDayLabel(forecast.shortFrom)} unless something moves.</p>
          ) : null}
          <table className="time-machine__table">
            <caption className="time-machine__sr">Expected money, month by month</caption>
            <thead>
              <tr><th scope="col">Month</th><th scope="col">Expected in</th><th scope="col">Expected out</th><th scope="col">Lowest</th><th scope="col">Ends at</th></tr>
            </thead>
            <tbody>
              {forecast.months.map((row) => (
                <tr key={row.monthKey} data-low={row.lowestCents < 0 ? "true" : undefined}>
                  <th scope="row"><button type="button" className="time-machine__link" onClick={() => { setPeriod(row.monthKey); setPane("month"); }}>{row.label}</button></th>
                  <td>{formatCad(row.expectedInCents)}</td>
                  <td>{formatCad(row.expectedOutCents)}</td>
                  <td>{formatCad(row.lowestCents)}</td>
                  <td>{formatCad(row.endBalanceCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="time-machine__assumptions">
            {forecast.assumptions.map((line) => <li key={line}>{line}</li>)}
          </ul>
        </> : (
          <div className="time-machine__refusal">
            <p><strong>No honest projection yet.</strong></p>
            <ul>{forecast.reasons.map((reason) => <li key={reason.code}>{reason.message}</li>)}</ul>
            <p className="time-machine__muted">A forecast that guesses is worse than none, so this stays blank until the Fund can answer.</p>
          </div>
        )}
      </section>
    ) : null}

    {pane === "year" ? (
      <YearPane household={household} today={today} period={period} onPick={(monthKey) => { setPeriod(monthKey); setPane("month"); }} />
    ) : null}
  </main>;
}

function YearPane({ household, today, period, onPick }: { household: Household; today: string; period: string; onPick: (monthKey: string) => void }) {
  const [year, setYear] = useState(() => Number(period.slice(0, 4)));
  const data = useMemo(() => yearShape(household, year, today), [household, year, today]);
  const peak = data.months.reduce((high, row) => Math.max(high, row.expenseCents), 0);
  return <section className="time-machine__year" aria-label={`${year} at a glance`}>
    <header className="time-machine__year-head">
      <button type="button" onClick={() => setYear(year - 1)} aria-label="Previous year">‹</button>
      <h3>{year}</h3>
      <button type="button" onClick={() => setYear(year + 1)} aria-label="Next year">›</button>
    </header>
    <ol className="time-machine__year-grid">
      {data.months.map((row) => (
        <li key={row.monthKey}>
          <button type="button" onClick={() => onPick(row.monthKey)} data-state={row.state} aria-current={row.monthKey === period ? "true" : undefined}>
            <span className="time-machine__year-bar" style={{ height: `${peak ? Math.round(6 + (row.expenseCents / peak) * 44) : 6}px` }} aria-hidden="true" />
            <span>{row.shortLabel}</span>
            <span className="time-machine__sr">{row.shortLabel} {year}: {formatCad(row.expenseCents)} out</span>
          </button>
        </li>
      ))}
    </ol>
    <p className="time-machine__muted">
      {data.hardestMonthKey
        ? `The year cost ${formatCad(data.expenseCents)}. ${data.hardestMonthKey} took the most.`
        : "Nothing recorded in this year yet."}
    </p>
  </section>;
}

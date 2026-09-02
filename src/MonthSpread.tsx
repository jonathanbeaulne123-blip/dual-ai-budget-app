import { useMemo, useState } from "react";
import {
  COURSE_AXIS_DAYS,
  COURSE_VIEW,
  PAYDAY_TICK_VIEW,
  claimTickHeight,
  courseBottom,
  courseTop,
  courseX,
  coursePaths,
  dayOfDateKey,
  formatCad,
  paydayTickAria,
  paydayTicks,
  type CoursePoint,
  type Household,
  type PaydayTick,
  type SharedLedgerStory as SharedLedgerStoryModel,
  type SharedMonthCourse,
} from "./core/index.ts";

/**
 * The Month Spread — the Shared Home centre instrument.
 *
 * One sheet, three registers. Presentation only: every figure comes from
 * buildSharedLedgerStory or sharedMonthCourse, and nothing here can post,
 * settle, or move a cent. Register II draws the operating pool above a baseline
 * and the Kitty below it at the same scale, so the conservation rule reads as a
 * picture rather than a sentence.
 */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthName(monthKey: string): string {
  return MONTHS[Number(monthKey.slice(5, 7)) - 1] ?? "";
}

function dayLabel(dateKey: string): string {
  return `${dayOfDateKey(dateKey)} ${monthName(dateKey.slice(0, 7))}`;
}

function reconciliationWord(tied: boolean | null, lastReconciledAt: string | null): string {
  if (!lastReconciledAt) return "Not yet recorded";
  return tied ? "Tied" : "Needs review";
}

/** Two (or more) paper bars for this month's confirmed Fund contributions. Proposals stay off the bar. */
function MemberContribBars({
  rows,
  targetCents,
  nameOf,
}: {
  rows: SharedMonthCourse["contributionsByMember"];
  targetCents: number;
  nameOf: (memberId: string | null | undefined) => string;
}) {
  if (rows.length === 0) return null;
  const maxCents = Math.max(targetCents, ...rows.map((row) => row.cents), 1);
  return (
    <div className="ms-contrib" role="group" aria-labelledby="ms-contrib-heading">
      <span className="ms-key" id="ms-contrib-heading">This month</span>
      {rows.map((row) => (
        <div key={row.memberId} className="ms-contrib-row">
          <span className="ms-contrib-name">{nameOf(row.memberId)}</span>
          <span className="ms-contrib-value">{formatCad(row.cents)}</span>
          <span className="ms-contrib-track" aria-hidden="true">
            <i style={{ width: `${Math.min(100, (row.cents / maxCents) * 100)}%` }} />
          </span>
        </div>
      ))}
      <span className="ms-note">Confirmed this month. A proposal is not on the bar.</span>
    </div>
  );
}

/** A label sits on its own scrap of paper so it never fights the drawing under it. */
function Chip({ x, y, text, tone, anchorEnd = false }: {
  x: number; y: number; text: string; tone: string; anchorEnd?: boolean;
}) {
  const width = text.length * 6.6 + 12;
  return (
    <g>
      <rect
        x={anchorEnd ? x - width + 5 : x - 5}
        y={y - 12.5}
        width={width}
        height={17}
        rx={1.5}
        className="ms-chip-bed"
      />
      <text x={x} y={y} className={tone} textAnchor={anchorEnd ? "end" : undefined}>{text}</text>
    </g>
  );
}

function eventSentence(point: CoursePoint, nameOf: (memberId: string | null | undefined) => string): { when: string; body: string } {
  const event = point.event;
  if (!event) return { when: "", body: "" };
  const who = nameOf(event.confirmedByMemberId ?? event.contributorMemberId ?? event.createdBy);
  // The pair at THIS step, never today's total — the whole point is that this
  // one number is the same on both sides of this particular rollover.
  const pairCents = point.operatingCents + point.kittyCents;
  if (event.kind === "kitty-allocated") {
    return {
      when: dayLabel(event.date),
      body: `Kitty allocated ${formatCad(event.amountCents)} — ${who} confirmed. Operating and Kitty together are ${formatCad(pairCents)} either side of this step: nothing left the household, it changed hands on paper.`,
    };
  }
  if (event.kind === "kitty-released") {
    return {
      when: dayLabel(event.date),
      body: `Kitty released ${formatCad(event.amountCents)} back into the operating pool — ${who} confirmed. The pair stays conserved.`,
    };
  }
  if (event.kind === "contribution-confirmed") {
    const from = nameOf(event.contributorMemberId);
    return {
      when: dayLabel(event.date),
      body: `Contribution confirmed ${formatCad(event.amountCents)} from ${from}. Operating now ${formatCad(point.operatingCents)}.`,
    };
  }
  return {
    when: dayLabel(event.date),
    body: `Settlement confirmed ${formatCad(event.amountCents)} — ${who}. A confirmation, not a bank movement by Hearth. Operating now ${formatCad(point.operatingCents)}.`,
  };
}

function courseAria(course: SharedMonthCourse, monthLabel: string, ticks: PaydayTick[]): string {
  if (!course.configured) {
    return `${monthLabel}. The Household Fund is not open yet, so there is nothing drawn. The first confirmed contribution draws the first step.`;
  }
  const steps = course.points.slice(1).map((point) => {
    const event = point.event;
    if (!event) return "";
    const direction = event.kind === "contribution-confirmed" || event.kind === "kitty-released" ? "up" : "down";
    return `${dayLabel(point.date)}, ${event.kind.replace(/-/g, " ")} ${formatCad(event.amountCents)}, ${direction} to ${formatCad(point.operatingCents)}`;
  }).filter(Boolean);
  const rollover = course.points.find((point) => point.event?.kind === "kitty-allocated");
  return [
    `${monthLabel}. The shared operating pool opens at ${formatCad(course.openingOperatingCents)}.`,
    steps.length ? `${steps.join(". ")}.` : "Nothing has moved it yet.",
    rollover
      ? `On ${dayLabel(rollover.date)} surplus poured out of operating and into the Kitty below the line, leaving the two together unchanged at ${formatCad(course.conservationCents)}.`
      : "",
    `It stands at ${formatCad(course.operatingCents)} today,`,
    course.upcomingReserveCents ? `with ${formatCad(course.upcomingReserveCents)} reserved for a Fund-backed bill still to come,` : "",
    `and ${formatCad(course.freeToSpendCents)} free to commit.`,
    paydayTickAria(ticks),
  ].filter(Boolean).join(" ");
}

export function MonthSpread({
  story,
  course,
  household,
  nameOf,
  custodianName,
  onOpenFund,
  onOpenHealth,
}: {
  story: SharedLedgerStoryModel;
  course: SharedMonthCourse;
  household?: Household;
  nameOf: (memberId: string | null | undefined) => string;
  custodianName: string;
  onOpenFund: () => void;
  onOpenHealth: () => void;
}) {
  const [readout, setReadout] = useState<{ when: string; body: string } | null>(null);
  const opening = story.opening;
  const monthLabel = `${monthName(course.monthKey)} ${course.monthKey.slice(0, 4)}`;
  const paths = useMemo(() => coursePaths(course), [course]);
  const ticks = useMemo(
    () => (household ? paydayTicks(household, course.monthKey) : []),
    [household, course.monthKey],
  );
  const drawable = course.configured && course.tiesToProjection && paths.scale > 0;
  const shortfall = opening.topUpNeededCents > 0;
  const lead = story.queue[0] ?? null;
  const rest = story.queue.slice(1);
  const conservationPoint = course.points.find((point) => point.event?.kind === "kitty-allocated") ?? null;
  const conservationIndex = conservationPoint ? course.points.indexOf(conservationPoint) : -1;
  const beforeConservation = conservationIndex > 0 ? course.points[conservationIndex - 1]! : null;

  const defaultReadout = useMemo(() => {
    if (!course.configured) {
      return { when: "", body: "The Fund opens at $0.00 and stays there until the custodian confirms it. Nothing is drawn until then." };
    }
    if (conservationPoint) return eventSentence(conservationPoint, nameOf);
    const last = course.points[course.todayIndex];
    if (last?.event) return eventSentence(last, nameOf);
    return { when: "", body: "Nothing has been confirmed into the Fund this month yet. The first Confirm draws the first step." };
  }, [course, conservationPoint, nameOf]);

  const shown = readout ?? defaultReadout;
  const days = course.daysInMonth;
  const scale = paths.scale;
  const standing = course.points[course.todayIndex]?.operatingCents ?? 0;
  const standingKitty = course.points[course.todayIndex]?.kittyCents ?? 0;
  const xToday = courseX(paths.todayDay, days);

  return (
    <article className="month-spread" data-ledger-story="shared" data-month-spread={course.configured ? "open" : "unopened"}>

      {/* ---------------- I · Standing ---------------- */}
      <section className="ms-register ms-standing">
        <div className="ms-hero">
          <p className="ms-mark"><span className="ms-numeral">I · Standing</span><span>where the two of you are, right now</span></p>
          {course.configured ? (
            <>
              <p className="ms-lede">{shortfall ? "Before the next commitment, top up" : "Together you can commit"}</p>
              <p className={`ms-figure ${shortfall ? "is-short" : ""}`}>
                {formatCad(shortfall ? opening.topUpNeededCents : opening.freeToSpendCents)}
              </p>
              <p className="ms-sub">
                {shortfall ? (
                  <>
                    Fund free-to-spend is short of the <b>{formatCad(opening.operatingBalanceCents)}</b> standing in the
                    Household Fund. Historical purchases stay recorded. New planned Fund commitments wait on this amount.
                    This is Fund free-to-spend — <b>not</b> the leftover on the seals above.
                  </>
                ) : (
                  <>
                    of the <b>{formatCad(opening.operatingBalanceCents)}</b> standing in the Household Fund, after the
                    transfer {custodianName} still has to clear and what this month has already spoken for.
                    This is Fund free-to-spend — <b>not</b> the leftover on the seals above.
                  </>
                )}
              </p>
              <div className="ms-terms">
                <div className="ms-term"><span className="ms-key">Operating</span><span className="ms-value">{formatCad(opening.operatingBalanceCents)}</span></div>
                <div className="ms-term"><span className="ms-key">Transfer due</span><span className="ms-value is-negative">−{formatCad(opening.transferDueCents)}</span></div>
                <div className="ms-term"><span className="ms-key">Reserved</span><span className="ms-value is-negative">−{formatCad(opening.upcomingReserveCents)}</span></div>
                <div className="ms-term"><span className="ms-key">Kitty, conserved</span><span className="ms-value">{formatCad(course.kittyCents)}</span></div>
              </div>
            </>
          ) : (
            <>
              <p className="ms-lede">The Fund opens when the custodian says so</p>
              <p className="ms-figure is-quiet">{formatCad(0)}</p>
              <p className="ms-sub">{opening.body}</p>
            </>
          )}
        </div>
        <div className="ms-assay">
          <div className={`ms-stamp is-${opening.reconciliationTied === false ? "review" : opening.lastReconciledAt ? "tied" : "none"}`}>
            <span className="ms-stamp-word">{reconciliationWord(opening.reconciliationTied, opening.lastReconciledAt)}</span>
            <span className="ms-stamp-sub">
              {opening.lastReconciledAt ? `reconciled ${dayLabel(opening.lastReconciledAt.slice(0, 10))}` : "shared slice"}
            </span>
          </div>
          {course.configured ? (
            <div className="ms-target">
              <span className="ms-key">Monthly target</span>
              <span className="ms-value">
                {formatCad(opening.targetProgressCents)} <span className="ms-of">of {formatCad(opening.monthlyTargetCents)}</span>
              </span>
              <span
                className="ms-gauge"
                role="img"
                aria-label={`${opening.monthlyTargetCents ? Math.round((opening.targetProgressCents / opening.monthlyTargetCents) * 100) : 0} percent of the monthly target confirmed`}
              >
                <i style={{ width: `${opening.monthlyTargetCents ? Math.min(100, (opening.targetProgressCents / opening.monthlyTargetCents) * 100) : 0}%` }} />
              </span>
              <span className="ms-note">
                {opening.monthlyTargetCents > opening.targetProgressCents
                  ? `${formatCad(opening.monthlyTargetCents - opening.targetProgressCents)} to go. Every contribution here was proposed by one of you and confirmed by the custodian.`
                  : "Target met. Every contribution here was proposed by one of you and confirmed by the custodian."}
              </span>
            </div>
          ) : null}
          {course.configured ? (
            <MemberContribBars
              rows={course.contributionsByMember}
              targetCents={opening.monthlyTargetCents}
              nameOf={nameOf}
            />
          ) : null}
        </div>
      </section>

      {/* ---------------- II · Course ---------------- */}
      <section className="ms-register ms-course">
        <p className="ms-mark"><span className="ms-numeral">II · Course</span><span>the month as one shape — every step is a Confirm someone gave</span></p>
        <div className="ms-plate">
          <div className="ms-course-scroll">
            <svg
              className="ms-course-svg"
              viewBox={`0 0 ${COURSE_VIEW.width} ${drawable ? COURSE_VIEW.height : 132}`}
              role="figure"
              aria-label={courseAria(course, monthLabel, ticks)}
            >
              <defs>
                <pattern id="ms-hatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="0" y2="6" className="ms-hatch-line" />
                </pattern>
              </defs>

              {drawable ? (
                <>
                  {/* this week */}
                  <rect
                    className="ms-week-band"
                    x={courseX(Math.max(1, dayOfDateKey(course.weekStart)), days)}
                    y={18}
                    width={Math.max(0, courseX(Math.min(days, dayOfDateKey(course.weekEnd)), days) - courseX(Math.max(1, dayOfDateKey(course.weekStart)), days))}
                    height={courseBottom(course.peakKittyCents, scale) + 16 - 18}
                  />
                  <text
                    className="ms-axis"
                    x={(courseX(Math.max(1, dayOfDateKey(course.weekStart)), days) + courseX(Math.min(days, dayOfDateKey(course.weekEnd)), days)) / 2}
                    y={COURSE_VIEW.weekLabel}
                    textAnchor="middle"
                  >this week</text>

                  {/* claims lane */}
                  <text className="ms-label" x={COURSE_VIEW.left} y={COURSE_VIEW.claimLabel}>
                    Claims · Fund-backed purchases, waiting on a Confirm
                    {course.transferDueCents > 0 ? <tspan className="ms-label-copper"> · {formatCad(course.transferDueCents)} still to clear</tspan> : null}
                  </text>
                  <line className="ms-rule" x1={COURSE_VIEW.left} y1={COURSE_VIEW.claimRule} x2={COURSE_VIEW.right} y2={COURSE_VIEW.claimRule} />
                  {course.claims.map((claim) => {
                    const x = courseX(dayOfDateKey(claim.date), days);
                    const h = claimTickHeight(claim.amountCents);
                    const up = claim.kind === "purchase-funded";
                    const body = up
                      ? `Fund-backed purchase ${formatCad(claim.amountCents)} — recorded, not yet cleared. It does not move the operating pool; it becomes a transfer due.`
                      : `Fund-backed refund ${formatCad(claim.amountCents)} — a credit back against the claims.`;
                    const readout = { when: dayLabel(claim.date), body };
                    return (
                      <g
                        key={claim.id}
                        className="ms-event"
                        role="button"
                        tabIndex={0}
                        aria-label={body}
                        onMouseEnter={() => setReadout(readout)}
                        onFocus={() => setReadout(readout)}
                        onMouseLeave={() => setReadout(null)}
                        onBlur={() => setReadout(null)}
                      >
                        <line
                          className={up ? "ms-claim" : "ms-claim is-refund"}
                          x1={x} y1={COURSE_VIEW.claimRule}
                          x2={x} y2={up ? COURSE_VIEW.claimRule - h : COURSE_VIEW.claimRule + 7}
                        />
                        <circle className="ms-hit" cx={x} cy={up ? COURSE_VIEW.claimRule - h / 2 : COURSE_VIEW.claimRule + 4} r={11} />
                      </g>
                    );
                  })}

                  {/* future — hatched, never drawn as posted */}
                  <path className="ms-future-area" d={paths.futureArea} data-posted="false" />
                  <path className="ms-future-kitty" d={paths.futureKitty} data-posted="false" />
                  <path className="ms-future-line" d={paths.future} data-posted="false" />

                  {/* posted */}
                  <path className="ms-operating-area" d={paths.operatingArea} />
                  <path className="ms-kitty-area" d={paths.kittyArea} />
                  <path className="ms-operating-line ms-draw" d={paths.operating} />
                  <path className="ms-kitty-line ms-draw" d={paths.kitty} />
                  <line className="ms-baseline" x1={COURSE_VIEW.left} y1={COURSE_VIEW.baseline} x2={COURSE_VIEW.right} y2={COURSE_VIEW.baseline} />

                  {/* free to commit */}
                  <line
                    className="ms-floor"
                    x1={xToday} y1={courseTop(Math.max(0, course.freeToSpendCents), scale)}
                    x2={COURSE_VIEW.right} y2={courseTop(Math.max(0, course.freeToSpendCents), scale)}
                  />
                  <Chip
                    x={COURSE_VIEW.right}
                    y={courseTop(Math.max(0, course.freeToSpendCents), scale) + 22}
                    text={`free to commit ${formatCad(Math.max(0, course.freeToSpendCents))}`}
                    tone="ms-label-pine"
                    anchorEnd
                  />

                  {/* the conservation pair */}
                  {conservationPoint && beforeConservation ? (
                    <>
                      <ConservationBracket
                        x={courseX(dayOfDateKey(conservationPoint.date), days) - 14}
                        top={courseTop(beforeConservation.operatingCents, scale)}
                        bottom={courseBottom(beforeConservation.kittyCents, scale)}
                      />
                      <ConservationBracket
                        x={courseX(dayOfDateKey(conservationPoint.date), days) + 14}
                        top={courseTop(conservationPoint.operatingCents, scale)}
                        bottom={courseBottom(conservationPoint.kittyCents, scale)}
                      />
                      <Chip
                        x={courseX(dayOfDateKey(conservationPoint.date), days) + 26}
                        y={COURSE_VIEW.baseline - 4}
                        text="Operating + Kitty"
                        tone="ms-label-copper"
                      />
                      <Chip
                        x={courseX(dayOfDateKey(conservationPoint.date), days) + 26}
                        y={COURSE_VIEW.baseline + 13}
                        text={`unchanged · ${formatCad(beforeConservation.operatingCents + beforeConservation.kittyCents)}`}
                        tone="ms-label-copper"
                      />
                    </>
                  ) : null}

                  {/* opening */}
                  <line
                    className="ms-opening"
                    x1={COURSE_VIEW.left} y1={courseTop(course.openingOperatingCents, scale)}
                    x2={COURSE_VIEW.left + 18} y2={courseTop(course.openingOperatingCents, scale)}
                  />
                  <Chip
                    x={COURSE_VIEW.left + 24}
                    y={courseTop(course.openingOperatingCents, scale) - 11}
                    text={`opens ${formatCad(course.openingOperatingCents)}`}
                    tone="ms-axis"
                  />

                  {/* event markers */}
                  {course.points.slice(1, course.todayIndex + 1).map((point) => {
                    const sentence = eventSentence(point, nameOf);
                    const x = courseX(dayOfDateKey(point.date), days);
                    const y = courseTop(point.operatingCents, scale);
                    const tone = point.event?.kind === "kitty-allocated" || point.event?.kind === "kitty-released"
                      ? "is-kitty"
                      : (point.event && (point.event.kind === "contribution-confirmed") ? "is-up" : "is-down");
                    return (
                      <g
                        key={point.event?.id ?? point.date}
                        className="ms-event"
                        role="button"
                        tabIndex={0}
                        aria-label={sentence.body}
                        onMouseEnter={() => setReadout(sentence)}
                        onFocus={() => setReadout(sentence)}
                        onMouseLeave={() => setReadout(null)}
                        onBlur={() => setReadout(null)}
                      >
                        <circle className={`ms-dot ${tone}`} cx={x} cy={y} r={3.6} />
                        <circle className="ms-hit" cx={x} cy={y} r={13} />
                      </g>
                    );
                  })}

                  {/* today */}
                  <circle className="ms-today-dot" cx={xToday} cy={courseTop(standing, scale)} r={5} />
                  <Chip x={xToday - 12} y={courseTop(standing, scale) + 25} text={`standing ${formatCad(standing)}`} tone="ms-axis-strong" anchorEnd />
                  <line className="ms-today" x1={xToday} y1={18} x2={xToday} y2={courseBottom(course.peakKittyCents, scale) + 20} />
                  <Chip x={xToday + 7} y={31} text={`today · ${dayLabel(course.today)}`} tone="ms-label-copper" />

                  {/* kitty + reserve footings */}
                  <text className="ms-label-kitty" x={COURSE_VIEW.left} y={courseBottom(course.peakKittyCents, scale) + 16}>
                    Kitty {formatCad(standingKitty)} — surplus rolled into the shared banks
                  </text>
                  {paths.reserveDay ? (
                    <>
                      <line
                        className="ms-reserve"
                        x1={courseX(paths.reserveDay, days)} y1={courseTop(standing, scale)}
                        x2={courseX(paths.reserveDay, days)} y2={courseTop(Math.max(0, standing - course.upcomingReserveCents), scale)}
                      />
                      <text className="ms-label" x={COURSE_VIEW.right} y={courseBottom(course.peakKittyCents, scale) + 16} textAnchor="end">
                        still to come · Fund-backed bill −{formatCad(course.upcomingReserveCents)}
                      </text>
                    </>
                  ) : null}
                </>
              ) : null}

              {/* the ruled staff and its axis, drawn or not */}
              <line
                className="ms-rule"
                x1={COURSE_VIEW.left} y1={drawable ? COURSE_VIEW.axisRule : 86}
                x2={COURSE_VIEW.right} y2={drawable ? COURSE_VIEW.axisRule : 86}
              />
              {ticks.map((tick, index) => {
                const axisY = drawable ? COURSE_VIEW.axisRule : 86;
                const x = courseX(dayOfDateKey(tick.date), days);
                const labelEnd = x >= COURSE_VIEW.right - 70;
                return (
                  <g key={tick.date} className="ms-payday" aria-hidden="true">
                    <line
                      className="ms-payday-tick"
                      x1={x} y1={axisY}
                      x2={x} y2={axisY + PAYDAY_TICK_VIEW.length}
                    />
                    {index === 0 ? (
                      <Chip
                        x={labelEnd ? x - 8 : x + 8}
                        y={axisY - 6}
                        text="payday"
                        tone="ms-axis"
                        anchorEnd={labelEnd}
                      />
                    ) : null}
                  </g>
                );
              })}
              {[...COURSE_AXIS_DAYS, days].map((day) => (
                <text key={day} className="ms-axis" x={courseX(day, days)} y={drawable ? COURSE_VIEW.axisLabel : 102} textAnchor="middle">{day}</text>
              ))}
              <text className="ms-axis" x={COURSE_VIEW.right} y={drawable ? COURSE_VIEW.monthLabel : 118} textAnchor="end">{monthLabel}</text>
              {!drawable ? (
                <>
                  <line className="ms-baseline" x1={COURSE_VIEW.left} y1={54} x2={COURSE_VIEW.right} y2={54} />
                  <text className="ms-empty-staff" x={COURSE_VIEW.width / 2} y={36} textAnchor="middle">
                    {course.configured
                      ? (course.tiesToProjection ? "Nothing has been confirmed into the Fund yet. The first Confirm draws the first step." : "This drawing did not tie to the Fund. Open the household table.")
                      : "The Fund is not open yet. The first Confirm draws the first step."}
                  </text>
                </>
              ) : null}
            </svg>
          </div>
        </div>
        <p className="ms-course-hint">Drag the month sideways to see the rest of it.</p>
        <p className="ms-legend" aria-hidden="true">
          <span><i className="ms-swatch is-operating" /> Operating pool</span>
          <span><i className="ms-swatch is-kitty" /> Kitty, below the line</span>
          <span><i className="ms-swatch is-claim" /> Claims waiting to clear</span>
          <span><i className="ms-swatch is-future" /> Not posted yet</span>
          <span><i className="ms-swatch is-payday" /> Payday</span>
        </p>
        <p className="ms-readout" aria-live="polite">
          {shown.when ? <b>{shown.when}. </b> : null}{shown.body}
        </p>
      </section>

      {/* ---------------- III · Docket ---------------- */}
      <section className="ms-register ms-docket">
        <p className="ms-mark"><span className="ms-numeral">III · Docket</span><span>what is waiting on a person — money never moves without one</span></p>
        {story.queue.length === 0 ? (
          <div className="ms-slip is-clear">
            <span className="ms-slip-title">Nothing is waiting on a person right now.</span>
            <span className="ms-slip-why">
              {opening.lastReconciledAt ? `Shared slice ${opening.reconciliationTied ? "tied" : "needs review"} on ${dayLabel(opening.lastReconciledAt.slice(0, 10))}.` : "The shared slice has not been reconciled yet."}
            </span>
          </div>
        ) : (
          <ul className="ms-slips">
            {[lead, ...rest].filter(Boolean).map((item, index) => item ? (
              <li key={item.id}>
                <button
                  type="button"
                  className={`ms-slip ${index === 0 ? "is-lead" : ""} ${item.amountCents == null ? "is-quiet" : ""}`}
                  onClick={() => (item.sourceTab === "more" ? onOpenHealth() : onOpenFund())}
                >
                  <span className="ms-slip-dot" aria-hidden="true" />
                  <span className="ms-slip-body">
                    <span className="ms-slip-who">{item.actorLabel}</span>
                    <span className="ms-slip-title">{item.title}</span>
                    <span className="ms-slip-why">{item.reason}</span>
                  </span>
                  <span className="ms-slip-amount">{item.amountCents == null ? "—" : formatCad(item.amountCents)}</span>
                </button>
              </li>
            ) : null)}
          </ul>
        )}
      </section>

      {/* ---------------- colophon ---------------- */}
      <footer className="ms-colophon">
        <span className="ms-custody">{story.trust.custodyDisclosure}</span>
        <span className="ms-fact">
          {story.trust.lastReconciledAt
            ? `${story.trust.reconciliationTied ? "tied" : "needs review"} · ${dayLabel(story.trust.lastReconciledAt.slice(0, 10))}`
            : "not yet reconciled"}
        </span>
        <span className="ms-fact">
          {story.trust.pendingProposalCount
            ? `${story.trust.pendingProposalCount} proposal${story.trust.pendingProposalCount === 1 ? "" : "s"} waiting`
            : "no open proposals"}
        </span>
        <span className="ms-fact">{story.trust.environment}</span>
        <button type="button" className="ms-audit" onClick={onOpenFund}>{story.trust.auditLabel}</button>
      </footer>
    </article>
  );
}

function ConservationBracket({ x, top, bottom }: { x: number; top: number; bottom: number }) {
  const d = `M ${x - 6} ${top} L ${x + 6} ${top} M ${x} ${top} L ${x} ${bottom} M ${x - 6} ${bottom} L ${x + 6} ${bottom}`;
  return (
    <g aria-hidden="true">
      <path className="ms-bracket-halo" d={d} />
      <path className="ms-bracket" d={d} />
    </g>
  );
}

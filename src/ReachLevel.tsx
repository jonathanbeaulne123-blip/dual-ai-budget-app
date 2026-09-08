import type { FundTrustReading } from "./core/fundTrust.ts";
import { prepareFundHorizon } from "./core/fundHorizon.ts";
import { fundWalk } from "./core/fundWalk.ts";
import { levelDrawing, LEVEL_PHONE_VIEW } from "./core/levelView.ts";
import type { Household } from "./core/types.ts";
import { calendarDaysBetween } from "./core/calendar.ts";
import { formatCad } from "./core/money.ts";
import type { FundHorizon } from "./core/fundHorizon.ts";
import type { FundScenarioResult } from "./core/scenarioProjection.ts";
import type { WalkPoint } from "./core/fundWalk.ts";

type Point = {date: string; balanceCents: number};
/** Drawing coordinates only. Every balance and scenario bound belongs to a core reader. */
export function ReachLevel({ horizon, scenario, capacityCents, reading }: {reading?: FundTrustReading | null; capacityCents: number; horizon: FundHorizon; scenario: Extract<FundScenarioResult, {kind: "scenario"}> | null}) {
  const actual = horizon.acceptedMonthlyWalk.points.filter(p => p.actual && p.date <= horizon.asOf);
  const start = actual[0]?.date ?? horizon.asOf;
  const days = Math.max(1, calendarDaysBetween(start, horizon.through));
  const anchor = {date: horizon.asOf, balanceCents: horizon.anchorCents};
  const tail = (points: readonly WalkPoint[], end: number, through = horizon.through): Point[] => [anchor, ...points.filter(point => point.date <= through), {date: through, balanceCents: end}];
  const baseline = tail(horizon.future, horizon.endBalanceCents);
  const lower = reading ? tail(reading.lower.future, reading.lower.endBalanceCents, reading.lastSourceDate) : scenario ? tail(scenario.lower.future, scenario.lower.endBalanceCents) : baseline;
  const expected = reading ? tail(reading.expected.future, reading.expected.endBalanceCents, reading.lastSourceDate) : scenario ? tail(scenario.expected.future, scenario.expected.endBalanceCents) : baseline;
  // A fixed scale covers accepted facts and all reviewed source capacity. Elections move only the tail.
  const values = [...actual, ...baseline].map(p => p.balanceCents);
  const lowest = horizon.anchorCents + horizon.movements.reduce((sum,p)=>sum+Math.min(0,p.deltaCents),0);
  const highest = horizon.anchorCents + horizon.movements.reduce((sum,p)=>sum+Math.max(0,p.deltaCents),0) + capacityCents;
  const min = Math.min(0, lowest, ...values), max = Math.max(1, highest, ...values, ...horizon.monthlyBuffers.map(b => b.bufferCents));
  const x = (date: string) => 12 + calendarDaysBetween(start, date) / days * 320;
  const y = (value: number) => 22 + (max - value) / (max - min || 1) * 98;
  const coordinates = (points: readonly Point[]) => points.flatMap((p, i) => i ? [[x(p.date), y(points[i-1]!.balanceCents)], [x(p.date), y(p.balanceCents)]] : [[x(p.date), y(p.balanceCents)]]);
  const path = (points: readonly Point[]) => coordinates(points).map(([a,b], i) => `${i ? 'L' : 'M'}${a},${b}`).join(' ');
  const differs = (reading ? reading.level === "estimated" : reading === undefined && !!scenario) && lower.some((p,i) => p.balanceCents !== expected[i]?.balanceCents);
  const area = differs ? [...coordinates(lower), ...coordinates(expected).reverse()].map(([a,b],i)=>`${i?'L':'M'}${a},${b}`).join(' ')+' Z' : null;
  const labelledBuffer=horizon.monthlyBuffers.find(b=>b.bufferCents>0);
  return <svg className="reach-level" viewBox="0 0 344 148" role="img" aria-label={reading !== undefined ? `Shared Fund. Accepted today ${formatCad(horizon.anchorCents)}.${reading ? ` ${reading.level} projection. Last included source ${reading.lastSourceDate}. Lower end ${formatCad(reading.lower.endBalanceCents)}, expected end ${formatCad(reading.expected.endBalanceCents)}. Scheduled obligations are projections.` : " Forward reading unavailable."}` : `Shared Fund. Accepted today ${formatCad(horizon.anchorCents)}. Baseline end ${formatCad(horizon.endBalanceCents)} through ${horizon.through}.${scenario ? ` Chosen scenario end: lower ${formatCad(scenario.lower.endBalanceCents)}, expected ${formatCad(scenario.expected.endBalanceCents)}.` : ''}`}>
    <line className="reach-zero" x1="12" x2="332" y1={y(0)} y2={y(0)} />
    {horizon.monthlyBuffers.map(b => {const from = b.monthKey+'-01'; const next = horizon.monthlyBuffers[horizon.monthlyBuffers.indexOf(b)+1]; const to = next ? next.monthKey+'-01' : horizon.through; return <line key={b.monthKey} className="reach-buffer" x1={x(from < start ? start : from)} x2={x(to && to < horizon.through ? to : horizon.through)} y1={y(b.bufferCents)} y2={y(b.bufferCents)} />;})}
    {labelledBuffer ? <text x={Math.min(290,Math.max(16,x(labelledBuffer.monthKey+"-01")+4))} y={Math.max(12,y(labelledBuffer.bufferCents)-4)}>buffer</text> : null}
    {area ? <path className="reach-cone" d={area} /> : null}
    <path className="reach-actual" d={path([...actual, anchor])} />
    {reading !== undefined ? reading && <>
      <path className={reading.level === "estimated" ? "reach-lift" : "reach-baseline"} d={path(lower)} />
      {differs && <path className="reach-lift" d={path(expected)} />}
      <line className="trust-wall" x1={x(reading.lastSourceDate)} x2={x(reading.lastSourceDate)} y1="18" y2="124"><title>Last included source · {reading.lastSourceDate}</title></line>
    </> : <><path className="reach-baseline" d={path(baseline)} />
      {scenario?.contributions.length ? <><path className="reach-lift" d={path(lower)} />{differs ? <path className="reach-lift" d={path(expected)} /> : null}</> : null}</>}
    <line className="reach-today" x1={x(horizon.asOf)} x2={x(horizon.asOf)} y1="18" y2="124" />
    <circle className="reach-dot" cx={x(horizon.asOf)} cy={y(horizon.anchorCents)} r="3" />
    <text x={Math.max(27,Math.min(310,x(horizon.asOf)))} y="12" textAnchor="middle">today</text>
    <text x="12" y="140">{start.slice(5)}</text><text x="332" y="140" textAnchor="end">{horizon.through.slice(5)}</text>
  </svg>;
}

/** Shared continuity remains readable even while own Personal scenario sources are unavailable. */
export function SharedReachLevel({household,today,through}: {household:Household;today:string;through:string}) {
  const horizon=prepareFundHorizon(household,today,through);
  if(horizon.kind==='horizon')return <ReachLevel horizon={horizon} scenario={null} capacityCents={0} />;
  const walk=fundWalk(household,today.slice(0,7),today), drawing=levelDrawing(walk,LEVEL_PHONE_VIEW);
  return <svg className="reach-level" viewBox="0 0 344 148" role="img" aria-label={`Shared Fund accepted history through ${today}. Accepted balance ${formatCad(walk.todayBalanceCents)}. Forward scenario unavailable.`}>
    <line className="reach-zero" x1={LEVEL_PHONE_VIEW.left} x2={LEVEL_PHONE_VIEW.right} y1={drawing.zeroY} y2={drawing.zeroY} />
    <path className="reach-actual" d={drawing.actualPath} />
    <text x="12" y="140">Accepted history · {today}</text>
  </svg>;
}

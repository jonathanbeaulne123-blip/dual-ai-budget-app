import { useEffect, useId, useMemo, useRef, useState } from "react";
import { HerculesPortrait } from "../Hercules.tsx";
import { MiniQueen } from "./figures.tsx";
import { dayWords, moneyWords, type FlowDay, type FlowReading, type FundKey } from "./model.ts";

export type FlowHighlight = FundKey | "everyday" | null;
const DAYW = 46, PAD = 26, H = 234;
const RIB: Record<FundKey, number> = { prepare: 172, protect: 186, build: 200 };
const FUND_NAME: Record<FundKey | "everyday", string> = { prepare: "Prepare", protect: "Protect", build: "Build", everyday: "Everyday" };

function dayFunds(day: FlowDay): (FundKey | "everyday")[] {
  const out = new Set<FundKey | "everyday">();
  if (day.contributions.length) out.add("everyday");
  for (const row of day.contributions) if (row.split) for (const key of ["prepare", "protect", "build"] as const) if (row.split[key] > 0) out.add(key);
  for (const row of day.outflows) if (row.fund) out.add(row.fund);
  return [...out];
}

export function stoneLabel(day: FlowDay, today: string): string {
  const parts = [dayWords(day.date, true)];
  if (day.date === today) parts.push("today");
  for (const row of day.contributions) parts.push(`${row.memberName}'s contribution ${moneyWords(row.amountCents)}${row.estimated ? ", expected" : row.actual ? "" : ", planned"}${row.split ? `, marked divided: Prepare ${moneyWords(row.split.prepare)}, Protect ${moneyWords(row.split.protect)}, Build ${moneyWords(row.split.build)}, Everyday ${moneyWords(row.split.everyday)}` : ""}`);
  for (const row of day.outflows) parts.push(`${row.label} ${moneyWords(row.amountCents)}${row.fund ? ` from ${FUND_NAME[row.fund]}` : ""}${row.actual ? "" : ", coming"}`);
  if (!day.contributions.length && !day.outflows.length) parts.push("nothing dated");
  if (day.balanceCents !== null && day.date >= today) parts.push(`the Fund about ${moneyWords(day.balanceCents)}`);
  return parts.join(", ");
}

/**
 * Money through the month (Round 1E-2): contribution stones with the little
 * Queen, bills dropping from the Prepare lane, goal money flowing to Build,
 * the Fund's balance as the water, Hercules sitting on today. Every stone is a
 * 44px button; arrow keys walk the days; the list is the same month in words.
 */
export function FlowPanel({ flow, highlight, onClearHighlight, pose }: { flow: FlowReading | null; highlight: FlowHighlight; onClearHighlight: () => void; pose: "loaf" | "sit" | "hide" }) {
  const headingId = useId();
  const scroller = useRef<HTMLDivElement | null>(null);
  const stones = useRef(new Map<string, HTMLButtonElement>());
  const today = flow?.today ?? "";
  const days = flow?.days ?? [];
  const [selected, setSelected] = useState<string>(() => days.find(day => day.date === today)?.date ?? days[0]?.date ?? "");
  const [listOpen, setListOpen] = useState(false);
  useEffect(() => { if (!days.some(day => day.date === selected)) setSelected(days.find(day => day.date === today)?.date ?? days[0]?.date ?? ""); }, [days, selected, today]);
  const width = PAD * 2 + Math.max(0, days.length - 1) * DAYW;
  const max = useMemo(() => Math.max(1, ...days.map(day => day.balanceCents ?? 0)), [days]);
  const x = (index: number) => PAD + index * DAYW;
  const level = (balance: number | null) => balance === null ? 118 : 130 - Math.max(0, Math.min(1, balance / max)) * 40;
  const scrollTo = (index: number) => { const el = scroller.current; if (el) el.scrollLeft = Math.max(0, x(index) - el.clientWidth / 3); };
  useEffect(() => { const index = days.findIndex(day => day.date === today); if (index >= 0) scrollTo(index); }, [today, days.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!highlight) return;
    const index = days.findIndex(day => dayFunds(day).includes(highlight));
    if (index >= 0) scrollTo(index);
  }, [highlight]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!flow) {
    return (
      <section className="pv3-card pv3-flow" aria-labelledby={headingId}>
        <div className="pv3-flow__head"><h2 id={headingId}>Money through the month</h2></div>
        <p className="pv3-muted">The month's flow appears once the Fund, or a plan, has dated money to walk.</p>
      </section>
    );
  }
  const levels = days.map(day => level(day.balanceCents));
  const line = levels.map((y, i) => `L${x(i)} ${y}`).join(" ");
  const todayIndex = days.findIndex(day => day.date === today);
  const selectedDay = days.find(day => day.date === selected) ?? null;
  const dim = (funds: (FundKey | "everyday")[]) => highlight && !funds.includes(highlight) ? 0.3 : 1;
  const weeks = [[1, 7], [8, 14], [15, 21], [22, days.length]] as const;
  const monthShort = dayWords(days[0]!.date).split(" ")[0];
  const moveFocus = (from: number, delta: number) => {
    const next = days[from + delta];
    if (!next) return;
    stones.current.get(next.date)?.focus();
  };
  return (
    <section className="pv3-card pv3-flow" aria-labelledby={headingId} data-highlight={highlight ?? undefined}>
      <div className="pv3-flow__head"><h2 id={headingId} tabIndex={-1}>Money through the month</h2>{flow.totalInCents > 0 && <span className="pv3-muted pv3-amt">{flow.anyEstimated ? "Expected" : "In"} {moneyWords(flow.totalInCents)}</span>}</div>
      <div className="pv3-flow__key" aria-hidden="true">
        <span><i className="pv3-key pv3-key--queen" />contribution</span><span><i className="pv3-key pv3-key--prepare" />Prepare</span><span><i className="pv3-key pv3-key--protect" />Protect</span><span><i className="pv3-key pv3-key--build" />Build</span><span><i className="pv3-key pv3-key--water" />Everyday</span>
      </div>
      {highlight && <div className="pv3-flow__hi" role="status"><span>Showing <b className={`pv3-ink--${highlight}`}>{FUND_NAME[highlight]}</b></span><button type="button" className="pv3-link" onClick={onClearHighlight}>Show all</button></div>}
      <div className="pv3-flow__wrap">
        <div className="pv3-flow__lanes" aria-hidden="true"><span className="pv3-ink--water" style={{ top: 144 }}>Everyday</span><span className="pv3-ink--prepare" style={{ top: 165 }}>Prepare</span><span className="pv3-ink--protect" style={{ top: 179 }}>Protect</span><span className="pv3-ink--build" style={{ top: 193 }}>Build</span></div>
        <div className="pv3-flow__scroller" ref={scroller} tabIndex={0} role="group" aria-label={`${monthShort}, money through the month. Scroll sideways, or use the week buttons; arrow keys move between days.`}>
          <div className="pv3-flow__track" style={{ width }}>
            <svg className="pv3-flow__bg" width={width} height={H} viewBox={`0 0 ${width} ${H}`} aria-hidden="true" focusable="false">
              <path d={`M0 ${levels[0]} ${line} L${width} ${levels.at(-1)} L${width} 160 L0 160Z`} className="pv3-water" opacity={!highlight || highlight === "everyday" ? 1 : 0.55} />
              <path d={`M0 ${levels[0]} ${line} L${width} ${levels.at(-1)}`} className="pv3-water__line" strokeWidth={highlight === "everyday" ? 3 : 1.5} />
              {(Object.keys(RIB) as FundKey[]).map(key => <path key={key} d={`M0 ${RIB[key]}H${width}`} className={`pv3-rib pv3-rib--${key}`} strokeWidth={highlight === key ? 7 : 4} opacity={!highlight || highlight === key ? 1 : 0.3} />)}
              {days.map((day, i) => day.outflows.map((row, j) => {
                const X = x(i), Y = levels[i]!;
                if (row.fund === "build") return <path key={`${day.date}-${j}`} className="pv3-stream pv3-stream--build" d={`M${X} ${Y + 8} C${X} ${RIB.build - 18} ${X + 18} ${RIB.build - 14} ${X + 28} ${RIB.build}`} strokeWidth={1.2 + Math.min(4, row.amountCents / 60000)} opacity={dim(["build"])} />;
                if (row.fund === "prepare") return <path key={`${day.date}-${j}`} className="pv3-drop" d={`M${X} ${RIB.prepare - 3} V${Y + 8}`} opacity={dim(["prepare"]) * 0.9} />;
                return null;
              }))}
              {days.map((day, i) => day.contributions.map((row, j) => row.split ? (["prepare", "protect", "build"] as const).filter(key => row.split![key] > 0).map((key, k) => {
                const X = x(i), Y = levels[i]!, tx = X + 18 + k * 10;
                return <path key={`${day.date}-${j}-${key}`} className={`pv3-stream pv3-stream--${key}`} d={`M${X} ${Y + 8} C${X} ${RIB[key] - 18} ${tx} ${RIB[key] - 14} ${tx + 10} ${RIB[key]}`} strokeWidth={1.2 + row.split![key] / 60000} opacity={dim([key, "everyday"])} />;
              }) : null))}
              {days.map((day, i) => {
                const X = x(i), Y = levels[i]!, fade = dim(dayFunds(day)), past = day.date < today;
                const first = day.contributions[0];
                const bill = day.outflows.find(row => row.fund === "prepare");
                return (
                  <g key={day.date} opacity={fade}>
                    {first ? <>
                      <ellipse cx={X} cy={Y + 2} rx="15" ry="8" className={`pv3-stone pv3-stone--in${first.estimated ? " is-expected" : ""}`} strokeWidth={highlight === "everyday" ? 3.5 : 2} />
                      <MiniQueen x={X - 11} y={Y - 26} />
                      <text x={X} y={Y - 36} textAnchor="middle" className="pv3-t pv3-t--in">+{moneyWords(day.contributions.reduce((sum, row) => sum + row.amountCents, 0))}</text>
                      <text x={X} y={Y - 48} textAnchor="middle" className="pv3-t">{first.memberName.split(" ")[0]}</text>
                    </> : <>
                      <ellipse cx={X} cy={Y} rx={bill ? 11 : 8} ry={(bill ? 11 : 8) * 0.6} className={`pv3-stone${highlight && highlight !== "everyday" && dayFunds(day).includes(highlight) ? ` is-ring pv3-ring--${highlight}` : ""}`} opacity={past ? 0.55 : 1} />
                      {bill && <><text x={X} y={Y - 26} textAnchor="middle" className="pv3-t pv3-t--bill">{bill.label.length > 9 ? `${bill.label.slice(0, 8)}…` : bill.label}</text><text x={X} y={Y - 14} textAnchor="middle" className="pv3-t pv3-t--bill">−{moneyWords(bill.amountCents)}</text></>}
                    </>}
                    {day.date === today && <ellipse cx={X} cy={Y + 1} rx="20" ry="12" className="pv3-today" />}
                    <text x={X} y="226" textAnchor="middle" className={`pv3-t pv3-t--day${day.date === today ? " is-today" : ""}`}>{day.date === today ? "Today" : day.day === 1 || day.day % 7 === 1 ? `${monthShort} ${day.day}` : ""}</text>
                  </g>
                );
              })}
            </svg>
            <ol className="pv3-flow__stones" aria-label={`Days in ${monthShort}`}>
              {days.map((day, i) => (
                <li key={day.date}>
                  <button ref={node => { if (node) stones.current.set(day.date, node); else stones.current.delete(day.date); }} type="button" className="pv3-stonebtn" style={{ left: x(i), top: levels[i] }}
                    aria-pressed={day.date === selected} aria-label={stoneLabel(day, today)}
                    onClick={() => setSelected(day.date)}
                    onKeyDown={event => { if (event.key === "ArrowRight") { event.preventDefault(); moveFocus(i, 1); } else if (event.key === "ArrowLeft") { event.preventDefault(); moveFocus(i, -1); } }} />
                </li>
              ))}
            </ol>
            {todayIndex >= 0 && <div className="pv3-flow__herc" style={{ left: x(todayIndex), top: levels[todayIndex]! - (days[todayIndex]!.contributions.length ? 100 : 40) }} aria-hidden="true"><HerculesPortrait pose={pose} size={40} mood={pose === "hide" ? "restless" : "content"} hat={null} chain={null} house={null} collar={null} /></div>}
          </div>
        </div>
      </div>
      <div className="pv3-flow__weeks" role="group" aria-label="Jump to part of the month">
        {weeks.map(([from, to], i) => <button key={from} type="button" onClick={() => scrollTo(from - 1)}>{i === 0 ? `${monthShort} ${from}–${to}` : `${from}–${to}`}</button>)}
      </div>
      <div className="pv3-flow__day" aria-live="polite">
        {selectedDay && <>
          <h3>{dayWords(selectedDay.date, true)}{selectedDay.date === today && <span className="pv3-flag">Today</span>}</h3>
          {selectedDay.contributions.map(row => <p key={row.id}><b>{row.memberName}'s contribution</b> <b className="pv3-amt pv3-ink--in">+{moneyWords(row.amountCents)}</b>{row.estimated ? <span className="pv3-muted"> (expected)</span> : null}{row.split ? null : <span className="pv3-muted"> · its split isn't recorded here yet</span>}</p>)}
          {selectedDay.outflows.map(row => <p key={row.id}><b>{row.label}</b> <b className="pv3-amt pv3-ink--bill">−{moneyWords(row.amountCents)}</b>{row.fund ? <> · from <b className={`pv3-ink--${row.fund}`}>{FUND_NAME[row.fund]}</b></> : null}{row.actual ? null : <span className="pv3-muted"> · coming</span>}</p>)}
          {!selectedDay.contributions.length && !selectedDay.outflows.length && <p className="pv3-muted">Nothing dated.</p>}
          {selectedDay.balanceCents !== null && selectedDay.date >= today && <p className="pv3-muted">The Fund about <b className="pv3-amt">{moneyWords(selectedDay.balanceCents)}</b> at day's end.</p>}
        </>}
      </div>
      <button type="button" className="pv3-link" aria-expanded={listOpen} onClick={() => setListOpen(!listOpen)}>{listOpen ? "Hide the list" : "Show as a list"}</button>
      {listOpen && (
        <ol className="pv3-flow__list">
          {days.filter(day => day.contributions.length || day.outflows.length || day.date === today).map(day => {
            const [head, ...rest] = stoneLabel(day, today).split(", ");
            return <li key={day.date}>{head}<small>{rest.join(", ")}</small></li>;
          })}
        </ol>
      )}
    </section>
  );
}

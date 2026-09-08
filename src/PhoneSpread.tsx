import type { ScenarioSourceContext } from "./scenarioSourceContext.ts";
import { useEffect, useId, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  askAlternatives, askBelongsOnDesk, booksPresentationFloor, categorySpendBars, contributionRegister,
  formatCad, formatDateLabel, householdAsk, monthSummary, paydayTickAria, paydayTicks, fundWalk,
  type CommitResult, type Household,
} from "./core/index.ts";
import { PHONE_CHAPTERS, PHONE_READING_NAMES, ownPhoneTipSpark, type PhoneChapter, type PhoneReading } from "./core/phoneSpread.ts";
import { FundStage, type FundDestination } from "./FundStage.tsx";
import { PaperBars, PaperSpark } from "./theme/PaperTheme.tsx";
import "./phone-spread.css";

function Reading({ scenarioSource, id, household, memberId, today, busy, onKitchen, onOpen }: {
  scenarioSource?: ScenarioSourceContext | null;
  id: PhoneReading; household: Household; memberId: string; today: string; busy: boolean;
  onKitchen: (fn: (current: Household) => CommitResult) => void; onOpen: (destination: FundDestination) => void;
}) {
  const month = today.slice(0, 7);
  const model = useMemo(() => {
    if (id === "tips") return { kind: "tips" as const, points: ownPhoneTipSpark(household, memberId, today) };
    if (id === "categories") return { kind: "categories" as const, rows: categorySpendBars(monthSummary(booksPresentationFloor(household, memberId, "household"), month).categories, 12) };
    if (!household.householdFund) return { kind: "unavailable" as const, line: "The Shared Fund has not been opened yet." };
    if (!fundWalk(household, month, today).tiesToProjection) return { kind: "unavailable" as const, line: "The Fund needs review before this reading can be shown." };
    if (id === "paydays") return { kind: "paydays" as const, ticks: paydayTicks(household, month) };
    if (id === "members") return { kind: "members" as const, sources: contributionRegister(household, month, today).sources.filter(source => source.kind === "contribution") };
    if (id === "deferral") {
      if (!askBelongsOnDesk(memberId, household.householdFund.custodianMemberId)) return { kind: "unavailable" as const, line: "The Ask belongs on the contributor's own desk." };
      const ask = householdAsk(household, today);
      return { kind: "deferral" as const, ask, rows: askAlternatives(ask) };
    }
    return { kind: "stage" as const };
  }, [household, memberId, today, month, id]);
  const nameOf = (member: string | null) => household.members.find(row => row.id === member)?.name ?? "A member";
  if (model.kind === "unavailable") return <p className="desk-plate-empty">{model.line}</p>;
  if (model.kind === "tips") return model.points === null ? <p className="desk-plate-empty">This reading belongs on the contributor's own desk.</p> : <>
    <h3>Your posted tips · last four weeks</h3>
    {model.points.length ? <PaperSpark points={model.points} /> : <p className="desk-plate-empty">No posted tips in the last four weeks.</p>}
    <p className="desk-plate-foot">Posted net tips. Received cash and tips still owed stay separate in your shift receipt.</p>
  </>;
  if (model.kind === "categories") return <><h3>Shared posted expenses this month</h3>{model.rows.length ? <PaperBars rows={model.rows} /> : <p className="desk-plate-empty">No Shared expenses posted this month.</p>}<p className="desk-plate-foot">Posted expenses only. Card payments are transfers.</p></>;
  if (model.kind === "paydays") return <><h3>Payday ticks</h3><p>{paydayTickAria(model.ticks) || "No payday schedule is recorded for this month."}</p><ol className="spread-paydays">{model.ticks.map(tick => <li key={tick.date}><time dateTime={tick.date}>{formatDateLabel(tick.date)}</time></li>)}</ol><p className="desk-plate-foot">The custodian's scheduled pay dates. Timing only; no amount is assumed.</p></>;
  if (model.kind === "members") return <><h3>Confirmed contributions by member</h3>{model.sources.length ? <ul className="spread-contributions">{model.sources.map(source => <li key={source.eventId}><strong>{nameOf(source.memberId)}</strong><time dateTime={source.date}>{formatDateLabel(source.date)}</time><span>{formatCad(source.amountCents)}</span></li>)}</ul> : <p className="desk-plate-empty">No confirmed contributions this month.</p>}<p className="desk-plate-foot">Each entry is confirmed money put into the Shared Fund.</p></>;
  if (model.kind === "deferral") return <><h3>Moving a goal claim</h3><p>Current Ask · {formatCad(model.ask.askCents)}</p>{model.rows.length ? <ul className="spread-deferrals">{model.rows.map(row => <li key={`${row.goalId}:${row.claimDate}`}><strong>{row.label}</strong><p>{formatDateLabel(row.claimDate)} · {formatCad(row.claimCents)} claimed.</p><p>{row.copy}</p></li>)}</ul> : <p className="desk-plate-empty">No eligible goal claim to move this month.</p>}<p className="desk-plate-foot">This is the effect of moving the claim to next month. The Ask page holds the separate review and confirmation.</p></>;
  const widgetId = id === "shape" || id === "next-out" || id === "week" || id === "streams" || id === "ask" ? id : "shelf";
  return <FundStage scenarioSource={scenarioSource} widgetId={widgetId} household={household} memberId={memberId} today={today} busy={busy}
    presentation="phone" onKitchen={onKitchen} onOpenDestination={onOpen} onOpenAccount={() => onOpen("record")} />;
}

/** The album has page gestures only. Interactive rails stay in the Ledge. */
export function PhoneSpread({ scenarioSource, chapter, household, memberId, view, today, busy, onClose, onKitchen, onOpen }: {
  scenarioSource?: ScenarioSourceContext | null;
  chapter: PhoneChapter; household: Household; memberId: string; view: "household" | "personal"; today: string; busy: boolean;
  onClose: () => void; onKitchen: (fn: (current: Household) => CommitResult) => void; onOpen: (destination: FundDestination) => void;
}) {
  const [page, setPage] = useState(0);
  const [offset, setOffset] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const pointer = useRef<{ id: number; x: number; y: number; horizontal: boolean } | null>(null);
  const id = useId();
  const pages = PHONE_CHAPTERS[chapter].pages;
  const index = Math.min(page, pages.length - 1);
  const reading = pages[index]!;
  useEffect(() => { setPage(0); setOffset(0); pointer.current = null; panel.current?.focus(); }, [chapter, household.environment, household.householdId, memberId, view, today]);
  const select = (next: number) => {
    setPage(Math.max(0, Math.min(pages.length - 1, next))); setOffset(0);
    if (panel.current) panel.current.scrollTop = 0;
    queueMicrotask(() => panel.current?.focus());
  };
  const cancel = () => { pointer.current = null; setOffset(0); };
  const down = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0 || (event.target as Element).closest('button,input,select,textarea,a,[role="slider"]')) return;
    pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, horizontal: false };
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const p = pointer.current;if (!p || p.id !== event.pointerId) return;
    const dx = event.clientX - p.x, dy = event.clientY - p.y;
    if (!p.horizontal && Math.abs(dy) > 12 && Math.abs(dy) >= Math.abs(dx)) { cancel(); return; }
    if (!p.horizontal && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.5) { p.horizontal = true; event.currentTarget.setPointerCapture(event.pointerId); }
    if (p.horizontal) setOffset(Math.max(-100, Math.min(100, dx)));
  };
  const up = (event: PointerEvent<HTMLDivElement>) => {
    const p=pointer.current;if(!p || p.id!==event.pointerId)return;
    const dx=event.clientX-p.x;cancel();
    if(p.horizontal && Math.abs(dx)>=40)select(index+(dx<0?1:-1));
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  };
  if (!household.members.some(member => member.id === memberId && member.active)) return null;
  return <section className="phone-spread" aria-label={`${PHONE_CHAPTERS[chapter].name} chapter`} onKeyDown={event => {
    if ((event.target as Element).closest('input,textarea,select,[data-ask-confirm]')) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); select(index + (event.key === 'ArrowRight' ? 1 : -1)); }
    if (event.key === 'Escape') { event.preventDefault(); onClose(); }
  }}>
    <header className="spread-head"><p>{PHONE_CHAPTERS[chapter].name} · {reading === "tips" ? "Your tips" : "Shared"}</p><button type="button" onClick={onClose}>Close chapter</button></header>
    {view === "personal" && reading !== "tips" ? <p className="spread-scope">Shared household reading · opened from Personal.</p> : null}
    <h2 ref={heading} tabIndex={-1} id={`${id}-heading`} className="spread-heading sr-only">{PHONE_READING_NAMES[reading]}</h2>
    <div ref={panel} id={`${id}-page`} className="spread-page" tabIndex={-1} role="tabpanel" aria-labelledby={`${id}-heading`}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={cancel}>
      <div style={{ transform: `translateX(${offset}px)` }} key={`${reading}:${household.environment}:${household.householdId}:${memberId}:${today}`}>
        <Reading scenarioSource={scenarioSource} id={reading} household={household} memberId={memberId} today={today} busy={busy} onKitchen={onKitchen} onOpen={destination => { onClose(); onOpen(destination); }} />
      </div>
    </div>
    <footer className="spread-foot"><button type="button" aria-label="Previous reading" disabled={index===0} onClick={()=>select(index-1)}>‹</button>
      <div className="spread-dots" role="tablist" aria-label="Readings">{pages.map((p,i)=><button key={p} type="button" role="tab" aria-label={`${i+1} of ${pages.length}: ${PHONE_READING_NAMES[p]}`} aria-controls={`${id}-page`} aria-selected={index===i} onClick={()=>select(i)}><i aria-hidden="true" /></button>)}</div>
      <button type="button" aria-label="Next reading" disabled={index===pages.length-1} onClick={()=>select(index+1)}>›</button>
    </footer>
  </section>;
}

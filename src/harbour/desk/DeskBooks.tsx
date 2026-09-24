import { useMemo, type ReactNode } from "react";
import { shortDate } from "../nav/doorSigns.ts";
import {
  BOOK_DOORS, readContributions, readGoals, readRecord, readSpending, readWaterline,
  type DeskBookId, type DeskContributions, type DeskGoals, type DeskRecord, type DeskShapeRow, type DeskSpending, type DeskWaterline,
} from "./booksModel.ts";
import { engravedCents } from "./engraved.ts";
import type { DeskPageProps } from "./types.ts";
import "./desk-books.css";

/**
 * Books — the Standing Book's divisions as live rows (SIMPLE_VIEW_DESK S4 §5):
 * Today's waterline, the Spending shape, Goals, Contributions and the Record.
 * Every figure is the selector's figure; every row is one door that opens the
 * books surface at its own division (`books` + the division's address, the
 * Bindery's deep link). Nothing on this page moves money.
 */
export function DeskBooks({ household, memberId, scope, today, onOpen }: DeskPageProps) {
  const waterline = useMemo(() => readWaterline(household, memberId, scope, today), [household, memberId, scope, today]);
  const spending = useMemo(() => readSpending(household, memberId, scope, today), [household, memberId, scope, today]);
  const goals = useMemo(() => readGoals(household, memberId, scope, today), [household, memberId, scope, today]);
  const contributions = useMemo(() => readContributions(household, memberId, scope, today), [household, memberId, scope, today]);
  const record = useMemo(() => readRecord(household, memberId, scope, today), [household, memberId, scope, today]);
  const open = (id: DeskBookId) => () => onOpen("books", BOOK_DOORS[id].object);
  return <div className="desk-books" data-desk-books={scope}>
    <Waterline waterline={waterline} personal={scope === "personal"} onOpen={open("today")} />
    <Spending spending={spending} personal={scope === "personal"} onOpen={open("spending")} />
    <Goals goals={goals} onOpen={open("goals")} />
    <Contributions contributions={contributions} personal={scope === "personal"} onOpen={open("contributions")} />
    <Record record={record} onOpen={open("record")} />
  </div>;
}

/** One division, one door. The row is the button; its words are its reading. */
function BookRow({ id, kicker, label, onOpen, children }: { id: DeskBookId; kicker: string; label: string; onOpen: () => void; children: ReactNode }) {
  return <button type="button" className={`desk-card desk-book desk-book--${id}`} data-desk-book={id} onClick={onOpen}
    aria-label={`${label} Open the books at ${BOOK_DOORS[id].division}.`}>
    <span className="desk-book__tab" aria-hidden="true">{BOOK_DOORS[id].division}</span>
    <span className="desk-card__kicker">{kicker}</span>
    {children}
    <span className="desk-book__door" aria-hidden="true">Open the books at {BOOK_DOORS[id].division} <span className="desk-book__arrow">→</span></span>
  </button>;
}

function stamp(waterline: DeskWaterline): string {
  if (waterline.reconciled === "stamped" && waterline.lastReconciledAt) return shortDate(waterline.lastReconciledAt.slice(0, 10));
  if (waterline.reconciled === "not-yet") return "Not yet reconciled";
  return "—";
}

function Waterline({ waterline, personal, onOpen }: { waterline: DeskWaterline; personal: boolean; onOpen: () => void }) {
  const lead = engravedCents(waterline.leadCents);
  const pairs: [string, string][] = waterline.kind === "fund"
    ? [["Reserved for upcoming", engravedCents(waterline.reservedCents)], ["Free to spend", engravedCents(waterline.freeCents)], ["Last reconciled", stamp(waterline)]]
    : waterline.kind === "shared-cash"
      ? [["Reserved for upcoming", "—"], ["Free to spend", "—"], ["Last reconciled", "—"]]
      : [];
  const label = `Today, the waterline. ${waterline.leadLabel}: ${lead}.${pairs.map(([k, v]) => ` ${k}: ${v}.`).join("")}${personal ? " The shared Fund’s waterline is on the Shared desk." : ""}`;
  return <BookRow id="today" kicker={personal ? "Today · my books" : "Today · the waterline"} label={label} onOpen={onOpen}>
    <span className="desk-book__lead">
      <span className="desk-book__lead-label">{waterline.leadLabel}</span>
      <strong className="desk-figure desk-book__figure" data-desk-figure="lead">{lead}</strong>
    </span>
    {pairs.length > 0 && <span className="desk-book__pairs">
      {pairs.map(([k, v]) => <span key={k} className="desk-book__pair" data-desk-pair={k}><span className="desk-book__pair-key">{k}</span><span className="desk-book__pair-value">{v}</span></span>)}
    </span>}
    {waterline.kind === "shared-cash" && <span className="desk-card__line">No shared Fund yet, so nothing is reserved against it.</span>}
    {personal && <span className="desk-card__line">The shared Fund’s waterline is on the Shared desk.</span>}
  </BookRow>;
}

/** A category's own band, and where this month sits on it. Never against another category. */
function ShapeTrack({ row }: { row: DeskShapeRow }) {
  const banded = row.bandLowCents !== null && row.bandHighCents !== null;
  const lo = banded ? Math.min(row.bandLowCents!, row.monthToDateCents) : 0;
  const hi = banded ? Math.max(row.bandHighCents!, row.monthToDateCents) : Math.max(row.monthToDateCents, 1);
  const x = (cents: number) => 4 + Math.max(0, Math.min(1, (cents - lo) / (hi - lo || 1))) * 92;
  return <span className="desk-shape__track" aria-hidden="true">
    {banded && <i className="desk-shape__band" style={{ left: `${x(row.bandLowCents!)}%`, width: `${Math.max(1, x(row.bandHighCents!) - x(row.bandLowCents!))}%` }} />}
    <i className="desk-shape__dot" style={{ left: `${x(row.monthToDateCents)}%` }} />
  </span>;
}

function Spending({ spending, personal, onOpen }: { spending: DeskSpending | null; personal: boolean; onOpen: () => void }) {
  const headline = !spending ? "—"
    : spending.rows.length === 0 ? personal ? "Nothing spent yet this month" : "Not enough history for a shape"
      : spending.overCount > 0 ? `${spending.overCount} ${personal ? "over plan" : "above shape"}`
        : spending.comparable > 0 ? personal ? "Within plan" : "Nothing above shape" : personal ? "No plan to read against" : "Not enough history yet";
  const rest = spending ? spending.total - spending.rows.length : 0;
  const label = `Spending. ${headline}.${spending ? spending.rows.map(row => ` ${row.label}: ${engravedCents(row.monthToDateCents)} this month, ${row.word}.`).join("") : ""}`;
  return <BookRow id="spending" kicker={personal ? "Spending · my books against the plan" : "Spending · the shape"} label={label} onOpen={onOpen}>
    <strong className="desk-book__headline">{headline}</strong>
    {spending && spending.rows.length > 0 && <span className="desk-shape">
      {spending.rows.map(row => <span key={row.id} className="desk-shape__row" data-desk-shape={row.verdict}>
        <span className="desk-shape__name">{row.label}</span>
        <span className="desk-shape__figure">{engravedCents(row.monthToDateCents)}</span>
        <ShapeTrack row={row} />
        <span className="desk-shape__word">{row.word}</span>
      </span>)}
    </span>}
    <span className="desk-card__line">{personal ? "Each category against its own plan for the month." : "Each category against its own last three months — never against another."}{rest > 0 ? ` ${rest} more in the books.` : ""}</span>
  </BookRow>;
}

function Goals({ goals, onOpen }: { goals: DeskGoals | null; onOpen: () => void }) {
  const headline = !goals ? "—" : goals.count === 0 ? "No goals on the shelf yet" : `${goals.count} ${goals.count === 1 ? "goal" : "goals"} · ${engravedCents(goals.totalCents)} put by`;
  const label = `Goals. ${headline}.${goals ? goals.top.map(goal => ` ${goal.name}: ${engravedCents(goal.amountCents)} of ${engravedCents(goal.targetCents)}.`).join("") : ""}`;
  return <BookRow id="goals" kicker="Goals · the banks" label={label} onOpen={onOpen}>
    <strong className="desk-book__headline" data-desk-figure="goals">{headline}</strong>
    {goals && goals.top.length > 0 && <span className="desk-goals">
      {goals.top.map(goal => {
        const fill = goal.amountCents !== null && goal.targetCents > 0 ? Math.max(0, Math.min(1, goal.amountCents / goal.targetCents)) : 0;
        return <span key={goal.id} className="desk-goals__row" data-desk-goal={goal.id}>
          <span className="desk-goals__name">{goal.name}</span>
          <span className="desk-goals__figure">{engravedCents(goal.amountCents)} <small>of {goal.targetCents > 0 ? engravedCents(goal.targetCents) : "no target"}</small></span>
          <span className="desk-goals__bar" aria-hidden="true"><i style={{ width: `${Math.round(fill * 1000) / 10}%` }} /></span>
        </span>;
      })}
    </span>}
    {goals && goals.count > goals.top.length && <span className="desk-card__line">{goals.count - goals.top.length} more on the shelf.</span>}
  </BookRow>;
}

function Contributions({ contributions, personal, onOpen }: { contributions: DeskContributions | null; personal: boolean; onOpen: () => void }) {
  const month = contributions?.monthLabel ?? "This month";
  const headline = !contributions ? "—"
    : !contributions.configured ? "No shared Fund yet"
      : contributions.members.length === 0 ? "Nothing confirmed yet" : personal ? "Mine to the shared Fund" : "Confirmed into the shared Fund";
  const value = (amount: number) => personal && amount === 0 ? "None confirmed yet" : engravedCents(amount);
  const label = `Contributions, ${month}. ${headline}.${contributions ? contributions.members.map(member => ` ${member.name}: ${value(member.amountCents)}${member.rhythm ? `, ${member.rhythm}` : ""}.`).join("") : ""}`;
  return <BookRow id="contributions" kicker={`Contributions · ${month}`} label={label} onOpen={onOpen}>
    <strong className="desk-book__headline">{headline}</strong>
    {contributions && contributions.members.length > 0 && <span className="desk-streams">
      {contributions.members.map(member => <span key={member.memberId} className="desk-streams__row" data-desk-stream={member.memberId}>
        <span className="desk-streams__name">{member.name}</span>
        <span className="desk-streams__figure">{value(member.amountCents)}</span>
        {member.rhythm && <span className="desk-streams__rhythm">{member.rhythm}</span>}
      </span>)}
    </span>}
    <span className="desk-card__line">{personal ? "Only your own confirmed sources. Your partner’s stay on the Shared desk." : "Each member’s own confirmed sources — a record, never a score."}</span>
  </BookRow>;
}

function Record({ record, onOpen }: { record: DeskRecord | null; onOpen: () => void }) {
  const headline = !record ? "—" : `${record.count} ${record.count === 1 ? "entry" : "entries"} in ${record.monthLabel}`;
  const last = record?.last ? `${record.last.label} · ${shortDate(record.last.date)} · ${engravedCents(record.last.amountCents)}` : null;
  const label = `Record. ${headline}.${last ? ` Last entry: ${last}.` : ""}`;
  return <BookRow id="record" kicker="Record · this month" label={label} onOpen={onOpen}>
    <strong className="desk-book__headline" data-desk-figure="record">{headline}</strong>
    <span className="desk-card__line desk-book__last">{last ? <>Last entry · <span className="desk-book__last-words">{last}</span></> : record ? "Nothing entered yet this month." : "—"}</span>
  </BookRow>;
}

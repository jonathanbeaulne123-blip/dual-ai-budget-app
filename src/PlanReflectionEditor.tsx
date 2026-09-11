import { useMemo, useState } from "react";
import {
  formatCad,
  markPlanReflectionReviewed,
  savePlanReflection,
  type CommitResult,
  type Household,
  type PlanOutcome,
  type PlanVersion,
} from "./core/index.ts";

export function PlanReflectionEditor({ household, version, memberId, busy, onCommand }: {
  household: Household;
  version: PlanVersion | null;
  memberId: string;
  busy: boolean;
  onCommand: (fn: (current: Household) => CommitResult) => Promise<unknown>;
}) {
  const reflection = version ? (household.planReflections ?? []).find((row) => row.planVersionId === version.id && (version.scope === "household" || row.ownerMemberId === memberId)) ?? null : null;
  const [draftOutcomes, setDraftOutcomes] = useState<Record<string, PlanOutcome>>({});
  const [note, setNote] = useState("");
  const outcomes = useMemo(() => Object.fromEntries((reflection?.outcomes ?? []).map((row) => [row.planLineId, row])), [reflection]);
  if (!version || !["active", "superseded"].includes(version.state)) return <section className="plan-editor plan-reflection-editor"><p className="kicker">Reflection</p><h3>Lock or acknowledge a Plan first</h3><p>Reflection compares an accepted intention with accepted evidence.</p></section>;
  const visibleTransactions = household.transactions.filter((transaction) => transaction.date.startsWith(version.monthKey)
    && (version.scope === "household" ? transaction.visibility !== "personal" : transaction.visibility === "personal" && transaction.createdBy === memberId));
  const valueFor = (lineId: string): PlanOutcome => draftOutcomes[lineId] ?? outcomes[lineId] ?? { planLineId: lineId, status: "not-relevant", actualCents: 0, transactionIds: [] };
  const setOutcome = (lineId: string, patch: Partial<PlanOutcome>) => setDraftOutcomes((current) => ({ ...current, [lineId]: { ...valueFor(lineId), ...patch } }));
  const planned = version.lines.reduce((sum, line) => sum + line.amountCents, 0);
  const actual = version.lines.reduce((sum, line) => sum + valueFor(line.id).transactionIds.reduce((lineSum, id) => lineSum + (visibleTransactions.find((transaction) => transaction.id === id)?.amountCents ?? 0), 0), 0);
  return <section className="plan-editor plan-reflection-editor" aria-labelledby="reflection-editor-title">
    <header><p className="kicker">Plan to actual</p><h3 id="reflection-editor-title">What happened, without grading the month</h3><div className="plan-reflection-totals"><span>Intended <strong>{formatCad(planned)}</strong></span><span>Linked actual <strong>{formatCad(actual)}</strong></span><span>Difference <strong>{formatCad(actual - planned)}</strong></span></div></header>
    {version.lines.map((line) => { const outcome = valueFor(line.id); const candidates = visibleTransactions.filter((transaction) => !version.lines.some((other) => other.id !== line.id && valueFor(other.id).transactionIds.includes(transaction.id))).slice(0, 8); return <article className="plan-reflection-line" key={line.id}><div><strong>{line.labelSnapshot}</strong><span>{formatCad(line.amountCents)} intended</span></div><label>What happened?<select value={outcome.status} onChange={(event) => setOutcome(line.id, { status: event.target.value as PlanOutcome["status"] })}><option value="paid">Paid</option><option value="moved">Moved</option><option value="missed">Missed</option><option value="deferred">Deferred</option><option value="not-relevant">Not relevant</option></select></label><fieldset><legend>Accepted evidence</legend>{candidates.length ? candidates.map((transaction) => <label key={transaction.id}><input type="checkbox" checked={outcome.transactionIds.includes(transaction.id)} onChange={(event) => setOutcome(line.id, { transactionIds: event.target.checked ? [...outcome.transactionIds, transaction.id] : outcome.transactionIds.filter((id) => id !== transaction.id) })} />{transaction.note || transaction.place || "Transaction"} · {formatCad(transaction.amountCents)}</label>) : <small>No accepted transactions in this month are available to link.</small>}</fieldset><label>What should we remember?<input value={outcome.note ?? ""} onChange={(event) => setOutcome(line.id, { note: event.target.value })} /></label></article>; })}
    <label>{version.scope === "household" ? "My note to our reflection" : "Private note"}<textarea value={note} onChange={(event) => setNote(event.target.value)} /></label>
    <div className="plan-editor-actions"><button disabled={busy} onClick={() => void onCommand((current) => savePlanReflection(current, { memberId, planVersionId: version.id, outcomes: version.lines.map((line) => valueFor(line.id)), note, ...(reflection?.updatedAt ? { expectedUpdatedAt: reflection.updatedAt } : {}), createdBy: memberId }))}>Save my review</button>{version.scope === "household" && reflection && !reflection.reviewedByMemberIds.includes(memberId) && <button disabled={busy} onClick={() => void onCommand((current) => markPlanReflectionReviewed(current, { reflectionId: reflection.id, expectedUpdatedAt: reflection.updatedAt, memberId, createdBy: memberId }))}>I reviewed the current reflection</button>}</div>
    {version.scope === "household" && <p className="plan-review-state">Reviewed independently by {reflection?.reviewedByMemberIds.map((id) => household.members.find((member) => member.id === id)?.name ?? id).join(" and ") || "no one yet"}. This never blocks the next Plan.</p>}
    {reflection?.memberNotes.length ? <div className="plan-member-notes">{reflection.memberNotes.map((item) => <blockquote key={item.memberId}><b>{household.members.find((member) => member.id === item.memberId)?.name ?? "Member"}</b>{item.text}</blockquote>)}</div> : null}
  </section>;
}

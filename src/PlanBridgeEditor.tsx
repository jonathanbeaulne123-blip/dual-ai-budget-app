import { useState } from "react";
import {
  addPlanBridgeToDraft,
  declinePlanBridge,
  formatCad,
  holdPlanBridge,
  savePlanBridgeDraft,
  sharePlanBridgeDraft,
  withdrawPlanBridge,
  type CommitResult,
  type Household,
  type MonthKey,
  type PlanDraft,
  type PlanLens,
  type PlanBridgeDraft,
} from "./core/index.ts";

export function PlanBridgeEditor({ household, memberId, month, householdDraft, busy, onCommand }: {
  household: Household;
  memberId: string;
  month: MonthKey;
  householdDraft: PlanDraft | null;
  busy: boolean;
  onCommand: (fn: (current: Household) => CommitResult) => Promise<unknown>;
}) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<PlanBridgeDraft["kind"]>("contribution");
  const [low, setLow] = useState("");
  const [high, setHigh] = useState("");
  const [date, setDate] = useState("");
  const [validation, setValidation] = useState("");
  const [reason, setReason] = useState("");
  const [lens, setLens] = useState<PlanLens>("everyday");
  const [editing, setEditing] = useState(false);
  const privateDraft = [...(household.planBridgeDrafts ?? [])]
    .filter((row) => row.ownerMemberId === memberId && row.monthKey === month)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
  const decisions = (household.planBridgeDecisions ?? []).filter((row) => row.monthKey === month);
  const active = decisions.filter((row) => ["proposed", "held"].includes(row.state));
  const included = decisions.filter((row) => row.state === "accepted");
  const history = decisions.filter((row) => ["declined", "withdrawn", "superseded"].includes(row.state));
  const savePrivate = (supersedesId?: string) => {
    const validMoney = (value: string) => !value.trim() || /^\d+(?:\.\d{1,2})?$/.test(value.trim());
    if (![amount, low, high].every(validMoney) || low && high && Number(low) > Number(high)) { setValidation("Review the CAD amount or range before saving."); return; }
    setValidation("");
    const amountCents = amount.trim() ? Math.round(Number(amount) * 100) : undefined;
    void onCommand((current) => savePlanBridgeDraft(current, { ...(editing && privateDraft ? { id: privateDraft.id, expectedUpdatedAt: privateDraft.updatedAt } : {}), monthKey: month, kind, label,
      ...(low.trim() ? { lowCents: Math.round(Number(low) * 100) } : {}), ...(high.trim() ? { highCents: Math.round(Number(high) * 100) } : {}), ...(date ? { expectedDate: date } : {}),
      ...(Number.isFinite(amountCents) ? { amountCents } : {}), ...(supersedesId ? { supersedesId } : privateDraft?.supersedesId ? { supersedesId: privateDraft.supersedesId } : {}), memberId, createdBy: memberId })).then(() => setEditing(false));
  };
  const cards = (rows: typeof decisions) => rows.map((row) => {
    const mine = row.offeredByMemberId === memberId;
    const inDraft = householdDraft?.lines.some((line) => line.sourceReference?.type === "bridge" && line.sourceReference.id === row.id);
    return <article className="plan-bridge-card" key={row.id}>
      <div><strong>{row.label}</strong><span>{row.amountCents !== undefined ? formatCad(row.amountCents) : row.lowCents !== undefined || row.highCents !== undefined ? `${formatCad(row.lowCents ?? 0)}–${row.highCents === undefined ? "open" : formatCad(row.highCents)}` : "No amount disclosed"}</span></div>
      <small>{row.kind.replaceAll("-", " ")} · {row.expectedDate ?? "No date disclosed"} · {row.state}{row.heldReason ? ` · ${row.heldReason}` : ""}{row.declineReason ? ` · ${row.declineReason}` : ""}</small>
      {["proposed", "held"].includes(row.state) && <div className="plan-editor-actions">
        {mine ? <button disabled={busy} onClick={() => void onCommand((current) => withdrawPlanBridge(current, { decisionId: row.id, memberId, createdBy: memberId }))}>Withdraw</button> : <>
          <button disabled={busy} onClick={() => void onCommand((current) => holdPlanBridge(current, { decisionId: row.id, reason, expectedUpdatedAt: row.updatedAt, memberId, createdBy: memberId }))}>Hold for Sitdown</button>
          <button disabled={busy || !reason.trim()} onClick={() => void onCommand((current) => declinePlanBridge(current, { decisionId: row.id, reason, expectedUpdatedAt: row.updatedAt, memberId, createdBy: memberId }))}>Decline and close</button>
        </>}
        {householdDraft && !inDraft && <button disabled={busy} onClick={() => void onCommand((current) => addPlanBridgeToDraft(current, { decisionId: row.id, draftId: householdDraft.id, lens, memberId, createdBy: memberId }))}>Add to my Household draft</button>}
        {inDraft && <span>In your private Household draft</span>}
      </div>}
      {row.state === "accepted" && mine && <button disabled={busy} onClick={() => void onCommand((current) => savePlanBridgeDraft(current, {
        monthKey: month, kind: row.kind, label: row.label, ...(row.amountCents !== undefined ? { amountCents: row.amountCents } : {}),
        ...(row.lowCents !== undefined ? { lowCents: row.lowCents } : {}), ...(row.highCents !== undefined ? { highCents: row.highCents } : {}),
        ...(row.expectedDate ? { expectedDate: row.expectedDate } : {}), supersedesId: row.id, memberId, createdBy: memberId,
      }))}>Prepare a replacement privately</button>}
    </article>;
  });
  return <section className="plan-editor plan-bridge-editor" aria-labelledby="bridge-editor-title">
    <header><p className="kicker">The Bridge</p><h3 id="bridge-editor-title">Share one fact, not the life behind it</h3><p>Accounts, balances, transactions and the rest of your Personal Plan remain private.</p></header>
    {privateDraft && !editing ? <section className="plan-disclosure-review"><strong>Exact disclosure review</strong><dl><div><dt>Shared wording</dt><dd>{privateDraft.label}</dd></div><div><dt>Shared kind / timing</dt><dd>{privateDraft.kind.replaceAll("-", " ")} · {privateDraft.expectedDate ?? "No date"}</dd></div><div><dt>Shared amount</dt><dd>{privateDraft.amountCents === undefined ? "No exact amount" : formatCad(privateDraft.amountCents)}{privateDraft.lowCents !== undefined || privateDraft.highCents !== undefined ? ` · range ${formatCad(privateDraft.lowCents ?? 0)}–${privateDraft.highCents === undefined ? "open" : formatCad(privateDraft.highCents)}` : ""}</dd></div><div><dt>Never shared</dt><dd>Source account, balance, transactions and private assumptions</dd></div></dl><div className="plan-editor-actions"><button disabled={busy} onClick={() => void onCommand((current) => sharePlanBridgeDraft(current, { draftId: privateDraft.id, expectedUpdatedAt: privateDraft.updatedAt, memberId, createdBy: memberId }))}>Share this exact proposal</button><button onClick={() => { setKind(privateDraft.kind); setLow(privateDraft.lowCents === undefined ? "" : String(privateDraft.lowCents / 100)); setHigh(privateDraft.highCents === undefined ? "" : String(privateDraft.highCents / 100)); setDate(privateDraft.expectedDate ?? ""); setLabel(privateDraft.label); setAmount(privateDraft.amountCents === undefined ? "" : String(privateDraft.amountCents / 100)); setEditing(true); }}>Edit privately</button></div></section> : <form onSubmit={(event) => { event.preventDefault(); savePrivate(); }}><label>What I choose to share<select value={kind} onChange={event => setKind(event.target.value as PlanBridgeDraft["kind"])}><option value="contribution">Contribution or range</option><option value="responsibility">Responsibility I can take</option><option value="constraint">Constraint to respect</option><option value="shared-goal">Shared goal</option><option value="fund-target">Fund target</option></select></label><label>One fact I may share<input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="I can contribute…" /></label><label>Amount, if useful<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><div className="plan-field-pair"><label>Lower amount, if useful<input inputMode="decimal" value={low} onChange={event => setLow(event.target.value)} /></label><label>Upper amount, if useful<input inputMode="decimal" value={high} onChange={event => setHigh(event.target.value)} /></label></div><label>Date I am offering<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label>{validation && <p role="alert">{validation}</p>}<button disabled={busy || !label.trim()}>Save privately and review</button>{editing && <button type="button" onClick={() => setEditing(false)}>Cancel edit</button>}</form>}
    {active.length > 0 && <><label>Reason for holding or declining<input value={reason} onChange={(event) => setReason(event.target.value)} /></label><label>Lens when adding to a draft<select value={lens} onChange={(event) => setLens(event.target.value as PlanLens)}><option value="protect">Protect</option><option value="prepare">Prepare</option><option value="build">Build</option><option value="everyday">Everyday</option></select></label><h4>Waiting for us</h4>{cards(active)}</>}
    {included.length > 0 && <><h4>Included in an acknowledged Plan</h4>{cards(included)}</>}
    {history.length > 0 && <details><summary>History</summary>{cards(history)}</details>}
  </section>;
}

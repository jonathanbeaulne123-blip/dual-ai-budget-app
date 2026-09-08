import { applyDuplicateReview } from "./core/duplicateReviewCommand.ts";
import { createPortal } from "react-dom";
import type { PendingPreview } from "./ledgerSync/optimistic.ts";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  formatCad,
  formatDateLabel,
  partitionLedger,
  accountName,
  categoryName,
  splitSummary,
  transactionsForHerculesSource,
  transactionTypeLabel,
  visibilityLabel,
  isVisibleInView,
  ledgerNameForView,
  duplicateContrastPairs,
  type CommitResult,
  type Household,
  type HerculesNumberSource,
  type LedgerSection,
  type LedgerView,
  type Transaction,
  type UndoToken,
} from "./core/index.ts";

import { ConfirmSheet } from "./Confirm.tsx";
import { DuplicatePrise } from "./DuplicatePrise.tsx";
import { prepareDuplicateReview, type DuplicateReview } from "./core/duplicateReview.ts";
import { useAsyncScope, type AsyncScopeToken } from "./asyncScope.ts";
export type DuplicateCommand = (command:(current:Household)=>CommitResult)=>Promise<{ok:boolean;userMessage?:string|null}|null>;

const SECTIONS: { id: LedgerSection; label: string }[] = [
  { id: "expenses", label: "Expenses" },
  { id: "income", label: "Income" },
  { id: "other", label: "Other" },
];

export function LedgerPage(props:LedgerProps) {
  return <LedgerSession key={JSON.stringify([props.household.environment,props.household.householdId,props.memberId,props.view,props.authorityGeneration??0])} {...props}/>;
}
type LedgerProps = {
  pendingRows?:PendingPreview[]; household:Household; writeHousehold?:Household; presentedTransactions?:boolean; memberId:string; view:LedgerView;
  sourceFocus:HerculesNumberSource|null; onClearSource:()=>void; onChange:(household:Household,undo?:UndoToken)=>void; onRemove:(transaction:Transaction)=>void;
  onDuplicateCommand?:DuplicateCommand; busy?:boolean; authorityGeneration?:number;
};
function LedgerSession({
  pendingRows = [],
  household,
  writeHousehold = household,
  presentedTransactions = false,
  memberId,
  view,
  sourceFocus,
  onClearSource,
  onRemove,
  onDuplicateCommand,
  busy=false,
  authorityGeneration=0,
}: LedgerProps) {
  const scope=useAsyncScope(JSON.stringify([household.environment,household.householdId,memberId,view,authorityGeneration]));
  const noticeRef=useRef<HTMLParagraphElement>(null),previousReview=useRef(false),lastTarget=useRef<string|null>(null);
  const [phone,setPhone]=useState(()=>window.innerWidth<720);
  useEffect(()=>{const resize=()=>setPhone(window.innerWidth<720);window.addEventListener("resize",resize);return()=>window.removeEventListener("resize",resize);},[]);
  const [review,setReview]=useState<{reading:Extract<DuplicateReview,{kind:"ready"}>;token:AsyncScopeToken}|null>(null);
  const [notice,setNotice]=useState(""),[pending,setPending]=useState(false),[failure,setFailure]=useState("");
  const openReview=(target:Transaction,comparisonIds:string[]=[])=>{
    if(busy||pending)return;
    if(!onDuplicateCommand){setNotice("The accepted ledger writer is unavailable. Review is read-only.");return;}
    const reading=prepareDuplicateReview(writeHousehold,{environment:household.environment,householdId:household.householdId,memberId,view,targetId:target.id,isDuplicate:!target.isDuplicate,comparisonIds});
    setFailure("");if(reading.kind==="unavailable"){setNotice(reading.reason);return;}setNotice("");lastTarget.current=target.id;setReview({reading,token:scope.capture()});
  };
  useEffect(()=>{
    if(previousReview.current&&!review){const token=scope.capture();queueMicrotask(()=>{if(!scope.isCurrent(token)||document.activeElement!==document.body)return;const row=[...document.querySelectorAll<HTMLElement>("[data-ledger-row-id]")].find(el=>el.dataset.ledgerRowId===lastTarget.current);const target=row?.querySelector<HTMLElement>("button:not([disabled])");(target??noticeRef.current)?.focus();});}
    previousReview.current=!!review;
  },[review]);
  const currentReview=review?prepareDuplicateReview(writeHousehold,review.reading.request):null;
  const stale=!!review&&(currentReview?.kind!=="ready"||currentReview.basis!==review.reading.basis);
  const confirm=async()=>{
    if(!review||pending||busy||!onDuplicateCommand)return;
    if(stale){setReview(null);setNotice("Entries changed. Review their current details again.");return;}
    const captured=review;setPending(true);setFailure("");
    try{const result=await onDuplicateCommand(current=>{if(!scope.isCurrent(captured.token))throw Error("The ledger view changed. Review again.");return applyDuplicateReview(current,captured.reading);});
      if(!scope.isCurrent(captured.token))return;
      if(result?.ok){setReview(null);setNotice(captured.reading.request.isDuplicate?"Entry excluded. The original remains in Books.":"Duplicate flag removed. Linked exclusions still apply.");}
      else setFailure(result?.userMessage||"The change was not accepted. Review the current entries before trying again.");
    }catch(error){if(scope.isCurrent(captured.token))setFailure(error instanceof Error?error.message:"The change was not accepted.");}
    finally{if(scope.isCurrent(captured.token))setPending(false);}
  };
  const [section, setSection] = useState<LedgerSection>("expenses");
  const [query, setQuery] = useState("");
  const [showContrast, setShowContrast] = useState(false);
  const [rowLimit, setRowLimit] = useState(50);
  const visible = useMemo(
    () => presentedTransactions
      ? household.transactions
      : household.transactions.filter((tx) => isVisibleInView(tx, memberId, view)),
    [household.transactions, memberId, view, presentedTransactions],
  );
  const sourceRows = useMemo(() => {
    return transactionsForHerculesSource(visible, sourceFocus);
  }, [sourceFocus, visible]);
  const grouped = useMemo(() => partitionLedger(sourceRows), [sourceRows]);
  const flagged = visible.filter((tx) => tx.potentialDuplicate && !tx.isDuplicate).length;
  // Pair scoring is review work; ordinary activity and every inbound posting
  // must not pay its quadratic cost while the review is closed.
  const contrasts = useMemo(() => showContrast ? duplicateContrastPairs(visible) : [], [visible, showContrast]);

  useEffect(() => setRowLimit(50), [query, section, sourceFocus, memberId, view]);

  useEffect(() => {
    if (!sourceFocus?.transactionId) return;
    const transaction = visible.find((tx) => tx.id === sourceFocus.transactionId);
    if (transaction?.type === "expense") setSection("expenses");
    else if (transaction?.type === "income") setSection("income");
    else if (transaction) setSection("other");
  }, [sourceFocus, visible]);

  const rows = grouped[section].filter((tx) => {
    if (!query.trim()) return true;
    const hay = `${tx.note} ${tx.place} ${categoryName(household, tx.subcategoryId)} ${accountName(household, tx.accountId)}`.toLowerCase();
    return hay.includes(query.trim().toLowerCase());
  });

  return (
    <>
      <p ref={noticeRef} className="muted" role="status" tabIndex={-1}>{notice}</p>
      {review&&createPortal(<ConfirmSheet className="duplicate-review-dialog" title={stale&&!pending?"Entries changed":`${review.reading.request.isDuplicate?"Exclude":"Include"} this entry?`}
        body={stale&&!pending?"Return to the entries and review their current details.":`${view==="household"?"Shared":"Personal view · Shared and your Personal entries"}\n${review.reading.target.note||transactionTypeLabel(review.reading.target.type)} · ${formatCad(review.reading.target.amountCents)} · ${formatDateLabel(review.reading.target.date)}\n${accountName(household,review.reading.target.accountId)}\nID ${review.reading.target.id}`}
        extra={stale&&!pending?failure:[review.reading.changes.length?`Eligibility for dated totals changes for ${review.reading.changes.length} ${review.reading.changes.length===1?"entry":"entries"}:\n${review.reading.changes.map(row=>`${row.date} · ${row.id} · ${row.willCount?"included":"excluded"}`).join("\n")}`:"No entry changes its eligibility for dated totals.",!review.reading.request.isDuplicate&&!review.reading.targetWillCount?"A linked exclusion still keeps this entry out of totals.":"", "Only this entry’s duplicate flag changes. Original entries stay in Books.",failure].filter(Boolean).join("\n\n")}
        confirmLabel={pending?"Saving…":stale?"Return to entries":`Confirm ${review.reading.request.isDuplicate?"exclusion":"inclusion"}`} danger={review.reading.request.isDuplicate&&!stale} busy={pending||busy} onCancel={()=>setReview(null)} onConfirm={()=>void confirm()}/>,document.body)}
      <section className="hero">
        <div className="label">{ledgerNameForView(household, memberId, view)}</div>
        <div className="money" style={{ fontSize: 36 }}>{rows.length}</div>
        <div className="sub">
          {grouped.expenses.length} expenses · {grouped.income.length} income · {grouped.other.length} transfers/refunds
        </div>
      </section>
      {flagged > 0 && (
        <article className="pulse" style={{ marginTop: 0 }}>
          <article className="warn">
            {flagged} {flagged === 1 ? "row looks" : "rows look"} like a repeat. Review the pairs before excluding an entry.
            {" "}
            <button type="button" className="chip" aria-expanded={showContrast} onClick={() => setShowContrast((value) => !value)}>
              {showContrast ? "Close review" : "Review possible repeats"}
            </button>
          </article>
        </article>
      )}
      {showContrast && contrasts.length > 0 && (
        <section className="card duplicate-contrast">
          <header>
            <h2>Duplicate contrast</h2>
            <span className="muted">{contrasts.length} pair{contrasts.length === 1 ? "" : "s"} · similarity signal first</span>
          </header>
          {contrasts.slice(0, 12).map((pair) => phone ? <DuplicatePrise key={JSON.stringify([pair.left,pair.right])} household={household} {...pair} busy={busy||pending} onReview={target=>openReview(target,[pair.left.id,pair.right.id])}/> : (
            <article key={`${pair.left.id}-${pair.right.id}`} className="contrast-pair">
              <div className="confidence">
                Similarity {pair.confidence}/100
              </div>
              <div className="contrast-cols">
                <ContrastSide household={household} tx={pair.left} />
                <ContrastSide household={household} tx={pair.right} />
              </div>
              <p className="muted">{pair.reasons.join(" · ")}</p>
              <div className="row-actions">
                <button
                  type="button"
                  className="chip"
                  disabled={busy||pending} onClick={() => openReview(pair.left,[pair.left.id,pair.right.id])}
                >
                  Exclude left
                </button>
                <button
                  type="button"
                  className="chip"
                  disabled={busy||pending} onClick={() => openReview(pair.right,[pair.left.id,pair.right.id])}
                >
                  Exclude right
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
      {sourceFocus && (
        <p className="muted">
          Hercules opened: <strong>{sourceFocus.label}</strong>{" "}
          <button type="button" className="chip" onClick={onClearSource}>Show all activity</button>
        </p>
      )}
      <div className="tabs">
        {SECTIONS.map((item) => (
          <button key={item.id} className={section === item.id ? "active" : ""} onClick={() => setSection(item.id)}>
            {item.label}
            <span className="muted"> {grouped[item.id].length}</span>
          </button>
        ))}
      </div>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search notes, place, category…" />
      {section === "other" && (
        <p className="muted">Transfers move money between accounts. Refunds undo spend. Neither is ordinary income.</p>
      )}
      {pendingRows.some(preview => preview.rows.some(tx => isVisibleInView(tx, memberId, view))) && (
        <section className="card" aria-label="Pending entries">
          <p className="muted">Pending · awaiting confirmation. Posted balances update when saved.</p>
          {pendingRows.flatMap(preview => partitionLedger(transactionsForHerculesSource(preview.rows.filter(tx => isVisibleInView(tx, memberId, view)), sourceFocus))[section]
            .filter(tx => !query.trim() || `${tx.note} ${tx.place} ${categoryName(household, tx.subcategoryId)} ${accountName(household, tx.accountId)}`.toLowerCase().includes(query.trim().toLowerCase()))
            .map(tx => <div className="ledger-row" key={`${preview.commandId}:${tx.id}`} data-ledger-row-id={tx.id} data-command-id={preview.commandId} data-ledger-phase="pending">
              <div><strong>{tx.note || transactionTypeLabel(tx.type)}</strong><div className="muted">{formatDateLabel(tx.date)} · Pending</div></div>
              <strong>{formatCad(tx.amountCents)}</strong>
            </div>))}
        </section>
      )}
      <section className="card">
        {rows.length === 0 ? <p className="muted">Nothing in this list yet.</p> : rows.slice(0, rowLimit).map((tx) => (
          <LedgerRow
            key={tx.id}
            household={household}
            transaction={tx}
            duplicateBusy={busy||pending}
            onToggleDuplicate={() => openReview(tx)}
            onRemove={() => onRemove(tx)}
          />
        ))}
        {rows.length > rowLimit && (
          <button type="button" className="chip" onClick={() => setRowLimit((limit) => limit + 50)}>
            Show {Math.min(50, rows.length - rowLimit)} more · {rowLimit} of {rows.length}
          </button>
        )}
      </section>
    </>
  );
}

function ContrastSide({ household, tx }: { household: Household; tx: Transaction }) {
  return (
    <div className="contrast-side">
      <strong>{formatCad(tx.amountCents)}</strong>
      <span>{formatDateLabel(tx.date)}</span>
      <span>{tx.note || transactionTypeLabel(tx.type)}</span>
      <span className="muted">{tx.place || "—"} · {categoryName(household, tx.subcategoryId)}</span>
      <span className="muted">{accountName(household, tx.accountId)}</span>
    </div>
  );
}

function LedgerRow({
  household,
  transaction,
  onToggleDuplicate,
  duplicateBusy,
  onRemove,
}: {
  household: Household;
  transaction: Transaction;
  onToggleDuplicate: () => void;
  duplicateBusy:boolean;
  onRemove: () => void;
}) {
  const pair = transaction.transferPairId
    ? household.transactions.find((item) => item.id === transaction.transferPairId)
    : undefined;
  return (
    <div className="ledger-row" data-ledger-row-id={transaction.id}>
      <div>
        <strong>{transaction.note || transactionTypeLabel(transaction.type)}</strong>
        <div className="muted">
          {formatDateLabel(transaction.date)}
          {transaction.place ? ` · ${transaction.place}` : ""}
          {" · "}
          {transaction.type === "transfer"
            ? `${accountName(household, transaction.accountId)}${pair ? ` ↔ ${accountName(household, pair.accountId)}` : ""}`
            : categoryName(household, transaction.subcategoryId)}
          {" · "}
          {visibilityLabel(transaction.visibility)}
          {" · "}
          {splitSummary(household, transaction)}
        </div>
        {(transaction.potentialDuplicate||transaction.isDuplicate) && (
          <div className="muted">{transaction.isDuplicate ? "Excluded from totals" : "Looks like a repeat"}</div>
        )}
      </div>
      <div className="right">
        <div>{formatCad(transaction.amountCents)}</div>
        {(transaction.potentialDuplicate||transaction.isDuplicate) && (
          <button className="chip" disabled={duplicateBusy} onClick={onToggleDuplicate}>{transaction.isDuplicate ? "Include" : "Exclude"}</button>
        )}
        <button className="chip" onClick={onRemove}>Reverse</button>
      </div>
    </div>
  );
}

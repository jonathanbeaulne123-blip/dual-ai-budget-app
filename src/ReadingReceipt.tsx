import type { ReadingReceipt as Receipt } from "./readingReceipt.ts";

export function ReadingReceipt({ receipt, onClose }: { receipt: Receipt; onClose: () => void }) {
  return <div className="reading-receipt" role="region" aria-label="Entry source">
    {receipt.kind === "unavailable" ? <p>{receipt.reason}</p> : <>
      <p className="reading-receipt-heading">{receipt.view === "household" ? "Shared" : "Personal"} · Books revision {receipt.revision}</p>
      <dl>
        <dt>Date</dt><dd>{receipt.date}</dd>
        <dt>Entry</dt><dd>{receipt.transactionId}</dd>
        <dt>Recorded source</dt><dd>{receipt.source}{receipt.sourceId ? ` · ${receipt.sourceId}` : " · reference not recorded"}</dd>
        <dt>Journal</dt><dd>{receipt.journalId}</dd>
        <dt>In journal totals</dt><dd>{receipt.recognized ? "Eligible" : "Excluded"}</dd>
      </dl>
      {receipt.reversalOfId && <p>Reverses entry {receipt.reversalOfId}.</p>}
      {receipt.reversedByIds.length > 0 && <p>Reversal entries recorded: {receipt.reversedByIds.join(", ")}. Review their subsequent history in Books.</p>}
    </>}
    <button type="button" className="chip" onClick={onClose}>Close source</button>
  </div>;
}

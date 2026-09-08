import { useEffect, useMemo, useState } from "react";
import { apronReceipt, type ApronReceipt } from "./core/apronReceipt.ts";
import { householdAsk } from "./core/ask.ts";
import { formatCad } from "./core/money.ts";
import type { Household } from "./core/types.ts";
import "./apron-card.css";

export function useApronReceipt(household: Household, memberId: string) {
  const [now, setNow] = useState(Date.now);
  const receipt = useMemo(() => apronReceipt(household, memberId, now), [household, memberId, now]);
  useEffect(() => { setNow(Date.now()); }, [household, memberId]);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const wake = () => { if (document.visibilityState === "visible") refresh(); };
    const timer = receipt ? window.setTimeout(refresh, Math.max(0, receipt.expiresAt - Date.now())) : undefined;
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("pageshow", refresh);
    return () => { window.clearTimeout(timer); document.removeEventListener("visibilitychange", wake); window.removeEventListener("pageshow", refresh); };
  }, [receipt?.id, receipt?.expiresAt]);
  return receipt;
}

/** Historical receipt and current Shared Ask are distinct readings, never a before/after. */
export function ApronCard({ receipt, household, today }: { receipt: ApronReceipt; household: Household; today: string }) {
  const ask = useMemo(() => household.householdFund ? householdAsk(household, today) : null, [household, today]);
  return <section className="apron-card" aria-label="Your posted shift receipt" data-apron-shift={receipt.shiftId}>
    <div className="apron-header">Your shift · <time dateTime={receipt.date}>{receipt.date}</time></div>
    <h2>Shift posted.</h2>
    <dl className="apron-facts">
      <div><dt>Worked hours</dt><dd>{receipt.hours.toLocaleString("en-CA", { maximumFractionDigits: 2 })}</dd></div>
      <div><dt>Cash tips</dt><dd>{formatCad(receipt.cashCents)}</dd></div>
      <div><dt>Card tips</dt><dd>{formatCad(receipt.cardCents)}</dd></div>
      <div><dt>Tip-out</dt><dd>{formatCad(receipt.tipOutCents)}</dd></div>
    </dl>
    <p className="apron-timing">{receipt.timing ? receipt.cardCents < 0 ? "At posting: cash received; withholding exceeded card tips." : "At posting: cash received; card owed after withholding." : "Cash and card recorded; receipt timing was not recorded."}</p>
    {receipt.timing && receipt.tipOutCents > 0 ? <p className="apron-timing">Tip-out: {formatCad(receipt.timing.immediateCents)} paid from cash · {formatCad(receipt.timing.withheldCents)} withheld · {formatCad(receipt.timing.deferredCents)} deferred.</p> : null}
    <p className="apron-ask"><span>Current Shared Ask</span><strong>{ask?.register.tiesToProjection ? formatCad(ask.askCents) : "Not available"}</strong></p>
  </section>;
}

import { useMemo, useState } from "react";
import {
  ACCOUNT_KIND_LABEL,
  buildOpeningTruthDraft,
  formatCad,
  openingEligibleAccounts,
  openingTruthReviewSummary,
  type Household,
  type OpeningLineInput,
  type OpeningTruthDraft,
} from "./core/index.ts";
import { useDialog } from "./useDialog.ts";

export type OpeningTruthSheetProps = {
  household: Household;
  memberId: string;
  today: string;
  busy?: boolean;
  onClose: () => void;
  onAskConfirm: (draft: OpeningTruthDraft, summary: string, confirmationId: string) => void;
};

/**
 * Phone: short enter → review. Wide: denser account table before Confirm.
 * Never posts — Confirm goes through App guard → postOpeningBalances.
 */
export function OpeningTruthSheet({
  household,
  memberId,
  today,
  busy,
  onClose,
  onAskConfirm,
}: OpeningTruthSheetProps) {
  const dialog = useDialog(true, onClose);
  const accounts = useMemo(() => openingEligibleAccounts(household, memberId), [household, memberId]);
  const [asOfDate, setAsOfDate] = useState(today);
  const [amounts, setAmounts] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const account of accounts) initial[account.id] = "";
    return initial;
  });
  const [step, setStep] = useState<"enter" | "review">("enter");
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<OpeningTruthDraft | null>(null);

  function centsFromField(raw: string): number {
    const trimmed = raw.trim();
    if (!trimmed) return 0;
    const n = Number(trimmed.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.round(n * 100);
  }

  function buildLines(): OpeningLineInput[] {
    return accounts.map((account) => ({
      accountId: account.id,
      amountCents: centsFromField(amounts[account.id] ?? ""),
    }));
  }

  function goReview() {
    try {
      const next = buildOpeningTruthDraft(household, {
        asOfDate,
        createdBy: memberId,
        lines: buildLines(),
      });
      setDraft(next);
      setError("");
      setStep("review");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  function askConfirm() {
    if (!draft) return;
    const confirmationId = `opening-${draft.asOfDate}-${memberId}-${draft.lines.map((l) => `${l.accountId}:${l.amountCents}`).join("|")}`;
    onAskConfirm(draft, openingTruthReviewSummary(draft), confirmationId);
  }

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Opening truth" ref={dialog}>
      <div className="sheet-inner opening-truth-sheet">
        <header className="sheet-topbar">
          <button type="button" className="ghost" data-autofocus onClick={onClose} disabled={busy}>
            Close
          </button>
          <h2>Opening truth</h2>
          <span className="muted">Balance sheet only</span>
        </header>

        <p className="muted">
          Tell Hearth what is actually in each account on one Toronto date. Opening equity balances the books.
          This is not income or spend.
        </p>

        {step === "enter" && (
          <>
            <label className="opening-truth-date">
              As of (Toronto)
              <input
                type="date"
                value={asOfDate}
                onChange={(event) => setAsOfDate(event.target.value)}
                disabled={busy}
              />
            </label>

            <div className="opening-truth-accounts">
              {accounts.length === 0 ? (
                <p className="muted">Add an account first, then return here.</p>
              ) : (
                accounts.map((account) => (
                  <label key={account.id} className="opening-truth-row">
                    <span>
                      <strong>{account.name}</strong>
                      <span className="muted">
                        {" "}
                        · {ACCOUNT_KIND_LABEL[account.kind]}
                        {account.ownerMemberId === "joint" ? " · shared" : " · personal"}
                      </span>
                    </span>
                    <input
                      inputMode="decimal"
                      placeholder="0.00"
                      value={amounts[account.id] ?? ""}
                      onChange={(event) =>
                        setAmounts((current) => ({ ...current, [account.id]: event.target.value }))
                      }
                      disabled={busy}
                      aria-label={`Opening amount for ${account.name}`}
                    />
                  </label>
                ))
              )}
            </div>

            {error && (
              <p className="danger" role="alert">
                {error}
              </p>
            )}

            <footer className="opening-truth-footer">
              <button type="button" className="ghost" onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button type="button" onClick={goReview} disabled={busy || accounts.length === 0}>
                Review
              </button>
            </footer>
          </>
        )}

        {step === "review" && draft && (
          <>
            <section className="card">
              <header>
                <h3>Review as of {draft.asOfDate}</h3>
              </header>
              <ul className="opening-truth-review">
                {draft.lines.map((line) => (
                  <li key={line.accountId} className="row">
                    <span>
                      {line.accountName}
                      <span className="muted"> · {ACCOUNT_KIND_LABEL[line.kind]}</span>
                    </span>
                    <span>{formatCad(line.amountCents)}</span>
                  </li>
                ))}
              </ul>
              <div className="row">
                <span>Assets</span>
                <span>{formatCad(draft.assetCents)}</span>
              </div>
              <div className="row">
                <span>Debts</span>
                <span>{formatCad(draft.liabilityCents)}</span>
              </div>
              <div className="row">
                <strong>Opening equity</strong>
                <strong>
                  {formatCad(Math.abs(draft.openingEquityCents))}
                  {draft.openingEquityCents < 0 ? " debit" : draft.openingEquityCents > 0 ? " credit" : ""}
                </strong>
              </div>
            </section>

            <p className="muted">{openingTruthReviewSummary(draft)}</p>

            <footer className="opening-truth-footer">
              <button type="button" className="ghost" onClick={() => setStep("enter")} disabled={busy}>
                Back
              </button>
              <button type="button" onClick={askConfirm} disabled={busy}>
                Confirm opening truth
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}

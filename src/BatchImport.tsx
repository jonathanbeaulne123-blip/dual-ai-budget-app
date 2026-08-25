import { useEffect, useMemo, useRef, useState } from "react";
import {
  accountName,
  buildBatchImport,
  categoryName,
  formatCad,
  parseOfx,
  prepareImportRows,
  refreshImportTriage,
  visionDocumentRows,
  type DuplicateTier,
  type Household,
  type ImportReviewRow,
  type LedgerView,
  type Transaction,
  type UndoToken,
} from "./core/index.ts";
import { ConfirmSheet } from "./Confirm.tsx";
import { scanFinancialDocument } from "./imports/documentScanner.ts";
import { useDialog } from "./useDialog.ts";

const TABS: Array<{ id: DuplicateTier; label: string; hint: string }> = [
  { id: "confident", label: "Confident", hint: "Over 90% · imported row starts cancelled" },
  { id: "not-sure", label: "Not sure", hint: "50–90% · you must choose" },
  { id: "probably-not", label: "Probably not a duplicate", hint: "Under 50% · imported row stays kept" },
];

const FINAL_CONFIRM_FOCUS = "__final-confirm__";

function needsTransactionDetails(row: ImportReviewRow): boolean {
  if (row.resolution === "cancel-import") return false;
  return row.type === "unknown" || !row.accountId || row.currency !== "CAD"
    || (row.type === "transfer" ? !row.transferAccountId || row.transferAccountId === row.accountId : !row.subcategoryId);
}

function needsHumanAttention(row: ImportReviewRow): boolean {
  return row.resolution === "undecided" || needsTransactionDetails(row);
}

function nextAttentionId(rows: ImportReviewRow[], afterId: string): string | null {
  if (!rows.length) return null;
  const found = rows.findIndex((row) => row.id === afterId);
  const start = found >= 0 ? found : -1;
  for (let offset = 1; offset <= rows.length; offset += 1) {
    const candidate = rows[(start + offset) % rows.length];
    if (candidate && needsHumanAttention(candidate)) return candidate.id;
  }
  return null;
}

async function readBankFile(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  const header = utf8.slice(0, 1200);
  if (/CHARSET\s*:\s*(?:1252|WINDOWS-1252)/i.test(header)) return new TextDecoder("windows-1252").decode(bytes);
  return utf8;
}

export function BatchImportCard({
  household,
  memberId,
  view,
  onCommit,
}: {
  household: Household;
  memberId: string;
  view: LedgerView;
  onCommit: (household: Household, undo: UndoToken) => unknown | Promise<unknown>;
}) {
  const bankInput = useRef<HTMLInputElement | null>(null);
  const cameraInput = useRef<HTMLInputElement | null>(null);
  const uploadInput = useRef<HTMLInputElement | null>(null);
  const [rows, setRows] = useState<ImportReviewRow[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [tier, setTier] = useState<DuplicateTier>("confident");
  const [working, setWorking] = useState(false);
  const [finalConfirm, setFinalConfirm] = useState(false);
  const [focusRequestId, setFocusRequestId] = useState<string | null>(null);
  const [focusRequestNonce, setFocusRequestNonce] = useState(0);
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const finalConfirmButton = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useDialog(open && !finalConfirm, () => setOpen(false));
  const visible = useMemo(() => rows.filter((row) => row.duplicateTier === tier), [rows, tier]);
  const unresolved = rows.filter((row) => row.resolution === "undecided").length;
  const kept = rows.filter((row) => row.resolution === "keep-import" || row.resolution === "exclude-ledger").length;
  const cancelled = rows.filter((row) => row.resolution === "cancel-import").length;
  const incomplete = rows.filter(needsTransactionDetails).length;
  const focusRequestRow = focusRequestId && focusRequestId !== FINAL_CONFIRM_FOCUS
    ? rows.find((row) => row.id === focusRequestId)
    : null;
  const focusRequestTier = focusRequestRow?.duplicateTier ?? null;
  const focusRequestNeedsAttention = focusRequestRow ? needsHumanAttention(focusRequestRow) : false;

  useEffect(() => {
    if (!open || !focusRequestId) return;
    if (focusRequestId === FINAL_CONFIRM_FOCUS) {
      const timeout = window.setTimeout(() => finalConfirmButton.current?.focus(), 0);
      return () => window.clearTimeout(timeout);
    }
    const target = rows.find((row) => row.id === focusRequestId);
    if (!target || !focusRequestNeedsAttention) {
      setFocusRequestId(nextAttentionId(rows, focusRequestId) ?? FINAL_CONFIRM_FOCUS);
      return;
    }
    if (tier !== target.duplicateTier) {
      setTier(target.duplicateTier);
      return;
    }
    const timeout = window.setTimeout(() => {
      const element = rowRefs.current.get(target.id);
      element?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      element?.focus();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [focusRequestId, focusRequestNeedsAttention, focusRequestNonce, focusRequestTier, open, tier]);

  function beginAttention(preferred: (row: ImportReviewRow) => boolean) {
    const target = rows.find((row) => preferred(row) && needsHumanAttention(row))
      ?? rows.find(needsHumanAttention);
    setFocusRequestId(target?.id ?? FINAL_CONFIRM_FOCUS);
    setFocusRequestNonce((current) => current + 1);
  }

  function replaceRows(sourceRows: Parameters<typeof prepareImportRows>[0]["rows"], nextWarnings: string[]) {
    const prepared = prepareImportRows({ household, memberId, view, rows: sourceRows });
    setRows(prepared);
    setWarnings(nextWarnings.filter(Boolean));
    setFocusRequestId(null);
    setTier(prepared.some((row) => row.duplicateTier === "confident") ? "confident"
      : prepared.some((row) => row.duplicateTier === "not-sure") ? "not-sure" : "probably-not");
    setError("");
    setOpen(true);
  }

  async function importBankFiles(files: FileList | null) {
    if (!files?.length) return;
    setWorking(true);
    setError("");
    try {
      const sourceRows: Parameters<typeof prepareImportRows>[0]["rows"] = [];
      const nextWarnings: string[] = [];
      for (const file of [...files]) {
        if (!/\.(?:ofx|qfx)$/i.test(file.name)) throw new Error(`${file.name} is not an OFX or QFX export.`);
        const parsed = parseOfx(await readBankFile(file), file.name);
        sourceRows.push(...parsed.rows);
        nextWarnings.push(...parsed.warnings);
      }
      replaceRows(sourceRows, nextWarnings);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setWorking(false);
      if (bankInput.current) bankInput.current.value = "";
    }
  }

  async function importImages(files: FileList | null, input: HTMLInputElement | null) {
    if (!files?.length) return;
    setWorking(true);
    setError("");
    try {
      const sourceRows: Parameters<typeof prepareImportRows>[0]["rows"] = [];
      const nextWarnings: string[] = [];
      for (const file of [...files]) {
        const scanned = await scanFinancialDocument(file);
        const normalized = visionDocumentRows({ result: scanned.result, sourceName: file.name, sourceHash: scanned.sourceHash });
        sourceRows.push(...normalized.rows);
        nextWarnings.push(...normalized.warnings);
      }
      replaceRows(sourceRows, nextWarnings);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setWorking(false);
      if (input) input.value = "";
    }
  }

  function updateRow(id: string, patch: Partial<ImportReviewRow>) {
    setRows((current) => {
      const next = refreshImportTriage({
        household,
        memberId,
        view,
        rows: current.map((row) => row.id === id ? { ...row, ...patch } : row),
      });
      return next;
    });
  }

  function decide(id: string, resolution: ImportReviewRow["resolution"]) {
    setRows((current) => {
      const next = current.map((row) => row.id === id
        ? { ...row, resolution, resolutionTouched: true }
        : row);
      return next;
    });
  }

  function keepThisCancelBatchMatch(row: ImportReviewRow) {
    if (row.duplicateMatch?.kind !== "batch") return;
    const matchedRowId = row.duplicateMatch.rowId;
    setRows((current) => {
      const next = current.map((candidate) => {
        if (candidate.id === row.id) return { ...candidate, resolution: "keep-import" as const, resolutionTouched: true };
        if (candidate.id === matchedRowId) return { ...candidate, resolution: "cancel-import" as const, resolutionTouched: true };
        return candidate;
      });
      return next;
    });
  }

  async function confirmBatch() {
    setWorking(true);
    setError("");
    try {
      const result = buildBatchImport({ household, memberId, rows });
      const outcome = await onCommit(result.household, result.undo);
      if (outcome === null) throw new Error("The books did not accept this batch. The staged review is still open.");
      if (outcome && typeof outcome === "object" && "ok" in outcome && outcome.ok === false) {
        throw new Error("The books rejected this batch. The staged review is still open.");
      }
      setRows([]);
      setWarnings([]);
      setFinalConfirm(false);
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setFinalConfirm(false);
      setOpen(true);
    } finally {
      setWorking(false);
    }
  }

  return (
    <>
      <section className="card import-launcher">
        <header>
          <h2>Batch import</h2>
          <span className="pill">Inbox → duplicate review → Confirm</span>
        </header>
        <p className="muted">
          Bank exports are parsed on this device. A photo is sent for detection only after you take or choose it; the image is not saved in the household.
        </p>
        <div className="import-actions">
          <button type="button" className="primary" disabled={working} onClick={() => bankInput.current?.click()}>
            Import QFX / OFX
          </button>
          <button type="button" className="chip" disabled={working} onClick={() => cameraInput.current?.click()}>
            Take document photo
          </button>
          <button type="button" className="chip" disabled={working} onClick={() => uploadInput.current?.click()}>
            Choose receipt / bill / statement
          </button>
        </div>
        <input ref={bankInput} hidden type="file" multiple accept=".ofx,.qfx,application/x-ofx" onChange={(event) => void importBankFiles(event.target.files)} />
        <input ref={cameraInput} hidden type="file" multiple accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => void importImages(event.target.files, event.target)} />
        <input ref={uploadInput} hidden type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => void importImages(event.target.files, event.target)} />
        {working && <p role="status">Reading and checking duplicates…</p>}
        {error && !open && <p className="danger" role="alert">{error}</p>}
      </section>

      {open && !finalConfirm && (
        <div className="sheet import-review" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="import-review-title">
          <div className="sheet-inner">
            <div className="topbar">
              <div>
                <p className="kicker">Batch inbox</p>
                <h1 id="import-review-title">Duplicate check</h1>
              </div>
              <button type="button" className="ghost" onClick={() => setOpen(false)} disabled={working}>Close</button>
            </div>
            <p className="import-review-summary">
              {rows.length} imported row{rows.length === 1 ? "" : "s"} · {kept} kept · {cancelled} cancelled ·{" "}
              {unresolved ? (
                <button type="button" className="import-attention-link" onClick={() => beginAttention((row) => row.resolution === "undecided")}>
                  {unresolved} transaction{unresolved === 1 ? "" : "s"} need{unresolved === 1 ? "s" : ""} a duplicate decision
                </button>
              ) : "0 need a duplicate decision"}
              {" · "}
              {incomplete ? (
                <button type="button" className="import-attention-link" onClick={() => beginAttention(needsTransactionDetails)}>
                  {incomplete} transaction{incomplete === 1 ? "" : "s"} need{incomplete === 1 ? "s" : ""} details
                </button>
              ) : "0 need transaction details"}
            </p>
            <div className="tabs import-tabs" role="tablist" aria-label="Duplicate confidence">
              {TABS.map((item) => {
                const count = rows.filter((row) => row.duplicateTier === item.id).length;
                return (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tier === item.id}
                    className={tier === item.id ? "active" : ""}
                    key={item.id}
                    onClick={() => setTier(item.id)}
                  >
                    {item.label} <span className="muted">{count}</span>
                  </button>
                );
              })}
            </div>
            <p className="muted">{TABS.find((item) => item.id === tier)?.hint}</p>
            {warnings.map((warning) => <p className="warn" key={warning}>{warning}</p>)}
            {error && <p className="danger" role="alert">{error}</p>}
            <section className="import-review-list">
              {visible.length ? visible.map((row) => (
                <ImportReviewItem
                  key={row.id}
                  household={household}
                  row={row}
                  allRows={rows}
                  attention={focusRequestId === row.id}
                  setAttentionRef={(element) => {
                    if (element) rowRefs.current.set(row.id, element);
                    else rowRefs.current.delete(row.id);
                  }}
                  onUpdate={(patch) => updateRow(row.id, patch)}
                  onDecide={(resolution) => decide(row.id, resolution)}
                  onKeepThisCancelOther={() => keepThisCancelBatchMatch(row)}
                />
              )) : <p className="muted">Nothing landed in this confidence group.</p>}
            </section>
            <div className="import-footer">
              <button type="button" className="ghost" onClick={() => setOpen(false)}>Close review</button>
              <button
                ref={finalConfirmButton}
                type="button"
                className="primary"
                disabled={working || unresolved > 0 || incomplete > 0 || kept === 0}
                onClick={() => setFinalConfirm(true)}
              >
                Review final Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {finalConfirm && (
        <ConfirmSheet
          title="Confirm batch import?"
          body={`${kept} imported row${kept === 1 ? "" : "s"} will enter the real books. ${cancelled} cancelled import${cancelled === 1 ? " stays" : "s stay"} out. Existing rows you chose are excluded, not erased.`}
          extra="The whole batch crosses the same validated PGlite and cloud-continuity boundary as an ordinary Confirm. Cancel changes nothing."
          confirmLabel={`Confirm ${kept} import${kept === 1 ? "" : "s"}`}
          busy={working}
          onCancel={() => setFinalConfirm(false)}
          onConfirm={() => void confirmBatch()}
        />
      )}
    </>
  );
}

function ImportReviewItem({
  household,
  row,
  allRows,
  attention,
  setAttentionRef,
  onUpdate,
  onDecide,
  onKeepThisCancelOther,
}: {
  household: Household;
  row: ImportReviewRow;
  allRows: ImportReviewRow[];
  attention: boolean;
  setAttentionRef: (element: HTMLElement | null) => void;
  onUpdate: (patch: Partial<ImportReviewRow>) => void;
  onDecide: (resolution: ImportReviewRow["resolution"]) => void;
  onKeepThisCancelOther: () => void;
}) {
  const ledgerMatchId = row.duplicateMatch?.kind === "ledger" ? row.duplicateMatch.transactionId : null;
  const batchMatchId = row.duplicateMatch?.kind === "batch" ? row.duplicateMatch.rowId : null;
  const ledgerMatch = ledgerMatchId
    ? household.transactions.find((transaction) => transaction.id === ledgerMatchId) ?? null
    : null;
  const batchMatch = batchMatchId
    ? allRows.find((candidate) => candidate.id === batchMatchId) ?? null
    : null;
  const categories = household.categories.filter((category) => (
    category.active && category.recordType === "category"
    && category.transactionType === (row.type === "income" ? "income" : "expense")
  ));

  return (
    <article
      ref={setAttentionRef}
      tabIndex={-1}
      className={`import-pair import-pair--${row.resolution}${attention ? " import-pair--attention" : ""}`}
      aria-label={`${row.note || row.sourceName} import review`}
    >
      <header>
        <span className={`confidence useful-${row.duplicateConfidence > 90 ? "green" : row.duplicateConfidence >= 50 ? "yellow" : "red"}`}>
          {row.duplicateConfidence}%
        </span>
        <div>
          <strong>{row.sourceName}</strong>
          <p className="muted">{row.duplicateReasons.join(" · ")}</p>
        </div>
        <span className="pill">{resolutionLabel(row.resolution)}</span>
      </header>
      <div className="contrast-cols">
        <div className="contrast-side import-edit-side">
          <strong>Imported</strong>
          <label>Date<input type="date" value={row.date} onChange={(event) => onUpdate({ date: event.target.value as ImportReviewRow["date"] })} /></label>
          <label>Amount<input inputMode="decimal" value={(row.amountCents / 100).toFixed(2)} onChange={(event) => {
            const amountCents = Math.round((Number(event.target.value) || 0) * 100);
            onUpdate({ amountCents, signedAmountCents: row.signedAmountCents < 0 ? -amountCents : amountCents });
          }} /></label>
          <label>Type
            <select value={row.type} onChange={(event) => onUpdate({ type: event.target.value as ImportReviewRow["type"], subcategoryId: "", transferAccountId: "" })}>
              <option value="unknown">Choose…</option><option value="expense">Expense</option><option value="income">Income</option><option value="refund">Refund</option><option value="transfer">Transfer</option>
            </select>
          </label>
          <label>Account
            <select value={row.accountId} onChange={(event) => onUpdate({ accountId: event.target.value })}>
              <option value="">Choose…</option>{household.accounts.filter((account) => account.active).map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}
            </select>
          </label>
          {row.type === "transfer" ? (
            <>
              <label>Movement
                <select
                  value={row.signedAmountCents < 0 ? "out" : "in"}
                  onChange={(event) => onUpdate({ signedAmountCents: event.target.value === "out" ? -row.amountCents : row.amountCents })}
                >
                  <option value="out">Money left this account</option>
                  <option value="in">Money entered this account</option>
                </select>
              </label>
              <label>Other account
                <select value={row.transferAccountId} onChange={(event) => onUpdate({ transferAccountId: event.target.value })}>
                  <option value="">Choose…</option>{household.accounts.filter((account) => account.active && account.id !== row.accountId).map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}
                </select>
              </label>
            </>
          ) : row.type !== "unknown" && (
            <label>Category
              <select value={row.subcategoryId} onChange={(event) => onUpdate({ subcategoryId: event.target.value })}>
                <option value="">Choose…</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
              </select>
            </label>
          )}
          <label>Description<input value={row.note} onChange={(event) => onUpdate({ note: event.target.value })} /></label>
          <span className="muted">{row.documentKind} · {row.bankType}{row.extractionConfidence == null ? "" : ` · scan ${row.extractionConfidence}%`}</span>
        </div>
        <ExistingSide household={household} transaction={ledgerMatch} batchRow={batchMatch} />
      </div>
      <div className="row-actions import-decisions">
        <button type="button" className="chip" onClick={() => onDecide("cancel-import")}>Cancel imported</button>
        <button type="button" className="chip" onClick={() => onDecide("keep-import")}>{row.duplicateMatch ? "Keep both" : "Keep imported"}</button>
        {ledgerMatch && <button type="button" className="chip" onClick={() => onDecide("exclude-ledger")}>Use import · exclude old</button>}
        {batchMatch && <button type="button" className="chip" onClick={onKeepThisCancelOther}>Use this · cancel other import</button>}
      </div>
    </article>
  );
}

function ExistingSide({ household, transaction, batchRow }: { household: Household; transaction: Transaction | null; batchRow: ImportReviewRow | null }) {
  if (batchRow) return (
    <div className="contrast-side">
      <strong>Other imported row</strong><span>{formatCad(batchRow.amountCents)}</span><span>{batchRow.date}</span><span>{batchRow.note || "No description"}</span><span className="muted">{accountName(household, batchRow.accountId)}</span>
    </div>
  );
  if (!transaction) return <div className="contrast-side"><strong>No likely ledger match</strong><span className="muted">This row stays untouched by duplicate cancellation.</span></div>;
  return (
    <div className="contrast-side">
      <strong>Already in Hearth</strong><span>{formatCad(transaction.amountCents)}</span><span>{transaction.date}</span><span>{transaction.note || transaction.type}</span><span className="muted">{accountName(household, transaction.accountId)} · {categoryName(household, transaction.subcategoryId)}</span>
    </div>
  );
}

function resolutionLabel(resolution: ImportReviewRow["resolution"]): string {
  if (resolution === "cancel-import") return "Import cancelled";
  if (resolution === "keep-import") return "Import kept";
  if (resolution === "exclude-ledger") return "Replace old row";
  return "Needs your choice";
}

import { useEffect, useMemo, useRef, useState } from "react";
import {
  accountName,
  buildBatchImport,
  categoryName,
  conflictingReceiptSources,
  formatCad,
  normalizeReceiptNumbers,
  parseOfx,
  prepareImportRows,
  receiptMathBlocks,
  reconcileImportSources,
  refreshImportTriage,
  selectedPaymentTotal,
  shapeGoogle,
  visionDocumentRows,
  type DuplicateTier,
  type Household,
  type ImportReconciliationReport,
  type ImportReviewRow,
  type LedgerView,
  type ParsedOfxAccount,
  type ReceiptNumbers,
  type Transaction,
  type UndoToken,
} from "./core/index.ts";
import { ConfirmSheet } from "./Confirm.tsx";
import { deleteDriveReceipt, uploadDriveReceipt, type DriveReceiptResult } from "./google/index.ts";
import { scanFinancialDocument } from "./imports/documentScanner.ts";
import { FlinksConnectPanel } from "./FlinksConnectPanel.tsx";
import { KitchenNotice } from "./KitchenNotice.tsx";
import { useDialog } from "./useDialog.ts";

const TABS: Array<{ id: DuplicateTier; label: string; hint: string }> = [
  { id: "confident", label: "Confident", hint: "Over 90% · imported row starts cancelled" },
  { id: "not-sure", label: "Not sure", hint: "50–90% · you must choose" },
  { id: "probably-not", label: "Probably not a duplicate", hint: "Under 50% · imported row stays kept" },
];

const FINAL_CONFIRM_FOCUS = "__final-confirm__";
const AUTO_KEEP_HIDDEN_MAX = 20;

type AttentionStep = "duplicate" | "type" | "account" | "currency" | "transfer-account" | "category";

type DriveReceiptState = DriveReceiptResult & {
  file?: File;
  date: string;
};

function receiptSelectionBlocks(
  check: ImportReconciliationReport["receipts"][number],
  selectedIds: string[],
  paymentConflict = false,
  manualAssignment = false,
): boolean {
  if (paymentConflict) return true;
  if (check.paymentAssignmentConflict && !manualAssignment) return true;
  if (receiptMathBlocks(check)) return true;
  if (selectedIds.length) return selectedPaymentTotal(check, selectedIds) !== check.totalCents;
  if (check.matchSearchStatus === "truncated") return true;
  return check.lineSumCents == null || check.componentStatus !== "balanced";
}

function receiptSelectionCleared(check: ImportReconciliationReport["receipts"][number], selectedIds: string[], paymentConflict = false): boolean {
  return selectedIds.length > 0
    && !paymentConflict
    && !receiptMathBlocks(check)
    && selectedPaymentTotal(check, selectedIds) === check.totalCents;
}

function needsTransactionDetails(row: ImportReviewRow): boolean {
  if (row.resolution === "cancel-import") return false;
  return row.type === "unknown" || !row.accountId || row.currency !== "CAD"
    || (row.type === "transfer" ? !row.transferAccountId || row.transferAccountId === row.accountId : !row.subcategoryId);
}

function attentionStep(row: ImportReviewRow): AttentionStep | null {
  if (row.resolution === "undecided") return "duplicate";
  if (row.resolution === "cancel-import") return null;
  if (row.type === "unknown") return "type";
  if (!row.accountId) return "account";
  if (row.currency !== "CAD") return "currency";
  if (row.type === "transfer" && (!row.transferAccountId || row.transferAccountId === row.accountId)) return "transfer-account";
  if (row.type !== "transfer" && !row.subcategoryId) return "category";
  return null;
}

function needsHumanAttention(row: ImportReviewRow): boolean {
  return attentionStep(row) !== null;
}

function appearsInReview(row: ImportReviewRow): boolean {
  return row.duplicateConfidence > AUTO_KEEP_HIDDEN_MAX || needsTransactionDetails(row);
}

function focusSelector(step: AttentionStep): string | null {
  if (step === "duplicate") return '[data-import-action="keep"]';
  if (step === "type") return '[data-import-field="type"]';
  if (step === "account") return '[data-import-field="account"]';
  if (step === "transfer-account") return '[data-import-field="transfer-account"]';
  if (step === "category") return '[data-import-field="category"]';
  return null;
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
  writeHousehold = household,
  memberId,
  view,
  onCommit,
  onGoMore,
}: {
  household: Household;
  /** Accepted snapshot used only after the visible review reaches Confirm. */
  writeHousehold?: Household;
  memberId: string;
  view: LedgerView;
  onCommit: (household: Household, undo: UndoToken) => unknown | Promise<unknown>;
  onGoMore?: () => void;
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
  const [statementAccounts, setStatementAccounts] = useState<ParsedOfxAccount[]>([]);
  const [receiptMatches, setReceiptMatches] = useState<Record<string, string[]>>({});
  const [receiptFiles, setReceiptFiles] = useState<Map<string, File>>(() => new Map());
  const [keepReceiptInDrive, setKeepReceiptInDrive] = useState<Record<string, boolean>>({});
  const [driveReceipts, setDriveReceipts] = useState<Record<string, DriveReceiptState>>({});
  const scopeKey = `${household.environment}|${household.householdId}|${memberId}|${view}`;
  const activeScopeRef = useRef(scopeKey);
  const stagedScopeRef = useRef(scopeKey);
  const renderedScopeRef = useRef(scopeKey);
  const scopeGenerationRef = useRef(0);
  const stagedRowsRef = useRef(rows);
  stagedRowsRef.current = rows;
  const importContextRef = useRef({ household, memberId, view, scopeKey });
  importContextRef.current = { household, memberId, view, scopeKey };
  if (renderedScopeRef.current !== scopeKey) {
    renderedScopeRef.current = scopeKey;
    scopeGenerationRef.current += 1;
  }
  activeScopeRef.current = scopeKey;
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const finalConfirmButton = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useDialog(open && !finalConfirm, () => setOpen(false));
  const reconciliation = useMemo(() => reconcileImportSources({
    household,
    memberId,
    view,
    rows,
    accounts: statementAccounts,
  }), [household, memberId, rows, statementAccounts, view]);
  const receiptSelection = (check: ImportReconciliationReport["receipts"][number]): string[] => (
    receiptMatches[check.sourceHash] ?? check.suggestedMatchIds
  );
  const receiptSelectionTouched = (check: ImportReconciliationReport["receipts"][number]): boolean => (
    Object.prototype.hasOwnProperty.call(receiptMatches, check.sourceHash)
  );
  const receiptConflicts = conflictingReceiptSources(reconciliation.receipts, receiptSelection);
  const clearedReceiptRows = new Set(reconciliation.receipts
    .filter((check) => receiptSelectionCleared(check, receiptSelection(check), receiptConflicts.has(check.sourceHash)))
    .map((check) => check.rowId));
  const effectiveRows = useMemo(() => rows.map((row) => clearedReceiptRows.has(row.id)
    ? { ...row, resolution: "cancel-import" as const }
    : row), [rows, [...clearedReceiptRows].sort().join("|")]);
  const reviewRows = useMemo(() => effectiveRows.filter(appearsInReview), [effectiveRows]);
  const visible = useMemo(() => reviewRows.filter((row) => row.duplicateTier === tier), [reviewRows, tier]);
  const unresolved = effectiveRows.filter((row) => row.resolution === "undecided").length;
  const kept = effectiveRows.filter((row) => row.resolution === "keep-import" || row.resolution === "exclude-ledger").length;
  const cancelled = effectiveRows.filter((row) => row.resolution === "cancel-import").length;
  const autoKept = effectiveRows.filter((row) => !appearsInReview(row) && row.resolution === "keep-import").length;
  const incomplete = effectiveRows.filter(needsTransactionDetails).length;
  const clearedReceipts = clearedReceiptRows.size;
  const statementMismatches = reconciliation.statements.filter((check) => check.status === "mismatch").length;
  const receiptMismatches = reconciliation.receipts.filter((check) => receiptSelectionBlocks(
    check,
    receiptSelection(check),
    receiptConflicts.has(check.sourceHash),
    receiptSelectionTouched(check),
  )).length;
  const reconciliationBlocked = statementMismatches > 0 || receiptMismatches > 0;
  const focusRequestRow = focusRequestId && focusRequestId !== FINAL_CONFIRM_FOCUS
    ? effectiveRows.find((row) => row.id === focusRequestId)
    : null;
  const focusRequestTier = focusRequestRow?.duplicateTier ?? null;
  const focusRequestStep = focusRequestRow ? attentionStep(focusRequestRow) : null;

  useEffect(() => {
    if (stagedScopeRef.current === scopeKey) return;
    stagedScopeRef.current = scopeKey;
    clearStaging(true);
  }, [scopeKey]);

  useEffect(() => {
    if (!open || !focusRequestId) return;
    if (focusRequestId === FINAL_CONFIRM_FOCUS) {
      const timeout = window.setTimeout(() => {
        finalConfirmButton.current?.scrollIntoView?.({ behavior: "smooth", block: "center", inline: "nearest" });
        finalConfirmButton.current?.focus({ preventScroll: true });
      }, 0);
      return () => window.clearTimeout(timeout);
    }
    const target = effectiveRows.find((row) => row.id === focusRequestId);
    if (!target || !focusRequestStep) {
      setFocusRequestId(nextAttentionId(effectiveRows, focusRequestId) ?? FINAL_CONFIRM_FOCUS);
      return;
    }
    if (tier !== target.duplicateTier) {
      setTier(target.duplicateTier);
      return;
    }
    const timeout = window.setTimeout(() => {
      const rowElement = rowRefs.current.get(target.id);
      const selector = focusSelector(focusRequestStep);
      const control = selector ? rowElement?.querySelector<HTMLElement>(selector) : rowElement;
      const reveal = focusRequestStep === "duplicate"
        ? control?.closest<HTMLElement>(".import-decisions") ?? control
        : control?.closest<HTMLElement>("label") ?? control;
      reveal?.scrollIntoView?.({ behavior: "smooth", block: "center", inline: "nearest" });
      control?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [effectiveRows, focusRequestId, focusRequestNonce, focusRequestStep, focusRequestTier, open, tier]);

  function beginAttention(preferred: (row: ImportReviewRow) => boolean) {
    const target = effectiveRows.find((row) => preferred(row) && needsHumanAttention(row))
      ?? effectiveRows.find(needsHumanAttention);
    setFocusRequestId(target?.id ?? FINAL_CONFIRM_FOCUS);
    setFocusRequestNonce((current) => current + 1);
  }

  function clearStaging(clearDriveResults = false) {
    setWorking(false);
    stagedRowsRef.current = [];
    setRows([]);
    setStatementAccounts([]);
    setWarnings([]);
    setError("");
    setReceiptMatches({});
    setReceiptFiles(new Map());
    setKeepReceiptInDrive({});
    if (clearDriveResults) setDriveReceipts({});
    setFocusRequestId(null);
    setFinalConfirm(false);
    setOpen(false);
  }

  function scopeIsCurrent(startedScope: string, startedGeneration: number): boolean {
    return activeScopeRef.current === startedScope && scopeGenerationRef.current === startedGeneration;
  }

  function appendRows(
    sourceRows: Parameters<typeof prepareImportRows>[0]["rows"],
    nextWarnings: string[],
    accounts: ParsedOfxAccount[] = [],
    files: Map<string, File> = new Map(),
  ) {
    const context = importContextRef.current;
    const prepared = prepareImportRows({ household: context.household, memberId: context.memberId, view: context.view, rows: sourceRows });
    const current = stagedRowsRef.current;
    const existingIds = new Set(current.map((row) => row.id));
    const combined = refreshImportTriage({ household: context.household, memberId: context.memberId, view: context.view, rows: [...current, ...prepared.filter((row) => !existingIds.has(row.id))] });
    stagedRowsRef.current = combined;
    setRows(combined);
    setStatementAccounts((current) => {
      const byId = new Map(current.map((account) => [`${account.sourceHash}|${account.accountRef}`, account]));
      accounts.forEach((account) => byId.set(`${account.sourceHash}|${account.accountRef}`, account));
      return [...byId.values()];
    });
    setReceiptFiles((current) => {
      const next = new Map(current);
      files.forEach((file, sourceHash) => next.set(sourceHash, file));
      return next;
    });
    setWarnings((current) => [...new Set([...current, ...nextWarnings].filter(Boolean))]);
    setFocusRequestId(null);
    const reviewable = combined.filter(appearsInReview);
    setTier(reviewable.some((row) => row.duplicateTier === "confident") ? "confident"
      : reviewable.some((row) => row.duplicateTier === "not-sure") ? "not-sure" : "probably-not");
    setError("");
    setOpen(true);
  }

  async function importBankFiles(files: FileList | null) {
    if (!files?.length) return;
    const startedScope = scopeKey;
    const startedGeneration = scopeGenerationRef.current;
    setWorking(true);
    setError("");
    try {
      const sourceRows: Parameters<typeof prepareImportRows>[0]["rows"] = [];
      const nextWarnings: string[] = [];
      const accounts: ParsedOfxAccount[] = [];
      for (const file of [...files]) {
        if (!/\.(?:ofx|qfx)$/i.test(file.name)) throw new Error(`${file.name} is not an OFX or QFX export.`);
        const parsed = parseOfx(await readBankFile(file), file.name);
        sourceRows.push(...parsed.rows);
        accounts.push(...parsed.accounts);
        nextWarnings.push(...parsed.warnings);
      }
      if (!scopeIsCurrent(startedScope, startedGeneration)) return;
      appendRows(sourceRows, nextWarnings, accounts);
    } catch (caught) {
      if (scopeIsCurrent(startedScope, startedGeneration)) setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      if (scopeIsCurrent(startedScope, startedGeneration)) setWorking(false);
      if (bankInput.current) bankInput.current.value = "";
    }
  }

  async function importImages(files: FileList | null, input: HTMLInputElement | null) {
    if (!files?.length) return;
    const startedScope = scopeKey;
    const startedGeneration = scopeGenerationRef.current;
    setWorking(true);
    setError("");
    try {
      const sourceRows: Parameters<typeof prepareImportRows>[0]["rows"] = [];
      const nextWarnings: string[] = [];
      const filesByHash = new Map<string, File>();
      for (const file of [...files]) {
        const scanned = await scanFinancialDocument(file);
        const normalized = visionDocumentRows({ result: scanned.result, sourceName: file.name, sourceHash: scanned.sourceHash });
        sourceRows.push(...normalized.rows);
        nextWarnings.push(...normalized.warnings);
        if (normalized.rows.some((row) => row.documentKind === "receipt")) filesByHash.set(scanned.sourceHash, file);
      }
      if (!scopeIsCurrent(startedScope, startedGeneration)) return;
      appendRows(sourceRows, nextWarnings, [], filesByHash);
    } catch (caught) {
      if (scopeIsCurrent(startedScope, startedGeneration)) setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      if (scopeIsCurrent(startedScope, startedGeneration)) setWorking(false);
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

  function updateReceiptNumbers(rowId: string, numbers: ReceiptNumbers) {
    const normalized = normalizeReceiptNumbers(numbers, numbers.totalCents);
    setRows((current) => refreshImportTriage({
      household,
      memberId,
      view,
      rows: current.map((row) => row.id === rowId ? {
        ...row,
        receiptNumbers: normalized,
        amountCents: normalized.totalCents,
        signedAmountCents: row.signedAmountCents < 0 ? -normalized.totalCents : normalized.totalCents,
      } : row),
    }));
  }

  function toggleReceiptMatch(sourceHash: string, candidateId: string, checked: boolean, currentIds: string[]) {
    setReceiptMatches((current) => ({
      ...current,
      [sourceHash]: checked
        ? [...new Set([...currentIds, candidateId])]
        : currentIds.filter((id) => id !== candidateId),
    }));
  }

  function decide(id: string, resolution: ImportReviewRow["resolution"]) {
    setFocusRequestId(id);
    setFocusRequestNonce((current) => current + 1);
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
    setFocusRequestId(row.id);
    setFocusRequestNonce((current) => current + 1);
    setRows((current) => {
      const next = current.map((candidate) => {
        if (candidate.id === row.id) return { ...candidate, resolution: "keep-import" as const, resolutionTouched: true };
        if (candidate.id === matchedRowId) return { ...candidate, resolution: "cancel-import" as const, resolutionTouched: true };
        return candidate;
      });
      return next;
    });
  }

  async function saveReceiptToDrive(sourceHash: string, file: File, date: string): Promise<DriveReceiptState> {
    const result = await uploadDriveReceipt({
      environment: household.environment,
      memberId,
      householdId: household.householdId,
      enabledServices: shapeGoogle(household.google).enabledServices,
      file,
      sourceHash,
      date,
    });
    return { ...result, date, ...(result.ok ? {} : { file }) };
  }

  async function retryDriveReceipt(sourceHash: string) {
    const startedScope = scopeKey;
    const startedGeneration = scopeGenerationRef.current;
    const pending = driveReceipts[sourceHash];
    if (!pending?.file) return;
    setWorking(true);
    const result = await saveReceiptToDrive(sourceHash, pending.file, pending.date);
    if (scopeIsCurrent(startedScope, startedGeneration)) setDriveReceipts((current) => ({ ...current, [sourceHash]: result }));
    if (scopeIsCurrent(startedScope, startedGeneration)) setWorking(false);
  }

  async function removeDriveReceipt(sourceHash: string) {
    const startedScope = scopeKey;
    const startedGeneration = scopeGenerationRef.current;
    setWorking(true);
    const result = await deleteDriveReceipt({
      environment: household.environment,
      memberId,
      householdId: household.householdId,
      enabledServices: shapeGoogle(household.google).enabledServices,
      sourceHash,
    });
    if (scopeIsCurrent(startedScope, startedGeneration)) {
      setDriveReceipts((current) => ({
        ...current,
        [sourceHash]: { ...result, date: current[sourceHash]?.date ?? "" },
      }));
    }
    if (scopeIsCurrent(startedScope, startedGeneration)) setWorking(false);
  }

  async function confirmBatch() {
    const startedScope = scopeKey;
    const startedGeneration = scopeGenerationRef.current;
    setWorking(true);
    setError("");
    try {
      if (reconciliationBlocked || unresolved || incomplete) throw new Error("Finish every reconciliation issue before Confirm.");
      if (!scopeIsCurrent(startedScope, startedGeneration)) throw new Error("The active books changed. Re-import into the current ledger.");
      if (kept > 0) {
        const result = buildBatchImport({ household: writeHousehold, memberId, rows: effectiveRows });
        const outcome = await onCommit(result.household, result.undo);
        if (outcome === null) throw new Error("The books did not accept this batch. The staged review is still open.");
        if (outcome && typeof outcome === "object" && "ok" in outcome && outcome.ok === false) {
          const detail = "userMessage" in outcome && typeof outcome.userMessage === "string"
            ? outcome.userMessage.trim()
            : "The books rejected this batch.";
          throw new Error(`${detail} The staged review is still open.`);
        }
      }
      const uploads = reconciliation.receipts.flatMap((check) => {
        const file = receiptFiles.get(check.sourceHash);
        return keepReceiptInDrive[check.sourceHash] && file
          ? [{ sourceHash: check.sourceHash, file, date: rows.find((row) => row.id === check.rowId)?.date ?? "" }]
          : [];
      });
      const uploadResults = await Promise.all(uploads.map(async (upload) => ({
        sourceHash: upload.sourceHash,
        result: await saveReceiptToDrive(upload.sourceHash, upload.file, upload.date),
      })));
      if (uploadResults.length && scopeIsCurrent(startedScope, startedGeneration)) setDriveReceipts((current) => {
        const next = { ...current };
        uploadResults.forEach(({ sourceHash, result }) => { next[sourceHash] = result; });
        return next;
      });
      if (scopeIsCurrent(startedScope, startedGeneration)) clearStaging();
    } catch (caught) {
      if (scopeIsCurrent(startedScope, startedGeneration)) {
        setError(caught instanceof Error ? caught.message : String(caught));
        setFinalConfirm(false);
        setOpen(true);
      }
    } finally {
      if (scopeIsCurrent(startedScope, startedGeneration)) setWorking(false);
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
          Bank exports are parsed on this device. Flinks evidence arrives through the secure Worker inbox, then runs the same duplicate review here. A photo is sent for detection only after you take or choose it; the image is not saved in the household.
        </p>
        <FlinksConnectPanel
          environment={household.environment}
          householdId={household.householdId}
          memberId={memberId}
          scopeKey={scopeKey}
          generation={scopeGenerationRef.current}
          disabled={working}
          onGoMore={onGoMore}
          onStage={(batch, expectedScope, expectedGeneration) => {
            if (!scopeIsCurrent(expectedScope, expectedGeneration)) return;
            appendRows(batch.rows, batch.warnings);
          }}
        />
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
        <KitchenNotice message={error && !open ? error : ""} onGoMore={onGoMore} />
        {Object.values(driveReceipts).map((receipt) => (
          <div className={`import-drive-status ${receipt.ok ? "" : "warn"}`} key={receipt.sourceHash} role="status">
            <span>{receipt.detail}</span>
            <div className="row-actions">
              {receipt.webViewLink && <a className="chip" href={receipt.webViewLink} target="_blank" rel="noreferrer">Open in Drive</a>}
              {!receipt.ok && receipt.file && <button type="button" className="chip" disabled={working} onClick={() => void retryDriveReceipt(receipt.sourceHash)}>Retry Drive save</button>}
              {receipt.ok && receipt.fileId && <button type="button" className="ghost" disabled={working} onClick={() => void removeDriveReceipt(receipt.sourceHash)}>Delete Drive copy</button>}
            </div>
          </div>
        ))}
      </section>

      {open && !finalConfirm && (
        <div className="sheet import-review" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="import-review-title">
          <div className="sheet-inner">
            <div className="topbar">
              <div>
                <p className="kicker">Batch inbox</p>
                <h1 id="import-review-title">Import review</h1>
              </div>
              <button type="button" className="ghost" onClick={() => setOpen(false)} disabled={working}>Close</button>
            </div>
            <p className="import-review-summary">
              {rows.length} imported row{rows.length === 1 ? "" : "s"} · {autoKept} auto-kept without review · {kept} kept · {cancelled} cancelled ·{" "}
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
              {" · "}{statementMismatches + receiptMismatches} reconciliation issue{statementMismatches + receiptMismatches === 1 ? "" : "s"}
            </p>
            <ImportReconciliationPanel
              report={reconciliation}
              rows={rows}
              receiptMatches={receiptMatches}
              keepReceiptInDrive={keepReceiptInDrive}
              receiptFiles={receiptFiles}
              receiptConflicts={receiptConflicts}
              onToggleMatch={toggleReceiptMatch}
              onUseNewExpense={(sourceHash) => setReceiptMatches((current) => ({ ...current, [sourceHash]: [] }))}
              onUpdateNumbers={updateReceiptNumbers}
              onKeepInDrive={(sourceHash, checked) => setKeepReceiptInDrive((current) => ({ ...current, [sourceHash]: checked }))}
            />
            <div className="tabs import-tabs" role="tablist" aria-label="Duplicate confidence">
              {TABS.map((item) => {
                const count = reviewRows.filter((row) => row.duplicateTier === item.id).length;
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
            <KitchenNotice message={error} onGoMore={onGoMore} />
            <section className="import-review-list">
              {visible.length ? visible.map((row) => (
                <ImportReviewItem
                  key={row.id}
                  household={household}
                  row={row}
                  allRows={effectiveRows}
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
                disabled={working || unresolved > 0 || incomplete > 0 || reconciliationBlocked || kept + clearedReceipts === 0}
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
          body={`${kept} imported row${kept === 1 ? "" : "s"} will enter the real books. ${clearedReceipts} receipt${clearedReceipts === 1 ? " is" : "s are"} cleared against exact payment totals. ${cancelled} cancelled import${cancelled === 1 ? " stays" : "s stay"} out.`}
          extra="Statement and receipt totals are checked before the books can accept this batch. Optional Drive evidence is saved afterward; a Drive failure never rolls back accepted money and can be retried separately."
          confirmLabel={`Confirm ${kept} import${kept === 1 ? "" : "s"}`}
          busy={working}
          onCancel={() => setFinalConfirm(false)}
          onConfirm={() => void confirmBatch()}
        />
      )}
    </>
  );
}

function dollarsToCents(value: string): number | null {
  const normalized = value.trim().replace(/[$,]/g, "");
  if (!normalized) return null;
  if (!/^\d+(?:\.\d{0,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(cents) && cents >= 0 ? cents : null;
}

function ImportReconciliationPanel({
  report,
  rows,
  receiptMatches,
  keepReceiptInDrive,
  receiptFiles,
  receiptConflicts,
  onToggleMatch,
  onUseNewExpense,
  onUpdateNumbers,
  onKeepInDrive,
}: {
  report: ImportReconciliationReport;
  rows: ImportReviewRow[];
  receiptMatches: Record<string, string[]>;
  keepReceiptInDrive: Record<string, boolean>;
  receiptFiles: Map<string, File>;
  receiptConflicts: Set<string>;
  onToggleMatch: (sourceHash: string, candidateId: string, checked: boolean, currentIds: string[]) => void;
  onUseNewExpense: (sourceHash: string) => void;
  onUpdateNumbers: (rowId: string, numbers: ReceiptNumbers) => void;
  onKeepInDrive: (sourceHash: string, checked: boolean) => void;
}) {
  if (!report.statements.length && !report.receipts.length) return null;
  return (
    <section className="import-reconciliation" aria-labelledby="import-reconciliation-title">
      <header>
        <div>
          <h2 id="import-reconciliation-title">Totals check</h2>
          <p className="muted">Exact cents only. Hearth never stores receipt item names.</p>
        </div>
      </header>
      {report.statements.map((check) => (
        <article className={`import-check import-check--${check.status}`} key={check.id}>
          <strong>{check.sourceName} · account •••• {check.accountLast4 || "unknown"}</strong>
          {check.status === "skipped" ? (
            <p>Opening or closing balance is unavailable. Per your rule, this balance equation is skipped and assumed to line up.</p>
          ) : (
            <p>
              {formatCad(check.openingBalanceCents ?? 0)} + {formatCad(check.transactionNetCents)} = {formatCad(check.expectedClosingBalanceCents ?? 0)}; statement closes at {formatCad(check.closingBalanceCents ?? 0)}.
              {check.status === "mismatch" ? ` Difference: ${formatCad(Math.abs(check.differenceCents ?? 0))}.` : " Exact."}
            </p>
          )}
        </article>
      ))}
      {report.receipts.map((check) => {
        const row = rows.find((candidate) => candidate.id === check.rowId);
        if (!row) return null;
        const numbers = normalizeReceiptNumbers(row.receiptNumbers, row.amountCents);
        const selectedIds = receiptMatches[check.sourceHash] ?? check.suggestedMatchIds;
        const selectedTotal = selectedPaymentTotal(check, selectedIds);
        const paymentConflict = receiptConflicts.has(check.sourceHash);
        const manualAssignment = Object.prototype.hasOwnProperty.call(receiptMatches, check.sourceHash);
        const blocked = receiptSelectionBlocks(check, selectedIds, paymentConflict, manualAssignment);
        const cleared = receiptSelectionCleared(check, selectedIds, paymentConflict);
        const updateNumber = (field: keyof ReceiptNumbers, value: number | null | number[]) => {
          onUpdateNumbers(check.rowId, { ...numbers, [field]: value } as ReceiptNumbers);
        };
        return (
          <article className={`import-check import-check--${blocked ? "mismatch" : "balanced"}`} key={check.id}>
            <header>
              <strong>{check.sourceName} · {formatCad(check.totalCents)}</strong>
              <span className="pill">{cleared ? "Cleared to payment" : check.paymentAssignmentConflict && !manualAssignment ? "Needs choice" : blocked ? "Needs numbers" : "New expense"}</span>
            </header>
            <div className="import-receipt-numbers">
              <label>Item amounts only
                <input
                  key={`lines-${numbers.lineAmountsCents.join("-")}`}
                  defaultValue={numbers.lineAmountsCents.map((cents) => (cents / 100).toFixed(2)).join(", ")}
                  placeholder="12.00, 3.49, 6.50"
                  onBlur={(event) => updateNumber("lineAmountsCents", event.target.value.split(/[,;\n]+/).map(dollarsToCents).filter((cents): cents is number => cents !== null))}
                />
              </label>
              {(["subtotalCents", "discountCents", "taxCents", "tipCents", "feeCents", "totalCents"] as const).map((field) => (
                <label key={field}>{field.replace("Cents", "").replace(/^./, (letter) => letter.toUpperCase())}
                  <input
                    inputMode="decimal"
                    defaultValue={field === "subtotalCents" && numbers[field] == null ? "" : ((numbers[field] ?? 0) / 100).toFixed(2)}
                    onBlur={(event) => updateNumber(field, dollarsToCents(event.target.value) ?? (field === "subtotalCents" ? null : 0))}
                  />
                </label>
              ))}
            </div>
            <p className={receiptMathBlocks(check) ? "danger" : "muted"}>
              Items {check.lineSumCents == null ? "unreadable" : formatCad(check.lineSumCents)} · calculated total {check.componentSumCents == null ? "unavailable" : formatCad(check.componentSumCents)} · detected total {formatCad(check.totalCents)}
            </p>
            <fieldset className="import-payment-matches">
              <legend>Payments within two days</legend>
              {check.candidates.length ? check.candidates.map((candidate) => (
                <label key={candidate.id}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(candidate.id)}
                    onChange={(event) => onToggleMatch(check.sourceHash, candidate.id, event.target.checked, selectedIds)}
                  />
                  <span>{candidate.date} · {candidate.label}</span>
                </label>
              )) : <p className="muted">No nearby imported or posted payment found.</p>}
            </fieldset>
            {check.paymentAssignmentConflict && !manualAssignment && (
              <button type="button" className="secondary" onClick={() => onUseNewExpense(check.sourceHash)}>
                Treat as new expense
              </button>
            )}
            <p className={blocked ? "danger" : "muted"}>
              {paymentConflict
                ? "One selected payment is also claimed by another receipt. Each payment can clear only one receipt."
                : check.paymentAssignmentConflict && !manualAssignment
                  ? "This payment also fits another receipt. Select the payment here, or explicitly treat this receipt as a new expense."
                : selectedIds.length
                ? `Selected payments total ${formatCad(selectedTotal)}. They must equal ${formatCad(check.totalCents)} exactly.`
                : check.matchSearchStatus === "truncated"
                  ? "Many nearby payments were found. Choose the exact payment or payments before Confirm; Hearth will not assume there is no match."
                : check.lineSumCents == null
                  ? "Item amounts are unreadable. Select an exact payment match to clear this receipt."
                  : blocked ? "Correct the receipt numbers before Confirm." : "No payment selected; this balanced receipt will post as a new expense."}
            </p>
            <label className="import-drive-choice">
              <input
                type="checkbox"
                checked={Boolean(keepReceiptInDrive[check.sourceHash])}
                disabled={!receiptFiles.has(check.sourceHash)}
                onChange={(event) => onKeepInDrive(check.sourceHash, event.target.checked)}
              />
              Keep the original image in my private Drive at Hearth Receipts/YYYY/MM
            </label>
            {!receiptFiles.has(check.sourceHash) && <p className="muted">The original image is no longer available in this review.</p>}
          </article>
        );
      })}
    </section>
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
            <select data-import-field="type" value={row.type} onChange={(event) => onUpdate({ type: event.target.value as ImportReviewRow["type"], subcategoryId: "", transferAccountId: "" })}>
              <option value="unknown">Choose…</option><option value="expense">Expense</option><option value="income">Income</option><option value="refund">Refund</option><option value="transfer">Transfer</option>
            </select>
          </label>
          <label>Account
            <select data-import-field="account" value={row.accountId} onChange={(event) => onUpdate({ accountId: event.target.value })}>
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
                <select data-import-field="transfer-account" value={row.transferAccountId} onChange={(event) => onUpdate({ transferAccountId: event.target.value })}>
                  <option value="">Choose…</option>{household.accounts.filter((account) => account.active && account.id !== row.accountId).map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}
                </select>
              </label>
            </>
          ) : row.type !== "unknown" && (
            <label>Category
              <select data-import-field="category" value={row.subcategoryId} onChange={(event) => onUpdate({ subcategoryId: event.target.value })}>
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
        <button type="button" className="chip" data-import-action="keep" onClick={() => onDecide("keep-import")}>{row.duplicateMatch ? "Keep both" : "Keep imported"}</button>
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

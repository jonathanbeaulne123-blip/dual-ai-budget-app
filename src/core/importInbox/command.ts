import { markDuplicate, postEntry, postTransfer } from "../commands.ts";
import { cloneHousehold } from "../household.ts";
import { ValidationError, type CommitResult, type Household, type UndoToken } from "../types.ts";
import { stableImportHash } from "./hash.ts";
import type { ImportReviewRow } from "./types.ts";

function validatePostable(row: ImportReviewRow): void {
  if (row.resolution === "undecided") throw new ValidationError("Decide every item in Not sure before Confirm.");
  if (row.resolution === "cancel-import") return;
  if (row.type === "unknown") throw new ValidationError(`Choose expense, income, refund, or transfer for ${row.note || row.date}.`);
  if (!row.accountId) throw new ValidationError(`Choose a Hearth account for ${row.note || row.date}.`);
  if (row.amountCents <= 0 || !Number.isSafeInteger(row.amountCents)) throw new ValidationError("Imported amounts must be positive integer cents.");
  if (row.currency !== "CAD") throw new ValidationError(`${row.currency || "Unknown currency"} cannot post into Hearth's CAD books.`);
  if (row.type === "transfer") {
    if (!row.transferAccountId || row.transferAccountId === row.accountId) {
      throw new ValidationError(`Choose the other account for transfer ${row.note || row.date}.`);
    }
  } else if (!row.subcategoryId) {
    throw new ValidationError(`Choose a category for ${row.note || row.date}.`);
  }
  if (row.resolution === "exclude-ledger" && row.duplicateMatch?.kind !== "ledger") {
    throw new ValidationError("The older imported row must be cancelled in the batch, not excluded from posted books.");
  }
}

export function buildBatchImport(input: {
  household: Household;
  memberId: string;
  rows: ImportReviewRow[];
}): CommitResult {
  if (!input.rows.length) throw new ValidationError("Choose at least one bank export or document image.");
  input.rows.forEach(validatePostable);
  const previous = cloneHousehold(input.household);
  let working = cloneHousehold(input.household);
  const postedIds: string[] = [];
  const warnings: string[] = [];
  let excludedLedgerRows = 0;
  let importedRows = 0;

  for (const row of input.rows) {
    if (row.resolution === "cancel-import") continue;
    if (row.resolution === "exclude-ledger" && row.duplicateMatch?.kind === "ledger") {
      const excluded = markDuplicate(working, row.duplicateMatch.transactionId, true);
      working = excluded.household;
      postedIds.push(...excluded.postedIds);
      excludedLedgerRows += 1;
    }

    if (row.type === "transfer") {
      const fromAccountId = row.signedAmountCents < 0 ? row.accountId : row.transferAccountId;
      const toAccountId = row.signedAmountCents < 0 ? row.transferAccountId : row.accountId;
      const posted = postTransfer(working, {
        date: row.date,
        amount: row.amountCents / 100,
        fromAccountId,
        toAccountId,
        note: row.note || "Imported transfer",
        source: "import",
        sourceId: row.provenanceId,
        confirmDuplicate: true,
        createdBy: input.memberId,
        visibility: row.visibility,
      });
      working = posted.household;
      postedIds.push(...posted.postedIds);
      warnings.push(...posted.warnings);
      importedRows += 1;
      continue;
    }

    const posted = postEntry(working, {
      date: row.date,
      type: row.type as "expense" | "income" | "refund",
      amount: row.amountCents / 100,
      accountId: row.accountId,
      subcategoryId: row.subcategoryId,
      note: row.note || "Imported transaction",
      place: row.place,
      source: "import",
      sourceId: row.provenanceId,
      confirmDuplicate: true,
      createdBy: input.memberId,
      visibility: row.visibility,
    });
    working = posted.household;
    postedIds.push(...posted.postedIds);
    warnings.push(...posted.warnings);
    importedRows += 1;
  }

  if (!importedRows && !excludedLedgerRows) throw new ValidationError("Every imported row is cancelled. Nothing will change.");
  const fingerprint = stableImportHash(input.rows.map((row) => `${row.id}:${row.resolution}`).join("|"));
  const undo: UndoToken = {
    id: `batch-import-${fingerprint}`,
    label: "Batch Import",
    snapshot: previous,
    postedIds,
  };
  return {
    household: working,
    warnings: [...new Set(warnings)],
    postedIds,
    undo,
  };
}

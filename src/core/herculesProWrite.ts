import { requireAccount, requireSubcategory } from "./catalog.ts";
import { commandIdentityHash, financialAuditHash, rememberReceipt } from "./commandIdentity.ts";
import { postEntry, postTransfer } from "./commands.ts";
import { assertAcceptableBooks } from "./commandRuntime.ts";
import { formatCad } from "./money.ts";
import { assembleHousehold, personalReplicaForMember, splitForSync } from "./sync.ts";
import {
  JOINT,
  NeedsConfirmationError,
  ValidationError,
  type CommandReceipt,
  type Household,
  type LedgerView,
  type PersonalEnvelope,
  type Transaction,
} from "./types.ts";

export type HerculesProTransactionInput = {
  view: LedgerView;
  type: "expense" | "income" | "refund" | "transfer";
  date: string;
  amountCents: number;
  accountId?: string;
  subcategoryId?: string;
  fromAccountId?: string;
  toAccountId?: string;
  note?: string;
  place?: string;
};

export type HerculesProTransactionPreview = {
  ledger: LedgerView;
  type: HerculesProTransactionInput["type"];
  date: string;
  amountCents: number;
  amount: string;
  account: string | null;
  fromAccount: string | null;
  toAccount: string | null;
  category: string | null;
  note: string;
  place: string;
  transactionIds: string[];
  duplicateCandidates: Array<{
    id: string;
    date: string;
    amountCents: number;
    note: string;
    place: string;
  }>;
  warnings: string[];
};

export type PreparedHerculesProTransaction = {
  input: HerculesProTransactionInput;
  candidate: Household;
  postedIds: string[];
  postedTransactions: Transaction[];
  identityHash: string;
  preview: HerculesProTransactionPreview;
};

export type AcceptedHerculesProTransaction = PreparedHerculesProTransaction & {
  accepted: Household;
  sharedProjection: Household;
  personalProjection: PersonalEnvelope | null;
  receipt: CommandReceipt;
  snapshotHash: string;
};

export function herculesProSharedProjection(household: Household, memberId: string): Household {
  const { shared } = splitForSync(household, memberId);
  return {
    ...assembleHousehold(shared, null, { linked: true }),
    linked: household.linked,
    revision: household.revision,
    baseRevision: household.baseRevision,
    lastCommittedAt: household.lastCommittedAt,
    commandReceipts: household.commandReceipts,
  };
}

const MAX_WRITE_CENTS = 100_000_000_000;

export function normalizeHerculesProTransactionInput(value: unknown): HerculesProTransactionInput {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const type = input.type;
  if (type !== "expense" && type !== "income" && type !== "refund" && type !== "transfer") {
    throw new ValidationError("Choose expense, income, refund, or transfer.");
  }
  const view = input.view === "household" ? "household" : input.view === "personal" ? "personal" : null;
  if (!view) throw new ValidationError("Choose the Personal or Household ledger explicitly.");
  const amountCents = Number(input.amountCents);
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > MAX_WRITE_CENTS) {
    throw new ValidationError("Amount must be positive integer CAD cents within the supported limit.");
  }
  const date = typeof input.date === "string" ? input.date.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ValidationError("Date must be YYYY-MM-DD.");
  const short = (field: string, max: number) => {
    const raw = typeof input[field] === "string" ? String(input[field]).trim() : "";
    if (raw.length > max) throw new ValidationError(`${field} is too long.`);
    return raw || undefined;
  };
  return {
    view,
    type,
    date,
    amountCents,
    accountId: short("accountId", 100),
    subcategoryId: short("subcategoryId", 100),
    fromAccountId: short("fromAccountId", 100),
    toAccountId: short("toAccountId", 100),
    note: short("note", 160),
    place: short("place", 120),
  };
}

function dollarsFromCents(amountCents: number): string {
  return (amountCents / 100).toFixed(2);
}

function runTransaction(
  household: Household,
  memberId: string,
  input: HerculesProTransactionInput,
  confirmDuplicate: boolean,
) {
  const visibility = input.view === "personal" ? "personal" as const : "household" as const;
  if (input.type === "transfer") {
    if (!input.fromAccountId || !input.toAccountId) {
      throw new ValidationError("Transfers require fromAccountId and toAccountId.");
    }
    return postTransfer(household, {
      date: input.date,
      amount: dollarsFromCents(input.amountCents),
      fromAccountId: input.fromAccountId,
      toAccountId: input.toAccountId,
      note: input.note,
      source: "manual",
      confirmDuplicate,
      createdBy: memberId,
      visibility,
    });
  }
  if (!input.accountId || !input.subcategoryId) {
    throw new ValidationError(`${input.type} requires accountId and subcategoryId.`);
  }
  return postEntry(household, {
    date: input.date,
    type: input.type,
    amount: dollarsFromCents(input.amountCents),
    accountId: input.accountId,
    subcategoryId: input.subcategoryId,
    note: input.note,
    place: input.place,
    splits: [{ party: input.view === "personal" ? memberId : JOINT, amountCents: input.amountCents }],
    confirmDuplicate,
    source: "manual",
    createdBy: memberId,
    visibility,
  });
}

export function herculesProWriteAllowed(household: Household, view: LedgerView): boolean {
  const permissions = household.herculesProPermissions;
  return view === "personal" ? permissions?.personalWrite === true : permissions?.householdWrite === true;
}

export async function prepareHerculesProTransaction(
  household: Household,
  memberId: string,
  rawInput: unknown,
): Promise<PreparedHerculesProTransaction> {
  const input = normalizeHerculesProTransactionInput(rawInput);
  if (!herculesProWriteAllowed(household, input.view)) {
    throw new ValidationError(`Hercules Pro ${input.view} writes are off in Hearth. Turn them on in More, then reconnect ChatGPT.`);
  }
  let duplicateCandidates: Transaction[] = [];
  let result;
  try {
    result = runTransaction(household, memberId, input, false);
  } catch (error) {
    if (!(error instanceof NeedsConfirmationError) || error.code !== "duplicate") throw error;
    duplicateCandidates = error.matches;
    result = runTransaction(household, memberId, input, true);
  }
  if (input.type === "transfer" && input.view === "personal") {
    const transferIds = new Set(result.postedIds);
    result = {
      ...result,
      household: {
        ...result.household,
        transactions: result.household.transactions.map((row) => transferIds.has(row.id)
          ? { ...row, splits: [{ party: memberId, amountCents: row.amountCents }] }
          : row),
      },
    };
  }
  const posted = new Set(result.postedIds);
  const postedTransactions = result.household.transactions.filter((row) => posted.has(row.id));
  const identityHash = await commandIdentityHash(household, result.household, result.postedIds);
  const account = input.accountId ? requireAccount(household, input.accountId) : null;
  const from = input.fromAccountId ? requireAccount(household, input.fromAccountId) : null;
  const to = input.toAccountId ? requireAccount(household, input.toAccountId) : null;
  const category = input.subcategoryId
    ? requireSubcategory(household, input.subcategoryId, input.type === "refund" ? "expense" : input.type as "expense" | "income")
    : null;
  return {
    input,
    candidate: result.household,
    postedIds: result.postedIds,
    postedTransactions,
    identityHash,
    preview: {
      ledger: input.view,
      type: input.type,
      date: input.date,
      amountCents: input.amountCents,
      amount: formatCad(input.amountCents),
      account: account?.name ?? null,
      fromAccount: from?.name ?? null,
      toAccount: to?.name ?? null,
      category: category?.name ?? null,
      note: input.note ?? "",
      place: input.place ?? "",
      transactionIds: result.postedIds,
      duplicateCandidates: duplicateCandidates.map((row) => ({
        id: row.id,
        date: row.date,
        amountCents: row.amountCents,
        note: row.note,
        place: row.place,
      })),
      warnings: [...result.warnings],
    },
  };
}

export async function acceptPreparedHerculesProTransaction(
  previous: Household,
  prepared: PreparedHerculesProTransaction,
  memberId: string,
  confirmationId: string,
  acceptedAt = new Date().toISOString(),
): Promise<AcceptedHerculesProTransaction> {
  const revision = previous.revision + 1;
  const receipt: CommandReceipt = {
    confirmationId,
    identityHash: prepared.identityHash,
    auditHash: "",
    commandKind: "hercules-pro-transaction",
    postedIds: prepared.postedIds,
    revision,
    acceptedAt,
  };
  const acceptedCandidate = prepared.input.view === "personal"
    ? { ...prepared.candidate, activity: previous.activity }
    : prepared.candidate;
  let accepted = rememberReceipt({
    ...acceptedCandidate,
    revision,
    baseRevision: previous.revision,
    lastCommittedAt: prepared.candidate.lastCommittedAt ?? acceptedAt,
  }, receipt);
  assertAcceptableBooks(accepted);
  accepted.booksAcceptedHash = await financialAuditHash(accepted);
  accepted = rememberReceipt(accepted, { ...receipt, auditHash: accepted.booksAcceptedHash });
  const finalReceipt = accepted.commandReceipts.find((row) => row.confirmationId === confirmationId)!;
  const sharedProjection = herculesProSharedProjection(accepted, memberId);
  return {
    ...prepared,
    accepted,
    sharedProjection,
    personalProjection: prepared.input.view === "personal" ? personalReplicaForMember(accepted, memberId) : null,
    receipt: finalReceipt,
    snapshotHash: await financialAuditHash(sharedProjection),
  };
}

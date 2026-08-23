import type { DateKey } from "./calendar.ts";
import { CURRENCY } from "./money.ts";
import { JOINT, type Account, type AccountKind, type CreditCardDesk, type CreditRewardRule, type InvestmentDesk, type InvestmentVehicle, type SavingsDesk } from "./types.ts";

export const ACCOUNT_KINDS: AccountKind[] = ["chequing", "savings", "credit", "investment", "other", "receivable"];

export const ACCOUNT_KIND_LABEL: Record<AccountKind, string> = {
  chequing: "Chequing",
  savings: "Savings",
  credit: "Credit cards",
  investment: "Investments",
  other: "Other",
  receivable: "Owed to us",
};

export const ACCOUNT_KIND_HINT: Record<AccountKind, string> = {
  chequing: "Everyday spend and paycheques",
  savings: "High-interest parking. Goals vault is the sinking-fund account; everyday HIS stays general. APY is a projection until you post interest",
  credit: "What you owe. Paydown is a transfer. Interest and cashback never auto-post",
  investment: "Cost basis from transfers in. Market value is a typed mark, not a feed",
  other: "Cash, tip envelopes, the jar on the counter",
  receivable: "Money owed to this household that has not arrived. Settlement is a transfer, never income",
};

export const INVESTMENT_VEHICLES: { id: InvestmentVehicle; label: string }[] = [
  { id: "tfsa", label: "TFSA" },
  { id: "rrsp", label: "RRSP" },
  { id: "fhsa", label: "FHSA" },
  { id: "non-registered", label: "Non-registered" },
  { id: "crypto", label: "Crypto" },
  { id: "other", label: "Other" },
];

export function isLiabilityKind(kind: AccountKind): boolean {
  return kind === "credit";
}

export function isCashLikeKind(kind: AccountKind): boolean {
  return kind === "chequing" || kind === "savings" || kind === "other";
}

export function isReceivableKind(kind: AccountKind): boolean {
  return kind === "receivable";
}

export function isInvestmentKind(kind: AccountKind): boolean {
  return kind === "investment";
}

export function isCreditKind(kind: AccountKind): boolean {
  return kind === "credit";
}

export function normalizeAccountKind(raw: unknown): AccountKind {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "cash" || value === "tips" || value === "envelope") return "other";
  if (value === "checking" || value === "chequing") return "chequing";
  if (value === "savings" || value === "hisa") return "savings";
  if (value === "credit" || value === "card" || value === "visa" || value === "mastercard") return "credit";
  if (value === "investment" || value === "tfsa" || value === "rrsp" || value === "brokerage") return "investment";
  if (value === "receivable" || value === "ar" || value === "a/r" || value === "claims" || value === "owing") return "receivable";
  if (value === "other") return "other";
  return "other";
}

export function emptyCreditDesk(): CreditCardDesk {
  return {
    creditLimitCents: 0,
    aprBps: 1999,
    statementDay: 21,
    dueDaysAfterStatement: 21,
    minPaymentBps: 200,
    minPaymentFloorCents: 1000,
    rewardsName: "Cashback",
    defaultCashbackBps: 100,
    rules: [],
  };
}

export function emptySavingsDesk(): SavingsDesk {
  return { apyBps: 0, purpose: "general" };
}

export function emptyInvestmentDesk(): InvestmentDesk {
  return { vehicle: "tfsa", markedValueCents: null, markedAt: null };
}

function asInt(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function shapeRule(value: unknown, index: number): CreditRewardRule | null {
  if (!value || typeof value !== "object") return null;
  const row = value as CreditRewardRule;
  const bps = asInt(row.bps, 0);
  if (bps < 0 || bps > 10000) return null;
  const subcategoryId = typeof row.subcategoryId === "string" && row.subcategoryId ? row.subcategoryId : null;
  const label = typeof row.label === "string" && row.label.trim() ? row.label.trim().slice(0, 40) : subcategoryId || "Bonus";
  return {
    id: typeof row.id === "string" && row.id ? row.id : `RULE-${index + 1}`,
    label,
    subcategoryId,
    bps,
  };
}

function shapeCredit(input: unknown): CreditCardDesk {
  const row = (input && typeof input === "object" ? input : {}) as Partial<CreditCardDesk>;
  const day = Math.min(28, Math.max(1, asInt(row.statementDay, 21)));
  const due = Math.min(30, Math.max(1, asInt(row.dueDaysAfterStatement, 21)));
  const rules = Array.isArray(row.rules)
    ? row.rules.map(shapeRule).filter((item): item is CreditRewardRule => Boolean(item)).slice(0, 12)
    : [];
  return {
    creditLimitCents: Math.max(0, asInt(row.creditLimitCents, 0)),
    aprBps: Math.min(8000, Math.max(0, asInt(row.aprBps, 1999))),
    statementDay: day,
    dueDaysAfterStatement: due,
    minPaymentBps: Math.min(10000, Math.max(0, asInt(row.minPaymentBps, 200))),
    minPaymentFloorCents: Math.max(0, asInt(row.minPaymentFloorCents, 1000)),
    rewardsName: typeof row.rewardsName === "string" && row.rewardsName.trim()
      ? row.rewardsName.trim().slice(0, 24)
      : "Cashback",
    defaultCashbackBps: Math.min(10000, Math.max(0, asInt(row.defaultCashbackBps, 100))),
    rules,
  };
}

function shapeSavings(input: unknown): SavingsDesk {
  const row = (input && typeof input === "object" ? input : {}) as Partial<SavingsDesk>;
  return {
    apyBps: Math.min(3000, Math.max(0, asInt(row.apyBps, 0))),
    purpose: row.purpose === "goals" ? "goals" : "general",
  };
}

function shapeInvestment(input: unknown): InvestmentDesk {
  const row = (input && typeof input === "object" ? input : {}) as Partial<InvestmentDesk>;
  const vehicle = INVESTMENT_VEHICLES.some((item) => item.id === row.vehicle) ? row.vehicle as InvestmentVehicle : "tfsa";
  const marked = row.markedValueCents;
  const markedValueCents = marked == null || marked === undefined ? null : Math.max(0, asInt(marked, 0));
  const markedAt = typeof row.markedAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.markedAt)
    ? row.markedAt as DateKey
    : null;
  return { vehicle, markedValueCents, markedAt };
}

export function shapeAccount(input: Partial<Account> & { id: string; name: string }, index = 0, fallbackIso = ""): Account {
  const kind = normalizeAccountKind(input.kind);
  const owner = input.ownerMemberId || JOINT;
  const createdAt = input.createdAt || fallbackIso;
  return {
    id: input.id,
    name: String(input.name || "Account").trim().slice(0, 40) || "Account",
    kind,
    currency: input.currency === CURRENCY ? CURRENCY : CURRENCY,
    active: input.active !== false,
    ownerMemberId: owner,
    institution: typeof input.institution === "string" ? input.institution.trim().slice(0, 32) : "",
    last4: typeof input.last4 === "string" ? input.last4.replace(/\D/g, "").slice(-4) : "",
    sortOrder: Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : (index + 1) * 10,
    credit: kind === "credit" ? shapeCredit(input.credit) : null,
    savings: kind === "savings" ? shapeSavings(input.savings) : null,
    investment: kind === "investment" ? shapeInvestment(input.investment) : null,
    createdAt,
    updatedAt: input.updatedAt || createdAt,
  };
}

export function shapeAccounts(list: Array<Partial<Account> & { id: string; name?: string }> | undefined | null, fallbackIso = ""): Account[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((row) => row && typeof row.id === "string" && row.id)
    .map((row, index) => shapeAccount({ ...row, name: row.name || "Account", id: row.id }, index, fallbackIso))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
}

export function accountLabel(account: Pick<Account, "name" | "last4">): string {
  return account.last4 ? `${account.name} ·••${account.last4}` : account.name;
}

export function accountOptionLabel(account: Account): string {
  return `${ACCOUNT_KIND_LABEL[account.kind]} · ${accountLabel(account)}`;
}

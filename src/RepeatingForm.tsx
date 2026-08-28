import { useMemo, useState } from "react";
import {
  accountOptionLabel,
  formatCad,
  inferRecurrenceKind,
  type Household,
  type Recurrence,
  type RecurrenceCadence,
  type RecurrenceKind,
} from "./core/index.ts";
import { KitchenNotice } from "./KitchenNotice.tsx";

export type RepeatingDraft = {
  id?: string;
  type: "expense" | "income" | "transfer";
  note: string;
  amount: string;
  cadence: RecurrenceCadence;
  nextDate: string;
  accountId: string;
  transferToAccountId: string;
  goalId: string;
  subcategoryId: string;
  kind: RecurrenceKind;
  kindLocked: boolean;
  useHouseholdFund: boolean;
  fundAmount: string;
  fundDestinationAccountId: string;
};

const CADENCES: { id: RecurrenceCadence; label: string }[] = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "biweekly", label: "Every 2 weeks" },
  { id: "monthly", label: "Monthly" },
];

const KINDS: { id: RecurrenceKind; label: string }[] = [
  { id: "bill", label: "Bill" },
  { id: "subscription", label: "Subscription" },
  { id: "paycheck", label: "Paycheck" },
  { id: "other", label: "Other" },
];

function defaultAccountId(household: Household, type: RepeatingDraft["type"]): string {
  const active = household.accounts.filter((account) => account.active);
  if (type === "income") {
    return active.find((account) => account.kind === "chequing")?.id
      ?? active.find((account) => account.kind !== "credit")?.id
      ?? active[0]?.id
      ?? "ACC-CHEQUING";
  }
  if (type === "transfer") {
    return active.find((account) => account.kind === "chequing")?.id ?? active[0]?.id ?? "ACC-CHEQUING";
  }
  return active.find((account) => account.kind === "credit")?.id
    ?? active.find((account) => account.kind === "chequing")?.id
    ?? active[0]?.id
    ?? "ACC-VISA";
}

function defaultCategoryId(household: Household, type: "expense" | "income"): string {
  const match = household.categories.find(
    (category) => category.recordType === "category" && category.active && category.transactionType === type,
  );
  return match?.id ?? (type === "income" ? "SUB-INCOME-WAGES" : "SUB-FOOD-GROCERIES");
}

function defaultTransferTo(household: Household, fromId: string): string {
  const active = household.accounts.filter((account) => account.active && account.id !== fromId);
  return active.find((account) => account.savings?.purpose === "goals")?.id
    ?? active.find((account) => account.kind === "savings")?.id
    ?? active[0]?.id
    ?? "";
}

export function blankRepeatingDraft(household: Household, today: string): RepeatingDraft {
  const type = "expense" as const;
  const accountId = defaultAccountId(household, type);
  const subcategoryId = defaultCategoryId(household, type);
  const note = "";
  const subcategoryName = household.categories.find((category) => category.id === subcategoryId)?.name;
  return {
    type,
    note,
    amount: "",
    cadence: "monthly",
    nextDate: today,
    accountId,
    transferToAccountId: defaultTransferTo(household, accountId),
    goalId: "",
    subcategoryId,
    kind: inferRecurrenceKind({ type, note, subcategoryName }),
    kindLocked: false,
    useHouseholdFund: false,
    fundAmount: "",
    fundDestinationAccountId: accountId,
  };
}

export function draftFromRecurrence(item: Recurrence): RepeatingDraft {
  return {
    id: item.id,
    type: item.type,
    note: item.note,
    amount: (item.amountCents / 100).toFixed(2),
    cadence: item.cadence,
    nextDate: item.nextDate,
    accountId: item.accountId,
    transferToAccountId: item.transferToAccountId ?? "",
    goalId: item.goalId ?? "",
    subcategoryId: item.subcategoryId,
    kind: item.kind,
    kindLocked: true,
    useHouseholdFund: Boolean(item.fundingDefault),
    fundAmount: item.fundingDefault?.fundedCents === "full" || !item.fundingDefault
      ? ""
      : (item.fundingDefault.fundedCents / 100).toFixed(2),
    fundDestinationAccountId: item.fundingDefault?.destinationAccountId ?? item.accountId,
  };
}

export function repeatingConfirmSummary(draft: RepeatingDraft): string {
  const label = draft.note.trim() || "Repeating item";
  const amount = draft.amount.trim() ? formatCad(Math.round(Number(draft.amount) * 100) || 0) : "an amount";
  const verb = draft.id ? "Update" : "Add";
  const fund = draft.useHouseholdFund ? " Household Fund reserve included; this still creates no money." : "";
  return `${verb} ${label}: ${amount} ${draft.cadence}, next ${draft.nextDate}. This saves a reminder; Mark paid still posts unless you choose to post below.${fund}`;
}

export function RepeatingForm(props: {
  household: Household;
  today: string;
  initial: RepeatingDraft;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (draft: RepeatingDraft) => void;
}) {
  const { household } = props;
  const [draft, setDraft] = useState<RepeatingDraft>(props.initial);
  const [error, setError] = useState("");

  const categories = useMemo(
    () => household.categories.filter(
      (category) =>
        category.recordType === "category"
        && category.active
        && category.transactionType === (draft.type === "income" ? "income" : "expense"),
    ),
    [household.categories, draft.type],
  );
  const accounts = useMemo(
    () => household.accounts.filter((account) => account.active),
    [household.accounts],
  );
  const goals = useMemo(
    () => household.goals.filter((goal) => goal.status !== "retired"),
    [household.goals],
  );

  function patch(partial: Partial<RepeatingDraft>) {
    setDraft((current) => {
      const next = { ...current, ...partial };
      if (!next.kindLocked && (partial.note !== undefined || partial.subcategoryId !== undefined || partial.type !== undefined)) {
        const subcategoryName = household.categories.find((category) => category.id === next.subcategoryId)?.name;
        next.kind = inferRecurrenceKind({
          type: next.type === "transfer" ? "expense" : next.type,
          note: next.note,
          subcategoryName,
        });
        if (next.type === "income") next.kind = "paycheck";
        if (next.type === "transfer") next.kind = "other";
      }
      return next;
    });
    setError("");
  }

  function changeType(type: RepeatingDraft["type"]) {
    const accountId = defaultAccountId(household, type);
    patch({
      type,
      accountId,
      subcategoryId: type === "transfer" ? draft.subcategoryId : defaultCategoryId(household, type),
      transferToAccountId: type === "transfer" ? defaultTransferTo(household, accountId) : draft.transferToAccountId,
      kindLocked: false,
    });
  }

  return (
    <section className="card repeating-form">
      <header>
        <h2>{draft.id ? "Edit repeating" : "Add repeating"}</h2>
        <span className="muted">Reminder until Mark paid</span>
      </header>
      <p className="muted">Calendar and OCR may prefill this. Confirm still posts money.</p>

      <label>Type</label>
      <div className="chips">
        {([
          ["expense", "Bill / spend"],
          ["income", "Income"],
          ["transfer", "Transfer"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`chip ${draft.type === id ? "selected" : ""}`}
            disabled={props.busy}
            onClick={() => changeType(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <label htmlFor="repeating-note">Name</label>
      <input
        id="repeating-note"
        value={draft.note}
        placeholder={draft.type === "income" ? "Paycheque…" : draft.type === "transfer" ? "To savings…" : "Rent, Netflix…"}
        disabled={props.busy}
        onChange={(event) => patch({ note: event.target.value })}
      />

      <label htmlFor="repeating-amount">Amount (CAD)</label>
      <input
        id="repeating-amount"
        inputMode="decimal"
        value={draft.amount}
        placeholder="0.00"
        disabled={props.busy}
        onChange={(event) => patch({ amount: event.target.value })}
      />

      <label>Cadence</label>
      <div className="chips">
        {CADENCES.map((cadence) => (
          <button
            key={cadence.id}
            type="button"
            className={`chip ${draft.cadence === cadence.id ? "selected" : ""}`}
            disabled={props.busy}
            onClick={() => patch({ cadence: cadence.id })}
          >
            {cadence.label}
          </button>
        ))}
      </div>

      <label htmlFor="repeating-next">Next date</label>
      <input
        id="repeating-next"
        type="date"
        value={draft.nextDate}
        disabled={props.busy}
        onChange={(event) => patch({ nextDate: event.target.value })}
      />

      {draft.type === "transfer" ? (
        <>
          <label htmlFor="repeating-from">From</label>
          <select
            id="repeating-from"
            value={draft.accountId}
            disabled={props.busy}
            onChange={(event) => patch({ accountId: event.target.value })}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>{accountOptionLabel(account)}</option>
            ))}
          </select>
          <label htmlFor="repeating-to">To</label>
          <select
            id="repeating-to"
            value={draft.transferToAccountId}
            disabled={props.busy}
            onChange={(event) => patch({ transferToAccountId: event.target.value })}
          >
            {accounts.filter((account) => account.id !== draft.accountId).map((account) => (
              <option key={account.id} value={account.id}>{accountOptionLabel(account)}</option>
            ))}
          </select>
          {goals.length > 0 && (
            <>
              <label htmlFor="repeating-goal">Fund goal (optional)</label>
              <select
                id="repeating-goal"
                value={draft.goalId}
                disabled={props.busy}
                onChange={(event) => patch({ goalId: event.target.value })}
              >
                <option value="">None</option>
                {goals.map((goal) => (
                  <option key={goal.id} value={goal.id}>{goal.name}</option>
                ))}
              </select>
            </>
          )}
        </>
      ) : (
        <>
          <label htmlFor="repeating-account">Account</label>
          <select
            id="repeating-account"
            value={draft.accountId}
            disabled={props.busy}
            onChange={(event) => patch({ accountId: event.target.value })}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>{accountOptionLabel(account)}</option>
            ))}
          </select>
          <label htmlFor="repeating-category">Category</label>
          <select
            id="repeating-category"
            value={draft.subcategoryId}
            disabled={props.busy}
            onChange={(event) => patch({ subcategoryId: event.target.value })}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </>
      )}

      {draft.type === "expense" && household.householdFund && (
        <section className="preview" aria-label="Household Fund recurring reserve">
          <button
            type="button"
            className={`chip ${draft.useHouseholdFund ? "selected" : ""}`}
            aria-pressed={draft.useHouseholdFund}
            disabled={props.busy}
            onClick={() => patch({ useHouseholdFund: !draft.useHouseholdFund })}
          >
            Reserve with Household Fund
          </button>
          <p className="muted">This reserves the upcoming bill; it does not create or move money.</p>
          {draft.useHouseholdFund && (
            <>
              <label htmlFor="repeating-fund-amount">Funded amount (CAD, blank for full)</label>
              <input
                id="repeating-fund-amount"
                inputMode="decimal"
                value={draft.fundAmount}
                placeholder={draft.amount || "Full amount"}
                disabled={props.busy}
                onChange={(event) => patch({ fundAmount: event.target.value })}
              />
              <label htmlFor="repeating-fund-destination">Settlement destination</label>
              <select
                id="repeating-fund-destination"
                value={draft.fundDestinationAccountId}
                disabled={props.busy}
                onChange={(event) => patch({ fundDestinationAccountId: event.target.value })}
              >
                {accounts.filter((account) => account.scope !== "personal").map((account) => (
                  <option key={account.id} value={account.id}>{accountOptionLabel(account)}</option>
                ))}
              </select>
            </>
          )}
        </section>
      )}

      <label htmlFor="repeating-kind">Kind</label>
      <select
        id="repeating-kind"
        value={draft.kind}
        disabled={props.busy}
        onChange={(event) => patch({ kind: event.target.value as RecurrenceKind, kindLocked: true })}
      >
        {KINDS.map((kind) => (
          <option key={kind.id} value={kind.id}>{kind.label}</option>
        ))}
      </select>
      <p className="muted">
        {draft.kindLocked ? "You chose this kind." : "Guessed from the name and category — change it anytime."}
      </p>

      <KitchenNotice message={error} />

      <div className="chips" style={{ marginTop: 12 }}>
        <button
          type="button"
          className="chip selected"
          disabled={props.busy}
          onClick={() => {
            if (!draft.amount.trim()) {
              setError("Enter an amount.");
              return;
            }
            if (!draft.nextDate) {
              setError("Pick the next date.");
              return;
            }
            if (draft.type !== "transfer" && !draft.subcategoryId) {
              setError("Pick a category.");
              return;
            }
            if (draft.type === "transfer" && !draft.transferToAccountId) {
              setError("Pick a destination account.");
              return;
            }
            props.onSubmit(draft);
          }}
        >
          Save
        </button>
        <button type="button" className="chip" disabled={props.busy} onClick={props.onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}

import { useState } from "react";
import type { ClerkReading as ClerkReadingRecord, ClerkSentence } from "./core/clerkReading.ts";
import { formatCad } from "./core/money.ts";
import type { Household, HouseholdFundEvent, Transaction } from "./core/types.ts";
import "./clerk-reading.css";

export type ClerkRecordRef =
  | { kind: "transaction"; id: string }
  | { kind: "fund-event"; id: string };

type Props = {
  reading: ClerkReadingRecord;
  household: Household;
  onOpenRecord?: (target: ClerkRecordRef) => void;
};

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;
const CITATION_COPY = "the rows this came from";
const WITHHELD_COPY = "These rows don't tie to the ledger yet. I'd rather show you nothing than show you the wrong thing.";
const EMPTY_COPY = "Nothing to read yet. When the record moves, I'll cite the rows.";
const MISSING_COPY = "This citation isn't in the record I was given.";

function civilLabel(date: string): string {
  const [, month, day] = date.split("-");
  const monthName = MONTHS[Number(month) - 1];
  if (!monthName || !day) return date;
  return `${Number(day)} ${monthName}`;
}

function displayCad(cents: number): string {
  const raw = formatCad(cents);
  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [dollars = "0", fraction = "00"] = unsigned.replace("$", "").split(".");
  const grouped = dollars.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}$${grouped}.${fraction}`;
}

function hasCitation(sentence: ClerkSentence): boolean {
  return sentence.transactionIds.length + sentence.fundEventIds.length > 0;
}

function transactionLabel(household: Household, row: Transaction): string {
  const note = row.note.trim();
  if (note) return note;
  const place = row.place.trim();
  if (place) return place;
  const category = household.categories.find((item) => item.id === row.subcategoryId)
    ?? household.categories.find((item) => item.id === row.categoryId);
  if (category?.name) return category.name;
  return row.type;
}

function fundEventLabel(row: HouseholdFundEvent): string {
  const purpose = row.purpose.trim();
  if (purpose) return purpose;
  return row.kind.replaceAll("-", " ");
}

function findTransaction(household: Household, id: string): Transaction | undefined {
  return household.transactions.find((row) => row.id === id);
}

function findFundEvent(household: Household, id: string): HouseholdFundEvent | undefined {
  return (household.fundEvents ?? []).find((row) => row.id === id);
}

type ResolvedSentence = {
  sentence: ClerkSentence;
  transactions: Transaction[];
  fundEvents: HouseholdFundEvent[];
};

function resolveSentence(household: Household, sentence: ClerkSentence): ResolvedSentence | null {
  if (!hasCitation(sentence)) return null;
  const transactions = sentence.transactionIds.map((id) => findTransaction(household, id));
  const fundEvents = sentence.fundEventIds.map((id) => findFundEvent(household, id));
  if (transactions.some((row) => !row) || fundEvents.some((row) => !row)) return null;
  return {
    sentence,
    transactions: transactions as Transaction[],
    fundEvents: fundEvents as HouseholdFundEvent[],
  };
}

export function ClerkReading({ reading, household, onOpenRecord }: Props) {
  const [openIds, setOpenIds] = useState<string[]>([]);

  if (!reading.tiesToProjection) {
    return (
      <section className="clerk-reading" data-clerk-state="withheld">
        <p className="clerk-status">{WITHHELD_COPY}</p>
      </section>
    );
  }

  const citedSentences = reading.sentences.filter(hasCitation);
  const resolvedSentences = citedSentences
    .map((sentence) => resolveSentence(household, sentence))
    .filter((item): item is ResolvedSentence => item !== null);
  const hasUnresolvedCitation = resolvedSentences.length !== citedSentences.length;
  if (resolvedSentences.length === 0) {
    return (
      <section className="clerk-reading" data-clerk-state={hasUnresolvedCitation ? "integrity" : "empty"}>
        <p className="clerk-status" data-clerk-integrity={hasUnresolvedCitation || undefined}>
          {hasUnresolvedCitation ? MISSING_COPY : EMPTY_COPY}
        </p>
      </section>
    );
  }

  function toggle(id: string) {
    setOpenIds((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  }

  return (
    <section className="clerk-reading" data-clerk-state="ready">
      {hasUnresolvedCitation ? (
        <p className="clerk-status" data-clerk-integrity="true">{MISSING_COPY}</p>
      ) : null}
      <ol className="clerk-sentences">
        {resolvedSentences.map(({ sentence, transactions, fundEvents }) => {
          const open = openIds.includes(sentence.id);
          const buttonId = `clerk-sentence-${sentence.id}`;
          const regionId = `clerk-rows-${sentence.id}`;
          return (
            <li key={sentence.id} className="clerk-item">
              <button
                type="button"
                id={buttonId}
                className="clerk-sentence"
                data-clerk-sentence={sentence.id}
                aria-expanded={open}
                aria-controls={regionId}
                onClick={() => toggle(sentence.id)}
              >
                <span className="clerk-sentence-text">{sentence.text}</span>
                <span className="clerk-hint" aria-hidden="true">{CITATION_COPY}</span>
              </button>
              <div
                id={regionId}
                className="clerk-rows"
                role="region"
                aria-labelledby={buttonId}
                hidden={!open}
              >
                <p className="clerk-rows-label">{CITATION_COPY}</p>
                <ul className="clerk-row-list">
                  {transactions.map((row) => {
                    const id = row.id;
                    return (
                      <li key={id} className="clerk-row" data-clerk-row={id} data-clerk-kind="transaction">
                        <span className="clerk-row-date">{civilLabel(row.date)}</span>
                        <span className="clerk-row-label">{transactionLabel(household, row)}</span>
                        <span className="clerk-row-amount">{displayCad(row.amountCents)}</span>
                        {onOpenRecord ? (
                          <button
                            type="button"
                            className="clerk-open"
                            aria-label={`open ${transactionLabel(household, row)} ${civilLabel(row.date)} ${displayCad(row.amountCents)}, record ${id}`}
                            onClick={() => onOpenRecord({ kind: "transaction", id })}
                          >
                            open
                          </button>
                        ) : null}
                      </li>
                    );
                  })}
                  {fundEvents.map((row) => {
                    const id = row.id;
                    return (
                      <li key={id} className="clerk-row" data-clerk-row={id} data-clerk-kind="fund-event">
                        <span className="clerk-row-date">{civilLabel(row.date)}</span>
                        <span className="clerk-row-label">{fundEventLabel(row)}</span>
                        <span className="clerk-row-amount">{displayCad(row.amountCents)}</span>
                        {onOpenRecord ? (
                          <button
                            type="button"
                            className="clerk-open"
                            aria-label={`open ${fundEventLabel(row)} ${civilLabel(row.date)} ${displayCad(row.amountCents)}, record ${id}`}
                            onClick={() => onOpenRecord({ kind: "fund-event", id })}
                          >
                            open
                          </button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

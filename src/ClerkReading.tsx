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

export function ClerkReading({ reading, household, onOpenRecord }: Props) {
  const [openIds, setOpenIds] = useState<string[]>([]);

  if (!reading.tiesToProjection) {
    return (
      <section className="clerk-reading" data-clerk-state="withheld">
        <p className="clerk-status">{WITHHELD_COPY}</p>
      </section>
    );
  }

  const sentences = reading.sentences.filter(hasCitation);
  if (sentences.length === 0) {
    return (
      <section className="clerk-reading" data-clerk-state="empty">
        <p className="clerk-status">{EMPTY_COPY}</p>
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
      <ol className="clerk-sentences">
        {sentences.map((sentence) => {
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
                  {sentence.transactionIds.map((id) => {
                    const row = findTransaction(household, id);
                    if (!row) {
                      return (
                        <li key={`missing-txn-${id}`} className="clerk-row is-missing" data-clerk-missing={id}>
                          <span className="clerk-row-label">{MISSING_COPY}</span>
                        </li>
                      );
                    }
                    return (
                      <li key={id} className="clerk-row" data-clerk-row={id} data-clerk-kind="transaction">
                        <span className="clerk-row-date">{civilLabel(row.date)}</span>
                        <span className="clerk-row-label">{transactionLabel(household, row)}</span>
                        <span className="clerk-row-amount">{displayCad(row.amountCents)}</span>
                        {onOpenRecord ? (
                          <button
                            type="button"
                            className="clerk-open"
                            aria-label={`open ${transactionLabel(household, row)} ${civilLabel(row.date)}`}
                            onClick={() => onOpenRecord({ kind: "transaction", id })}
                          >
                            open
                          </button>
                        ) : null}
                      </li>
                    );
                  })}
                  {sentence.fundEventIds.map((id) => {
                    const row = findFundEvent(household, id);
                    if (!row) {
                      return (
                        <li key={`missing-fund-${id}`} className="clerk-row is-missing" data-clerk-missing={id}>
                          <span className="clerk-row-label">{MISSING_COPY}</span>
                        </li>
                      );
                    }
                    return (
                      <li key={id} className="clerk-row" data-clerk-row={id} data-clerk-kind="fund-event">
                        <span className="clerk-row-date">{civilLabel(row.date)}</span>
                        <span className="clerk-row-label">{fundEventLabel(row)}</span>
                        <span className="clerk-row-amount">{displayCad(row.amountCents)}</span>
                        {onOpenRecord ? (
                          <button
                            type="button"
                            className="clerk-open"
                            aria-label={`open ${fundEventLabel(row)} ${civilLabel(row.date)}`}
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

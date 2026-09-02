import { useEffect, useMemo, useState } from "react";
import { CadPad } from "./CadPad.tsx";
import { padToDollars } from "./core/cadPad.ts";
import { formatCad } from "./core/money.ts";
import type { DateKey } from "./core/calendar.ts";
import type { Household } from "./core/types.ts";
import {
  SWIPE_COPY,
  observedSwipeCategories,
  resolveSwipeCardAccount,
  swipeCategoryAccessibleName,
  swipeMoreAccessibleName,
} from "./core/swipe.ts";
import { useDialog } from "./useDialog.ts";
import "./swipe.css";

export function Swipe({
  household,
  memberId,
  today,
  busy,
  onClose,
  onPostCategory,
  onMore,
}: {
  household: Household;
  memberId: string;
  today: DateKey;
  busy: boolean;
  onClose: () => void;
  onPostCategory: (input: { amount: string; subcategoryId: string }) => void;
  onMore: (amount: string) => void;
}) {
  const [digits, setDigits] = useState("");
  const [step, setStep] = useState<"amount" | "category">("amount");
  const sheetRef = useDialog(true, busy ? undefined : onClose);
  const amount = padToDollars(digits);
  const amountReady = Boolean(amount);
  const categories = useMemo(
    () => observedSwipeCategories(household, memberId, today),
    [household, memberId, today],
  );
  const card = useMemo(
    () => resolveSwipeCardAccount(household, memberId),
    [household, memberId],
  );
  const amountLabel = amountReady ? formatCad(Number(digits)) : "";
  const canPost = card.kind === "ready" && amountReady && !busy;

  useEffect(() => {
    const root = sheetRef.current;
    if (!root) return;
    const selector = step === "category" ? ".swipe-cat" : ".cad-pad-keys button";
    root.querySelector<HTMLButtonElement>(selector)?.focus();
  }, [step, sheetRef]);

  return (
    <div className="swipe-sheet" role="presentation">
      <div
        ref={sheetRef}
        className="swipe-sheet-inner"
        role="dialog"
        aria-modal="true"
        aria-labelledby="swipe-title"
      >
        <button type="button" className="ghost swipe-close" onClick={onClose} disabled={busy}>
          Close
        </button>
        <h2 id="swipe-title" className="swipe-title">{SWIPE_COPY.title}</h2>
        {step === "amount" ? (
          <div>
            <CadPad
              digits={digits}
              onDigits={setDigits}
              label={SWIPE_COPY.title}
              giant
              onEnter={() => { if (amountReady) setStep("category"); }}
              enterLabel="Enter"
              enterDisabled={!amountReady || busy}
            />
          </div>
        ) : (
          <>
            <p className="swipe-amount" aria-live="polite">{amountLabel}</p>
            <div className="swipe-grid">
              {categories.map((category) => (
                <button
                  key={category.subcategoryId}
                  type="button"
                  className="swipe-cat"
                  disabled={!canPost}
                  aria-label={swipeCategoryAccessibleName(amountLabel, category.name)}
                  onClick={() => onPostCategory({ amount, subcategoryId: category.subcategoryId })}
                >
                  {category.name}
                </button>
              ))}
              <button
                type="button"
                className="swipe-cat more"
                disabled={busy || !amountReady}
                aria-label={swipeMoreAccessibleName(amountLabel || "the entered amount")}
                onClick={() => onMore(amount)}
              >
                {SWIPE_COPY.more}
              </button>
            </div>
            {card.kind === "ambiguous" ? (
              <p className="swipe-note">Choose the card in Add. More keeps the amount and does not post.</p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

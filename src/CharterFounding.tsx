import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { CommitResult, DateKey, Household } from "./core/index.ts";
import {
  CHARTER_FOUNDING_COPY,
  CHARTER_FOUNDING_COUNTER_AT,
  CHARTER_FOUNDING_NOTE_MAX,
  CHARTER_FOUNDING_PERMISSION_MAX,
  CHARTER_FOUNDING_PURPOSE_MAX,
  CHARTER_FOUNDING_QUESTION_COUNT,
  CHARTER_FOUNDING_SPLIT_CARDS,
  WEEKDAY_SHORT,
  commitCharterFounding,
  emptyCharterFoundingDraft,
  signHouseholdCharter,
  skipCharterFoundingStep,
  type CharterFoundingDraft,
} from "./core/index.ts";
import "./charter-founding.css";

const STORAGE_PREFIX = "hearth.charter-founding.v1:";
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

function storageKey(householdId: string, memberId: string): string {
  return `${STORAGE_PREFIX}${householdId}:${memberId}`;
}

function focusableIn(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(
    "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
  )].filter((node) => !node.hasAttribute("disabled") && node.getClientRects().length > 0);
}

function readDraft(household: Household, memberId: string): CharterFoundingDraft {
  const fallback = emptyCharterFoundingDraft(household);
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(storageKey(household.householdId, memberId));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<CharterFoundingDraft>;
    return {
      ...fallback,
      ...parsed,
      permissionLabels: Array.isArray(parsed.permissionLabels) && parsed.permissionLabels.length
        ? parsed.permissionLabels.map((row) => String(row).slice(0, CHARTER_FOUNDING_PERMISSION_MAX))
        : fallback.permissionLabels,
      step: Number.isInteger(parsed.step)
        ? Math.min(Math.max(Number(parsed.step), 0), household.charter ? 5 : 4)
        : 0,
    };
  } catch {
    return fallback;
  }
}

type Props = {
  household: Household;
  memberId: string;
  today: DateKey;
  busy?: boolean;
  onCommit: (fn: (current: Household) => CommitResult) => void;
  onDismiss: () => void;
};

export function CharterFounding({ household, memberId, today, busy, onCommit, onDismiss }: Props) {
  const paperRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<CharterFoundingDraft>(() => (
    household.charter ? { ...emptyCharterFoundingDraft(household), step: 5 } : readDraft(household, memberId)
  ));

  useEffect(() => {
    if (household.charter) return;
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(storageKey(household.householdId, memberId), JSON.stringify(draft));
  }, [draft, household.charter, household.householdId, memberId]);

  useEffect(() => {
    if (!household.charter) return;
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(storageKey(household.householdId, memberId));
    setDraft((current) => current.step === 5 ? current : { ...current, step: 5 });
  }, [household.charter, household.householdId, memberId]);

  const step = household.charter || draft.step === 5 ? 5 : draft.step;

  useEffect(() => {
    const paper = paperRef.current;
    const first = paper ? focusableIn(paper)[0] : undefined;
    first?.focus();
  }, [step]);

  useEffect(() => {
    function trap(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const paper = paperRef.current;
      if (!paper) return;
      const focusable = focusableIn(paper);
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && (active === first || !paper.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !paper.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", trap, true);
    return () => window.removeEventListener("keydown", trap, true);
  }, []);

  function goNext() {
    if (draft.step >= 4) {
      if (!household.charter) {
        onCommit((current) => commitCharterFounding(current, { memberId, today, draft }));
      }
      setDraft((current) => ({ ...current, step: 5 }));
      return;
    }
    setDraft((current) => ({ ...current, step: current.step + 1 }));
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      return;
    }
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    const target = event.target as HTMLElement;
    if (target.tagName === "TEXTAREA" || target.tagName === "BUTTON") return;
    event.preventDefault();
    goNext();
  }

  const title = step === 0 ? CHARTER_FOUNDING_COPY.q1
    : step === 1 ? CHARTER_FOUNDING_COPY.q2
    : step === 2 ? CHARTER_FOUNDING_COPY.q3
    : step === 3 ? CHARTER_FOUNDING_COPY.q4
    : step === 4 ? CHARTER_FOUNDING_COPY.q5
    : CHARTER_FOUNDING_COPY.close;

  return (
    <div
      ref={paperRef}
      className="charter-founding"
      role="dialog"
      aria-modal="true"
      aria-labelledby="charter-founding-title"
      onKeyDown={onKeyDown}
    >
      <div className="charter-founding-inner">
        {step < CHARTER_FOUNDING_QUESTION_COUNT ? (
          <div className="steprail" aria-hidden="true">
            {Array.from({ length: CHARTER_FOUNDING_QUESTION_COUNT }, (_, index) => (
              <i key={index} className={index === step ? "on" : undefined} />
            ))}
          </div>
        ) : null}

        <h1 className="q" id="charter-founding-title">{title}</h1>

        {step === 0 ? (
          <>
            <p className="qsub">{CHARTER_FOUNDING_COPY.q1Sub}</p>
            <div className="field">
              <label className="lab" htmlFor="charter-purpose">purpose</label>
              <textarea
                id="charter-purpose"
                rows={3}
                maxLength={CHARTER_FOUNDING_PURPOSE_MAX}
                value={draft.purpose}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  purpose: event.target.value.slice(0, CHARTER_FOUNDING_PURPOSE_MAX),
                }))}
              />
              {draft.purpose.length >= CHARTER_FOUNDING_COUNTER_AT ? (
                <p className="count">{draft.purpose.length} / {CHARTER_FOUNDING_PURPOSE_MAX}</p>
              ) : null}
            </div>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <p className="qsub">{CHARTER_FOUNDING_COPY.q2Sub}</p>
            {CHARTER_FOUNDING_SPLIT_CARDS.map((card) => (
              <button
                key={card.rule}
                type="button"
                className={draft.splitRule === card.rule ? "opt sel" : "opt"}
                aria-pressed={draft.splitRule === card.rule}
                onClick={() => setDraft((current) => ({ ...current, splitRule: card.rule }))}
              >
                <h4>{card.heading}</h4>
                <p>{card.body}</p>
              </button>
            ))}
            <div className="field">
              <label className="lab" htmlFor="charter-split-note">{CHARTER_FOUNDING_COPY.ownWords}</label>
              <textarea
                id="charter-split-note"
                rows={3}
                maxLength={CHARTER_FOUNDING_NOTE_MAX}
                value={draft.splitNote}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  splitNote: event.target.value.slice(0, CHARTER_FOUNDING_NOTE_MAX),
                }))}
              />
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <div className="perm">
            {draft.permissionLabels.map((label, index) => (
              <div className="field" key={index}>
                <label className="lab" htmlFor={`charter-perm-${index}`}>
                  {index === 0 ? "permission" : `permission ${index + 1}`}
                </label>
                <textarea
                  id={`charter-perm-${index}`}
                  rows={2}
                  maxLength={CHARTER_FOUNDING_PERMISSION_MAX}
                  value={label}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    permissionLabels: current.permissionLabels.map((row, rowIndex) => (
                      rowIndex === index ? event.target.value.slice(0, CHARTER_FOUNDING_PERMISSION_MAX) : row
                    )),
                  }))}
                />
              </div>
            ))}
            <button
              type="button"
              className="link"
              onClick={() => setDraft((current) => ({
                ...current,
                permissionLabels: [...current.permissionLabels, ""],
              }))}
            >
              {CHARTER_FOUNDING_COPY.add}
            </button>
          </div>
        ) : null}

        {step === 3 ? (
          <>
            {([
              ["weekly", CHARTER_FOUNDING_COPY.weekly],
              ["biweekly", CHARTER_FOUNDING_COPY.biweekly],
              ["monthly", CHARTER_FOUNDING_COPY.monthly],
              ["none", CHARTER_FOUNDING_COPY.cadenceNone],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={draft.cadence === value ? "opt sel" : "opt"}
                aria-pressed={draft.cadence === value}
                onClick={() => setDraft((current) => ({ ...current, cadence: value }))}
              >
                <h4>{label}</h4>
              </button>
            ))}
            {draft.cadence === "weekly" || draft.cadence === "biweekly" ? (
              <div className="weekday" role="group" aria-label="Weekday">
                {WEEKDAYS.map((label, index) => (
                  <button
                    key={label}
                    type="button"
                    className={draft.cadenceWeekday === index ? "sel" : undefined}
                    aria-pressed={draft.cadenceWeekday === index}
                    onClick={() => setDraft((current) => ({ ...current, cadenceWeekday: index }))}
                  >
                    {WEEKDAY_SHORT[index]}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : null}

        {step === 4 ? (
          <>
            <p className="qsub">{CHARTER_FOUNDING_COPY.q5Sub}</p>
            <button
              type="button"
              className={draft.ceilingKind === "hours-per-week" ? "opt sel" : "opt"}
              aria-pressed={draft.ceilingKind === "hours-per-week"}
              onClick={() => setDraft((current) => ({ ...current, ceilingKind: "hours-per-week" }))}
            >
              <h4>{CHARTER_FOUNDING_COPY.hours}</h4>
            </button>
            {draft.ceilingKind === "hours-per-week" ? (
              <div className="field">
                <label className="lab" htmlFor="charter-hours">{CHARTER_FOUNDING_COPY.hours}</label>
                <input
                  id="charter-hours"
                  type="text"
                  inputMode="decimal"
                  value={draft.ceilingHours}
                  onChange={(event) => setDraft((current) => ({ ...current, ceilingHours: event.target.value }))}
                />
              </div>
            ) : null}
            <button
              type="button"
              className={draft.ceilingKind === "amount-per-month" ? "opt sel" : "opt"}
              aria-pressed={draft.ceilingKind === "amount-per-month"}
              onClick={() => setDraft((current) => ({ ...current, ceilingKind: "amount-per-month" }))}
            >
              <h4>{CHARTER_FOUNDING_COPY.dollars}</h4>
            </button>
            {draft.ceilingKind === "amount-per-month" ? (
              <div className="field">
                <label className="lab" htmlFor="charter-dollars">{CHARTER_FOUNDING_COPY.dollars}</label>
                <input
                  id="charter-dollars"
                  type="text"
                  inputMode="decimal"
                  value={draft.ceilingDollars}
                  onChange={(event) => setDraft((current) => ({ ...current, ceilingDollars: event.target.value }))}
                />
              </div>
            ) : null}
            <button
              type="button"
              className={draft.ceilingKind === "none" ? "opt sel" : "opt"}
              aria-pressed={draft.ceilingKind === "none"}
              onClick={() => setDraft((current) => ({ ...current, ceilingKind: "none" }))}
            >
              <h4>{CHARTER_FOUNDING_COPY.ceilingNone}</h4>
            </button>
          </>
        ) : null}

        {step === 5 ? (
          <>
            <p className="qsub">{CHARTER_FOUNDING_COPY.closeSub}</p>
            <div className="footrow">
              <button type="button" className="btn ghost" disabled={busy} onClick={onDismiss}>
                {CHARTER_FOUNDING_COPY.later}
              </button>
              <button
                type="button"
                className="btn"
                disabled={busy || !household.charter}
                onClick={() => {
                  onCommit((current) => signHouseholdCharter(current, { memberId }));
                  onDismiss();
                }}
              >
                {CHARTER_FOUNDING_COPY.sign}
              </button>
            </div>
          </>
        ) : (
          <div className="footrow">
            <button
              type="button"
              className="link"
              disabled={busy}
              onClick={() => {
                const next = skipCharterFoundingStep(draft, draft.step);
                setDraft(next);
                if (next.step === 5 && !household.charter) {
                  onCommit((current) => commitCharterFounding(current, { memberId, today, draft: next }));
                }
              }}
            >
              {CHARTER_FOUNDING_COPY.skip}
            </button>
            <button type="button" className="btn" disabled={busy} onClick={goNext}>
              {CHARTER_FOUNDING_COPY.next}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

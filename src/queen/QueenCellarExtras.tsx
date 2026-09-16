import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { CommitResult, Household } from "../core/types.ts";
import type { DateKey } from "../core/calendar.ts";
import { formatCad } from "../core/money.ts";
import { cellarIncomeJars, hiddenPayMembers, setMyCellarPay, incomeJarWords, type CellarIncomeJar, type IncomeJarReading } from "../core/cellarIncomeJars.ts";
import {
  agreeMissingRoll, declineMissingRoll, missingRollGoals, missingSubscriptions, missingWords, offerMissingRoll,
  rollMissingSubscription, withdrawMissingRoll, type MissingReading, type MissingSubscription,
} from "../core/missingSubscriptions.ts";
import type { CellarDay } from "../core/queenCellar.ts";
import { ConfirmSheet } from "../Confirm.tsx";
import { cellarV3Enabled } from "./cellarV3Flag.ts";
import type { CellarRailExtra } from "./QueenCellarRail.tsx";
import { cellarDayLabel } from "./QueenCellarRail.tsx";

type Run = (fn: (current: Household) => CommitResult) => Promise<unknown>;

/** Whether this person's own Personal pay may shape their own glass jar — this phone only, never synced. Default off. */
export const CELLAR_OWN_PAY_KEY = "hearth.queen.cellar.ownPrivatePay";
export function readOwnPayOptIn(): boolean {
  try { return typeof localStorage !== "undefined" && localStorage.getItem(CELLAR_OWN_PAY_KEY) === "1"; } catch { return false; }
}
function storeOwnPayOptIn(value: boolean): void {
  try { if (typeof localStorage !== "undefined") { if (value) localStorage.setItem(CELLAR_OWN_PAY_KEY, "1"); else localStorage.removeItem(CELLAR_OWN_PAY_KEY); } } catch { /* a private window forgets */ }
}

/** The command's outcome says the books took it (the loft's rule): a bare resolve counts; `ok: false` or nothing does not. */
export function cellarPostedOk(result: unknown): boolean {
  if (result === undefined) return true;
  if (!result || typeof result !== "object") return false;
  const outcome = result as { ok?: unknown; postedNothing?: unknown };
  return outcome.ok === true && outcome.postedNothing !== true;
}
const refusedWords = (result: unknown, fallback: string) => {
  const message = result && typeof result === "object" ? (result as { userMessage?: unknown }).userMessage : null;
  return typeof message === "string" && message.trim() ? `${message} Nothing changed.` : fallback;
};

/** Everything the cellar's extra jars need, read once per render of the room. */
export function useCellarExtras(input: { household?: Household; memberId?: string; today?: DateKey; days?: CellarDay[]; open: boolean; onCommand?: Run; enabled?: boolean }) {
  const { memberId, today, days, open, onCommand } = input;
  // D-281: behind VITE_CELLAR_V3 (default off). Off, nothing is read, drawn or written.
  const enabled = input.enabled ?? cellarV3Enabled();
  const household = enabled ? input.household : undefined;
  const [ownPay, setOwnPay] = useState(readOwnPayOptIn);
  const missing: MissingReading | null = useMemo(() => household && memberId && today ? missingSubscriptions(household, { today, memberId }) : null, [household, memberId, today]);
  const income: IncomeJarReading | null = useMemo(() => household && memberId && today ? cellarIncomeJars(household, { today, memberId, days, ownPrivateOptIn: ownPay }) : null, [household, memberId, today, days, ownPay]);
  // An offer of mine with nothing left to answer (charged, changed, cancelled, expired, or already rolled) is taken back, once, while the room is open.
  const withdrawn = useRef(new Set<string>());
  useEffect(() => {
    if (!open || !onCommand || !memberId || !missing) return;
    for (const rowId of missing.voidRowIds) {
      if (withdrawn.current.has(rowId)) continue;
      withdrawn.current.add(rowId);
      void onCommand((current) => withdrawMissingRoll(current, { memberId, rowId })).catch(() => { withdrawn.current.delete(rowId); });
    }
  }, [open, onCommand, memberId, missing]);
  const monthStart = today ? `${today.slice(0, 7)}-01` : "";
  const extras = useMemo<CellarRailExtra[]>(() => {
    const rows: CellarRailExtra[] = [];
    for (const jar of income?.jars ?? []) {
      if (jar.date < monthStart) continue;
      const who = jar.mine ? "Your" : `${jar.memberName}'s`;
      rows.push(jar.state === "hypothetical"
        ? { id: jar.id, date: jar.date, kind: "income", cents: jar.expectedCents, label: `${who} pay, ${cellarDayLabel(jar.date)} — glass: if all of it came in. Not money in the Fund.` }
        : { id: jar.id, date: jar.date, kind: "contribution", cents: jar.contributedCents, fill: jar.contributedCents > 0 ? 1 : 0, label: `${who} contributions since pay day, ${cellarDayLabel(jar.date)} — a kitty bank of what actually came in` });
    }
    for (const entry of missing?.open ?? []) {
      rows.push({ id: entry.id, date: entry.railDate, kind: entry.kind, cents: entry.usualCents, stage: entry.stage,
        label: `${entry.label} — ${entry.kind === "missing" ? "missing: not charged" : "smaller: came in lower"}, ${cellarDayLabel(entry.date)}${entry.carried ? ", carried over" : ""}${entry.stage === "rolled" ? ", rolled into a goal" : entry.stage === "agreed" ? ", both said yes" : entry.stage === "offered" ? ", an offer is waiting" : ""}` });
    }
    return rows;
  }, [income, missing, monthStart]);
  const toggleOwnPay = () => setOwnPay((current) => { storeOwnPayOptIn(!current); return !current; });
  const myPayHidden = Boolean(household && memberId && hiddenPayMembers(household).has(memberId));
  return { missing, income, extras, ownPay, toggleOwnPay, myPayHidden };
}

/** A short burst of sparks when a missing jar is opened. Reduced motion shows the sparks still (CSS). */
export function CellarCheer({ kind }: { kind: "missing" | "smaller" }) {
  return (
    <div className="queen-cellar-cheer" data-kind={kind} aria-hidden="true">
      {Array.from({ length: 10 }, (_, index) => <i key={index} style={{ ["--spark" as string]: index }} />)}
    </div>
  );
}

export function CellarMissingCard({ entry, household, memberId, today, busy, onCommand, custodianId, cardRef, onClose }: {
  entry: MissingSubscription;
  household: Household;
  memberId: string;
  today: DateKey;
  busy: boolean;
  onCommand?: Run;
  custodianId: string | null;
  cardRef: RefObject<HTMLElement | null>;
  onClose: () => void;
}) {
  const goals = missingRollGoals(household);
  const [goalId, setGoalId] = useState(goals[0]?.id ?? "");
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // The Confirm stands in the room, not inside the glass card (the card's backdrop filter would hold a fixed sheet inside it).
  const [sheetHost, setSheetHost] = useState<Element | null>(null);
  useEffect(() => { setSheetHost(cardRef.current?.closest(".queen-room") ?? null); }, [cardRef]);
  const custodian = household.members.find((row) => row.id === custodianId) ?? null;
  const partner = household.members.find((row) => row.active && row.id !== custodianId) ?? null;
  const isCustodian = custodianId === memberId;
  const amount = formatCad(entry.differenceCents);
  const run = (fn: (current: Household) => CommitResult, done: string, fallback: string) => {
    if (!onCommand) return;
    void onCommand(fn).then(
      (result) => setNotice(cellarPostedOk(result) ? done || null : refusedWords(result, fallback)),
      (error: unknown) => setNotice(error instanceof Error ? `${error.message} Nothing changed.` : fallback),
    );
  };
  const offer = entry.offer;
  const goalName = offer?.goalName ?? "a goal";
  let words: string;
  if (entry.stage === "rolled") words = `Rolled ${formatCad(entry.rolledCents)} into ${household.goals.find((goal) => goal.id === entry.rolledGoalIds[0])?.name ?? "a goal"} through the Fund's rollover. It won't roll again.`;
  else if (entry.stage === "agreed") words = isCustodian ? `${partner?.name ?? "Your partner"} said yes. Roll ${amount} into ${goalName} when you're ready.` : `You said yes. ${custodian?.name ?? "The custodian"} rolls ${amount} into ${goalName}.`;
  else if (entry.stage === "offered") words = isCustodian ? `You offered to roll ${amount} into ${goalName}. Waiting on ${partner?.name ?? "your partner"}.` : `${custodian?.name ?? "The custodian"} offers to roll ${amount} into ${goalName}.`;
  else if (offer?.state === "declined") words = `${partner?.name ?? "Your partner"} set the offer aside: “${offer.declineReason ?? ""}”${isCustodian ? " You can offer again." : ""}`;
  else words = isCustodian ? `Roll ${entry.kind === "missing" ? "the whole" : "the"} ${amount} into a goal kitty bank? ${partner?.name ?? "Your partner"} confirms first.` : `${custodian?.name ?? "The custodian"} holds the Fund, so they can offer to roll ${amount} into a goal; you confirm it.`;
  return (
    <section ref={cardRef} className="queen-jar-card queen-jar-card--missing" aria-label={`${entry.label} — ${entry.kind === "missing" ? "missing" : "came in lower"}`} tabIndex={-1}
      onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}>
      <CellarCheer kind={entry.kind} />
      <header className="queen-jar-card__head">
        <p className="queen-jar-card__kicker">{entry.kind === "missing" ? "missing · a little windfall" : "came in lower · a little windfall"}</p>
        <h3 className="queen-jar-card__title">{entry.label}</h3>
        <button type="button" className="queen-jar-card__close" aria-label="Close the card" onClick={onClose}>×</button>
      </header>
      <p className="queen-room__line queen-jar-card__line" role="status"><em>{entry.kind === "missing" ? "Not charged." : "Smaller."}</em> {missingWords(entry, formatCad)}</p>
      <p className="queen-jar-card__note">{words}</p>
      {entry.stage !== "rolled" && (
        <div className="queen-jar-card__more queen-missing-acts">
          {isCustodian && entry.stage === "open" && goals.length > 0 && (
            <>
              <label className="queen-missing-goal">
                <span>Into</span>
                <select value={goalId} onChange={(event) => setGoalId(event.currentTarget.value)} disabled={busy}>
                  {goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.name}</option>)}
                </select>
              </label>
              <button type="button" className="queen-go queen-go--primary" disabled={busy || !goalId}
                onClick={() => run((current) => offerMissingRoll(current, { today, memberId, entryId: entry.id, goalId }), `Offered. ${partner?.name ?? "Your partner"} sees it in the cellar and at the Sitdown. No money moved.`, "The offer could not be saved.")}>
                Offer to roll {amount}
              </button>
            </>
          )}
          {isCustodian && entry.stage === "open" && goals.length === 0 && <span className="queen-jar-card__note">Start a shared goal kitty bank first; the roll lands in one.</span>}
          {isCustodian && (entry.stage === "offered" || entry.stage === "agreed") && offer && (
            <button type="button" className="queen-go" disabled={busy}
              onClick={() => run((current) => withdrawMissingRoll(current, { memberId, rowId: offer.rowId }), "Offer taken back. No money moved.", "The offer could not be taken back.")}>
              Take the offer back
            </button>
          )}
          {isCustodian && entry.stage === "agreed" && (
            <button type="button" className="queen-go queen-go--primary" disabled={busy || !onCommand} onClick={() => setConfirming(true)}>Roll {amount} into {goalName}</button>
          )}
          {!isCustodian && entry.stage === "offered" && (
            <>
              <button type="button" className="queen-go queen-go--primary" disabled={busy}
                onClick={() => run((current) => agreeMissingRoll(current, { today, memberId, entryId: entry.id }), `You said yes. ${custodian?.name ?? "The custodian"} rolls it; nothing has moved yet.`, "Your yes could not be saved.")}>
                Yes, roll it
              </button>
              <button type="button" className="queen-go" disabled={busy}
                onClick={() => run((current) => declineMissingRoll(current, { today, memberId, entryId: entry.id }), "Set aside. It stays in the Fund's water.", "That could not be saved.")}>
                Not this one
              </button>
            </>
          )}
        </div>
      )}
      {notice && <p className="queen-room__line queen-cellar-notice" role="status">{notice}</p>}
      {confirming && onCommand && sheetHost && createPortal(
        <ConfirmSheet
          title={`Roll ${amount} into ${goalName}`}
          body={`${entry.label} ${entry.kind === "missing" ? `wasn't charged for ${cellarDayLabel(entry.date)}` : `came in ${amount} lower on ${cellarDayLabel(entry.date)}`}, and ${partner?.name ?? "your partner"} said yes. This reserves ${amount} of the Fund's safe surplus for ${goalName}, once, through the Fund's rollover.`}
          extra="Hearth records the roll-over in your books. It does not move money at your bank. If the Fund's safe surplus is too small, nothing moves."
          confirmLabel={`Roll ${amount}`}
          busy={busy}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            run((current) => rollMissingSubscription(current, { today, memberId, entryId: entry.id }), "", "The roll-over was refused. Nothing moved.");
          }}
        />, sheetHost,
      )}
    </section>
  );
}

export function CellarIncomeCard({ jar, ownPay, onToggleOwnPay, busy, onCommand, memberId, cardRef, onClose }: {
  jar: CellarIncomeJar;
  ownPay: boolean;
  onToggleOwnPay: () => void;
  busy: boolean;
  onCommand?: Run;
  memberId: string;
  cardRef: RefObject<HTMLElement | null>;
  onClose: () => void;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const hide = () => {
    if (!onCommand) return;
    if (!jar.mine) return;
    void onCommand((current) => setMyCellarPay(current, { memberId: jar.memberId, actorMemberId: memberId, choice: "hide", at: new Date().toISOString() })).then(
      (result) => setNotice(cellarPostedOk(result) ? "Your pay is hidden from the jars on both phones." : refusedWords(result, "That could not be saved.")),
      (error: unknown) => setNotice(error instanceof Error ? error.message : "That could not be saved."),
    );
  };
  return (
    <section ref={cardRef} className={`queen-jar-card queen-jar-card--${jar.state}`} aria-label={`${jar.mine ? "Your" : `${jar.memberName}'s`} ${jar.state === "hypothetical" ? "pay, if all of it came in" : "contributions since pay day"}`} tabIndex={-1}
      onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}>
      <header className="queen-jar-card__head">
        <p className="queen-jar-card__kicker">{jar.state === "hypothetical" ? "glass · hypothetical" : "contribution kitty bank"}</p>
        <h3 className="queen-jar-card__title">{jar.mine ? "Your" : `${jar.memberName}'s`} pay day · {cellarDayLabel(jar.date)}</h3>
        <button type="button" className="queen-jar-card__close" aria-label="Close the card" onClick={onClose}>×</button>
      </header>
      <p className="queen-room__line queen-jar-card__line" aria-live="polite"><em>{jar.state === "hypothetical" ? "If." : "Contributed."}</em> {incomeJarWords(jar, formatCad)}</p>
      {jar.state === "hypothetical" && (
        <p className="queen-jar-card__note">Pay isn't linked to the Fund. On the pay day this glass goes, and a kitty bank shows what was actually contributed.{jar.sources.includes("own-private") ? " Your private pay is included on this phone only." : ""}</p>
      )}
      {jar.mine && (
        <div className="queen-jar-card__more">
          {jar.state === "hypothetical" && <button type="button" className="queen-go" disabled={busy || !onCommand} onClick={hide}>Hide my pay from the jars</button>}
          <button type="button" className="queen-go" aria-pressed={ownPay} onClick={onToggleOwnPay}>{ownPay ? "Private pay included · this phone" : "Include my private pay · this phone"}</button>
        </div>
      )}
      {notice && <p className="queen-room__line queen-cellar-notice" role="status">{notice}</p>}
    </section>
  );
}

/** The quiet line about pay that is hidden or not shared. */
export function incomeNoteWords(income: IncomeJarReading | null): string {
  if (!income) return "";
  const parts: string[] = [];
  for (const row of income.hidden) parts.push(row.mine ? "Your pay is hidden from the jars." : `${row.name} keeps their pay out of the jars.`);
  for (const row of income.unshared) parts.push(row.mine ? "Your pay day is shared, not its amount, so there's no glass jar." : `${row.name}'s pay day is shared, not its amount.`);
  return parts.join(" ");
}

/** Show my pay again: the newest mark wins on both phones. */
export function showMyPay(onCommand: Run, memberId: string): Promise<unknown> {
  return onCommand((current) => setMyCellarPay(current, { memberId, actorMemberId: memberId, choice: "show", at: new Date().toISOString() }));
}

import { useId, useState } from "react";
import { appendPlanSitdownTurn } from "../../../core/index.ts";
import { formatDayLabel, monthKeyFromDateKey, weekBounds, type DateKey } from "../../../core/calendar.ts";
import { requiredPlanMemberIds } from "../../../core/planSystem.ts";
import type { Household } from "../../../core/types.ts";
import type { KitchenCommand } from "../../../kitchenCommand.ts";
import { useDialog } from "../../../useDialog.ts";
import { weeklySession, weeklySitdownId } from "./model.ts";
import { outcomeRefusal, useCampfireWrite } from "./useCampfireWrite.ts";
import "./ritual.css";

export type WeeklySitdownProps = {
  household: Household;
  memberId: string;
  today: DateKey;
  busy: boolean;
  onCommand: KitchenCommand;
  onClose: () => void;
  /** Optional: ask Hercules to answer a shared talking point (the App's existing Shared reply route). */
  onSharedHerculesReply?: (sessionId: string, inReplyToTurnId: string) => Promise<void>;
};

/**
 * The weekly Sitdown: two chairs at the week's flagstone (TIME.md D29).
 * A look at the strip together and a talking point or two — Sitdown turns
 * only. It never closes a Chapter, never closes the books, never seals and
 * never makes a digest — that is the Campfire's work, once a month.
 */
export function WeeklySitdown({ household, memberId, today, busy, onCommand, onClose, onSharedHerculesReply }: WeeklySitdownProps) {
  const titleId = useId();
  const dialogRef = useDialog(true, onClose);
  const { relay, status, setStatus, error, setError } = useCampfireWrite(onCommand);
  const [text, setText] = useState("");
  const week = weekBounds(today);
  const month = monthKeyFromDateKey(today);
  const session = weeklySession(household, today);
  const sat = new Set(session?.participantMemberIds ?? []);
  const name = (id: string | undefined) => household.members.find((row) => row.id === id)?.name ?? "Your partner";
  const chairs = requiredPlanMemberIds(household);
  const turn = async (message: string, announce: string, ask = false): Promise<boolean> => {
    setError(null);
    try {
      const outcome = await relay((current) => appendPlanSitdownTurn(current, {
        ...(session?.state === "active" ? { sessionId: session.id } : {}),
        sitDownSessionId: weeklySitdownId(today), monthKey: month, planDraftId: `PLAN-${month}`, memberId, text: message,
      }));
      const refusal = outcomeRefusal(outcome);
      if (refusal) { setError(refusal); return false; }
      setStatus(announce);
      const saved = outcome && typeof outcome === "object" && "household" in outcome ? weeklySession((outcome as { household: Household }).household, today) : null;
      const last = saved?.turns.at(-1);
      if (ask && onSharedHerculesReply && saved && last) {
        await onSharedHerculesReply(saved.id, last.id).catch(() => setError("Your talking point is saved. Hercules could not reply; try again when connected."));
      }
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Not saved. Nothing changed.");
      return false;
    }
  };
  return (
    <div ref={dialogRef} className="campfire-ritual campfire-ritual--weekly" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="campfire-ritual__sheet">
        <header className="campfire-ritual__head">
          <div>
            <p className="campfire-ritual__kicker">Two chairs · week of {formatDayLabel(week.start)}</p>
            <h2 id={titleId} tabIndex={-1} data-autofocus>Sitdown</h2>
          </div>
          <button type="button" className="campfire-ritual__put-back" onClick={onClose}>Put it back</button>
        </header>
        <p>Look at the strip together: this week's bills, paydays and shifts.</p>
        <ul className="campfire-chairs" aria-label="The two chairs">
          {chairs.map((id) => (
            <li key={id} className={`campfire-chair${sat.has(id) ? " is-here" : ""}`}>
              <span className="campfire-chair__log" aria-hidden="true" />
              <strong>{id === memberId ? "You" : name(id)}</strong>
              <span>{sat.has(id) ? "sat down this week" : "not yet this week"}</span>
            </li>
          ))}
        </ul>
        {!sat.has(memberId) && (
          <button type="button" className="campfire-primary" aria-disabled={busy || undefined} onClick={() => { if (!busy) void turn(`${name(memberId)} took a chair.`, "You took a chair"); }}>Take my chair</button>
        )}
        {session && session.turns.length > 0 && (
          <ol className="campfire-list campfire-turns" aria-label="This week's talking points">
            {session.turns.map((row) => <li key={row.id}><strong>{row.role === "hercules" ? "Hercules" : row.memberId === memberId ? "You" : name(row.memberId)}</strong> {row.text}</li>)}
          </ol>
        )}
        <form onSubmit={(event) => {
          event.preventDefault();
          if (busy || !text.trim()) return;
          void turn(text.trim(), "Talking point shared", Boolean(onSharedHerculesReply)).then((ok) => { if (ok) setText(""); });
        }}>
          <label>A talking point we share<textarea value={text} onChange={(event) => setText(event.target.value)} rows={2} /></label>
          <button type="submit" aria-disabled={busy || !text.trim() || undefined}>{onSharedHerculesReply ? "Share and ask Hercules" : "Share it"}</button>
        </form>
        <p className="campfire-ritual__status" role="status">{status}</p>
        {error && <p className="campfire-ritual__error" role="alert">{error}</p>}
      </div>
    </div>
  );
}

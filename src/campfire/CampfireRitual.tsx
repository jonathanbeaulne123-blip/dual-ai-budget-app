import { useEffect, useId, useRef, useState } from "react";
import { formatMonthLabel, type DateKey } from "../core/calendar.ts";
import { openChapterFor, pendingChapterClosure } from "../core/chapters.ts";
import type { Household } from "../core/types.ts";
import type { Dashboard } from "../core/insights.ts";
import { useDialog } from "../useDialog.ts";
import { ArriveBeat, LookAheadBeat, LookBackBeat, SealBeat, SettleBeat, type BeatProps } from "./beats.tsx";
import { CAMPFIRE_BEATS, CAMPFIRE_BEAT_TITLES, campfireMonth, nextBeat, previousBeat, type CampfireBeat } from "./model.ts";
import { useCampfireWrite, type CampfireRun } from "./useCampfireWrite.ts";
import { CampfireGlyph } from "./CampfireGlyph.tsx";
import "./ritual.css";

export type CampfireRitualProps = {
  household: Household;
  memberId: string;
  today: DateKey;
  busy: boolean;
  /** The App's `runKitchen`: every write at the fire is an existing captured command sent through it. */
  onCommand: CampfireRun;
  /** "Put it back": closes the sheet; focus returns to the invoker. */
  onClose: () => void;
  /** The books' own dashboard, for the month's charts (Look back) and where leftover goes (Settle). */
  sitDown?: { dashboard: Dashboard; displayHousehold?: Household } | null;
  /** Live presence, when the App has it: who is on the island right now. Display only. */
  presentMemberIds?: readonly string[];
  /** The Kitchen's table, for "Lay a card" when next month has none. */
  onOpenTable?: () => void;
  /** Where the sheet opens; by default Arrive, or the Seal while a seal waits on this person. */
  initialBeat?: CampfireBeat;
};

/**
 * The Campfire (Tool Atlas T29′, decision D3): one five-beat ritual, monthly,
 * two people, as a working surface over the map. It replaces three screens —
 * the classic Sitdown, the Chapter room and Books' leftover guide — and adds
 * no command: every write is one the App already captures.
 */
export function CampfireRitual(props: CampfireRitualProps) {
  const { household, memberId, today, busy, onCommand, onClose } = props;
  const titleId = useId();
  const chapter = openChapterFor(household);
  const pendingSeal = chapter ? pendingChapterClosure(chapter) : null;
  const [beat, setBeat] = useState<CampfireBeat>(() => props.initialBeat ?? (pendingSeal && !pendingSeal.approvals.some((row) => row.memberId === memberId) ? "seal" : "arrive"));
  const { write, relay, status, setStatus, error } = useCampfireWrite(onCommand);
  const dialogRef = useDialog(true, onClose);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    headingRef.current?.focus();
  }, [beat]);

  const month = campfireMonth(household, today);
  const beatProps: BeatProps = { household, memberId, today, busy, write, relay, sitDown: props.sitDown ?? null, announce: setStatus };
  const next = nextBeat(beat), back = previousBeat(beat);

  return (
    <div ref={dialogRef} className="campfire-ritual" role="dialog" aria-modal="true" aria-labelledby={titleId} data-beat={beat}>
      <div className="campfire-ritual__sheet">
        <header className="campfire-ritual__head">
          <CampfireGlyph />
          <div>
            <p className="campfire-ritual__kicker">The Campfire · {formatMonthLabel(month)}</p>
            <h2 id={titleId}>{chapter ? chapter.title : "The Campfire"}</h2>
          </div>
          <button type="button" className="campfire-ritual__put-back" onClick={onClose}>Put it back</button>
        </header>
        <nav className="campfire-ritual__beats" aria-label="The five beats">
          <ol>
            {CAMPFIRE_BEATS.map((row, index) => (
              <li key={row}>
                <button type="button" aria-current={row === beat ? "step" : undefined} onClick={() => setBeat(row)}>
                  <span className="campfire-ritual__beat-number" aria-hidden="true">{index + 1}</span>
                  {CAMPFIRE_BEAT_TITLES[row]}
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <section className="campfire-beat" aria-labelledby={`${titleId}-beat`} data-campfire-beat={beat}>
          <h3 id={`${titleId}-beat`} ref={headingRef} tabIndex={-1} data-autofocus>{CAMPFIRE_BEAT_TITLES[beat]}</h3>
          {beat === "arrive" && <ArriveBeat {...beatProps} {...(props.presentMemberIds ? { presentMemberIds: props.presentMemberIds } : {})} />}
          {beat === "look-back" && <LookBackBeat {...beatProps} />}
          {beat === "settle" && <SettleBeat {...beatProps} />}
          {beat === "look-ahead" && <LookAheadBeat {...beatProps} {...(props.onOpenTable ? { onOpenTable: props.onOpenTable } : {})} />}
          {beat === "seal" && <SealBeat {...beatProps} />}
        </section>
        <footer className="campfire-ritual__foot">
          {back && <button type="button" onClick={() => setBeat(back)}>Back to {CAMPFIRE_BEAT_TITLES[back]}</button>}
          {next && <button type="button" className="campfire-primary" onClick={() => setBeat(next)}>Next: {CAMPFIRE_BEAT_TITLES[next]}</button>}
        </footer>
        <p className="campfire-ritual__status" role="status">{status}</p>
        {error && <p className="campfire-ritual__error" role="alert">{error}</p>}
      </div>
    </div>
  );
}

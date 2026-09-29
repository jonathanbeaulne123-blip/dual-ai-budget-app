/**
 * The household piece's panel and its device-local look picker (T4, P4). The piece is the household's place in the
 * Journey (today's period) — not a score. Its look is saved on this device only (a synced look would need schema).
 */
import { useId } from "react";
import type { JourneyBoard, PieceLookId } from "../contracts.ts";
import { PIECE_LOOKS } from "../contracts.ts";
import { COPY, longDate, monthWords, PIECE_LOOK_WORDS } from "./copy.ts";
import { PanelFrame } from "./StopPanel.tsx";

export function PieceLook({ value, onChange }: { value: PieceLookId; onChange(look: PieceLookId): void }) {
  const name = useId();
  return (
    <fieldset className="journey-piece-look">
      <legend>{COPY.pieceLookLegend}</legend>
      <div className="journey-piece-look__options">
        {PIECE_LOOKS.map((look) => (
          <label key={look} className={["journey-piece-look__option", `journey-piece-look__option--${look}`, look === value ? "is-chosen" : ""].filter(Boolean).join(" ")}>
            <input type="radio" name={name} value={look} checked={look === value} onChange={() => onChange(look)} />
            <span>{PIECE_LOOK_WORDS[look]}</span>
          </label>
        ))}
      </div>
      <p className="journey-panel__quiet">{COPY.pieceLookNote}</p>
    </fieldset>
  );
}

export type PiecePanelProps = {
  board: JourneyBoard;
  look: PieceLookId;
  onLook(look: PieceLookId): void;
  onSelect(id: string): void;
  onClose(): void;
  headingRef?: (el: HTMLHeadingElement | null) => void;
};

export function PiecePanel({ board, look, onLook, onSelect, onClose, headingRef }: PiecePanelProps) {
  const waiting = board.piece.waitingChapterId;
  const waitingReview = waiting ? board.stops.find((s) => s.id === `review:${waiting}`) : undefined;
  return (
    <PanelFrame kindWords={COPY.pieceTitle} title={COPY.weAreHere} onClose={onClose} className="journey-panel--piece" headingRef={headingRef}>
      <p className="journey-panel__lead">{longDate(board.piece.atDate)} · {board.summary.periodLabel}</p>
      {waiting ? (
        <p className="journey-panel__quiet">
          {monthWords(waiting)}’s Chapter is still open; its close is due whenever you sit down together.{" "}
          {waitingReview ? <button type="button" className="journey-link" onClick={() => onSelect(waitingReview.id)}>Show its close</button> : null}
        </p>
      ) : null}
      <PieceLook value={look} onChange={onLook} />
    </PanelFrame>
  );
}

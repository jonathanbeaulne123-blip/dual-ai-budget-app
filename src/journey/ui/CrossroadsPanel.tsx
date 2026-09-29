/**
 * A crossroads (T4): select → preview an alternative → understand what changes → continue in the surface that owns
 * the choice, or return without changing anything.
 *
 * - Previewing calls ONLY `onPreview` (the stage draws it provisionally: `scene.setPreview` / the flat twin's dashed
 *   ring) and shows the banner "Preview — nothing has changed". No action runs.
 * - The differences are the model's existing-calculation preview data (era rows, `planVersionDiff`, the two home
 *   layouts), printed as they are. Nothing is estimated here.
 * - "Continue in <surface>…" runs `confirm.call` once (it opens the Era planner / HomeBook / kitchen table, which keep
 *   their own Confirm). "Return without changing" clears the preview.
 */
import type { Crossroads, JourneyBoardActions } from "../contracts.ts";
import { runJourneyAction } from "../contracts.ts";
import type { PreviewSelection } from "../board/index.ts";
import { COPY, longDate, previewLines } from "./copy.ts";
import { PanelFrame } from "./StopPanel.tsx";

export type CrossroadsPanelProps = {
  crossroads: Crossroads;
  actions: JourneyBoardActions;
  preview: PreviewSelection | null;
  onPreview(preview: PreviewSelection | null): void;
  onClose(): void;
  nameOf?: (memberId: string) => string;
  headingRef?: (el: HTMLHeadingElement | null) => void;
};

export function CrossroadsPanel({ crossroads, actions, preview, onPreview, onClose, nameOf, headingRef }: CrossroadsPanelProps) {
  const active = preview && preview.crossroadsId === crossroads.id ? preview.alternativeId : null;
  const shown = crossroads.alternatives.find((a) => a.id === active) ?? null;
  const previewing = Boolean(shown && !shown.isCurrent);
  const waiting = crossroads.waitingOn.map((id) => nameOf?.(id) ?? "your partner");
  return (
    <PanelFrame kindWords={`Crossroads · ${longDate(crossroads.date)}`} title={crossroads.label} onClose={onClose} className="journey-panel--crossroads" headingRef={headingRef}>
      {previewing ? <p className="journey-preview-banner" role="status">{COPY.previewBanner}</p> : null}
      <p className="journey-panel__question">{crossroads.question}</p>
      <fieldset className="journey-alternatives">
        <legend className="journey-visually-hidden">{crossroads.question}</legend>
        {crossroads.alternatives.map((alt) => {
          const on = alt.id === active;
          const lines = previewLines(alt.preview);
          return (
            <div key={alt.id} className={["journey-alternative", alt.isCurrent ? "journey-alternative--current" : "journey-alternative--other", on ? "is-previewed" : ""].filter(Boolean).join(" ")}>
              <button
                type="button"
                className="journey-alternative__pick"
                aria-pressed={on}
                data-alternative-id={alt.id}
                onClick={() => onPreview(on ? null : { crossroadsId: crossroads.id, alternativeId: alt.id })}
              >
                <span className="journey-alternative__label">{alt.isCurrent ? `${COPY.currentChoice}: ${alt.label}` : `${COPY.previewPrefix}: ${alt.label}`}</span>
                <span className="journey-alternative__description">{alt.description}</span>
              </button>
              {on && !alt.isCurrent ? (
                lines.length ? (
                  <ul className="journey-alternative__changes" aria-label={`What changes with ${alt.label}`}>
                    {lines.map((line) => <li key={line}>{line}</li>)}
                  </ul>
                ) : <p className="journey-panel__quiet">{COPY.noDifferences}</p>
              ) : null}
            </div>
          );
        })}
      </fieldset>
      {waiting.length ? <p className="journey-panel__quiet">Waiting on {waiting.join(" and ")} to agree.</p> : null}
      <p className="journey-panel__quiet">{crossroads.reversibleNote}</p>
      <div className="journey-actions">
        <button type="button" className="journey-action journey-action--primary" data-action-id={`${crossroads.id}#confirm`} onClick={() => runJourneyAction(actions, crossroads.confirm.call)}>
          {crossroads.confirm.label}
        </button>
        {active ? (
          <button type="button" className="journey-action" onClick={() => onPreview(null)}>{COPY.returnWithoutChanging}</button>
        ) : null}
      </div>
    </PanelFrame>
  );
}

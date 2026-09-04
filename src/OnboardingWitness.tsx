import { useEffect, useRef } from "react";
import type { EvidenceCard, EvidenceResult, OnboardingChapter } from "./core/index.ts";
import { SHELL_VIEW, copy, evidenceCardLabel, evidenceProvenanceLabel } from "./core/index.ts";

// The witness surface (ONBOARDING_BUILD_MANUAL.md slice 8; HEARTH_UX_PACKET.md
// §13.6, plate 12). "Same shell. Turn line names the partner. No action row
// at all." — the rail, the keyboard trap, and the ever-present stop link stay
// in OnboardingChat.tsx, which already owns that chrome for every viewer.
// This component is only the part that differs for a witness: the turn line,
// the Hercules line, the noticed status, and the card — and, definitionally,
// no control that could write the conductor's state. It never renders a
// button, and it is not given a commit callback to call one with.
//
// A witness's evidence always arrives through witnessEvidenceFor (see
// OnboardingChat.tsx and core/onboarding/evidence.ts), which resolves only
// the household-scoped projection and never the conductor's own
// self-personal one. This component does not re-check that scoping — it
// trusts the EvidenceResult it is handed, the same way the conductor's own
// render trusts evidenceFor's. Re-deriving scope here would be a second,
// divergeable copy of a rule evidence.ts already owns.
//
// Deliberately absent from the witness card, unlike the conductor's: the
// honest-length line (taskLengthLabel). It states how long *doing* the
// chapter will take, and a witness is not doing it — showing it here would
// misrepresent whose clock it is.

type Props = {
  turnLine: string;
  hercLine: string;
  chapter: OnboardingChapter;
  evidence: EvidenceResult;
  blockedCopyKey: string | null;
};

/**
 * A stable identity for one accepted evidence event, derived from the card's
 * own content rather than any object reference. Two renders of the *same*
 * event — the household re-fetched, an unrelated prop changed elsewhere in
 * the tree, the other member's device syncing in — produce the identical
 * string, so the noticed strip below keeps the same React key and the same
 * DOM node, and nothing re-announces. A genuinely new event (a different
 * chapter, different sources, a different observed time) produces a
 * different key, so the strip remounts and *does* announce again.
 *
 * The manual (§13.4) names this rule "dedupe on probeEvidenceKey" — the
 * per-member progress field of that exact name (core/onboarding/progress.ts)
 * exists for a future per-chapter probe that isn't built yet (no command in
 * this codebase writes it — see the slice 7 delivery notes). Until that
 * lands, the accepted EvidenceCard is the only signal this shell actually
 * has, so this key is built from the card's own content instead. When the
 * real probeEvidenceKey exists, this function is the one place to fold it
 * in.
 */
export function noticedEvidenceKey(card: EvidenceCard): string {
  return `${card.chapterId}:${[...card.sourceIds].sort().join(",")}:${card.observedAt}`;
}

export function OnboardingWitness({ turnLine, hercLine, chapter, evidence, blockedCopyKey }: Props) {
  const headingRef = useRef<HTMLParagraphElement>(null);

  // Focus lands on the Hercules line once, when the witness screen first
  // mounts — never again on a later re-render of the same screen, so a
  // noticed strip appearing or an evidence card refreshing in place never
  // steals focus from wherever the witness actually is. This mirrors the
  // conductor's own mount-only focus effect in OnboardingChat.tsx.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <>
      {evidence.kind === "accepted" ? (
        <p
          key={noticedEvidenceKey(evidence.card)}
          className="onboarding-noticed"
          role="status"
          aria-live="polite"
        >
          {copy("probe.already")}
        </p>
      ) : null}
      <p className="onboarding-turn" style={{ marginBottom: SHELL_VIEW.turnToHerc }}>{turnLine}</p>
      <p
        className="onboarding-herc"
        style={{ marginBottom: SHELL_VIEW.hercToCard, maxWidth: `${SHELL_VIEW.hercMaxEm}em` }}
        ref={headingRef}
        tabIndex={-1}
      >
        {hercLine}
      </p>
      {blockedCopyKey ? (
        <section className="onboarding-card">
          <p className="onboarding-card-label">Held up</p>
          <p className="onboarding-card-task">{copy(blockedCopyKey)}</p>
        </section>
      ) : evidence.kind === "accepted" ? (
        <section className="onboarding-card">
          <p className="onboarding-card-label">{evidenceCardLabel(evidence.card.kind)}</p>
          {evidence.card.lines.map((line) => (
            <p className="onboarding-card-row" key={`${line.label}-${line.value}`}>
              <span className="onboarding-card-row-label">{line.label}</span>
              <span className="onboarding-card-row-value">{line.value}</span>
            </p>
          ))}
          <p className="onboarding-card-provenance">{evidenceProvenanceLabel(evidence.card.kind)}</p>
        </section>
      ) : (
        <section className="onboarding-card">
          <p className="onboarding-card-label">Waiting</p>
          <p className="onboarding-card-task">{copy(chapter.copyKey)}</p>
        </section>
      )}
    </>
  );
}

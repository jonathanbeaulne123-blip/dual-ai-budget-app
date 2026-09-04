import { useEffect, useRef } from "react";
import type { EvidenceCard, EvidenceResult, OnboardingChapter } from "./core/index.ts";
import {
  SHELL_VIEW,
  copy,
  evidenceCardLabel,
  witnessChapterScopeLabel,
  witnessStatusRows,
} from "./core/index.ts";

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
  noticeKey: string | null;
};

const claimedNoticeKeys = new Set<string>();
const NOTICE_STORAGE_PREFIX = "hearth:onboarding-noticed:v1:";

function noticeStorageKey(key: string): string {
  let left = 0x811c9dc5;
  let right = 0x9e3779b9;
  for (let index = 0; index < key.length; index += 1) {
    const unit = key.charCodeAt(index);
    left = Math.imul(left ^ unit, 0x01000193);
    right = Math.imul(right ^ unit, 0x85ebca6b);
  }
  return `${NOTICE_STORAGE_PREFIX}${(left >>> 0).toString(16)}${(right >>> 0).toString(16)}`;
}

/** Temporary identity until a chapter's accepted probe writes probeEvidenceKey. */
export function noticedEvidenceKey(card: EvidenceCard): string {
  return `evidence:${card.chapterId}:${[...card.sourceIds].sort().join(",")}:${card.observedAt}`;
}

function noticeWasClaimed(key: string): boolean {
  if (claimedNoticeKeys.has(key)) return true;
  try {
    if (window.sessionStorage.getItem(noticeStorageKey(key)) === "1") {
      claimedNoticeKeys.add(key);
      return true;
    }
  } catch {
    // The in-memory claim remains available when storage is unavailable.
  }
  return false;
}

function claimNotice(key: string): void {
  claimedNoticeKeys.add(key);
  try {
    window.sessionStorage.setItem(noticeStorageKey(key), "1");
  } catch {
    // The in-memory claim still prevents repeats when storage is unavailable.
  }
}

/**
 * A keyed child claims one persisted probe event before rendering its live
 * region. The claim survives evidence disappearance and shell remounts in
 * this tab, so the same probeEvidenceKey cannot announce twice.
 */
export function OnboardingNotice({ noticeKey }: { noticeKey: string }) {
  const announce = useRef<boolean | null>(null);
  if (announce.current === null) announce.current = !noticeWasClaimed(noticeKey);
  useEffect(() => {
    if (announce.current) claimNotice(noticeKey);
  }, [noticeKey]);
  if (!announce.current) return null;
  return (
    <p className="onboarding-noticed" role="status" aria-live="polite">
      {copy("probe.already")}
    </p>
  );
}

export function OnboardingWitness({ turnLine, hercLine, chapter, evidence, blockedCopyKey, noticeKey }: Props) {
  const headingRef = useRef<HTMLParagraphElement>(null);
  const acceptedCard = evidence.kind === "accepted" ? evidence.card : null;
  const statusRows = witnessStatusRows(chapter.id, acceptedCard);

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
      {evidence.kind === "accepted" && noticeKey
        ? <OnboardingNotice key={noticeKey} noticeKey={noticeKey} />
        : null}
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
          {statusRows.map((row) => (
            <p className="onboarding-card-row" key={row.id}>
              <span className="onboarding-card-row-label">{row.label}</span>
              <span className="onboarding-card-row-value">{row.status}</span>
            </p>
          ))}
          <p className="onboarding-card-provenance">{witnessChapterScopeLabel(chapter.id)}</p>
        </section>
      ) : (
        <section className="onboarding-card">
          <p className="onboarding-card-label">Waiting</p>
          {statusRows.map((row) => (
            <p className="onboarding-card-row" key={row.id}>
              <span className="onboarding-card-row-label">{row.label}</span>
              <span className="onboarding-card-row-value">{row.status}</span>
            </p>
          ))}
          <p className="onboarding-card-provenance">{witnessChapterScopeLabel(chapter.id)}</p>
        </section>
      )}
    </>
  );
}

import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { CommitResult, Household } from "./core/index.ts";
import {
  CHARTER_SPLIT_HEADING,
  SIGNATURE_VIEW,
  charterAmendmentLines,
  charterCadenceLabel,
  charterCustodianLine,
  charterPageCeilingLabel,
  charterPermissionSentences,
  charterSignatureDateLabel,
  revokeCharterPermission,
  signHouseholdCharter,
  signatureLines,
} from "./core/index.ts";
import "./charter.css";

type Props = {
  household: Household;
  memberId: string;
  busy?: boolean;
  onCommit: (fn: (current: Household) => CommitResult) => void;
  onDismiss: () => void;
};

export function Charter({ household, memberId, busy, onCommit, onDismiss }: Props) {
  const paperRef = useRef<HTMLDivElement>(null);
  const charter = household.charter;
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    function trap(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const paper = paperRef.current;
      if (!paper) return;
      const focusable = [...paper.querySelectorAll<HTMLElement>(
        "button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex='-1'])",
      )].filter((node) => node.getClientRects().length > 0);
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

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onDismiss();
    }
  }

  if (!charter) {
    return (
      <div
        ref={paperRef}
        className="charter-page"
        role="dialog"
        aria-modal="true"
        aria-labelledby="charter-page-title"
        onKeyDown={onKeyDown}
      >
        <div className="charter-page-inner">
          <button type="button" className="charter-close" onClick={onDismiss}>close</button>
          <h1 className="charter-purpose" id="charter-page-title" ref={titleRef} tabIndex={-1}>
            The household charter
          </h1>
        </div>
      </div>
    );
  }

  const custodian = household.members.find((member) => member.id === charter.custodianMemberId);
  const lines = signatureLines(charter, household.members);
  const permissions = charterPermissionSentences(charter);
  const amendments = charterAmendmentLines(charter, household.members);
  const splitHeading = CHARTER_SPLIT_HEADING[charter.splitRule];

  return (
    <div
      ref={paperRef}
      className="charter-page"
      role="dialog"
      aria-modal="true"
      aria-labelledby="charter-page-title"
      onKeyDown={onKeyDown}
    >
      <div className="charter-page-inner">
        <button type="button" className="charter-close" onClick={onDismiss}>close</button>
        <h1 className="charter-purpose" id="charter-page-title" ref={titleRef} tabIndex={-1}>
          {charter.purpose || "The household charter"}
        </h1>
        <hr className="charter-hr" />

        <section className="charter-cl">
          <p className="charter-lab">who holds it</p>
          <p className="charter-txt">{charterCustodianLine(custodian?.name ?? "The custodian")}</p>
        </section>

        <section className="charter-cl">
          <p className="charter-lab">how we decide who puts in what</p>
          <p className="charter-split">{splitHeading}</p>
          {charter.splitNote ? (
            <p className="charter-quote">{`"${charter.splitNote}"`}</p>
          ) : null}
        </section>

        {permissions.length > 0 ? (
          <section className="charter-cl">
            <p className="charter-lab">what either of us can just do</p>
            {permissions.map((permission) => (
              <p className="charter-txt charter-perm" key={permission.id}>
                <span>{permission.label}</span>
                {permission.grantedByMemberId === memberId ? (
                  <button
                    type="button"
                    className="charter-revoke"
                    disabled={busy}
                    onClick={() => onCommit((current) => revokeCharterPermission(current, {
                      memberId,
                      permissionId: permission.id,
                    }))}
                  >
                    revoke
                  </button>
                ) : null}
              </p>
            ))}
          </section>
        ) : null}

        <section className="charter-cl">
          <p className="charter-lab">how much work is too much</p>
          <p className="charter-txt charter-num">{charterPageCeilingLabel(charter)}</p>
        </section>

        <section className="charter-cl">
          <p className="charter-lab">when we sit down</p>
          <p className="charter-txt">{charterCadenceLabel(charter)}</p>
        </section>

        {charter.clauses.map((clause) => (
          <section className="charter-cl" key={clause.id}>
            <p className="charter-lab">{clause.heading}</p>
            <p className="charter-txt">{clause.body}</p>
          </section>
        ))}

        <div className="charter-sigblock">
          {lines.map((line) => {
            const ownUnsigned = line.memberId === memberId && line.signedAt === null;
            return (
              <div className="charter-sig" key={line.memberId}>
                <div
                  className="charter-rule"
                  style={{ width: SIGNATURE_VIEW.ruleWidth, marginBottom: SIGNATURE_VIEW.ruleGap }}
                />
                <p className="charter-who" style={{ fontSize: SIGNATURE_VIEW.nameSize }}>
                  {line.name}
                  {line.signedAt ? (
                    <span className="charter-when">
                      {` · ${charterSignatureDateLabel(line.signedAt)}`}
                    </span>
                  ) : null}
                  {ownUnsigned ? (
                    <button
                      type="button"
                      className="charter-signlink"
                      disabled={busy}
                      onClick={() => onCommit((current) => signHouseholdCharter(current, { memberId }))}
                    >
                      sign
                    </button>
                  ) : null}
                </p>
              </div>
            );
          })}
        </div>

        {amendments.length > 0 ? (
          <section className="charter-cl charter-amends">
            <p className="charter-lab">amendments</p>
            {amendments.map((row) => (
              <p className="charter-txt" key={row.id}>
                {row.body}
                {row.note ? ` ${row.note}` : ""}
              </p>
            ))}
          </section>
        ) : null}
      </div>
    </div>
  );
}

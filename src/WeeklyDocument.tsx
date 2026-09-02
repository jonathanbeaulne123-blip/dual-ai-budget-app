import { useMemo, useState } from "react";
import { ClerkReading } from "./ClerkReading.tsx";
import {
  ASK_ROUTES_HEADER_COPY,
  WEEKLY_DOCUMENT_COPY,
  formatDateLabel,
  stampWeeklyDocument,
  weeklyCad,
  weeklyDocument,
  weeklyMemberName,
  weeklyMotionStatusCopy,
  weeklyRouteCaption,
  type DateKey,
  type Household,
  type UndoToken,
  type WeeklyDocumentView,
} from "./core/index.ts";
import "./weekly-document.css";

export type WeeklyDocumentSurface = "ready" | "loading" | "error" | "offline";

type Props = {
  household: Household;
  viewerMemberId: string;
  today: DateKey;
  hour?: number;
  now?: string;
  surface?: WeeklyDocumentSurface;
  busy?: boolean;
  onApply: (household: Household, undo?: UndoToken) => void;
};

const ACTS = [0, 1, 2, 3] as const;
type WeeklyAct = (typeof ACTS)[number];

function RegisterList({ document, household }: { document: WeeklyDocumentView; household: Household }) {
  if (!document.register.tiesToProjection) {
    return <p className="weekly-status">{WEEKLY_DOCUMENT_COPY.registerUntied}</p>;
  }
  const attribution = [...document.register.byMember]
    .sort((left, right) => left.memberId.localeCompare(right.memberId))
    .map((row) => `${weeklyMemberName(household.members, row.memberId)} · ${weeklyCad(row.amountCents)}`);
  if (document.register.carriedCents > 0) {
    attribution.unshift(`Carried in · ${weeklyCad(document.register.carriedCents)}`);
  }
  return (
    <div className="weekly-register">
      {attribution.length > 0 ? (
        <ul className="weekly-attribution">
          {attribution.map((line) => <li key={line}>{line}</li>)}
        </ul>
      ) : null}
      {document.register.rows.length === 0 ? (
        <p className="weekly-status">No household rows in this month yet.</p>
      ) : (
        <ul className="weekly-register-rows">
          {document.register.rows.map((row) => (
            <li key={row.obligationId} className="weekly-register-row">
              <span className="weekly-register-label">{row.label}</span>
              <span className="weekly-register-date">{formatDateLabel(row.date)}</span>
              <span className="weekly-register-amount">{weeklyCad(row.amountCents)}</span>
              {row.unfundedCents > 0 ? (
                <span className="weekly-unfunded">{weeklyCad(row.unfundedCents)} still open</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AskPanel({ document }: { document: WeeklyDocumentView }) {
  const ask = document.ask;
  if (!ask) return <p className="weekly-status">The ask is not available on this page.</p>;
  return (
    <div className="weekly-ask">
      <p className="weekly-ask-copy">{ask.copy}</p>
      <p className="weekly-ask-figure">{weeklyCad(ask.askCents)}</p>
      <div className="weekly-other-door" data-weekly-other-door="readonly">
        {document.otherDoors.length === 0 ? null : document.otherDoors.map((door) => (
          <p key={door.goalId} className="weekly-other-door-copy">{door.copy}</p>
        ))}
        <p className="weekly-other-door-note">{WEEKLY_DOCUMENT_COPY.otherDoorNote}</p>
      </div>
      {document.routes ? (
        document.routes.kind === "not-enough-data" ? (
          <p className="weekly-status" data-weekly-routes="not-enough-data">{document.routes.copy}</p>
        ) : (
          <div className="weekly-routes" data-weekly-routes="owner" aria-labelledby="weekly-routes-header">
            <p className="weekly-routes-header" id="weekly-routes-header">{ASK_ROUTES_HEADER_COPY}</p>
            {document.routes.routes.length === 0 ? (
              <p className="weekly-status">No optional routes on this Ask.</p>
            ) : (
              <ul className="weekly-route-list">
                {document.routes.routes.map((route, index) => (
                  <li key={`${route.safeCents}-${index}`} className="weekly-route">
                    <span>{weeklyRouteCaption(route, document.routes!.askCents)}</span>
                    <span className="weekly-route-hours">{route.hours}h</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      ) : null}
    </div>
  );
}

function MotionList({ document }: { document: WeeklyDocumentView }) {
  if (document.motions.length === 0) {
    return <p className="weekly-status" data-weekly-motions="empty">{WEEKLY_DOCUMENT_COPY.emptyMotions}</p>;
  }
  return (
    <ul className="weekly-motions">
      {document.motions.map((motion) => (
        <li key={motion.id} className="weekly-motion" data-weekly-motion={motion.id} data-weekly-motion-status={motion.status}>
          <span className="weekly-motion-label">{motion.label}</span>
          <span className="weekly-motion-status">{weeklyMotionStatusCopy(motion.status)}</span>
        </li>
      ))}
    </ul>
  );
}

function StampLines({
  document,
  busy,
  onStamp,
}: {
  document: WeeklyDocumentView;
  busy: boolean;
  onStamp: () => void;
}) {
  return (
    <div className="weekly-stamps">
      {document.stampLines.map((line) => {
        const ownBlank = line.memberId === document.viewerMemberId && line.stamp == null && document.canStampOwnLine;
        return (
          <div className="weekly-stamp" key={line.memberId} data-weekly-stamp-line={line.memberId}>
            <div className="weekly-stamp-rule" />
            <p className="weekly-stamp-who">
              {line.memberName}
              {line.stamp ? (
                <span className="weekly-stamp-when">{` · ${formatDateLabel(line.stamp.stampedAt.slice(0, 10))}`}</span>
              ) : null}
              {ownBlank ? (
                <button
                  type="button"
                  className="weekly-stamp-link"
                  disabled={busy}
                  onClick={onStamp}
                >
                  {WEEKLY_DOCUMENT_COPY.stamp}
                </button>
              ) : null}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function WeeklyDocument({
  household,
  viewerMemberId,
  today,
  hour,
  now,
  surface = "ready",
  busy = false,
  onApply,
}: Props) {
  const document = useMemo(
    () => weeklyDocument(household, { viewerMemberId, today, hour }),
    [household, viewerMemberId, today, hour],
  );
  const [act, setAct] = useState<WeeklyAct>(0);

  if (!document.offered) return null;

  function stampOwnLine() {
    if (!document.canStampOwnLine) return;
    const result = stampWeeklyDocument(household, {
      memberId: viewerMemberId,
      today,
      now,
    });
    onApply(result.household, result.undo);
  }

  return (
    <section
      className="card weekly-document"
      aria-labelledby="weekly-document-title"
      data-weekly-offered="true"
      data-weekly-complete={document.complete ? "true" : "false"}
      data-weekly-act={act}
      data-weekly-surface={surface}
    >
      <header>
        <h2 id="weekly-document-title">{WEEKLY_DOCUMENT_COPY.title}</h2>
        <p className="muted" id="weekly-document-act">
          {act === 0 ? WEEKLY_DOCUMENT_COPY.act0
            : act === 1 ? WEEKLY_DOCUMENT_COPY.act1
              : act === 2 ? WEEKLY_DOCUMENT_COPY.act2
                : WEEKLY_DOCUMENT_COPY.act3}
        </p>
      </header>
      {surface === "loading" ? <p className="weekly-status" role="status">{WEEKLY_DOCUMENT_COPY.loading}</p> : null}
      {surface === "error" ? <p className="weekly-status" role="status">{WEEKLY_DOCUMENT_COPY.error}</p> : null}
      {surface === "offline" ? <p className="weekly-status" role="status">{WEEKLY_DOCUMENT_COPY.offline}</p> : null}
      <div className="weekly-act-body" aria-live="polite" aria-labelledby="weekly-document-act">
        {act === 0 ? <ClerkReading reading={document.reading} household={household} /> : null}
        {act === 1 ? <RegisterList document={document} household={household} /> : null}
        {act === 2 ? <AskPanel document={document} /> : null}
        {act === 3 ? <MotionList document={document} /> : null}
      </div>
      <StampLines document={document} busy={busy} onStamp={stampOwnLine} />
      <div className="chips">
        {act > 0 ? (
          <button className="chip" type="button" onClick={() => setAct((current) => (current - 1) as WeeklyAct)}>
            Back
          </button>
        ) : null}
        {act < 3 ? (
          <button
            className="primary"
            type="button"
            onClick={() => setAct((current) => (current + 1) as WeeklyAct)}
          >
            {act === 0 ? WEEKLY_DOCUMENT_COPY.act1
              : act === 1 ? WEEKLY_DOCUMENT_COPY.act2
                : WEEKLY_DOCUMENT_COPY.act3}
          </button>
        ) : null}
      </div>
    </section>
  );
}

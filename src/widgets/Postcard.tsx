import { SitDownGuide } from "../SitDownGuide.tsx";
import { WeeklyDocument } from "../WeeklyDocument.tsx";
import { POSTCARD_EMPTY, hourInToronto, postcardEmpty, todayKey, weeklyDocument } from "../core/index.ts";
import type { Household, LedgerView, UndoToken } from "../core/index.ts";
import type { Dashboard } from "../core/insights.ts";
import type { SitDownPostcard } from "../core/hercules.ts";

export function PostcardGlance({ card }: { card: SitDownPostcard }) {
  if (postcardEmpty(card)) return <span>face-down</span>;
  return <span className="postcard-face">{card.sentence}</span>;
}

export function PostcardBody({
  household,
  displayHousehold,
  dashboard,
  view,
  memberId,
  card,
  onApply,
}: {
  household: Household;
  displayHousehold?: Household;
  dashboard: Dashboard;
  view: LedgerView;
  memberId?: string;
  card: SitDownPostcard;
  onApply: (next: Household, token?: UndoToken) => void;
}) {
  const today = todayKey();
  const hour = hourInToronto();
  const weeklyOffered = Boolean(
    memberId && weeklyDocument(household, { viewerMemberId: memberId, today, hour }).offered,
  );
  const weekly = weeklyOffered && memberId ? (
    <WeeklyDocument
      household={household}
      viewerMemberId={memberId}
      today={today}
      hour={hour}
      onApply={onApply}
    />
  ) : null;
  if (postcardEmpty(card)) {
    return (
      <>
        {weekly}
        {weeklyOffered ? null : <p className="muted">{POSTCARD_EMPTY}</p>}
      </>
    );
  }
  return (
    <>
      {weekly}
      <SitDownGuide
        household={household}
        displayHousehold={displayHousehold ?? household}
        dashboard={dashboard}
        view={view}
        memberId={memberId}
        onApply={onApply}
      />
    </>
  );
}

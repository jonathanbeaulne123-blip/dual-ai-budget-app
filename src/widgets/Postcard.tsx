import { SitDownGuide } from "../SitDownGuide.tsx";
import { POSTCARD_EMPTY, postcardEmpty } from "../core/index.ts";
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
  card,
  onApply,
}: {
  household: Household;
  displayHousehold?: Household;
  dashboard: Dashboard;
  view: LedgerView;
  card: SitDownPostcard;
  onApply: (next: Household, token?: UndoToken) => void;
}) {
  if (postcardEmpty(card)) {
    return <p className="muted">{POSTCARD_EMPTY}</p>;
  }
  return (
    <SitDownGuide
      household={household}
      displayHousehold={displayHousehold ?? household}
      dashboard={dashboard}
      view={view}
      onApply={onApply}
    />
  );
}

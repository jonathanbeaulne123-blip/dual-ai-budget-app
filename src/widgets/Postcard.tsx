import { SitDownGuide } from "../SitDownGuide.tsx";
import { POSTCARD_EMPTY, postcardEmpty } from "../core/index.ts";
import type { Household, UndoToken } from "../core/index.ts";
import type { SitDownPostcard } from "../core/hercules.ts";

export function PostcardGlance({ card }: { card: SitDownPostcard }) {
  if (postcardEmpty(card)) return <span>face-down</span>;
  return <span className="postcard-face">{card.sentence}</span>;
}

export function PostcardBody({
  household,
  card,
  viewPersonal,
  onApply,
}: {
  household: Household;
  card: SitDownPostcard;
  viewPersonal: boolean;
  onApply: (next: Household, token?: UndoToken) => void;
}) {
  if (postcardEmpty(card)) {
    return <p className="muted">{POSTCARD_EMPTY}</p>;
  }
  return <SitDownGuide household={household} onApply={onApply} hidden={viewPersonal} />;
}

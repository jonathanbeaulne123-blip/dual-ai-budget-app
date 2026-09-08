import { useEffect, useState } from "react";
import { countable } from "./core/budget.ts";
import type { Account, Category, Household } from "./core/types.ts";
import type { AddMode } from "./addSlideshow.ts";

export const MOBILE_ENTRY_QUERY = "(max-width: 719px)";
export function useMobileEntry() {
  const [mobile, setMobile] = useState(() => typeof window.matchMedia === "function" && window.matchMedia(MOBILE_ENTRY_QUERY).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(MOBILE_ENTRY_QUERY);
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return mobile;
}

/** Both the history and the candidates must come from the current permission-filtered desk. */
export function entryRecommendations<T extends Account | Category>(
  candidates: T[], household: Household, mode: AddMode, field: "accountId" | "subcategoryId", today: string,
): T[] {
  const uses = new Map<string, number>();
  for (const tx of household.transactions) {
    if (!countable(tx) || tx.type !== mode || tx.date > today || tx.date.slice(0, 7) !== today.slice(0, 7)) continue;
    const id = tx[field];
    if (id) uses.set(id, (uses.get(id) ?? 0) + 1);
  }
  return candidates.filter(candidate => candidate.active)
    .sort((a, b) => (uses.get(b.id) ?? 0) - (uses.get(a.id) ?? 0))
    .slice(0, 6);
}

export function MobileEntryChoices({ choices, selectedId, excludeId, label, busy, onPick, onMore }: {
  choices: Array<{ id: string; name: string }>;
  selectedId: string;
  excludeId?: string;
  label: string;
  busy: boolean;
  onPick: (id: string) => void;
  onMore: () => void;
}) {
  return <div className="swipe-grid" aria-label={label}>
    {choices.map(choice => <button key={choice.id} type="button" className="swipe-cat"
      aria-pressed={selectedId === choice.id} disabled={busy || choice.id === excludeId}
      onClick={() => onPick(choice.id)}>{choice.name}</button>)}
    <button type="button" className="swipe-cat more" disabled={busy} onClick={onMore}>More</button>
  </div>;
}

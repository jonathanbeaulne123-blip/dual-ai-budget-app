import { useId, useState } from "react";
import type { DateKey } from "../../../core/calendar.ts";
import type { Household } from "../../../core/types.ts";
import { campfireState } from "./model.ts";
import "./ritual.css";

/**
 * The thin door that replaced three screens (the classic Sitdown, the Chapter
 * room, and Books' leftover guide): one line of where the Chapter stands and
 * one button, "Open the Campfire". It writes nothing.
 */
export function CampfireDoor({ household, memberId, today, onOpenCampfire, why }: {
  household: Household;
  memberId: string;
  today: DateKey;
  onOpenCampfire?: (() => void) | undefined;
  /** One short line naming what moved to the Campfire, for the surface this door stands in. */
  why?: string;
}) {
  const reasonId = useId();
  const [told, setTold] = useState(false);
  const state = campfireState(household, memberId, today);
  return (
    <section className="campfire-door" aria-label="The Campfire">
      <p className="campfire-door__line">{state.line}</p>
      {why && <p className="campfire-door__why">{why}</p>}
      <button type="button" className="campfire-primary" aria-disabled={onOpenCampfire ? undefined : true} aria-describedby={onOpenCampfire ? undefined : reasonId}
        onClick={() => { if (onOpenCampfire) onOpenCampfire(); else setTold(true); }}>
        Open the Campfire
      </button>
      {!onOpenCampfire && <span id={reasonId} className={`campfire-reason${told ? " is-told" : ""}`}>The Campfire opens from the shore of the island.</span>}
    </section>
  );
}

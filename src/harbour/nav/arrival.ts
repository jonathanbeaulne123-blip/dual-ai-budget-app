import type { HouseRoute } from "../../hearthside/houseRoutes.ts";
import type { LedgerView } from "../../core/types.ts";
import { COURT_ROUTE, HARBOUR_ENABLED } from "../flag.ts";

/** The part of `sessionStorage` the arrival rule touches. Tests inject a Map-backed fake. */
export type ArrivalSession = Pick<Storage, "getItem" | "setItem">;

export const ARRIVAL_KEY_PREFIX = "hearth:harbour:arrived:";

/** One marker per browser tab per house identity (environment, household, member, scope). */
export function arrivalKey(identity: string): string {
  return `${ARRIVAL_KEY_PREFIX}${identity}`;
}

/** The browser tab's storage, or null where a sandbox or a cookie policy refuses it. */
export function tabSession(): ArrivalSession | null {
  try { return typeof window === "undefined" ? null : window.sessionStorage; } catch { return null; }
}

export function hasArrived(session: ArrivalSession | null | undefined, identity: string): boolean {
  if (!session) return false;
  try { return session.getItem(arrivalKey(identity)) === "1"; } catch { return false; }
}

/** The one write: the tab-session marker. A blocked storage is treated as "already arrived" next time it is read, never as an error. */
export function markArrived(session: ArrivalSession | null | undefined, identity: string): void {
  if (!session) return;
  try { session.setItem(arrivalKey(identity), "1"); } catch { /* Private windows may refuse; the Journey simply shows again. */ }
}

export type ArrivalInput = {
  /** The saved return route for this identity, if any. */
  saved?: HouseRoute | null;
  scope: LedgerView;
  householdId: string;
  /** `houseIdentity(identity)` — the string the house return cache is keyed on. */
  identity: string;
  session: ArrivalSession | null | undefined;
  /**
   * The edition the reader has chosen (`hearth:motion`, read by the caller — this rule stays pure). The reading
   * edition arrives at the Court, where the Desk (the approved simple view) opens as before; the illustrated
   * edition arrives at the Journey Board (D65).
   */
  edition: ArrivalEdition;
  /** Test seam; production reads the flag. */
  enabled?: boolean;
};

/** "reading" = `hearth:motion` "flat" (the Desk); "illustrated" = everything else. */
export type ArrivalEdition = "reading" | "illustrated";

/**
 * The household Journey Board: the Journey surface of the kitchen table's
 * `above` level (D26 / SCALES §1 "the Journey map is the default home").
 * The Mountain square (`COURT_ROUTE`) stays one tap away in All tools.
 */
export function JOURNEY_HOME_ROUTE(householdId: string): HouseRoute {
  return { room: "kitchen-table", level: "above", householdId, scope: "household", surface: "journey" };
}

/**
 * BUILD_PLAN §1.1, amended by D26 / SCALES §1: the first `locate()` of a
 * browser-tab session lands on the household Journey Board (it used to be the
 * Court); a reload in the same tab, or a second arrival, keeps the saved return
 * route. Personal scope is untouched. The reading edition (the Desk) still
 * arrives on the Court (D65). When an arrival is chosen this marks the tab
 * through the injected session so the App seam stays one expression.
 */
export function harbourArrivalRoute(input: ArrivalInput): HouseRoute {
  const { saved, scope, householdId, identity, session, edition, enabled = HARBOUR_ENABLED } = input;
  const fallback: HouseRoute = saved ?? { room: "home", level: "middle", householdId, scope };
  if (!enabled || scope !== "household") return fallback;
  if (hasArrived(session, identity)) return fallback;
  markArrived(session, identity);
  // D65: the reading edition keeps arriving on the Court, so the Desk opens as it always has.
  return edition === "reading" ? COURT_ROUTE(householdId) : JOURNEY_HOME_ROUTE(householdId);
}

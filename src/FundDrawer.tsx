import { DrawerSurface } from "./DrawerSurface.tsx";
import { useEffect, useId, useRef, useState } from "react";
import {
  drawerFor,
  railFor,
  setFundRailSlot,
  type CommitResult,
  type FundWidgetId,
  type Household,
} from "./core/index.ts";

/**
 * The Fund's drawer — every widget, always, for both members.
 *
 * The drawer is itself a stage: it opens where every other expansion opens,
 * so there is no new surface and no settings screen. Swapping is two taps —
 * pick the widget, pick the slot — and nothing here is locked or earned.
 */

export const FUND_DRAWER_INTRO =
  "Choose the readings you want close at hand. Level stays first; the Ask is available on the contributor’s desk.";

export const FUND_WIDGET_CARD: Record<FundWidgetId, { name: string; line: string }> = {
  level: { name: "The Level", line: "the Fund across the month" },
  swipe: { name: "I spent something", line: "review and confirm a household expense" },
  contribute: { name: "I'll put in", line: "raise a contribution motion" },
  waiting: { name: "Waiting on you", line: "motions to confirm or hold" },
  "next-out": { name: "Next out", line: "what leaves, and what it leaves you" },
  "spoken-for": { name: "Spoken for", line: "claimed against the pool" },
  week: { name: "This week", line: "due, posted, and whose turn" },
  shape: { name: "The shape", line: "each category against its own band" },
  streams: { name: "The two streams", line: "six months of confirmed contribution timing" },
  "seven-days": { name: "Last seven days", line: "accepted Fund cash movements over seven days" },
  shelf: { name: "The shelf", line: "goals, claims, and what deferring costs" },
  record: { name: "The record", line: "latest accepted activity and reconciliation" },
  minutes: { name: "The minute book", line: "stamps, sit-downs, signatures" },
  ask: { name: "The Ask", line: "what the month still needs of you" },
  accounts: { name: "The accounts", line: "Shared accounts, one at a glance" },
  settle: { name: "To settle", line: "what the Fund owes back" },
};

/**
 * The library is member-scoped only by `allowed` (the Ask). Everything else
 * — including the Level, pinned though it is — stays in view: it simply
 * refuses a move away from slot one, the same way any other placement can
 * refuse. There is no second, hidden exclusion list here.
 */
export function fundDrawerCards(household: Household, memberId: string, presentation: 'desk' | 'phone' = 'desk'): Array<{
  id: FundWidgetId;
  onRail: boolean;
}> {
  return drawerFor(household, memberId,presentation)
    .filter((row) => row.allowed)
    .map((row) => ({ id: row.id, onRail: row.onRail }));
}

export function FundDrawer({
  household,
  memberId,
  busy,
  onKitchen,
  onClose,
  embedded = false,
}: {
  embedded?: boolean;
  household: Household;
  memberId: string;
  busy: boolean;
  onKitchen: (fn: (current: Household) => CommitResult) => void;
  onClose: () => void;
}) {
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const [phone,setPhone]=useState(()=>window.innerWidth<=719);
  useEffect(()=>{const update=()=>setPhone(window.innerWidth<=719);window.addEventListener("resize",update);return()=>window.removeEventListener("resize",update);},[]);
  useEffect(()=>{heading.current?.focus();},[]);
  const [pickingId, setPickingId] = useState<FundWidgetId | null>(null);
  const cards = fundDrawerCards(household, memberId,phone?'phone':'desk');
  const rail = railFor(household, memberId,phone?'phone':'desk');
  const picking = pickingId ? cards.find((row) => row.id === pickingId) ?? null : null;

  function chooseSlot(slot: number) {
    if (!pickingId) return;
    const widgetId = pickingId;
    onKitchen((current) => setFundRailSlot(current, { memberId, createdBy: memberId, slot, widgetId, presentation:phone?"phone":"desk" }));
    setPickingId(null);
  }

  return (
    <DrawerSurface title="Arrange widgets" onClose={onClose} embedded={embedded}><section className="fund-drawer" aria-labelledby={headingId}>
      <div className="fund-drawer-head">
        <h2 ref={heading} id={headingId} tabIndex={-1} className="fund-stage-heading">The drawer</h2>
        <button type="button" className="fund-drawer-back" onClick={onClose}>Back to the board</button>
      </div>
      <p className="fund-drawer-intro">{FUND_DRAWER_INTRO}</p>
      {picking ? (
        <div className="fund-drawer-slots">
          <p className="fund-drawer-slots-lede">
            Where does <b>{FUND_WIDGET_CARD[picking.id].name}</b> go?
          </p>
          <p className="muted">Level stays in the first place.{phone ? " Your phone shows six places; the last two desktop places stay saved." : " Eight places are saved for this desk."}</p>
          <ul className="fund-drawer-slot-list">
            {rail.slice(0,phone?6:8).map((occupantId, index) => {
              const slot = index + 1;
              const pinned = slot === 1;
              return (
                <li key={slot}>
                  <button
                    type="button"
                    className="fund-drawer-slot"
                    disabled={busy || (slot===1 && pickingId!=="level") || (slot!==1 && pickingId==="level")}
                    onClick={() => chooseSlot(slot)}
                  >
                    <span className="fund-drawer-slot-number">{slot}</span>
                    <span className="fund-drawer-slot-name">
                      {FUND_WIDGET_CARD[occupantId].name}
                      {pinned ? <span className="fund-drawer-slot-pinned"> · pinned</span> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <button type="button" className="fund-drawer-slots-cancel" onClick={() => setPickingId(null)}>
            Choose a different widget
          </button>
        </div>
      ) : (
        <ul className="fund-drawer-cards">
          {cards.map((row) => {
            const card = FUND_WIDGET_CARD[row.id];
            const tag = row.id === "ask" ? "your desk only" : row.onRail ? "on the rail" : "in the drawer";
            return (
              <li key={row.id}>
                <button
                  type="button"
                  className={`fund-drawer-card${row.onRail ? " is-on-rail" : ""}`}
                  disabled={busy}
                  onClick={() => setPickingId(row.id)}
                >
                  <span className="fund-drawer-card-name">{card.name}</span>
                  <span className="fund-drawer-card-line">{card.line}</span>
                  <span className={`fund-drawer-card-tag${row.id === "ask" ? " is-scope" : ""}`}>{tag}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section></DrawerSurface>
  );
}

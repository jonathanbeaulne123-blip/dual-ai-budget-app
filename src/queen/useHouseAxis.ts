import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { HOUSE_DOMINANCE, houseCan, houseKey, houseOwnsEvent, houseSwipe, houseTurnKey, type HouseMove, type HousePlace, type HouseTurn } from "./queenHouse.ts";

/**
 * Grab the house and haul it (2026-09-14).
 *
 * One gesture, three ways in: drag with a finger, drag with a mouse, or press
 * ArrowUp and ArrowDown. They all mean the same thing — **up goes up** — and
 * none of them is the only way to a floor, because the house rail stands beside
 * them with a button per floor.
 *
 * While the drag is live the room follows the hand, so the grab is felt and not
 * guessed; a stair that leads nowhere resists instead of sliding, so the loft's
 * ceiling and the cellar's floor are things you can feel. The haul is offered
 * as a number and the caller decides whether to move anything with it, which is
 * how reduced motion switches the feedback off without switching the gesture
 * off.
 *
 * It keeps its hands off anything that owns its own pointer or its own arrows:
 * the ribbon's scrubber, the ledge's banks, any field being typed in. Vertical
 * must beat horizontal before a drag counts at all, so scrubbing a ribbon and
 * climbing a stair never mean each other.
 */
export function useHouseAxis({ place, onMove, onTurn, enabled = true, feedback = true }: {
  place: HousePlace;
  onMove: (move: HouseMove) => void;
  /** Across the room: the cellar's ribbon, the ledge's order, Home's three banks. */
  onTurn?: (turn: HouseTurn, event: KeyboardEvent<HTMLElement>) => void;
  enabled?: boolean;
  /** False under reduced motion: the gesture still works, the room just does not follow. */
  feedback?: boolean;
}) {
  const grab = useRef<{ id: number; x: number; y: number; at: number; live: boolean; target: EventTarget | null } | null>(null);
  const hauled = useRef(false);
  const [haul, setHaul] = useState(0);

  const end = useCallback(() => { grab.current = null; setHaul(0); }, []);

  const onPointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    if (!enabled) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (!houseOwnsEvent(event.target)) return;
    grab.current = { id: event.pointerId, x: event.clientX, y: event.clientY, at: Date.now(), live: false, target: event.target };
  }, [enabled]);

  const onPointerMove = useCallback((event: PointerEvent<HTMLElement>) => {
    const held = grab.current;
    if (!held || held.id !== event.pointerId) return;
    const dx = event.clientX - held.x, dy = event.clientY - held.y;
    if (Math.abs(dy) <= Math.abs(dx) * HOUSE_DOMINANCE || Math.abs(dy) < 6) return;
    // The direction is settled now, so ask again: she keeps the pull down that
    // tips her over, and lets the climb up pass through.
    if (!houseOwnsEvent(held.target, dy < 0 ? "up" : "down")) { grab.current = null; setHaul(0); return; }
    if (!held.live) {
      held.live = true;
      // Only now is this a haul and not a tap, so only now do we take the pointer.
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* the room still works without capture */ }
    }
    if (!feedback) return;
    // A stair that leads nowhere resists: you can feel the loft's ceiling.
    const open = houseCan(place, dy < 0 ? "up" : "down");
    const give = open ? 0.55 : 0.12;
    setHaul(Math.max(-90, Math.min(90, dy * give)));
  }, [place, feedback]);

  const finish = useCallback((event: PointerEvent<HTMLElement>) => {
    const held = grab.current;
    if (!held || held.id !== event.pointerId) return;
    end();
    if (!held.live) return;
    const move = houseSwipe({
      dx: event.clientX - held.x,
      dy: event.clientY - held.y,
      ms: Date.now() - held.at,
      reach: event.currentTarget.getBoundingClientRect().height,
    });
    if (!move) return;
    hauled.current = true;
    if (houseCan(place, move)) onMove(move);
  }, [end, onMove, place]);

  const onPointerCancel = useCallback((event: PointerEvent<HTMLElement>) => {
    if (grab.current?.id === event.pointerId) end();
  }, [end]);

  // The click that follows a real haul is the haul's own click, not a press on
  // whatever happened to be under the hand. Swallow exactly one.
  const onClickCapture = useCallback((event: { stopPropagation: () => void; preventDefault: () => void }) => {
    if (!hauled.current) return;
    hauled.current = false;
    event.stopPropagation();
    event.preventDefault();
  }, []);

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (!enabled || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    if (!houseOwnsEvent(event.target)) return;
    const move = houseKey(event.key);
    if (move) {
      if (!houseCan(place, move) || !houseOwnsEvent(event.target, move)) return;
      event.preventDefault();
      onMove(move);
      return;
    }
    const turn = houseTurnKey(event.key);
    if (turn && onTurn) onTurn(turn, event);
  }, [enabled, place, onMove, onTurn]);

  return {
    /** Pixels the room should follow the hand by. Zero unless a haul is live. */
    haul,
    hauling: haul !== 0,
    bind: { onPointerDown, onPointerMove, onPointerUp: finish, onPointerCancel, onClickCapture, onKeyDown },
  };
}

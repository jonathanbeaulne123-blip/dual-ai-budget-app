import { useEffect } from "react";
import { MOTION_KEY, readMotionEdition, type MotionEdition } from "./QuickSheet.tsx";

/**
 * The page-turn (SIMPLE_VIEW_DESK S7): flipping between the two worlds plays
 * one orchestrated moment. Going to the Desk, a leaf of ledger paper covers
 * the harbour and turns away to the left — the ledger opens. Going back, the
 * leaf turns away to the right — the book closes and the harbour is there.
 *
 * It is an overlay on the document, not a wrapper round either world: it is
 * appended the instant the edition is written (the `hearth:motion` event, so
 * the flip button, the backtick, the quick sheet's switch and the Desk's
 * Harbour button all play it), it takes no pointer events and no focus, it is
 * hidden from assistive technology, and it removes itself in under 600ms. The
 * worlds swap underneath it exactly as they always have.
 *
 * Under `prefers-reduced-motion` (or where the preference cannot be read) it
 * is a plain cut: no overlay is ever made.
 */
export const PAGE_TURN_MS = 500;
export type PageTurnDirection = "to-desk" | "to-world";

/** Pure: may the page turn play here? Only when the reader has not asked for less motion. */
export function pageTurnAllowed(win: Pick<Window, "matchMedia"> | undefined = typeof window === "undefined" ? undefined : window): boolean {
  if (!win || typeof win.matchMedia !== "function") return false;
  try { return !win.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
}

/** Pure: which way the page turns for an edition change; null when nothing changed. */
export function pageTurnFor(from: MotionEdition, to: MotionEdition): PageTurnDirection | null {
  if (from === to) return null;
  return to === "flat" ? "to-desk" : "to-world";
}

/** Lay the leaf over the page and let it turn. Returns the overlay (for tests); it removes itself. */
export function playPageTurn(direction: PageTurnDirection, doc: Document = document): HTMLElement {
  doc.querySelectorAll("[data-page-turn]").forEach(node => node.remove());
  const overlay = doc.createElement("div");
  overlay.className = `page-turn page-turn--${direction}`;
  overlay.dataset.pageTurn = direction;
  overlay.setAttribute("aria-hidden", "true");
  const part = (name: string) => { const node = doc.createElement("div"); node.className = `page-turn__${name}`; return node; };
  const leaf = part("leaf");
  leaf.append(part("face"));
  overlay.append(part("shade"), leaf);
  doc.body.append(overlay);
  let done = false;
  const finish = () => { if (done) return; done = true; overlay.remove(); };
  leaf.addEventListener("animationend", finish);
  // The belt to the animation's braces: never outstay the turn, even if no animation ran.
  (doc.defaultView ?? window).setTimeout(finish, PAGE_TURN_MS + 80);
  return overlay;
}

/**
 * Listen for the edition while `enabled`, and turn the page when it changes.
 * The App owns this through `useEditionFlipKey`, so it is heard over the
 * island, on the Desk and on every door, in both spaces.
 */
export function usePageTurn(enabled: boolean, storage?: Pick<Storage, "getItem">): void {
  useEffect(() => {
    if (!enabled) return;
    let last = readMotionEdition(storage);
    const onEdition = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      const next: MotionEdition = detail === "flat" || detail === "illustrated" ? detail : readMotionEdition(storage);
      const direction = pageTurnFor(last, next);
      last = next;
      if (direction && pageTurnAllowed()) playPageTurn(direction);
    };
    window.addEventListener(MOTION_KEY, onEdition);
    return () => window.removeEventListener(MOTION_KEY, onEdition);
  }, [enabled, storage]);
}

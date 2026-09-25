import { useEffect, useRef, useState } from "react";
import "./journey-cloud-transition.css";

type Direction = "to-journey" | "to-harbour";
type Passage = { direction: Direction; phase: "cover" | "hold" | "reveal" };

/** Keep the destination behind the clouds until its actual scene has drawn. */
export function useJourneyCloudTransition() {
  const [passage, setPassage] = useState<Passage | null>(null);
  const current = useRef<Passage | null>(null);
  const destinationReady = useRef(false);
  const timers = useRef<number[]>([]);
  const schedule = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };
  const clear = () => { timers.current.forEach(window.clearTimeout); timers.current = []; };
  useEffect(() => clear, []);

  const reveal = () => {
    if (current.current?.phase !== "hold" || !destinationReady.current) return;
    current.current = { ...current.current, phase: "reveal" };
    setPassage(current.current);
    schedule(() => { current.current = null; setPassage(null); clear(); }, 650);
  };
  const begin = (direction: Direction, navigate: () => void) => {
    if (current.current) return;
    clear();
    if (direction === "to-journey") window.requestAnimationFrame?.(() => { void import("./world/pathWorld3d.ts").catch(() => undefined); });
    destinationReady.current = false;
    current.current = { direction, phase: "cover" };
    setPassage(current.current);
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduced";
    schedule(() => {
      navigate();
      if (!current.current || current.current.direction !== direction) return;
      current.current = { direction, phase: "hold" };
      setPassage(current.current);
      reveal();
    }, reduced ? 0 : 520);
    // If a route or renderer fails before reporting readiness, release the veil to its normal fallback.
    schedule(() => { if (current.current?.direction === direction) { current.current = null; setPassage(null); clear(); } }, 15000);
  };
  const ready = (direction: Direction) => {
    if (current.current?.direction !== direction) return;
    destinationReady.current = true;
    reveal();
  };
  return { begin, ready, clouds: passage && <div className="journey-cloud-passage" data-phase={passage.phase} data-direction={passage.direction} aria-hidden="true"><i /><i /><i /></div> };
}

/**
 * Where the rider is on screen, as the skate chase camera last framed it.
 *
 * The camera publishes the projected head and board (0..1 of the stage, v
 * down) every time it places the eye; HUD pieces that hang off the rider (the
 * balance meter) subscribe with an element and get CSS custom properties
 * written straight onto it — no React render per frame. One rider rides at a
 * time, so this is a single module-level slot.
 */
export type RiderAnchor = {head: readonly [number, number]; board: readonly [number, number]};

let current: RiderAnchor | null = null;
const listeners = new Set<(a: RiderAnchor | null) => void>();

export function publishRiderAnchor(a: RiderAnchor | null): void {
  current = a;
  for (const fn of listeners) fn(a);
}
export function riderAnchor(): RiderAnchor | null { return current; }

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
/** Write `--rider-hx/--rider-hy` (head) and `--rider-bx/--rider-by` (board) as percentages onto `el` while subscribed. */
export function bindRiderAnchor(el: HTMLElement): () => void {
  const write = (a: RiderAnchor | null) => {
    if (!a) { el.removeAttribute('data-anchored'); return; }
    const pct = (v: number) => `${(clamp(v, -0.2, 1.2) * 100).toFixed(2)}%`;
    el.style.setProperty('--rider-hx', pct(a.head[0])); el.style.setProperty('--rider-hy', pct(a.head[1]));
    el.style.setProperty('--rider-bx', pct(a.board[0])); el.style.setProperty('--rider-by', pct(a.board[1]));
    el.setAttribute('data-anchored', '');
  };
  write(current);
  listeners.add(write);
  return () => { listeners.delete(write); };
}

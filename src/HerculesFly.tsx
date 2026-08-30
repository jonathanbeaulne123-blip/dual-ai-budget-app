/**
 * A dust mote with wings. Never a number, never a notice, never a Health lamp.
 * Reduced motion hides it. Original paths — not the JPEG, not the GLB.
 */
export function HerculesFly({
  x,
  y,
  hidden,
}: {
  x: number;
  y: number;
  hidden?: boolean;
}) {
  if (hidden) return null;
  return (
    <svg
      className="herc-fly"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      style={{ left: x, top: y }}
      aria-hidden="true"
    >
      <g fill="none" stroke="var(--herc-ink, #1b1712)" strokeWidth="1.1" strokeLinecap="round">
        <ellipse className="herc-fly-wing" cx="5" cy="7" rx="4" ry="2.2" fill="rgba(253, 251, 246, 0.7)" />
        <ellipse className="herc-fly-wing" cx="11" cy="7" rx="4" ry="2.2" fill="rgba(253, 251, 246, 0.7)" />
        <ellipse cx="8" cy="8.5" rx="1.4" ry="2.1" fill="#3c342c" stroke="none" />
      </g>
    </svg>
  );
}

export function wanderFly(
  viewport: { w: number; h: number },
  nav = 76,
  random = Math.random,
  avoid?: { x: number; y: number; w: number; h: number } | null,
): { x: number; y: number } {
  const pad = 20;
  const maxX = Math.max(pad, viewport.w - 16 - pad);
  const maxY = Math.max(80, viewport.h - nav - 48);
  const point = {
    x: pad + random() * (maxX - pad),
    y: 72 + random() * Math.max(8, maxY - 72),
  };
  if (avoid && point.x < avoid.x + avoid.w && point.x + 16 > avoid.x && point.y < avoid.y + avoid.h && point.y + 16 > avoid.y) {
    point.x = Math.max(pad, avoid.x - 28);
  }
  return point;
}

export type FlyRect = { x: number; y: number; w: number; h: number };

export function herculesLitterRect(viewport: { w: number; h: number }, nav = 76): FlyRect {
  return { x: Math.max(8, viewport.w - 126), y: Math.max(8, viewport.h - nav - 62), w: 114, h: 50 };
}

function overlap(a: FlyRect, b: FlyRect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function herculesOverFly(cat: { x: number; y: number }, fly: { x: number; y: number }, catSize = 96): boolean {
  return overlap({ x: cat.x, y: cat.y, w: catSize, h: catSize }, { x: fly.x - 4, y: fly.y - 4, w: 24, h: 24 });
}

export function herculesInLitter(cat: { x: number; y: number }, viewport: { w: number; h: number }, catSize = 96, nav = 76): boolean {
  return overlap({ x: cat.x, y: cat.y, w: catSize, h: catSize }, herculesLitterRect(viewport, nav));
}

/** Automatic movement only. Dragging by a person is intentionally allowed. */
export function keepHerculesOutOfLitter(
  point: { x: number; y: number },
  viewport: { w: number; h: number },
  catSize = 96,
  nav = 76,
): { x: number; y: number } {
  const litter = herculesLitterRect(viewport, nav);
  const cat = { x: point.x, y: point.y, w: catSize, h: catSize };
  if (!overlap(cat, litter)) return point;
  return {
    x: Math.max(4, Math.min(viewport.w - catSize - 4, litter.x - catSize - 12)),
    y: Math.max(4, Math.min(viewport.h - catSize - nav, point.y)),
  };
}

export function HerculesLitterBox({ deadFlies }: {
  deadFlies: number;
}) {
  return (
    <div className="herc-litter" role="status" aria-live="polite" aria-label={`Hercules's litter box. ${deadFlies} dead ${deadFlies === 1 ? "fly" : "flies"}.`}>
      <span className="herc-litter-rim" aria-hidden="true" />
      <div className="herc-dead-fly-pile" aria-hidden="true">
        {Array.from({ length: deadFlies }, (_, index) => (
          <i key={index} style={{ left: 12 + ((index * 17) % 82), top: 15 + ((index * 11) % 20), transform: `rotate(${(index * 37) % 180}deg)` }} />
        ))}
      </div>
    </div>
  );
}

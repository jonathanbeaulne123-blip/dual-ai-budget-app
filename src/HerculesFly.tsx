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
): { x: number; y: number } {
  const pad = 20;
  const maxX = Math.max(pad, viewport.w - 16 - pad);
  const maxY = Math.max(80, viewport.h - nav - 48);
  return {
    x: pad + random() * (maxX - pad),
    y: 72 + random() * Math.max(8, maxY - 72),
  };
}

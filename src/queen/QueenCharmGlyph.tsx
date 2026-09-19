import type { QueenCharmKind, QueenCharmV1 } from "../core/queenCharms.ts";
import { queenCharmFlatSeat, QUEEN_FORM_BASE, type QueenForm } from "./world/queenCharmSurface.ts";

/**
 * The flat twins of the charm library: the same dozen silhouettes drawn in a
 * 20-unit box, so a household with no WebGL sees its own Queen wearing its
 * own charms at the same seats. Body is the charm's colour; the accent is
 * ink. Under forced colours the shape alone carries it.
 */
const GLYPHS: Record<QueenCharmKind, { body: string; accent?: string }> = {
  "sitting-cat": { body: "M-4.4,9 C-8,5 -7,-2 -3.6,-3.2 L-4.6,-8.4 L-1.4,-5.2 L1.4,-5.2 L4.6,-8.4 L3.6,-3.2 C7.6,-1.2 8.4,6 5,9 C8.8,8 9.6,4.4 8.8,2.4 C10.6,4 10.4,9.6 6,10 Z", accent: "M-2.2,-1.6 a1,1 0 1 0 0.01,0 M2.2,-1.6 a1,1 0 1 0 0.01,0" },
  "paper-airplane": { body: "M-10,-1 L10,-5 L-3,6 L-4.6,1.4 Z M-3,6 L-2.2,10 L0.6,3.4 Z" },
  "coffee-mug": { body: "M-6,-6 H4 V6 Q4,8 2,8 H-4 Q-6,8 -6,6 Z M4,-3 H7 Q10,-3 10,0 Q10,3 7,3 H4 V1 H7 Q8,1 8,0 Q8,-1 7,-1 H4 Z", accent: "M-6,-6 H4 V-4.6 H-6 Z" },
  teapot: { body: "M-6.4,-1 C-6.4,-6 6.4,-6 6.4,-1 C6.4,4 4,7 0,7 C-4,7 -6.4,4 -6.4,-1 Z M-2,-5 H2 V-7.4 H-2 Z M-1.2,-7.4 a1.3,1.3 0 1 0 2.4,0 Z M6,-1 L10,-4.4 L10.6,-3.2 L7,1.6 Z M-6.2,-2 C-10.6,-2 -10.6,4 -6.4,4 L-6.6,2.4 C-8.8,2.4 -8.8,-0.6 -6.6,-0.4 Z" },
  snail: { body: "M-3.4,-1 a5.6,5.6 0 1 0 0.01,0 M-9.4,6.2 C-10.4,3.6 -6,2.4 -3,3.2 L3,3.2 C6,3.4 7.2,5.4 5,7 L-8.2,7 C-9.2,7 -9.6,6.6 -9.4,6.2 Z M-8.6,3.4 L-10.4,-1.6 L-9.4,-1.8 L-7.6,3 Z M-6.4,3 L-6,-1.6 L-5,-1.6 L-5.2,3 Z", accent: "M-3.4,-1 a2.2,2.2 0 1 0 0.01,0 M-10.4,-1.6 a0.9,0.9 0 1 0 0.01,0 M-6,-1.6 a0.9,0.9 0 1 0 0.01,0" },
  mushroom: { body: "M-9.4,1 C-9.4,-6 9.4,-6 9.4,1 Z M-2.8,1 H2.8 L3.4,9 Q0,10 -3.4,9 Z", accent: "M-5,-2 a1.4,1.4 0 1 0 0.01,0 M3.6,-1.4 a1.1,1.1 0 1 0 0.01,0 M0.4,-3.8 a0.9,0.9 0 1 0 0.01,0" },
  "paper-boat": { body: "M-10,1 H10 L6.4,7 H-6.4 Z M-3.4,1 L0,-8 L3.4,1 Z" },
  "small-bird": { body: "M-1.6,0.6 C-1.6,-3.6 6,-4.6 7.2,0.4 C8,4.4 4,7 -0.4,6.4 C-3.8,6 -5.4,3.6 -4.6,1.4 Z M3.8,-2.2 a3,3 0 1 0 0.01,0 M-4.6,1.4 L-10.4,-1 L-9.6,3.6 Z", accent: "M6.4,-2.2 L10,-1.6 L6.4,-0.6 Z M4.6,-3.2 a0.8,0.8 0 1 0 0.01,0" },
  bell: { body: "M-6.6,6 C-6.6,0 -5,-3 -4,-5 C-3,-7 -2,-8 0,-8 C2,-8 3,-7 4,-5 C5,-3 6.6,0 6.6,6 Z M-7.4,6 H7.4 V8 H-7.4 Z M-1.2,-8.6 a1.2,1.2 0 1 0 2.4,0 Z", accent: "M-1.8,8 a1.8,1.8 0 1 0 3.6,0 Z" },
  key: { body: "M0,-5.6 a4,4 0 1 0 0.01,0 M-1.4,-1.8 H1.4 V10 H-1.4 Z M1.4,4.4 H4.6 V6.2 H1.4 Z M1.4,7.6 H3.8 V9.4 H1.4 Z", accent: "M0,-5.6 a1.4,1.4 0 1 0 0.01,0" },
  die: { body: "M-8,-6.4 Q-8,-8 -6.4,-8 H6.4 Q8,-8 8,-6.4 V6.4 Q8,8 6.4,8 H-6.4 Q-8,8 -8,6.4 Z", accent: "M0,0 a1.3,1.3 0 1 0 0.01,0 M-4,-4 a1.3,1.3 0 1 0 0.01,0 M4,4 a1.3,1.3 0 1 0 0.01,0 M4,-4 a1.3,1.3 0 1 0 0.01,0 M-4,4 a1.3,1.3 0 1 0 0.01,0" },
  spool: { body: "M-8,-9 H8 V-6 H-8 Z M-8,6 H8 V9 H-8 Z M-5,-6 H5 V6 H-5 Z", accent: "M-5.4,-4.6 H5.4 V4.6 H-5.4 Z M5,-3 L9.6,7 L8.6,7.4 L4,-2.6 Z" },
};

export function QueenCharmGlyphs({ charms, part, form = QUEEN_FORM_BASE }: { charms: readonly QueenCharmV1[]; part: QueenCharmV1["part"]; form?: QueenForm }) {
  const rows = charms.filter((charm) => charm.part === part);
  if (!rows.length) return null;
  return (
    <g className={`queen-charms queen-charms--${part}`} data-charms={rows.length}>
      {rows.map((charm) => {
        const seat = queenCharmFlatSeat(charm, form);
        const glyph = GLYPHS[charm.kind];
        // Foreshortened by how much the seat faces the room; SVG's y runs down, so the spin turns the other way.
        const transform = `translate(${seat.x.toFixed(1)} ${seat.y.toFixed(1)}) scale(${Math.max(0.45, seat.facing).toFixed(2)} 1) rotate(${-charm.spin}) scale(${seat.size.toFixed(3)})`;
        return (
          <g key={charm.id} className="queen-charm" data-charm={charm.kind} data-charm-id={charm.id} transform={transform}>
            <path className="queen-charm__body" d={glyph.body} style={{ fill: charm.color }} />
            {glyph.accent && <path className="queen-charm__ink" d={glyph.accent} />}
          </g>
        );
      })}
    </g>
  );
}
/** A single charm as a picture for the bin: the same glyph, the same colour, no seat. */
export function QueenCharmIcon({ kind, color, size = 28 }: { kind: QueenCharmKind; color: string; size?: number }) {
  const glyph = GLYPHS[kind];
  return (
    <svg className="queen-charm-icon" viewBox="-12 -12 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      <path className="queen-charm__body" d={glyph.body} style={{ fill: color }} />
      {glyph.accent && <path className="queen-charm__ink" d={glyph.accent} />}
    </svg>
  );
}

import type { QueenBody, QueenCrown, QueenFeet, QueenRegionId, QueenStill } from "../core/queenPresentation.ts";
import type { QueenCharmV1 } from "../core/queenCharms.ts";
import { QueenCharmGlyphs } from "./QueenCharmGlyph.tsx";
import { QUEEN_FLAT, QUEEN_FORM_BASE, queenRingSeatsOn, queenSkirtAt, type QueenForm } from "./world/queenCharmSurface.ts";

/**
 * The Queen, drawn. Her body carries state and nothing else: no text, no
 * controls. Posture and lean say the pulse, fullness says how much is held,
 * eyes open only toward what needs the household, the glaze says whether the
 * evidence is fresh, the crown lights when both are here, gold seams are the
 * corrections kept visible, the vine is the Chapter grown by acts, buds are
 * goals in motion and the stones at her feet are the nearest dated
 * obligations as pure form. Charms are the couple's, drawn at the seats they
 * chose and carrying nothing. Her vessel is drawn from the same lathe profile
 * the sculpture and the charm surface use — the thrown handles and the growth
 * rings included — so the flat path and the 3D path are one form. Tipped
 * over, she shows her underside: the makers' marks, never painted.
 *
 * She is a cat, and reads as one without a pixel of WebGL: ears with an inner
 * fold, a muzzle, whiskers, front paws folded in her lap and a tail curled
 * round her base. Her hair is the mandevilla — white blooms on her left,
 * crimson on her right, the two meeting only in the flower crown.
 */
export const QUEEN_VIEW = { w: 240, h: 340 } as const;

/** The vessel's outline in the belly group's space, from the profile: the hem, up the right, over the top, down the left. */
export function queenFlatVessel(form: QueenForm = QUEEN_FORM_BASE, samples = 40): string {
  const { cx, hemY, sx, sy } = QUEEN_FLAT.body;
  const right: string[] = [], left: string[] = [];
  for (let i = 0; i <= samples; i += 1) {
    const v = 0.03 + (i / samples) * 0.97;
    const { r, y } = queenSkirtAt(v, form);
    const px = (r * sx).toFixed(1), py = (hemY - y * sy).toFixed(1);
    right.push(`${(cx + Number(px)).toFixed(1)} ${py}`);
    left.push(`${(cx - Number(px)).toFixed(1)} ${py}`);
  }
  return `M${right[0]} L${right.slice(1).join(" L")} L${left.reverse().join(" L")} Z`;
}
/** A band inside the outline on one side, for the shade (right) and the glaze highlight (left). */
export function queenFlatBand(form: QueenForm, side: 1 | -1, inner: number, from = 0.03, to = 1, samples = 24): string {
  const { cx, hemY, sx, sy } = QUEEN_FLAT.body;
  const outer: string[] = [], within: string[] = [];
  for (let i = 0; i <= samples; i += 1) {
    const v = from + (i / samples) * (to - from);
    const { r, y } = queenSkirtAt(v, form);
    const py = (hemY - y * sy).toFixed(1);
    outer.push(`${(cx + side * r * sx).toFixed(1)} ${py}`);
    within.push(`${(cx + side * r * sx * inner).toFixed(1)} ${py}`);
  }
  return `M${outer[0]} L${outer.slice(1).join(" L")} L${within.reverse().join(" L")} Z`;
}
/** The rings as shallow front arcs at their heights and widths. */
export function queenFlatRings(form: QueenForm): { key: number; d: string }[] {
  const { cx, hemY, sx, sy } = QUEEN_FLAT.body;
  return queenRingSeatsOn(form).map((v) => {
    const { r, y } = queenSkirtAt(v, form);
    const w = r * sx * 0.985, py = hemY - y * sy;
    return { key: v, d: `M${(cx - w).toFixed(1)} ${(py - 1.2).toFixed(1)} Q${cx} ${(py + 4).toFixed(1)} ${(cx + w).toFixed(1)} ${(py - 1.2).toFixed(1)}` };
  });
}

/** Where open eyes turn. Together is her left; Status her right; what is held is below; the Chapter is above. */
const GAZE: Record<QueenRegionId | "rest", { dx: number; dy: number }> = {
  rest: { dx: 0, dy: 0 },
  crown: { dx: -4.5, dy: 1 },
  vine: { dx: -1.5, dy: -3 },
  face: { dx: 4.5, dy: 1 },
  hands: { dx: 0, dy: 3 },
  body: { dx: 0, dy: 4 },
  belly: { dx: 0, dy: 4 },
  hem: { dx: 0, dy: 4.5 },
};

const MOUTH: Record<QueenStill["mouth"], string> = {
  serene: "M111 132 q9 6 18 0",
  level: "M111 133 q9 2 18 0",
  set: "M111 135 q9 -3 18 0",
};

/** Bud seats along her hair, nearest the crown first: one per goal in motion. */
const BUD_SEATS = [
  { cx: 84, cy: 132, r: 8 },
  { cx: 156, cy: 134, r: 6.5 },
  { cx: 62, cy: 198, r: 5.5 },
  { cx: 178, cy: 200, r: 5 },
];

/** The white splatter the real pot was finished with: a fixed scatter, so the flat path carries her clay the way the 3D grain does. */
const CLAY_SPECKS: readonly (readonly [number, number, number])[] = [
  [96, 236, 2.6], [134, 212, 1.8], [158, 258, 2.2], [78, 268, 1.6], [112, 284, 2.9], [150, 292, 1.7],
  [88, 196, 2], [166, 228, 1.5], [104, 252, 1.4], [142, 246, 2.4], [70, 240, 1.9], [176, 266, 2.1],
  [120, 268, 1.6], [92, 220, 1.5], [162, 200, 1.8], [130, 232, 1.4], [106, 208, 2.2], [148, 274, 1.5],
];

/** A mandevilla bloom, flat: five petals lapping the same way round, and the throat at the centre. The lap is what makes it a mandevilla and not a daisy. */
function QueenBloom({ x, y, r, tone }: { x: number; y: number; r: number; tone: "white" | "red" }) {
  return (
    <g className={`queen-bloom queen-bloom--${tone}`} transform={`translate(${x} ${y})`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <ellipse key={i} className="queen-petal" cx={0} cy={-r * 0.78} rx={r * 0.62} ry={r * 0.44} transform={`rotate(${i * 72}) rotate(16 0 ${-r * 0.78})`} />
      ))}
      <circle className="queen-bloom-eye" r={r * 0.28} />
    </g>
  );
}
/** A furled bud on a strand: long, held upright, the pink flush at its tip. */
function QueenHairBud({ x, y, r, tone }: { x: number; y: number; r: number; tone: "white" | "red" }) {
  return (
    <g className={`queen-bloom queen-bloom--${tone}`} transform={`translate(${x} ${y})`}>
      <ellipse className="queen-petal" rx={r * 0.42} ry={r * 1.1} />
      <circle className="queen-bloom-tip" cy={-r * 1.05} r={r * 0.26} />
    </g>
  );
}

/** Her hair: seven strands a side falling from the crown, white on her left and crimson on her right. */
const HAIR_STRANDS: readonly { side: -1 | 1; d: string; blooms: readonly [number, number][]; bud?: readonly [number, number] }[] = [
  { side: -1, d: "M98 74 C74 108 62 166 64 236", blooms: [[70, 150], [66, 226]] },
  { side: -1, d: "M94 76 C66 112 50 172 52 244", blooms: [[56, 170]], bud: [53, 232] },
  { side: -1, d: "M102 72 C84 104 78 158 82 220", blooms: [[80, 196]] },
  { side: 1, d: "M142 74 C166 108 178 166 176 236", blooms: [[170, 150], [174, 226]] },
  { side: 1, d: "M146 76 C174 112 190 172 188 244", blooms: [[184, 170]], bud: [187, 232] },
  { side: 1, d: "M138 72 C156 104 162 158 158 220", blooms: [[160, 196]] },
];

/** The flower crown: the two colours interweave here, bound on the gold band. */
const CROWN_NODES: readonly { x: number; y: number; tone: "white" | "red"; bud?: true }[] = [
  { x: 88, y: 76, tone: "white" },
  { x: 100, y: 66, tone: "red" },
  { x: 111, y: 61, tone: "white", bud: true },
  { x: 122, y: 59, tone: "red" },
  { x: 133, y: 62, tone: "white" },
  { x: 144, y: 68, tone: "red", bud: true },
  { x: 154, y: 78, tone: "white" },
];

const STONE_SEATS = [
  { cx: 102, cy: 314 },
  { cx: 148, cy: 320 },
  { cx: 64, cy: 326 },
  { cx: 182, cy: 330 },
];
const STONE_SIZE = { near: { rx: 11, ry: 8 }, soon: { rx: 9, ry: 6.5 }, later: { rx: 7, ry: 5 } } as const;

export type QueenFigureProps = {
  still: QueenStill;
  body: QueenBody;
  crown: QueenCrown["light"];
  vine: { chapter: unknown; growth: 0 | 1 | 2 | 3 | 4 };
  buds: number;
  feet: QueenFeet;
  /** Lets the vine's "fresh glaze" sheen sit on a bud when the partner touched it recently. */
  freshBud?: number | null;
  /** The charms she wears; already through the guard. */
  charms?: readonly QueenCharmV1[];
  /** The thrown handles and the ring count. */
  form?: QueenForm;
  /** Tipped over: her underside with the makers' marks instead of her face. */
  tipped?: boolean;
  marks?: { initials: readonly string[]; date: string } | null;
};

export function QueenFigure({ still, body, crown, vine, buds, feet, freshBud = null, charms = [], form = QUEEN_FORM_BASE, tipped = false, marks = null }: QueenFigureProps) {
  const gaze = GAZE[still.eyes === "open" ? still.gaze : "rest"];
  const vineScale = vine.chapter ? 0.74 + vine.growth * 0.09 : 0.56;
  const leaves = vine.chapter ? 1 + vine.growth : 0;
  const fill = 0.86 + (body.level / 10) * 0.14;
  if (tipped) {
    // The underside: the base disc, seen from the room, the makers' marks pressed in. Not paintable; no charm seat.
    const rx = 0.9 * QUEEN_FLAT.body.sx * fill;
    return (
      <svg className="queen-svg queen-svg--tipped" viewBox={`0 0 ${QUEEN_VIEW.w} ${QUEEN_VIEW.h}`} aria-hidden="true" focusable="false">
        <ellipse className="queen-foot" cx="120" cy="306" rx="92" ry="11" />
        <path className="queen-vessel" d={`M${120 - rx * 1.1} 300 Q120 330 ${120 + rx * 1.1} 300 L${120 + rx * 1.02} 214 L${120 - rx * 1.02} 214 Z`} />
        <ellipse className="queen-underside" cx="120" cy="200" rx={rx} ry={rx * 0.72} />
        <ellipse className="queen-underside-ring" cx="120" cy="200" rx={rx * 0.86} ry={rx * 0.72 * 0.86} />
        {marks && (
          <>
            <text className="queen-mark queen-mark--initials" x="120" y="192" textAnchor="middle">{marks.initials.slice(0, 2).join(" · ")}</text>
            <text className="queen-mark queen-mark--date" x="120" y="216" textAnchor="middle">{marks.date}</text>
          </>
        )}
      </svg>
    );
  }
  return (
    <svg className="queen-svg" viewBox={`0 0 ${QUEEN_VIEW.w} ${QUEEN_VIEW.h}`} aria-hidden="true" focusable="false">
      <ellipse className="queen-foot" cx="120" cy="306" rx="92" ry="11" />
      <g className="queen-body">
        {/* Her tail, curled round her base with the tip lifted */}
        <path className="queen-tail" d="M44 300 C14 290 10 250 34 234 C54 221 76 231 78 250" />
        <g className="queen-belly" style={{ transform: `scaleX(${fill})` }}>
          <path className="queen-vessel" d={queenFlatVessel(form)} />
          <path className="queen-shade" d={queenFlatBand(form, 1, 0.74)} />
          <path className="queen-glaze" d={queenFlatBand(form, -1, 0.8, 0.22, 0.86)} />
          {CLAY_SPECKS.map(([sx, sy, sr]) => <circle key={`${sx}-${sy}`} className="queen-speck" cx={sx} cy={sy} r={sr} />)}
          {queenFlatRings(form).map((ring) => <path key={ring.key} className="queen-ring" data-ring={ring.key} d={ring.d} />)}
          {body.seams >= 1 && <path className="queen-seam" d="M74 302 L88 248 L76 214 L90 186" />}
          {body.seams >= 2 && <path className="queen-seam" d="M176 298 L164 254 L174 226" />}
          {body.seams >= 3 && <path className="queen-seam" d="M120 300 L126 268 L116 246" />}
          <QueenCharmGlyphs charms={charms} part="body" form={form} />
        </g>
        {/* Shoulders, her cupped hands — the Move's seat — and the front paws folded either side of it */}
        <path className="queen-vessel" d="M80 182 C80 146 96 126 120 126 C144 126 160 146 160 182 Z" />
        <g className="queen-paws">
          {[-1, 1].map((side) => (
            <g key={side}>
              <ellipse className="queen-paw" cx={120 + side * 34} cy="212" rx="20" ry="13" />
              {[-1, 0, 1].map((toe) => <ellipse key={toe} className="queen-paw-toe" cx={120 + side * 34 + toe * 8} cy="205" rx="3.2" ry="2.4" />)}
            </g>
          ))}
        </g>
        <path className="queen-vessel" d="M88 214 C88 198 104 190 120 190 C136 190 152 198 152 214 C140 222 100 222 88 214 Z" />
        <path className="queen-shade" d="M136 192 C148 196 152 206 152 214 C146 218 138 220 130 221 C140 214 142 202 136 192 Z" />
        {/* Ears, with the inner fold, behind the skull so they read as hers */}
        {[-1, 1].map((side) => (
          <g key={side} className="queen-ear-group">
            <path className="queen-vessel queen-ear" d={`M${120 + side * 20} 88 L${120 + side * 38} 52 L${120 + side * 44} 92 Z`} />
            <path className="queen-ear-fold" d={`M${120 + side * 25} 86 L${120 + side * 37} 62 L${120 + side * 40} 88 Z`} />
          </g>
        ))}
        {/* Face */}
        <ellipse className="queen-vessel" cx="120" cy="112" rx="40" ry="39" />
        <path className="queen-shade" d="M142 84 C158 94 162 124 150 142 C162 120 158 94 142 84 Z" />
        {/* Muzzle, cheeks, nose and whiskers: she is a cat with no pixel of WebGL */}
        <ellipse className="queen-vessel queen-muzzle" cx="106" cy="128" rx="15" ry="11" />
        <ellipse className="queen-vessel queen-muzzle" cx="134" cy="128" rx="15" ry="11" />
        <ellipse className="queen-vessel queen-muzzle" cx="120" cy="126" rx="14" ry="12" />
        <path className="queen-nose" d="M116 122 L124 122 L120 127 Z" />
        {[-1, 1].map((side) => [0, 1, 2].map((i) => (
          <path key={`${side}-${i}`} className="queen-whisker" d={`M${120 + side * 12} ${126 + i * 4} q${side * 18} ${-3 + i * 3} ${side * 34} ${-6 + i * 6}`} />
        )))}
        <path className="queen-brow" d="M98 100 q9 -5 18 -1" />
        <path className="queen-brow" d="M124 99 q9 -4 18 1" />
        {still.eyes === "open" ? (
          <>
            <ellipse className="queen-eye-open" cx="106" cy="114" rx="8" ry="5.5" />
            <ellipse className="queen-eye-open" cx="134" cy="114" rx="8" ry="5.5" />
            <circle className="queen-pupil" cx={106 + gaze.dx} cy={114 + gaze.dy} r="3.6" />
            <circle className="queen-pupil" cx={134 + gaze.dx} cy={114 + gaze.dy} r="3.6" />
          </>
        ) : (
          <>
            <path className="queen-eye" d="M98 114 q8 6 16 0" />
            <path className="queen-eye" d="M126 114 q8 6 16 0" />
          </>
        )}
        <path className="queen-mouth" d={MOUTH[still.mouth]} />
        <QueenCharmGlyphs charms={charms} part="head" form={form} />
        {/* Her hair: the mandevilla falling from the crown, white her left, crimson her right */}
        <g className="queen-hair" style={{ transform: `scale(${vineScale})`, transformOrigin: "120px 72px" }}>
          {HAIR_STRANDS.map((strand) => <path key={strand.d} className="queen-strand" d={strand.d} />)}
          {HAIR_STRANDS.map((strand) => (
            <g key={`f${strand.d}`}>
              {strand.blooms.map(([bx, by]) => <QueenBloom key={`${bx}-${by}`} x={bx} y={by} r={9} tone={strand.side < 0 ? "white" : "red"} />)}
              {strand.bud && <QueenHairBud x={strand.bud[0]} y={strand.bud[1]} r={6} tone={strand.side < 0 ? "white" : "red"} />}
            </g>
          ))}
        </g>
        {/* The flower crown: where the two colours interweave, bound on the gold band */}
        <g className="queen-flower-crown">
          <path className="queen-crown" d="M86 80 C98 58 142 58 154 80" />
          {crown === "both" && <><circle className="queen-crown-point" cx="97" cy="66" r="2.4" /><circle className="queen-crown-point" cx="120" cy="60" r="2.8" /><circle className="queen-crown-point" cx="143" cy="66" r="2.4" /></>}
          {CROWN_NODES.map((node) => node.bud
            ? <QueenHairBud key={`${node.x}-${node.y}`} x={node.x} y={node.y} r={6} tone={node.tone} />
            : <QueenBloom key={`${node.x}-${node.y}`} x={node.x} y={node.y} r={9.5} tone={node.tone} />)}
        </g>
        {/* Vine: the Chapter, grown by acts — the leaves and buds her hair carries */}
        <g className="queen-vine" style={{ transform: `scale(${vineScale})`, transformOrigin: "120px 72px" }}>
          {leaves >= 1 && <ellipse className="queen-leaf" cx="78" cy="114" rx="9" ry="4.4" transform="rotate(-54 78 114)" />}
          {leaves >= 2 && <ellipse className="queen-leaf" cx="162" cy="116" rx="11" ry="5.4" transform="rotate(54 162 116)" />}
          {leaves >= 3 && <ellipse className="queen-leaf" cx="68" cy="176" rx="11" ry="5.4" transform="rotate(-74 68 176)" />}
          {leaves >= 4 && <ellipse className="queen-leaf" cx="172" cy="178" rx="8" ry="4" transform="rotate(74 172 178)" />}
          {leaves >= 5 && <ellipse className="queen-leaf" cx="86" cy="228" rx="7" ry="3.6" transform="rotate(-82 86 228)" />}
          {BUD_SEATS.slice(0, Math.max(0, Math.min(BUD_SEATS.length, buds))).map((seat, index) => (
            <g key={seat.cx}>
              {/* A bud is a long, furled spiral held upright, not a ball. */}
              <ellipse className="queen-bud" cx={seat.cx} cy={seat.cy} rx={seat.r * 0.55} ry={seat.r * 1.25} transform={`rotate(${(seat.cx - 120) / 6} ${seat.cx} ${seat.cy})`} />
              {freshBud === index && <circle className="queen-trace" cx={seat.cx - 3} cy={seat.cy - 3} r={seat.r * 0.38} />}
            </g>
          ))}
        </g>
      </g>
      {/* At her feet: how many, how near. Pure form. */}
      <g className="queen-stones">
        {feet.nearness.slice(0, STONE_SEATS.length).map((size, index) => {
          const seat = STONE_SEATS[index]!;
          return <ellipse key={seat.cx} className={`queen-stone queen-stone--${size}`} cx={seat.cx} cy={seat.cy} rx={STONE_SIZE[size].rx} ry={STONE_SIZE[size].ry} />;
        })}
      </g>
    </svg>
  );
}

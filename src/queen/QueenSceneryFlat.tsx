import { JELLYBEAN_COLOURS, type QueenSceneryKind } from "./world/queenScenery.ts";

/**
 * The world she sits in, drawn — the no-WebGL twin of `queenScenery`.
 *
 * It carries the same three layers the 3D world does (a distance, a middle and
 * a near edge), the same palette, and the same ambient motion expressed in CSS
 * so `prefers-reduced-motion` and a paused atmosphere stop it exactly as they
 * stop the 3D clock. A reading that only exists in the 3D path does not exist,
 * and that rule covers the place as well as the figure: the household should
 * recognise their own Home with no WebGL at all.
 *
 * Decorative and inert: `aria-hidden`, no text, no state, no money.
 */
export function QueenSceneryFlat({ kind }: { kind: QueenSceneryKind | null }) {
  if (!kind) return null;
  return (
    <svg className={`queen-flat-scene queen-flat-scene--${kind}`} viewBox="0 0 1000 560" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      {kind === "clouds" ? <CloudsFlat /> : kind === "row" ? <RowFlat /> : <OfficeFlat />}
    </svg>
  );
}

/** One soft cloud: overlapping lobes, the same mass the 3D bank reads as. */
function Puff({ x, y, r, tone }: { x: number; y: number; r: number; tone: number }) {
  const lobes = [[-1.15, 0.1, 0.78], [-0.45, -0.3, 1], [0.35, -0.22, 0.92], [1.1, 0.12, 0.7], [0, 0.25, 1.05]] as const;
  return <g className={`flat-puff flat-puff--${tone}`} transform={`translate(${x} ${y})`}>
    {lobes.map(([dx, dy, k]) => <ellipse key={`${dx}`} cx={dx * r} cy={dy * r} rx={r * k} ry={r * k * 0.66} />)}
  </g>;
}

function CloudsFlat() {
  return <>
    <rect className="flat-sky flat-sky--lover" width="1000" height="560" />
    <g className="flat-far">
      {[[90, 96, 40, 0], [330, 70, 48, 2], [600, 104, 42, 1], [860, 76, 46, 3]].map(([x, y, r, t]) => <Puff key={x} x={x!} y={y!} r={r!} tone={t!} />)}
    </g>
    <g className="flat-mid">
      {[[110, 250, 74, 1], [880, 226, 82, 2], [-20, 330, 64, 0], [1010, 352, 68, 3]].map(([x, y, r, t]) => <Puff key={x} x={x!} y={y!} r={r!} tone={t!} />)}
    </g>
    <g className="flat-near">
      {[[150, 520, 108, 0], [520, 556, 124, 4], [860, 528, 112, 1]].map(([x, y, r, t]) => <Puff key={x} x={x!} y={y!} r={r!} tone={t!} />)}
    </g>
  </>;
}

/** One row house: the painted box, a pitched roof, a chimney, lit windows and a door that never matches the wall. */
function RowHouse({ x, y, w, h, tone }: { x: number; y: number; w: number; h: number; tone: number }) {
  const wall = JELLYBEAN_COLOURS[tone % JELLYBEAN_COLOURS.length]!;
  const door = JELLYBEAN_COLOURS[(tone + 3) % JELLYBEAN_COLOURS.length]!;
  return <g transform={`translate(${x} ${y})`}>
    <path className="flat-roof" d={`M${-w / 2 - 3} 0 L0 ${-h * 0.13} L${w / 2 + 3} 0 Z`} transform={`translate(0 ${-h})`} />
    <rect className="flat-chimney" x={-w * 0.34} y={-h - h * 0.2} width={w * 0.14} height={h * 0.2} />
    <rect x={-w / 2} y={-h} width={w} height={h} fill={wall} />
    {[0.74, 0.48].map((wy) => [-0.24, 0.24].map((wx) => (
      <rect key={`${wy}-${wx}`} className="flat-pane" x={wx * w - w * 0.1} y={-h * wy - h * 0.08} width={w * 0.2} height={h * 0.15} />
    )))}
    <rect x={-w * 0.11} y={-h * 0.24} width={w * 0.22} height={h * 0.24} fill={door} />
  </g>;
}

function RowFlat() {
  const houses = Array.from({ length: 14 }, (_, i) => ({ x: -30 + i * 82, y: 330 - i * 9, w: 58 + (i % 3) * 7, h: 108 + (i % 4) * 16, tone: i }));
  return <>
    <rect className="flat-sky flat-sky--row" width="1000" height="560" />
    <rect className="flat-harbour" y="292" width="1000" height="26" />
    <g className="flat-gull"><path d="M0 0 q11 -10 22 0 q11 -10 22 0" /></g>
    <g className="flat-far">{houses.map((row) => <RowHouse key={row.x} {...row} />)}</g>
    <rect className="flat-road" y="336" width="1000" height="224" />
    <rect className="flat-pavement" y="392" width="1000" height="168" />
    <rect className="flat-kerb" y="386" width="1000" height="8" />
    <g className="flat-near">
      {[150, 850].map((x) => <g key={x}><rect className="flat-bollard" x={x - 9} y="470" width="18" height="62" rx="4" /><circle className="flat-bollard" cx={x} cy="470" r="9" /></g>)}
      <g className="flat-lamp"><rect x="86" y="196" width="7" height="200" /><rect x="93" y="196" width="34" height="6" /><circle className="flat-lamp-head" cx="132" cy="203" r="13" /></g>
    </g>
  </>;
}

/** One plant: a pot and a spray of leaves, the shape the 3D crown reads as. */
function Pot({ x, y, s, blades = false }: { x: number; y: number; s: number; blades?: boolean }) {
  return <g className="flat-plant" transform={`translate(${x} ${y}) scale(${s})`}>
    {blades
      ? [-18, -6, 6, 18].map((dx) => <ellipse key={dx} className="flat-leaf" cx={dx} cy={-46} rx="6" ry="44" transform={`rotate(${dx * 0.4} ${dx} -8)`} />)
      : [-52, -26, 0, 26, 52].map((a) => {
        const cx = Math.sin((a * Math.PI) / 110) * 42, cy = -46 - Math.cos((a * Math.PI) / 110) * 14;
        return <ellipse key={a} className="flat-leaf" cx={cx} cy={cy} rx="17" ry="7" transform={`rotate(${a * 0.85} ${cx} ${cy})`} />;
      })}
    {!blades && <path className="flat-stem" d="M0 0 V-40" />}
    <path className="flat-pot" d="M-20 -2 H20 L15 28 H-15 Z" />
  </g>;
}

function OfficeFlat() {
  return <>
    <rect className="flat-sky flat-sky--office" width="1000" height="560" />
    <rect className="flat-window" x="250" y="60" width="500" height="290" />
    <g className="flat-frame">
      <rect x="244" y="54" width="512" height="12" /><rect x="244" y="344" width="512" height="12" />
      <rect x="244" y="54" width="12" height="302" /><rect x="744" y="54" width="12" height="302" /><rect x="494" y="54" width="10" height="302" />
    </g>
    <rect className="flat-shelf" x="40" y="150" width="920" height="16" />
    <g className="flat-far">{[110, 300, 520, 700, 880].map((x) => <Pot key={x} x={x} y={150} s={0.52} />)}</g>
    <g className="flat-vines">{[200, 610, 820].map((x, i) => <g key={x} className={`flat-vine flat-vine--${i}`}>{[0, 1, 2, 3, 4].map((k) => <ellipse key={k} className="flat-leaf" cx={x + Math.sin(k * 1.7) * 14} cy={176 + k * 26} rx="13" ry="7" />)}</g>)}</g>
    <rect className="flat-desk" y="392" width="1000" height="168" />
    <g className="flat-mid">
      {[[120, 392, 0.9], [250, 392, 0.7], [760, 392, 0.78], [900, 392, 0.95]].map(([x, y, s]) => <Pot key={x} x={x!} y={y!} s={s!} />)}
      <Pot x={330} y={392} s={0.6} blades />
      <Pot x={690} y={392} s={0.66} blades />
    </g>
    <g className="flat-near">
      <g className="flat-mug"><path d="M596 470 H660 L654 520 H602 Z" /><path className="flat-brew" d="M598 472 H658 L656 482 H600 Z" /><path className="flat-mug-handle" d="M660 482 q22 4 16 20 q-4 12 -20 10" /></g>
      <g className="flat-steam"><path d="M614 462 q-10 -14 0 -26 q10 -12 0 -24" /><path d="M636 462 q10 -14 0 -26 q-10 -12 0 -24" /></g>
      <g className="flat-book"><rect x="270" y="476" width="150" height="44" rx="3" /><rect className="flat-pen" x="292" y="486" width="92" height="7" rx="3" transform="rotate(-7 338 489)" /></g>
    </g>
  </>;
}

/** Original, brand-neutral control glyphs and trick-gesture drawings, as small inline SVGs. */
import type {Glyph, PadButton, StickMotion} from './model.ts';

const PAD_NAMES: Record<PadButton, string> = {south: 'bottom face button', east: 'right face button', west: 'left face button', north: 'top face button', lb: 'left bumper', rb: 'right bumper', lt: 'left trigger', rt: 'right trigger', ls: 'left stick click', rs: 'right stick click', menu: 'menu button'};
const STICK_ARROWS: Record<StickMotion, string> = {
  any: '',
  side: 'M-7 0h-3m3 -2.5L-10 0l3 2.5M7 0h3m-3 -2.5L10 0l-3 2.5',
  'down-up': 'M0 4v5m-2.5 -2.5L0 9l2.5 -2.5M0 -4v-5m-2.5 2.5L0 -9l2.5 2.5',
  'down-side': 'M0 4v5m-2.5 -2.5L0 9l2.5 -2.5M5 -3l4 -4m-3.5 0H9v3.5',
  'hold-down': 'M0 4v5m-2.5 -2.5L0 9l2.5 -2.5',
  'hold-up': 'M0 -4v-5m-2.5 2.5L0 -9l2.5 2.5',
};
export function glyphLabel(g: Glyph): string {
  switch (g.kind) {
    case 'key': return `${g.label} key`;
    case 'mouse': return g.motion === 'click' ? 'mouse button' : g.motion === 'flick' ? 'mouse flick' : 'mouse drag';
    case 'pad': return PAD_NAMES[g.button];
    case 'stick': return `${g.side} stick${g.motion === 'any' ? '' : ` ${g.motion.replace('-', ' then ')}`}`;
    case 'touch': return `${g.zone.replace('-', ' ')} touch zone`;
  }
}

/** One glyph. Decorative: the hint's text label carries the meaning for assistive tech. */
export function GlyphIcon({glyph}: {glyph: Glyph}) {
  const common = {className: `skate-glyph skate-glyph--${glyph.kind}`, 'aria-hidden': true as const, focusable: 'false' as const};
  switch (glyph.kind) {
    case 'key': {
      const w = Math.max(20, 10 + glyph.label.length * 7);
      return <svg {...common} viewBox={`0 0 ${w} 22`} width={w} height={22}>
        <rect x="1" y="1" width={w - 2} height="20" rx="4" className="skate-glyph__cap"/>
        <rect x="3" y="2.5" width={w - 6} height="15" rx="3" className="skate-glyph__face"/>
        <text x={w / 2} y="14" textAnchor="middle">{glyph.label}</text>
      </svg>;
    }
    case 'mouse':
      return <svg {...common} viewBox="-12 -12 24 24" width={22} height={22}>
        <rect x="-5" y="-8" width="10" height="16" rx="5" className="skate-glyph__cap"/>
        <path d="M0 -8v5" className="skate-glyph__line"/>
        {glyph.motion === 'click' ? <path d="M-5 -3v-2a5 5 0 0 1 5 -3v5z" className="skate-glyph__fill"/> : <path d={glyph.motion === 'flick' ? 'M8 6v-11m-2.5 2.5L8 -5l2.5 2.5' : 'M-10 9h20'} className="skate-glyph__line"/>}
      </svg>;
    case 'pad': {
      const b = glyph.button;
      if (b === 'south' || b === 'east' || b === 'west' || b === 'north') {
        const at = {north: [0, -6], east: [6, 0], south: [0, 6], west: [-6, 0]} as const;
        return <svg {...common} viewBox="-11 -11 22 22" width={22} height={22}>
          {(Object.keys(at) as (keyof typeof at)[]).map(k => <circle key={k} cx={at[k][0]} cy={at[k][1]} r="3.4" className={k === b ? 'skate-glyph__fill' : 'skate-glyph__cap'}/>)}
        </svg>;
      }
      if (b === 'menu') return <svg {...common} viewBox="-11 -11 22 22" width={22} height={22}><rect x="-9" y="-7" width="18" height="14" rx="4" className="skate-glyph__cap"/><path d="M-4 -3h8M-4 0h8M-4 3h8" className="skate-glyph__line"/></svg>;
      const left = b === 'lb' || b === 'lt' || b === 'ls', trigger = b === 'lt' || b === 'rt', click = b === 'ls' || b === 'rs';
      return <svg {...common} viewBox="-13 -11 26 22" width={24} height={22}>
        {click ? <><circle r="8" className="skate-glyph__cap"/><circle r="3" className="skate-glyph__fill"/></>
          : trigger ? <path d={left ? 'M-9 7V-2q0 -7 9 -7h7v16z' : 'M9 7V-2q0 -7 -9 -7h-7v16z'} className="skate-glyph__cap"/>
          : <rect x="-11" y="-4" width="22" height="9" rx={4.5} className="skate-glyph__cap"/>}
        <text x="0" y={trigger ? 4 : click ? 13 : 3.5} textAnchor="middle">{click ? '' : left ? 'L' : 'R'}</text>
      </svg>;
    }
    case 'stick':
      return <svg {...common} viewBox="-12 -12 24 24" width={22} height={22}>
        <circle r="10.5" className="skate-glyph__ring"/><circle r="4" className="skate-glyph__fill"/>
        <text x={glyph.side === 'left' ? -8 : 8} y="-6" textAnchor="middle" className="skate-glyph__tiny">{glyph.side === 'left' ? 'L' : 'R'}</text>
        {STICK_ARROWS[glyph.motion] && <path d={STICK_ARROWS[glyph.motion]} className="skate-glyph__line"/>}
      </svg>;
    case 'touch':
      return <svg {...common} viewBox="-12 -12 24 24" width={22} height={22}>
        <circle r="10" className="skate-glyph__ring"/><circle r="4.5" className="skate-glyph__fill"/>
        <circle r="7.5" className="skate-glyph__line" strokeDasharray="2 2"/>
      </svg>;
  }
}

/**
 * A trick's flick drawn as a pencil stroke on a little stick gate.
 * `d` is an SVG path in the square viewBox "-1 -1 2 2" (x right = toes for
 * regular, y down = toward the tail). Null draws a friendly placeholder.
 */
export function GesturePath({d, label}: {d: string | null; label: string}) {
  return <svg className="skate-gesture" viewBox="-1.25 -1.25 2.5 2.5" role="img" aria-label={d ? `Gesture for ${label}` : `Gesture for ${label} not drawn yet`}>
    <circle r="1.05" className="skate-gesture__gate"/>
    <path d="M-1.05 0H1.05M0 -1.05V1.05" className="skate-gesture__cross"/>
    {d ? <><path d={d} className="skate-gesture__stroke" pathLength={1}/><circle r=".11" className="skate-gesture__start" cx={startOf(d)[0]} cy={startOf(d)[1]}/></>
      : <text x="0" y=".22" textAnchor="middle" className="skate-gesture__missing">?</text>}
  </svg>;
}
function startOf(d: string): [number, number] {
  const m = /M\s*(-?[\d.]+)[ ,]+(-?[\d.]+)/i.exec(d);
  return m ? [Number(m[1]) || 0, Number(m[2]) || 0] : [0, 0];
}

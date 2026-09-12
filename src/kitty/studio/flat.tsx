/**
 * The flat Kitty: one SVG that reads the same sculpt/paint data as the 3D
 * studio. Used for Simple view, the fired shelf thumbnails and anywhere the
 * design must be recognisable without WebGL. Dips and stamps render here;
 * freehand strokes need the 3D view (the studio says so in its copy).
 */
import type { CSSProperties } from "react";
import type { KittyAnchor, KittyPaintV1, KittyPieceV1, KittySculptV1 } from "../../core/types.ts";
import { defaultKittyPaint, defaultKittySculpt } from "../../core/kittyStudio.ts";
import { bisqueHex } from "./paintCanvas.ts";
import { FLAT_TONES as T, studioHex } from "./palette.ts";

const INK = "currentColor";
const ANCHOR_XY: Record<KittyAnchor, [number, number]> = {
  forehead: [150, 82], leftCheek: [112, 118], rightCheek: [188, 118], chin: [150, 150],
  chest: [150, 190], belly: [150, 250], back: [150, 230], leftFlank: [92, 240], rightFlank: [208, 240], rump: [150, 300],
  leftEar: [96, 52], rightEar: [204, 52], tailTip: [258, 226],
};
export function flatColors(paint: KittyPaintV1, fired: boolean) {
  const tone = (hex: string) => (fired ? studioHex(hex) : bisqueHex(hex));
  const dip = (part: keyof KittyPaintV1["parts"]) => tone(paint.parts[part] ?? paint.base);
  return { body: dip("body"), head: dip("head"), earL: dip("earL"), earR: dip("earR"), tail: dip("tail"), paws: dip("paws"), tone };
}
function bodyPath(sculpt: KittySculptV1, step: number) {
  const [belly, waist, shoulder, neck] = sculpt.profile;
  const grow = 1 + step * 0.03;
  const w: Record<KittySculptV1["body"], [number, number, number]> = { round: [78, 72, 50], pear: [86, 68, 42], loaf: [92, 84, 56], tall: [62, 62, 46], bean: [82, 66, 52] };
  const [wb, ww, ws] = w[sculpt.body];
  const top = sculpt.body === "tall" ? 130 : sculpt.body === "loaf" ? 170 : 150;
  const bellyW = wb * belly * grow, waistW = ww * waist * grow, shoulderW = ws * shoulder * grow, neckW = 36 * neck * grow;
  return `M${150 - neckW} ${top} C${150 - shoulderW} ${top + 30} ${150 - waistW} ${top + 80} ${150 - bellyW} ${top + 120} C${150 - bellyW - 10} ${325} ${150 + bellyW + 10} ${325} ${150 + bellyW} ${top + 120} C${150 + waistW} ${top + 80} ${150 + shoulderW} ${top + 30} ${150 + neckW} ${top} Z`;
}
export function KittyFlat({ piece, glaze = "cream", step = 0, open = false, fired: firedOverride, className, style, title }: {
  piece: KittyPieceV1 | null;
  glaze?: string;
  step?: number;
  open?: boolean;
  fired?: boolean;
  className?: string;
  style?: CSSProperties;
  title?: string;
}) {
  const sculpt = piece?.sculpt ?? defaultKittySculpt();
  const paint = piece?.paint ?? defaultKittyPaint(glaze);
  const fired = firedOverride ?? (piece ? Boolean(piece.firedAt) : true);
  const c = flatColors(paint, fired);
  const headW = { round: 46, wedge: 50, chubby: 54, heart: 50 }[sculpt.head], headH = { round: 44, wedge: 38, chubby: 46, heart: 42 }[sculpt.head];
  const earY = 112 - headH + 6;
  const ear = (side: -1 | 1, fill: string) => {
    const x = 150 + side * headW * 0.62;
    if (sculpt.ears === "none") return null;
    if (sculpt.ears === "round") return <circle cx={x} cy={earY} r={15} fill={fill} stroke={INK} strokeWidth={2.5} />;
    if (sculpt.ears === "folded") return <path d={`M${x - 16} ${earY + 8} Q${x} ${earY - 4} ${x + 16} ${earY + 8} Z`} fill={fill} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />;
    return (
      <>
        <path d={`M${x - 16} ${earY + 10} L${x} ${earY - 30} L${x + 16} ${earY + 10} Z`} fill={fill} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
        {sculpt.ears === "tufted" && <path d={`M${x} ${earY - 30} q${side * 6} -10 ${side * 12} -16`} fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" />}
      </>
    );
  };
  const eyes = () => {
    const y = 108, dx = 20;
    if (sculpt.eyes === "happy") return <path d={`M${150 - dx - 8} ${y + 3} q8 -10 16 0 M${150 + dx - 8} ${y + 3} q8 -10 16 0`} fill="none" stroke={INK} strokeWidth={3.5} strokeLinecap="round" />;
    if (sculpt.eyes === "sleepy") return <path d={`M${150 - dx - 8} ${y} q8 6 16 0 M${150 + dx - 8} ${y} q8 6 16 0`} fill="none" stroke={INK} strokeWidth={3.5} strokeLinecap="round" />;
    const r = sculpt.eyes === "wide" ? 8 : 5.5;
    return (
      <>
        <circle cx={150 - dx} cy={y} r={r} fill={INK} />
        <circle cx={150 + dx} cy={y} r={r} fill={INK} />
        <circle cx={150 - dx + 2} cy={y - 2} r={r * 0.3} fill={c.tone(T.white)} />
        <circle cx={150 + dx + 2} cy={y - 2} r={r * 0.3} fill={c.tone(T.white)} />
      </>
    );
  };
  const mouth = () => {
    const y = 131;
    if (sculpt.mouth === "w" || sculpt.mouth === "tongue")
      return (
        <>
          <path d={`M138 ${y} q6 7 12 0 q6 7 12 0`} fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
          {sculpt.mouth === "tongue" && <ellipse cx={150} cy={y + 7} rx={5} ry={4} fill={c.tone(T.tongue)} />}
        </>
      );
    if (sculpt.mouth === "smile") return <path d={`M136 ${y - 2} q14 14 28 0`} fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />;
    if (sculpt.mouth === "grin") return <path d={`M132 ${y - 3} q18 18 36 0 Z`} fill={c.tone(T.white)} stroke={INK} strokeWidth={3} strokeLinejoin="round" />;
    return <path d={`M143 ${y} h14`} fill="none" stroke={INK} strokeWidth={2.5} strokeLinecap="round" />;
  };
  const nose = () => {
    if (sculpt.nose === "heart") return <path d="M150 126 l-5 -5 q-3 -4 1 -6 q3 -1 4 2 q1 -3 4 -2 q4 2 1 6 Z" fill={c.tone(T.blush)} />;
    return <ellipse cx={150} cy={121} rx={sculpt.nose === "tiny" ? 3 : 5} ry={sculpt.nose === "tiny" ? 2.2 : 3.4} fill={c.tone(T.blush)} />;
  };
  const whiskers = () => {
    if (sculpt.whiskers === "none") return null;
    const len = sculpt.whiskers === "long" ? 44 : 26;
    const rows = sculpt.whiskers === "curly" ? [0, 8] : [-6, 0, 6];
    return (
      <path
        d={rows.map((dy) => (sculpt.whiskers === "curly"
          ? `M126 ${124 + dy} q-16 -2 -22 ${dy > 0 ? 10 : -10} M174 ${124 + dy} q16 -2 22 ${dy > 0 ? 10 : -10}`
          : `M126 ${124 + dy} l-${len} ${dy * 0.7} M174 ${124 + dy} l${len} ${dy * 0.7}`)).join(" ")}
        fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round"
      />
    );
  };
  const tail = () => {
    if (sculpt.tail === "none") return null;
    const d = sculpt.tail === "curl" ? "M212 300 C262 300 272 252 250 226" : sculpt.tail === "up" ? "M206 292 C244 260 250 220 236 178" : "M110 318 C150 336 220 336 250 318";
    return <path d={d} fill="none" stroke={c.tail} strokeWidth={17} strokeLinecap="round" />;
  };
  const stamp = (s: KittyPaintV1["stamps"][number]) => {
    const [x, y] = ANCHOR_XY[s.anchor];
    const r = s.size * 60;
    const fill = c.tone(s.color);
    const t = `translate(${x} ${y}) rotate(${s.rotation})`;
    switch (s.kind) {
      case "heart": return <path key={s.id} transform={t} d={`M0 ${r * 0.8} C${-r * 1.4} ${-r * 0.2} ${-r * 0.6} ${-r * 1.1} 0 ${-r * 0.35} C${r * 0.6} ${-r * 1.1} ${r * 1.4} ${-r * 0.2} 0 ${r * 0.8} Z`} fill={fill} />;
      case "star": return <polygon key={s.id} transform={t} points={Array.from({ length: 10 }, (_, i) => { const a = (i * Math.PI) / 5 - Math.PI / 2, rad = i % 2 ? r * 0.45 : r; return `${Math.cos(a) * rad},${Math.sin(a) * rad}`; }).join(" ")} fill={fill} />;
      case "paw": return <g key={s.id} transform={t} fill={fill}><ellipse cx={0} cy={r * 0.3} rx={r * 0.6} ry={r * 0.5} />{[[-0.62, -0.2], [-0.22, -0.62], [0.22, -0.62], [0.62, -0.2]].map(([px, py], i) => <circle key={i} cx={px! * r} cy={py! * r} r={r * 0.25} />)}</g>;
      case "fish": return <path key={s.id} transform={t} d={`M${-r} 0 Q${-r * 0.2} ${-r * 0.9} ${r * 0.5} 0 Q${-r * 0.2} ${r * 0.9} ${-r} 0 M${r * 0.45} 0 L${r} ${-r * 0.5} L${r} ${r * 0.5} Z`} fill={fill} />;
      case "moon": return <path key={s.id} transform={t} d={`M${Math.cos(0.2 * Math.PI) * r} ${Math.sin(0.2 * Math.PI) * r} A${r} ${r} 0 1 1 ${Math.cos(1.8 * Math.PI) * r} ${Math.sin(1.8 * Math.PI) * r} A${r * 0.75} ${r * 0.75} 0 1 0 ${Math.cos(0.2 * Math.PI) * r} ${Math.sin(0.2 * Math.PI) * r} Z`} fill={fill} />;
      case "flower": return <g key={s.id} transform={t} fill={fill}>{Array.from({ length: 6 }, (_, i) => <circle key={i} cx={Math.cos((i * Math.PI) / 3) * r * 0.55} cy={Math.sin((i * Math.PI) / 3) * r * 0.55} r={r * 0.42} />)}</g>;
      case "bolt": return <polygon key={s.id} transform={t} points={`${-r * 0.2},${-r} ${r * 0.45},${-r} ${r * 0.05},${-r * 0.15} ${r * 0.5},${-r * 0.15} ${-r * 0.35},${r} ${-r * 0.05},${r * 0.2} ${-r * 0.5},${r * 0.2}`} fill={fill} />;
      case "initial": return <text key={s.id} transform={t} textAnchor="middle" dominantBaseline="middle" fontFamily="Georgia, serif" fontWeight={700} fontSize={r * 1.6} fill={fill}>{(s.text ?? "").slice(0, 2)}</text>;
    }
  };
  return (
    <svg className={className} viewBox="0 0 300 360" style={style} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <ellipse cx="150" cy="335" rx="108" ry="14" fill={c.tone(T.shadow)} opacity={0.9} />
      {tail()}
      <path d={bodyPath(sculpt, step)} fill={c.body} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      <ellipse cx={116} cy={318} rx={22} ry={11} fill={c.paws} stroke={INK} strokeWidth={2.5} />
      <ellipse cx={184} cy={318} rx={22} ry={11} fill={c.paws} stroke={INK} strokeWidth={2.5} />
      <rect x="112" y="220" width="76" height="70" rx="12" fill={open ? c.tone(T.doorOpen) : c.body} stroke={c.tone(T.doorTrim)} strokeWidth={4} />
      {open && (
        <>
          <path d="M120 238h60v36h-60Z" fill={c.tone(T.paper)} />
          <path d="m120 238 30 22 30-22" fill="none" stroke={c.tone(T.flap)} />
        </>
      )}
      {ear(-1, c.earL)}
      {ear(1, c.earR)}
      {sculpt.head === "heart" ? (
        <path d={`M150 ${112 + headH} C${150 - headW * 1.3} ${112 + headH * 0.3} ${150 - headW * 0.9} ${112 - headH * 1.05} 150 ${112 - headH * 0.45} C${150 + headW * 0.9} ${112 - headH * 1.05} ${150 + headW * 1.3} ${112 + headH * 0.3} 150 ${112 + headH} Z`} fill={c.head} stroke={INK} strokeWidth={3} />
      ) : sculpt.head === "wedge" ? (
        <path d={`M${150 - headW} ${112 - headH * 0.5} Q150 ${112 - headH * 1.15} ${150 + headW} ${112 - headH * 0.5} Q${150 + headW * 0.7} ${112 + headH * 0.9} 150 ${112 + headH} Q${150 - headW * 0.7} ${112 + headH * 0.9} ${150 - headW} ${112 - headH * 0.5} Z`} fill={c.head} stroke={INK} strokeWidth={3} />
      ) : (
        <ellipse cx={150} cy={112} rx={headW} ry={headH} fill={c.head} stroke={INK} strokeWidth={3} />
      )}
      <rect x="134" y={112 - headH - 4} width="32" height="7" rx="2" fill={c.tone(T.brass)} />
      {eyes()}
      {nose()}
      {mouth()}
      {whiskers()}
      {paint.stamps.map(stamp)}
      {fired && <ellipse cx={122} cy={200} rx={10} ry={24} fill={c.tone(T.white)} opacity={0.35} transform="rotate(-12 122 200)" />}
      {fired && <ellipse cx={132} cy={94} rx={6} ry={12} fill={c.tone(T.white)} opacity={0.4} transform="rotate(-20 132 94)" />}
    </svg>
  );
}

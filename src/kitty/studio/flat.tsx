/**
 * The flat Kitty: one SVG that reads the same sculpt/paint data as the 3D
 * studio. Used for Simple view, the shelf thumbnails and anywhere the design
 * must be recognisable without WebGL.
 *
 * Since 2026-09-12 the flat cat wears the *whole* paint job: each part's
 * underglaze is replayed into an offscreen canvas — the very same
 * `replayPart` the 3D textures use — and the front half of that wrap is
 * clipped into the part's silhouette. Strokes, dips, stamps and add-ons all
 * land here, so what you paint in 3D is what the shelf, the room and the
 * printed-flat view show. Where a canvas is unavailable (tests, very old
 * browsers) the dips still render and the cat stays readable.
 */
import { useMemo, type CSSProperties } from "react";
import type { KittyPaintV1, KittyPart, KittyPieceV1, KittySculptV1 } from "../../core/types.ts";
import { defaultKittyPaint, defaultKittySculpt, kittyFeature } from "../../core/kittyStudio.ts";
import { PART_CANVAS_SIZE } from "./anchors.ts";
import { KITTY_HEAD_R, KITTY_HEAD_SCALE, kittyBodyPoints } from "./silhouette.ts";
import { STAMP_ART, stampPlacement, stampRoleColor } from "./stampArt.ts";
import { bisqueHex, replayPart } from "./paintCanvas.ts";
import { FLAT_TONES as T, studioHex } from "./palette.ts";

const INK = "currentColor";
/** Which slice of each part's wrap faces the viewer, and how the wrap's v maps up the silhouette. */
const FRONT_WINDOW: Record<KittyPart, { u0: number; u1: number }> = {
  body: { u0: 0.25, u1: 0.75 },
  head: { u0: 0.25, u1: 0.75 },
  earL: { u0: 0.2, u1: 0.8 },
  earR: { u0: 0.2, u1: 0.8 },
  tail: { u0: 0, u1: 1 },
  paws: { u0: 0.25, u1: 0.75 },
};
export function flatColors(paint: KittyPaintV1, fired: boolean) {
  const tone = (hex: string) => (fired ? studioHex(hex) : bisqueHex(hex));
  const dip = (part: keyof KittyPaintV1["parts"]) => tone(paint.parts[part] ?? paint.base);
  return { body: dip("body"), head: dip("head"), earL: dip("earL"), earR: dip("earR"), tail: dip("tail"), paws: dip("paws"), tone };
}
/** The front of each part's wrap as a data URL, or null when this environment has no canvas. */
/** Probed once: environments without a 2D context (jsdom, ancient browsers) fall back to vectors. */
let canvasReady: boolean | null = null;
function hasCanvas(): boolean {
  if (canvasReady === null) {
    try {
      canvasReady = Boolean(document.createElement("canvas").getContext("2d"));
    } catch {
      canvasReady = false;
    }
  }
  return canvasReady;
}
function paintSheets(paint: KittyPaintV1, fired: boolean): Partial<Record<KittyPart, string>> {
  if (typeof document === "undefined" || !hasCanvas()) return {};
  const sheets: Partial<Record<KittyPart, string>> = {};
  try {
    for (const part of Object.keys(FRONT_WINDOW) as KittyPart[]) {
      const size = PART_CANVAS_SIZE[part];
      const layer = document.createElement("canvas");
      layer.width = layer.height = size;
      replayPart(layer, paint, part);
      const window_ = FRONT_WINDOW[part];
      const crop = document.createElement("canvas");
      crop.width = Math.round(size * (window_.u1 - window_.u0));
      crop.height = size;
      const ctx = crop.getContext("2d");
      if (!ctx) return {};
      ctx.drawImage(layer, Math.round(size * window_.u0), 0, crop.width, size, 0, 0, crop.width, size);
      if (!fired) {
        // Unfired clay reads chalky; the lift already happened per-pixel in 3D, so do it here too.
        const image = ctx.getImageData(0, 0, crop.width, crop.height), data = image.data;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!;
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          const dr = r + 0.25 * (gray - r), dg = g + 0.25 * (gray - g), db = b + 0.25 * (gray - b);
          data[i] = dr + 0.35 * (239 - dr);
          data[i + 1] = dg + 0.35 * (230 - dg);
          data[i + 2] = db + 0.35 * (216 - db);
        }
        ctx.putImageData(image, 0, 0);
      }
      sheets[part] = crop.toDataURL("image/png");
    }
  } catch {
    return {};
  }
  return sheets;
}
const BASE_Y = 330, TOP_MARGIN = 12;
const round = (n: number) => Math.round(n * 10) / 10;
/**
 * The flat cat is a front projection of the very same numbers the wheel spins:
 * body curve, head ellipsoid, face offsets. Units → the 300×360 box, so a
 * change on the wheel moves the flat cat the same way.
 */
function kittyLayout(sculpt: KittySculptV1, step: number) {
  const points = kittyBodyPoints(sculpt);
  const bodyTop = points[points.length - 1]![1];
  const grow = 1 + step * 0.03;
  const headDial = kittyFeature(sculpt, "head"), earDial = kittyFeature(sculpt, "ears");
  const hs = KITTY_HEAD_SCALE[sculpt.head];
  const headRx = KITTY_HEAD_R * hs[0] * headDial, headRy = KITTY_HEAD_R * hs[1] * headDial;
  const headCy = bodyTop + 0.25 * headDial;
  const earLift = sculpt.ears === "none" ? 0 : 0.5 * earDial;
  const totalUnits = headCy + headRy + earLift + 0.1;
  const widestUnits = Math.max(...points.map(([r]) => r)) * grow;
  // Fit height, but never let a wide cat spill out of the 300-wide box.
  const scale = Math.min((BASE_Y - TOP_MARGIN) / totalUnits, 132 / Math.max(0.95, widestUnits, headRx + earDial * 0.22));
  const X = (u: number) => 150 + u * scale, Y = (v: number) => BASE_Y - v * scale;
  const side = (sign: 1 | -1) => points.map(([r, y]) => [X(sign * r * grow), Y(y)] as [number, number]);
  const run = (list: Array<[number, number]>) => {
    let d = "";
    for (let i = 1; i < list.length; i++) {
      const [px_, py] = list[i - 1]!, [x, y] = list[i]!;
      d += `Q${round(px_)} ${round(py)} ${round((px_ + x) / 2)} ${round((py + y) / 2)}`;
    }
    const last = list[list.length - 1]!;
    return `${d}L${round(last[0])} ${round(last[1])}`;
  };
  const up = side(-1), down = [...side(1)].reverse();
  const first = up[0]!;
  return {
    scale, X, Y, grow, headDial, earDial,
    body: {
      d: `M${round(first[0])} ${round(first[1])}${run(up)}${run(down)}Z`,
      box: { x: X(-widestUnits), y: Y(bodyTop), w: widestUnits * 2 * scale, h: BASE_Y - Y(bodyTop) },
      widest: widestUnits * scale,
      bellyY: Y(bodyTop * 0.42),
    },
    head: { cx: 150, cy: Y(headCy), rx: headRx * scale, ry: headRy * scale, topY: Y(headCy + headRy) },
  };
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
  const paintKey = JSON.stringify(paint);
  const sheets = useMemo(() => paintSheets(paint, fired), [paintKey, fired]);
  const uid = useMemo(() => `kf${Math.random().toString(36).slice(2, 9)}`, []);
  const f = (name: Parameters<typeof kittyFeature>[1]) => kittyFeature(sculpt, name);

  const layout = kittyLayout(sculpt, step);
  const body = layout.body;
  // Head size comes from the shared layout, which already folds in the head dial.
  const headW = layout.head.rx, headH = layout.head.ry;
  const HY = layout.head.cy;
  // Ears in pixels, from the same units the sculpture uses (0.2 of a unit at dial 1).
  const earR = layout.scale * 0.2 * f("ears");
  const earY = layout.head.topY + earR * 0.35;
  /** Clip a part's painted wrap into the shape just drawn. */
  const wrap = (part: KittyPart, shape: string, box: { x: number; y: number; w: number; h: number }, key: string) => {
    const sheet = sheets[part];
    if (!sheet) return null;
    const clip = `${uid}-${key}`;
    return (
      <g key={`${key}-paint`}>
        <clipPath id={clip}><path d={shape} /></clipPath>
        <image href={sheet} x={box.x} y={box.y} width={box.w} height={box.h} preserveAspectRatio="none" clipPath={`url(#${clip})`} />
      </g>
    );
  };
  const ear = (side: -1 | 1, fill: string, part: KittyPart) => {
    if (sculpt.ears === "none") return null;
    const x = 150 + side * headW * 0.6;
    const shape = sculpt.ears === "round"
      ? `M${round(x - earR)} ${round(earY)}a${round(earR)} ${round(earR)} 0 1 0 ${round(earR * 2)} 0a${round(earR)} ${round(earR)} 0 1 0 ${round(-earR * 2)} 0Z`
      : sculpt.ears === "folded"
        ? `M${round(x - earR * 1.1)} ${round(earY + earR * 0.5)} Q${round(x)} ${round(earY - earR * 0.3)} ${round(x + earR * 1.1)} ${round(earY + earR * 0.5)} Z`
        : `M${round(x - earR)} ${round(earY + earR * 0.6)} L${round(x)} ${round(earY - earR * 1.5)} L${round(x + earR)} ${round(earY + earR * 0.6)} Z`;
    const box = { x: x - earR * 1.2, y: earY - earR * 1.7, w: earR * 2.4, h: earR * 2.6 };
    return (
      <g key={`ear${side}`}>
        <path d={shape} fill={fill} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
        {wrap(part, shape, box, `ear${side > 0 ? "R" : "L"}`)}
        <path d={shape} fill="none" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
        {sculpt.ears === "tufted" && <path d={`M${round(x)} ${round(earY - earR * 1.5)} q${side * earR * 0.3} ${-earR * 0.5} ${side * earR * 0.6} ${-earR * 0.8}`} fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" />}
      </g>
    );
  };
  const eyes = () => {
    const y = HY - headH * 0.12, dx = headW * 0.4, sc = f("eyes");
    const lid = (cx: number, down: boolean) => `M${cx - 8 * sc} ${y + (down ? 0 : 3)} q${8 * sc} ${down ? 6 : -10} ${16 * sc} 0`;
    if (sculpt.eyes === "happy") return <path d={`${lid(150 - dx, false)} ${lid(150 + dx, false)}`} fill="none" stroke={INK} strokeWidth={3.5 * sc} strokeLinecap="round" />;
    if (sculpt.eyes === "sleepy") return <path d={`${lid(150 - dx, true)} ${lid(150 + dx, true)}`} fill="none" stroke={INK} strokeWidth={3.5 * sc} strokeLinecap="round" />;
    if (sculpt.eyes === "closed") return <path d={`M${150 - dx - 7 * sc} ${y} h${14 * sc} M${150 + dx - 7 * sc} ${y} h${14 * sc}`} fill="none" stroke={INK} strokeWidth={3 * sc} strokeLinecap="round" />;
    const r = (sculpt.eyes === "wide" ? 8.5 : 6.5) * sc;
    const ball = (cx: number) => (
      <g key={cx}>
        <ellipse cx={cx} cy={y} rx={r * 1.15} ry={r * 1.3} fill={c.tone(T.white)} stroke={INK} strokeWidth={1.5} />
        <ellipse cx={cx} cy={y} rx={r * 0.78} ry={r * 1.02} fill={INK} />
        <circle cx={cx + r * 0.3} cy={y - r * 0.42} r={r * 0.3} fill={c.tone(T.white)} />
        {sculpt.eyes === "sparkle" && <circle cx={cx - r * 0.36} cy={y + r * 0.4} r={r * 0.18} fill={c.tone(T.white)} />}
      </g>
    );
    if (sculpt.eyes === "wink")
      return (
        <>
          {ball(150 - dx)}
          <path d={lid(150 + dx, false)} fill="none" stroke={INK} strokeWidth={3.5 * sc} strokeLinecap="round" />
        </>
      );
    return (
      <>
        {ball(150 - dx)}
        {ball(150 + dx)}
      </>
    );
  };
  const noseY = HY + headH * 0.2;
  const nose = () => {
    const sc = f("nose");
    if (sculpt.nose === "heart") return <path d={`M150 ${noseY + 5} l${-5 * sc} ${-5 * sc} q${-3 * sc} ${-4 * sc} ${1 * sc} ${-6 * sc} q${3 * sc} ${-1 * sc} ${4 * sc} ${2 * sc} q${1 * sc} ${-3 * sc} ${4 * sc} ${2 * sc} q${4 * sc} ${2 * sc} ${1 * sc} ${6 * sc} Z`} fill={c.tone(T.blush)} />;
    return <ellipse cx={150} cy={noseY} rx={(sculpt.nose === "tiny" ? 3 : 5) * sc} ry={(sculpt.nose === "tiny" ? 2.2 : 3.4) * sc} fill={c.tone(T.blush)} />;
  };
  const mouth = () => {
    const sc = f("mouth"), y = noseY + 10;
    if (sculpt.mouth === "w" || sculpt.mouth === "tongue")
      return (
        <>
          <path d={`M${150 - 12 * sc} ${y} q${6 * sc} ${7 * sc} ${12 * sc} 0 q${6 * sc} ${7 * sc} ${12 * sc} 0`} fill="none" stroke={INK} strokeWidth={3 * sc} strokeLinecap="round" />
          {sculpt.mouth === "tongue" && <ellipse cx={150} cy={y + 7 * sc} rx={5 * sc} ry={4 * sc} fill={c.tone(T.tongue)} />}
        </>
      );
    if (sculpt.mouth === "smile") return <path d={`M${150 - 14 * sc} ${y - 2} q${14 * sc} ${14 * sc} ${28 * sc} 0`} fill="none" stroke={INK} strokeWidth={3 * sc} strokeLinecap="round" />;
    if (sculpt.mouth === "grin") return <path d={`M${150 - 18 * sc} ${y - 3} q${18 * sc} ${18 * sc} ${36 * sc} 0 Z`} fill={c.tone(T.white)} stroke={INK} strokeWidth={3} strokeLinejoin="round" />;
    if (sculpt.mouth === "oh") return <ellipse cx={150} cy={y + 2} rx={6 * sc} ry={7 * sc} fill={c.tone(T.tongue)} stroke={INK} strokeWidth={2.5} />;
    return <path d={`M${150 - 7 * sc} ${y} h${14 * sc}`} fill="none" stroke={INK} strokeWidth={2.5 * sc} strokeLinecap="round" />;
  };
  const whiskers = () => {
    if (sculpt.whiskers === "none") return null;
    const sc = f("whiskers");
    const len = (sculpt.whiskers === "long" ? 44 : 26) * sc;
    const rows = sculpt.whiskers === "curly" ? [0, 8] : [-6, 0, 6];
    const inner = headW * 0.5;
    const y0 = noseY + 3;
    return (
      <path
        d={rows.map((dy) => (sculpt.whiskers === "curly"
          ? `M${150 - inner} ${y0 + dy} q${-16 * sc} -2 ${-22 * sc} ${dy > 0 ? 10 : -10} M${150 + inner} ${y0 + dy} q${16 * sc} -2 ${22 * sc} ${dy > 0 ? 10 : -10}`
          : `M${150 - inner} ${y0 + dy} l${-len} ${dy * 0.7} M${150 + inner} ${y0 + dy} l${len} ${dy * 0.7}`)).join(" ")}
        fill="none" stroke={INK} strokeWidth={2 * Math.min(1.6, sc)} strokeLinecap="round"
      />
    );
  };
  const tail = () => {
    if (sculpt.tail === "none") return null;
    const sc = f("tail");
    const x = 150 + body.widest * 0.82, base = BASE_Y - 18;
    const d = sculpt.tail === "curl"
      ? `M${x - 8} ${base} C${x + 44} ${base} ${x + 54} ${base - 48} ${x + 32} ${base - 74}`
      : sculpt.tail === "up"
        ? `M${x - 10} ${base - 8} C${x + 28} ${base - 40} ${x + 34} ${base - 80} ${x + 20} ${base - 122}`
        : `M${150 - body.widest * 0.8} ${BASE_Y - 4} C${150 - 20} ${BASE_Y + 14} ${150 + 40} ${BASE_Y + 14} ${x + 10} ${BASE_Y - 4}`;
    return <path d={d} fill="none" stroke={c.tail} strokeWidth={17 * sc} strokeLinecap="round" />;
  };
  const headShape = sculpt.head === "heart"
    ? `M150 ${HY + headH} C${150 - headW * 1.3} ${HY + headH * 0.3} ${150 - headW * 0.9} ${HY - headH * 1.05} 150 ${HY - headH * 0.45} C${150 + headW * 0.9} ${HY - headH * 1.05} ${150 + headW * 1.3} ${HY + headH * 0.3} 150 ${HY + headH} Z`
    : sculpt.head === "wedge"
      ? `M${150 - headW} ${HY - headH * 0.5} Q150 ${HY - headH * 1.15} ${150 + headW} ${HY - headH * 0.5} Q${150 + headW * 0.7} ${HY + headH * 0.9} 150 ${HY + headH} Q${150 - headW * 0.7} ${HY + headH * 0.9} ${150 - headW} ${HY - headH * 0.5} Z`
      : `M${150 - headW} ${HY}a${headW} ${headH} 0 1 0 ${headW * 2} 0a${headW} ${headH} 0 1 0 ${-headW * 2} 0Z`;
  const pawR = Math.min(24, body.widest * 0.32), pawX = body.widest * 0.46;
  const pawShape = `M${150 - pawX - pawR} ${BASE_Y - 4}a${pawR} ${pawR * 0.5} 0 1 0 ${pawR * 2} 0a${pawR} ${pawR * 0.5} 0 1 0 ${-pawR * 2} 0ZM${150 + pawX - pawR} ${BASE_Y - 4}a${pawR} ${pawR * 0.5} 0 1 0 ${pawR * 2} 0a${pawR} ${pawR * 0.5} 0 1 0 ${-pawR * 2} 0Z`;
  const doorW = Math.min(78, body.widest * 1.15), doorH = doorW * 0.9, doorY = Math.min(BASE_Y - doorH - 22, body.bellyY);
  // Without a canvas the wrap cannot be rasterised, so stamps and add-ons draw
  // straight into the SVG from the same artwork, at the same spots.
  const vectorStamps = () => {
    if (Object.keys(sheets).length) return null;
    const boxes: Partial<Record<KittyPart, { x: number; y: number; w: number; h: number }>> = {
      body: body.box,
      head: { x: 150 - headW, y: HY - headH, w: headW * 2, h: headH * 2 },
      earL: { x: 150 - headW * 0.6 - earR * 1.2, y: earY - earR * 1.7, w: earR * 2.4, h: earR * 2.6 },
      earR: { x: 150 + headW * 0.6 - earR * 1.2, y: earY - earR * 1.7, w: earR * 2.4, h: earR * 2.6 },
      paws: { x: 150 - pawX - pawR, y: BASE_Y - 14, w: (pawX + pawR) * 2, h: 20 },
      tail: { x: 150 + body.widest * 0.6, y: BASE_Y - 110, w: 70, h: 100 },
    };
    return paint.stamps.map((stamp) => {
      const spot = stampPlacement(stamp);
      const box = boxes[spot.part];
      if (!box) return null;
      const window_ = FRONT_WINDOW[spot.part];
      const x = box.x + ((spot.u - window_.u0) / (window_.u1 - window_.u0)) * box.w;
      const y = box.y + (1 - spot.v) * box.h;
      if (x < box.x - 4 || x > box.x + box.w + 4) return null;
      const r = stamp.size * 60;
      const transform = `translate(${round(x)} ${round(y)}) rotate(${stamp.rotation}) scale(${Math.round(r * 100) / 100})`;
      if (stamp.kind === "initial")
        return <text key={stamp.id} transform={transform} textAnchor="middle" dominantBaseline="middle" fontFamily="Georgia, serif" fontWeight={700} fontSize={1.6} fill={c.tone(stamp.color)}>{(stamp.text ?? "").slice(0, 2)}</text>;
      return (
        <g key={stamp.id} transform={transform}>
          {STAMP_ART[stamp.kind].map((art, index) => (
            <path
              key={index}
              d={art.d}
              fill={art.stroke ? "none" : c.tone(stampRoleColor(art.role, stamp))}
              stroke={art.stroke ? c.tone(stampRoleColor(art.role, stamp)) : undefined}
              strokeWidth={art.stroke}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </g>
      );
    });
  };
  return (
    <svg className={className} viewBox="0 0 300 360" style={style} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <ellipse cx="150" cy={BASE_Y + 12} rx={Math.max(70, body.widest * 1.25)} ry="13" fill={c.tone(T.shadow)} opacity={0.9} />
      {tail()}
      <path d={body.d} fill={c.body} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      {wrap("body", body.d, body.box, "body")}
      <path d={body.d} fill="none" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      <path d={pawShape} fill={c.paws} stroke={INK} strokeWidth={2.5} />
      {wrap("paws", pawShape, { x: 150 - pawX - pawR, y: BASE_Y - 16, w: (pawX + pawR) * 2, h: 24 }, "paws")}
      <path d={pawShape} fill="none" stroke={INK} strokeWidth={2.5} />
      <rect x={150 - doorW / 2} y={doorY} width={doorW} height={doorH} rx="12" fill={open ? c.tone(T.doorOpen) : c.body} stroke={c.tone(T.doorTrim)} strokeWidth={4} />
      {open && (
        <>
          <rect x={150 - doorW / 2 + 8} y={doorY + 16} width={doorW - 16} height={doorH - 32} fill={c.tone(T.paper)} />
          <path d={`M${150 - doorW / 2 + 8} ${doorY + 16} l${doorW / 2 - 8} ${(doorH - 32) * 0.6} l${doorW / 2 - 8} ${-(doorH - 32) * 0.6}`} fill="none" stroke={c.tone(T.flap)} />
        </>
      )}
      {ear(-1, c.earL, "earL")}
      {ear(1, c.earR, "earR")}
      <path d={headShape} fill={c.head} stroke={INK} strokeWidth={3} />
      {wrap("head", headShape, { x: 150 - headW, y: HY - headH, w: headW * 2, h: headH * 2 }, "head")}
      <path d={headShape} fill="none" stroke={INK} strokeWidth={3} />
      <rect x={150 - headW * 0.28} y={HY - headH - 5} width={headW * 0.56} height="7" rx="2" fill={c.tone(T.brass)} />
      {whiskers()}
      {eyes()}
      {nose()}
      {mouth()}
      {vectorStamps()}
      {fired && <ellipse cx={150 - body.widest * 0.55} cy={body.bellyY} rx={9} ry={22} fill={c.tone(T.white)} opacity={0.3} transform={`rotate(-12 ${150 - body.widest * 0.55} ${body.bellyY})`} />}
      {fired && <ellipse cx={150 - headW * 0.55} cy={HY - headH * 0.3} rx={5} ry={11} fill={c.tone(T.white)} opacity={0.35} transform={`rotate(-20 ${150 - headW * 0.55} ${HY - headH * 0.3})`} />}
    </svg>
  );
}

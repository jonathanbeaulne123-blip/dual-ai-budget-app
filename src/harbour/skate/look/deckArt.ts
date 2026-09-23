/**
 * Tideline Skate Club v2 · deck art, painted at runtime.
 *
 * Nothing is downloaded: the grip's grain and cut-out and the underside's
 * print are drawn onto a canvas once per deck in the island's cut-paper
 * language — flat inks, a pale "paper shadow" offset under every shape, a
 * deckled border. Original Hearth motifs only: waves, lanterns, a
 * lighthouse, apples, stars, kitty paws.
 *
 * Canvas is optional. With no DOM (tests, workers) or no 2D context, the
 * board simply wears flat colours.
 */

export type Paint2D = Pick<CanvasRenderingContext2D,
  'fillStyle' | 'strokeStyle' | 'lineWidth' | 'globalAlpha' | 'font' | 'textAlign' | 'textBaseline' |
  'fillRect' | 'beginPath' | 'closePath' | 'moveTo' | 'lineTo' | 'arc' | 'ellipse' | 'quadraticCurveTo' | 'bezierCurveTo' |
  'fill' | 'stroke' | 'save' | 'restore' | 'translate' | 'rotate' | 'scale' | 'fillText' | 'clearRect'>;

export type CanvasLike = { width: number; height: number; getContext(kind: '2d'): unknown };
export type CanvasFactory = (w: number, h: number) => CanvasLike | null;

/** The DOM's canvas when there is one; null otherwise (never throws). */
export const domCanvas: CanvasFactory = (w, h) => {
  try {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  } catch { return null; }
};

export function context2d(canvas: CanvasLike | null): Paint2D | null {
  if (!canvas) return null;
  try { return (canvas.getContext('2d') as Paint2D | null) ?? null; } catch { return null; }
}

export type DeckInk = { id: string; name: string; colour: string; ink: string };
export type DeckMotif = 'waves' | 'lanterns' | 'lighthouse' | 'apples' | 'stars' | 'paws';
export const DECK_MOTIF: Readonly<Record<string, DeckMotif>> = Object.freeze({
  tideline: 'waves', afterglow: 'lanterns', saltwood: 'lighthouse', orchard: 'apples', northlight: 'stars', islander: 'paws',
});

/** Deterministic little RNG so the same deck always has the same grain. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function seedOf(id: string): number { let h = 2166136261; for (let i = 0; i < id.length; i += 1) h = Math.imul(h ^ id.charCodeAt(i), 16777619); return h >>> 0; }

function star(c: Paint2D, x: number, y: number, r: number): void {
  c.beginPath();
  for (let i = 0; i < 10; i += 1) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r; const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; if (i) c.lineTo(px, py); else c.moveTo(px, py); }
  c.closePath(); c.fill();
}
function paw(c: Paint2D, x: number, y: number, r: number): void {
  c.beginPath(); c.ellipse(x, y + r * .3, r * .62, r * .5, 0, 0, Math.PI * 2); c.fill();
  for (let i = 0; i < 4; i += 1) { const a = -Math.PI / 2 + (i - 1.5) * .55; c.beginPath(); c.ellipse(x + Math.cos(a) * r * .95, y + Math.sin(a) * r * .8, r * .22, r * .27, a + Math.PI / 2, 0, Math.PI * 2); c.fill(); }
}
function apple(c: Paint2D, x: number, y: number, r: number, leaf: string, body: string): void {
  c.fillStyle = body;
  c.beginPath(); c.arc(x - r * .38, y, r * .7, 0, Math.PI * 2); c.arc(x + r * .38, y, r * .7, 0, Math.PI * 2); c.fill();
  c.fillRect(x - r * .06, y - r * 1.05, r * .12, r * .4);
  c.fillStyle = leaf; c.beginPath(); c.ellipse(x + r * .3, y - r * .9, r * .32, r * .14, -.5, 0, Math.PI * 2); c.fill();
}
function lantern(c: Paint2D, x: number, y: number, r: number, body: string, glow: string): void {
  c.fillStyle = glow; c.globalAlpha = .35; c.beginPath(); c.arc(x, y, r * 1.5, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
  c.fillStyle = body; c.fillRect(x - r * .06, y - r * 2.6, r * .12, r * 1.7);
  c.beginPath(); c.ellipse(x, y, r * .78, r, 0, 0, Math.PI * 2); c.fill();
  c.fillRect(x - r * .5, y - r * 1.1, r, r * .22); c.fillRect(x - r * .5, y + r * .9, r, r * .22);
  c.fillStyle = glow; c.fillRect(x - r * .05, y - r * .7, r * .1, r * 1.4);
}

/**
 * The grip: dark tape with a fine grain, and one shape cut out of it so the
 * deck colour shows through — every board recognisable from the top.
 */
export function paintGrip(c: Paint2D, w: number, h: number, deck: DeckInk, grain: boolean): void {
  c.fillStyle = '#23292c'; c.fillRect(0, 0, w, h);
  if (grain) {
    const r = rng(seedOf(deck.id));
    const n = Math.round(w * h / 60);
    for (let i = 0; i < n; i += 1) {
      c.fillStyle = r() < .5 ? '#343c40' : '#1a1f21';
      c.fillRect(Math.floor(r() * w), Math.floor(r() * h), 1 + (r() < .2 ? 1 : 0), 1);
    }
  }
  const motif = DECK_MOTIF[deck.id] ?? 'waves';
  const cx = w / 2, cy = h / 2, s = w * .2;
  c.fillStyle = deck.colour;
  if (motif === 'waves') {
    // A single wave cut across the middle.
    c.beginPath(); c.moveTo(0, cy + s * .2);
    for (let i = 0; i <= 4; i += 1) c.quadraticCurveTo(w * (i + .5) / 4, cy - s * .55, w * (i + 1) / 4, cy + s * .2);
    c.lineTo(w, cy + s * .55); c.lineTo(0, cy + s * .55); c.closePath(); c.fill();
  } else if (motif === 'lanterns') { c.beginPath(); c.arc(cx, cy, s * .7, 0, Math.PI * 2); c.fill(); }
  else if (motif === 'lighthouse') { c.beginPath(); c.moveTo(cx, cy - s); c.lineTo(cx + s * .6, cy); c.lineTo(cx, cy + s); c.lineTo(cx - s * .6, cy); c.closePath(); c.fill(); }
  else if (motif === 'apples') apple(c, cx, cy, s * .7, deck.ink, deck.colour);
  else if (motif === 'stars') star(c, cx, cy, s * .85);
  else paw(c, cx, cy, s * .75);
  // A pale scored line where the tape was cut, at both kicks.
  c.fillStyle = '#4a5458';
  c.fillRect(w * .1, h * .145, w * .8, Math.max(1, h * .004));
  c.fillRect(w * .1, h * .851, w * .8, Math.max(1, h * .004));
}

/**
 * The underside: a cut-paper print. Deck colour ground, deckled paper border,
 * the motif in ink with a pale paper shadow, and the deck's name along the
 * length. Canvas top is the nose.
 */
export function paintGraphic(c: Paint2D, w: number, h: number, deck: DeckInk): void {
  const r = rng(seedOf(deck.id) ^ 0x9e3779b9);
  c.fillStyle = deck.colour; c.fillRect(0, 0, w, h);
  // Deckled paper panel.
  c.fillStyle = '#f6ecd6';
  c.beginPath();
  const inset = w * .12, steps = 26;
  for (let i = 0; i <= steps; i += 1) { const y = h * .08 + (h * .84) * i / steps; const x = inset + (r() - .5) * w * .02; if (i) c.lineTo(x, y); else c.moveTo(x, y); }
  for (let i = steps; i >= 0; i -= 1) { const y = h * .08 + (h * .84) * i / steps; c.lineTo(w - inset + (r() - .5) * w * .02, y); }
  c.closePath(); c.fill();
  const motif = DECK_MOTIF[deck.id] ?? 'waves';
  const cx = w / 2, s = w * .16;
  // Everything twice: a pale offset "paper shadow" first, then the ink.
  const layer = (draw: (ink: string, soft: string) => void) => {
    c.save(); c.translate(w * .015, h * .008); c.globalAlpha = .28; draw('#8a7a62', '#8a7a62'); c.restore();
    c.globalAlpha = 1; draw(deck.ink, deck.colour);
  };
  layer((ink, soft) => {
    c.fillStyle = ink;
    if (motif === 'waves') {
      for (let row = 0; row < 6; row += 1) {
        const y = h * (.2 + row * .11);
        c.fillStyle = row % 2 ? soft : ink;
        c.beginPath(); c.moveTo(inset, y + s * .5);
        for (let i = 0; i < 4; i += 1) { const x0 = inset + (w - inset * 2) * i / 4, x1 = inset + (w - inset * 2) * (i + 1) / 4; c.quadraticCurveTo((x0 + x1) / 2, y - s * .6, x1, y + s * .5); }
        c.lineTo(w - inset, y + s); c.lineTo(inset, y + s); c.closePath(); c.fill();
      }
    } else if (motif === 'lanterns') {
      for (let i = 0; i < 3; i += 1) lantern(c, cx + (i - 1) * s * 1.3, h * (.3 + i * .18), s * .7, ink, soft);
    } else if (motif === 'lighthouse') {
      const base = h * .78, top = h * .3;
      c.beginPath(); c.moveTo(cx - s * .9, base); c.lineTo(cx - s * .5, top); c.lineTo(cx + s * .5, top); c.lineTo(cx + s * .9, base); c.closePath(); c.fill();
      c.fillStyle = soft;
      for (let i = 0; i < 3; i += 1) { const y = top + (base - top) * (i * 2 + 1) / 7; const k = (y - top) / (base - top); const half = s * (.5 + .4 * k); c.fillRect(cx - half, y, half * 2, (base - top) / 7); }
      c.fillStyle = ink; c.fillRect(cx - s * .6, top - s * .7, s * 1.2, s * .7);
      c.beginPath(); c.moveTo(cx - s * .7, top - s * .7); c.lineTo(cx, top - s * 1.4); c.lineTo(cx + s * .7, top - s * .7); c.closePath(); c.fill();
      c.fillStyle = soft; c.globalAlpha *= .8;
      c.beginPath(); c.moveTo(cx, top - s * .35); c.lineTo(w - inset, top - s * 1.6); c.lineTo(w - inset, top + s * .6); c.closePath(); c.fill();
    } else if (motif === 'apples') {
      for (let i = 0; i < 5; i += 1) apple(c, cx + ((i % 2) - .5) * s * 1.4, h * (.22 + i * .13), s * .6, soft, ink);
    } else if (motif === 'stars') {
      for (let i = 0; i < 9; i += 1) star(c, inset + r() * (w - inset * 2), h * (.15 + i * .075), s * (.25 + r() * .35));
      c.beginPath(); c.arc(cx, h * .72, s * 1.1, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#f6ecd6'; c.beginPath(); c.arc(cx + s * .45, h * .7, s * .95, 0, Math.PI * 2); c.fill();
    } else {
      for (let i = 0; i < 6; i += 1) paw(c, cx + (i % 2 ? s * .6 : -s * .6), h * (.2 + i * .11), s * .55);
    }
  });
  // The name, along the board, near the tail.
  c.save();
  c.translate(w * .5, h * .86); c.rotate(-Math.PI / 2);
  c.fillStyle = deck.ink; c.font = `bold ${Math.round(w * .11)}px sans-serif`; c.textAlign = 'left'; c.textBaseline = 'middle';
  c.fillText(deck.name.toUpperCase(), 0, 0);
  c.restore();
}

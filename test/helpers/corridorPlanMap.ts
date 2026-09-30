/**
 * TEST-ONLY debug render of corridor plans over the island (Track P): terrain hillshade + water, the road from its
 * stations (grey), markings (white), lamps (yellow), planting (green by species), scenic stops (red) and proposed
 * stops (red dashed). One overview plus zoomed insets, written as a PNG with sharp (like scripts/horizon/slope-map.mjs).
 */
import sharp from 'sharp';
import type { CorridorPlan, PlanInput } from '../../src/harbour/horizon/land/corridor/plan.ts';
import type { PlantSpecies } from '../../src/harbour/horizon/land/corridor/types.ts';
import { Frame } from '../../src/harbour/horizon/land/corridor/plan/frame.ts';
import { canopyOf } from '../../src/harbour/horizon/land/corridor/plan/species.ts';
import type { Island } from './corridorStations.ts';

const SPECIES_COLOUR: Record<PlantSpecies, string> = {
  pine: '#1f5a3a', alpine: '#2d6b4f', birch: '#9ccf6a', round: '#3f8f3a', fruit: '#6aa84f', poplar: '#5b8f2a',
  palm: '#0fa37f', shrub: '#4f7f3a', flowering: '#d86fb0', hedge: '#2f6f2f', heath: '#8a6fa8', flowerBed: '#e07a9a', grassTuft: '#b7c46a',
};

export interface MapInput { input: PlanInput; plan: CorridorPlan }
interface View { name: string; x0: number; z0: number; w: number; h: number; px: number }

function terrainPng(I: Island, v: View): Promise<Buffer> {
  const W = Math.round(v.w * v.px), H = Math.round(v.h * v.px), buf = Buffer.alloc(W * H * 3), step = 1 / v.px;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = v.x0 + (i + 0.5) * step, z = v.z0 + (j + 0.5) * step, k = (j * W + i) * 3;
    if (I.water(x, z)) { buf[k] = 150; buf[k + 1] = 186; buf[k + 2] = 204; continue; }
    const g = I.ground(x, z), gx = I.ground(x + 1, z) - I.ground(x - 1, z), gz = I.ground(x, z + 1) - I.ground(x, z - 1);
    const shade = Math.max(0.55, Math.min(1.15, 0.9 - (gx * 0.6 + gz * 0.8) / 2 * 0.25));
    const t = Math.max(0, Math.min(1, g / 120));
    const base = [226 - 40 * t, 221 - 30 * t, 196 - 45 * t];
    buf[k] = Math.min(255, base[0]! * shade); buf[k + 1] = Math.min(255, base[1]! * shade); buf[k + 2] = Math.min(255, base[2]! * shade);
  }
  return sharp(buf, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();
}

function overlay(maps: readonly MapInput[], v: View): string {
  const X = (x: number) => ((x - v.x0) * v.px).toFixed(1), Z = (z: number) => ((z - v.z0) * v.px).toFixed(1), S = (d: number) => (d * v.px).toFixed(2);
  const inView = (x: number, z: number, m = 20) => x > v.x0 - m && x < v.x0 + v.w + m && z > v.z0 - m && z < v.z0 + v.h + m;
  const parts: string[] = [];
  for (const { input, plan } of maps) {
    const F = new Frame(input.stations, input.closed);
    // Road: a polygon strip per 2 eu station pair (paved edges), grey; structures darker.
    const road: string[] = [];
    for (let k = 0; k < F.n - (input.closed ? 0 : 1); k++) {
      const a = F.st(k), b = F.st(k + 1); if (!inView(a.at[0], a.at[2])) continue;
      const pa = F.point(a.s, -a.left.paved), pb = F.point(a.s, a.right.paved), s2 = k + 1 === F.n ? F.length : b.s;
      const qa = F.point(s2, b.right.paved), qb = F.point(s2, -b.left.paved);
      road.push(`<polygon points="${X(pa[0])},${Z(pa[2])} ${X(pb[0])},${Z(pb[2])} ${X(qa[0])},${Z(qa[2])} ${X(qb[0])},${Z(qb[2])}" fill="${a.structureId ? '#6d6d73' : '#8f8f94'}"/>`);
      if (a.median) { const m1 = F.point(a.s, -a.median.half), m2 = F.point(a.s, a.median.half), m3 = F.point(s2, a.median.half), m4 = F.point(s2, -a.median.half); road.push(`<polygon points="${X(m1[0])},${Z(m1[2])} ${X(m2[0])},${Z(m2[2])} ${X(m3[0])},${Z(m3[2])} ${X(m4[0])},${Z(m4[2])}" fill="#7aa060"/>`); }
      for (const side of ['left', 'right'] as const) {
        const fw = a[side].footway; if (!fw) continue; const sg = side === 'right' ? 1 : -1;
        const f1 = F.point(a.s, sg * fw.inner), f2 = F.point(a.s, sg * fw.outer), f3 = F.point(s2, sg * fw.outer), f4 = F.point(s2, sg * fw.inner);
        road.push(`<polygon points="${X(f1[0])},${Z(f1[2])} ${X(f2[0])},${Z(f2[2])} ${X(f3[0])},${Z(f3[2])} ${X(f4[0])},${Z(f4[2])}" fill="#d8ccb0"/>`);
      }
    }
    parts.push(`<g shape-rendering="crispEdges">${road.join('')}</g>`);
    // Markings: white polylines along the run at its offset (dashes shown dashed).
    for (const m of plan.markings) {
      const pts: string[] = [];
      const len = m.to - m.from;
      if (m.kind === 'zebra' || m.kind === 'giveWay') {
        const mid = (m.from + m.to) / 2, [i0, i1] = m.span ?? [m.offset - 1, m.offset + 1];
        for (const s of m.kind === 'zebra' ? [m.from, m.from + 0.75, m.from + 1.5, m.from + 2.25] : [mid]) {
          const a = F.point(s, i0), b = F.point(s, i1); if (!inView(a[0], a[2])) continue;
          parts.push(`<line x1="${X(a[0])}" y1="${Z(a[2])}" x2="${X(b[0])}" y2="${Z(b[2])}" stroke="#fff" stroke-width="${Math.max(0.8, v.px * (m.kind === 'zebra' ? 0.5 : 0.3))}"${m.kind === 'giveWay' ? ` stroke-dasharray="${S(0.6)},${S(0.3)}"` : ''}/>`);
        }
        continue;
      }
      for (let d = 0; d <= len + 1e-6; d += Math.min(2, len)) { const p = F.point(m.from + d, m.offset); pts.push(`${X(p[0])},${Z(p[2])}`); }
      const p0 = F.point(m.from, m.offset); if (!inView(p0[0], p0[2], 400)) continue;
      const dash = m.dash ? ` stroke-dasharray="${S(m.dash[0])},${S(m.dash[1])}"` : '';
      parts.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="${m.kind === 'centreSolid' ? '#fffbe8' : '#ffffff'}" stroke-width="${Math.max(0.7, v.px * (m.kind === 'centreSolid' ? 0.35 : 0.22))}"${dash}/>`);
    }
    // Planting.
    for (const g of plan.planting) for (const it of g.items) {
      if (!inView(it.at[0], it.at[2])) continue;
      const r = Math.max(v.px < 1 ? 0.9 : 1.2, canopyOf(it.species, it.scale) * v.px);
      parts.push(`<circle cx="${X(it.at[0])}" cy="${Z(it.at[2])}" r="${r.toFixed(2)}" fill="${SPECIES_COLOUR[it.species]}" fill-opacity="${it.species === 'grassTuft' || it.species === 'flowerBed' ? 0.9 : 0.85}" stroke="#12301c" stroke-width="${v.px > 2 ? 0.5 : 0.2}"/>`);
    }
    // Lamps: base dot + pool ring.
    for (const l of plan.lamps) {
      if (!inView(l.at[0], l.at[2])) continue;
      if (v.px >= 2) parts.push(`<circle cx="${X(l.pool[0])}" cy="${Z(l.pool[2])}" r="${S(l.poolRadius)}" fill="#ffd98e" fill-opacity="0.12" stroke="#e0a800" stroke-opacity="0.35" stroke-width="0.6"/>`);
      parts.push(`<line x1="${X(l.at[0])}" y1="${Z(l.at[2])}" x2="${X(l.head[0])}" y2="${Z(l.head[2])}" stroke="#7a5a00" stroke-width="${Math.max(0.5, v.px * 0.15)}"/>`);
      parts.push(`<circle cx="${X(l.at[0])}" cy="${Z(l.at[2])}" r="${Math.max(1.6, v.px * 0.5).toFixed(2)}" fill="${l.kind === 'tunnelLamp' ? '#ff9d00' : l.kind === 'bridgeLantern' ? '#ffe44d' : '#ffd000'}" stroke="#5a4200" stroke-width="0.5"/>`);
    }
    // Stops and proposals.
    for (const s of plan.stops) parts.push(`<polygon points="${s.outline.map(p => `${X(p[0])},${Z(p[1])}`).join(' ')}" fill="#e0322c" fill-opacity="0.55" stroke="#a00" stroke-width="${Math.max(1, v.px * 0.3)}"/>`);
    for (const s of plan.stopProposals ?? []) parts.push(`<polygon points="${s.outline.map(p => `${X(p[0])},${Z(p[1])}`).join(' ')}" fill="none" stroke="#e0322c" stroke-width="${Math.max(1.2, v.px * 0.3)}" stroke-dasharray="4,3"/>`);
  }
  return parts.join('');
}

export async function renderPlanMap(I: Island, maps: readonly MapInput[], out: string, insets: readonly { name: string; centre: [number, number]; size: number }[]): Promise<void> {
  const overview: View = { name: 'Island', x0: 280, z0: 150, w: 1480, h: 1360, px: 0.85 };
  const views: View[] = [overview, ...insets.map(i => ({ name: i.name, x0: i.centre[0] - i.size / 2, z0: i.centre[1] - i.size / 2, w: i.size, h: i.size, px: 560 / i.size }))];
  const panels: { svg: string; w: number; h: number }[] = [];
  for (const v of views) {
    const png = await terrainPng(I, v), W = Math.round(v.w * v.px), H = Math.round(v.h * v.px);
    panels.push({ w: W, h: H, svg: `<image href="data:image/png;base64,${png.toString('base64')}" x="0" y="0" width="${W}" height="${H}"/>${overlay(maps, v)}<rect x="0" y="0" width="${W}" height="${H}" fill="none" stroke="#30251f" stroke-width="1.5"/><rect x="6" y="6" width="${v.name.length * 7.4 + 12}" height="20" fill="#f5f0e6" fill-opacity="0.85"/><text x="12" y="21" font-size="13" font-family="Arial, sans-serif" fill="#30251f">${v.name}</text>` });
  }
  // Layout: overview left; insets in a 2-column grid on the right.
  const ov = panels[0]!, pad = 16, insetW = 560, cols = 2;
  const rows = Math.ceil((panels.length - 1) / cols);
  const W = pad + ov.w + pad + cols * (insetW + pad), H = Math.max(ov.h, rows * (insetW + pad)) + 150;
  let body = `<g transform="translate(${pad},70)">${ov.svg}</g>`;
  panels.slice(1).forEach((p, k) => { const cx = pad + ov.w + pad + (k % cols) * (insetW + pad), cy = 70 + Math.floor(k / cols) * (insetW + pad); body += `<g transform="translate(${cx},${cy})"><clipPath id="c${k}"><rect width="${p.w}" height="${p.h}"/></clipPath><g clip-path="url(#c${k})">${p.svg}</g></g>`; });
  const legend = (Object.entries(SPECIES_COLOUR) as [PlantSpecies, string][]).map(([k, c], i) => `<circle cx="${pad + 10 + i * 118}" cy="${H - 56}" r="6" fill="${c}"/><text x="${pad + 20 + i * 118}" y="${H - 51}" font-size="13">${k}</text>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#f5f0e6"/><g font-family="Arial, sans-serif" fill="#30251f"><text x="${pad}" y="32" font-size="22">Horizon main road — corridor plan (Track P) over the committed bake</text><text x="${pad}" y="54" font-size="13">Adapter stations (test-only) for V01, VG, V03 · road grey (structures darker), footways buff, median green · markings white · lamps yellow (pools in insets) · planting by species · stops red (dashed = proposed, needs grading) · north is −z</text>${body}${legend}<text x="${pad}" y="${H - 24}" font-size="12">Builder evidence from test/horizonCorridorPlan.test.ts (CORRIDOR_PLAN_MAP=1); not the in-app look — the art tracks draw these items.</text></g></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(out);
}

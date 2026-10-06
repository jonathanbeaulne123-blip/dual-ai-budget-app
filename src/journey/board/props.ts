/**
 * The board's toys (Horizon Clock, L3), ported from the approved prototype's `propModel`, `coinStack`, `needRing`,
 * `makeBus`, `chapterGate` and Hercules. Each builder returns an AUTHORED group of painted parts (kit.ts `part`) in
 * toy units; the scene bakes them. Shapes and proportions are the prototype's; colours come from the theme palette.
 *
 * Money: `coinStack` takes a `CoinStack` (clock.ts `stackFor`) whose rings came from `ringsFor` — this file never sees
 * an amount. Solid = recorded (gold / mint, shadow-casting); see-through = not recorded (washed, 48 % alpha, an ink
 * dashed rim on top). A capped stack (> 30 rings) shows a break mark below its top ring.
 */
import * as THREE from "three";
import type { ThemeId } from "../contracts.ts";
import type { CoinStack } from "./clock.ts";
import type { PropKind } from "./kinds.ts";
import { at, blob, flatTorus, lathe, part, rbox, type Paint } from "./kit.ts";
import { colourOf, type PaletteKey } from "./palette.ts";

const sph = (r: number, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
const cyl = (rt: number, rb: number, h: number, s = 16, open = false) => new THREE.CylinderGeometry(rt, rb, h, s, 1, open);
const cone = (r: number, h: number, s = 12) => new THREE.ConeGeometry(r, h, s);

/** One prop for a stop kind, in toy units (the prototype's sizes; ~0.3 tall). */
export function propModel(kind: PropKind, theme: ThemeId): THREE.Group {
  const g = new THREE.Group();
  const C = (k: PaletteKey): Paint => ({ color: colourOf(theme, k) });
  const add = (m: THREE.Object3D) => { g.add(m); return m; };
  switch (kind) {
    case "pay": {
      for (let i = 0; i < 3; i += 1) add(at(part(cyl(0.15, 0.15, 0.06, 20), C("coin")), i === 2 ? 0.03 : 0, 0.04 + i * 0.065, i === 1 ? 0.02 : 0));
      add(at(part(flatTorus(0.1, 0.015, 6, 20), C("coinEdge")), 0, 0.205, 0));
      break;
    }
    case "fund": {
      add(part(lathe(18, 0, 0, 0.13, 0, 0.17, 0.17, 0.155, 0.19, 0, 0.19), C("pot")));
      add(at(part(sph(0.1), C("porcelain")), 0, 0.27, 0));
      add(at(part(sph(0.075), C("porcelain")), 0, 0.4, 0));
      for (const sd of [-1, 1]) {
        add(at(part(cone(0.04, 0.09, 8), C("porcelain")), sd * 0.05, 0.48, 0, { rz: -sd * 0.25 }));
        add(at(part(sph(0.012, 6, 4), C("disc")), sd * 0.028, 0.41, 0.07));
      }
      add(at(part(cyl(0.06, 0.06, 0.02, 14), C("coin")), 0, 0.55, 0, { rx: Math.PI / 2 }));
      break;
    }
    case "groceries": {
      add(at(part(rbox(0.3, 0.2, 0.22, 0.05, 3), C("basket")), 0, 0.1, 0));
      add(at(part(new THREE.TorusGeometry(0.11, 0.02, 6, 14, Math.PI), C("basket")), 0, 0.2, 0));
      add(at(part(sph(0.07, 10, 8), C("leafy")), -0.06, 0.22, 0));
      add(at(part(sph(0.07, 10, 8), C("cross")), 0.07, 0.22, 0));
      break;
    }
    case "jar": {
      add(part(lathe(20, 0, 0, 0.13, 0, 0.16, 0.05, 0.16, 0.26, 0.12, 0.31, 0, 0.31), { color: colourOf(theme, "jarGlass"), alpha: 0.8 }));
      add(at(part(cyl(0.13, 0.13, 0.07, 18), C("jarLid")), 0, 0.34, 0));
      add(at(part(new THREE.OctahedronGeometry(0.07, 0), C("snowflake")), 0, 0.16, 0));
      break;
    }
    case "phone": {
      add(at(part(rbox(0.2, 0.34, 0.06, 0.045, 3), C("phone")), 0, 0.19, 0));
      add(at(part(rbox(0.15, 0.25, 0.02, 0.02, 2), C("screen")), 0, 0.2, 0.03));
      break;
    }
    case "vet": {
      add(at(part(rbox(0.3, 0.26, 0.14, 0.06, 3), C("white")), 0, 0.15, 0));
      add(at(part(rbox(0.06, 0.17, 0.03, 0.015, 2), C("cross")), 0, 0.15, 0.075));
      add(at(part(rbox(0.17, 0.06, 0.03, 0.015, 2), C("cross")), 0, 0.15, 0.075));
      for (const sd of [-1, 1]) add(at(part(cone(0.05, 0.1, 10), C("white")), sd * 0.1, 0.31, 0, { rz: -sd * 0.25 }));
      break;
    }
    case "gas": {
      add(at(part(sph(0.12), C("flame")), 0, 0.13, 0));
      add(at(part(cone(0.115, 0.22, 14), C("flame")), 0, 0.3, 0));
      add(at(part(sph(0.06, 10, 8), C("flame2")), 0, 0.13, 0.07));
      break;
    }
    case "internet": {
      add(at(part(rbox(0.28, 0.1, 0.18, 0.04, 3), C("metal")), 0, 0.05, 0));
      for (const sd of [-1, 1]) {
        add(at(part(cyl(0.015, 0.015, 0.22, 6), C("metal")), sd * 0.09, 0.2, -0.04, { rz: sd * 0.25 }));
        add(at(part(sph(0.035, 8, 6), C("discLabel")), sd * 0.118, 0.31, -0.04));
      }
      break;
    }
    case "music": {
      add(at(part(cyl(0.17, 0.17, 0.03, 24), C("disc")), 0, 0.19, 0, { rx: Math.PI / 2.4 }));
      add(at(part(cyl(0.06, 0.06, 0.035, 14), C("discLabel")), 0, 0.19, 0, { rx: Math.PI / 2.4 }));
      add(at(part(rbox(0.16, 0.05, 0.1, 0.02, 2), C("metal")), 0, 0.025, 0));
      break;
    }
    case "rent": {
      add(at(part(rbox(0.26, 0.2, 0.22, 0.04, 3), C("white")), 0, 0.1, 0));
      add(at(part(cone(0.22, 0.16, 4), C("homeRoof")), 0, 0.28, 0, { ry: Math.PI / 4 }));
      break;
    }
    case "hydro": {
      add(at(part(sph(0.12), C("bulb")), 0, 0.24, 0));
      add(at(part(cyl(0.06, 0.07, 0.1, 12), C("metal")), 0, 0.08, 0));
      break;
    }
    case "umbrella": {
      add(at(part(new THREE.SphereGeometry(0.18, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), C("umbrella")), 0, 0.26, 0));
      add(at(part(cyl(0.015, 0.015, 0.28, 6), C("metal")), 0, 0.13, 0));
      break;
    }
    case "tooth": {
      for (const sd of [-1, 1]) add(at(part(cyl(0.05, 0.03, 0.12, 10), C("tooth")), sd * 0.05, 0.06, 0));
      add(at(part(rbox(0.24, 0.16, 0.16, 0.07, 3), C("tooth")), 0, 0.18, 0));
      break;
    }
    case "campfire": {
      // The Chapter close at the Campfire: crossed logs and a flame (no amount, no stack).
      for (const r of [0.6, -0.6]) add(at(part(cyl(0.035, 0.035, 0.3, 8), C("trunk")), 0, 0.04, 0, { rz: Math.PI / 2, ry: r }));
      add(at(part(cone(0.1, 0.22, 12), C("flame")), 0, 0.17, 0));
      add(at(part(cone(0.055, 0.13, 10), C("flame2")), 0, 0.13, 0.03));
      break;
    }
    case "flag": {
      // The weekly Sitdown: a pennant on a pole.
      add(at(part(cyl(0.012, 0.012, 0.42, 6), C("ink")), 0, 0.21, 0));
      add(at(part(cone(0.07, 0.18, 3), C("roof3")), 0.09, 0.36, 0, { rz: -Math.PI / 2 }));
      break;
    }
    case "star": {
      // A goal (a target, never money moving): a star on a stick.
      add(at(part(cyl(0.012, 0.012, 0.3, 6), C("trunk")), 0, 0.15, 0));
      add(at(part(new THREE.OctahedronGeometry(0.1, 0), C("honey")), 0, 0.34, 0, { s: [1, 1, 0.45] }));
      break;
    }
    case "pin": {
      // A planning step: a map pin.
      add(at(part(cone(0.06, 0.2, 10), C("roof2")), 0, 0.1, 0, { rx: Math.PI }));
      add(at(part(sph(0.08, 12, 8), C("roof2")), 0, 0.24, 0));
      add(at(part(sph(0.03, 8, 6), C("white")), 0, 0.26, 0.06));
      break;
    }
    case "home": {
      // A milestone: a little house with a gold roof.
      add(at(part(rbox(0.22, 0.17, 0.2, 0.035, 3), C("wall")), 0, 0.085, 0));
      add(at(part(cone(0.19, 0.15, 4), C("honey")), 0, 0.245, 0, { ry: Math.PI / 4 }));
      break;
    }
    case "heart": {
      // A kept memory: two lobes and a point.
      for (const sd of [-1, 1]) add(at(part(sph(0.07, 12, 8), C("cross")), sd * 0.055, 0.24, 0));
      add(at(part(cone(0.12, 0.17, 4), C("cross")), 0, 0.14, 0, { rx: Math.PI, ry: Math.PI / 4, s: [1, 1, 0.6] }));
      break;
    }
    case "coin":
    default:
      add(at(part(sph(0.12, 12, 8), C("coin")), 0, 0.12, 0));
  }
  return g;
}
/** The prototype's prop top (toy units) above its base: where a label anchors. */
export const PROP_TOP = 0.36;

/** Ring-by-ring coin stack of radius `r` (du). Height = `stack.heightDu`, nothing else. */
export function coinStack(stack: CoinStack, r: number, ringDu: number, theme: ThemeId): { group: THREE.Group; height: number } {
  const g = new THREE.Group();
  const inc = stack.direction === "in";
  const solid = stack.fill === "solid";
  const base = new THREE.Color(colourOf(theme, inc ? "mint" : "coin"));
  const edge = new THREE.Color(colourOf(theme, inc ? "mintEdge" : "coinEdge"));
  const white = new THREE.Color(1, 1, 1);
  const body: Paint = solid ? { color: `#${base.getHexString()}` } : { color: `#${base.clone().lerp(white, 0.55).getHexString()}`, alpha: 0.48 };
  const seam: Paint = solid ? { color: `#${edge.clone().lerp(new THREE.Color(0.27, 0.16, 0.08), 0.35).getHexString()}` } : { color: `#${edge.clone().lerp(white, 0.4).getHexString()}`, alpha: 0.55 };
  const cap: Paint = solid ? { color: `#${edge.clone().lerp(base, 0.5).getHexString()}` } : { color: `#${base.clone().lerp(white, 0.6).getHexString()}`, alpha: 0.6 };
  const height = stack.heightDu;
  const full = Math.floor(stack.rings.drawnRings);
  const rings = Math.max(1, Math.ceil(stack.rings.drawnRings - 1e-9));
  const seamH = Math.min(ringDu * 0.18, 0.006);
  let y = 0;
  for (let i = 0; i < rings; i += 1) {
    const h = i < full ? ringDu : Math.max(height - y, 0.004);
    if (h <= 0) break;
    const ringBody = h - (i < rings - 1 ? seamH : 0);
    g.add(at(part(cyl(r, r, ringBody, 18, true), body), 0, y + ringBody / 2, 0));
    if (i < rings - 1) g.add(at(part(cyl(r * 0.985, r * 0.985, seamH, 18, true), seam), 0, y + ringBody + seamH / 2, 0));
    y += h;
  }
  if (rings === 1 && full === 0) y = height;
  // Bottom and top caps.
  g.add(at(part(new THREE.CircleGeometry(r, 18).rotateX(-Math.PI / 2), cap), 0, Math.min(y, height), 0));
  if (stack.rings.capped) {
    // The break mark: a pale gap and a tilted ink slash one ring below the top.
    const by = Math.max(0, height - ringDu * 1.5);
    g.add(at(part(cyl(r * 1.04, r * 1.04, ringDu * 0.35, 18, true), { color: "#ffffff" }), 0, by, 0));
    g.add(at(part(rbox(r * 2.3, 0.008, 0.02, 0.004, 1), { color: colourOf(theme, "ink") }), 0, by, r * 1.02, { rz: 0.35 }));
  }
  if (!solid) {
    // Ink dashes round the top rim: a see-through stack is never read as a solid one.
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2;
      g.add(at(part(rbox(r * 0.32, 0.008, 0.012, 0.004, 1), { color: colourOf(theme, "ink"), alpha: 0.55 }), Math.cos(a) * r * 1.02, height + 0.004, Math.sin(a) * r * 1.02, { ry: -a + Math.PI / 2 }));
    }
  }
  return { group: g, height };
}

/** The honey needs-you ring with its dark outline (prototype `needRing`). */
export function needRing(R: number, tube: number, theme: ThemeId): THREE.Group {
  const g = new THREE.Group();
  g.add(part(flatTorus(R, tube, 8, 40), colourOf(theme, "honey")));
  g.add(part(flatTorus(R + tube * 1.05, tube * 0.42, 6, 40), colourOf(theme, "ink")));
  return g;
}

/** The "!" bead (a glyph, not text): a honey disc, an ink outline, an ink bar and dot. Faces +z; the scene billboards it. */
export function needBeadGeometryParts(theme: ThemeId): THREE.Group {
  const g = new THREE.Group();
  g.add(at(part(cyl(0.5, 0.5, 0.12, 24), colourOf(theme, "honey")), 0, 0, 0, { rx: Math.PI / 2 }));
  g.add(at(part(new THREE.TorusGeometry(0.5, 0.06, 6, 28), colourOf(theme, "ink")), 0, 0, 0));
  g.add(at(part(rbox(0.13, 0.42, 0.04, 0.05, 2), colourOf(theme, "ink")), 0, 0.12, 0.07));
  g.add(at(part(cyl(0.075, 0.075, 0.04, 12), colourOf(theme, "ink")), 0, -0.25, 0.07, { rx: Math.PI / 2 }));
  return g;
}
/** The honey "›" badge for the next leaving tile (a chevron glyph). Faces +z; billboarded. */
export function nextBadgeParts(theme: ThemeId): THREE.Group {
  const g = new THREE.Group();
  g.add(at(part(cyl(0.5, 0.5, 0.12, 24), colourOf(theme, "honey")), 0, 0, 0, { rx: Math.PI / 2 }));
  g.add(at(part(new THREE.TorusGeometry(0.5, 0.07, 6, 28), { color: "#ffffff" }), 0, 0, 0));
  g.add(at(part(rbox(0.32, 0.1, 0.04, 0.04, 2), { color: "#ffffff" }), 0.02, 0.1, 0.07, { rz: -0.75 }));
  g.add(at(part(rbox(0.32, 0.1, 0.04, 0.04, 2), { color: "#ffffff" }), 0.02, -0.1, 0.07, { rz: 0.75 }));
  return g;
}
/** A small ink bead (more stops on this slot than toys). */
export function moreBead(theme: ThemeId): THREE.Mesh {
  return part(sph(0.06, 10, 8), colourOf(theme, "ink"));
}

/** The household piece: the cat-eared bus (prototype `makeBus`), 0.62 long along +x. */
export function makeBus(theme: ThemeId): THREE.Group {
  const g = new THREE.Group();
  g.add(at(part(rbox(0.62, 0.3, 0.32, 0.1, 4), colourOf(theme, "bus")), 0, 0.24, 0));
  g.add(at(part(rbox(0.5, 0.1, 0.335, 0.04, 3), colourOf(theme, "glass")), 0, 0.29, 0));
  g.add(at(part(rbox(0.63, 0.04, 0.325, 0.02, 2), colourOf(theme, "busEar")), 0, 0.17, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(part(cyl(0.075, 0.075, 0.06, 12), colourOf(theme, "ink")), sx * 0.19, 0.08, sz * 0.15, { rx: Math.PI / 2 }));
  for (const sz of [-1, 1]) g.add(at(part(cone(0.065, 0.13, 10), colourOf(theme, "busEar")), 0.17, 0.44, sz * 0.09, { rx: sz * 0.2 }));
  for (const sz of [-1, 1]) g.add(at(part(sph(0.03, 8, 6), "#fff6c8"), 0.31, 0.2, sz * 0.1));
  g.add(at(blob(0.45, 0.42), 0, 0.012, 0));
  return g;
}
export const BUS_TOP = 0.55;

/** The chapter arch over the top of the dial (prototype `chapterGate`). Day 1's numeral is a DOM label above it. */
export function chapterGate(theme: ThemeId): THREE.Group {
  const g = new THREE.Group();
  g.add(part(new THREE.TorusGeometry(0.42, 0.06, 8, 20, Math.PI), colourOf(theme, "gate")));
  for (const s of [-1, 1]) g.add(at(part(cyl(0.06, 0.07, 0.18, 10), colourOf(theme, "gate")), s * 0.42, -0.05, 0));
  g.add(at(part(cone(0.07, 0.16, 3), colourOf(theme, "roof3")), 0.08, 0.55, 0, { rz: -Math.PI / 2 }));
  g.add(at(part(cyl(0.012, 0.012, 0.2, 6), colourOf(theme, "trunk")), 0, 0.5, 0));
  return g;
}

/**
 * Hercules, procedural clay (prototype; no herculesRig): a seated Maine Coon, ~1.3 toy units tall at scale 1. The
 * head and tail are separate groups so the scene can turn the head toward the bus / selection and wag the tail.
 */
export function makeHercules(theme: ThemeId): { group: THREE.Group; head: THREE.Group; tail: THREE.Group; body: THREE.Group } {
  const fw = colourOf(theme, "furWhite"), ft = colourOf(theme, "tan");
  const group = new THREE.Group(), body = new THREE.Group(), head = new THREE.Group(), tail = new THREE.Group();
  group.add(body, head, tail);
  body.add(at(part(sph(0.5, 24, 16), fw), 0, 0.5, 0, { s: [1, 1.02, 0.86] }));
  body.add(at(part(sph(0.36, 18, 12), ft), -0.08, 0.68, -0.2, { s: [1.05, 0.8, 0.9] }));
  body.add(at(part(sph(0.3, 16, 12), fw), 0, 0.5, 0.26));
  for (const s of [-1, 1]) {
    body.add(at(part(sph(0.12, 12, 8), fw), s * 0.17, 0.08, 0.34, { s: [1, 0.7, 1.3] }));
    body.add(at(part(sph(0.22, 12, 8), fw), s * 0.3, 0.2, 0.04, { s: [0.8, 0.75, 1.1] }));
  }
  head.position.set(0, 1.08, 0.08);
  head.add(at(part(sph(0.36, 24, 16), fw), 0, 0, 0, { s: [1.1, 0.95, 0.95] }));
  head.add(at(part(new THREE.SphereGeometry(0.3, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), ft), 0, 0.06, -0.04, { s: [1.25, 1, 1.1] }));
  for (const s of [-1, 1]) {
    head.add(at(part(cone(0.13, 0.26, 12), ft), s * 0.22, 0.3, -0.02, { rz: -s * 0.32 }));
    head.add(at(part(cone(0.075, 0.16, 10), colourOf(theme, "earIn")), s * 0.215, 0.28, 0.05, { rz: -s * 0.32 }));
    head.add(at(part(sph(0.055, 12, 8), colourOf(theme, "eye")), s * 0.13, 0.02, 0.3, { s: [1, 1.15, 0.6] }));
    head.add(at(part(sph(0.017, 6, 4), "#ffffff"), s * 0.13 + 0.02, 0.05, 0.335));
    head.add(at(part(sph(0.07, 10, 6), { color: colourOf(theme, "cross"), alpha: 0.45 }), s * 0.22, -0.08, 0.26, { s: [1, 0.6, 0.4] }));
  }
  head.add(at(part(sph(0.035, 8, 6), colourOf(theme, "nose")), 0, -0.06, 0.335, { s: [1.3, 0.8, 0.8] }));
  head.add(at(part(sph(0.1, 12, 8), fw), 0, -0.11, 0.28, { s: [1.3, 0.75, 0.7] }));
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.3, 0.12, -0.25), new THREE.Vector3(0.62, 0.12, -0.05), new THREE.Vector3(0.68, 0.18, 0.25), new THREE.Vector3(0.5, 0.3, 0.42),
  ]);
  tail.add(part(new THREE.TubeGeometry(curve, 16, 0.075, 8), ft));
  tail.add(at(part(sph(0.075, 10, 8), ft), 0.5, 0.3, 0.42));
  body.add(at(blob(0.75, 0.45), 0, 0.012, 0));
  return { group, head, tail, body };
}

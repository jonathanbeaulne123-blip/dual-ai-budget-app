import * as THREE from 'three';

/**
 * Tideline Skate Club v2 · the board's shape, in island units.
 *
 * One skateboard at model-village scale: a person is 1.25 tall, so the deck is
 * 0.58 tip to tip and 0.30 wide (a touch chunkier than life so it reads from
 * the chase camera). Board space: nose +z, up +y, width along x, origin on the
 * ground midway between the wheel contacts. Everything the rider and the rig
 * need to know about the board comes from this table, never from the meshes.
 */
export const BOARD = Object.freeze({
  halfLength: .29,
  halfWidth: .15,
  /** Underside of the deck at the centre line, and its thickness. */
  deckBottom: .088,
  thickness: .022,
  /** Edge rise of the concave (the rails are this much higher than the centre line). */
  concave: .007,
  /** Where the kicks start and how high the tips rise above the flat. */
  kickStart: .205,
  kickRise: .036,
  /** Superellipse exponent of the rounded nose/tail outline (2 = ellipse, higher = squarer). */
  outline: 2.5,
  /** Where the rounding of the outline begins. */
  roundStart: .16,
  /** Truck centres along z, axle height, wheel radius and width, and wheel centre x. */
  truckZ: .19,
  axleY: .045,
  wheelRadius: .045,
  wheelWidth: .042,
  wheelX: .128,
  /** The hanger's own pivot height: the deck rolls about this line so the wheels stay down. */
  pivotY: .058,
});

/** Top of the grip at the centre line of the flat section: where soles stand. */
export const DECK_TOP = BOARD.deckBottom + BOARD.thickness;

/** Rise of the kick at |z|. */
export function kickRise(z: number): number {
  const d = Math.abs(z) - BOARD.kickStart;
  if (d <= 0) return 0;
  const span = BOARD.halfLength - BOARD.kickStart;
  return BOARD.kickRise * Math.pow(Math.min(1, d / span), 1.7);
}

/** Half-width of the deck outline at z (0 at the tips). */
export function deckHalfWidth(z: number): number {
  const a = Math.abs(z);
  if (a >= BOARD.halfLength) return 0;
  if (a <= BOARD.roundStart) return BOARD.halfWidth;
  const t = (a - BOARD.roundStart) / (BOARD.halfLength - BOARD.roundStart);
  const p = BOARD.outline;
  return BOARD.halfWidth * Math.pow(Math.max(0, 1 - Math.pow(t, p)), 1 / p);
}

/** Height of the grip surface above the board origin at (x, z). */
export function deckTopAt(x: number, z: number): number {
  const hw = deckHalfWidth(z);
  const v = hw > 1e-6 ? Math.min(1, Math.abs(x) / hw) : 0;
  return DECK_TOP + kickRise(z) + BOARD.concave * v * v;
}

/** Tessellation per render tier. */
export type BoardTier = 'full' | 'lite';
export const BOARD_SEGMENTS: Readonly<Record<BoardTier, { along: number; across: number; wheel: number }>> = Object.freeze({
  full: { along: 30, across: 8, wheel: 14 },
  lite: { along: 14, across: 4, wheel: 8 },
});

/** The z of row i of n, packed a little tighter toward the rounded tips. */
function rowZ(i: number, n: number): number {
  const s = (i / n) * 2 - 1;
  return BOARD.halfLength * Math.sign(s) * Math.pow(Math.abs(s), .85);
}

/**
 * The lofted deck: a grip surface (top), a printed underside (bottom) and the
 * edge walls split into the laminated veneers — `edgeWood` for the pale plies
 * and `edgeDyed` for the dyed ones — so the ply stripe is two materials rather
 * than a texture. Kicked nose and tail, concave across, rounded outline.
 */
export function createDeckGeometries(tier: BoardTier): { top: THREE.BufferGeometry; bottom: THREE.BufferGeometry; edgeWood: THREE.BufferGeometry; edgeDyed: THREE.BufferGeometry } {
  const { along, across } = BOARD_SEGMENTS[tier];
  const cols = across + 1, rows = along + 1;
  const topPos: number[] = [], topUv: number[] = [], botPos: number[] = [], botUv: number[] = [];
  for (let i = 0; i < rows; i += 1) {
    const z = rowZ(i, along), hw = deckHalfWidth(z), rise = kickRise(z);
    for (let j = 0; j < cols; j += 1) {
      const v = (j / across) * 2 - 1, x = v * hw;
      const lift = rise + BOARD.concave * v * v;
      topPos.push(x, DECK_TOP + lift, z);
      botPos.push(x, BOARD.deckBottom + lift, z);
      topUv.push(x / (BOARD.halfWidth * 2) + .5, z / (BOARD.halfLength * 2) + .5);
      // Mirrored so the print reads the right way round from underneath.
      botUv.push(.5 - x / (BOARD.halfWidth * 2), z / (BOARD.halfLength * 2) + .5);
    }
  }
  const topIdx: number[] = [], botIdx: number[] = [];
  for (let i = 0; i < along; i += 1) for (let j = 0; j < across; j += 1) {
    const a = i * cols + j, b = (i + 1) * cols + j, c = i * cols + j + 1, d = (i + 1) * cols + j + 1;
    topIdx.push(a, b, c, b, d, c);
    botIdx.push(a, c, b, b, c, d);
  }
  const build = (pos: number[], uv: number[] | null, idx: number[]) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  // Five veneers: pale, dyed, pale, dyed, pale.
  const bands = [0, .22, .38, .62, .78, 1];
  const wood: { pos: number[]; idx: number[] } = { pos: [], idx: [] }, dyed: { pos: [], idx: [] } = { pos: [], idx: [] };
  for (let k = 0; k < bands.length - 1; k += 1) {
    const target = k % 2 === 0 ? wood : dyed;
    for (const side of [-1, 1] as const) {
      const base = target.pos.length / 3;
      for (let i = 0; i < rows; i += 1) {
        const z = rowZ(i, along), x = side * deckHalfWidth(z), lift = kickRise(z) + BOARD.concave;
        const y0 = BOARD.deckBottom + lift + BOARD.thickness * bands[k]!, y1 = BOARD.deckBottom + lift + BOARD.thickness * bands[k + 1]!;
        target.pos.push(x, y0, z, x, y1, z);
      }
      for (let i = 0; i < along; i += 1) {
        const p0 = base + i * 2, p1 = p0 + 1, q0 = p0 + 2, q1 = p0 + 3;
        if (side > 0) target.idx.push(p0, p1, q0, q0, p1, q1);
        else target.idx.push(p0, q0, p1, q0, q1, p1);
      }
    }
  }
  return {
    top: build(topPos, topUv, topIdx), bottom: build(botPos, botUv, botIdx),
    edgeWood: build(wood.pos, null, wood.idx), edgeDyed: build(dyed.pos, null, dyed.idx),
  };
}

/** The hanger: a tapered cast body seen from the front, extruded along z. */
export function createHangerGeometry(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-.1, -.012); s.lineTo(.1, -.012); s.lineTo(.1, .004); s.lineTo(.035, .016);
  s.lineTo(.02, .03); s.lineTo(-.02, .03); s.lineTo(-.035, .016); s.lineTo(-.1, .004); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: .028, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, -.014);
  return g;
}

/** A urethane wheel with a rounded lip (lathe on the full tier), axis along x. */
export function createWheelGeometry(tier: BoardTier): THREE.BufferGeometry {
  const r = BOARD.wheelRadius, w = BOARD.wheelWidth / 2, seg = BOARD_SEGMENTS[tier].wheel;
  let g: THREE.BufferGeometry;
  if (tier === 'full') {
    const lip = r * .28, pts: THREE.Vector2[] = [];
    pts.push(new THREE.Vector2(r * .52, -w));
    for (let i = 0; i <= 3; i += 1) { const a = -Math.PI / 2 + (i / 3) * (Math.PI / 2); pts.push(new THREE.Vector2(r - lip + Math.cos(a) * lip, -w + lip + Math.sin(a) * lip)); }
    for (let i = 0; i <= 3; i += 1) { const a = (i / 3) * (Math.PI / 2); pts.push(new THREE.Vector2(r - lip + Math.cos(a) * lip, w - lip + Math.sin(a) * lip)); }
    pts.push(new THREE.Vector2(r * .52, w));
    g = new THREE.LatheGeometry(pts, seg);
  } else {
    g = new THREE.CylinderGeometry(r, r, w * 2, seg, 1, true);
  }
  // Lathe/cylinder axes are y; a wheel's axle is x.
  g.rotateZ(Math.PI / 2);
  return g;
}

/** The wheel's core (bearing seat): six flat facets so the spin reads under raking light. */
export function createWheelCoreGeometry(): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(BOARD.wheelRadius * .54, BOARD.wheelRadius * .54, BOARD.wheelWidth * .98, 6);
  g.rotateZ(Math.PI / 2);
  return g;
}

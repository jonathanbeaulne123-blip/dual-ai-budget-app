import * as THREE from 'three';
import {SKATE_DECKS,type SkateDeckId} from './park.ts';
import {BOARD,DECK_TOP,createDeckGeometries,createHangerGeometry,createWheelCoreGeometry,createWheelGeometry,deckTopAt,type BoardTier} from './look/boardGeometry.ts';
import {context2d,domCanvas,paintGraphic,paintGrip,type CanvasFactory,type CanvasLike} from './look/deckArt.ts';
import {FALLBACK_FLIPS} from './look/catalogs.ts';
import {flipMatrix} from './look/boardRig.ts';

/**
 * Tideline Skate Club v2 · the board itself.
 *
 * A lofted deck with concave, kicked nose and tail and a rounded outline; the
 * laminated ply stripe on its edge; grip tape with a per-deck cut-out; a
 * cut-paper print underneath painted at runtime from `SKATE_DECKS`; trucks
 * (baseplate, bushings, kingpin, hanger, axle) whose hangers stay level while
 * the deck leans and steer the wheels; urethane wheels with faceted cores that
 * roll with speed. Origin on the ground between the wheel contacts, nose +z
 * (see `look/boardGeometry.ts`).
 *
 * The v1 API (`group`, `setDeck`, `pose(speed, dt, act, p, pitch, bank)`,
 * `dispose`) still works for the walker and the partner; the look façade
 * drives the richer one (`setCarve`, `setWheelAngle`).
 */
export type SkateboardOptions = { tier?: BoardTier; canvas?: CanvasFactory };
export type Skateboard = {
  group: THREE.Group;
  readonly tier: BoardTier;
  readonly deckId: SkateDeckId;
  setDeck(id: SkateDeckId): void;
  /** v1 pose: rolls the wheels, leans with `bank`, and plays a coarse wire act. */
  pose(speed: number, dt: number, act: string, p: number, pitch?: number, bank?: number): void;
  /** Deck roll about the truck pivots (hangers stay level) and truck steer, radians. */
  setCarve(deckRoll: number, steer: number): void;
  /** Absolute wheel rotation (radians); `roll` advances it by speed·dt. */
  setWheelAngle(angle: number): void;
  roll(speed: number, dt: number): void;
  dispose(): void;
};
export {DECK_TOP};

export function createSkateboard(deck: SkateDeckId = 'tideline', options: SkateboardOptions = {}): Skateboard {
  const tier = options.tier ?? 'full';
  const group = new THREE.Group(); group.name = 'Harbour skateboard';
  const owned: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(x: T) => { owned.push(x); return x; };
  const std = (colour: string, extra: THREE.MeshStandardMaterialParameters = {}) => own(new THREE.MeshStandardMaterial({ color: colour, roughness: .82, flatShading: true, ...extra }));
  const info = (id: SkateDeckId) => SKATE_DECKS.find(d => d.id === id) ?? SKATE_DECKS[0];
  let current = info(deck);

  // ── Deck art (optional: no canvas → flat colours).
  const make = options.canvas ?? domCanvas;
  const gripSize = tier === 'full' ? [256, 512] as const : null, artSize = tier === 'full' ? [256, 512] as const : [128, 256] as const;
  const gripCanvas: CanvasLike | null = gripSize ? make(gripSize[0], gripSize[1]) : null;
  const artCanvas: CanvasLike | null = make(artSize[0], artSize[1]);
  const gripCtx = context2d(gripCanvas), artCtx = context2d(artCanvas);
  const gripTex = gripCtx ? own(new THREE.CanvasTexture(gripCanvas as unknown as HTMLCanvasElement)) : null;
  const artTex = artCtx ? own(new THREE.CanvasTexture(artCanvas as unknown as HTMLCanvasElement)) : null;
  for (const t of [gripTex, artTex]) if (t) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = tier === 'full' ? 4 : 1; }

  const gripMat = std(gripTex ? '#ffffff' : '#262c2f', { map: gripTex, roughness: 1 });
  const artMat = std(artTex ? '#ffffff' : current.colour, { map: artTex, roughness: .7 });
  const woodMat = std('#e6cfa6', { roughness: .9 });
  const dyedMat = std(current.ink, { roughness: .9 });
  const metalMat = std('#b9c3c4', { metalness: .55, roughness: .42 });
  const bushingMat = std(current.colour, { roughness: .6 });
  const wheelMat = std('#f1e4c4', { roughness: .66, flatShading: tier !== 'full' });
  const coreMat = std(current.ink, { roughness: .5 });
  const boltMat = std('#c9a45a', { metalness: .5, roughness: .45 });

  function paint(): void {
    if (gripCtx && gripSize) { paintGrip(gripCtx, gripSize[0], gripSize[1], current, tier === 'full'); gripTex!.needsUpdate = true; }
    if (artCtx) { paintGraphic(artCtx, artSize[0], artSize[1], current); artTex!.needsUpdate = true; }
    if (!artTex) artMat.color.set(current.colour);
    dyedMat.color.set(current.ink); bushingMat.color.set(current.colour); coreMat.color.set(current.ink);
  }
  paint();

  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, name?: string) => {
    const node = new THREE.Mesh(g, m); node.castShadow = true; node.receiveShadow = true; if (name) node.name = name; parent.add(node); return node;
  };

  // ── Deck, rolling about the truck pivot line so the wheels stay down.
  const deckPivot = new THREE.Group(); deckPivot.name = 'skateboard-deck-pivot'; deckPivot.position.y = BOARD.pivotY; group.add(deckPivot);
  const body = new THREE.Group(); body.name = 'skateboard-deck'; body.position.y = -BOARD.pivotY; deckPivot.add(body);
  const deckGeo = createDeckGeometries(tier);
  for (const g of Object.values(deckGeo)) own(g);
  mesh(deckGeo.top, gripMat, body, 'skateboard-grip');
  mesh(deckGeo.bottom, artMat, body, 'skateboard-graphic');
  mesh(deckGeo.edgeWood, woodMat, body, 'skateboard-ply');
  mesh(deckGeo.edgeDyed, dyedMat, body, 'skateboard-ply-dyed');

  const baseGeo = own(new THREE.BoxGeometry(.075, .012, .1));
  const bushGeo = own(new THREE.CylinderGeometry(.017, .019, .011, tier === 'full' ? 8 : 6));
  const pinGeo = own(new THREE.CylinderGeometry(.006, .006, .036, 6));
  const hangerGeo = own(createHangerGeometry());
  const axleGeo = own(new THREE.CylinderGeometry(.0055, .0055, (BOARD.wheelX + BOARD.wheelWidth / 2 + .004) * 2, 6)); axleGeo.rotateZ(Math.PI / 2);
  const wheelGeo = own(createWheelGeometry(tier)), coreGeo = own(createWheelCoreGeometry());
  const boltGeo = tier === 'full' ? own(new THREE.CylinderGeometry(.008, .008, .004, 6)) : null;

  const hangers: THREE.Group[] = [];
  const spinners: THREE.Group[] = [];
  for (const side of [1, -1] as const) {
    const z = side * BOARD.truckZ;
    const truck = new THREE.Group(); truck.name = side > 0 ? 'skateboard-truck-front' : 'skateboard-truck-back'; body.add(truck);
    mesh(baseGeo, metalMat, truck).position.set(0, BOARD.deckBottom - .006, z);
    const pin = mesh(pinGeo, metalMat, truck); pin.position.set(0, BOARD.deckBottom - .024, z - side * .012); pin.rotation.x = side * .5;
    const b1 = mesh(bushGeo, bushingMat, truck); b1.position.set(0, BOARD.deckBottom - .017, z - side * .012);
    const b2 = mesh(bushGeo, bushingMat, truck); b2.position.set(0, BOARD.pivotY + .004, z - side * .012);
    const hanger = new THREE.Group(); hanger.name = 'skateboard-hanger'; hanger.position.set(0, BOARD.pivotY, z); hanger.rotation.order = 'ZYX'; body.add(hanger);
    mesh(hangerGeo, metalMat, hanger).position.y = BOARD.axleY - BOARD.pivotY;
    mesh(axleGeo, metalMat, hanger).position.y = BOARD.axleY - BOARD.pivotY;
    hangers.push(hanger);
    for (const x of [-BOARD.wheelX, BOARD.wheelX]) {
      const spin = new THREE.Group(); spin.name = 'skateboard-wheel'; spin.position.set(x, BOARD.axleY - BOARD.pivotY, 0); hanger.add(spin);
      mesh(wheelGeo, wheelMat, spin);
      mesh(coreGeo, coreMat, spin);
      spinners.push(spin);
    }
    if (boltGeo) for (const dz of [-.022, .022]) for (const dx of [-.032, .032]) mesh(boltGeo, boltMat, body).position.set(dx, deckTopAt(dx, z + dz) + .0015, z + dz);
  }

  let wheelAngle = 0;
  const legacy = new THREE.Matrix4(), tmp = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3();
  const api: Skateboard = {
    group, tier,
    get deckId() { return current.id; },
    setDeck(id) { const next = info(id); if (next.id === current.id) return; current = next; paint(); },
    setCarve(deckRoll, steer) {
      deckPivot.rotation.z = deckRoll;
      // Hangers stay parallel to the ground (un-roll first, ZYX) and turn the wheels' axles: front one way, back the other.
      hangers[0]!.rotation.set(0, steer, -deckRoll);
      hangers[1]!.rotation.set(0, -steer, -deckRoll);
    },
    setWheelAngle(angle) { wheelAngle = angle; for (const s of spinners) s.rotation.x = angle; },
    roll(speed, dt) { api.setWheelAngle((wheelAngle + speed * dt / BOARD.wheelRadius) % (Math.PI * 2)); },
    pose(speed, dt, act, p, pitch = 0, bank = 0) {
      api.roll(speed, dt);
      api.setCarve(bank * .12, bank * .2);
      const k = Math.max(0, Math.min(1, Number.isFinite(p) ? p : 0));
      legacy.makeRotationX(pitch);
      const trick = act.startsWith('skate-') ? FALLBACK_FLIPS[act.slice(6)] : undefined;
      if (trick) legacy.multiply(flipMatrix(trick, k, -1, tmp));
      if (act === 'skate-manual') legacy.multiply(tmp.makeTranslation(0, 0, -BOARD.truckZ)).multiply(tmp.makeRotationX(-.17)).multiply(tmp.makeTranslation(0, 0, BOARD.truckZ));
      if (act === 'skate-grab') legacy.multiply(tmp.makeRotationZ(.25 * Math.sin(k * Math.PI)));
      legacy.decompose(pos, q, scl);
      group.position.copy(pos); group.quaternion.copy(q);
    },
    dispose() { group.removeFromParent(); for (const o of owned) o.dispose(); group.clear(); },
  };
  return api;
}

import * as THREE from "three";
import { engravedWords } from "../court/engraved.ts";
import type { TowerDressing } from "./dressing.ts";

/**
 * The tower's landing — the ground floor, where the two acts live: the **jug**
 * on its stand (the Fund's safe surplus, poured over the rack) and the **money
 * gun** on its peg. Neither of them moves money here. They are doors: tapping
 * either opens the Loft surface that already owns the pour, the gun and
 * Confirm (`src/queen/QueenLoft.tsx`).
 *
 * Only the custodian's landing is furnished. When somebody else holds the jug
 * the stand is bare and the peg is empty, and the twin says who has it — the
 * same fact the Loft states in words, told as an object.
 */

export type LandingJug = { safeCents: number; custodian: boolean; holder: string | null };
export type LandingGun = { available: boolean };

export const LANDING_LAYOUT = {
  /** The stand, at the landing's right as you look in from the Court. */
  stand: [1.35, 0, 0.95] as const,
  standHeight: 0.62,
  /** The peg is driven into the wall on the left. */
  peg: [-1.65, 0.95, 0.35] as const,
  jugHeight: 0.46,
} as const;

/** Words for the twins. Pure: no geometry, no money moved, "—" for an unknown amount. */
export function landingWords(jug: LandingJug | null, gun: LandingGun | null): { jug: string; gun: string } {
  const jugWords = !jug
    ? "The stand — no jug here yet."
    : !jug.custodian
      ? `The jug — ${jug.holder ? `${jug.holder} holds it` : "your partner holds it"}. Open the Loft.`
      : jug.safeCents > 0
        ? `The jug — ${engravedWords(jug.safeCents)} safe to pour. Open the Loft.`
        : "The jug — nothing safe to pour this month. Open the Loft.";
  const gunWords = !gun || !gun.available || !jug?.custodian
    ? "The peg — the money gun is not here."
    : "The money gun — throw a bill at a bank. Open the Loft.";
  return { jug: jugWords, gun: gunWords };
}

export type Landing = {
  readonly group: THREE.Group;
  /** What the reading says stands here. Missing parts leave the stand bare and the peg empty. */
  set(jug: LandingJug | null, gun: LandingGun | null): void;
  /** Tilts the jug: 0 upright, 1 fully poured. The Loft owns the real tilt; this only shows it. */
  setPour(k: number): void;
  /** Whether the jug and the gun are actually on the landing right now. */
  present(): { jug: boolean; gun: boolean };
  words(): { jug: string; gun: string };
  dispose(): void;
};

/** The stand and the peg, with the jug and the gun on them when they are here. */
export function createLanding(dressing: TowerDressing): Landing {
  const group = new THREE.Group();
  group.name = "landing";
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(item: T): T => { disposables.push(item); return item; };
  const material = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
    track(new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...extra }));

  const timber = material(dressing.stand, { roughness: 0.82 });
  const brass = material(dressing.brass, { roughness: 0.34, metalness: 0.62 });
  const glaze = material(dressing.jug, { roughness: 0.28 });

  // ── The stand: a turned pedestal with a dished top ─────────────────────────
  const [sx, , sz] = LANDING_LAYOUT.stand;
  const stand = new THREE.Group();
  stand.name = "jug-stand";
  stand.position.set(sx, 0, sz);
  stand.userData.anchor = "jug";
  group.add(stand);
  const column = new THREE.Mesh(track(new THREE.CylinderGeometry(0.11, 0.16, LANDING_LAYOUT.standHeight, 12)), timber);
  column.position.y = LANDING_LAYOUT.standHeight / 2; column.castShadow = true; column.receiveShadow = true;
  stand.add(column);
  const dish = new THREE.Mesh(track(new THREE.CylinderGeometry(0.26, 0.2, 0.07, 14)), timber);
  dish.position.y = LANDING_LAYOUT.standHeight + 0.03; dish.castShadow = true; dish.receiveShadow = true;
  stand.add(dish);

  // ── The jug: a thrown vessel with a brass band and a handle, on a pivot at its foot ──
  const jugPivot = new THREE.Group();
  jugPivot.name = "jug";
  jugPivot.position.y = LANDING_LAYOUT.standHeight + 0.07;
  jugPivot.userData.anchor = "jug";
  stand.add(jugPivot);
  const h = LANDING_LAYOUT.jugHeight;
  const profile = [
    new THREE.Vector2(0, 0), new THREE.Vector2(0.14, 0), new THREE.Vector2(0.15, h * 0.08),
    new THREE.Vector2(0.21, h * 0.45), new THREE.Vector2(0.16, h * 0.78), new THREE.Vector2(0.11, h * 0.94),
    new THREE.Vector2(0.13, h), new THREE.Vector2(0.11, h),
  ];
  const jugBody = new THREE.Mesh(track(new THREE.LatheGeometry(profile, 18)), glaze);
  jugBody.castShadow = true; jugBody.userData.anchor = "jug";
  jugPivot.add(jugBody);
  const handle = new THREE.Mesh(track(new THREE.TorusGeometry(0.1, 0.022, 7, 14, Math.PI * 1.1)), glaze);
  handle.position.set(-0.19, h * 0.62, 0); handle.rotation.z = -0.4; handle.userData.anchor = "jug";
  jugPivot.add(handle);
  const band = new THREE.Mesh(track(new THREE.TorusGeometry(0.16, 0.014, 6, 16)), brass);
  band.rotation.x = Math.PI / 2; band.position.y = h * 0.74; band.userData.anchor = "jug";
  jugPivot.add(band);

  // ── The peg, and the gun hanging on it ─────────────────────────────────────
  const [px, py, pz] = LANDING_LAYOUT.peg;
  const pegGroup = new THREE.Group();
  pegGroup.name = "gun-peg";
  pegGroup.position.set(px, py, pz);
  pegGroup.userData.anchor = "gun";
  group.add(pegGroup);
  const peg = new THREE.Mesh(track(new THREE.CylinderGeometry(0.035, 0.045, 0.28, 8)), timber);
  peg.rotation.x = Math.PI / 2; peg.position.z = 0.1; peg.castShadow = true;
  pegGroup.add(peg);

  const gun = new THREE.Group();
  gun.name = "money-gun";
  gun.position.set(0, -0.12, 0.18);
  gun.rotation.z = -0.25;
  gun.userData.anchor = "gun";
  pegGroup.add(gun);
  const barrel = new THREE.Mesh(track(new THREE.CylinderGeometry(0.045, 0.05, 0.3, 10)), brass);
  barrel.rotation.z = Math.PI / 2; barrel.castShadow = true; barrel.userData.anchor = "gun";
  gun.add(barrel);
  const grip = new THREE.Mesh(track(new THREE.BoxGeometry(0.07, 0.17, 0.06)), timber);
  grip.position.set(-0.1, -0.11, 0); grip.rotation.z = 0.22; grip.castShadow = true; grip.userData.anchor = "gun";
  gun.add(grip);
  const hopper = new THREE.Mesh(track(new THREE.BoxGeometry(0.1, 0.08, 0.11)), brass);
  hopper.position.set(0.02, 0.08, 0); hopper.userData.anchor = "gun";
  gun.add(hopper);

  let jugState: LandingJug | null = null;
  let gunState: LandingGun | null = null;
  let here = { jug: false, gun: false };
  let tilt = 0;

  const applyTilt = (): void => {
    const k = Math.max(0, Math.min(1, tilt));
    jugPivot.rotation.z = -k * 0.95;
    jugPivot.position.x = k * 0.06;
  };

  const set = (jug: LandingJug | null, gunReading: LandingGun | null): void => {
    jugState = jug;
    gunState = gunReading;
    here = {
      jug: Boolean(jug?.custodian),
      gun: Boolean(jug?.custodian && gunReading?.available),
    };
    jugPivot.visible = here.jug;
    gun.visible = here.gun;
    if (!here.jug) { tilt = 0; applyTilt(); }
  };

  set(null, null);
  applyTilt();

  return {
    group,
    set,
    setPour(k) { tilt = Number.isFinite(k) ? k : 0; applyTilt(); },
    present: () => ({ ...here }),
    words: () => landingWords(jugState, gunState),
    dispose() { for (const item of disposables) item.dispose(); },
  };
}

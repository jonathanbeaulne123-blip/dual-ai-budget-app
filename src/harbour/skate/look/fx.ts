import * as THREE from 'three';
import type { SkatePresent, SkateSimEvent, GrindableKind } from '../contract.ts';

/**
 * Tideline Skate Club v2 · the little things a board throws.
 *
 * Built like `body/dust.ts`: fixed pools, reused oldest-first, one shared
 * geometry per kind, nothing allocated while riding and nothing drawn once the
 * last piece is gone. Here the pools are `InstancedMesh`es (one draw each) of
 * cut-paper pieces — a spark is a bright paper sliver, landing dust is a
 * scatter of flecks, a banked line throws paper stars and lanterns. Colours
 * come from the theme. Reduced motion keeps only a faint landing scuff.
 *
 * Positions are in the look's root space (the space the ride frame moves in).
 */

export type LookTheme = 'classic' | 'taylor' | 'newfoundland';
export type FxTier = 'full' | 'lite';

export const FX_PALETTE: Readonly<Record<LookTheme, { spark: readonly string[]; wax: string; chalk: string; dust: string; confetti: readonly string[]; streak: string }>> = Object.freeze({
  classic: { spark: ['#ffd27a', '#fff3c4', '#f0a64a'], wax: '#efe6d2', chalk: '#ebe5d6', dust: '#cdbb98', confetti: ['#e0a23c', '#c8553d', '#4f8a8b', '#f3e7cf', '#8fb07c'], streak: '#f7f0e0' },
  taylor: { spark: ['#ffd1e6', '#fff0f7', '#f7b0d0'], wax: '#f6e3ec', chalk: '#f2e6ee', dust: '#e3c3cc', confetti: ['#ee9dc0', '#b58ee0', '#f6d28b', '#ffffff', '#82c7c1'], streak: '#fff4fa' },
  newfoundland: { spark: ['#ffe08a', '#fff6d0', '#f59c3c'], wax: '#eee8da', chalk: '#e6e2d8', dust: '#bfb8a6', confetti: ['#d8433b', '#2f6fb3', '#f2c230', '#3f9b5f', '#f5efe2'], streak: '#f4f1ea' },
});

/** Fixed budgets per tier (instances per pool). */
export const FX_BUDGET: Readonly<Record<FxTier, { sparks: number; flecks: number; confetti: number; chalk: number; speed: number }>> = Object.freeze({
  full: { sparks: 48, flecks: 64, confetti: 40, chalk: 28, speed: 12 },
  lite: { sparks: 20, flecks: 28, confetti: 16, chalk: 10, speed: 0 },
});

/** Where things touch, this frame, in root space (the façade fills it). */
export type FxContact = {
  /** Wheel contact points (4) as x,y,z triples, and the grind contact point. */
  wheels: Float32Array;
  grind: THREE.Vector3;
  /** Rider centre (for landings, bails, confetti) and travel heading. */
  centre: THREE.Vector3;
  ground: number;
};

export type SkateFx = {
  group: THREE.Group;
  update(p: SkatePresent, events: readonly SkateSimEvent[] | null, dt: number, reduced: boolean, at: FxContact): void;
  /** A banked line: cut-paper stars and lanterns, `strength` 0..1. */
  celebrate(strength: number, x: number, y: number, z: number, reduced?: boolean): void;
  setTheme(theme: LookTheme): void;
  /** Pieces currently showing. */
  live(): number;
  clear(): void;
  dispose(): void;
};

type Pool = {
  mesh: THREE.InstancedMesh; n: number; next: number; live: number;
  pos: Float32Array; vel: Float32Array; age: Float32Array; life: Float32Array; size: Float32Array; rot: Float32Array; spin: Float32Array;
  gravity: number; drag: number; flat: boolean; stretch: number;
};

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const METAL: ReadonlySet<GrindableKind> = new Set(['round-rail', 'coping', 'kinked-rail']);

export function createSkateFx(opts: { tier?: FxTier; theme?: LookTheme; seed?: number } = {}): SkateFx {
  const tier = opts.tier ?? 'full', budget = FX_BUDGET[tier];
  let theme: LookTheme = opts.theme ?? 'classic';
  const rand = rng(opts.seed ?? 0x5ca7e);
  const group = new THREE.Group(); group.name = 'skate-fx';
  const owned: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(x: T) => { owned.push(x); return x; };

  // Shapes: a paper sliver, a torn fleck, a flat strip, a five-point star, a little lantern.
  const sliver = own(new THREE.BufferGeometry());
  sliver.setAttribute('position', new THREE.Float32BufferAttribute([-.5, 0, 0, .5, 0, 0, 0, 0, 2.2, 0, 0, -.6], 3));
  sliver.setIndex([0, 1, 2, 1, 0, 3]); sliver.computeVertexNormals();
  const fleck = own(new THREE.BufferGeometry());
  fleck.setAttribute('position', new THREE.Float32BufferAttribute([-.5, 0, -.4, .55, 0, -.3, .1, 0, .6, -.35, 0, .2], 3));
  fleck.setIndex([0, 2, 1, 0, 3, 2]); fleck.computeVertexNormals();
  const strip = own(new THREE.PlaneGeometry(1, 1)); strip.rotateX(-Math.PI / 2);
  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i += 1) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .42 : 1; const x = Math.cos(a) * r, y = Math.sin(a) * r; if (i) starShape.lineTo(x, y); else starShape.moveTo(x, y); }
  const star = own(new THREE.ShapeGeometry(starShape));
  const lantern = own(new THREE.CylinderGeometry(.55, .55, 1.1, 6, 1));
  const line = own(new THREE.PlaneGeometry(.012, 1)); line.rotateX(-Math.PI / 2);

  const basic = (transparent: boolean, opacity = 1) => own(new THREE.MeshBasicMaterial({ color: '#ffffff', transparent, opacity, depthWrite: !transparent, side: THREE.DoubleSide }));
  const paper = () => own(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .95, flatShading: true, side: THREE.DoubleSide }));

  const pools: Pool[] = [];
  const pool = (name: string, geo: THREE.BufferGeometry, mat: THREE.Material, n: number, gravity: number, drag: number, flat = false, stretch = 0): Pool | null => {
    if (n <= 0) return null;
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    mesh.name = `skate-fx-${name}`; mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 2;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const zero = new THREE.Matrix4().makeScale(0, 0, 0), white = new THREE.Color('#ffffff');
    for (let i = 0; i < n; i += 1) { mesh.setMatrixAt(i, zero); mesh.setColorAt(i, white); }
    group.add(mesh);
    const P: Pool = { mesh, n, next: 0, live: 0, pos: new Float32Array(n * 3), vel: new Float32Array(n * 3), age: new Float32Array(n).fill(1), life: new Float32Array(n).fill(1), size: new Float32Array(n), rot: new Float32Array(n * 3), spin: new Float32Array(n * 3), gravity, drag, flat, stretch };
    pools.push(P);
    return P;
  };
  const sparks = pool('sparks', sliver, basic(false), budget.sparks, 7, 1.5, false, .06);
  const flecks = pool('flecks', fleck, paper(), budget.flecks, 2.4, 3.2);
  const stars = pool('stars', star, paper(), Math.ceil(budget.confetti * .65), .9, 2.2);
  const lanterns = pool('lanterns', lantern, paper(), Math.floor(budget.confetti * .35), .7, 2.4);
  const chalk = pool('chalk', strip, basic(true, .55), budget.chalk, 0, 0, true);
  const speed = pool('speed', line, basic(true, .4), budget.speed, 0, 0, true, .6);

  const _c = new THREE.Color(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();

  function emit(P: Pool | null, x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, colour: string, yaw = rand() * Math.PI * 2): number {
    if (!P) return -1;
    const i = P.next; P.next = (P.next + 1) % P.n;
    P.pos[i * 3] = x; P.pos[i * 3 + 1] = y; P.pos[i * 3 + 2] = z;
    P.vel[i * 3] = vx; P.vel[i * 3 + 1] = vy; P.vel[i * 3 + 2] = vz;
    P.age[i] = 0; P.life[i] = life; P.size[i] = size;
    P.rot[i * 3] = P.flat ? 0 : rand() * 6; P.rot[i * 3 + 1] = yaw; P.rot[i * 3 + 2] = P.flat ? 0 : rand() * 6;
    P.spin[i * 3] = P.flat ? 0 : (rand() - .5) * 14; P.spin[i * 3 + 1] = P.flat ? 0 : (rand() - .5) * 8; P.spin[i * 3 + 2] = P.flat ? 0 : (rand() - .5) * 14;
    P.mesh.setColorAt(i, _c.set(colour));
    if (P.mesh.instanceColor) P.mesh.instanceColor.needsUpdate = true;
    P.mesh.visible = true;
    return i;
  }

  function stepPool(P: Pool | null, dt: number): void {
    if (!P || !P.mesh.visible) return;
    let live = 0;
    for (let i = 0; i < P.n; i += 1) {
      const age = P.age[i]!, life = P.life[i]!;
      if (age >= life) continue;
      const a = age + dt; P.age[i] = a;
      if (a >= life) { P.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0)); continue; }
      live += 1;
      const k = i * 3, damp = Math.exp(-P.drag * dt);
      P.vel[k + 1] = P.vel[k + 1]! - P.gravity * dt;
      P.vel[k] = P.vel[k]! * damp; P.vel[k + 1] = P.vel[k + 1]! * damp; P.vel[k + 2] = P.vel[k + 2]! * damp;
      P.pos[k] = P.pos[k]! + P.vel[k]! * dt; P.pos[k + 1] = P.pos[k + 1]! + P.vel[k + 1]! * dt; P.pos[k + 2] = P.pos[k + 2]! + P.vel[k + 2]! * dt;
      P.rot[k] = P.rot[k]! + P.spin[k]! * dt; P.rot[k + 1] = P.rot[k + 1]! + P.spin[k + 1]! * dt; P.rot[k + 2] = P.rot[k + 2]! + P.spin[k + 2]! * dt;
      const t = a / life, fade = P.flat ? (1 - t) : (1 - t * t);
      const sz = P.size[i]! * fade;
      _e.set(P.rot[k]!, P.rot[k + 1]!, P.rot[k + 2]!); _q.setFromEuler(_e);
      if (P.flat) _s.set(sz, 1, P.stretch || (P.size[i]! * 5)); else _s.set(sz, sz, sz * (1 + P.stretch * 40));
      _m.compose(_p.set(P.pos[k]!, P.pos[k + 1]!, P.pos[k + 2]!), _q, _s);
      P.mesh.setMatrixAt(i, _m);
    }
    P.live = live;
    P.mesh.instanceMatrix.needsUpdate = true;
    if (!live) P.mesh.visible = false;
  }

  let grindKind: GrindableKind | null = null, sparkDebt = 0, chalkDebt = 0, speedDebt = 0;
  const pal = () => FX_PALETTE[theme];

  function burst(P: Pool | null, n: number, x: number, y: number, z: number, speedOut: number, up: number, life: number, size: number, colours: readonly string[] | string): void {
    for (let i = 0; i < n; i += 1) {
      const a = rand() * Math.PI * 2, s = speedOut * (.4 + rand() * .6);
      const colour = typeof colours === 'string' ? colours : colours[Math.floor(rand() * colours.length)]!;
      emit(P, x + Math.cos(a) * .05, y + .02, z + Math.sin(a) * .05, Math.cos(a) * s, up * (.5 + rand() * .7), Math.sin(a) * s, life * (.7 + rand() * .5), size * (.7 + rand() * .6), colour);
    }
  }

  return {
    group,
    update(p, events, dt, reduced, at) {
      const P = pal();
      const scale = reduced ? 0 : 1;
      for (const e of events ?? []) {
        if (e.kind === 'grind-start') grindKind = e.kind2;
        if (e.kind === 'land') {
          const force = Math.min(1, .25 + e.airTime * .8);
          const n = reduced ? 2 : Math.round((tier === 'full' ? 7 : 4) + force * (tier === 'full' ? 10 : 5));
          burst(flecks, n, at.centre.x, at.ground, at.centre.z, .9 + force * 1.4, .9 + force, .55, .03 + force * .02, [P.dust, P.dust, P.chalk]);
        }
        if (e.kind === 'bail' && !reduced) burst(flecks, tier === 'full' ? 16 : 8, at.centre.x, at.ground, at.centre.z, 1.6, 1.6, .8, .045, [P.dust, P.dust, P.chalk]);
      }
      if (p.phase !== 'grind') grindKind = null;
      // Grinding: sparks off metal, wax dust off ledges and benches.
      if (p.phase === 'grind' && scale > 0) {
        const metal = grindKind ? METAL.has(grindKind) : p.surface === 'metal';
        sparkDebt += dt * (metal ? 42 : 16) * Math.min(1.5, .4 + (p.speed || 0) / 6) * (tier === 'full' ? 1 : .5);
        const back = -Math.sin(p.heading), backZ = -Math.cos(p.heading);
        while (sparkDebt >= 1) {
          sparkDebt -= 1;
          const s = 1 + rand() * 2.2;
          if (metal) emit(sparks, at.grind.x, at.grind.y, at.grind.z, back * s + (rand() - .5) * 1.6, .6 + rand() * 1.6, backZ * s + (rand() - .5) * 1.6, .22 + rand() * .2, .011 + rand() * .008, P.spark[Math.floor(rand() * P.spark.length)]!, Math.atan2(back, backZ));
          else emit(flecks, at.grind.x, at.grind.y, at.grind.z, back * s * .4 + (rand() - .5) * .5, .3 + rand() * .5, backZ * s * .4 + (rand() - .5) * .5, .45, .018 + rand() * .01, P.wax);
        }
      } else sparkDebt = 0;
      // Wheel chalk: short fading strips on hard ground when carving hard or powersliding.
      const hard = p.surface === 'concrete' || p.surface === 'wood' || p.surface === 'path' || p.surface === 'cobble';
      const sliding = p.phase === 'powerslide';
      const grounded = p.phase !== 'air' && p.phase !== 'grind' && p.phase !== 'bail' && p.phase !== 'recover';
      if (chalk && scale > 0 && hard && grounded && (sliding || (Math.abs(p.carve || 0) > .6 && (p.speed || 0) > 3))) {
        chalkDebt += dt * (sliding ? 30 : 10);
        while (chalkDebt >= 1) {
          chalkDebt -= 1;
          for (let w = sliding ? 0 : 2; w < 4; w += 1) {
            const i = emit(chalk, at.wheels[w * 3]!, at.ground + .004 + w * .0005, at.wheels[w * 3 + 2]!, 0, 0, 0, sliding ? .9 : .6, .026, P.chalk, p.heading);
            if (i >= 0) chalk.size[i] = .026;
          }
        }
      } else chalkDebt = 0;
      // Speed streaks: a few pale lines sliding past at full pelt.
      if (speed && scale > 0 && grounded && (p.speed || 0) > 7) {
        speedDebt += dt * ((p.speed || 0) - 6) * 3;
        while (speedDebt >= 1) {
          speedDebt -= 1;
          const side = (rand() - .5) * 1.4, up = .1 + rand() * .7, fx = Math.sin(p.heading), fz = Math.cos(p.heading);
          const x = at.centre.x + fx * 1.2 + fz * side, z = at.centre.z + fz * 1.2 - fx * side;
          emit(speed, x, at.ground + up, z, -fx * (p.speed || 0) * .6, 0, -fz * (p.speed || 0) * .6, .25, 1, P.streak, p.heading);
        }
      } else speedDebt = 0;
      for (const P2 of pools) stepPool(P2, dt);
    },
    celebrate(strength, x, y, z, reduced = false) {
      const s = Math.max(0, Math.min(1, strength)), C = pal().confetti;
      const nStars = reduced ? 2 : Math.round((stars?.n ?? 0) * (.3 + .5 * s)), nLant = reduced ? 1 : Math.round((lanterns?.n ?? 0) * (.3 + .5 * s));
      burst(stars, nStars, x, y + .9, z, 1.1 + s, 2.2 + s * 1.5, 1.8, .045, C);
      burst(lanterns, nLant, x, y + .9, z, .9 + s, 2 + s * 1.2, 2.1, .04, C);
    },
    setTheme(next) { theme = next; },
    live: () => pools.reduce((n, P) => n + (P.mesh.visible ? P.live || 1 : 0), 0),
    clear() {
      for (const P of pools) { P.age.fill(1); P.life.fill(1); P.live = 0; P.mesh.visible = false; for (let i = 0; i < P.n; i += 1) P.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0)); P.mesh.instanceMatrix.needsUpdate = true; }
    },
    dispose() {
      group.removeFromParent();
      for (const P of pools) P.mesh.dispose();
      for (const o of owned) o.dispose();
      group.clear();
    },
  };
}

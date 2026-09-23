import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createSkateFx, FX_BUDGET, FX_PALETTE, type FxContact } from "../src/harbour/skate/look/fx.ts";
import { blankPresent } from "../src/harbour/skate/look/legacy.ts";
import type { SkateSimEvent } from "../src/harbour/skate/contract.ts";

const at = (): FxContact => ({ wheels: new Float32Array([.13, 0, .19, -.13, 0, .19, .13, 0, -.19, -.13, 0, -.19]), grind: new THREE.Vector3(0, .5, 0), centre: new THREE.Vector3(), ground: 0 });
const land: SkateSimEvent = { t: 0, kind: "land", spinDeg: 0, boardClean: 1, fakie: false, switch: false, airTime: .8, gap: 2, onFeature: null, revert: false };
const instances = (fx: ReturnType<typeof createSkateFx>) => {
  let n = 0; fx.group.traverse((o) => { const m = o as THREE.InstancedMesh; if (m.isInstancedMesh) n += m.count; }); return n;
};

describe("skate look · FX", () => {
  it("has fixed pools per tier, one instanced draw each", () => {
    const full = createSkateFx({ tier: "full" }), lite = createSkateFx({ tier: "lite" });
    const sum = (b: typeof FX_BUDGET.full) => b.sparks + b.flecks + b.confetti + b.chalk + b.speed;
    expect(instances(full)).toBe(sum(FX_BUDGET.full));
    expect(instances(lite)).toBe(sum(FX_BUDGET.lite));
    expect(instances(lite)).toBeLessThan(instances(full) / 2);
    const p = blankPresent();
    // Hammering the pools never grows them.
    for (let i = 0; i < 200; i += 1) { p.phase = "grind"; p.speed = 6; p.surface = "metal"; full.update(p, [land], 1 / 60, false, at()); full.celebrate(1, 0, 0, 0); }
    expect(instances(full)).toBe(sum(FX_BUDGET.full));
    full.dispose(); lite.dispose();
  });

  it("throws sparks off metal, wax off a ledge, a puff on landing, confetti for a banked line", () => {
    const fx = createSkateFx({ tier: "full" });
    const p = blankPresent();
    const visible = (name: string) => (fx.group.getObjectByName(`skate-fx-${name}`) as THREE.InstancedMesh).visible;
    p.phase = "grind"; p.speed = 5;
    fx.update(p, [{ t: 0, kind: "grind-start", grindId: "50-50", grindableId: "r", kind2: "round-rail", switch: false, fakie: false }], 1 / 60, false, at());
    for (let i = 0; i < 10; i += 1) fx.update(p, [], 1 / 60, false, at());
    expect(visible("sparks")).toBe(true);
    fx.clear();
    fx.update(p, [{ t: 0, kind: "grind-start", grindId: "50-50", grindableId: "l", kind2: "ledge", switch: false, fakie: false }], 1 / 60, false, at());
    for (let i = 0; i < 10; i += 1) fx.update(p, [], 1 / 60, false, at());
    expect(visible("sparks")).toBe(false); expect(visible("flecks")).toBe(true);
    fx.clear();
    p.phase = "land"; fx.update(p, [land], 1 / 60, false, at());
    expect(visible("flecks")).toBe(true);
    fx.celebrate(.8, 0, 0, 0);
    fx.update(p, [], 1 / 60, false, at());
    expect(visible("stars")).toBe(true); expect(visible("lanterns")).toBe(true);
    // Everything fades and stops drawing.
    p.phase = "roll"; p.speed = 0;
    for (let i = 0; i < 300; i += 1) fx.update(p, [], 1 / 60, false, at());
    expect(fx.live()).toBe(0);
    fx.dispose();
  });

  it("chalks the concrete on a powerslide and streaks at speed", () => {
    const fx = createSkateFx({ tier: "full" });
    const p = blankPresent(); p.phase = "powerslide"; p.speed = 8; p.surface = "concrete";
    for (let i = 0; i < 20; i += 1) fx.update(p, [], 1 / 60, false, at());
    expect((fx.group.getObjectByName("skate-fx-chalk") as THREE.Mesh).visible).toBe(true);
    expect((fx.group.getObjectByName("skate-fx-speed") as THREE.Mesh).visible).toBe(true);
    p.surface = "grass"; p.phase = "roll"; p.speed = 2; fx.clear();
    for (let i = 0; i < 20; i += 1) fx.update(p, [], 1 / 60, false, at());
    expect(fx.live()).toBe(0);
    fx.dispose();
  });

  it("goes almost quiet under reduced motion", () => {
    const count = (reduced: boolean) => {
      const fx = createSkateFx({ tier: "full" });
      const p = blankPresent();
      let peak = 0;
      for (let i = 0; i < 60; i += 1) {
        p.phase = i < 30 ? "grind" : "powerslide"; p.speed = 9; p.surface = "concrete";
        fx.update(p, i === 0 ? [{ t: 0, kind: "grind-start", grindId: "50-50", grindableId: "r", kind2: "round-rail", switch: false, fakie: false }, land, { t: 0, kind: "bail", reason: "wall" }] : [], 1 / 60, reduced, at());
        if (i === 10) fx.celebrate(1, 0, 0, 0, reduced);
        let live = 0;
        fx.group.traverse((o) => { const m = o as THREE.InstancedMesh; if (!m.isInstancedMesh || !m.visible) return; const e = new THREE.Matrix4(); for (let k = 0; k < m.count; k += 1) { m.getMatrixAt(k, e); if (e.elements[0] !== 0 || e.elements[5] !== 0) live += 1; } });
        peak = Math.max(peak, live);
      }
      fx.dispose();
      return peak;
    };
    const loud = count(false), quiet = count(true);
    expect(loud).toBeGreaterThan(40);
    expect(quiet).toBeLessThanOrEqual(6);
  });

  it("takes its colours from the theme", () => {
    const fx = createSkateFx({ tier: "lite", theme: "newfoundland" });
    fx.celebrate(1, 0, 0, 0);
    const stars = fx.group.getObjectByName("skate-fx-stars") as THREE.InstancedMesh;
    const c = new THREE.Color(); stars.getColorAt(0, c);
    expect(FX_PALETTE.newfoundland.confetti.map((h) => new THREE.Color(h).getHexString())).toContain(c.getHexString());
    fx.setTheme("taylor");
    fx.dispose();
  });

  it("disposes every geometry and material", () => {
    const fx = createSkateFx({ tier: "full" });
    const owned = new Set<{ dispose(): void; addEventListener(t: "dispose", f: () => void): void }>();
    fx.group.traverse((o) => { const m = o as THREE.InstancedMesh; if (m.isInstancedMesh) { owned.add(m.geometry); owned.add(m.material as THREE.Material); } });
    let freed = 0; for (const x of owned) x.addEventListener("dispose", () => { freed += 1; });
    fx.dispose();
    expect(freed).toBe(owned.size);
    expect(fx.group.children.length).toBe(0);
  });
});
